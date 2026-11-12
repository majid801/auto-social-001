import React, { useState } from 'react';
import {
  Sparkles,
  Download,
  FolderPlus,
  RefreshCw,
  AlertTriangle,
  Upload,
  Layers,
  Image as ImageIcon,
  Check,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { generateAIImage, uploadMedia } from '../../services/api';
import { NavTab } from '../Sidebar';

interface ImageGeneratorViewProps {
  onNavigate: (tab: NavTab) => void;
}

export const ImageGeneratorView: React.FC<ImageGeneratorViewProps> = ({ onNavigate }) => {
  const { user } = useAuth();

  const [prompt, setPrompt] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '4:5' | '9:16' | '16:9'>('1:1');
  const [stylePreset, setStylePreset] = useState<string>('Modern Dark Purple AI Aesthetic');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<any>(null);
  const [savedToLibrary, setSavedToLibrary] = useState<boolean>(false);

  // History list of generated images during session
  const [history, setHistory] = useState<Array<{ url: string; prompt: string; ratio: string; date: string }>>([]);

  const stylePresets = [
    'Modern Dark Purple AI Aesthetic',
    'Minimalist Tech & Clean Gradient',
    'Vibrant Instagram Creator Glow',
    'Cyberpunk Futuristic Neon',
    'Luxury Editorial & High Contrast',
    '3D Isometric Illustration',
  ];

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setStatusMessage('Contacting Gemini Image Generation Model...');
    setErrorDetails(null);
    setSavedToLibrary(false);

    try {
      const result = await generateAIImage({
        prompt,
        aspectRatio,
        style: stylePreset,
      });

      if (result.success && result.imageUrl) {
        setCurrentImage(result.imageUrl);
        setStatusMessage('Image generated successfully!');
        setHistory((prev) => [
          { url: result.imageUrl, prompt, ratio: aspectRatio, date: new Date().toLocaleTimeString() },
          ...prev,
        ]);

        // Auto record in Firestore media library if logged in
        if (user) {
          try {
            await addDoc(collection(db, 'media'), {
              userId: user.uid,
              name: `AI: ${prompt.slice(0, 40)}`,
              url: result.imageUrl,
              mediaType: 'image',
              dimensions: aspectRatio,
              source: 'ai_generated',
              createdAt: new Date().toISOString(),
            });
            setSavedToLibrary(true);
          } catch (err) {
            console.error('Error auto-saving image to library:', err);
          }
        }
      } else {
        setErrorDetails(result);
      }
    } catch (err: any) {
      setErrorDetails({ error: err.message || 'Generation failed' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleManualUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await uploadMedia(file);
      if (res.success && res.file) {
        setCurrentImage(res.file.url);
        setStatusMessage('Uploaded image selected successfully.');
        setErrorDetails(null);
      }
    } catch (err: any) {
      setErrorDetails({ error: err.message });
    }
  };

  const handleSaveToMediaLibrary = async () => {
    if (!user || !currentImage) return;
    try {
      await addDoc(collection(db, 'media'), {
        userId: user.uid,
        name: `AI: ${prompt.slice(0, 40) || 'Design'}`,
        url: currentImage,
        mediaType: 'image',
        dimensions: aspectRatio,
        source: 'ai_generated',
        createdAt: new Date().toISOString(),
      });
      setSavedToLibrary(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'media');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-12">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-pink-500/10 text-pink-500 flex items-center justify-center border border-pink-500/20">
            <ImageIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Instagram AI Image Generator
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Generate custom feed graphics, carousels, and story covers tailored to Instagram aspect ratios.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: 5 Cols */}
        <div className="lg:col-span-5 space-y-5">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Natural Language Image Prompt
                </label>
                <textarea
                  rows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. Create a premium Instagram design about AI engineering with a modern dark purple background, holographic neural networks, and neon violet typography..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-hidden focus:border-purple-500 transition resize-none leading-relaxed"
                />
              </div>

              {/* Aspect Ratio Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Instagram Dimensions & Aspect Ratio
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: '1:1', label: '1:1 Square', sub: '1080x1080 Feed' },
                    { id: '4:5', label: '4:5 Portrait', sub: '1080x1350 Feed' },
                    { id: '9:16', label: '9:16 Story/Reel', sub: '1080x1920 Full' },
                    { id: '16:9', label: '16:9 Landscape', sub: '1920x1080 Banner' },
                  ].map((ratio) => (
                    <button
                      key={ratio.id}
                      type="button"
                      onClick={() => setAspectRatio(ratio.id as any)}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        aspectRatio === ratio.id
                          ? 'bg-purple-500/10 border-purple-500 text-purple-400 font-semibold'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                      }`}
                    >
                      <div className="font-semibold text-slate-900 dark:text-white text-xs">{ratio.label}</div>
                      <div className="text-[10px] text-slate-400">{ratio.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Style Presets */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Visual Aesthetic Preset
                </label>
                <select
                  value={stylePreset}
                  onChange={(e) => setStylePreset(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs"
                >
                  {stylePresets.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Generate button */}
              <button
                type="submit"
                disabled={isGenerating || !prompt.trim()}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-purple-600/25 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Generating Image...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Instagram Graphic</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Output Preview: 7 Cols */}
        <div className="lg:col-span-7 space-y-5">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col items-center justify-center min-h-[420px]">
            {isGenerating ? (
              <div className="p-8 text-center space-y-3 animate-pulse">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 animate-spin" />
                </div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Synthesizing Instagram Design...</h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Applying "{stylePreset}" with {aspectRatio} dimensions using Gemini Imagen.
                </p>
              </div>
            ) : currentImage ? (
              <div className="w-full space-y-4">
                <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 flex items-center justify-center max-h-[500px]">
                  <img
                    src={currentImage}
                    alt={prompt}
                    className="max-h-[500px] w-auto object-contain mx-auto"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <div className="text-xs text-slate-400 truncate max-w-xs">
                    Prompt: "{prompt}"
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveToMediaLibrary}
                      disabled={savedToLibrary}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      {savedToLibrary ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <FolderPlus className="w-3.5 h-3.5" />}
                      <span>{savedToLibrary ? 'Saved in Library' : 'Save to Library'}</span>
                    </button>

                    <a
                      href={currentImage}
                      download="instagram-ai-design.jpg"
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-purple-600/20 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  </div>
                </div>
              </div>
            ) : errorDetails ? (
              /* Honest limitation message per Part 7 requirement */
              <div className="p-6 text-center space-y-4 max-w-md">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/30">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Image Generation Model Notice
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    {errorDetails.error || 'Gemini Imagen model access requires an account quota or image model capability.'}
                  </p>
                  {errorDetails.suggestion && (
                    <p className="text-xs text-purple-400 font-medium mt-2">
                      {errorDetails.suggestion}
                    </p>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Upload Your Own Image Instead:
                  </p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer shadow-xs transition">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Image File</span>
                    <input type="file" onChange={handleManualUpload} accept="image/*" className="hidden" />
                  </label>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <ImageIcon className="w-12 h-12 mx-auto text-slate-500" />
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ready to Generate</h4>
                <p className="text-xs max-w-sm mx-auto">
                  Enter your prompt on the left to generate authentic Instagram visuals and carousel slides.
                </p>
              </div>
            )}
          </div>

          {/* Session History */}
          {history.length > 0 && (
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                Recent Generation History ({history.length})
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {history.map((h, i) => (
                  <div
                    key={i}
                    onClick={() => setCurrentImage(h.url)}
                    className="cursor-pointer group relative rounded-xl overflow-hidden aspect-square border border-slate-800 bg-black"
                  >
                    <img src={h.url} alt={h.prompt} className="w-full h-full object-cover group-hover:scale-105 transition" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition p-2 flex items-end">
                      <p className="text-[10px] text-white truncate">{h.prompt}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
