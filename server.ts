import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure upload & data directories exist
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const schedulerStorePath = path.join(dataDir, 'scheduler-store.json');

// Serve public uploads statically
app.use('/uploads', express.static(uploadsDir));

// Multer storage config
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${cleanName}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowedMime = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/quicktime',
      'video/webm',
    ];
    if (allowedMime.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Unsupported file type: ${file.mimetype}. Allowed types: JPEG, PNG, WEBP, GIF, MP4, MOV, WEBM`
        )
      );
    }
  },
});

// ----------------------------------------------------
// GEMINI CLIENT & ERROR HELPERS
// ----------------------------------------------------
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim().length === 0) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseGeminiError(error: any, context?: { modelUsed?: string; endpoint?: string }) {
  const rawMsg = error?.message || String(error || 'Unknown Gemini API error');
  const statusMatch = rawMsg.match(/\b(400|401|403|404|429|500|503)\b/);
  const statusCode = error?.status || (statusMatch ? Number(statusMatch[1]) : 500);
  const lower = rawMsg.toLowerCase();

  const isAuthOrPermission =
    statusCode === 403 ||
    statusCode === 401 ||
    lower.includes('permission_denied') ||
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid');

  const isQuota =
    statusCode === 429 ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('billing');

  const isFreeTierZero =
    lower.includes('limit: 0') ||
    lower.includes('free_tier') ||
    (lower.includes('resource_exhausted') && !lower.includes('404'));

  const isUnavailable = statusCode === 503 || lower.includes('unavailable') || lower.includes('high demand');
  const isNotFound = !isQuota && (statusCode === 404 || lower.includes('not found') || lower.includes('not_found'));

  const requiresPaidKey = isAuthOrPermission || isQuota;
  const errorCode = isQuota
    ? 'RESOURCE_EXHAUSTED'
    : isAuthOrPermission
    ? 'PERMISSION_DENIED'
    : isNotFound
    ? 'NOT_FOUND'
    : isUnavailable
    ? 'UNAVAILABLE'
    : 'API_ERROR';

  let friendlyMessage = rawMsg;
  let suggestion =
    'Check your GEMINI_API_KEY configuration in Settings -> Secrets and try again.';

  if (isQuota) {
    friendlyMessage = isFreeTierZero
      ? `Gemini API returned 429 RESOURCE_EXHAUSTED: the configured API key's current tier has quota limit: 0 for ${context?.modelUsed || 'this media model'}.`
      : `Gemini API quota exceeded (429 RESOURCE_EXHAUSTED) for ${context?.modelUsed || 'this model'}.`;
    suggestion =
      'Configure a billing-enabled GEMINI_API_KEY in Google AI Studio Settings -> Secrets, or upload/select media directly in the Media Library.';
  } else if (isAuthOrPermission) {
    friendlyMessage =
      `Gemini API returned Permission Denied (${statusCode}) for ${context?.modelUsed || 'this model'}.`;
    suggestion =
      'Verify your GEMINI_API_KEY permissions in Google AI Studio Settings -> Secrets, or upload media directly.';
  } else if (isUnavailable) {
    friendlyMessage = `Gemini model ${context?.modelUsed || ''} is temporarily experiencing high demand (503).`.trim();
    suggestion = 'Please retry your request in a moment.';
  } else if (isNotFound) {
    friendlyMessage =
      `Requested Gemini model endpoint (${context?.modelUsed || 'unknown'}) was not found (404) or is unsupported for this API version.`;
    suggestion =
      'Verify the model ID against GET /api/ai/models or upload your own asset to the Media Library.';
  }

  return {
    httpStatus: isAuthOrPermission ? 403 : isQuota ? 429 : isUnavailable ? 503 : isNotFound ? 404 : 500,
    errorCode,
    isQuotaOrModelLimit: isQuota || isAuthOrPermission || isNotFound,
    requiresPaidKey,
    ...(context?.modelUsed ? { modelUsed: context.modelUsed } : {}),
    ...(context?.endpoint ? { endpoint: context.endpoint } : {}),
    error: friendlyMessage,
    rawError: rawMsg,
    suggestion,
  };
}

