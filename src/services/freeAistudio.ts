import fs from 'node:fs';
import path from 'node:path';

export interface FreeAistudioJobStatus {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  error?: string;
  filename?: string;
  mimeType?: string;
}

type MediaKind = 'image' | 'video';

function serviceConfig() {
  const rawUrl = process.env.OPEN_GPU_WORKER_URL?.trim();
  const token = process.env.OPEN_GPU_WORKER_TOKEN?.trim();
  if (!rawUrl || !token) throw new Error('Set OPEN_GPU_WORKER_URL and OPEN_GPU_WORKER_TOKEN on the AutoSocial server.');
  const url = new URL(rawUrl);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('Free-aistudio service URL must use HTTPS.');
  }
  if (token.length < 32) throw new Error('OPEN_GPU_WORKER_TOKEN must contain at least 32 characters.');
  return { baseUrl: url.toString().replace(/\/$/, ''), token };
}

async function request(kind: MediaKind, pathname: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<Response> {
  const { baseUrl, token } = serviceConfig();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${baseUrl}${pathname}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function freeAistudioHealth(kind: MediaKind) {
  const mediaSessionSecret = process.env.MEDIA_SESSION_SECRET?.trim() || '';
  const configured = Boolean(process.env.OPEN_GPU_WORKER_URL && process.env.OPEN_GPU_WORKER_TOKEN);
  if (!configured) {
    return { configured: false, ready: false, message: 'Set OPEN_GPU_WORKER_URL and OPEN_GPU_WORKER_TOKEN on the AutoSocial server.' };
  }
  if (kind === 'video' && mediaSessionSecret.length < 32) {
    return { configured: false, ready: false, message: 'Set MEDIA_SESSION_SECRET (at least 32 characters) to sign video job sessions.' };
  }
  try {
    const response = await request(kind, '/v1/health');
    if (!response.ok) return { configured: true, ready: false, message: `GPU worker returned HTTP ${response.status}.` };
    const result = await response.json() as { ok?: boolean; models?: string[] };
    const models = result.models || [];
    const expectedModel = kind === 'image' ? 'z-image-turbo' : 'ltx-video-2.3';
    const supportsMode = models.includes(expectedModel);
    return {
      configured: true,
      ready: result.ok === true && supportsMode,
      models,
      message: result.ok && supportsMode
        ? `Authenticated GPU worker is ready for ${kind} generation.`
        : result.ok
          ? `Worker is online but currently runs ${models.join(', ') || 'no recognized model'}; switch to ${expectedModel} for ${kind} generation.`
          : 'GPU worker did not report ready.',
    };
  } catch (error) {
    return { configured, ready: false, message: error instanceof Error ? error.message : 'GPU service is unreachable.' };
  }
}

export async function submitFreeAistudioJob(kind: MediaKind, payload: Record<string, unknown>) {
  const response = await request(kind, '/v1/jobs', { method: 'POST', body: JSON.stringify(payload) });
  const result = await response.json().catch(() => ({})) as { jobId?: string; status?: string; error?: string };
  if (!response.ok || !result.jobId) throw new Error(result.error || `GPU service rejected job (HTTP ${response.status}).`);
  return { jobId: result.jobId, status: result.status || 'queued' };
}

export async function getFreeAistudioJob(kind: MediaKind, jobId: string): Promise<FreeAistudioJobStatus> {
  const response = await request(kind, `/v1/jobs/${encodeURIComponent(jobId)}`);
  const result = await response.json().catch(() => ({})) as FreeAistudioJobStatus & { error?: string };
  if (!response.ok) throw new Error(result.error || `GPU job status request failed (HTTP ${response.status}).`);
  return result;
}

export async function downloadFreeAistudioJob(kind: MediaKind, jobId: string): Promise<{ bytes: Buffer; mimeType: string }> {
  const response = await request(kind, `/v1/jobs/${encodeURIComponent(jobId)}/media`, {}, 5 * 60_000);
  if (!response.ok) {
    const detail = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(detail.error || `GPU output download failed (HTTP ${response.status}).`);
  }
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > 300 * 1024 * 1024) throw new Error('GPU output exceeds the 300 MB download limit.');
  const mimeType = response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream';
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 300 * 1024 * 1024) throw new Error('GPU output exceeds the 300 MB download limit.');
  return { bytes, mimeType };
}

export function persistGeneratedMedia(bytes: Buffer, mimeType: string, kind: 'image' | 'video', uploadsDir: string) {
  if (!bytes.length || bytes.length > 300 * 1024 * 1024) throw new Error('Generated media is empty or exceeds the 300 MB limit.');
  let ext: string;
  if (kind === 'image') {
    if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ext = '.png';
    else if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ext = '.jpg';
    else throw new Error('GPU output failed image validation; only valid PNG/JPEG bytes are accepted.');
  } else {
    const mp4 = bytes.length > 12 && bytes.toString('ascii', 4, 8) === 'ftyp';
    const webm = bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    const avi = bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.toString('ascii', 8, 12) === 'AVI ';
    if (!mp4 && !webm && !avi) throw new Error('GPU output failed video validation; it is not MP4, WebM, or AVI media.');
    ext = mp4 ? '.mp4' : webm ? '.webm' : '.avi';
  }
  const name = `ai-${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const output = path.join(uploadsDir, name);
  fs.writeFileSync(output, bytes, { flag: 'wx' });
  return { url: `/uploads/${name}`, filename: name, mimeType };
}

export function readLocalReferenceImage(referenceImageUrl: unknown, uploadsDir: string) {
  if (typeof referenceImageUrl !== 'string' || !referenceImageUrl.startsWith('/uploads/')) return undefined;
  const filename = path.basename(referenceImageUrl);
  const imagePath = path.join(uploadsDir, filename);
  if (!fs.existsSync(imagePath)) return undefined;
  const stat = fs.statSync(imagePath);
  if (stat.size > 15 * 1024 * 1024) throw new Error('Reference image cannot exceed 15 MB.');
  const data = fs.readFileSync(imagePath);
  const mimeType = data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? 'image/png'
    : data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
      ? 'image/jpeg'
      : data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP'
        ? 'image/webp'
        : '';
  if (!mimeType) throw new Error('Reference file is not a supported PNG, JPEG, or WebP image.');
  return `data:${mimeType};base64,${data.toString('base64')}`;
}
