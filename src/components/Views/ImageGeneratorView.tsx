import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Download,
  FolderPlus,
  RefreshCw,
  AlertTriangle,
  Upload,
  Image as ImageIcon,
  Check,
  PenSquare,
  FolderOpen,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { generateAIImage, fetchGeminiModels, uploadMedia, fetchMediaList } from '../../services/api';
import { NavTab } from '../Sidebar';

interface ImageGeneratorViewProps {
  onNavigate: (tab: NavTab) => void;
}

export const ImageGeneratorView: React.FC<ImageGeneratorViewProps> = ({ onNavigate }) => {
  const { user } = useAuth();

  const [prompt, setPrompt] = useState<string>('');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '4:5' | '9:16' | '16:9'>('1:1');
  const [stylePreset, setStylePreset] = useState<string>('Modern Dark Purple AI Aesthetic');
  const [quality, setQuality] = useState<'standard' | 'hd'>('standard');
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.1-flash-lite-image');
  const [availableModels, setAvailableModels] = useState<string[]>([
    'gemini-3.1-flash-lite-image',
    'gemini-nano-banana-2.1',
    'gemini-2.5-flash-image',
    'gemini-3.1-flash-image',
    'gemini-3-pro-image',
  ]);
  const [imageSize, setImageSize] = useState<'1K' | '2K'>('1K');
  const [variations, setVariations] = useState<number>(1);
  const [referenceImageUrl, setReferenceImageUrl] = useState<string>('');
  const [libraryImages, setLibraryImages] = useState<any[]>([]);
  const [showRefPicker, setShowRefPicker] = useState<boolean>(false);

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedImages, setGeneratedImages] = useState<Array<{ imageUrl: string; filename?: string }>>([]);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<any>(null);
  const [savedToLibrary, setSavedToLibrary] = useState<boolean>(false);
  const [history, setHistory] = useState<Array<{ url: string; prompt: string; ratio: string; date: string }>>([]);

  const stylePresets = [
    'Modern Dark Purple AI Aesthetic',
    'Minimalist Tech & Clean Gradient',
    'Vibrant Instagram Creator Glow',
    'Cyberpunk Futuristic Neon',
    'Luxury Editorial & High Contrast',
    '3D Isometric Illustration',
  ];

  useEffect(() => {
    loadLibrary();
    loadModels();
    const rawCtx = sessionStorage.getItem('autosocial_command_context');
    if (rawCtx) {
      try {
        const ctx = JSON.parse(rawCtx);
        if (ctx.topic && Date.now() - (ctx.timestamp || 0) < 30000) {
          setPrompt(ctx.topic);
          if (['1:1', '4:5', '9:16', '16:9'].includes(ctx.aspectRatio)) {
            setAspectRatio(ctx.aspectRatio);
          }
          sessionStorage.removeItem('autosocial_command_context');
          if (ctx.autoRun) {
            runGenerateImage(ctx.topic);
          }
        }
      } catch {
        // ignore
      }
    }
  }, []);

  const loadModels = async () => {
    try {
      const res = await fetchGeminiModels();
      if (res?.success && Array.isArray(res.imageModels)) {
        const verified = res.imageModels
          .map((m: any) => m.id)
          .filter((id: string) => !id.endsWith('-preview'));
        if (verified.length > 0) {
          setAvailableModels(verified);
        }
      }
    } catch {
      // keep verified defaults
    }
  };

  const loadLibrary = async () => {
    try {
      const res = await fetchMediaList();
      setLibraryImages((res.files || []).filter((f: any) => f.mediaType === 'image'));
    } catch {
      // ignore
    }
  };

  const runGenerateImage = async (overridePrompt?: string) => {
    const activePrompt = (overridePrompt ?? prompt).trim();
    if (!activePrompt) return;

    setIsGenerating(true);
    setErrorDetails(null);
    setSavedToLibrary(false);

    try {
      const result = await generateAIImage({
        prompt: activePrompt,
        aspectRatio,
        style: stylePreset,
        quality,
        model: selectedModel,
        imageSize,
        variations,
        referenceImageUrl: referenceImageUrl || undefined,
      });

      if (result.success && result.imageUrl) {
        const imgs = Array.isArray(result.images) && result.images.length > 0
          ? result.images
          : [{ imageUrl: result.imageUrl }];
        setGeneratedImages(imgs);
        setCurrentImage(imgs[0].imageUrl);
        setHistory((prev) => [
          ...imgs.map((img: any) => ({
            url: img.imageUrl,
            prompt: activePrompt,
            ratio: aspectRatio,
            date: new Date().toLocaleTimeString(),
          })),
          ...prev,
        ]);

        if (user) {
          for (const img of imgs) {
            try {
              await addDoc(collection(db, 'media'), {
                userId: user.uid,
                name: `AI: ${activePrompt.slice(0, 40)}`,
                url: img.imageUrl,
                mediaType: 'image',
                dimensions: aspectRatio,
                source: 'ai_generated',
                createdAt: new Date().toISOString(),
              });
            } catch {
              // ignore individual auto-save error
            }
          }
          setSavedToLibrary(true);
        }
        loadLibrary();
      } else {
        setErrorDetails(result);
      }
    } catch (err: any) {
      setErrorDetails({ error: err?.message || 'Generation failed' });
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
        setGeneratedImages([{ imageUrl: res.file.url }]);
        setErrorDetails(null);
        loadLibrary();
      } else {
        setErrorDetails({ error: res.error || 'Upload failed' });
      }
    } catch (err: any) {
      setErrorDetails({ error: err?.message || 'Upload failed' });
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

  const handleUseInComposer = () => {
    if (!currentImage) return;
    sessionStorage.setItem(
      'autosocial_composer_prefill',
      JSON.stringify({
        title: prompt.slice(0, 60) || 'AI Visual Post',
        topic: prompt,
        format: aspectRatio === '9:16' ? 'story' : 'post',
        mediaUrl: currentImage,
        mediaType: 'image',
      })
    );
    onNavigate('composer');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto animate-fade-in pb-12">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-pink-500/10 text-pink-500 flex items-center justify-center border border-pink-500/20">
            <ImageIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Instagram AI Image Generator
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Powered by Gemini 3.1 Flash Lite Image & Nano Banana 2.1 (HD) with multi-variation & reference image editing.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: 5 Cols */}
        <div className="lg:col-span-5 space-y-5">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                runGenerateImage();
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Natural Language Image Prompt
                </label>
                <textarea
                  rows={4}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. Generate an editorial Instagram visual about machine learning with glowing violet neural architecture on deep obsidian..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-hidden focus:border-purple-500 transition resize-none leading-relaxed"
                />
              </div>

              {/* Model & Variations */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-400 mb-1">Verified Gemini Model</label>
                  <select
                    value={selectedModel}
                    onChange={(e) => {
                      const nextModel = e.target.value;
                      setSelectedModel(nextModel);
                      setQuality(
                        nextModel === 'gemini-nano-banana-2.1' ||
                          nextModel === 'gemini-3-pro-image' ||
                          nextModel === 'gemini-3.1-flash-image'
                          ? 'hd'
                          : 'standard'
                      );
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  >
                    {availableModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-400 mb-1">Variations (1–3)</label>
                  <select
                    value={variations}
                    onChange={(e) => setVariations(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value={1}>1 Image</option>
                    <option value={2}>2 Variations</option>
                    <option value={3}>3 Variations</option>
                  </select>
                </div>
              </div>

              {quality === 'hd' && (
                <div className="text-xs">
                  <label className="block font-semibold text-slate-400 mb-1">HD Resolution</label>
                  <div className="flex gap-2">
                    {(['1K', '2K'] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => setImageSize(sz)}
                        className={`flex-1 py-1.5 rounded-lg border font-semibold ${
                          imageSize === sz
                            ? 'bg-purple-600 text-white border-purple-500'
                            : 'bg-slate-950 text-slate-400 border-slate-800'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Aspect Ratio Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Instagram Aspect Ratio
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: '1:1', label: '1:1 Square', sub: '1080x1080 Feed' },
                    { id: '4:5', label: '4:5 Portrait', sub: 'Feed Portrait' },
                    { id: '9:16', label: '9:16 Story/Reel', sub: '1080x1920 Full' },
                    { id: '16:9', label: '16:9 Landscape', sub: '1920x1080 Wide' },
                  ].map((ratio) => (
                    <button
                      key={ratio.id}
                      type="button"
                      onClick={() => setAspectRatio(ratio.id as any)}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        aspectRatio === ratio.id
                          ? 'bg-purple-500/10 border-purple-500 text-purple-400 font-semibold'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div className="font-semibold text-slate-900 dark:text-white text-xs">
                        {ratio.label}
                      </div>
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
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Optional Reference Image for Image-to-Image Edit */}
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-400">
                    Reference Image (Optional Edit)
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowRefPicker(!showRefPicker)}
                    className="text-purple-400 hover:underline flex items-center gap-1"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>{referenceImageUrl ? 'Change' : 'Pick from Library'}</span>
                  </button>
                </div>
                {referenceImageUrl && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="truncate text-[11px] text-slate-300">{referenceImageUrl}</span>
                    <button
                      type="button"
                      onClick={() => setReferenceImageUrl('')}
                      className="text-[11px] text-rose-400 ml-2"
                    >
                      Clear
                    </button>
                  </div>
                )}
                {showRefPicker && (
                  <div className="grid grid-cols-4 gap-2 p-2 rounded-xl bg-slate-950 border border-slate-800 max-h-32 overflow-y-auto">
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
              </div>

              <button
                type="submit"
                disabled={isGenerating || !prompt.trim()}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs sm:text-sm shadow-md shadow-purple-600/25 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Generating Image(s)...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Instagram Visual</span>
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
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Synthesizing Instagram Visual...
                </h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Running {selectedModel} with {aspectRatio} framing.
                </p>
              </div>
            ) : currentImage ? (
              <div className="w-full space-y-4">
                <div className="relative rounded-2xl overflow-hidden bg-black border border-slate-800 flex items-center justify-center max-h-[460px]">
                  <img
                    src={currentImage}
                    alt={prompt}
                    className="max-h-[460px] w-auto object-contain mx-auto"
                  />
                </div>

                {generatedImages.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {generatedImages.map((img, i) => (
                      <button
                        key={img.imageUrl}
                        type="button"
                        onClick={() => setCurrentImage(img.imageUrl)}
                        className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 ${
                          currentImage === img.imageUrl ? 'border-purple-500' : 'border-slate-800'
                        }`}
                      >
                        <img
                          src={img.imageUrl}
                          alt={`Variation ${i + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleUseInComposer}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <PenSquare className="w-3.5 h-3.5" />
                    <span>Use in Post Composer</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveToMediaLibrary}
                      disabled={savedToLibrary}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {savedToLibrary ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <FolderPlus className="w-3.5 h-3.5" />
                      )}
                      <span>{savedToLibrary ? 'Saved to Library' : 'Save to Library'}</span>
                    </button>

                    <a
                      href={currentImage}
                      download="instagram-ai-design.png"
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  </div>
                </div>
              </div>
            ) : errorDetails ? (
              <div className="p-6 text-center space-y-4 max-w-lg">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/30">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Image Generation Unavailable ({errorDetails.errorCode || `HTTP ${errorDetails.httpStatus || 429}`})
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-300 leading-relaxed">
                    {errorDetails.error}
                  </p>
                  {(errorDetails.modelUsed || errorDetails.endpoint) && (
                    <div className="mt-2 p-2.5 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-400 text-left break-all">
                      {errorDetails.modelUsed && <div>Model: {errorDetails.modelUsed}</div>}
                      {errorDetails.endpoint && <div>Endpoint: {errorDetails.endpoint}</div>}
                    </div>
                  )}
                  {errorDetails.suggestion && (
                    <p className="text-xs text-purple-400 font-medium pt-1">
                      {errorDetails.suggestion}
                    </p>
                  )}
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Working Alternatives (Continue Workflow Immediately):
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Image File</span>
                      <input
                        type="file"
                        onChange={handleManualUpload}
                        accept="image/*"
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => onNavigate('media')}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold hover:bg-slate-300 dark:hover:bg-slate-700"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Open Media Library</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 space-y-2">
                <ImageIcon className="w-12 h-12 mx-auto text-slate-500" />
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Ready to Generate
                </h4>
                <p className="text-xs max-w-sm mx-auto">
                  Enter a prompt on the left to generate Instagram feed images, carousel graphics, or reference-edited designs.
                </p>
              </div>
            )}
          </div>

          {history.length > 0 && (
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
                Session Generation History ({history.length})
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {history.map((h, i) => (
                  <div
                    key={`${h.url}-${i}`}
                    onClick={() => setCurrentImage(h.url)}
                    className="cursor-pointer group relative rounded-xl overflow-hidden aspect-square border border-slate-800 bg-black"
                  >
                    <img
                      src={h.url}
                      alt={h.prompt}
                      className="w-full h-full object-cover group-hover:scale-105 transition"
                    />
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