async function generateTextWithFallback(
  ai: GoogleGenAI,
  params: { contents: any; config?: any }
): Promise<{ response: any; modelUsed: string }> {
  const modelsToTry = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'];
  let lastErr: any = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        ...(params.config ? { config: params.config } : {}),
      });
      return { response, modelUsed: model };
    } catch (err: any) {
      lastErr = err;
      const msg = String(err?.message || '').toLowerCase();
      const isTransient =
        err?.status === 503 ||
        err?.status === 429 ||
        msg.includes('503') ||
        msg.includes('unavailable') ||
        msg.includes('high demand');
      if (isTransient && i < modelsToTry.length - 1) {
        await new Promise((r) => setTimeout(r, 350));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

function safeJsonParse(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    return JSON.parse(cleaned);
  }
}

// ----------------------------------------------------
// PERSISTENT SCHEDULER STORE
// ----------------------------------------------------
interface ScheduledJobRecord {
  id: string;
  userId: string;
  title: string;
  format: string;
  caption: string;
  hashtags: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  mediaType?: 'image' | 'video';
  scheduledTime: string;
  approved: boolean;
  autoPublishApproved: boolean;
  status: string;
  publoraPostId?: string;
  publishedTime?: string;
  failureReason?: string;
  inProgress?: boolean;
  updatedAt: string;
}

interface StoredAutomationRule {
  id: string;
  userId: string;
  name: string;
  description: string;
  triggerType: string;
  frequency: string;
  category?: string;
  timeOfDay?: string;
  timezone?: string;
  isEnabled: boolean;
  lastRunDate?: string;
  lastExecutionTime?: string;
  lastResult?: string;
  executionCount: number;
}

interface SchedulerStore {
  posts: ScheduledJobRecord[];
  automations: StoredAutomationRule[];
  generatedDrafts: any[];
  logs: any[];
  lastTickAt: string | null;
}

function loadSchedulerStore(): SchedulerStore {
  try {
    if (fs.existsSync(schedulerStorePath)) {
      const parsed = JSON.parse(fs.readFileSync(schedulerStorePath, 'utf-8'));
      return {
        posts: Array.isArray(parsed.posts) ? parsed.posts : [],
        automations: Array.isArray(parsed.automations) ? parsed.automations : [],
        generatedDrafts: Array.isArray(parsed.generatedDrafts) ? parsed.generatedDrafts : [],
        logs: Array.isArray(parsed.logs) ? parsed.logs : [],
        lastTickAt: parsed.lastTickAt || null,
      };
    }
  } catch (err) {
    console.error('Failed to read scheduler-store.json:', err);
  }
  return { posts: [], automations: [], generatedDrafts: [], logs: [], lastTickAt: null };
}

function saveSchedulerStore(store: SchedulerStore) {
  try {
    fs.writeFileSync(schedulerStorePath, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save scheduler-store.json:', err);
  }
}

// ----------------------------------------------------
// PUBLORA API HELPERS
// ----------------------------------------------------
const PUBLORA_BASE_URL = 'https://api.publora.com/api/v1';

function getPubloraHeaders(): Record<string, string> | null {
  const apiKey = process.env.PUBLORA_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) return null;
  return {
    'Content-Type': 'application/json',
    'x-publora-key': apiKey,
  };
}

function getMimeFromFilename(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.mov') return 'video/quicktime';
  if (ext === '.webm') return 'video/webm';
  return 'application/octet-stream';
}

async function resolveInstagramPlatformId(headers: Record<string, string>): Promise<string | null> {
  const connRes = await fetch(`${PUBLORA_BASE_URL}/platform-connections`, {
    method: 'GET',
    headers,
  });
  const connData = await connRes.json().catch(() => null);
  const connections = Array.isArray(connData)
    ? connData
    : connData?.connections || connData?.data || [];
  const activeInstagram = connections.find(
    (c: any) =>
      (c.platformId || c.platform || '').toLowerCase().includes('instagram') &&
      (c.connectionStatus === 'active' || !c.connectionStatus)
  );
  return activeInstagram?.platformId || activeInstagram?.connectionId || null;
}

async function submitPostToPublora(params: {
  content: string;
  platformId?: string;
  format?: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  coverUrl?: string;
  scheduledTime?: string;
  publishNow?: boolean;
  idempotencyKey?: string;
}) {
  const headers = getPubloraHeaders();
  if (!headers) {
    return {
      ok: false,
      status: 401,
      error: 'PUBLORA_API_KEY missing on server.',
    };
  }

  const allMedia = [
    ...(Array.isArray(params.mediaUrls) ? params.mediaUrls : []),
    ...(params.mediaUrl ? [params.mediaUrl] : []),
  ]
    .map((u) => (u || '').trim())
    .filter((u, idx, arr) => Boolean(u) && arr.indexOf(u) === idx);

  if (allMedia.length === 0) {
    return {
      ok: false,
      status: 400,
      error:
        'Instagram requires at least one image or video file before publishing or scheduling via Publora.',
      code: 'MEDIA_REQUIRED',
    };
  }

  const format = (params.format || 'post').toLowerCase();
  if (format === 'carousel' && allMedia.length < 2) {
    return {
      ok: false,
      status: 400,
      error: 'Instagram Carousels require between 2 and 10 images.',
    };
  }

  const targetPlatform = params.platformId || (await resolveInstagramPlatformId(headers));
  if (!targetPlatform) {
    return {
      ok: false,
      status: 400,
      error: 'No active Instagram connection found in Publora.',
    };
  }

  const platformSettings: any = {};
  if (format === 'reel' || format === 'video') {
    platformSettings.instagram = {
      videoType: 'REELS',
      ...(params.coverUrl && params.coverUrl.startsWith('http') ? { coverUrl: params.coverUrl } : {}),
    };
  } else if (format === 'story') {
    platformSettings.instagram = {
      videoType: 'STORIES',
    };
  }

  const localFiles: string[] = [];
  const externalUrls: string[] = [];
  for (const item of allMedia) {
    if (item.startsWith('/uploads/')) {
      localFiles.push(item);
    } else if (item.startsWith('http://') || item.startsWith('https://')) {
      // Check if it points back to our own /uploads/
      try {
        const parsed = new URL(item);
        if (parsed.pathname.startsWith('/uploads/')) {
          localFiles.push(parsed.pathname);
        } else {
          externalUrls.push(item);
        }
      } catch {
        externalUrls.push(item);
      }
    }
  }

  // Validate all local files actually exist on disk before touching Publora
  for (const lf of localFiles) {
    const safeName = path.basename(lf);
    const fullPath = path.join(uploadsDir, safeName);
    if (!fs.existsSync(fullPath)) {
      return {
        ok: false,
        status: 404,
        error: `Attached local media file "${safeName}" was not found on server storage.`,
      };
    }
  }

  const idemKey =
    params.idempotencyKey || `pub-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // Case A: All media are already external public HTTPS URLs
  if (localFiles.length === 0 && externalUrls.length > 0) {
    const payload: any = {
      content: params.content,
      platforms: [targetPlatform],
      mediaUrls: externalUrls,
    };
    if (Object.keys(platformSettings).length > 0) {
      payload.platformSettings = platformSettings;
    }
    if (params.scheduledTime) {
      payload.scheduledTime = new Date(params.scheduledTime).toISOString();
    } else if (params.publishNow) {
      payload.publishNow = true;
    }

    const res = await fetch(`${PUBLORA_BASE_URL}/create-post`, {
      method: 'POST',
      headers: { ...headers, 'Idempotency-Key': idemKey },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: data?.message || data?.error || `Publora rejected post (HTTP ${res.status})`,
        details: data,
      };
    }
    return {
      ok: true,
      status: res.status,
      data,
      postGroupId: data?.postGroupId || data?.id || data?.post?.postGroupId,
      idempotencyKey: idemKey,
    };
  }

  // Case B: Upload local files to Publora pre-signed S3 storage via 3-step official flow
  // Step 1: Create draft post group first
  const draftPayload: any = {
    content: params.content,
    platforms: [targetPlatform],
  };
  if (Object.keys(platformSettings).length > 0) {
    draftPayload.platformSettings = platformSettings;
  }

  const createRes = await fetch(`${PUBLORA_BASE_URL}/create-post`, {
    method: 'POST',
    headers: { ...headers, 'Idempotency-Key': idemKey },
    body: JSON.stringify(draftPayload),
  });
  const createData = await createRes.json().catch(() => null);
  if (!createRes.ok) {
    return {
      ok: false,
      status: createRes.status,
      error:
        createData?.message ||
        createData?.error ||
        `Publora draft initialization failed (HTTP ${createRes.status})`,
      details: createData,
    };
  }

  const postGroupId =
    createData?.postGroupId || createData?.id || createData?.post?.postGroupId;
  if (!postGroupId) {
    return {
      ok: false,
      status: 500,
      error: 'Publora did not return a postGroupId for media upload.',
      details: createData,
    };
  }

  // Step 2: Upload each local media file to Publora S3 via /get-upload-url
  const uploadedFileUrls: string[] = [...externalUrls];
  for (const lf of localFiles) {
    const safeName = path.basename(lf);
    const fullPath = path.join(uploadsDir, safeName);
    const fileBuffer = fs.readFileSync(fullPath);
    const contentType = getMimeFromFilename(safeName);
    const mediaType = contentType.startsWith('video/') ? 'video' : 'image';

    const urlRes = await fetch(`${PUBLORA_BASE_URL}/get-upload-url`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        fileName: safeName,
        contentType,
        postGroupId,
        type: mediaType,
      }),
    });
    const urlData = await urlRes.json().catch(() => null);
    if (!urlRes.ok || !urlData?.uploadUrl) {
      return {
        ok: false,
        status: urlRes.status || 500,
        error:
          urlData?.message ||
          urlData?.error ||
          `Failed to obtain Publora S3 upload URL for ${safeName}`,
        details: urlData,
        postGroupId,
      };
    }

    const putRes = await fetch(urlData.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
      },
      body: fileBuffer,
    });
    if (!putRes.ok) {
      return {
        ok: false,
        status: putRes.status,
        error: `Failed uploading media binary (${safeName}) to Publora S3 (HTTP ${putRes.status})`,
        postGroupId,
      };
    }

    if (urlData.fileUrl) {
      uploadedFileUrls.push(urlData.fileUrl);
    }
  }

  // Step 3: Transition postGroupId to scheduled or publishNow (or leave as draft if neither requested)
  if (params.scheduledTime || params.publishNow) {
    const updateBody: any = {
      content: params.content,
    };
    if (Object.keys(platformSettings).length > 0) {
      updateBody.platformSettings = platformSettings;
    }
    if (params.scheduledTime) {
      updateBody.status = 'scheduled';
      updateBody.scheduledTime = new Date(params.scheduledTime).toISOString();
    } else if (params.publishNow) {
      updateBody.publishNow = true;
    }

    const updateRes = await fetch(
      `${PUBLORA_BASE_URL}/update-post/${encodeURIComponent(postGroupId)}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(updateBody),
      }
    );
    const updateData = await updateRes.json().catch(() => null);
    if (!updateRes.ok) {
      return {
        ok: false,
        status: updateRes.status,
        error:
          updateData?.message ||
          updateData?.error ||
          `Failed finalizing post ${postGroupId} (HTTP ${updateRes.status})`,
        details: updateData,
        postGroupId,
      };
    }

    return {
      ok: true,
      status: updateRes.status,
      data: updateData,
      postGroupId,
      uploadedFileUrls,
      idempotencyKey: idemKey,
    };
  }

  return {
    ok: true,
    status: 200,
    data: createData,
    postGroupId,
    uploadedFileUrls,
    idempotencyKey: idemKey,
  };
}

// ----------------------------------------------------
// SYSTEM & CONFIG STATUS
// ----------------------------------------------------
app.get('/api/config/status', (_req: Request, res: Response) => {
  const publoraKey = process.env.PUBLORA_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const store = loadSchedulerStore();

  res.json({
    status: 'ok',
    publora: {
      configured: Boolean(publoraKey && publoraKey.trim().length > 0),
      message: publoraKey
        ? 'Publora API key configured in server environment'
        : 'PUBLORA_API_KEY is not configured in Google AI Studio Secrets',
    },
    gemini: {
      configured: Boolean(
        geminiKey && geminiKey.trim().length > 0 && geminiKey !== 'MY_GEMINI_API_KEY'
      ),
      message:
        geminiKey && geminiKey !== 'MY_GEMINI_API_KEY'
          ? 'Gemini API key configured'
          : 'GEMINI_API_KEY is not configured',
    },
    scheduler: {
      active: true,
      queuedPostsCount: store.posts.filter((p) => p.status === 'scheduled').length,
      automationsCount: store.automations.filter((a) => a.isEnabled).length,
      lastTickAt: store.lastTickAt,
    },
    serverTime: new Date().toISOString(),
  });
});

