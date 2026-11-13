# Kaggle GPU worker for AutoSocial AI

This integrates the existing AutoSocial project with the inspected `airesearch-official/free-aistudio` inference workflows. It does not rebuild the app or download model weights to your Windows computer. Z-Image-Turbo serves image generation/remix; LTX-Video 2.3 serves Reels/video generation. The worker adapts the upstream stable-diffusion.cpp API to a small authenticated job API, and AutoSocial saves returned media through its existing `/uploads` route and generator flows.

## What the repository currently provides

The free-aistudio project contains Kaggle-oriented model notebooks and a local inference server; it is not a permanent hosted GPU API. Its existing notebook workflow can create temporary shared Gradio/Cloudflare access. This integration does not expose Gradio. It starts a loopback-bound bridge and a Cloudflare quick tunnel protected by a random bearer token. The URL and token change when that Kaggle session restarts. Kaggle controls GPU availability, internet access, quotas, and session duration; free GPU access is temporary and not guaranteed.

The app calls the worker using `Authorization: Bearer <OPEN_GPU_WORKER_TOKEN>`:

- `GET /v1/health` checks the authenticated worker and reports the currently loaded model mode.
- `POST /v1/jobs` submits an image or video request and returns a job ID.
- `GET /v1/jobs/{id}` polls job status.
- `GET /v1/jobs/{id}/media` downloads the completed file.
- `GET /healthz` is intentionally unauthenticated but reports only process readiness; it exposes no job or media data.

`MEDIA_SESSION_SECRET` is not sent to Kaggle. AutoSocial uses it as an HMAC-SHA256 key to sign free-worker video job IDs; the app rejects unsigned or tampered polling requests. Keep all three values on the server side and never name them `VITE_*` variables.

## Manual Kaggle action required

A Kaggle account must be authorized by you; this environment cannot sign in, enable a GPU, or accept Kaggle's terms on your behalf. For each model mode you want to test:

1. Sign in to Kaggle and open **Code → Notebooks**.
2. Download and import the relevant prepared notebook: [`autosocial-z-image-turbo.ipynb`](notebooks/autosocial-z-image-turbo.ipynb) or [`autosocial-ltx-video-2-3.ipynb`](notebooks/autosocial-ltx-video-2-3.ipynb).
3. Enable notebook Internet and select a GPU T4 accelerator if Kaggle offers it for your account.
4. Run all cells in order. Model dependencies and weights download at runtime and may take a while.
5. Leave the notebook running. Its final cell prints the actual temporary `OPEN_GPU_WORKER_URL` and a cryptographically random `OPEN_GPU_WORKER_TOKEN`. Do not share notebook output containing this token. A notebook restart generates a different URL and token.

The image and video models use separate notebooks because the upstream inference server loads one selected model pipeline per Kaggle worker. The app's one `OPEN_GPU_WORKER_URL`/token pair addresses one active worker mode at a time. To test image and video separately, run the relevant notebook, put its URL/token in the local app `.env`, and restart AutoSocial. The Settings health card identifies which model the configured worker currently serves. This version does not claim both models run simultaneously on one free GPU or provide a persistent URL.

## Configure the three secrets locally

In the AutoSocial repository, copy `.env.example` to `.env`. `.env*` is Git-ignored except `.env.example`; do not commit `.env` or paste secret values into chat. Set:

```dotenv
OPEN_GPU_WORKER_URL=https://<actual-url-printed-by-the-active-kaggle-notebook>
OPEN_GPU_WORKER_TOKEN=<actual-token-printed-by-that-notebook>
MEDIA_SESSION_SECRET=<a-random-secret-generated-on-your-own-computer>
MEDIA_GENERATION_PROVIDER=free-aistudio
```

For PowerShell, generate a 48-byte-equivalent random session key locally with:

```powershell
py -c "import secrets; print(secrets.token_urlsafe(48))"
```

Copy the generated line directly into `MEDIA_SESSION_SECRET` in your local `.env`; do not send it to me. `OPEN_GPU_WORKER_TOKEN` comes from the running notebook, not from a fabricated URL or a source-code constant. `OPEN_GPU_WORKER_URL` is only known after the notebook starts. Restart the app after editing `.env`.

For local development, `bun install` (or `npm install`) and `bun run dev` start AutoSocial. Open **Settings → Free GPU Image & Video Generation → Check services**. `GET /api/ai/free-aistudio/status` reports image and video readiness separately, because only the model mode loaded by the active worker will pass its check. For deployment, add these values through the hosting provider's server-side secret/environment-variable manager, not frontend configuration.

## Processing and limits

- Image requests use the upstream `/sdcpp/v1/img_gen` API, including an optional reference image for image-to-image editing/remix.
- Video requests use `/sdcpp/v1/vid_gen` and are limited to 10 seconds. Longer requests fail explicitly. The bridge requests exact 9:16 or 16:9 dimensions at low native resolution suitable for a free T4; it does not claim HD/720p output.
- GPU jobs are serialized one at a time. The bridge validates generated media signatures, and video is only marked completed if FFmpeg yields a browser-compatible MP4.
- Kaggle sessions and quick-tunnel URLs are temporary. If a session expires, generation reports the worker as unavailable instead of returning a fake success or silently calling a paid image/video API.
- AutoSocial text-generation and publishing code paths remain unchanged. `PUBLORA_API_KEY` and the existing Instagram publishing integration are preserved.
- FIBO 2.0 and Qwen Image 2.1 were inspected but are not exposed by this bridge. FIBO's model terms include a non-commercial restriction unless separately licensed; check each upstream model card before commercial use.

The notebooks and adapter have been statically and mock-tested in this checkout, but neither notebook has yet run under your Kaggle account. Actual image/video inference and Kaggle worker connectivity require the manual session steps above.
