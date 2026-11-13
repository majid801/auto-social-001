"""Authenticated AutoSocial adapter for free-aistudio's stable-diffusion.cpp API.

Run only on a trusted GPU notebook. Bind to loopback and expose through a secure
client tunnel. All job and output routes require a random bearer token. The model
server itself remains on 127.0.0.1:1234 and is never exposed through the tunnel.
"""
from __future__ import annotations

import base64
import hmac
import json
import mimetypes
import os
import re
import secrets
import tempfile
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

import requests
from src.ui import get_working_dir, make_preview_video

MAX_REQUEST_BYTES = 25 * 1024 * 1024
MAX_JOBS = 32
SERVER_URL = os.environ.get("FREE_AISTUDIO_BACKEND_URL", "http://127.0.0.1:1234").rstrip("/")
TOKEN = os.environ.get("AUTOSOCIAL_API_TOKEN", "")
MODEL_KIND = os.environ.get("AUTOSOCIAL_MODEL_KIND", "")
JOBS: dict[str, dict] = {}
JOBS_LOCK = threading.Lock()
EXECUTOR = ThreadPoolExecutor(max_workers=1, thread_name_prefix="autosocial-gpu")


def _request_payload(job: dict, payload: dict) -> tuple[dict, str]:
    kind = payload.get("kind")
    if kind != MODEL_KIND:
        raise ValueError(f"This GPU session is configured for {MODEL_KIND or 'no model'} jobs, not {kind} jobs.")
    prompt = str(payload.get("prompt", "")).strip()
    if not prompt or len(prompt) > 8000:
        raise ValueError("Prompt must contain 1–8000 characters.")
    width, height = int(payload.get("width", 1024 if kind == "image" else 480)), int(payload.get("height", 1024 if kind == "image" else 832))
    if width < 256 or height < 256 or width > 1536 or height > 1536 or width % 32 or height % 32:
        raise ValueError("Width and height must be multiples of 32 between 256 and 1536.")
    init_image = None
    reference = payload.get("referenceImageBase64")
    if reference:
        if not isinstance(reference, str) or len(reference) > 20 * 1024 * 1024:
            raise ValueError("Reference image is too large.")
        if reference.startswith("data:"):
            header, reference = reference.split(",", 1)
            mime = header[5:].split(";", 1)[0]
        else:
            mime = "image/png"
        raw = base64.b64decode(reference, validate=True)
        if not raw or len(raw) > 15 * 1024 * 1024:
            raise ValueError("Reference image must be no larger than 15 MB.")
        signatures = ((b"\x89PNG\r\n\x1a\n", "image/png"), (b"\xff\xd8\xff", "image/jpeg"), (b"GIF87a", "image/gif"), (b"GIF89a", "image/gif"), (b"RIFF", "image/webp"))
        if not any(raw.startswith(sig) and (mime == expected or expected == "image/webp" and raw[8:12] == b"WEBP") for sig, expected in signatures):
            raise ValueError("Reference must be a PNG, JPEG, GIF, or WebP image.")
        init_image = f"data:{mime};base64,{base64.b64encode(raw).decode('ascii')}"
    guidance = {"txt_cfg": 3.5, "img_cfg": 3.5, "distilled_guidance": 3.5}
    sample_params = {"scheduler": "discrete", "sample_method": "euler", "sample_steps": max(4, min(int(payload.get("steps", 8)), 20)), "flow_shift": 1.3568, "guidance": guidance}
    if kind == "image":
        request_body = {
            "prompt": prompt, "negative_prompt": "", "width": width, "height": height,
            "strength": 0.72 if init_image else 1.0, "seed": -1, "batch_count": 1,
            "init_image": init_image, "sample_params": sample_params,
            "output_format": "png", "output_compression": 100,
        }
        return request_body, "img_gen"
    if kind == "video":
        duration = max(1.0, min(float(payload.get("durationSeconds", 5)), 10.0))
        fps = 12
        frames = min(121, ((max(9, round(duration * fps)) - 1 + 8) // 8) * 8 + 1)
        request_body = {
            "prompt": prompt, "negative_prompt": "", "width": width, "height": height,
            "strength": 0.75 if init_image else 1.0, "seed": -1, "video_frames": frames,
            "fps": fps, "moe_boundary": 0.875, "vace_strength": 1.0,
            "init_image": init_image, "sample_params": sample_params,
            "vae_tiling_params": {"enabled": True, "temporal_tiling": True, "tile_size_x": 16, "tile_size_y": 16, "target_overlap": 0.25, "extra_tiling_args": "temporal_tile_frames=4,temporal_tile_overlap=1"},
            "output_format": "avi", "output_compression": 100,
        }
        return request_body, "vid_gen"
    raise ValueError("kind must be 'image' or 'video'.")


def _run_job(job_id: str, payload: dict) -> None:
    with JOBS_LOCK:
        JOBS[job_id]["status"] = "processing"
        JOBS[job_id]["updatedAt"] = time.time()
    try:
        request_body, kind = _request_payload(JOBS[job_id], payload)
        response = requests.post(f"{SERVER_URL}/sdcpp/v1/{kind}", json=request_body, timeout=60)
        response.raise_for_status()
        engine_job_id = response.json().get("id")
        if not engine_job_id:
            raise RuntimeError("Inference engine did not return a job ID.")
        deadline = time.monotonic() + (20 * 60 if kind == "vid_gen" else 5 * 60)
        result = None
        while time.monotonic() < deadline:
            poll = requests.get(f"{SERVER_URL}/sdcpp/v1/jobs/{engine_job_id}", timeout=120)
            poll.raise_for_status()
            state = poll.json()
            if state.get("status") == "completed":
                result = state.get("result") or {}
                break
            if state.get("status") in ("failed", "cancelled"):
                raise RuntimeError(str(state.get("error") or state.get("message") or "GPU inference failed.")[:2000])
            time.sleep(2.0 if kind == "img_gen" else 5.0)
        if result is None:
            raise TimeoutError("GPU inference timed out before producing output.")
        if kind == "img_gen":
            images = result.get("images") or []
            encoded = images[0].get("b64_json") if images else None
            suffix = ".png"
            valid_signature = lambda b: b.startswith(b"\x89PNG\r\n\x1a\n") or b.startswith(b"\xff\xd8\xff")
        else:
            encoded = result.get("b64_json")
            suffix = ".avi"
            valid_signature = lambda b: len(b) > 12 and (b[4:8] == b"ftyp" or b[:4] == b"RIFF" or b[:4] == b"\x1aE\xdf\xa3")
        if not encoded:
            raise RuntimeError("Inference completed but returned no media bytes.")
        media = base64.b64decode(encoded, validate=True)
        if not media or not valid_signature(media):
            raise RuntimeError("Inference output failed media validation.")
        if kind == "img_gen" and media.startswith(b"\xff\xd8\xff"):
            suffix = ".jpg"
        output_dir = Path(get_working_dir()).resolve()
        output_dir.mkdir(parents=True, exist_ok=True)
        output_path = output_dir / f"autosocial-{job_id}{suffix}"
        output_path.write_bytes(media)
        if kind == "vid_gen":
            output_path = Path(make_preview_video(str(output_path))).resolve()
            if not output_path.is_file() or output_path.stat().st_size == 0 or output_path.suffix.lower() != ".mp4":
                raise RuntimeError("FFmpeg did not produce a browser-compatible MP4 preview from the generated LTX output.")
            with output_path.open("rb") as handle:
                if handle.read(12)[4:8] != b"ftyp":
                    raise RuntimeError("Converted video is not a valid MP4 container.")
        with JOBS_LOCK:
            JOBS[job_id].update(status="completed", path=str(output_path), mimeType=mimetypes.guess_type(output_path.name)[0] or "application/octet-stream", filename=output_path.name, updatedAt=time.time())
    except Exception as exc:
        with JOBS_LOCK:
            JOBS[job_id].update(status="failed", error=str(exc)[:2000], updatedAt=time.time())


class Handler(BaseHTTPRequestHandler):
    server_version = "AutoSocialGPUBridge/1.0"

    def log_message(self, fmt, *args):
        print("[AutoSocial bridge] " + (fmt % args))

    def _json(self, status: int, body: dict) -> None:
        encoded = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(encoded)

    def _authorized(self) -> bool:
        return bool(TOKEN) and hmac.compare_digest(self.headers.get("Authorization", ""), "Bearer " + TOKEN)

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/healthz":
            return self._json(200, {"ok": True, "service": "free-aistudio"})
        if not self._authorized():
            return self._json(401, {"error": "Unauthorized"})
        if path == "/v1/health":
            try:
                engine = requests.get(f"{SERVER_URL}/system_stats", timeout=3)
                engine.raise_for_status()
            except Exception:
                return self._json(503, {"ok": False, "error": "GPU inference backend is not ready"})
            models = ["z-image-turbo"] if MODEL_KIND == "image" else ["ltx-video-2.3"] if MODEL_KIND == "video" else []
            return self._json(200, {"ok": bool(models), "models": models})
        match = re.fullmatch(r"/v1/jobs/([a-f0-9-]{36})(/media)?", path)
        if not match:
            return self._json(404, {"error": "Not found"})
        job_id, media_suffix = match.groups()
        with JOBS_LOCK:
            snapshot = dict(JOBS[job_id]) if job_id in JOBS else None
        if not snapshot:
            return self._json(404, {"error": "Job not found"})
        if media_suffix:
            if snapshot.get("status") != "completed":
                return self._json(409, {"error": "Job output is not ready"})
            try:
                path = Path(snapshot["path"])
                data = path.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", snapshot["mimeType"])
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Content-Disposition", f'attachment; filename="{path.name}"')
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(data)
            except OSError:
                return self._json(410, {"error": "Output file has expired with this GPU session"})
            return
        snapshot.pop("path", None)
        return self._json(200, snapshot)

    def do_POST(self):
        if urlparse(self.path).path != "/v1/jobs":
            return self._json(404, {"error": "Not found"})
        if not self._authorized():
            return self._json(401, {"error": "Unauthorized"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > MAX_REQUEST_BYTES:
                return self._json(413, {"error": "Request size is invalid or exceeds the limit"})
            payload = json.loads(self.rfile.read(length))
            with JOBS_LOCK:
                # Discard only finished metadata when the bounded job list is full.
                if len(JOBS) >= MAX_JOBS:
                    for old_id in [key for key, value in JOBS.items() if value.get("status") in ("completed", "failed")][:MAX_JOBS // 2]:
                        JOBS.pop(old_id, None)
                if len(JOBS) >= MAX_JOBS:
                    return self._json(429, {"error": "GPU job queue is full; wait for an existing job"})
                job_id = str(uuid.uuid4())
                JOBS[job_id] = {"jobId": job_id, "status": "queued", "createdAt": time.time(), "updatedAt": time.time()}
            EXECUTOR.submit(_run_job, job_id, payload)
            return self._json(202, {"jobId": job_id, "status": "queued"})
        except (ValueError, TypeError, json.JSONDecodeError) as exc:
            return self._json(400, {"error": str(exc)[:1000]})


def serve(host: str = "127.0.0.1", port: int = 8765) -> None:
    if not TOKEN or len(TOKEN) < 32:
        raise RuntimeError("Set AUTOSOCIAL_API_TOKEN to a random secret of at least 32 characters before starting the bridge.")
    if MODEL_KIND not in ("image", "video"):
        raise RuntimeError("Set AUTOSOCIAL_MODEL_KIND to 'image' or 'video' before starting the bridge.")
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"Authenticated AutoSocial GPU bridge listening on {host}:{port}")
    server.serve_forever()
