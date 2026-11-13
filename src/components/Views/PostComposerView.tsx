import React, { useState, useEffect } from 'react';
import {
  PenSquare,
  Sparkles,
  Upload,
  FolderOpen,
  Eye,
  Save,
  Calendar,
  Send,
  Clock,
  CheckCircle2,
  AlertTriangle,
  X,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Post, PostFormat } from '../../types';
import {
  generateInstagramContent,
  uploadMedia,
  fetchMediaList,
  publishPostViaPublora,
  triggerSchedulerTick,
} from '../../services/api';
import { PostPreviewModal } from '../PostPreviewModal';
import { NavTab } from '../Sidebar';

interface PostComposerViewProps {
  onNavigate: (tab: NavTab) => void;
  isPubloraConnected: boolean;
  instagramAccount: any;
}

export const PostComposerView: React.FC<PostComposerViewProps> = ({
  onNavigate,
  isPubloraConnected,
  instagramAccount,
}) => {
  const { user, userProfile } = useAuth();

  const [format, setFormat] = useState<PostFormat>('post');
  const [title, setTitle] = useState<string>('');
  const [topic, setTopic] = useState<string>('');
  const [hook, setHook] = useState<string>('');
  const [caption, setCaption] = useState<string>('');
  const [hashtags, setHashtags] = useState<string>('');
  const [cta, setCta] = useState<string>('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');

  const [scheduleDate, setScheduleDate] = useState<string>('');
  const [scheduleTime, setScheduleTime] = useState<string>('18:30');

  const [libraryItems, setLibraryItems] = useState<any[]>([]);
  const [showLibrary, setShowLibrary] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [confirmPublish, setConfirmPublish] = useState<boolean>(false);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadMedia();

    // Check prefill from Image Generator, Video Studio, or Command Bar
    const composerPrefill = sessionStorage.getItem('autosocial_composer_prefill');
    if (composerPrefill) {
      try {
        const pre = JSON.parse(composerPrefill);
        if (pre.title) setTitle(pre.title);
        if (pre.topic) setTopic(pre.topic);
        if (pre.format) setFormat(pre.format);
        if (pre.caption) setCaption(pre.caption);
        if (pre.hashtags) setHashtags(pre.hashtags);
        if (pre.hook) setHook(pre.hook);
        if (pre.cta) setCta(pre.cta);
        if (pre.mediaUrl) {
          setMediaUrls([pre.mediaUrl]);
          setMediaType(pre.mediaType || (pre.mediaUrl.endsWith('.mp4') ? 'video' : 'image'));
        }
        sessionStorage.removeItem('autosocial_composer_prefill');
      } catch {
        // ignore
      }
    }

    const cmdCtx = sessionStorage.getItem('autosocial_command_context');
    if (cmdCtx) {
      try {
        const ctx = JSON.parse(cmdCtx);
        if (ctx.topic && Date.now() - (ctx.timestamp || 0) < 30000) {
          setTopic(ctx.topic);
          setTitle(ctx.topic);
          if (['post', 'reel', 'carousel', 'story', 'video'].includes(ctx.format)) {
            setFormat(ctx.format as PostFormat);
          }
          sessionStorage.removeItem('autosocial_command_context');
        }
      } catch {
        // ignore
      }
    }
  }, []);

  const loadMedia = async () => {
    try {
      const res = await fetchMediaList();
      setLibraryItems(res.files || []);
    } catch {
      // ignore
    }
  };

  const handleAIFill = async () => {
    const promptTopic = (topic || title).trim();
    if (!promptTopic) {
      setFeedback({ type: 'error', message: 'Enter a topic or post title first for Gemini AI.' });
      return;
    }

    setIsGenerating(true);
    setFeedback(null);

    try {
      const res = await generateInstagramContent({
        topic: promptTopic,
        format,
        hashtagCount: 15,
      });

      if (!res.success || !res.data) {
        setFeedback({ type: 'error', message: res.error || 'AI generation failed.' });
        return;
      }

      const d = res.data;
      setTitle(d.title || promptTopic);
      setHook(d.hook || '');
      setCaption(d.caption || '');
      setHashtags(d.hashtags || '');
      setCta(d.cta || '');
      setFeedback({ type: 'success', message: 'Post copy & hashtags generated with Gemini!' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'AI error' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedback(null);
    try {
      const res = await uploadMedia(file);
      if (res.success && res.file) {
        setMediaType(res.file.mediaType);
        if (format === 'carousel') {
          setMediaUrls((prev) => [...prev, res.file.url].slice(0, 10));
        } else {
          setMediaUrls([res.file.url]);
        }
        loadMedia();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Upload failed' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Upload error' });
    }
  };

  const validateForInstagram = (requireMedia: boolean): string | null => {
    if (!caption.trim()) return 'Caption text cannot be empty.';
    if (requireMedia && mediaUrls.length === 0) {
      return 'Instagram strictly requires at least one image or video attachment before scheduling or publishing.';
    }
    if (requireMedia && format === 'carousel' && mediaUrls.length < 2) {
      return 'Instagram Carousels require between 2 and 10 attached images.';
    }
    return null;
  };

  const handleSavePost = async (targetStatus: 'draft' | 'awaiting_approval' | 'approved' | 'scheduled') => {
    if (!user) return;
    const validationErr = validateForInstagram(targetStatus === 'scheduled');
    if (validationErr) {
      setFeedback({ type: 'error', message: validationErr });
      return;
    }

    if (targetStatus === 'scheduled' && !scheduleDate) {
      setFeedback({ type: 'error', message: 'Select a schedule date & time first.' });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const scheduledIso =
        targetStatus === 'scheduled' && scheduleDate
          ? new Date(`${scheduleDate}T${scheduleTime || '18:30'}`).toISOString()
          : '';

      let publoraPostId = '';
      if (targetStatus === 'scheduled' && isPubloraConnected && userProfile?.autoPublishApproved) {
        const pubRes = await publishPostViaPublora({
          caption,
          hashtags,
          mediaUrl: mediaUrls[0],
          mediaUrls,
          format,
          platformId: instagramAccount?.platformId,
          scheduledTime: scheduledIso,
        });
        if (!pubRes.success) {
          setFeedback({
            type: 'error',
            message: `Publora scheduling failed: ${pubRes.error}. Saved locally only? Adjust media and retry.`,
          });
          return;
        }
        publoraPostId = pubRes.postGroupId || '';
      }

      const payload: Omit<Post, 'id'> = {
        userId: user.uid,
        title: title || topic || 'Instagram Post',
        topic,
        format,
        status: targetStatus,
        hook,
        caption,
        hashtags,
        cta,
        mediaUrl: mediaUrls[0] || '',
        mediaUrls,
        mediaType,
        scheduledTime: scheduledIso,
        publoraPostId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await addDoc(collection(db, 'posts'), payload);
      if (targetStatus === 'scheduled') {
        triggerSchedulerTick().catch(() => {});
      }

      setFeedback({
        type: 'success',
        message:
          targetStatus === 'scheduled'
            ? publoraPostId
              ? `Post scheduled in Calendar & Publora (${publoraPostId})!`
              : 'Post scheduled in Calendar & server cron queue!'
            : `Saved to ${targetStatus.replace('_', ' ')}!`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Save failed.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishNow = async () => {
    setConfirmPublish(false);
    if (!isPubloraConnected) {
      setFeedback({ type: 'error', message: 'Connect Instagram via Publora first.' });
      return;
    }
    const validationErr = validateForInstagram(true);
    if (validationErr) {
      setFeedback({ type: 'error', message: validationErr });
      return;
    }

    setIsPublishing(true);
    setFeedback(null);

    try {
      const res = await publishPostViaPublora({
        caption,
        hashtags,
        mediaUrl: mediaUrls[0],
        mediaUrls,
        format,
        platformId: instagramAccount?.platformId,
        publishNow: true,
      });

      if (!res.success) {
        setFeedback({ type: 'error', message: res.error || 'Publora rejected post.' });
        return;
      }

      if (user) {
        await addDoc(collection(db, 'posts'), {
          userId: user.uid,
          title: title || topic || 'Instagram Post',
          topic,
          format,
          status: 'published',
          hook,
          caption,
          hashtags,
          cta,
          mediaUrl: mediaUrls[0],
          mediaUrls,
          mediaType,
          publoraPostId: res.postGroupId || 'live-post',
          publishedTime: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      setFeedback({
        type: 'success',
        message: `Published to Instagram via Publora! (postGroupId: ${res.postGroupId || 'submitted'})`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Publish failed' });
    } finally {
      setIsPublishing(false);
    }
  };

  const previewPost: Post = {
    userId: user?.uid || '',
    title: title || 'Instagram Post',
    format,
    status: 'draft',
    caption,
    hashtags,
    hook,
    cta,
    mediaUrl: mediaUrls[0] || '',
    mediaUrls,
    mediaType,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
            <PenSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Unified Instagram Post Composer
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Compose Reels, Feed Posts, Carousels, or Stories with media validation and Publora scheduling.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
          {(['post', 'reel', 'carousel', 'story', 'video'] as PostFormat[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={`px-3 py-1.5 rounded-lg font-semibold capitalize transition ${
                format === f ? 'bg-purple-600 text-white' : 'text-slate-500 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center gap-2.5 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Cols: Copy & AI Assist */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                if (!title) setTitle(e.target.value);
              }}
              placeholder="Topic or AI prompt (optional)..."
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white"
            />
            <button
              type="button"
              onClick={handleAIFill}
              disabled={isGenerating}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 shrink-0"
            >
              {isGenerating ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              <span>{isGenerating ? 'Writing...' : 'Write with Gemini'}</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Post Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Internal post title..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Opening Hook</label>
            <input
              type="text"
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              placeholder="Scroll-stopping opening line..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-400">Instagram Caption</label>
              <span className="text-[11px] text-slate-500">{caption.length} / 2200 chars</span>
            </div>
            <textarea
              rows={7}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write your Instagram caption..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Hashtags</label>
              <input
                type="text"
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="#instagram #ai #creator"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Call To Action (CTA)</label>
              <input
                type="text"
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                placeholder="Save this post & follow for more!"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Media Attachment & Actions */}
        <div className="lg:col-span-5 space-y-5">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                Attached Media ({mediaUrls.length})
              </span>
              {format === 'carousel' && (
                <span className="text-[11px] text-amber-400">2–10 images required</span>
              )}
            </div>

            {mediaUrls.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {mediaUrls.map((url, idx) => (
                  <div
                    key={`${url}-${idx}`}
                    className="relative aspect-square rounded-xl overflow-hidden bg-black border border-slate-800"
                  >
                    {url.endsWith('.mp4') || url.endsWith('.mov') || url.endsWith('.webm') ? (
                      <video src={url} controls className="w-full h-full object-cover" />
                    ) : (
                      <img src={url} alt={`Media ${idx + 1}`} className="w-full h-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => setMediaUrls((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/70 text-rose-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-2">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  No Media Attached Yet
                </p>
                <p className="text-[11px] text-slate-400">
                  Instagram requires an image or video file before publishing or scheduling.
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <label className="flex-1 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload File</span>
                <input type="file" accept="image/*,video/*" onChange={handleUpload} className="hidden" />
              </label>
              <button
                type="button"
                onClick={() => setShowLibrary(!showLibrary)}
                className="flex-1 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>Media Library</span>
              </button>
            </div>

            {showLibrary && (
              <div className="grid grid-cols-4 gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800 max-h-40 overflow-y-auto">
                {libraryItems.map((item) => (
                  <button
                    key={item.url}
                    type="button"
                    onClick={() => {
                      setMediaType(item.mediaType);
                      if (format === 'carousel') {
                        setMediaUrls((prev) =>
                          prev.includes(item.url) ? prev : [...prev, item.url].slice(0, 10)
                        );
                      } else {
                        setMediaUrls([item.url]);
                      }
                      setShowLibrary(false);
                    }}
                    className="aspect-square rounded-lg overflow-hidden border border-slate-700 hover:border-purple-500"
                  >
                    {item.mediaType === 'video' ? (
                      <video src={item.url} className="w-full h-full object-cover" />
                    ) : (
                      <img src={item.url} alt={item.filename} className="w-full h-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              <Eye className="w-4 h-4 text-purple-400" />
              <span>Preview Post</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSavePost('draft')}
                disabled={isSaving}
                className="py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Draft</span>
              </button>
              <button
                type="button"
                onClick={() => handleSavePost('awaiting_approval')}
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
                  className="px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                />
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <button
                type="button"
                onClick={() => handleSavePost('scheduled')}
                disabled={isSaving || !scheduleDate}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Schedule Post</span>
              </button>
            </div>

            {confirmPublish ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs">
                <p className="font-semibold text-amber-300">
                  Explicit Approval: Publish live to Instagram @{instagramAccount?.username || 'account'} now?
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
                    Confirm & Publish
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmPublish(true)}
                disabled={isPublishing}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isPublishing ? 'Submitting...' : 'Publish Now via Publora'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <PostPreviewModal
        post={previewPost}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        username={instagramAccount?.username || 'autosocial_creator'}
        userAvatar={instagramAccount?.profile_picture || instagramAccount?.profilePictureUrl}
      />
    </div>
  );
};
