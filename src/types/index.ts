export type PostFormat = 'reel' | 'post' | 'carousel' | 'story' | 'video';
export type PostStatus =
  | 'draft'
  | 'awaiting_approval'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'failed';

export interface SceneBreakdown {
  sceneNumber: number;
  durationSeconds: number;
  visualPrompt: string;
  voiceover: string;
  subtitleText: string;
  transition?: string;
}

export interface CarouselSlide {
  slideNumber: number;
  headline: string;
  bodyText: string;
  visualPrompt: string;
  designNotes?: string;
  imageUrl?: string;
}

export interface StoryFrame {
  frameNumber: number;
  visualPrompt: string;
  overlayText: string;
  interactiveSticker?: string;
  stickerOptions?: string;
  mediaUrl?: string;
}

export interface Post {
  id?: string;
  userId: string;
  title: string;
  topic?: string;
  format: PostFormat;
  status: PostStatus;
  caption: string;
  hashtags: string;
  hook?: string;
  cta?: string;
  script?: string;
  scenes?: string; // JSON serialized string of SceneBreakdown[]
  carouselSlides?: string; // JSON serialized string of CarouselSlide[]
  storyFrames?: string; // JSON serialized string of StoryFrame[]
  visualStyle?: string;
  voiceover?: string;
  musicDescription?: string;
  suggestedDuration?: string;
  suggestedPostingTime?: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  mediaType?: 'image' | 'video';
  scheduledTime?: string;
  publishedTime?: string;
  publoraPostId?: string;
  publoraStatus?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InstagramAccount {
  id?: string;
  userId: string;
  accountId: string;
  username: string;
  profilePictureUrl?: string;
  connectionStatus: 'connected' | 'disconnected' | 'expired' | 'pending';
  tokenStatus?: string;
  publishingCapabilities?: string;
  planInfo?: string;
  verifiedAt: string;
  updatedAt: string;
}

export interface MediaItem {
  id?: string;
  userId: string;
  name: string;
  url: string;
  mediaType: 'image' | 'video';
  sizeBytes?: number;
  dimensions?: string;
  source: 'uploaded' | 'ai_generated';
  createdAt: string;
}

export interface AutomationRule {
  id?: string;
  userId: string;
  name: string;
  description: string;
  triggerType: string;
  frequency: string;
  category?: string;
  timeOfDay?: string;
  timezone?: string;
  isEnabled: boolean;
  lastExecutionTime?: string;
  nextExecutionTime?: string;
  executionCount: number;
  lastResult?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationLog {
  id?: string;
  userId: string;
  automationId: string;
  automationName: string;
  status: 'success' | 'failed' | 'running';
  summary: string;
  details?: string;
  executionTime: string;
}

export interface BrandCampaign {
  id?: string;
  userId: string;
  brandName: string;
  dealAmount?: number;
  currency?: string;
  status: 'pitch' | 'negotiation' | 'in_progress' | 'published' | 'completed' | 'cancelled';
  paymentStatus: 'unpaid' | 'invoiced' | 'partial' | 'paid';
  deliverables?: string;
  associatedPostIds?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SkillRun {
  id?: string;
  userId: string;
  skillId: string;
  skillName: string;
  inputParams: string;
  resultOutput: string;
  createdAt: string;
}

export interface UserProfile {
  userId: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  timezone?: string;
  autoPublishApproved?: boolean;
  theme?: 'light' | 'dark' | 'system';
  createdAt?: string;
  updatedAt?: string;
}

export interface ParsedCommandIntent {
  intentCategory: string;
  targetTab: string;
  actionType: string;
  topic?: string;
  contentFormat?: string;
  aspectRatio?: string;
  searchQuery?: string;
  scheduleHint?: string;
  requiresConfirmation: boolean;
  shouldAutoExecute: boolean;
  summary: string;
  confirmationPrompt?: string;
}
