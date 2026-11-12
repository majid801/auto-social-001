import React, { useState, useEffect } from 'react';
import {
  FolderOpen,
  Upload,
  Search,
  Filter,
  Trash2,
  Download,
  Copy,
  Check,
  Eye,
  Sparkles,
  Film,
  Image as ImageIcon,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, getDocs, deleteDoc, doc, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { MediaItem } from '../../types';
import { uploadMedia, fetchMediaList, deleteMediaItem } from '../../services/api';

export const MediaLibraryView: React.FC = () => {
  const { user } = useAuth();
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video' | 'ai_generated'>('all');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadMedia();
  }, [user]);

  const loadMedia = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Fetch user records from Firestore
      const q = query(collection(db, 'media'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const dbItems = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as MediaItem[];

      // 2. Also reconcile with server physical files
      const serverRes = await fetchMediaList();
      const serverFiles = serverRes.files || [];

      // Combine ensuring no duplicates
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
            source: sf.filename.startsWith('ai-img') ? 'ai_generated' : 'uploaded',
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

    // File validation per Part 12
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'];
    if (!allowedTypes.includes(file.type)) {
      alert(`Invalid file format: ${file.type}. Please upload JPEG, PNG, WEBP, or MP4.`);
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      alert('File exceeds 50MB limit.');
      return;
    }

    setIsUploading(true);
    setUploadSuccess(null);

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
        setUploadSuccess(`"${res.file.name}" uploaded and verified!`);
        setTimeout(() => setUploadSuccess(null), 3000);
      }
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (item: MediaItem) => {
    if (!confirm(`Delete "${item.name}" from your media library?`)) return;

    try {
      if (item.id) {
        await deleteDoc(doc(db, 'media', item.id));
      }
      // Also delete file on server if local upload
      if (item.url.startsWith('/uploads/')) {
        const filename = item.url.replace('/uploads/', '');
        await deleteMediaItem(filename);
      }
      setMediaItems((prev) => prev.filter((m) => m.url !== item.url));
      if (previewItem?.url === item.url) setPreviewItem(null);
    } catch (err) {
      console.error('Delete error:', err);
    }
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

  const filteredItems = mediaItems.filter((item) => {
    if (typeFilter === 'image' && item.mediaType !== 'image') return false;
    if (typeFilter === 'video' && item.mediaType !== 'video') return false;
    if (typeFilter === 'ai_generated' && item.source !== 'ai_generated') return false;
    if (searchQuery) {
      return item.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      {/* Top Header Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Media Library & Asset Vault
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Securely stored, verified Instagram images, carousels, and vertical 9:16 videos.
            </p>
          </div>
        </div>

        <label className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-purple-600/20 cursor-pointer flex items-center gap-2 transition">
          <Upload className="w-4 h-4" />
          <span>{isUploading ? 'Uploading & Verifying...' : 'Upload Media Asset'}</span>
          <input type="file" onChange={handleFileUpload} accept="image/*,video/*" className="hidden" disabled={isUploading} />
        </label>
      </div>

      {uploadSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{uploadSuccess}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Type pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs w-full sm:w-auto">
          {[
            { id: 'all', label: `All (${mediaItems.length})` },
            { id: 'image', label: 'Images' },
            { id: 'video', label: 'Videos & Reels' },
            { id: 'ai_generated', label: 'AI Generated' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTypeFilter(tab.id as any)}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-semibold transition ${
                typeFilter === tab.id
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
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

      {/* Media Grid */}
      {filteredItems.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800">
          <FolderOpen className="w-12 h-12 mx-auto text-slate-400 mb-2" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">No media assets found</h3>
          <p className="text-xs text-slate-400 mt-1 mb-4">
            Upload images or generate high-converting designs in the AI Image Generator.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredItems.map((item, idx) => (
            <div
              key={item.id || idx}
              className="group relative rounded-2xl overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-purple-500/50 transition"
            >
              {/* Asset Display */}
              <div
                onClick={() => setPreviewItem(item)}
                className="relative aspect-square bg-slate-950 flex items-center justify-center cursor-pointer overflow-hidden"
              >
                {item.mediaType === 'video' ? (
                  <video src={item.url} className="w-full h-full object-cover" />
                ) : (
                  <img src={item.url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                )}

                {/* Badge overlay */}
                <div className="absolute top-2 left-2 flex items-center gap-1">
                  {item.source === 'ai_generated' ? (
                    <span className="px-1.5 py-0.5 rounded-md bg-purple-600/90 text-white text-[9px] font-bold flex items-center gap-1 backdrop-blur-xs">
                      <Sparkles className="w-2.5 h-2.5" /> AI
                    </span>
                  ) : item.mediaType === 'video' ? (
                    <span className="px-1.5 py-0.5 rounded-md bg-blue-600/90 text-white text-[9px] font-bold flex items-center gap-1 backdrop-blur-xs">
                      <Film className="w-2.5 h-2.5" /> Video
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[9px] font-medium backdrop-blur-xs">
                      Image
                    </span>
                  )}
                </div>

                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                  <button className="p-2 rounded-full bg-white text-slate-900 shadow-md">
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Card Footer details */}
              <div className="p-3 space-y-1">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {item.name}
                </p>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>{formatFileSize(item.sizeBytes)}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => copyUrl(item.url)}
                      className="p-1 rounded text-slate-400 hover:text-white"
                      title="Copy URL"
                    >
                      {copiedUrl === item.url ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      className="p-1 rounded text-slate-400 hover:text-rose-400"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Asset Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white truncate max-w-md">{previewItem.name}</h3>
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
                <img src={previewItem.url} alt={previewItem.name} className="max-h-[60vh] w-auto object-contain" />
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-xs text-slate-400 font-mono truncate max-w-sm">
                {previewItem.url}
              </span>

              <div className="flex items-center gap-2">
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