// ----------------------------------------------------
// PUBLORA API INTEGRATION ROUTES
// ----------------------------------------------------
app.get('/api/publora/platform-connections', async (_req: Request, res: Response) => {
  const headers = getPubloraHeaders();
  if (!headers) {
    return res.status(401).json({
      success: false,
      error:
        'PUBLORA_API_KEY is missing. Please configure PUBLORA_API_KEY in Google AI Studio Settings -> Secrets.',
      needsKey: true,
      connections: [],
      instagramAccounts: [],
    });
  }

  try {
    const response = await fetch(`${PUBLORA_BASE_URL}/platform-connections`, {
      method: 'GET',
      headers,
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: data?.message || `Publora API error: HTTP ${response.status}`,
        details: data,
        connections: [],
        instagramAccounts: [],
      });
    }

    const allConnections = Array.isArray(data)
      ? data
      : data?.data || data?.connections || [];

    const instagramAccounts = allConnections
      .filter((conn: any) => {
        const platform = (
          conn.platform ||
          conn.platform_type ||
          conn.type ||
          conn.platformId ||
          ''
        ).toLowerCase();
        return platform.includes('instagram') || platform.includes('insta');
      })
      .map((conn: any) => ({
        id: conn.connectionId || conn.platformId,
        connectionId: conn.connectionId,
        platformId: conn.platformId,
        accountId: conn.platformId || conn.connectionId,
        username: conn.username || conn.displayName || 'instagram_user',
        displayName: conn.displayName || conn.username || 'instagram_user',
        profilePictureUrl: conn.profileImageUrl || conn.profile_picture || null,
        connectionStatus: conn.connectionStatus || 'active',
        tokenStatus: conn.tokenStatus || 'valid',
        tokenExpiresIn: conn.tokenExpiresIn,
        accessTokenExpiresAt: conn.accessTokenExpiresAt,
        publishingCapabilities: 'Reels, Single Post, Carousels, Stories',
        planInfo: conn.subscriptionType || 'Publora Starter Plan',
        raw: conn,
      }));

    return res.json({
      success: true,
      raw: data,
      allConnectionsCount: allConnections.length,
      instagramAccounts,
      connected: instagramAccounts.length > 0,
      verifiedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Publora platform-connections error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to connect to Publora API',
      connections: [],
      instagramAccounts: [],
    });
  }
});

