import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  RefreshCw,
  Copy,
  Check,
  Save,
  Send,
  Eye,
  Calendar,
  Film,
  Music,
  SlidersHorizontal,
  ChevronDown,
  Upload,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  Lightbulb,
  Clock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Post, PostFormat, SceneBreakdown, CarouselSlide, StoryFrame } from '../../types';
import {
  generateInstagramContent,
  regenerateAISection,
  publishPostViaPublora,
  uploadMedia,
  fetchMediaList,
  triggerSchedulerTick,
} from '../../services/api';
import { PostPreviewModal } from '../PostPreviewModal';
import { NavTab } from '../Sidebar';

interface ContentStudioViewProps {
  onNavigate: (tab: NavTab) => void;
  isPubloraConnected: boolean;
  instagramAccount: any;
}

type StudioFormat =
  | 'reel'
  | 'post'
  | 'carousel'
  | 'story'
  | 'video'
  | 'ideas'
  | 'calendar'
  | 'strategy'
  | 'hashtags'
  | 'marketing'
  | 'product_description';

const FORMAT_OPTIONS: Array<{ id: StudioFormat; label: string }> = [
  { id: 'reel', label: 'Reel' },
  { id: 'post', label: 'Caption / Post' },
  { id: 'carousel', label: 'Carousel' },
  { id: 'story', label: 'Story' },
  { id: 'video', label: 'Video Script' },
  { id: 'ideas', label: '20 Ideas' },
  { id: 'calendar', label: '7-Day Calendar' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'hashtags', label: 'Hashtags' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'product_description', label: 'Product Copy' },
];

