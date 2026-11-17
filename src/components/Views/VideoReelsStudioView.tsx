import React, { useState, useEffect, useRef } from 'react';
import {
  Film,
  Sparkles,
  Music,
  TrendingUp,
  Upload,
  Copy,
  Check,
  FolderPlus,
  PenSquare,
  AlertTriangle,
  RefreshCw,
  Video,
  FolderOpen,
  Download,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import {
  generateReelVideoPlan,
  generateAIVideo,
  fetchAIVideoStatus,
  uploadMedia,
  fetchMediaList,
} from '../../services/api';
import { NavTab } from '../Sidebar';

interface VideoReelsStudioViewProps {
  onNavigate: (tab: NavTab) => void;
}

export const VideoReelsStudioView: React.FC<VideoReelsStudioViewProps> = ({ onNavigate }) => {
  const { user } = useAuth();

  // Storyboard / Reel plan state
  const [topic, setTopic] = useState<string>('');
  const [duration, setDuration] = useState<string>('30s');
  const [tone, setTone] = useState<string>('Fast-paced, High-Energy, Educational');
  const [isGeneratingPlan, setIsGeneratingPlan] = useState<boolean>(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [reelPlan, setReelPlan] = useState<any>(null);

  // Lightweight FFmpeg scene-rendering state
  const [videoPrompt, setVideoPrompt] = useState<string>('');
  const [videoAspectRatio, setVideoAspectRatio] = useState<'9:16' | '16:9'>('9:16');
  const [videoDuration, setVideoDuration] = useState<'5s' | '10s' | '15s'>('10s');
  const [referenceImageUrl, setReferenceImageUrl] = useState<string>('');
  const [libraryImages, setLibraryImages] = useState<any[]>([]);
  const [showRefPicker, setShowRefPicker] = useState<boolean>(false);

  const [videoJobStatus, setVideoJobStatus] = useState<
    'idle' | 'queued' | 'processing' | 'completed' | 'failed'
  >('idle');
  const [activeInteractionId, setActiveInteractionId] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<{
    error: string;
    suggestion?: string;
    errorCode?: string;
    modelUsed?: string;
    endpoint?: string;
    interactionId?: string;
  } | null>(null);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);

  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const pollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    loadImages();

    const rawCtx = sessionStorage.getItem('autosocial_command_context');
    if (rawCtx) {
      try {
        const ctx = JSON.parse(rawCtx);
        if (ctx.topic && Date.now() - (ctx.timestamp || 0) < 30000) {
          setTopic(ctx.topic);
          setVideoPrompt(ctx.topic);
          sessionStorage.removeItem('autosocial_command_context');
          if (ctx.autoRun) {
            runGeneratePlan(ctx.topic);
          }
        }
      } catch {
        // ignore
      }
    }

    return () => {
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    };
  }, []);

  const loadImages = async () => {
    try {
      const res = await fetchMediaList();
      setLibraryImages((res.files || []).filter((f: any) => f.mediaType === 'image'));
    } catch {
      // ignore
    }
  };

  const runGeneratePlan = async (overrideTopic?: string) => {
    const activeTopic = (overrideTopic ?? topic).trim();
    if (!activeTopic) return;

    setIsGeneratingPlan(true);
    setPlanError(null);
    setSavedSuccess(false);

    try {
      const res = await generateReelVideoPlan({ topic: activeTopic, duration, tone });
      if (res.success && res.plan) {
        setReelPlan(res.plan);
        if (res.plan.videoGenPrompt && !videoPrompt) {
          setVideoPrompt(res.plan.videoGenPrompt);
        }
      } else {
        setPlanError(res.error || 'Failed to generate Reel production plan.');
      }
    } catch (err: any) {
      setPlanError(err?.message || 'Reel plan generation error.');
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleGenerateAIVideo = async () => {
    const activePrompt = (videoPrompt || reelPlan?.videoGenPrompt || topic).trim();
    if (!activePrompt) return;

    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    setVideoJobStatus('queued');
    setVideoError(null);
    setActiveInteractionId(null);

    try {
      const res = await generateAIVideo({
        prompt: activePrompt,
        aspectRatio: videoAspectRatio,
        duration: videoDuration,
        resolution: '720p',
        referenceImageUrl: referenceImageUrl || undefined,
      });

      if (res.interactionId || res.jobId) {
        setActiveInteractionId(res.interactionId || res.jobId);
      }

      if (!res.success || res.status === 'failed') {
        setVideoJobStatus('failed');
        setVideoError({
          error: res.error || 'AI Video generation request failed.',
          suggestion: res.suggestion,
          errorCode: res.errorCode,
          modelUsed: res.modelUsed,
          endpoint: res.endpoint,
          interactionId: res.interactionId,
        });
        return;
      }

      if (res.status === 'completed' && res.videoUrl) {
        await handleVideoCompleted(res.videoUrl, activePrompt);
        return;
      }

      setVideoJobStatus('processing');
      const jobId = res.jobId;
      pollTimerRef.current = window.setInterval(async () => {
        try {
          const st = await fetchAIVideoStatus(jobId);
          if (st.interactionId) {
            setActiveInteractionId(st.interactionId);
          }
          if (st.status === 'completed' && st.videoUrl) {
            if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
            await handleVideoCompleted(st.videoUrl, activePrompt);
          } else if (st.status === 'failed') {
            if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
            setVideoJobStatus('failed');
            setVideoError({
              error: st.error || 'Video generation failed.',
              suggestion: st.suggestion,
              errorCode: st.errorCode,
              modelUsed: st.modelUsed,
              endpoint: st.endpoint,
              interactionId: st.interactionId,
            });
          }
        } catch {
          // keep polling briefly
        }
      }, 3000);
    } catch (err: any) {
      setVideoJobStatus('failed');
      setVideoError({ error: err?.message || 'Video generation failed.' });
    }
  };

  const handleVideoCompleted = async (url: string, promptUsed: string) => {
    setActiveVideoUrl(url);
    setVideoJobStatus('completed');
    if (user) {
      try {
        await addDoc(collection(db, 'media'), {
          userId: user.uid,
          name: `AI Reel: ${promptUsed.slice(0, 40)}`,
          url,
          mediaType: 'video',
          dimensions: videoAspectRatio,
          source: 'ai_generated',
          createdAt: new Date().toISOString(),
        });
      } catch {
        // ignore
      }
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoError(null);
    try {
      const res = await uploadMedia(file);
      if (res.success && res.file) {
        setActiveVideoUrl(res.file.url);
        setVideoJobStatus('completed');
      } else {
        setVideoError({ error: res.error || 'Upload failed' });
      }
    } catch (err: any) {
      setVideoError({ error: err?.message || 'Upload error' });
    }
  };

  const handleSaveToDrafts = async () => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'posts'), {
        userId: user.uid,
        title: reelPlan?.reelTitle || topic || 'Instagram Reel',
        topic,
        format: 'reel',
        status: 'draft',
        hook: reelPlan?.openingHook || '',
        caption: reelPlan?.caption || videoPrompt || '',
        hashtags: reelPlan?.hashtags || '',
        script: reelPlan ? JSON.stringify(reelPlan.storyboard, null, 2) : '',
        musicDescription: reelPlan?.bgMusic || '',
        suggestedDuration: duration,
        mediaUrl: activeVideoUrl || '',
        mediaType: 'video',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'posts');
    }
  };

  const handleSendToComposer = () => {
    sessionStorage.setItem(
      'autosocial_composer_prefill',
      JSON.stringify({
        title: reelPlan?.reelTitle || topic || 'Instagram Reel',
        topic,
        format: 'reel',
        hook: reelPlan?.openingHook || '',
        caption: reelPlan?.caption || '',
        hashtags: reelPlan?.hashtags || '',
        mediaUrl: activeVideoUrl || '',
        mediaType: 'video',
      })
    );
    onNavigate('composer');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
            <Film className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Instagram Reels & AI Video Studio
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Render lightweight vertical H.264/AAC scene videos with FFmpeg, generate Reel storyboards with Gemini, or upload your own MP4 clips. This is not native text-to-video.
            </p>
          </div>
        </div>
      </div>

      {/* Real AI Video Generator Panel */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-purple-500/25 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Video className="w-4 h-4 text-pink-500" />
            FFmpeg Scene Video Renderer (H.264/AAC MP4)
          </h3>
          {videoJobStatus !== 'idle' && (
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase ${
                videoJobStatus === 'completed'
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : videoJobStatus === 'failed'
                  ? 'bg-rose-500/15 text-rose-400'
                  : 'bg-purple-500/15 text-purple-300 animate-pulse'
              }`}
            >
              Status: {videoJobStatus}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-7 space-y-3">
            <textarea
              rows={3}
              value={videoPrompt}
              onChange={(e) => setVideoPrompt(e.target.value)}
              placeholder="Describe the vertical 9:16 Reel scene to generate (e.g., Futuristic glowing workspace at dusk, smooth orbital camera motion, neon purple reflections)..."
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white resize-none"
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Aspect Ratio</label>
                <select
                  value={videoAspectRatio}
                  onChange={(e) => setVideoAspectRatio(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="9:16">9:16 Vertical Reel</option>
                  <option value="16:9">16:9 Landscape</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Clip Duration</label>
                <select
                  value={videoDuration}
                  onChange={(e) => setVideoDuration(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="5s">5 Seconds</option>
                  <option value="10s">10 Seconds</option>
                  <option value="15s">15 Seconds</option>
                </select>
              </div>
              <div className="col-span-2 sm:col-span-1 flex items-end">
                <button
                  type="button"
                  onClick={() => setShowRefPicker(!showRefPicker)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold flex items-center justify-center gap-1.5"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>{referenceImageUrl ? 'Ref Image Set' : 'Starting Image'}</span>
                </button>
              </div>
            </div>

            {showRefPicker && (
              <div className="grid grid-cols-5 gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 max-h-32 overflow-y-auto">
                {libraryImages.map((img) => (
                  <button
                    key={img.url}
                    type="button"
                    onClick={() => {
                      setReferenceImageUrl(img.url);
                      setShowRefPicker(false);
                    }}
                    className="aspect-square rounded-lg overflow-hidden border border-slate-700 hover:border-purple-500"
                  >
                    <img src={img.url} alt={img.filename} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleGenerateAIVideo}
                disabled={
                  videoJobStatus === 'queued' ||
                  videoJobStatus === 'processing' ||
                  !(videoPrompt || reelPlan?.videoGenPrompt || topic).trim()
                }
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
              >
                {videoJobStatus === 'queued' || videoJobStatus === 'processing' ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Rendering AI Video...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate AI Video Clip</span>
                  </>
                )}
              </button>

              <label className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold cursor-pointer flex items-center gap-1.5">
                <Upload className="w-4 h-4" />
                <span>Upload MP4 Video</span>
                <input
                  type="file"
                  onChange={handleVideoUpload}
                  accept="video/mp4,video/quicktime,video/webm"
                  className="hidden"
                />
              </label>
            </div>

            {activeInteractionId && videoJobStatus === 'processing' && (
              <div className="text-[11px] font-mono text-purple-300 bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-1.5 break-all">
                Polling renderer job: {activeInteractionId}
              </div>
            )}

            {videoError && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
                <p className="font-bold text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    Video Generation Notice {videoError.errorCode ? `(${videoError.errorCode})` : ''}
                  </span>
                </p>
                <p className="text-slate-200 leading-relaxed">{videoError.error}</p>
                {(videoError.modelUsed || videoError.endpoint || videoError.interactionId) && (
                  <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800 font-mono text-[11px] text-slate-400 space-y-0.5 break-all">
                    {videoError.modelUsed && <div>Model: {videoError.modelUsed}</div>}
                    {videoError.endpoint && <div>Endpoint: {videoError.endpoint}</div>}
                    {videoError.interactionId && <div>Interaction ID: {videoError.interactionId}</div>}
                  </div>
                )}
                {videoError.suggestion && (
                  <p className="text-purple-300 font-medium">{videoError.suggestion}</p>
                )}
              </div>
            )}
          </div>

          <div className="lg:col-span-5 flex flex-col items-center justify-center rounded-2xl bg-slate-950 border border-slate-800 p-4 min-h-[260px]">
            {activeVideoUrl ? (
              <div className="w-full space-y-3">
                <video
                  src={activeVideoUrl}
                  controls
                  className="w-full max-h-[300px] rounded-xl bg-black mx-auto"
                />
                <div className="flex flex-wrap gap-2 justify-between">
                  <button
                    type="button"
                    onClick={handleSendToComposer}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <PenSquare className="w-3.5 h-3.5" />
                    <span>Publish / Schedule in Composer</span>
                  </button>
                  <a
                    href={activeVideoUrl}
                    download="autosocial-reel.mp4"
                    className="px-3.5 py-2 rounded-xl bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download MP4</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="text-center text-slate-500 space-y-2">
                <Film className="w-10 h-10 mx-auto text-slate-600" />
                <p className="text-xs font-medium text-slate-400">
                  Generated or uploaded Reel MP4 will preview here
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reel Script & Storyboard Builder */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
          Reel Storyboard, Hooks & Spoken Script Planner
        </h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runGeneratePlan();
          }}
          className="space-y-4"
        >
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. 5 AI productivity tools every student must know in 2026..."
            className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-sm"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
            >
              <option value="15s">15 Seconds (Rapid Viral Hook)</option>
              <option value="30s">30 Seconds (Optimal Engagement)</option>
              <option value="60s">60 Seconds (Deep Dive Value)</option>
              <option value="90s">90 Seconds (Tutorial)</option>
            </select>

            <input
              type="text"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={isGeneratingPlan || !topic.trim()}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 text-white font-semibold text-xs sm:text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isGeneratingPlan ? 'animate-spin' : ''}`} />
            <span>{isGeneratingPlan ? 'Generating Reel Plan...' : 'Generate Reel Storyboard & Script'}</span>
          </button>
        </form>

        {planError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
            {planError}
          </div>
        )}
      </div>

      {/* Reel Plan Workspace */}
      {reelPlan && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-5">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" /> 0-3s Retention Hook
                </span>
                {reelPlan.estimatedRetentionScore && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[11px] font-semibold">
                    {reelPlan.estimatedRetentionScore}
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-white bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                "{reelPlan.openingHook}"
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Scene-by-Scene Storyboard
              </h3>
              {Array.isArray(reelPlan.storyboard) &&
                reelPlan.storyboard.map((scene: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between font-bold text-purple-400">
                      <span>
                        Scene {idx + 1} • {scene.duration || '4s'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setVideoPrompt(scene.visualPrompt || scene.visualDescription)}
                        className="text-[11px] text-pink-400 hover:underline"
                      >
                        Use Prompt in AI Video Gen
                      </button>
                    </div>
                    <p className="text-slate-300">
                      <strong>Visual:</strong> {scene.visualPrompt || scene.visualDescription}
                    </p>
                    <p className="text-slate-300">
                      <strong>Voiceover:</strong> "{scene.voiceover}"
                    </p>
                    {scene.onScreenText && (
                      <p className="text-indigo-400 text-[11px]">Subtitle: {scene.onScreenText}</p>
                    )}
                  </div>
                ))}
            </div>
          </div>

          <div className="lg:col-span-4 space-y-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <span className="text-xs font-bold uppercase text-purple-400 flex items-center gap-1.5">
                <Music className="w-4 h-4" /> Audio & Narration
              </span>
              <p className="text-xs text-slate-300">{reelPlan.bgMusic}</p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(reelPlan.audioVoiceover || reelPlan.openingHook);
                  setCopiedScript(true);
                  setTimeout(() => setCopiedScript(false), 2000);
                }}
                className="w-full py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                {copiedScript ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedScript ? 'Copied Narration' : 'Copy Full Voiceover'}</span>
              </button>

              <button
                type="button"
                onClick={handleSaveToDrafts}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <FolderPlus className="w-4 h-4" />
                <span>{savedSuccess ? 'Saved to Drafts!' : 'Save Reel to Drafts'}</span>
              </button>

              <button
                type="button"
                onClick={handleSendToComposer}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <PenSquare className="w-4 h-4" />
                <span>Send Reel to Post Composer</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
