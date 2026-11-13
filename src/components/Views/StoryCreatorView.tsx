import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Sparkles,
  RefreshCw,
  Upload,
  Save,
  Calendar,
  Send,
  FolderOpen,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { StoryFrame, Post } from '../../types';
import {
  generateInstagramContent,
  generateAIImage,
  uploadMedia,
  fetchMediaList,
  publishPostViaPublora,
  triggerSchedulerTick,
} from '../../services/api';
import { NavTab } from '../Sidebar';

interface StoryCreatorViewProps {
  onNavigate: (tab: NavTab) => void;
  isPubloraConnected: boolean;
  instagramAccount: any;
}

export const StoryCreatorView: React.FC<StoryCreatorViewProps> = ({
  isPubloraConnected,
  instagramAccount,
}) => {
  const { user } = useAuth();

  const [topic, setTopic] = useState<string>('');
  const [tone, setTone] = useState<string>('Authentic, Behind-the-Scenes & Interactive');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatingFrameIdx, setGeneratingFrameIdx] = useState<number | null>(null);

  const [title, setTitle] = useState<string>('');
  const [frames, setFrames] = useState<StoryFrame[]>([
    {
      frameNumber: 1,
      visualPrompt: '9:16 vertical studio workspace morning setup',
      overlayText: 'Building something exciting today...',
      interactiveSticker: 'Poll',
      stickerOptions: 'Show me! / Wait for launch',
    },
    {
      frameNumber: 2,
      visualPrompt: '9:16 close up of creative workflow on screen',
      overlayText: 'Which feature do you want next?',
      interactiveSticker: 'Question Box',
      stickerOptions: 'Drop your thoughts below',
    },
  ]);

  const [activeFrameIdx, setActiveFrameIdx] = useState<number>(0);
  const [libraryAssets, setLibraryAssets] = useState<any[]>([]);
  const [showPicker, setShowPicker] = useState<boolean>(false);

  const [scheduleDate, setScheduleDate] = useState<string>('');
  const [scheduleTime, setScheduleTime] = useState<string>('17:00');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [confirmPublish, setConfirmPublish] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadMedia();
    const rawCtx = sessionStorage.getItem('autosocial_command_context');
    if (rawCtx) {
      try {
        const ctx = JSON.parse(rawCtx);
        if (ctx.topic && Date.now() - (ctx.timestamp || 0) < 30000) {
          setTopic(ctx.topic);
          sessionStorage.removeItem('autosocial_command_context');
          if (ctx.autoRun) {
            runGenerateStories(ctx.topic);
          }
        }
      } catch {
        // ignore
      }
    }
  }, []);

  const loadMedia = async () => {
    try {
      const res = await fetchMediaList();
      setLibraryAssets(res.files || []);
    } catch {
      // ignore
    }
  };

  const runGenerateStories = async (overrideTopic?: string) => {
    const activeTopic = (overrideTopic ?? topic).trim();
    if (!activeTopic) return;

    setIsGenerating(true);
    setFeedback(null);

    try {
      const res = await generateInstagramContent({
        topic: activeTopic,
        format: 'story',
        tone,
      });

      if (!res.success || !res.data) {
        setFeedback({ type: 'error', message: res.error || 'Story generation failed.' });
        return;
      }

      const d = res.data;
      setTitle(d.title || activeTopic);
      if (Array.isArray(d.storyFrames) && d.storyFrames.length > 0) {
        setFrames(
          d.storyFrames.map((f: any, idx: number) => ({
            frameNumber: f.frameNumber || idx + 1,
            visualPrompt: f.visualPrompt || `${activeTopic} vertical story frame ${idx + 1}`,
            overlayText: f.overlayText || '',
            interactiveSticker: f.interactiveSticker || 'Poll',
            stickerOptions: f.stickerOptions || 'Yes / No',
          }))
        );
        setActiveFrameIdx(0);
      }
      setFeedback({ type: 'success', message: 'Story sequence generated with Gemini!' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Story generation failed.' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateFrameImage = async (idx: number) => {
    const frame = frames[idx];
    if (!frame) return;
    setGeneratingFrameIdx(idx);
    setFeedback(null);

    try {
      const res = await generateAIImage({
        prompt: `${frame.visualPrompt}. Vertical 9:16 Instagram Story background aesthetic.`,
        aspectRatio: '9:16',
        style: 'Vibrant Vertical Instagram Story',
      });
      if (res.success && res.imageUrl) {
        setFrames((prev) =>
          prev.map((f, i) => (i === idx ? { ...f, mediaUrl: res.imageUrl } : f))
        );
        loadMedia();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Image generation failed.' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Image generation failed.' });
    } finally {
      setGeneratingFrameIdx(null);
    }
  };

  const handleUploadFrameMedia = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await uploadMedia(file);
      if (res.success && res.file) {
        setFrames((prev) =>
          prev.map((f, i) => (i === idx ? { ...f, mediaUrl: res.file.url } : f))
        );
        loadMedia();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Upload failed' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Upload failed' });
    }
  };

  const currentFrame = frames[activeFrameIdx] || frames[0];
  const primaryMedia = currentFrame?.mediaUrl || frames.find((f) => f.mediaUrl)?.mediaUrl || '';

  const handleSaveStory = async (status: 'draft' | 'awaiting_approval' | 'scheduled') => {
    if (!user) return;
    if (status === 'scheduled' && (!scheduleDate || !primaryMedia)) {
      setFeedback({
        type: 'error',
        message: 'Scheduling an Instagram Story requires a date/time and an attached 9:16 image or video.',
      });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const scheduledIso = scheduleDate
        ? new Date(`${scheduleDate}T${scheduleTime || '17:00'}`).toISOString()
        : '';

      const payload: Omit<Post, 'id'> = {
        userId: user.uid,
        title: title || topic || 'Instagram Story Sequence',
        topic,
        format: 'story',
        status,
        caption: frames.map((f) => f.overlayText).filter(Boolean).join('\n'),
        hashtags: '',
        storyFrames: JSON.stringify(frames),
        mediaUrl: primaryMedia,
        mediaType: primaryMedia.endsWith('.mp4') ? 'video' : 'image',
        scheduledTime: scheduledIso,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await addDoc(collection(db, 'posts'), payload);
      if (status === 'scheduled') {
        triggerSchedulerTick().catch(() => {});
      }
      setFeedback({ type: 'success', message: `Story saved as ${status.replace('_', ' ')}!` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed saving story.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishStoryFrame = async () => {
    setConfirmPublish(false);
    if (!isPubloraConnected) {
      setFeedback({ type: 'error', message: 'Connect Instagram via Publora first.' });
      return;
    }
    const targetMedia = currentFrame?.mediaUrl || primaryMedia;
    if (!targetMedia) {
      setFeedback({
        type: 'error',
        message: 'Attach or generate an image/video for the active Story frame before publishing.',
      });
      return;
    }

    setIsPublishing(true);
    setFeedback(null);

    try {
      const res = await publishPostViaPublora({
        caption: currentFrame?.overlayText || title || 'Instagram Story',
        mediaUrl: targetMedia,
        format: 'story',
        videoType: 'STORIES',
        platformId: instagramAccount?.platformId,
        publishNow: true,
      });

      if (!res.success) {
        setFeedback({ type: 'error', message: res.error || 'Story publishing rejected.' });
        return;
      }

      if (user) {
        await addDoc(collection(db, 'posts'), {
          userId: user.uid,
          title: `${title || topic || 'Instagram Story'} (Frame ${activeFrameIdx + 1})`,
          topic,
          format: 'story',
          status: 'published',
          caption: currentFrame?.overlayText || '',
          hashtags: '',
          storyFrames: JSON.stringify(frames),
          mediaUrl: targetMedia,
          mediaType: targetMedia.endsWith('.mp4') ? 'video' : 'image',
          publoraPostId: res.postGroupId || 'live-story',
          publishedTime: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      setFeedback({
        type: 'success',
        message: `Story frame submitted via Publora! (ID: ${res.postGroupId || 'queued'})`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Publish error.' });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-orange-500/10 text-orange-400 flex items-center justify-center border border-orange-500/20">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Instagram 9:16 Story Creator
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Design multi-frame interactive Story sequences with polls, question boxes, overlay text & 9:16 assets.
            </p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            runGenerateStories();
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Behind the scenes launching our new AI product + follower Q&A..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={isGenerating || !topic.trim()}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 via-pink-600 to-purple-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'Generating...' : 'Generate 4-Frame Story'}</span>
          </button>
        </form>
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
        {/* Left: Frame Editor */}
        <div className="lg:col-span-7 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {frames.map((f, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveFrameIdx(idx)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1.5 ${
                  activeFrameIdx === idx
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-950 text-slate-400 border border-slate-800'
                }`}
              >
                <span>Frame {idx + 1}</span>
                {f.mediaUrl && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
              </button>
            ))}
          </div>

          {currentFrame && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Story Overlay Text
                </label>
                <textarea
                  rows={2}
                  value={currentFrame.overlayText}
                  onChange={(e) =>
                    setFrames((prev) =>
                      prev.map((f, i) =>
                        i === activeFrameIdx ? { ...f, overlayText: e.target.value } : f
                      )
                    )
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Interactive Sticker Type
                  </label>
                  <select
                    value={currentFrame.interactiveSticker || 'Poll'}
                    onChange={(e) =>
                      setFrames((prev) =>
                        prev.map((f, i) =>
                          i === activeFrameIdx ? { ...f, interactiveSticker: e.target.value } : f
                        )
                      )
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="Poll">Poll Sticker</option>
                    <option value="Question Box">Question Box</option>
                    <option value="Quiz">Quiz Sticker</option>
                    <option value="Emoji Slider">Emoji Slider</option>
                    <option value="Link CTA">Link CTA</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Sticker Options / Prompt
                  </label>
                  <input
                    type="text"
                    value={currentFrame.stickerOptions || ''}
                    onChange={(e) =>
                      setFrames((prev) =>
                        prev.map((f, i) =>
                          i === activeFrameIdx ? { ...f, stickerOptions: e.target.value } : f
                        )
                      )
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                  9:16 Visual Background Prompt
                </label>
                <input
                  type="text"
                  value={currentFrame.visualPrompt}
                  onChange={(e) =>
                    setFrames((prev) =>
                      prev.map((f, i) =>
                        i === activeFrameIdx ? { ...f, visualPrompt: e.target.value } : f
                      )
                    )
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleGenerateFrameImage(activeFrameIdx)}
                  disabled={generatingFrameIdx === activeFrameIdx}
                  className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${generatingFrameIdx === activeFrameIdx ? 'animate-spin' : ''}`} />
                  <span>
                    {generatingFrameIdx === activeFrameIdx ? 'Generating...' : 'AI Generate 9:16 Background'}
                  </span>
                </button>

                <label className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold cursor-pointer flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Image/Video</span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => handleUploadFrameMedia(activeFrameIdx, e)}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setShowPicker(!showPicker)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Library</span>
                </button>
              </div>

              {showPicker && (
                <div className="grid grid-cols-4 gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800 max-h-40 overflow-y-auto">
                  {libraryAssets.map((a) => (
                    <button
                      key={a.url}
                      type="button"
                      onClick={() => {
                        setFrames((prev) =>
                          prev.map((f, i) => (i === activeFrameIdx ? { ...f, mediaUrl: a.url } : f))
                        );
                        setShowPicker(false);
                      }}
                      className="aspect-9/16 rounded-lg overflow-hidden border border-slate-700 hover:border-purple-500"
                    >
                      {a.mediaType === 'video' ? (
                        <video src={a.url} className="w-full h-full object-cover" />
                      ) : (
                        <img src={a.url} alt={a.filename} className="w-full h-full object-cover" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: 9:16 Mobile Story Preview & Controls */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="relative aspect-9/16 max-h-[460px] mx-auto rounded-3xl overflow-hidden bg-slate-950 border-2 border-slate-800 flex flex-col justify-between">
            {currentFrame?.mediaUrl ? (
              currentFrame.mediaUrl.endsWith('.mp4') ? (
                <video
                  src={currentFrame.mediaUrl}
                  controls
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <img
                  src={currentFrame.mediaUrl}
                  alt="Story preview"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )
            ) : (
              <div className="absolute inset-0 bg-gradient-to-b from-purple-900/70 via-slate-950 to-pink-950/70" />
            )}

            {/* Progress bars */}
            <div className="relative z-10 p-3 flex gap-1">
              {frames.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1 flex-1 rounded-full ${
                    idx <= activeFrameIdx ? 'bg-white' : 'bg-white/30'
                  }`}
                />
              ))}
            </div>

            <div className="relative z-10 p-5 my-auto text-center space-y-4">
              <p className="text-sm font-bold text-white drop-shadow-md bg-black/40 p-3 rounded-xl">
                {currentFrame?.overlayText}
              </p>

              {currentFrame?.interactiveSticker && (
                <div className="inline-block px-4 py-2.5 rounded-2xl bg-white text-slate-900 shadow-xl text-xs">
                  <p className="font-extrabold uppercase text-[10px] text-purple-600">
                    {currentFrame.interactiveSticker}
                  </p>
                  <p className="font-semibold mt-0.5">{currentFrame.stickerOptions}</p>
                </div>
              )}
            </div>

            <div className="relative z-10 p-3 flex justify-between">
              <button
                type="button"
                onClick={() => setActiveFrameIdx((i) => Math.max(0, i - 1))}
                disabled={activeFrameIdx === 0}
                className="p-1.5 rounded-full bg-black/50 text-white disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setActiveFrameIdx((i) => Math.min(frames.length - 1, i + 1))}
                disabled={activeFrameIdx === frames.length - 1}
                className="p-1.5 rounded-full bg-black/50 text-white disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSaveStory('draft')}
                disabled={isSaving}
                className="py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Draft</span>
              </button>
              <button
                type="button"
                onClick={() => handleSaveStory('scheduled')}
                disabled={isSaving || !scheduleDate}
                className="py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Schedule Story</span>
              </button>
            </div>

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

            {confirmPublish ? (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs">
                <p className="font-semibold text-amber-300">
                  Publish Frame {activeFrameIdx + 1} as a live Instagram Story on @{instagramAccount?.username || 'account'}?
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
                    onClick={handlePublishStoryFrame}
                    className="flex-1 py-1.5 rounded-lg bg-emerald-600 text-white font-bold"
                  >
                    Publish Story
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmPublish(true)}
                disabled={isPublishing}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isPublishing ? 'Publishing...' : 'Publish Active Frame via Publora'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
