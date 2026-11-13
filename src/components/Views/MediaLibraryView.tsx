import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  Upload,
  Search,
  Trash2,
  Download,
  Copy,
  Check,
  Eye,
  Sparkles,
  Film,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  PenSquare,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, getDocs, deleteDoc, doc, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { MediaItem } from '../../types';
import { uploadMedia, fetchMediaList, deleteMediaItem, renameMediaItem } from '../../services/api';
import { NavTab } from '../Sidebar';

interface MediaLibraryViewProps {
  onNavigate?: (tab: NavTab) => void;
}

export const MediaLibraryView: React.FC<MediaLibraryViewProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video' | 'ai_generated'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'largest' | 'name'>('newest');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [confirmDeleteUrl, setConfirmDeleteUrl] = useState<string | null>(null);
  const [renamingItem, setRenamingItem] = useState<MediaItem | null>(null);
  const [renameText, setRenameText] = useState<string>('');

  useEffect(() => {
    const rawCtx = sessionStorage.getItem('autosocial_command_context');
    if (rawCtx) {
      try {
        const ctx = JSON.parse(rawCtx);
        if (Date.now() - (ctx.timestamp || 0) < 30000) {
          if (ctx.searchQuery) setSearchQuery(ctx.searchQuery);
          if (ctx.command?.toLowerCase().includes('generated')) {
            setTypeFilter('ai_generated');
          }
          sessionStorage.removeItem('autosocial_command_context');
        }
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    loadMedia();
  }, [user]);

  const loadMedia = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'media'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const dbItems = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as MediaItem[];

      const serverRes = await fetchMediaList();
      const serverFiles = serverRes.files || [];

      const existingUrls = new Set(dbItems.map((i) => i.url));
      const combined = [...dbItems];

      for (const sf of serverFiles) {
        if (!existingUrls.has(sf.url)) {
          combined.push({
            userId: user.uid,
            name: sf.filename,
            url: sf.url,
            mediaType: sf.mediaType,
            sizeBytes: sf.sizeBytes,
            source: sf.filename.startsWith('ai-') ? 'ai_generated' : 'uploaded',
            createdAt: sf.createdAt,
          });
        }
      }

      setMediaItems(combined);
    } catch (err) {
      console.error('Error loading media library:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'];
    if (!allowedTypes.includes(file.type)) {
      setBanner({
        type: 'error',
        message: `Unsupported file format: ${file.type}. Upload JPEG, PNG, WEBP, or MP4.`,
      });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setBanner({ type: 'error', message: 'File exceeds 50MB limit.' });
      return;
    }

    setIsUploading(true);
    setBanner(null);

    try {
      const res = await uploadMedia(file);
      if (res.success && res.file) {
        const payload: Omit<MediaItem, 'id'> = {
          userId: user.uid,
          name: res.file.name,
          url: res.file.url,
          mediaType: res.file.mediaType,
          sizeBytes: res.file.sizeBytes,
          source: 'uploaded',
          createdAt: new Date().toISOString(),
        };

        const docRef = await addDoc(collection(db, 'media'), payload);
        setMediaItems((prev) => [{ id: docRef.id, ...payload }, ...prev]);
        setBanner({ type: 'success', message: `"${res.file.name}" uploaded and verified!` });
      } else {
        setBanner({ type: 'error', message: res.error || 'Upload failed.' });
      }
    } catch (err: any) {
      setBanner({ type: 'error', message: `Upload failed: ${err.message}` });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingItem || !renameText.trim()) return;

    try {
      let updatedUrl = renamingItem.url;
      let updatedName = renameText.trim();

      if (renamingItem.url.startsWith('/uploads/')) {
        const oldFilename = renamingItem.url.replace('/uploads/', '');
        const res = await renameMediaItem(oldFilename, updatedName);
        if (!res.success) {
          setBanner({ type: 'error', message: res.error || 'Rename failed.' });
          return;
        }
        updatedUrl = res.url;
        updatedName = res.filename;
      }

      if (renamingItem.id) {
        await updateDoc(doc(db, 'media', renamingItem.id), {
          name: updatedName,
          url: updatedUrl,
        });
      }

      setMediaItems((prev) =>
        prev.map((m) =>
          m.url === renamingItem.url ? { ...m, name: updatedName, url: updatedUrl } : m
        )
      );
      setRenamingItem(null);
      setBanner({ type: 'success', message: `Renamed asset to "${updatedName}".` });
    } catch (err: any) {
      setBanner({ type: 'error', message: err?.message || 'Rename failed.' });
    }
  };

  const handleDelete = async (item: MediaItem) => {
    setConfirmDeleteUrl(null);
    try {
      if (item.id) {
        await deleteDoc(doc(db, 'media', item.id));
      }
      if (item.url.startsWith('/uploads/')) {
        const filename = item.url.replace('/uploads/', '');
        await deleteMediaItem(filename);
      }
      setMediaItems((prev) => prev.filter((m) => m.url !== item.url));
      if (previewItem?.url === item.url) setPreviewItem(null);
      setBanner({ type: 'success', message: `Deleted "${item.name}".` });
    } catch (err: any) {
      setBanner({ type: 'error', message: err?.message || 'Delete error.' });
    }
  };

  const handleUseInComposer = (item: MediaItem) => {
    sessionStorage.setItem(
      'autosocial_composer_prefill',
      JSON.stringify({
        title: item.name,
        format: item.mediaType === 'video' ? 'reel' : 'post',
        mediaUrl: item.url,
        mediaType: item.mediaType,
      })
    );
    if (onNavigate) onNavigate('composer');
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(`${window.location.origin}${url}`);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredItems = mediaItems
    .filter((item) => {
      if (typeFilter === 'image' && item.mediaType !== 'image') return false;
      if (typeFilter === 'video' && item.mediaType !== 'video') return false;
      if (typeFilter === 'ai_generated' && item.source !== 'ai_generated') return false;
      if (searchQuery) {
        return item.name.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'oldest') return (a.createdAt || '').localeCompare(b.createdAt || '');
      if (sortBy === 'largest') return (b.sizeBytes || 0) - (a.sizeBytes || 0);
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Media Library & Asset Vault
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Search, sort, rename, preview, and attach Instagram images & 9:16 Reels clips.
            </p>
          </div>
        </div>

        <label className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold text-xs cursor-pointer flex items-center gap-2">
          <Upload className="w-4 h-4" />
          <span>{isUploading ? 'Uploading...' : 'Upload Media Asset'}</span>
          <input
            type="file"
            onChange={handleFileUpload}
            accept="image/*,video/*"
            className="hidden"
            disabled={isUploading}
          />
        </label>
      </div>

      {banner && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            banner.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}
        >
          {banner.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{banner.message}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs w-full md:w-auto">
          {[
            { id: 'all', label: `All (${mediaItems.length})` },
            { id: 'image', label: 'Images' },
            { id: 'video', label: 'Videos' },
            { id: 'ai_generated', label: 'AI Generated' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTypeFilter(tab.id as any)}
              className={`flex-1 md:flex-initial px-3 py-1.5 rounded-lg font-semibold transition ${
                typeFilter === tab.id
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-500 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200"
          >
            <option value="newest">Sort: Newest</option>
            <option value="oldest">Sort: Oldest</option>
            <option value="largest">Sort: Largest</option>
            <option value="name">Sort: Name (A–Z)</option>
          </select>

          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assets..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-10 text-center text-xs text-slate-400">Loading media vault...</div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800">
          <FolderOpen className="w-12 h-12 mx-auto text-slate-400 mb-2" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">No media assets found</h3>
          <p className="text-xs text-slate-400 mt-1">
            Upload images/videos or generate visuals in the AI Image or Video Studio.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredItems.map((item, idx) => (
            <div
              key={item.id || item.url || idx}
              className="group relative rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-purple-500/50 transition"
            >
              <div
                onClick={() => setPreviewItem(item)}
                className="relative aspect-square bg-slate-950 flex items-center justify-center cursor-pointer overflow-hidden"
              >
                {item.mediaType === 'video' ? (
                  <video src={item.url} className="w-full h-full object-cover" />
                ) : (
                  <img
                    src={item.url}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                )}

                <div className="absolute top-2 left-2">
                  {item.source === 'ai_generated' ? (
                    <span className="px-1.5 py-0.5 rounded-md bg-purple-600/90 text-white text-[9px] font-bold flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" /> AI
                    </span>
                  ) : item.mediaType === 'video' ? (
                    <span className="px-1.5 py-0.5 rounded-md bg-blue-600/90 text-white text-[9px] font-bold flex items-center gap-1">
                      <Film className="w-2.5 h-2.5" /> Video
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[9px]">
                      Image
                    </span>
                  )}
                </div>

                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <span className="p-2 rounded-full bg-white text-slate-900 shadow-md">
                    <Eye className="w-4 h-4" />
                  </span>
                </div>
              </div>

              <div className="p-3 space-y-1.5">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {item.name}
                </p>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>{formatFileSize(item.sizeBytes)}</span>
                  <div className="flex items-center gap-1">
                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => handleUseInComposer(item)}
                        className="p-1 text-emerald-400 hover:text-emerald-300"
                        title="Use in Post Composer"
                      >
                        <PenSquare className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingItem(item);
                        setRenameText(item.name);
                      }}
                      className="p-1 text-slate-400 hover:text-white"
                      title="Rename"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => copyUrl(item.url)}
                      className="p-1 text-slate-400 hover:text-white"
                      title="Copy URL"
                    >
                      {copiedUrl === item.url ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                    {confirmDeleteUrl === item.url ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        className="px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-bold"
                      >
                        Del
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteUrl(item.url)}
                        className="p-1 text-slate-400 hover:text-rose-400"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rename Modal */}
      {renamingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <form
            onSubmit={handleRenameSubmit}
            className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-5 space-y-4 text-xs"
          >
            <h3 className="text-sm font-bold text-white">Rename Media Asset</h3>
            <input
              type="text"
              required
              value={renameText}
              onChange={(e) => setRenameText(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRenamingItem(null)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-purple-600 text-white font-semibold"
              >
                Save Name
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white truncate max-w-md">
                  {previewItem.name}
                </h3>
                <p className="text-xs text-slate-400">
                  {previewItem.mediaType} • {formatFileSize(previewItem.sizeBytes)}
                </p>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-2xl overflow-hidden bg-black max-h-[60vh] flex items-center justify-center border border-slate-800">
              {previewItem.mediaType === 'video' ? (
                <video src={previewItem.url} controls autoPlay className="max-h-[60vh] w-auto" />
              ) : (
                <img
                  src={previewItem.url}
                  alt={previewItem.name}
                  className="max-h-[60vh] w-auto object-contain"
                />
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => handleUseInComposer(previewItem)}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <PenSquare className="w-3.5 h-3.5" />
                  <span>Use in Post Composer</span>
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => copyUrl(previewItem.url)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Link</span>
                </button>
                <a
                  href={previewItem.url}
                  download={previewItem.name}
                  className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