app.post('/api/publora/test-connection', async (req: Request, res: Response) => {
  const headers = getPubloraHeaders();
  if (!headers) {
    return res.status(401).json({ success: false, error: 'PUBLORA_API_KEY missing' });
  }

  try {
    const connRes = await fetch(`${PUBLORA_BASE_URL}/platform-connections`, {
      method: 'GET',
      headers,
    });
    const connData = await connRes.json().catch(() => null);
    const connections = Array.isArray(connData)
      ? connData
      : connData?.connections || connData?.data || [];

    const matching = connections.find(
      (c: any) =>
        c.connectionId === req.body?.connectionId ||
        c.platformId === req.body?.platformId ||
        (c.platformId || '').toLowerCase().includes('instagram')
    );

    if (matching && matching.tokenStatus === 'valid' && matching.connectionStatus === 'active') {
      return res.json({
        success: true,
        message: `Instagram connection @${matching.username || matching.platformId} is active and valid via Publora v1 API.`,
        connection: matching,
      });
    }

    return res.status(connRes.ok ? 404 : connRes.status).json({
      success: false,
      error: 'No active Instagram connection found with valid token status.',
      details: connData,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/publora/create-post', async (req: Request, res: Response) => {
  const idempotencyKey =
    (req.headers['idempotency-key'] as string) ||
    `pub-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  try {
    const {
      caption,
      content,
      hashtags,
      mediaUrl,
      mediaUrls,
      coverUrl,
      format,
      platformId,
      scheduledTime,
      publishNow,
      videoType,
    } = req.body || {};

    const fullContent =
      content ||
      [caption || '', hashtags || '']
        .map((s) => s.trim())
        .filter(Boolean)
        .join('\n\n');

    const result = await submitPostToPublora({
      content: fullContent,
      platformId,
      format: videoType === 'STORIES' ? 'story' : videoType === 'REELS' ? 'reel' : format,
      mediaUrl,
      mediaUrls,
      coverUrl,
      scheduledTime,
      publishNow: Boolean(publishNow && !scheduledTime),
      idempotencyKey,
    });

    if (!result.ok) {
      return res.status(result.status).json({
        success: false,
        error: result.error,
        code: (result as any).code,
        details: result.details,
      });
    }

    return res.json({
      success: true,
      postGroupId: result.postGroupId,
      data: result.data,
      uploadedFileUrls: result.uploadedFileUrls,
      idempotencyKey: result.idempotencyKey,
      submittedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/publora/list-posts', async (req: Request, res: Response) => {
  const headers = getPubloraHeaders();
  if (!headers) {
    return res.status(401).json({ success: false, error: 'PUBLORA_API_KEY missing' });
  }

  try {
    const queryParams = new URLSearchParams(req.query as Record<string, string>).toString();
    const url = `${PUBLORA_BASE_URL}/list-posts${queryParams ? `?${queryParams}` : ''}`;
    const response = await fetch(url, { method: 'GET', headers });
    const data = await response.json().catch(() => null);
    return res.status(response.status).json(data);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/publora/get-post/:id', async (req: Request, res: Response) => {
  const headers = getPubloraHeaders();
  if (!headers) {
    return res.status(401).json({ success: false, error: 'PUBLORA_API_KEY missing' });
  }

  try {
    const { id } = req.params;
    const response = await fetch(`${PUBLORA_BASE_URL}/get-post/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers,
    });
    const data = await response.json().catch(() => null);
    return res.status(response.status).json(data);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/publora/update-post/:id', async (req: Request, res: Response) => {
  const headers = getPubloraHeaders();
  if (!headers) {
    return res.status(401).json({ success: false, error: 'PUBLORA_API_KEY missing' });
  }

  try {
    const { id } = req.params;
    const response = await fetch(`${PUBLORA_BASE_URL}/update-post/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(req.body),
    });
    const data = await response.json().catch(() => null);
    return res.status(response.status).json(data);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/publora/update-post', async (req: Request, res: Response) => {
  const headers = getPubloraHeaders();
  if (!headers) {
    return res.status(401).json({ success: false, error: 'PUBLORA_API_KEY missing' });
  }

  try {
    const { postGroupId, id, ...rest } = req.body || {};
    const targetId = postGroupId || id;
    if (!targetId) {
      return res.status(400).json({ success: false, error: 'postGroupId is required' });
    }
    const response = await fetch(
      `${PUBLORA_BASE_URL}/update-post/${encodeURIComponent(targetId)}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(rest),
      }
    );
    const data = await response.json().catch(() => null);
    return res.status(response.status).json(data);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/publora/delete-post/:id', async (req: Request, res: Response) => {
  const headers = getPubloraHeaders();
  if (!headers) {
    return res.status(401).json({ success: false, error: 'PUBLORA_API_KEY missing' });
  }

  try {
    const { id } = req.params;
    const response = await fetch(`${PUBLORA_BASE_URL}/delete-post/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers,
    });
    const data = await response.json().catch(() => null);
    return res.status(response.status).json(data);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/publora/delete-post', async (req: Request, res: Response) => {
  const headers = getPubloraHeaders();
  if (!headers) {
    return res.status(401).json({ success: false, error: 'PUBLORA_API_KEY missing' });
  }

  try {
    const targetId = req.body?.postGroupId || req.body?.id;
    if (!targetId) {
      return res.status(400).json({ success: false, error: 'postGroupId is required' });
    }
    const response = await fetch(
      `${PUBLORA_BASE_URL}/delete-post/${encodeURIComponent(targetId)}`,
      {
        method: 'DELETE',
        headers,
      }
    );
    const data = await response.json().catch(() => null);
    return res.status(response.status).json(data);
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ----------------------------------------------------
// GEMINI AI INTEGRATION ROUTES
// ----------------------------------------------------

// 0. Live Model Availability Discovery (v1beta/models)
app.get('/api/ai/models', async (_req: Request, res: Response) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim().length === 0) {
    return res.status(500).json({
      success: false,
      error: 'GEMINI_API_KEY is not configured on the server.',
    });
  }

  try {
    const v1betaRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200`,
      {
        headers: {
          'x-goog-api-key': apiKey,
        },
      }
    );
    const v1betaData = await v1betaRes.json().catch(() => null);

    if (!v1betaRes.ok) {
      return res.status(v1betaRes.status).json({
        success: false,
        error: v1betaData?.error?.message || `Failed to list models (HTTP ${v1betaRes.status})`,
        details: v1betaData,
      });
    }

    const rawModels: any[] = Array.isArray(v1betaData?.models) ? v1betaData.models : [];
    const models = rawModels.map((m) => ({
      id: String(m.name || '').replace(/^models\//, ''),
      name: m.name,
      displayName: m.displayName || '',
      description: m.description || '',
      supportedGenerationMethods: m.supportedGenerationMethods || [],
    }));

    const imageModels = models.filter((m) => {
      const id = m.id.toLowerCase();
      const methods = m.supportedGenerationMethods.join(' ').toLowerCase();
      return (
        id.includes('image') ||
        id.includes('imagen') ||
        id.includes('nano-banana') ||
        methods.includes('predict') ||
        methods.includes('generateimages')
      );
    });

    const videoModels = models.filter((m) => {
      const id = m.id.toLowerCase();
      const methods = m.supportedGenerationMethods.join(' ').toLowerCase();
      return (
        id.includes('veo') ||
        id.includes('omni') ||
        methods.includes('predictlongrunning') ||
        methods.includes('generatevideos')
      );
    });

    const textModels = models.filter((m) =>
      m.supportedGenerationMethods.includes('generateContent')
    );

    return res.json({
      success: true,
      endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
      totalCount: models.length,
      imageModels,
      videoModels,
      textModelsCount: textModels.length,
      models,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to query Gemini models list',
    });
  }
});

// 1. Universal AI Command & Intent Parser (17 Intents)
app.post('/api/ai/command-intent', async (req: Request, res: Response) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(500).json({
      success: false,
      error: 'GEMINI_API_KEY is not configured on the server.',
    });
  }

  const { command } = req.body || {};
  if (!command || typeof command !== 'string' || !command.trim()) {
    return res.status(400).json({ success: false, error: 'Command text is required.' });
  }

  try {
    const { response, modelUsed } = await generateTextWithFallback(ai, {
      contents: `Analyze this user command for an Instagram-only automation SaaS called AutoSocial AI and return structured intent routing JSON.

User command: "${command}"

Available views/tabs:
- "content-studio": AI Content Studio (captions, hashtags, 20 content ideas, 7-day calendars, weekly strategies, marketing/product descriptions, text generation)
- "image-generator": AI Image Generator (creating/generating images, visuals, graphics)
- "video-reels": Reels & Video Studio (AI video generation, Reel scripts, storyboards)
- "carousel-creator": Carousel Creator (multi-slide Instagram carousels)
- "story-creator": Story Creator (interactive Instagram story frames, polls, stickers)
- "composer": Unified Post Composer (writing/assembling/publishing/scheduling a specific post)
- "calendar": Content Calendar (viewing/managing scheduled calendar, 7-day plan view)
- "drafts": Drafts & Approval (showing/filtering drafts or awaiting approval posts)
- "scheduled": Scheduled Posts Queue (viewing/managing queued/scheduled posts)
- "history": Publishing History (viewing published posts and provider history)
- "accounts": Instagram Account (checking @am.toxicated6 connection, token, account status)
- "media": Media Library (finding/searching uploaded or generated images/videos)
- "analytics": Analytics (performance & posting breakdown)
- "automations": Automation Centre (automated workflows, rules, cron)
- "skills": Agent Skills Centre (13 Instagram tools: ig-audit, ig-viral, etc.)
- "inbox": Instagram Inbox (comments, DM replies)
- "monetization": Brand Campaigns (brand deals, sponsorships)
- "settings": Settings (timezone, auto-publishing toggle)

Intent Categories (must be one of):
1. "text_generation"
2. "caption_generation"
3. "hashtag_generation"
4. "image_generation"
5. "video_generation"
6. "reel_creation"
7. "carousel_creation"
8. "story_creation"
9. "calendar_management"
10. "draft_management"
11. "scheduling"
12. "publishing"
13. "account_management"
14. "media_search"
15. "analytics"
16. "automation"
17. "settings"

Set requiresConfirmation = true ONLY when the user wants to publish live right now or delete/cancel existing content.
Set shouldAutoExecute = true when the user asks to generate/create content, images, ideas, carousels, stories, calendars, or search/filter data so the destination screen immediately starts or displays results.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intentCategory: { type: Type.STRING },
            targetTab: { type: Type.STRING },
            actionType: { type: Type.STRING },
            topic: { type: Type.STRING },
            contentFormat: { type: Type.STRING },
            aspectRatio: { type: Type.STRING },
            searchQuery: { type: Type.STRING },
            scheduleHint: { type: Type.STRING },
            requiresConfirmation: { type: Type.BOOLEAN },
            shouldAutoExecute: { type: Type.BOOLEAN },
            summary: { type: Type.STRING },
            confirmationPrompt: { type: Type.STRING },
          },
          required: [
            'intentCategory',
            'targetTab',
            'actionType',
            'requiresConfirmation',
            'shouldAutoExecute',
            'summary',
          ],
        },
      },
    });

    const parsed = safeJsonParse(response.text || '{}');
    return res.json({ success: true, intent: parsed, modelUsed });
  } catch (error: any) {
    console.error('Gemini command-intent error:', error);
    const errInfo = parseGeminiError(error);
    return res.status(errInfo.httpStatus).json({ success: false, ...errInfo });
  }
});

// 2. Comprehensive Instagram Content Generator (supports all 17 content output types)
app.post('/api/ai/generate-content', async (req: Request, res: Response) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(500).json({
      success: false,
      error: 'GEMINI_API_KEY is not configured on the server.',
    });
  }

  const {
    topic,
    format = 'reel',
    category = 'Education & Tech',
    targetAudience = 'Students & Young Professionals',
    tone = 'Engaging & Authentic',
    visualStyle = 'Modern vibrant, dark purple background, high contrast',
    brandVoice = 'Friendly mentor and tech-savvy creator',
    language = 'English',
    captionLength = 'medium',
    hashtagCount = 15,
    ideaCount = 20,
  } = req.body || {};

  if (!topic || !String(topic).trim()) {
    return res.status(400).json({ success: false, error: 'Topic is required' });
  }

  const systemInstruction = `You are the lead Instagram growth architect and creative director for AutoSocial AI.
Generate an authentic, high-converting Instagram package tailored strictly for Instagram.
Requested format/deliverable: ${String(format).toUpperCase()}.
Caption Length Target: ${captionLength}.
Return ONLY valid JSON matching the requested fields. No markdown fences.`;

  const prompt = `Topic / Creative Brief: "${topic}"
Content Format: ${format}
Category: ${category}
Target Audience: ${targetAudience}
Tone: ${tone}
Visual Style: ${visualStyle}
Brand Voice: ${brandVoice}
Language: ${language}
Caption Length: ${captionLength}
Hashtag Count: ${hashtagCount}

Return a JSON object containing:
1. "title": Catchy internal title
2. "hook": Scroll-stopping opening hook (first 1-3 seconds or first line)
3. "caption": Engaging, well-formatted Instagram caption matching the ${captionLength} length preference
4. "hashtags": Space-separated string of exactly ${hashtagCount} targeted Instagram hashtags
5. "cta": Clear Call to Action
6. "visualStyle": Concrete visual art direction (colors, composition, typography, lighting)
7. "musicDescription": Suggested Instagram audio vibe, tempo, and genre
8. "suggestedDuration": e.g. "30 seconds"
9. "suggestedPostingTime": Optimal posting window (e.g. "Tomorrow 6:30 PM")
10. "reelScript": If format is reel or video, object { "opening": string, "scenes": [{ "sceneNumber": number, "durationSeconds": number, "visualPrompt": string, "voiceover": string, "subtitleText": string, "transition": string }], "ending": string }
11. "carouselSlides": If format is carousel, array of 5-7 objects [{ "slideNumber": number, "headline": string, "bodyText": string, "visualPrompt": string, "designNotes": string }]
12. "storyFrames": If format is story, array of 4 objects [{ "frameNumber": number, "visualPrompt": string, "overlayText": string, "interactiveSticker": string, "stickerOptions": string }]
13. "ideasList": If format is ideas, array of ${ideaCount} objects [{ "number": number, "title": string, "format": "reel"|"carousel"|"post"|"story", "hook": string, "angle": string }]
14. "calendarDays": If format is calendar or strategy, array of 7 objects [{ "day": string, "format": "reel"|"carousel"|"post"|"story", "topic": string, "hook": string, "bestTime": string, "cta": string }]
15. "strategySummary": If format is strategy or marketing or product_description, detailed strategic breakdown string.`;

  try {
    const { response, modelUsed } = await generateTextWithFallback(ai, {
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '{}';
    const parsedData = safeJsonParse(responseText);

    return res.json({
      success: true,
      modelUsed,
      data: parsedData,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Gemini generate-content error:', error);
    const errInfo = parseGeminiError(error);
    return res.status(errInfo.httpStatus).json({ success: false, ...errInfo });
  }
});

// 3. Regenerate specific section
app.post('/api/ai/regenerate-section', async (req: Request, res: Response) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(500).json({ success: false, error: 'GEMINI_API_KEY missing' });
  }

  const { section, originalContent, topic, instruction, language = 'English', tone = 'Engaging' } =
    req.body || {};

  const prompt = `You are AutoSocial AI's Instagram specialist.
Regenerate ONLY the "${section}" for an Instagram post about: "${topic}".
Language: ${language}. Tone: ${tone}.
Previous version: "${originalContent || ''}"
User improvement instruction: "${instruction || 'Make it sharper, more scroll-stopping, and engaging'}"

Return ONLY the regenerated text for this section, with no surrounding quotes or preamble.`;

  try {
    const { response, modelUsed } = await generateTextWithFallback(ai, {
      contents: prompt,
    });

    return res.json({
      success: true,
      section,
      modelUsed,
      content: response.text?.trim() || '',
    });
  } catch (error: any) {
    const errInfo = parseGeminiError(error);
    return res.status(errInfo.httpStatus).json({ success: false, ...errInfo });
  }
});

// 4. AI Image Generator (Verified active v1beta image models)
const SUPPORTED_IMAGE_MODELS = [
  'gemini-3.1-flash-lite-image',
  'gemini-nano-banana-2.1',
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-image',
  'gemini-3-pro-image',
] as const;

app.post('/api/ai/generate-image', async (req: Request, res: Response) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(500).json({ success: false, error: 'GEMINI_API_KEY missing' });
  }

  const {
    prompt,
    aspectRatio = '1:1',
    style = 'premium modern Instagram design',
    quality = 'standard',
    model: requestedModel,
    imageSize = '1K',
    variations = 1,
    referenceImageUrl,
  } = req.body || {};

  if (!prompt || !String(prompt).trim()) {
    return res.status(400).json({ success: false, error: 'Prompt is required' });
  }

  const defaultModel =
    quality === 'hd' ? 'gemini-nano-banana-2.1' : 'gemini-3.1-flash-lite-image';
  const modelName =
    typeof requestedModel === 'string' &&
    SUPPORTED_IMAGE_MODELS.includes(requestedModel as any)
      ? requestedModel
      : defaultModel;
  const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models.generateContent';

  // Supported aspect ratios in Gemini image models: 1:1, 3:4, 4:3, 9:16, 16:9
  const mappedAspectRatio =
    aspectRatio === '4:5'
      ? '3:4'
      : ['1:1', '3:4', '4:3', '9:16', '16:9'].includes(aspectRatio)
      ? aspectRatio
      : '1:1';

  const count = Math.min(Math.max(Number(variations) || 1, 1), 3);

  try {
    const parts: any[] = [];

    // Optional reference image for editing/variations
    if (referenceImageUrl && typeof referenceImageUrl === 'string') {
      if (referenceImageUrl.startsWith('/uploads/')) {
        const refPath = path.join(uploadsDir, path.basename(referenceImageUrl));
        if (fs.existsSync(refPath)) {
          const buf = fs.readFileSync(refPath);
          parts.push({
            inlineData: {
              data: buf.toString('base64'),
              mimeType: getMimeFromFilename(refPath),
            },
          });
        }
      }
    }

    parts.push({
      text: `${prompt}. Aesthetic style: ${style}. High quality Instagram visual composition, crisp details, balanced framing.`,
    });

    const imageConfig: any = {
      aspectRatio: mappedAspectRatio,
    };
    if (
      ['gemini-nano-banana-2.1', 'gemini-3.1-flash-image', 'gemini-3-pro-image'].includes(modelName) &&
      ['1K', '2K', '4K'].includes(imageSize)
    ) {
      imageConfig.imageSize = imageSize;
    }

    const generatedImages: Array<{ imageUrl: string; filename: string; mimeType: string }> = [];

    for (let i = 0; i < count; i++) {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: { parts },
        config: {
          imageConfig,
        },
      });

      let savedForVariation = false;
      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const mimeType = part.inlineData.mimeType || 'image/png';
          const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
          const fileName = `ai-img-${Date.now()}-${i}-${Math.random()
            .toString(36)
            .substring(2, 7)}.${ext}`;
          const filePath = path.join(uploadsDir, fileName);
          fs.writeFileSync(filePath, Buffer.from(part.inlineData.data, 'base64'));
          generatedImages.push({
            imageUrl: `/uploads/${fileName}`,
            filename: fileName,
            mimeType,
          });
          savedForVariation = true;
          break;
        }
      }

      if (!savedForVariation && i === 0) {
        return res.status(422).json({
          success: false,
          modelUsed: modelName,
          endpoint,
          error:
            'The image model responded without image bytes. Try rephrasing the prompt more visually.',
          suggestion: 'You can also upload an image directly to the Media Library.',
        });
      }
    }

    return res.json({
      success: true,
      imageUrl: generatedImages[0]?.imageUrl,
      images: generatedImages,
      modelUsed: modelName,
      endpoint,
      aspectRatio,
      mappedAspectRatio,
      prompt,
    });
  } catch (error: any) {
    console.error('Image generation error:', error);
    const errInfo = parseGeminiError(error, { modelUsed: modelName, endpoint });
    return res.status(errInfo.httpStatus).json({
      success: false,
      ...errInfo,
    });
  }
});

// 5. Real Asynchronous AI Video Generation via Gemini Interactions API (gemini-omni-flash-preview)
interface VideoJob {
  jobId: string;
  interactionId?: string;
  modelUsed: string;
  endpoint: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  prompt: string;
  aspectRatio: string;
  duration: string;
  resolution: string;
  videoUrl?: string;
  filename?: string;
  httpStatus?: number;
  errorCode?: string;
  error?: string;
  rawError?: string;
  isQuotaOrModelLimit?: boolean;
  requiresPaidKey?: boolean;
  suggestion?: string;
  createdAt: string;
  updatedAt: string;
}

const videoJobs = new Map<string, VideoJob>();
const VIDEO_MODEL_ID = 'gemini-omni-flash-preview';
const VIDEO_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/interactions (background: true)';

function extractVideoFromInteraction(interaction: any): { data?: string; mimeType?: string; uri?: string } | null {
  if (interaction?.output_video?.data || interaction?.output_video?.uri) {
    return interaction.output_video;
  }
  const outputs = Array.isArray(interaction?.outputs) ? interaction.outputs : [];
  for (const out of outputs) {
    if (out?.type === 'video' && (out?.data || out?.uri)) {
      return { data: out.data, mimeType: out.mime_type || out.mimeType, uri: out.uri };
    }
  }
  return null;
}

function applyInteractionFailureToJob(job: VideoJob, interaction: any) {
  const firstErr = Array.isArray(interaction?.errors) && interaction.errors[0];
  const rawErrMsg = firstErr
    ? `${firstErr.code || 'INTERACTION_FAILED'}: ${firstErr.message || 'Interaction failed'}`
    : `Gemini Omni interaction ${interaction?.id || ''} ended with status "${interaction?.status || 'failed'}"`;
  const errInfo = parseGeminiError(
    {
      status: firstErr?.code === 'RESOURCE_EXHAUSTED' ? 429 : 500,
      message: rawErrMsg,
    },
    { modelUsed: job.modelUsed, endpoint: job.endpoint }
  );
  job.status = 'failed';
  job.httpStatus = errInfo.httpStatus;
  job.errorCode = firstErr?.code || errInfo.errorCode;
  job.error = errInfo.error;
  job.rawError = errInfo.rawError;
  job.isQuotaOrModelLimit = errInfo.isQuotaOrModelLimit;
  job.requiresPaidKey = errInfo.requiresPaidKey;
  job.suggestion = errInfo.suggestion;
  job.updatedAt = new Date().toISOString();
}

app.post('/api/ai/generate-video', async (req: Request, res: Response) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(500).json({ success: false, error: 'GEMINI_API_KEY missing' });
  }

  const {
    prompt,
    aspectRatio = '9:16',
    duration = '10s',
    resolution = '720p',
    referenceImageUrl,
  } = req.body || {};

  if (!prompt || !String(prompt).trim()) {
    return res.status(400).json({ success: false, error: 'Video prompt is required' });
  }

  const validAspect = aspectRatio === '16:9' ? '16:9' : '9:16';
  const validDuration = ['5s', '8s', '10s', '15s'].includes(duration) ? duration : '10s';
  const validRes = ['360p', '720p', '1080p'].includes(resolution) ? resolution : '720p';

  const jobId = `vid-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const job: VideoJob = {
    jobId,
    modelUsed: VIDEO_MODEL_ID,
    endpoint: VIDEO_ENDPOINT,
    status: 'queued',
    prompt,
    aspectRatio: validAspect,
    duration: validDuration,
    resolution: validRes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  videoJobs.set(jobId, job);

  let inputPayload: any = prompt;
  if (referenceImageUrl && typeof referenceImageUrl === 'string' && referenceImageUrl.startsWith('/uploads/')) {
    const refPath = path.join(uploadsDir, path.basename(referenceImageUrl));
    if (fs.existsSync(refPath)) {
      const buf = fs.readFileSync(refPath);
      inputPayload = [
        {
          type: 'image',
          mime_type: getMimeFromFilename(refPath),
          data: buf.toString('base64'),
        },
        {
          type: 'text',
          text: prompt,
        },
      ];
    }
  }

  const runPromise = (async () => {
    try {
      job.status = 'processing';
      job.updatedAt = new Date().toISOString();

      // Official async Interactions workflow: background: true + store: true + poll interactions.get()
      let interaction: any = await ai.interactions.create(
        {
          model: VIDEO_MODEL_ID,
          input: inputPayload,
          background: true,
          store: true,
          stream: false,
          response_format: {
            type: 'video',
            aspect_ratio: validAspect,
            duration: validDuration,
            resolution: validRes,
          } as any,
        },
        { timeout: 30000 }
      );

      job.interactionId = interaction.id;
      job.updatedAt = new Date().toISOString();

      const maxPolls = 60; // Up to 3 minutes (3s interval)
      for (let attempt = 0; attempt < maxPolls; attempt++) {
        if (interaction.status === 'completed') {
          const videoPart = extractVideoFromInteraction(interaction);
          if (videoPart?.data) {
            const fileName = `ai-reel-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.mp4`;
            const filePath = path.join(uploadsDir, fileName);
            fs.writeFileSync(filePath, Buffer.from(videoPart.data, 'base64'));
            job.status = 'completed';
            job.httpStatus = 200;
            job.videoUrl = `/uploads/${fileName}`;
            job.filename = fileName;
            job.updatedAt = new Date().toISOString();
            return job;
          }
          if (videoPart?.uri) {
            job.status = 'completed';
            job.httpStatus = 200;
            job.videoUrl = videoPart.uri;
            job.updatedAt = new Date().toISOString();
            return job;
          }
          job.status = 'failed';
          job.httpStatus = 422;
          job.errorCode = 'EMPTY_OUTPUT';
          job.error = 'Gemini Omni interaction completed without returning video bytes or URI.';
          job.updatedAt = new Date().toISOString();
          return job;
        }

        if (interaction.status === 'failed' || interaction.status === 'cancelled') {
          applyInteractionFailureToJob(job, interaction);
          return job;
        }

        await new Promise((r) => setTimeout(r, attempt === 0 ? 1500 : 3000));
        interaction = await ai.interactions.get(job.interactionId!);
      }

      job.status = 'failed';
      job.httpStatus = 504;
      job.errorCode = 'TIMEOUT';
      job.error = 'Gemini Omni video generation timed out while polling interaction status.';
      job.updatedAt = new Date().toISOString();
      return job;
    } catch (error: any) {
      const errInfo = parseGeminiError(error, { modelUsed: VIDEO_MODEL_ID, endpoint: VIDEO_ENDPOINT });
      job.status = 'failed';
      job.httpStatus = errInfo.httpStatus;
      job.errorCode = errInfo.errorCode;
      job.error = errInfo.error;
      job.rawError = errInfo.rawError;
      job.isQuotaOrModelLimit = errInfo.isQuotaOrModelLimit;
      job.requiresPaidKey = errInfo.requiresPaidKey;
      job.suggestion = errInfo.suggestion;
      job.updatedAt = new Date().toISOString();
      return job;
    }
  })();

  // Wait up to 3.5s so immediate quota/auth failures fail directly with accurate HTTP status & errors
  const fastResult = await Promise.race([
    runPromise.then((finished) => ({ done: true, job: finished })),
    new Promise<{ done: false; job: VideoJob }>((resolve) =>
      setTimeout(() => resolve({ done: false, job }), 3500)
    ),
  ]);

  if (fastResult.done && fastResult.job.status === 'failed') {
    return res.status(fastResult.job.httpStatus || 500).json({
      success: false,
      ...fastResult.job,
    });
  }

  return res.status(fastResult.job.status === 'completed' ? 200 : 202).json({
    success: true,
    ...fastResult.job,
  });
});

app.get('/api/ai/video-status/:jobId', (req: Request, res: Response) => {
  const job = videoJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ success: false, error: 'Video job not found' });
  }
  return res.json({ success: job.status !== 'failed', ...job });
});

// 6. Video / Reels Production Studio Plan (Text Storyboard & Voiceover)
app.post('/api/ai/generate-video-plan', async (req: Request, res: Response) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(500).json({ success: false, error: 'GEMINI_API_KEY missing' });
  }

  const { topic, duration = '30s', tone = 'Dynamic and Educational', language = 'English' } =
    req.body || {};

  if (!topic || !String(topic).trim()) {
    return res.status(400).json({ success: false, error: 'Topic is required' });
  }

  const prompt = `Create a professional Instagram Reel production script, visual AI video generation prompt, and scene storyboard for:
Topic: "${topic}"
Duration: ${duration}
Tone: ${tone}
Language: ${language}

Return JSON with:
1. "reelTitle": title
2. "openingHook": 0-3 second visual & verbal hook
3. "videoGenPrompt": crisp single-paragraph visual prompt optimized for AI video generation (9:16 vertical cinematic Reel)
4. "storyboard": array of 4-6 scenes with duration, visualPrompt, voiceover, onScreenText, transition
5. "bgMusic": music vibe, tempo, instruments
6. "audioVoiceover": complete narration text
7. "caption": full Instagram caption
8. "hashtags": hashtags string
9. "estimatedRetentionScore": predicted viewer retention rating (e.g., "94% high-retention hook")`;

  try {
    const { response, modelUsed } = await generateTextWithFallback(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = safeJsonParse(response.text || '{}');
    return res.json({ success: true, plan: parsed, modelUsed });
  } catch (error: any) {
    const errInfo = parseGeminiError(error);
    return res.status(errInfo.httpStatus).json({ success: false, ...errInfo });
  }
});