export const ContentStudioView: React.FC<ContentStudioViewProps> = ({
  onNavigate,
  isPubloraConnected,
  instagramAccount,
}) => {
  const { user } = useAuth();

  // Form inputs
  const [topic, setTopic] = useState<string>('');
  const [studioFormat, setStudioFormat] = useState<StudioFormat>('reel');
  const [category, setCategory] = useState<string>('Education & Tech');
  const [targetAudience, setTargetAudience] = useState<string>('Creators, Students & Tech Professionals');
  const [tone, setTone] = useState<string>('Engaging, Relatable, High-Value');
  const [visualStyle, setVisualStyle] = useState<string>(
    'Modern dark purple gradient with high contrast tech neon accents'
  );
  const [brandVoice, setBrandVoice] = useState<string>('Inspiring mentor & knowledgeable creator');
  const [language, setLanguage] = useState<string>('English');
  const [captionLength, setCaptionLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [hashtagCount, setHashtagCount] = useState<number>(15);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(true);

  // Generation state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // Generated package fields (editable)
  const [generatedTitle, setGeneratedTitle] = useState<string>('');
  const [generatedHook, setGeneratedHook] = useState<string>('');
  const [generatedCaption, setGeneratedCaption] = useState<string>('');
  const [generatedHashtags, setGeneratedHashtags] = useState<string>('');
  const [generatedCta, setGeneratedCta] = useState<string>('');
  const [generatedScript, setGeneratedScript] = useState<string>('');
  const [generatedScenes, setGeneratedScenes] = useState<SceneBreakdown[]>([]);
  const [generatedCarouselSlides, setGeneratedCarouselSlides] = useState<CarouselSlide[]>([]);
  const [generatedStoryFrames, setGeneratedStoryFrames] = useState<StoryFrame[]>([]);
  const [generatedIdeas, setGeneratedIdeas] = useState<any[]>([]);
  const [generatedCalendarDays, setGeneratedCalendarDays] = useState<any[]>([]);
  const [generatedStrategy, setGeneratedStrategy] = useState<string>('');
  const [generatedMusic, setGeneratedMusic] = useState<string>('');
  const [generatedDuration, setGeneratedDuration] = useState<string>('');
  const [suggestedPostingTime, setSuggestedPostingTime] = useState<string>('');
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');

  // Library Picker & Actions
  const [libraryItems, setLibraryItems] = useState<any[]>([]);
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const [copiedCaption, setCopiedCaption] = useState<boolean>(false);
  const [copiedHashtags, setCopiedHashtags] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [confirmPublish, setConfirmPublish] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [publishFeedback, setPublishFeedback] = useState<any>(null);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);

  // Scheduled date/time picker
  const [scheduleDate, setScheduleDate] = useState<string>('');
  const [scheduleTime, setScheduleTime] = useState<string>('18:00');

  useEffect(() => {
    loadMediaLibrary();

    const rawCtx = sessionStorage.getItem('autosocial_command_context');
    if (rawCtx) {
      try {
        const ctx = JSON.parse(rawCtx);
        if (ctx.topic && Date.now() - (ctx.timestamp || 0) < 30000) {
          setTopic(ctx.topic);
          let targetFmt: StudioFormat = studioFormat;
          if (ctx.format && FORMAT_OPTIONS.some((o) => o.id === ctx.format)) {
            targetFmt = ctx.format as StudioFormat;
            setStudioFormat(targetFmt);
          } else if (ctx.intentCategory === 'calendar_management') {
            targetFmt = 'calendar';
            setStudioFormat('calendar');
          } else if (ctx.intentCategory === 'hashtag_generation') {
            targetFmt = 'hashtags';
            setStudioFormat('hashtags');
          } else if (ctx.intentCategory === 'text_generation' && ctx.command?.toLowerCase().includes('idea')) {
            targetFmt = 'ideas';
            setStudioFormat('ideas');
          } else if (ctx.command?.toLowerCase().includes('strategy')) {
            targetFmt = 'strategy';
            setStudioFormat('strategy');
          }
          sessionStorage.removeItem('autosocial_command_context');
          sessionStorage.removeItem('autosocial_initial_prompt');
          if (ctx.autoRun) {
            runGenerate(ctx.topic, targetFmt);
          }
          return;
        }
      } catch {
        // ignore parse errors
      }
    }

    const cachedPrompt = sessionStorage.getItem('autosocial_initial_prompt');
    if (cachedPrompt) {
      setTopic(cachedPrompt);
      sessionStorage.removeItem('autosocial_initial_prompt');
    }
  }, []);

  const loadMediaLibrary = async () => {
    try {
      const res = await fetchMediaList();
      setLibraryItems(res.files || []);
    } catch {
      // ignore
    }
  };

  const resetGeneratedOutputs = () => {
    setGeneratedTitle('');
    setGeneratedHook('');
    setGeneratedCaption('');
    setGeneratedHashtags('');
    setGeneratedCta('');
    setGeneratedScript('');
    setGeneratedScenes([]);
    setGeneratedCarouselSlides([]);
    setGeneratedStoryFrames([]);
    setGeneratedIdeas([]);
    setGeneratedCalendarDays([]);
    setGeneratedStrategy('');
    setGeneratedMusic('');
    setGeneratedDuration('');
    setSuggestedPostingTime('');
    setApiError(null);
    setSaveSuccessMessage(null);
    setPublishFeedback(null);
  };

  const runGenerate = async (overrideTopic?: string, overrideFormat?: StudioFormat) => {
    const activeTopic = (overrideTopic ?? topic).trim();
    const activeFormat = overrideFormat ?? studioFormat;
    if (!activeTopic) return;

    setIsGenerating(true);
    setApiError(null);
    setSaveSuccessMessage(null);
    setPublishFeedback(null);

    try {
      const response = await generateInstagramContent({
        topic: activeTopic,
        format: activeFormat,
        category,
        targetAudience,
        tone,
        visualStyle,
        brandVoice,
        language,
        captionLength,
        hashtagCount,
        ideaCount: 20,
      });

      if (!response.success || !response.data) {
        setApiError(
          response.error ||
            'Gemini AI did not return a valid content package. Check GEMINI_API_KEY configuration.'
        );
        return;
      }

      const d = response.data;
      setGeneratedTitle(d.title || activeTopic);
      setGeneratedHook(d.hook || '');
      setGeneratedCaption(d.caption || '');
      setGeneratedHashtags(d.hashtags || '');
      setGeneratedCta(d.cta || '');
      setGeneratedMusic(d.musicDescription || '');
      setGeneratedDuration(d.suggestedDuration || '');
      setSuggestedPostingTime(d.suggestedPostingTime || 'Tomorrow 6:30 PM');

      setGeneratedScenes(Array.isArray(d.reelScript?.scenes) ? d.reelScript.scenes : []);
      if (d.reelScript) {
        setGeneratedScript(
          typeof d.reelScript === 'string' ? d.reelScript : JSON.stringify(d.reelScript, null, 2)
        );
      } else {
        setGeneratedScript('');
      }

      setGeneratedCarouselSlides(Array.isArray(d.carouselSlides) ? d.carouselSlides : []);
      setGeneratedStoryFrames(Array.isArray(d.storyFrames) ? d.storyFrames : []);
      setGeneratedIdeas(Array.isArray(d.ideasList) ? d.ideasList : []);
      setGeneratedCalendarDays(Array.isArray(d.calendarDays) ? d.calendarDays : []);
      setGeneratedStrategy(d.strategySummary || '');
    } catch (err: any) {
      setApiError(err?.message || 'Content generation request failed.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateSection = async (sectionName: string, originalText: string) => {
    setRegeneratingSection(sectionName);
    setApiError(null);
    try {
      const res = await regenerateAISection({
        section: sectionName,
        originalContent: originalText,
        topic,
        language,
        tone,
      });
      if (res.success && res.content) {
        if (sectionName === 'hook') setGeneratedHook(res.content);
        if (sectionName === 'caption') setGeneratedCaption(res.content);
        if (sectionName === 'hashtags') setGeneratedHashtags(res.content);
        if (sectionName === 'cta') setGeneratedCta(res.content);
      } else {
        setApiError(res.error || `Failed regenerating ${sectionName}.`);
      }
    } catch (e: any) {
      setApiError(e?.message || `Failed regenerating ${sectionName}.`);
    } finally {
      setRegeneratingSection(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setApiError(null);
    try {
      const result = await uploadMedia(file);
      if (result.success && result.file) {
        setMediaUrl(result.file.url);
        setMediaType(result.file.mediaType);
        loadMediaLibrary();
      } else {
        setApiError(result.error || 'Upload failed.');
      }
    } catch (err: any) {
      setApiError(err?.message || 'Upload failed.');
    }
  };

  const mappedPostFormat: PostFormat = (
    ['reel', 'post', 'carousel', 'story', 'video'].includes(studioFormat)
      ? studioFormat
      : 'post'
  ) as PostFormat;

  const handleSaveDraft = async (targetStatus: 'draft' | 'awaiting_approval' | 'scheduled') => {
    if (!user) return;
    if (targetStatus === 'scheduled' && !scheduleDate) {
      setApiError('Select a schedule date and time before scheduling.');
      return;
    }

    setIsSaving(true);
    setSaveSuccessMessage(null);
    setApiError(null);

    try {
      const scheduledIso =
        targetStatus === 'scheduled' && scheduleDate
          ? new Date(`${scheduleDate}T${scheduleTime || '18:00'}`).toISOString()
          : '';

      const newPostPayload: Omit<Post, 'id'> = {
        userId: user.uid,
        title: generatedTitle || topic || 'Untitled Post',
        topic,
        format: mappedPostFormat,
        status: targetStatus,
        hook: generatedHook,
        caption: generatedCaption || generatedStrategy || topic,
        hashtags: generatedHashtags,
        cta: generatedCta,
        script: generatedScript,
        scenes: JSON.stringify(generatedScenes),
        carouselSlides: JSON.stringify(generatedCarouselSlides),
        storyFrames: JSON.stringify(generatedStoryFrames),
        visualStyle,
        musicDescription: generatedMusic,
        suggestedDuration: generatedDuration,
        suggestedPostingTime: suggestedPostingTime || scheduledIso,
        mediaUrl: mediaUrl || '',
        mediaType,
        scheduledTime: scheduledIso,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await addDoc(collection(db, 'posts'), newPostPayload);
      if (targetStatus === 'scheduled') {
        triggerSchedulerTick().catch(() => {});
      }
      setSaveSuccessMessage(`Successfully saved as ${targetStatus.replace('_', ' ')}!`);
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'posts');
    } finally {
      setIsSaving(false);
    }
  };

  const handleBatchSaveCalendar = async () => {
    if (!user || generatedCalendarDays.length === 0) return;
    setIsSaving(true);
    setApiError(null);
    try {
      const base = new Date();
      for (let i = 0; i < generatedCalendarDays.length; i++) {
        const dayObj = generatedCalendarDays[i];
        const target = new Date(base.getTime() + (i + 1) * 86400000);
        target.setHours(18, 0, 0, 0);
        const fmt = ['reel', 'post', 'carousel', 'story', 'video'].includes(dayObj.format)
          ? dayObj.format
          : 'post';
        await addDoc(collection(db, 'posts'), {
          userId: user.uid,
          title: `${dayObj.day || `Day ${i + 1}`}: ${dayObj.topic || topic}`,
          topic: dayObj.topic || topic,
          format: fmt,
          status: 'scheduled',
          hook: dayObj.hook || '',
          caption: `${dayObj.hook || ''}\n\n${dayObj.topic || ''}\n\n${dayObj.cta || ''}`.trim(),
          hashtags: generatedHashtags || '#instagram #content',
          cta: dayObj.cta || '',
          scheduledTime: target.toISOString(),
          suggestedPostingTime: dayObj.bestTime || '6:00 PM',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      triggerSchedulerTick().catch(() => {});
      setSaveSuccessMessage(
        `Saved all ${generatedCalendarDays.length} calendar days to your Content Calendar!`
      );
    } catch (err: any) {
      setApiError(err?.message || 'Failed saving calendar days.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishNow = async () => {
    setConfirmPublish(false);
    if (!isPubloraConnected) {
      setPublishFeedback({
        success: false,
        error: 'Publora Instagram account is not connected. Verify PUBLORA_API_KEY first.',
      });
      return;
    }
    if (!mediaUrl) {
      setPublishFeedback({
        success: false,
        error: 'Instagram requires an attached image or video file before live publishing.',
      });
      return;
    }

    setIsPublishing(true);
    setPublishFeedback(null);

    try {
      const res = await publishPostViaPublora({
        caption: generatedCaption,
        hashtags: generatedHashtags,
        mediaUrl,
        format: mappedPostFormat,
        platformId: instagramAccount?.platformId,
        publishNow: true,
      });

      setPublishFeedback(res);

      if (res.success && user) {
        await addDoc(collection(db, 'posts'), {
          userId: user.uid,
          title: generatedTitle || topic,
          format: mappedPostFormat,
          status: 'published',
          caption: generatedCaption,
          hashtags: generatedHashtags,
          hook: generatedHook,
          mediaUrl,
          mediaType,
          publoraPostId: res.postGroupId || res.data?.postGroupId || 'live-submission',
          publishedTime: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      setPublishFeedback({ success: false, error: err?.message || 'Publish failed' });
    } finally {
      setIsPublishing(false);
    }
  };

  const hasResult = Boolean(
    generatedCaption ||
      generatedHashtags ||
      generatedIdeas.length > 0 ||
      generatedCalendarDays.length > 0 ||
      generatedCarouselSlides.length > 0 ||
      generatedStoryFrames.length > 0 ||
      generatedStrategy
  );

  const currentPostForPreview: Post = {
    userId: user?.uid || '',
    title: generatedTitle || topic || 'Instagram Post',
    format: mappedPostFormat,
    status: 'draft',
    caption: generatedCaption,
    hashtags: generatedHashtags,
    hook: generatedHook,
    cta: generatedCta,
    script: generatedScript,
    mediaUrl,
    mediaType,
    musicDescription: generatedMusic,
    suggestedPostingTime,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      {/* Top Creation Controls Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex flex-col gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                AI Instagram Content Studio
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Generate captions, hashtags, 20 content ideas, 7-day calendars, Reels scripts, Carousels, Stories & marketing copy via Gemini.
              </p>
            </div>
            {hasResult && (
              <button
                type="button"
                onClick={resetGeneratedOutputs}
                className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-semibold flex items-center gap-1.5 self-start"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Output</span>
              </button>
            )}
          </div>

          {/* 11 Format / Deliverable Pills */}
          <div className="flex flex-wrap gap-1.5 p-1.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
            {FORMAT_OPTIONS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStudioFormat(f.id)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                  studioFormat === f.id
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input prompt form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runGenerate();
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Content Topic, Product Brief or Natural Language Instruction
            </label>
            <textarea
              rows={3}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Write a high-converting Instagram caption for my new AI productivity app, or generate 20 content ideas for tech students..."
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-hidden focus:border-purple-500 transition leading-relaxed resize-none"
            />
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1 hover:underline"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{showAdvanced ? 'Hide Studio Parameters' : 'Show Studio Parameters'}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
              />
            </button>
          </div>

          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Language</label>
                <input
                  type="text"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Tone</label>
                <input
                  type="text"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Target Audience</label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Category</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Brand Voice</label>
                <input
                  type="text"
                  value={brandVoice}
                  onChange={(e) => setBrandVoice(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Caption Length</label>
                <select
                  value={captionLength}
                  onChange={(e) => setCaptionLength(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="short">Short & Punchy (1–2 sentences)</option>
                  <option value="medium">Medium (Balanced value)</option>
                  <option value="long">Long-Form Storytelling</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Hashtag Count</label>
                <input
                  type="number"
                  min={3}
                  max={30}
                  value={hashtagCount}
                  onChange={(e) => setHashtagCount(parseInt(e.target.value, 10) || 15)}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Visual Style</label>
                <input
                  type="text"
                  value={visualStyle}
                  onChange={(e) => setVisualStyle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={isGenerating || !topic.trim()}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-purple-600/25 transition flex items-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generating with Gemini...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{hasResult ? 'Generate Again' : 'Generate Complete Package'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Real API Error Feedback Banner */}
      {apiError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Gemini AI Generation Error</p>
            <p className="mt-0.5">{apiError}</p>
          </div>
        </div>
      )}

      {/* Specialized 20 Ideas List Output */}
      {generatedIdeas.length > 0 && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              Generated Instagram Content Ideas ({generatedIdeas.length})
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {generatedIdeas.map((idea: any, i: number) => (
              <div
                key={i}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-purple-400">
                    #{idea.number || i + 1} • {(idea.format || 'post').toUpperCase()}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setTopic(idea.title || idea.hook);
                      setStudioFormat(
                        (['reel', 'post', 'carousel', 'story'].includes(idea.format)
                          ? idea.format
                          : 'post') as StudioFormat
                      );
                      runGenerate(
                        idea.title || idea.hook,
                        (['reel', 'post', 'carousel', 'story'].includes(idea.format)
                          ? idea.format
                          : 'post') as StudioFormat
                      );
                    }}
                    className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-semibold"
                  >
                    Turn into Full Post
                  </button>
                </div>
                <p className="font-bold text-slate-900 dark:text-white">{idea.title}</p>
                {idea.hook && <p className="text-purple-300">Hook: "{idea.hook}"</p>}
                {idea.angle && <p className="text-slate-400">{idea.angle}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Specialized 7-Day Calendar Output */}
      {generatedCalendarDays.length > 0 && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              7-Day Instagram Content Calendar ({generatedCalendarDays.length} Days)
            </h3>
            <button
              type="button"
              onClick={handleBatchSaveCalendar}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Save All 7 Days to Content Calendar</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {generatedCalendarDays.map((day: any, idx: number) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-400">{day.day || `Day ${idx + 1}`}</span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-[10px] uppercase font-bold">
                    {day.format}
                  </span>
                </div>
                <p className="font-bold text-slate-900 dark:text-white">{day.topic}</p>
                <p className="text-slate-400">Hook: "{day.hook}"</p>
                <p className="text-[11px] text-emerald-400">Best Time: {day.bestTime}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strategy Summary Output */}
      {generatedStrategy && (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-purple-400">
              Strategic Content & Marketing Breakdown
            </h3>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(generatedStrategy)}
              className="text-xs text-purple-400 hover:underline flex items-center gap-1"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </button>
          </div>
          <textarea
            rows={8}
            value={generatedStrategy}
            onChange={(e) => setGeneratedStrategy(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white leading-relaxed"
          />
        </div>
      )}

      {/* Main Generated Package Workspace */}
      {(generatedCaption || generatedHashtags || generatedHook) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            {/* Hook Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Hook & Attention Grabber
                </span>
                <button
                  type="button"
                  onClick={() => handleRegenerateSection('hook', generatedHook)}
                  disabled={regeneratingSection === 'hook'}
                  className="text-xs text-slate-400 hover:text-purple-400 flex items-center gap-1 transition"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${regeneratingSection === 'hook' ? 'animate-spin' : ''}`}
                  />
                  <span>Regenerate Hook</span>
                </button>
              </div>
              <input
                type="text"
                value={generatedHook}
                onChange={(e) => setGeneratedHook(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold text-sm"
              />
            </div>

            {/* Caption Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Instagram Caption (Editable)
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleRegenerateSection('caption', generatedCaption)}
                    disabled={regeneratingSection === 'caption'}
                    className="text-xs text-slate-400 hover:text-purple-400 flex items-center gap-1 transition"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${regeneratingSection === 'caption' ? 'animate-spin' : ''}`}
                    />
                    <span>Regenerate</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedCaption);
                      setCopiedCaption(true);
                      setTimeout(() => setCopiedCaption(false), 2000);
                    }}
                    className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    {copiedCaption ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedCaption ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>
              <textarea
                rows={8}
                value={generatedCaption}
                onChange={(e) => setGeneratedCaption(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm leading-relaxed resize-y"
              />
            </div>

            {/* CTA & Hashtags Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    Call To Action (CTA)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRegenerateSection('cta', generatedCta)}
                    disabled={regeneratingSection === 'cta'}
                    className="text-xs text-slate-400 hover:text-purple-400 flex items-center gap-1"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${regeneratingSection === 'cta' ? 'animate-spin' : ''}`}
                    />
                  </button>
                </div>
                <input
                  type="text"
                  value={generatedCta}
                  onChange={(e) => setGeneratedCta(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs"
                />
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    Hashtags
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRegenerateSection('hashtags', generatedHashtags)}
                      disabled={regeneratingSection === 'hashtags'}
                      className="text-xs text-slate-400 hover:text-purple-400"
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${
                          regeneratingSection === 'hashtags' ? 'animate-spin' : ''
                        }`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedHashtags);
                        setCopiedHashtags(true);
                        setTimeout(() => setCopiedHashtags(false), 2000);
                      }}
                      className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-semibold"
                    >
                      {copiedHashtags ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedHashtags ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
                <textarea
                  rows={2}
                  value={generatedHashtags}
                  onChange={(e) => setGeneratedHashtags(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-indigo-400 text-xs"
                />
              </div>
            </div>

            {/* Reel Scenes */}
            {generatedScenes.length > 0 && (
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <Film className="w-4 h-4" /> Reel Script & Scenes
                  </span>
                  {generatedDuration && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      {generatedDuration}
                    </span>
                  )}
                </div>
                {generatedScenes.map((scene, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                  >
                    <p className="font-bold text-purple-400">
                      Scene {scene.sceneNumber || idx + 1} ({scene.durationSeconds || 4}s)
                    </p>
                    <p className="text-slate-600 dark:text-slate-300">
                      <strong>Visual:</strong> {scene.visualPrompt}
                    </p>
                    <p className="text-slate-600 dark:text-slate-300">
                      <strong>Voiceover:</strong> "{scene.voiceover}"
                    </p>
                  </div>
                ))}
                {generatedMusic && (
                  <p className="text-xs text-purple-300 flex items-center gap-1.5">
                    <Music className="w-3.5 h-3.5" /> Suggested Audio: {generatedMusic}
                  </p>
                )}
              </div>
            )}

            {/* Carousel Slides Preview */}
            {generatedCarouselSlides.length > 0 && (
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-fuchsia-400 block">
                  Generated Carousel Slides ({generatedCarouselSlides.length})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {generatedCarouselSlides.map((s, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                    >
                      <p className="font-bold text-fuchsia-400">
                        Slide {s.slideNumber || idx + 1}: {s.headline}
                      </p>
                      <p className="text-slate-300">{s.bodyText}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Story Frames Preview */}
            {generatedStoryFrames.length > 0 && (
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-orange-400 block">
                  Generated Story Frames ({generatedStoryFrames.length})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {generatedStoryFrames.map((f, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1"
                    >
                      <p className="font-bold text-orange-400">Frame {f.frameNumber || idx + 1}</p>
                      <p className="text-slate-200">{f.overlayText}</p>
                      {f.interactiveSticker && (
                        <p className="text-[11px] text-purple-400">
                          Sticker: {f.interactiveSticker} ({f.stickerOptions})
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right 1 Col: Media, Save, Schedule, Publish */}
          <div className="space-y-5">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400 block">
                Media Attachment
              </span>

              {mediaUrl ? (
                <div className="space-y-2">
                  <div className="rounded-xl overflow-hidden aspect-square bg-black border border-slate-800">
                    {mediaType === 'video' ? (
                      <video src={mediaUrl} controls className="w-full h-full object-cover" />
                    ) : (
                      <img src={mediaUrl} alt="Asset" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setMediaUrl('')}
                    className="w-full py-1.5 rounded-lg bg-slate-800 text-xs text-rose-400 hover:bg-slate-700"
                  >
                    Remove Media
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-2">
                  <Upload className="w-6 h-6 mx-auto text-purple-400" />
                  <p className="text-xs text-slate-400">Upload or pick media for Instagram</p>
                  <div className="flex gap-2 justify-center">
                    <label className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-semibold cursor-pointer">
                      <span>Upload</span>
                      <input
                        type="file"
                        onChange={handleFileUpload}
                        accept="image/*,video/*"
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPicker(!showPicker)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold flex items-center gap-1"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Library</span>
                    </button>
                  </div>
                </div>
              )}

              {showPicker && (
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 max-h-36 overflow-y-auto">
                  {libraryItems.map((m) => (
                    <button
                      key={m.url}
                      type="button"
                      onClick={() => {
                        setMediaUrl(m.url);
                        setMediaType(m.mediaType);
                        setShowPicker(false);
                      }}
                      className="aspect-square rounded-lg overflow-hidden border border-slate-700 hover:border-purple-500"
                    >
                      {m.mediaType === 'video' ? (
                        <video src={m.url} className="w-full h-full object-cover" />
                      ) : (
                        <img src={m.url} alt={m.filename} className="w-full h-full object-cover" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => onNavigate('image-generator')}
                className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                <span>Open AI Image Generator</span>
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <button
                type="button"
                onClick={() => setShowPreviewModal(true)}
                className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4 text-purple-400" />
                <span>Preview in Instagram Feed</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveDraft('draft')}
                  disabled={isSaving}
                  className="py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Draft</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveDraft('awaiting_approval')}
                  disabled={isSaving}
                  className="py-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Send to Review</span>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                  <input
                    type="time"
                    value={scheduleTime}
                    onChange={(e) => setScheduleTime(e.target.value)}
                    className="px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleSaveDraft('scheduled')}
                  disabled={isSaving || !scheduleDate}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Send to Calendar</span>
                </button>
              </div>

              {confirmPublish ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs">
                  <p className="font-semibold text-amber-300">
                    Confirm live Instagram publish to @{instagramAccount?.username || 'account'}?
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmPublish(false)}
                      className="flex-1 py-1.5 rounded-lg bg-slate-800 text-slate-300 font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handlePublishNow}
                      className="flex-1 py-1.5 rounded-lg bg-emerald-600 text-white font-bold"
                    >
                      Publish Now
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmPublish(true)}
                  disabled={isPublishing}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{isPublishing ? 'Submitting...' : 'Publish Now via Publora'}</span>
                </button>
              )}

              {saveSuccessMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{saveSuccessMessage}</span>
                </div>
              )}

              {publishFeedback && (
                <div
                  className={`p-3 rounded-xl border text-xs ${
                    publishFeedback.success
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  }`}
                >
                  <p className="font-semibold">
                    {publishFeedback.success ? 'Published to Instagram!' : 'Publishing Error'}
                  </p>
                  <p className="text-[11px] mt-0.5">
                    {publishFeedback.error || `Publora ID: ${publishFeedback.postGroupId || 'queued'}`}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <PostPreviewModal
        post={currentPostForPreview}
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        username={instagramAccount?.username || 'autosocial_creator'}
        userAvatar={instagramAccount?.profile_picture || instagramAccount?.profilePictureUrl}
      />
    </div>
  );
};
