import React, { useState, useEffect } from 'react';
import {
  Layers,
  Sparkles,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Upload,
  Save,
  Calendar,
  Send,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { CarouselSlide, Post } from '../../types';
import {
  generateInstagramContent,
  generateAIImage,
  uploadMedia,
  fetchMediaList,
  publishPostViaPublora,
  triggerSchedulerTick,
} from '../../services/api';
import { NavTab } from '../Sidebar';

interface CarouselCreatorViewProps {
  onNavigate: (tab: NavTab) => void;
  isPubloraConnected: boolean;
  instagramAccount: any;
}

export const CarouselCreatorView: React.FC<CarouselCreatorViewProps> = ({
  onNavigate,
  isPubloraConnected,
  instagramAccount,
}) => {
  const { user } = useAuth();

  const [topic, setTopic] = useState<string>('');
  const [tone, setTone] = useState<string>('Educational, Punchy & Visual');
  const [language, setLanguage] = useState<string>('English');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatingSlideIdx, setGeneratingSlideIdx] = useState<number | null>(null);

  const [title, setTitle] = useState<string>('');
  const [caption, setCaption] = useState<string>('');
  const [hashtags, setHashtags] = useState<string>('');
  const [slides, setSlides] = useState<CarouselSlide[]>([
    {
      slideNumber: 1,
      headline: 'Slide 1: Scroll-Stopping Hook',
      bodyText: 'Grab attention with a bold question or surprising fact.',
      visualPrompt: 'Bold minimalist purple tech gradient slide cover with crisp typography',
    },
    {
      slideNumber: 2,
      headline: 'Slide 2: Core Value Point #1',
      bodyText: 'Explain the first actionable insight concisely.',
      visualPrompt: 'Clean dark editorial infographic card illustrating step one',
    },
  ]);

  const [activeSlideIdx, setActiveSlideIdx] = useState<number>(0);
  const [libraryImages, setLibraryImages] = useState<any[]>([]);
  const [showLibraryPicker, setShowLibraryPicker] = useState<boolean>(false);

  const [scheduleDate, setScheduleDate] = useState<string>('');
  const [scheduleTime, setScheduleTime] = useState<string>('18:00');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [confirmPublish, setConfirmPublish] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadLibrary();
    const rawCtx = sessionStorage.getItem('autosocial_command_context');
    if (rawCtx) {
      try {
        const ctx = JSON.parse(rawCtx);
        if (ctx.topic && Date.now() - (ctx.timestamp || 0) < 30000) {
          setTopic(ctx.topic);
          sessionStorage.removeItem('autosocial_command_context');
          if (ctx.autoRun) {
            runGenerateCarousel(ctx.topic);
          }
        }
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  const loadLibrary = async () => {
    try {
      const res = await fetchMediaList();
      setLibraryImages((res.files || []).filter((f: any) => f.mediaType === 'image'));
    } catch {
      // ignore
    }
  };

  const runGenerateCarousel = async (overrideTopic?: string) => {
    const activeTopic = (overrideTopic ?? topic).trim();
    if (!activeTopic) return;

    setIsGenerating(true);
    setFeedback(null);

    try {
      const res = await generateInstagramContent({
        topic: activeTopic,
        format: 'carousel',
        tone,
        language,
        hashtagCount: 15,
      });

      if (!res.success || !res.data) {
        setFeedback({ type: 'error', message: res.error || 'Failed to generate carousel deck.' });
        return;
      }

      const d = res.data;
      setTitle(d.title || activeTopic);
      setCaption(d.caption || '');
      setHashtags(d.hashtags || '');

      if (Array.isArray(d.carouselSlides) && d.carouselSlides.length >= 2) {
        setSlides(
          d.carouselSlides.slice(0, 10).map((s: any, idx: number) => ({
            slideNumber: s.slideNumber || idx + 1,
            headline: s.headline || `Slide ${idx + 1}`,
            bodyText: s.bodyText || '',
            visualPrompt: s.visualPrompt || `${activeTopic} slide ${idx + 1} visual`,
            designNotes: s.designNotes || '',
          }))
        );
        setActiveSlideIdx(0);
      }

      setFeedback({
        type: 'success',
        message: 'Carousel slides & caption generated via Gemini! Attach or generate slide images below.',
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Carousel generation error.' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateSlideImage = async (idx: number) => {
    const slide = slides[idx];
    if (!slide) return;
    setGeneratingSlideIdx(idx);
    setFeedback(null);

    try {
      const res = await generateAIImage({
        prompt: `${slide.visualPrompt || slide.headline}. Instagram carousel slide graphic, clean layout, bold typography focus.`,
        aspectRatio: '3:4',
        style: 'Modern Editorial Instagram Carousel',
      });
      if (res.success && res.imageUrl) {
        setSlides((prev) =>
          prev.map((s, i) => (i === idx ? { ...s, imageUrl: res.imageUrl } : s))
        );
        loadLibrary();
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Image generation model unavailable for this slide. Upload or pick from Media Library.',
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Image generation failed.' });
    } finally {
      setGeneratingSlideIdx(null);
    }
  };

  const handleSlideUpload = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await uploadMedia(file);
      if (res.success && res.file) {
        setSlides((prev) =>
          prev.map((s, i) => (i === idx ? { ...s, imageUrl: res.file.url } : s))
        );
        loadLibrary();
      } else {
        setFeedback({ type: 'error', message: res.error || 'Upload failed' });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Upload failed' });
    }
  };

  const addSlide = () => {
    if (slides.length >= 10) return;
    const nextNum = slides.length + 1;
    setSlides((prev) => [
      ...prev,
      {
        slideNumber: nextNum,
        headline: `Slide ${nextNum}`,
        bodyText: '',
        visualPrompt: `${topic || 'Instagram carousel'} slide ${nextNum} graphic`,
      },
    ]);
    setActiveSlideIdx(slides.length);
  };

  const removeSlide = (idx: number) => {
    if (slides.length <= 2) {
      setFeedback({ type: 'error', message: 'Instagram Carousels require at least 2 slides.' });
      return;
    }
    const next = slides
      .filter((_, i) => i !== idx)
      .map((s, i) => ({ ...s, slideNumber: i + 1 }));
    setSlides(next);
    setActiveSlideIdx(Math.min(activeSlideIdx, next.length - 1));
  };

  const attachedMediaUrls = slides
    .map((s) => s.imageUrl)
    .filter((u): u is string => Boolean(u && u.trim()));

  const handleSaveCarousel = async (targetStatus: 'draft' | 'awaiting_approval' | 'scheduled') => {
    if (!user) return;
    if (targetStatus === 'scheduled' && (!scheduleDate || attachedMediaUrls.length < 2)) {
      setFeedback({
        type: 'error',
        message: 'Scheduling an Instagram Carousel requires a date/time and at least 2 slide images.',
      });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const scheduledIso = scheduleDate
        ? new Date(`${scheduleDate}T${scheduleTime || '18:00'}`).toISOString()
        : '';

      const payload: Omit<Post, 'id'> = {
        userId: user.uid,
        title: title || topic || 'Instagram Carousel',
        topic,
        format: 'carousel',
        status: targetStatus,
        caption,
        hashtags,
        carouselSlides: JSON.stringify(slides),
        mediaUrl: attachedMediaUrls[0] || '',
        mediaUrls: attachedMediaUrls,
        mediaType: 'image',
        scheduledTime: scheduledIso,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await addDoc(collection(db, 'posts'), payload);
      if (targetStatus === 'scheduled') {
        triggerSchedulerTick().catch(() => {});
      }
      setFeedback({
        type: 'success',
        message: `Carousel saved as ${targetStatus.replace('_', ' ')}!`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed saving carousel.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishCarousel = async () => {
    setConfirmPublish(false);
    if (!isPubloraConnected) {
      setFeedback({
        type: 'error',
        message: 'Connect your Instagram account via Publora before publishing.',
      });
      return;
    }
    if (attachedMediaUrls.length < 2 || attachedMediaUrls.length > 10) {
      setFeedback({
        type: 'error',
        message: `Instagram Carousels require 2 to 10 attached slide images (currently ${attachedMediaUrls.length}).`,
      });
      return;
    }

    setIsPublishing(true);
    setFeedback(null);

    try {
      const res = await publishPostViaPublora({
        caption,
        hashtags,
        mediaUrls: attachedMediaUrls,
        format: 'carousel',
        platformId: instagramAccount?.platformId,
        publishNow: true,
      });

      if (!res.success) {
        setFeedback({ type: 'error', message: res.error || 'Publora rejected carousel publish.' });
        return;
      }

      if (user) {
        await addDoc(collection(db, 'posts'), {
          userId: user.uid,
          title: title || topic || 'Instagram Carousel',
          topic,
          format: 'carousel',
          status: 'published',
          caption,
          hashtags,
          carouselSlides: JSON.stringify(slides),
          mediaUrl: attachedMediaUrls[0],
          mediaUrls: attachedMediaUrls,
          mediaType: 'image',
          publoraPostId: res.postGroupId || res.data?.postGroupId || 'live-submission',
          publishedTime: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      setFeedback({
        type: 'success',
        message: `Carousel submitted to Instagram via Publora! (ID: ${res.postGroupId || 'queued'})`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Publishing failed.' });
    } finally {
      setIsPublishing(false);
    }
  };

  const currentSlide = slides[activeSlideIdx] || slides[0];

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      {/* Header + Generator Bar */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-fuchsia-500/10 text-fuchsia-400 flex items-center justify-center border border-fuchsia-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Instagram Carousel Creator (2–10 Slides)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Generate educational multi-slide decks with Gemini, attach slide visuals, and publish to Instagram.
              </p>
            </div>
          </div>

          <span className="text-xs px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-semibold self-start">
            {attachedMediaUrls.length} / {slides.length} Slide Images Ready
          </span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            runGenerateCarousel();
          }}
          className="grid grid-cols-1 sm:grid-cols-12 gap-3"
        >
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. 7 Python programming shortcuts every beginner should learn..."
            className="sm:col-span-6 px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white"
          />
          <input
            type="text"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="Tone"
            className="sm:col-span-2 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
          />
          <input
            type="text"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            placeholder="Language"
            className="sm:col-span-2 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={isGenerating || !topic.trim()}
            className="sm:col-span-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'Generating...' : 'AI Generate'}</span>
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

      {/* Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Slide List + Active Slide Editor (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {slides.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveSlideIdx(idx)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1.5 transition ${
                      activeSlideIdx === idx
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-950 text-slate-500 hover:text-white border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <span>Slide {idx + 1}</span>
                    {s.imageUrl && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={addSlide}
                disabled={slides.length >= 10}
                className="px-2.5 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-semibold flex items-center gap-1 shrink-0 disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Slide</span>
              </button>
            </div>

            {currentSlide && (
              <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                    Editing Slide {activeSlideIdx + 1} of {slides.length}
                  </span>
                  {slides.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeSlide(activeSlideIdx)}
                      className="text-xs text-rose-400 hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove Slide</span>
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Slide Headline
                  </label>
                  <input
                    type="text"
                    value={currentSlide.headline}
                    onChange={(e) =>
                      setSlides((prev) =>
                        prev.map((s, i) => (i === activeSlideIdx ? { ...s, headline: e.target.value } : s))
                      )
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Slide Copy / Value Text
                  </label>
                  <textarea
                    rows={3}
                    value={currentSlide.bodyText}
                    onChange={(e) =>
                      setSlides((prev) =>
                        prev.map((s, i) => (i === activeSlideIdx ? { ...s, bodyText: e.target.value } : s))
                      )
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Visual Art Prompt (for AI Slide Image)
                  </label>
                  <input
                    type="text"
                    value={currentSlide.visualPrompt}
                    onChange={(e) =>
                      setSlides((prev) =>
                        prev.map((s, i) =>
                          i === activeSlideIdx ? { ...s, visualPrompt: e.target.value } : s
                        )
                      )
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleGenerateSlideImage(activeSlideIdx)}
                    disabled={generatingSlideIdx === activeSlideIdx}
                    className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${generatingSlideIdx === activeSlideIdx ? 'animate-spin' : ''}`} />
                    <span>
                      {generatingSlideIdx === activeSlideIdx ? 'Generating Slide Art...' : 'Generate AI Slide Image'}
                    </span>
                  </button>

                  <label className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold cursor-pointer flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleSlideUpload(activeSlideIdx, e)}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowLibraryPicker(!showLibraryPicker)}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Pick from Library</span>
                  </button>
                </div>

                {showLibraryPicker && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                    <p className="text-[11px] font-semibold text-slate-400">
                      Click an image to assign it to Slide {activeSlideIdx + 1}:
                    </p>
                    {libraryImages.length === 0 ? (
                      <p className="text-[11px] text-slate-500">No images in Media Library yet.</p>
                    ) : (
                      <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                        {libraryImages.map((img) => (
                          <button
                            key={img.url}
                            type="button"
                            onClick={() => {
                              setSlides((prev) =>
                                prev.map((s, i) =>
                                  i === activeSlideIdx ? { ...s, imageUrl: img.url } : s
                                )
                              );
                              setShowLibraryPicker(false);
                            }}
                            className="aspect-square rounded-lg overflow-hidden border border-slate-700 hover:border-purple-500 transition"
                          >
                            <img src={img.url} alt={img.filename} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Carousel Caption & Hashtags */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-purple-400">
              Carousel Caption & Hashtags
            </label>
            <textarea
              rows={4}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write your carousel caption..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
            />
            <input
              type="text"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#python #coding #instagram..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-indigo-400"
            />
          </div>
        </div>

        {/* Right 5 Cols: Swipeable Preview + Publish Controls */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                Interactive Slide Preview
              </span>
              <span className="text-[11px] text-slate-400">
                {activeSlideIdx + 1} / {slides.length}
              </span>
            </div>

            <div className="relative aspect-4/5 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex flex-col justify-between">
              {currentSlide?.imageUrl ? (
                <img
                  src={currentSlide.imageUrl}
                  alt={currentSlide.headline}
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-purple-950 via-slate-950 to-indigo-950" />
              )}

              <div className="relative z-10 p-5 bg-gradient-to-b from-black/70 via-black/30 to-transparent">
                <span className="text-[10px] font-mono uppercase text-purple-300">
                  Slide {activeSlideIdx + 1}
                </span>
                <h4 className="text-lg font-extrabold text-white mt-1 leading-snug">
                  {currentSlide?.headline}
                </h4>
              </div>

              <div className="relative z-10 p-5 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
                <p className="text-xs text-slate-200 leading-relaxed">{currentSlide?.bodyText}</p>
              </div>

              {/* Left / Right arrows */}
              <button
                type="button"
                onClick={() => setActiveSlideIdx((i) => Math.max(0, i - 1))}
                disabled={activeSlideIdx === 0}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-full bg-black/60 text-white disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setActiveSlideIdx((i) => Math.min(slides.length - 1, i + 1))}
                disabled={activeSlideIdx === slides.length - 1}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-full bg-black/60 text-white disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Save / Schedule / Publish Controls */}
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveCarousel('draft')}
                  disabled={isSaving}
                  className="py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Draft</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveCarousel('awaiting_approval')}
                  disabled={isSaving}
                  className="py-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-semibold"
                >
                  Send to Review
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

              <button
                type="button"
                onClick={() => handleSaveCarousel('scheduled')}
                disabled={isSaving || !scheduleDate}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Schedule Carousel</span>
              </button>

              {confirmPublish ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 text-xs">
                  <p className="font-semibold text-amber-300">
                    Confirm live Instagram Carousel publish to @{instagramAccount?.username || 'account'}?
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
                      onClick={handlePublishCarousel}
                      className="flex-1 py-1.5 rounded-lg bg-emerald-600 text-white font-bold"
                    >
                      Yes, Publish Now
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmPublish(true)}
                  disabled={isPublishing}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isPublishing ? 'Publishing...' : 'Publish Carousel via Publora'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
