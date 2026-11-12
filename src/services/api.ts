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
  serverTime: string;
}

export interface PubloraConnectionResponse {
  success: boolean;
  connected: boolean;
  needsKey?: boolean;
  error?: string;
  instagramAccounts: Array<{
    id?: string;
    accountId?: string;
    username?: string;
    name?: string;
    platform?: string;
    profile_picture?: string;
    profilePictureUrl?: string;
    status?: string;
    connection_status?: string;
    capabilities?: string[];
    plan?: string;
    token_status?: string;
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

export async function publishPostViaPublora(postData: any): Promise<any> {
  const res = await fetch('/api/publora/create-post', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': `autosoc-${Date.now()}-${Math.random().toString(36).substring(7)}`,
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

export async function deletePubloraPost(id: string): Promise<any> {
  const res = await fetch('/api/publora/delete-post', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
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
  hashtagCount?: number;
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
}): Promise<any> {
  const res = await fetch('/api/ai/regenerate-section', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return res.json();
}

export async function generateAIImage(params: {
  prompt: string;
  aspectRatio?: '1:1' | '4:5' | '9:16' | '16:9';
  style?: string;
}): Promise<any> {
  const res = await fetch('/api/ai/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  return res.json();
}

export async function generateReelVideoPlan(params: {
  topic: string;
  duration?: string;
  tone?: string;
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

export async function deleteMediaItem(filename: string): Promise<any> {
  const res = await fetch(`/api/media/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });
  return res.json();
}
