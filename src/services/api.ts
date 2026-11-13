export interface ConfigStatusResponse {
  status: string;
  publora: {
    configured: boolean;
    message: string;
  };
  gemini: {
    configured: boolean;
    message: string;
  };
  scheduler?: {
    active: boolean;
    queuedPostsCount: number;
    automationsCount: number;
    lastTickAt: string | null;
  };
  serverTime: string;
}

export interface PubloraConnectionResponse {
  success: boolean;
  connected: boolean;
  needsKey?: boolean;
  error?: string;
  instagramAccounts: Array<{
    id?: string;
    connectionId?: string;
    platformId?: string;
    accountId?: string;
    username?: string;
    name?: string;
    displayName?: string;
    platform?: string;
    profile_picture?: string;
    profilePictureUrl?: string;
    connectionStatus?: string;
    tokenStatus?: string;
    accessTokenExpiresAt?: string;
    publishingCapabilities?: string;
    planInfo?: string;
    [key: string]: any;
  }>;
  allConnectionsCount?: number;
  verifiedAt?: string;
}

export async function fetchConfigStatus(): Promise<ConfigStatusResponse> {
  const res = await fetch('/api/config/status');
  return res.json();
}

export async function fetchPubloraConnections(): Promise<PubloraConnectionResponse> {
  const res = await fetch('/api/publora/platform-connections');
  return res.json();
}

export async function testPubloraConnection(payload: any): Promise<any> {
  const res = await fetch('/api/publora/test-connection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function publishPostViaPublora(postData: {
  caption?: string;
  content?: string;
  hashtags?: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  coverUrl?: string;
  format?: string;
  platformId?: string;
  scheduledTime?: string;
  publishNow?: boolean;
  videoType?: 'REELS' | 'STORIES';
}): Promise<any> {
  const res = await fetch('/api/publora/create-post', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': `autosoc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    },
    body: JSON.stringify(postData),
  });
  return res.json();
}

export async function fetchPubloraPosts(params?: Record<string, string>): Promise<any> {
  const query = params ? `?${new URLSearchParams(params).toString()}` : '';
  const res = await fetch(`/api/publora/list-posts${query}`);
  return res.json();
}

export async function fetchPubloraPostById(id: string): Promise<any> {
  const res = await fetch(`/api/publora/get-post/${encodeURIComponent(id)}`);
  return res.json();
}

export async function updatePubloraPost(id: string, updates: any): Promise<any> {
  const res = await fetch(`/api/publora/update-post/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return res.json();
}

export async function deletePubloraPost(id: string): Promise<any> {
  const res = await fetch(`/api/publora/delete-post/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return res.json();
}

export async function parseUniversalCommand(command: string): Promise<any> {
  const res = await fetch('/api/ai/command-intent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command }),
  });
  return res.json();
}

export async function generateInstagramContent(params: {
  topic: string;
  format: string;
  category?: string;
  targetAudience?: string;
  tone?: string;
  visualStyle?: string;
  brandVoice?: string;
  language?: string;
  captionLength?: 'short' | 'medium' | 'long';
  hashtagCount?: number;
  ideaCount?: number;
}): Promise<any> {
  const res = await fetch('/api/ai/generate-content', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return res.json();
}

export async function regenerateAISection(params: {
  section: string;
  originalContent: string;
  topic: string;
  instruction?: string;
  language?: string;
  tone?: string;
}): Promise<any> {
  const res = await fetch('/api/ai/regenerate-section', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return res.json();
}

export async function fetchGeminiModels(): Promise<any> {
  const res = await fetch('/api/ai/models');
  return res.json();
}

export async function generateAIImage(params: {
  prompt: string;
  aspectRatio?: '1:1' | '4:5' | '3:4' | '4:3' | '9:16' | '16:9';
  style?: string;
  quality?: 'standard' | 'hd';
  model?: string;
  imageSize?: '1K' | '2K' | '4K';
  variations?: number;
  referenceImageUrl?: string;
}): Promise<any> {
  const res = await fetch('/api/ai/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return res.json();
}

export async function generateAIVideo(params: {
  prompt: string;
  aspectRatio?: '9:16' | '16:9';
  duration?: '5s' | '10s' | '15s';
  resolution?: '360p' | '720p' | '1080p';
  referenceImageUrl?: string;
}): Promise<any> {
  const res = await fetch('/api/ai/generate-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return res.json();
}

export async function fetchAIVideoStatus(jobId: string): Promise<any> {
  const res = await fetch(`/api/ai/video-status/${encodeURIComponent(jobId)}`);
  return res.json();
}

export async function generateReelVideoPlan(params: {
  topic: string;
  duration?: string;
  tone?: string;
  language?: string;
}): Promise<any> {
  const res = await fetch('/api/ai/generate-video-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return res.json();
}

export async function runInstagramAgentSkill(skillId: string, input: string): Promise<any> {
  const res = await fetch('/api/ai/run-agent-skill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skillId, input }),
  });
  return res.json();
}

export async function uploadMedia(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch('/api/media/upload', {
    method: 'POST',
    body: formData,
  });
  return res.json();
}

export async function fetchMediaList(): Promise<any> {
  const res = await fetch('/api/media/list');
  return res.json();
}

export async function renameMediaItem(filename: string, newName: string): Promise<any> {
  const res = await fetch(`/api/media/${encodeURIComponent(filename)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newName }),
  });
  return res.json();
}

export async function deleteMediaItem(filename: string): Promise<any> {
  const res = await fetch(`/api/media/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });
  return res.json();
}

export async function syncSchedulerWithServer(payload: {
  userId: string;
  posts: any[];
  automations: any[];
  autoPublishApproved: boolean;
}): Promise<any> {
  const res = await fetch('/api/scheduler/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function fetchSchedulerState(userId: string): Promise<any> {
  const res = await fetch(`/api/scheduler/state?userId=${encodeURIComponent(userId)}`);
  return res.json();
}

export async function ackServerDrafts(userId: string): Promise<any> {
  const res = await fetch('/api/scheduler/ack-drafts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  return res.json();
}

export async function runAutomationOnServer(rule: any): Promise<any> {
  const res = await fetch('/api/scheduler/run-automation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rule }),
  });
  return res.json();
}

export async function triggerSchedulerTick(): Promise<any> {
  const res = await fetch('/api/scheduler/tick', { method: 'POST' });
  return res.json();
}