// 7. Instagram Agent Skills (All 13 Open-Source Skills)
app.post('/api/ai/run-agent-skill', async (req: Request, res: Response) => {
  const ai = getGeminiClient();
  if (!ai) {
    return res.status(500).json({ success: false, error: 'GEMINI_API_KEY missing' });
  }

  const { skillId, input } = req.body || {};
  if (!input || !String(input).trim()) {
    return res.status(400).json({ success: false, error: 'Input prompt is required' });
  }

  const skillPrompts: Record<string, string> = {
    'ig-audit': `Perform an in-depth Instagram profile, aesthetic, and engagement audit based on: "${input}". Provide actionable score out of 100, bio critique, content pillars audit, aesthetic consistency, and top 5 immediate fixes.`,
    'ig-caption': `Generate 3 high-converting viral Instagram caption variations (Storytelling, Quick Tip, Curiosity Gap) with strong hooks and formatted CTAs for: "${input}".`,
    'ig-carousel': `Create a high-retention 7-slide Instagram educational carousel breakdown for: "${input}". Provide Slide 1 (Hook Title), Slides 2-6 (Core value + visual layout instructions), Slide 7 (Save & Share CTA).`,
    'ig-comment': `Generate 5 genuine, high-value, non-spammy Instagram comments to post on relevant niche accounts to build relationships and attract profile visits. Target topic/post: "${input}".`,
    'ig-dm': `Generate a natural 3-step conversational Instagram Direct Message outreach and relationship sequence that converts leads into conversations without being pushy. Context: "${input}".`,
    'ig-human': `Take this draft and humanize it into conversational, punchy Instagram language that reads like a real top creator, removing AI buzzwords and robotic phrasing: "${input}".`,
    'ig-plan': `Build a complete 7-day strategic Instagram content calendar for: "${input}". Include Day 1-7 formats (Reel, Carousel, Single Image, Story), themes, hooks, and optimal posting times.`,
    'ig-profile': `Optimize this Instagram Bio and Profile for maximum follow conversion: "${input}". Provide 3 bio variations with Name line SEO keywords, niche statement, social proof, and clear CTA link text.`,
    'ig-reel': `Write a complete 30-second viral Instagram Reel script designed for 100% completion rate for: "${input}". Provide 0-3s Hook, 3-25s Value Delivery, 25-30s Ending Loop CTA.`,
    'ig-reply': `Generate 3 smart, engaging replies to this follower comment on an Instagram post to stimulate more conversation in the comments section: "${input}".`,
    'ig-repurpose': `Repurpose this long-form text or idea into 4 Instagram formats: (1) Reel Hook & Script, (2) 5-Slide Carousel, (3) Single Image Post Caption, (4) 3 Interactive Story Frames. Source text: "${input}".`,
    'ig-story': `Create a 4-frame interactive Instagram Story sequence designed for DM replies and sticker interactions (poll, slider, question box) for: "${input}".`,
    'ig-viral': `Analyze this content concept for virality potential on Instagram: "${input}". Give a Virality Score (0-100), identify psychological triggers (curiosity, controversy, relatability, utility), and supply 5 upgraded hooks.`,
  };

  const selectedPrompt =
    skillPrompts[skillId] || `Execute the Instagram workflow for "${skillId}" with context: "${input}"`;

  try {
    const { response, modelUsed } = await generateTextWithFallback(ai, {
      contents: selectedPrompt,
    });

    return res.json({
      success: true,
      skillId,
      modelUsed,
      output: response.text || '',
      executedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    const errInfo = parseGeminiError(error);
    return res.status(errInfo.httpStatus).json({ success: false, ...errInfo });
  }
});

// ----------------------------------------------------
// MEDIA UPLOAD & ASSET MANAGEMENT
// ----------------------------------------------------
app.post('/api/media/upload', (req: Request, res: Response) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded or file rejected.' });
    }

    const fileUrl = `/uploads/${req.file.filename}`;
    const isVideo = req.file.mimetype.startsWith('video/');

    return res.json({
      success: true,
      file: {
        name: req.file.originalname,
        filename: req.file.filename,
        url: fileUrl,
        sizeBytes: req.file.size,
        mimetype: req.file.mimetype,
        mediaType: isVideo ? 'video' : 'image',
        uploadedAt: new Date().toISOString(),
      },
    });
  });
});

