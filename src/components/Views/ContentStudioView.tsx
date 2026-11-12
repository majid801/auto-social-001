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
  Image as ImageIcon,
  Layers,
  MessageSquare,
  Clock,
  Music,
  ArrowRight,
  SlidersHorizontal,
  ChevronDown,
  Upload,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Post, PostFormat, SceneBreakdown } from '../../types';
import { generateInstagramContent, regenerateAISection, publishPostViaPublora, uploadMedia } from '../../services/api';
import { PostPreviewModal } from '../PostPreviewModal';
import { NavTab } from '../Sidebar';

interface ContentStudioViewProps {
  onNavigate: (tab: NavTab) => void;
  isPubloraConnected: boolean;
  instagramAccount: any;
}

export const ContentStudioView: React.FC<ContentStudioViewProps> = ({
  onNavigate,
  isPubloraConnected,
  instagramAccount,
}) => {
  const { user } = useAuth();

  // Form inputs
  const [topic, setTopic] = useState<string>('');
  const [format, setFormat] = useState<PostFormat>('reel');
  const [category, setCategory] = useState<string>('Education & Tech');
  const [targetAudience, setTargetAudience] = useState<string>('Students & Young Professionals');
  const [tone, setTone] = useState<string>('Engaging, Relatable, High-Value');
  const [visualStyle, setVisualStyle] = useState<string>('Modern dark purple gradient with high contrast tech neon accents');
  const [brandVoice, setBrandVoice] = useState<string>('Inspiring mentor & knowledgeable creator');
  const [language, setLanguage] = useState<string>('English');
  const [hashtagCount, setHashtagCount] = useState<number>(15);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  // Generation state
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);

  // Generated package fields (editable)
  const [generatedTitle, setGeneratedTitle] = useState<string>('');
  const [generatedHook, setGeneratedHook] = useState<string>('');
  const [generatedCaption, setGeneratedCaption] = useState<string>('');
  const [generatedHashtags, setGeneratedHashtags] = useState<string>('');
  const [generatedCta, setGeneratedCta] = useState<string>('');
  const [generatedScript, setGeneratedScript] = useState<string>('');
  const [generatedScenes, setGeneratedScenes] = useState<SceneBreakdown[]>([]);
  const [generatedMusic, setGeneratedMusic] = useState<string>('');
  const [generatedDuration, setGeneratedDuration] = useState<string>('');
  const [suggestedPostingTime, setSuggestedPostingTime] = useState<string>('');
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');

  // Actions state
  const [copiedCaption, setCopiedCaption] = useState<boolean>(false);
  const [copiedHashtags, setCopiedHashtags] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [publishFeedback, setPublishFeedback] = useState<any>(null);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);

  // Scheduled date/time picker
  const [scheduleDate, setScheduleDate] = useState<string>('');
  const [scheduleTime, setScheduleTime] = useState<string>('18:00');

  useEffect(() => {
    // Check if initial prompt was passed from dashboard
    const cachedPrompt = sessionStorage.getItem('autosocial_initial_prompt');
    if (cachedPrompt) {
      setTopic(cachedPrompt);
      sessionStorage.removeItem('autosocial_initial_prompt');
    }
  }, []);

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!topic.trim()) return;

    setIsGenerating(true);
    setSaveSuccessMessage(null);
    setPublishFeedback(null);

    try {
      const response = await generateInstagramContent({
        topic,
        format,
        category,
        targetAudience,
        tone,
        visualStyle,
        brandVoice,
        language,
        hashtagCount,
      });

      if (response.success && response.data) {
        const d = response.data;
        setGeneratedTitle(d.title || topic);
        setGeneratedHook(d.hook || '');
        setGeneratedCaption(d.caption || '');
        setGeneratedHashtags(d.hashtags || '');
        setGeneratedCta(d.cta || '');
        setGeneratedMusic(d.musicDescription || '');
        setGeneratedDuration(d.suggestedDuration || '');
        setSuggestedPostingTime(d.suggestedPostingTime || 'Tomorrow 6:30 PM');

        if (d.reelScript) {
          const scriptStr = typeof d.reelScript === 'string'
            ? d.reelScript
            : JSON.stringify(d.reelScript, null, 2);
          setGeneratedScript(scriptStr);

          if (Array.isArray(d.reelScript.scenes)) {
            setGeneratedScenes(d.reelScript.scenes);
          }
        }
      }
    } catch (err) {
      console.error('Content generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerateSection = async (sectionName: string, originalText: string) => {
    setRegeneratingSection(sectionName);
    try {
      const res = await regenerateAISection({
        section: sectionName,
        originalContent: originalText,
        topic,
      });
      if (res.success && res.content) {
        if (sectionName === 'hook') setGeneratedHook(res.content);
        if (sectionName === 'caption') setGeneratedCaption(res.content);
        if (sectionName === 'hashtags') setGeneratedHashtags(res.content);
        if (sectionName === 'cta') setGeneratedCta(res.content);
      }
    } catch (e) {
      console.error('Section regeneration error:', e);
    } finally {
      setRegeneratingSection(null);
    }
  };

  const handleCopyCaption = () => {
    navigator.clipboard.writeText(generatedCaption);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  const handleCopyHashtags = () => {
    navigator.clipboard.writeText(generatedHashtags);
    setCopiedHashtags(true);
    setTimeout(() => setCopiedHashtags(false), 2000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await uploadMedia(file);
      if (result.success && result.file) {
        setMediaUrl(result.file.url);
        setMediaType(result.file.mediaType);
      }
    } catch (err) {
      console.error('Media upload error:', err);
    }
  };

  const handleSaveDraft = async (targetStatus: 'draft' | 'awaiting_approval' | 'scheduled') => {
    if (!user) return;
    setIsSaving(true);
    setSaveSuccessMessage(null);

    try {
      const scheduledDateTime = scheduleDate ? `${scheduleDate}T${scheduleTime}:00` : '';
      const newPostPayload: Omit<Post, 'id'> = {
        userId: user.uid,
        title: generatedTitle || topic || 'Untitled Post',
        topic,
        format,
        status: targetStatus,
        hook: generatedHook,
        caption: generatedCaption,
        hashtags: generatedHashtags,
        cta: generatedCta,
        script: generatedScript,
        scenes: JSON.stringify(generatedScenes),
        visualStyle,
        musicDescription: generatedMusic,
        suggestedDuration: generatedDuration,
        suggestedPostingTime: suggestedPostingTime || scheduledDateTime,
        mediaUrl: mediaUrl || '',
        mediaType,
        scheduledTime: scheduledDateTime || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'posts'), newPostPayload);
      setSaveSuccessMessage(`Successfully saved as ${targetStatus.replace('_', ' ')}!`);
      setTimeout(() => setSaveSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Save draft error:', err);
      handleFirestoreError(err, OperationType.CREATE, 'posts');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishNow = async () => {
    if (!isPubloraConnected) {
      setPublishFeedback({
        success: false,
        error: 'Publora Instagram account is not connected. Please configure your PUBLORA_API_KEY.',
      });
      return;
    }

    setIsPublishing(true);
    setPublishFeedback(null);

    try {
      const res = await publishPostViaPublora({
        caption: `${generatedCaption}\n\n${generatedHashtags}`,
        mediaUrl: mediaUrl || '',
        platform: 'instagram',
        title: generatedTitle,
      });

      setPublishFeedback(res);

      if (res.success && user) {
        // Record in Firestore
        await addDoc(collection(db, 'posts'), {
          userId: user.uid,
          title: generatedTitle || topic,
          format,
          status: 'published',
          caption: generatedCaption,
          hashtags: generatedHashtags,
          hook: generatedHook,
          publoraPostId: res.data?.id || 'live-submission',
          publishedTime: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      setPublishFeedback({ success: false, error: err.message });
    } finally {
      setIsPublishing(false);
    }
  };

  // Preview Post object
  const currentPostForPreview: Post = {
    userId: user?.uid || '',
    title: generatedTitle || topic || 'Instagram Post',
    format,
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              AI Instagram Content Studio
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Generate complete, scroll-stopping Instagram packages powered by Gemini.
            </p>
          </div>

          {/* Format selector buttons */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
            {(['reel', 'post', 'carousel', 'story', 'video'] as PostFormat[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={`px-3 py-1.5 rounded-lg font-semibold capitalize transition ${
                  format === f
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Input prompt form */}
        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Content Topic, Instruction or Creative Brief
            </label>
            <div className="relative">
              <textarea
                rows={3}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Create an Instagram Reel about artificial intelligence and its benefits for students preparing for finals..."
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-hidden focus:border-purple-500 transition leading-relaxed resize-none"
              />
            </div>
          </div>

          {/* Quick preset topics */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium text-[11px]">Quick Ideas:</span>
            {[
              '5 AI productivity tools for students in 2026',
              'Behind the scenes of building an AI SaaS startup',
              'How to gain your first 10k Instagram followers organically',
              '3 mistakes ruining your Instagram Reel reach',
            ].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setTopic(preset)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/60 hover:bg-purple-500/10 hover:text-purple-400 text-slate-600 dark:text-slate-300 text-[11px] transition"
              >
                {preset}
              </button>
            ))}
          </div>

          {/* Toggle Advanced Controls */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1 hover:underline"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{showAdvanced ? 'Hide Customization Parameters' : 'Show Audience & Style Customization'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Advanced options grid */}
          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs">
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
                <label className="block text-slate-400 mb-1">Tone of Voice</label>
                <input
                  type="text"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
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
                <label className="block text-slate-400 mb-1">Language</label>
                <input
                  type="text"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Number of Hashtags</label>
                <input
                  type="number"
                  min={5}
                  max={30}
                  value={hashtagCount}
                  onChange={(e) => setHashtagCount(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="submit"
              disabled={isGenerating || !topic.trim()}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-purple-600/25 transition flex items-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Generating Complete Package...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Complete Package</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Generated Content Studio Workspace */}
      {generatedCaption && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Editable generated components */}
          <div className="lg:col-span-2 space-y-5">
            {/* Title & Hook Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Hook & Attention Grabber (0-3s)
                </span>
                <button
                  onClick={() => handleRegenerateSection('hook', generatedHook)}
                  disabled={regeneratingSection === 'hook'}
                  className="text-xs text-slate-400 hover:text-purple-400 flex items-center gap-1 transition"
                >
                  <RefreshCw className={`w-3 h-3 ${regeneratingSection === 'hook' ? 'animate-spin' : ''}`} />
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
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRegenerateSection('caption', generatedCaption)}
                    disabled={regeneratingSection === 'caption'}
                    className="text-xs text-slate-400 hover:text-purple-400 flex items-center gap-1 transition"
                  >
                    <RefreshCw className={`w-3 h-3 ${regeneratingSection === 'caption' ? 'animate-spin' : ''}`} />
                    <span>Regenerate</span>
                  </button>
                  <button
                    onClick={handleCopyCaption}
                    className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    {copiedCaption ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCaption ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>
              <textarea
                rows={8}
                value={generatedCaption}
                onChange={(e) => setGeneratedCaption(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs sm:text-sm leading-relaxed resize-y font-normal"
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
                    onClick={() => handleRegenerateSection('cta', generatedCta)}
                    disabled={regeneratingSection === 'cta'}
                    className="text-xs text-slate-400 hover:text-purple-400 flex items-center gap-1 transition"
                  >
                    <RefreshCw className={`w-3 h-3 ${regeneratingSection === 'cta' ? 'animate-spin' : ''}`} />
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
                  <button
                    onClick={handleCopyHashtags}
                    className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    {copiedHashtags ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedHashtags ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={generatedHashtags}
                  onChange={(e) => setGeneratedHashtags(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-indigo-400 text-xs"
                />
              </div>
            </div>

            {/* Reel Script & Scene Breakdown (if format is reel/video) */}
            {(format === 'reel' || format === 'video') && (
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                    <Film className="w-4 h-4" /> Reel Script & Scene-by-Scene Breakdown
                  </span>
                  {generatedDuration && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium">
                      Duration: {generatedDuration}
                    </span>
                  )}
                </div>

                {generatedScenes.length > 0 ? (
                  <div className="space-y-3">
                    {generatedScenes.map((scene, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between font-semibold text-slate-800 dark:text-slate-200">
                          <span className="text-purple-400">Scene {scene.sceneNumber || idx + 1} ({scene.durationSeconds || 3}s)</span>
                          {scene.transition && (
                            <span className="text-[10px] text-slate-400 font-mono">Transition: {scene.transition}</span>
                          )}
                        </div>
                        <p className="text-slate-600 dark:text-slate-300">
                          <strong className="text-slate-400">Visual:</strong> {scene.visualPrompt}
                        </p>
                        <p className="text-slate-600 dark:text-slate-300">
                          <strong className="text-slate-400">Voiceover:</strong> "{scene.voiceover}"
                        </p>
                        {scene.subtitleText && (
                          <p className="text-indigo-400 text-[11px]">
                            <strong>Subtitle Overlay:</strong> {scene.subtitleText}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <textarea
                    rows={6}
                    value={generatedScript}
                    onChange={(e) => setGeneratedScript(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-xs leading-relaxed"
                  />
                )}

                {generatedMusic && (
                  <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20 text-xs flex items-center gap-2 text-purple-300">
                    <Music className="w-4 h-4 text-purple-400 shrink-0" />
                    <span>Suggested Background Music: <strong>{generatedMusic}</strong></span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right 1 Col: Publishing & Scheduling Actions Bar */}
          <div className="space-y-5">
            {/* Media Attachment Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block">
                Post Media Asset
              </span>

              {mediaUrl ? (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden aspect-square bg-black border border-slate-800">
                    {mediaType === 'video' ? (
                      <video src={mediaUrl} controls className="w-full h-full object-cover" />
                    ) : (
                      <img src={mediaUrl} alt="Post preview" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <button
                    onClick={() => setMediaUrl('')}
                    className="w-full py-1.5 rounded-lg bg-slate-800 text-xs text-rose-400 hover:bg-slate-700 transition"
                  >
                    Remove Asset
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-3">
                  <div className="w-10 h-10 mx-auto rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Upload Media</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">JPEG, PNG, MP4 up to 50MB</p>
                  </div>
                  <label className="inline-block px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer shadow-xs transition">
                    <span>Browse Device</span>
                    <input type="file" onChange={handleFileUpload} accept="image/*,video/*" className="hidden" />
                  </label>
                </div>
              )}

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => onNavigate('image-generator')}
                  className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                  <span>Generate with AI Image Generator</span>
                </button>
              </div>
            </div>

            {/* Publishing Action Box */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block">
                Publishing & Scheduling
              </span>

              {/* Preview Button */}
              <button
                type="button"
                onClick={() => setShowPreviewModal(true)}
                className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-semibold flex items-center justify-center gap-2 transition"
              >
                <Eye className="w-4 h-4 text-purple-400" />
                <span>Preview in Instagram Feed</span>
              </button>

              {/* Save draft */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleSaveDraft('draft')}
                  disabled={isSaving}
                  className="py-2.5 px-3 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Draft</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveDraft('awaiting_approval')}
                  disabled={isSaving}
                  className="py-2.5 px-3 rounded-xl bg-purple-100 dark:bg-purple-950/60 hover:bg-purple-200 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Send to Review</span>
                </button>
              </div>

              {/* Schedule time input */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <label className="block text-[11px] font-semibold text-slate-400">
                  Schedule Date & Time
                </label>
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
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50 shadow-xs"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Schedule to Calendar</span>
                </button>
              </div>

              {/* Publish Now Button (Publora) */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handlePublishNow}
                  disabled={isPublishing}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {isPublishing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Submitting to Publora...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Publish Now via Publora</span>
                    </>
                  )}
                </button>
              </div>

              {/* Feedback messages */}
              {saveSuccessMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{saveSuccessMessage}</span>
                </div>
              )}

              {publishFeedback && (
                <div className={`p-3 rounded-xl border text-xs ${
                  publishFeedback.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  <p className="font-semibold">{publishFeedback.success ? 'Published to Instagram Successfully!' : 'Publishing Error'}</p>
                  <p className="text-[11px] mt-0.5">{publishFeedback.error || JSON.stringify(publishFeedback.data)}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Realistic Instagram Feed / Reel Preview Modal */}
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
