import React, { useState } from 'react';
import {
  Film,
  Sparkles,
  Music,
  Clock,
  TrendingUp,
  Upload,
  Copy,
  Check,
  Download,
  FolderPlus,
  Play,
  ArrowRight,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { generateReelVideoPlan, uploadMedia } from '../../services/api';
import { NavTab } from '../Sidebar';

interface VideoReelsStudioViewProps {
  onNavigate: (tab: NavTab) => void;
}

export const VideoReelsStudioView: React.FC<VideoReelsStudioViewProps> = ({ onNavigate }) => {
  const { user } = useAuth();

  const [topic, setTopic] = useState<string>('');
  const [duration, setDuration] = useState<string>('30s');
  const [tone, setTone] = useState<string>('Fast-paced, High-Energy, Educational');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [reelPlan, setReelPlan] = useState<any>(null);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  const handleGeneratePlan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!topic.trim()) return;

    setIsGenerating(true);
    setSavedSuccess(false);

    try {
      const res = await generateReelVideoPlan({ topic, duration, tone });
      if (res.success && res.plan) {
        setReelPlan(res.plan);
      }
    } catch (err) {
      console.error('Reel plan generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await uploadMedia(file);
      if (res.success && res.file) {
        setUploadedVideoUrl(res.file.url);
      }
    } catch (err) {
      console.error('Upload video error:', err);
    }
  };

  const handleCopyNarration = () => {
    if (!reelPlan) return;
    const text = reelPlan.audioVoiceover || reelPlan.openingHook;
    navigator.clipboard.writeText(text);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleSaveToDrafts = async () => {
    if (!user || !reelPlan) return;
    try {
      await addDoc(collection(db, 'posts'), {
        userId: user.uid,
        title: reelPlan.reelTitle || topic,
        topic,
        format: 'reel',
        status: 'draft',
        hook: reelPlan.openingHook,
        caption: reelPlan.caption || '',
        hashtags: reelPlan.hashtags || '',
        script: JSON.stringify(reelPlan.storyboard, null, 2),
        musicDescription: reelPlan.bgMusic,
        suggestedDuration: duration,
        mediaUrl: uploadedVideoUrl || '',
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
            <Film className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Instagram Reels & Video Production Studio
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              High-retention scriptwriting, scene storyboarding, voiceover narration, and asset preparation.
            </p>
          </div>
        </div>
      </div>

      {/* Top Input Form */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <form onSubmit={handleGeneratePlan} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Reel Topic & Concept
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. 5 game-changing AI productivity tools every student must know in 2026..."
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-sm focus:outline-hidden focus:border-purple-500 transition"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Target Reel Duration
              </label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
              >
                <option value="15s">15 Seconds (Rapid Viral Hook)</option>
                <option value="30s">30 Seconds (Optimal Engagement)</option>
                <option value="60s">60 Seconds (Deep Dive Value)</option>
                <option value="90s">90 Seconds (Tutorial)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Pacing & Tone
              </label>
              <input
                type="text"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isGenerating || !topic.trim()}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-purple-600/25 transition flex items-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  <span>Generating Reel Production Plan...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Reel Production Plan</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Reel Plan Workspace */}
      {reelPlan && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 8 Cols: Storyboard & Script Breakdown */}
          <div className="lg:col-span-8 space-y-5">
            {/* Hook & Retention Alert */}
            <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/30 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" /> 0-3s Viral Retention Hook
                </span>
                {reelPlan.estimatedRetentionScore && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
                    {reelPlan.estimatedRetentionScore}
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-white bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                "{reelPlan.openingHook}"
              </p>
            </div>

            {/* Scene-by-Scene Storyboard */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  <Film className="w-4 h-4 text-purple-500" />
                  Scene-by-Scene Visual & Audio Storyboard
                </h3>
                <span className="text-xs text-slate-400">Aspect Ratio: 9:16 (1080x1920)</span>
              </div>

              {Array.isArray(reelPlan.storyboard) && (
                <div className="space-y-3">
                  {reelPlan.storyboard.map((scene: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-purple-600 dark:text-purple-400">
                          Scene {idx + 1} • {scene.duration || '3-5s'}
                        </span>
                        {scene.transition && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            Transition: {scene.transition}
                          </span>
                        )}
                      </div>

                      <div className="text-slate-700 dark:text-slate-300">
                        <span className="font-semibold text-slate-400 mr-1.5">Visual Prompt:</span>
                        {scene.visualPrompt || scene.visualDescription}
                      </div>

                      <div className="text-slate-700 dark:text-slate-300">
                        <span className="font-semibold text-slate-400 mr-1.5">Voiceover Narration:</span>
                        "{scene.voiceover}"
                      </div>

                      {scene.onScreenText && (
                        <div className="text-indigo-600 dark:text-indigo-400 text-[11px] font-medium">
                          <span className="text-slate-400 mr-1">Subtitle Text:</span>
                          {scene.onScreenText}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Complete Spoken Voiceover Narration */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  Full Narration Script
                </span>
                <button
                  onClick={handleCopyNarration}
                  className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedScript ? 'Copied' : 'Copy Audio Script'}</span>
                </button>
              </div>
              <p className="text-xs text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 font-mono leading-relaxed whitespace-pre-wrap">
                {reelPlan.audioVoiceover || 'Voiceover script detailed above.'}
              </p>
            </div>
          </div>

          {/* Right 4 Cols: Video Asset Upload, Audio & Action */}
          <div className="lg:col-span-4 space-y-5">
            {/* Audio Mood Recommendation */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                <Music className="w-4 h-4" /> Background Audio Mood
              </span>
              <p className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                {reelPlan.bgMusic || 'Trending Lo-Fi or Upbeat Tech EDM (120-128 BPM)'}
              </p>
            </div>

            {/* Video File Upload & Preview */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block">
                Reel Video File
              </span>

              {uploadedVideoUrl ? (
                <div className="space-y-3">
                  <div className="rounded-xl overflow-hidden aspect-9/16 bg-black border border-slate-800 max-h-[360px] mx-auto">
                    <video src={uploadedVideoUrl} controls className="w-full h-full object-cover" />
                  </div>
                  <button
                    onClick={() => setUploadedVideoUrl(null)}
                    className="w-full py-1.5 rounded-lg bg-slate-800 text-xs text-rose-400 hover:bg-slate-700 transition"
                  >
                    Remove Video
                  </button>
                </div>
              ) : (
                <div className="p-6 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 text-center space-y-3">
                  <div className="w-10 h-10 mx-auto rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                    <Upload className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Upload Completed Reel</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">MP4, MOV (9:16 vertical)</p>
                  </div>
                  <label className="inline-block px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer shadow-xs transition">
                    <span>Select Video File</span>
                    <input type="file" onChange={handleVideoUpload} accept="video/mp4,video/quicktime,video/webm" className="hidden" />
                  </label>
                </div>
              )}

              {/* Video Generation Model Limitation Notice per Part 8 */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                <p className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-purple-400" /> Video Generation Note
                </p>
                <p className="leading-relaxed">
                  Google AI Studio runtime provides complete storyboard synthesis. Once your video is recorded or rendered, upload it directly here for automated Instagram publishing.
                </p>
              </div>

              {/* Save & Publish action buttons */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={handleSaveToDrafts}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition shadow-xs"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>{savedSuccess ? 'Saved to Drafts!' : 'Save Reel to Drafts'}</span>
                </button>

                <button
                  onClick={() => onNavigate('content-studio')}
                  className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <span>Open in Content Studio</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