app.get('/api/media/list', (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(uploadsDir)) {
      return res.json({ success: true, files: [] });
    }
    const files = fs
      .readdirSync(uploadsDir)
      .filter((f) => f !== 'README.md' && !f.startsWith('.'))
      .map((fileName) => {
        const filePath = path.join(uploadsDir, fileName);
        const stats = fs.statSync(filePath);
        const ext = path.extname(fileName).toLowerCase();
        const isVideo = ['.mp4', '.mov', '.webm'].includes(ext);
        return {
          filename: fileName,
          url: `/uploads/${fileName}`,
          sizeBytes: stats.size,
          mediaType: isVideo ? 'video' : 'image',
          createdAt: stats.birthtime.toISOString(),
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return res.json({ success: true, files });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/media/:filename', (req: Request, res: Response) => {
  const safeOld = path.basename(req.params.filename);
  const { newName } = req.body || {};
  if (!newName || !String(newName).trim()) {
    return res.status(400).json({ success: false, error: 'New filename is required' });
  }

  const oldPath = path.join(uploadsDir, safeOld);
  if (!fs.existsSync(oldPath)) {
    return res.status(404).json({ success: false, error: 'File not found' });
  }

  const ext = path.extname(safeOld);
  const cleanBase = path
    .basename(String(newName), path.extname(String(newName)))
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const finalName = `${cleanBase}-${Date.now()}${ext}`;
  const newPath = path.join(uploadsDir, finalName);

  try {
    fs.renameSync(oldPath, newPath);
    return res.json({
      success: true,
      filename: finalName,
      url: `/uploads/${finalName}`,
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/media/:filename', (req: Request, res: Response) => {
  const safeFilename = path.basename(req.params.filename);
  const filePath = path.join(uploadsDir, safeFilename);

  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      return res.json({ success: true, message: 'File deleted' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
  return res.status(404).json({ success: false, error: 'File not found' });
});

// ----------------------------------------------------
// SERVER-SIDE SCHEDULER & AUTOMATION ENGINE
// ----------------------------------------------------
async function executeAutomationOnServer(rule: StoredAutomationRule): Promise<{
  summary: string;
  draft?: any;
}> {
  const ai = getGeminiClient();
  if (!ai) {
    return { summary: `Rule "${rule.name}" checked; GEMINI_API_KEY not configured.` };
  }

  if (rule.triggerType === 'cron' || rule.name.toLowerCase().includes('publishing')) {
    const store = loadSchedulerStore();
    const dueCount = store.posts.filter(
      (p) => p.status === 'scheduled' && p.approved && p.autoPublishApproved && !p.publoraPostId
    ).length;
    return {
      summary: `Reconciled publishing queue: ${dueCount} approved scheduled post(s) tracked for auto-dispatch.`,
    };
  }

  const format = rule.name.toLowerCase().includes('carousel')
    ? 'carousel'
    : rule.name.toLowerCase().includes('weekly')
    ? 'calendar'
    : rule.name.toLowerCase().includes('reel')
    ? 'reel'
    : 'post';

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Execute Instagram automation rule "${rule.name}" (${rule.description}).
Category/Niche: ${rule.category || 'AI & Creator Growth'}.
Return valid JSON: { "title": string, "hook": string, "caption": string, "hashtags": string, "cta": string, "format": "${format}" }`,
    config: {
      responseMimeType: 'application/json',
    },
  });

  const parsed = safeJsonParse(response.text || '{}');
  const draft = {
    userId: rule.userId,
    title: `[Auto] ${parsed.title || rule.name}`,
    topic: rule.category || rule.name,
    format: parsed.format || format,
    status: 'draft',
    hook: parsed.hook || '',
    caption: parsed.caption || '',
    hashtags: parsed.hashtags || '',
    cta: parsed.cta || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return {
    summary: `Generated draft "${draft.title}" via Gemini 4 Hydrogen.`,
    draft,
  };
}

app.post('/api/scheduler/sync', (req: Request, res: Response) => {
  const { userId, posts = [], automations = [], autoPublishApproved = false } = req.body || {};
  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId is required' });
  }

  const store = loadSchedulerStore();

  // Merge posts for this user without clobbering server-published statuses
  const otherPosts = store.posts.filter((p) => p.userId !== userId);
  const existingUserPosts = new Map(
    store.posts.filter((p) => p.userId === userId).map((p) => [p.id, p])
  );

  const mergedUserPosts: ScheduledJobRecord[] = (posts as any[])
    .filter((p) => p.id && ['scheduled', 'approved'].includes(p.status) && p.scheduledTime)
    .map((p) => {
      const prev = existingUserPosts.get(p.id);
      if (prev && (prev.status === 'published' || prev.inProgress)) {
        return prev;
      }
      return {
        id: p.id,
        userId,
        title: p.title || 'Scheduled Post',
        format: p.format || 'post',
        caption: p.caption || '',
        hashtags: p.hashtags || '',
        mediaUrl: p.mediaUrl || '',
        mediaUrls: Array.isArray(p.mediaUrls) ? p.mediaUrls : [],
        mediaType: p.mediaType || 'image',
        scheduledTime: p.scheduledTime,
        approved: p.status === 'approved' || p.status === 'scheduled',
        autoPublishApproved: Boolean(autoPublishApproved),
        status: p.status,
        publoraPostId: p.publoraPostId || prev?.publoraPostId,
        updatedAt: new Date().toISOString(),
      };
    });

  // Preserve recently published/failed server records not yet pulled by client
  for (const [id, prev] of existingUserPosts.entries()) {
    if (
      (prev.status === 'published' || prev.status === 'failed') &&
      !mergedUserPosts.some((m) => m.id === id)
    ) {
      mergedUserPosts.push(prev);
    }
  }

  store.posts = [...otherPosts, ...mergedUserPosts];

  const otherAutos = store.automations.filter((a) => a.userId !== userId);
  const existingUserAutos = new Map(
    store.automations.filter((a) => a.userId === userId).map((a) => [a.id, a])
  );
  const mergedAutos: StoredAutomationRule[] = (automations as any[])
    .filter((a) => a.id)
    .map((a) => {
      const prev = existingUserAutos.get(a.id);
      return {
        id: a.id,
        userId,
        name: a.name,
        description: a.description || '',
        triggerType: a.triggerType || 'schedule',
        frequency: a.frequency || 'Daily',
        category: a.category,
        timeOfDay: a.timeOfDay,
        timezone: a.timezone,
        isEnabled: Boolean(a.isEnabled),
        lastRunDate: prev?.lastRunDate,
        lastExecutionTime: a.lastExecutionTime || prev?.lastExecutionTime,
        lastResult: a.lastResult || prev?.lastResult,
        executionCount: Math.max(a.executionCount || 0, prev?.executionCount || 0),
      };
    });

  store.automations = [...otherAutos, ...mergedAutos];
  saveSchedulerStore(store);

  return res.json({
    success: true,
    syncedPosts: mergedUserPosts.length,
    syncedAutomations: mergedAutos.length,
    lastTickAt: store.lastTickAt,
  });
});

app.get('/api/scheduler/state', (req: Request, res: Response) => {
  const userId = String(req.query.userId || '');
  const store = loadSchedulerStore();
  return res.json({
    success: true,
    lastTickAt: store.lastTickAt,
    posts: userId ? store.posts.filter((p) => p.userId === userId) : store.posts,
    automations: userId
      ? store.automations.filter((a) => a.userId === userId)
      : store.automations,
    generatedDrafts: userId
      ? store.generatedDrafts.filter((d) => d.userId === userId)
      : store.generatedDrafts,
    logs: userId ? store.logs.filter((l) => l.userId === userId).slice(0, 20) : store.logs.slice(0, 20),
  });
});

app.post('/api/scheduler/ack-drafts', (req: Request, res: Response) => {
  const { userId } = req.body || {};
  const store = loadSchedulerStore();
  store.generatedDrafts = store.generatedDrafts.filter((d) => d.userId !== userId);
  saveSchedulerStore(store);
  return res.json({ success: true });
});

app.post('/api/scheduler/run-automation', async (req: Request, res: Response) => {
  const { rule } = req.body || {};
  if (!rule || !rule.name) {
    return res.status(400).json({ success: false, error: 'Automation rule payload required' });
  }

  try {
    const result = await executeAutomationOnServer(rule);
    return res.json({
      success: true,
      summary: result.summary,
      draft: result.draft || null,
      executedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    const errInfo = parseGeminiError(error);
    return res.status(errInfo.httpStatus).json({ success: false, ...errInfo });
  }
});

let isSchedulerRunning = false;
async function runSchedulerTick() {
  if (isSchedulerRunning) return;
  isSchedulerRunning = true;

  try {
    const store = loadSchedulerStore();
    const now = new Date();
    store.lastTickAt = now.toISOString();
    let dirty = true;

    // 1. Dispatch due approved scheduled posts (only if autoPublishApproved === true)
    for (const job of store.posts) {
      if (
        job.status === 'scheduled' &&
        job.approved &&
        job.autoPublishApproved &&
        !job.publoraPostId &&
        !job.inProgress &&
        job.scheduledTime
      ) {
        const dueAt = new Date(job.scheduledTime);
        if (!isNaN(dueAt.getTime()) && dueAt <= now) {
          job.inProgress = true;
          saveSchedulerStore(store);

          const fullContent = [job.caption, job.hashtags].filter(Boolean).join('\n\n');
          const pubRes = await submitPostToPublora({
            content: fullContent,
            format: job.format,
            mediaUrl: job.mediaUrl,
            mediaUrls: job.mediaUrls,
            publishNow: true,
            idempotencyKey: `cron-${job.id}`,
          });

          job.inProgress = false;
          job.updatedAt = new Date().toISOString();

          if (pubRes.ok) {
            job.status = 'published';
            job.publoraPostId = pubRes.postGroupId || `cron-${job.id}`;
            job.publishedTime = new Date().toISOString();
            store.logs.unshift({
              userId: job.userId,
              automationId: 'auto-publisher',
              automationName: 'Approved Automatic Publishing',
              status: 'success',
              summary: `Auto-published "${job.title}" to Instagram via Publora (${job.publoraPostId}).`,
              executionTime: new Date().toISOString(),
            });
          } else {
            job.status = 'failed';
            job.failureReason = pubRes.error || 'Scheduled publishing rejected by Publora';
            store.logs.unshift({
              userId: job.userId,
              automationId: 'auto-publisher',
              automationName: 'Approved Automatic Publishing',
              status: 'failed',
              summary: `Failed auto-publishing "${job.title}": ${job.failureReason}`,
              executionTime: new Date().toISOString(),
            });
          }
          dirty = true;
        }
      }
    }

    // 2. Check scheduled automation rules matching current HH:MM
    const todayKey = now.toISOString().slice(0, 10);
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    for (const rule of store.automations) {
      if (
        rule.isEnabled &&
        rule.triggerType === 'schedule' &&
        rule.timeOfDay === hhmm &&
        rule.lastRunDate !== todayKey
      ) {
        rule.lastRunDate = todayKey;
        try {
          const outcome = await executeAutomationOnServer(rule);
          rule.executionCount = (rule.executionCount || 0) + 1;
          rule.lastExecutionTime = now.toLocaleTimeString();
          rule.lastResult = outcome.summary;
          if (outcome.draft) {
            store.generatedDrafts.push(outcome.draft);
          }
          store.logs.unshift({
            userId: rule.userId,
            automationId: rule.id,
            automationName: rule.name,
            status: 'success',
            summary: outcome.summary,
            executionTime: now.toISOString(),
          });
          dirty = true;
        } catch (err: any) {
          store.logs.unshift({
            userId: rule.userId,
            automationId: rule.id,
            automationName: rule.name,
            status: 'failed',
            summary: err?.message || 'Cron execution failed',
            executionTime: now.toISOString(),
          });
          dirty = true;
        }
      }
    }

    if (store.logs.length > 100) {
      store.logs = store.logs.slice(0, 100);
    }

    if (dirty) {
      saveSchedulerStore(store);
    }
  } catch (e) {
    console.error('Scheduler tick error:', e);
  } finally {
    isSchedulerRunning = false;
  }
}

cron.schedule('* * * * *', runSchedulerTick);

app.post('/api/scheduler/tick', async (_req: Request, res: Response) => {
  await runSchedulerTick();
  const store = loadSchedulerStore();
  res.json({
    success: true,
    message: 'Scheduler heartbeat executed',
    timestamp: new Date().toISOString(),
    queuedPostsCount: store.posts.filter((p) => p.status === 'scheduled').length,
  });
});

// ----------------------------------------------------
// VITE DEV SERVER / PRODUCTION STATIC SERVING
// ----------------------------------------------------
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `AutoSocial AI server running on http://0.0.0.0:${PORT} [${isProduction ? 'PROD' : 'DEV'}]`
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
