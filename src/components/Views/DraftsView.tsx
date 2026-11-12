import React, { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle2,
  Clock,
  Trash2,
  Copy,
  Eye,
  Send,
  Edit3,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, getDocs, updateDoc, deleteDoc, doc, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Post, PostStatus } from '../../types';
import { publishPostViaPublora } from '../../services/api';
import { PostPreviewModal } from '../PostPreviewModal';
import { NavTab } from '../Sidebar';

interface DraftsViewProps {
  onNavigate: (tab: NavTab) => void;
  isPubloraConnected: boolean;
  instagramAccount: any;
}

export const DraftsView: React.FC<DraftsViewProps> = ({
  onNavigate,
  isPubloraConnected,
  instagramAccount,
}) => {
  const { user } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'awaiting_approval' | 'approved'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Editing state
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editCaption, setEditCaption] = useState<string>('');
  const [editHashtags, setEditHashtags] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // Preview state
  const [previewPost, setPreviewPost] = useState<Post | null>(null);

  // Publishing feedback
  const [publishingId, setPublishingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadDrafts();
  }, [user]);

  const loadDrafts = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'posts'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Post[];
      setPosts(items.filter((p) => ['draft', 'awaiting_approval', 'approved'].includes(p.status)));
    } catch (err) {
      console.error('Error loading drafts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (post: Post) => {
    if (!post.id) return;
    try {
      await updateDoc(doc(db, 'posts', post.id), {
        status: 'approved',
        updatedAt: new Date().toISOString(),
      });
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, status: 'approved' } : p))
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posts/${post.id}`);
    }
  };

  const handlePublishPost = async (post: Post) => {
    if (!isPubloraConnected || !post.id) return;
    setPublishingId(post.id);

    try {
      const res = await publishPostViaPublora({
        caption: `${post.caption}\n\n${post.hashtags}`,
        mediaUrl: post.mediaUrl || '',
        platform: 'instagram',
        title: post.title,
      });

      if (res.success) {
        await updateDoc(doc(db, 'posts', post.id), {
          status: 'published',
          publoraPostId: res.data?.id || 'live-submission',
          publishedTime: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        setPosts((prev) => prev.filter((p) => p.id !== post.id));
      } else {
        alert(`Publishing failed: ${res.error || 'Provider rejected request'}`);
      }
    } catch (err: any) {
      alert(`Publish error: ${err.message}`);
    } finally {
      setPublishingId(null);
    }
  };

  const handleDuplicate = async (post: Post) => {
    if (!user) return;
    try {
      const payload: Omit<Post, 'id'> = {
        ...post,
        title: `${post.title} (Copy)`,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const newDoc = await addDoc(collection(db, 'posts'), payload);
      setPosts((prev) => [{ id: newDoc.id, ...payload }, ...prev]);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'posts');
    }
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this draft?')) return;
    try {
      await deleteDoc(doc(db, 'posts', postId));
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `posts/${postId}`);
    }
  };

  const openEditor = (post: Post) => {
    setEditingPost(post);
    setEditCaption(post.caption || '');
    setEditHashtags(post.hashtags || '');
  };

  const saveEdit = async () => {
    if (!editingPost?.id) return;
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, 'posts', editingPost.id), {
        caption: editCaption,
        hashtags: editHashtags,
        updatedAt: new Date().toISOString(),
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === editingPost.id
            ? { ...p, caption: editCaption, hashtags: editHashtags }
            : p
        )
      );
      setEditingPost(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posts/${editingPost.id}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const filtered = posts.filter((p) => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.caption.toLowerCase().includes(q) ||
        (p.hashtags && p.hashtags.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      {/* Top Controls */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-500" />
            Instagram Content Drafts & Approval Pipeline
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Review, refine captions, and approve content before automatic publishing.
          </p>
        </div>

        <button
          onClick={() => onNavigate('content-studio')}
          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Content Draft</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs w-full sm:w-auto">
          {[
            { id: 'all', label: 'All Saved' },
            { id: 'draft', label: 'Drafts' },
            { id: 'awaiting_approval', label: 'Awaiting Approval' },
            { id: 'approved', label: 'Approved' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg font-semibold transition ${
                statusFilter === tab.id
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
            placeholder="Search by topic or caption..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Drafts List */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800">
          <FileText className="w-12 h-12 mx-auto text-slate-400 mb-2" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">No drafts found</h3>
          <p className="text-xs text-slate-400 mt-1 mb-4">
            Create your first Instagram package in the Content Studio.
          </p>
          <button
            onClick={() => onNavigate('content-studio')}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-xs"
          >
            Open Content Studio
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((post) => (
            <div
              key={post.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4 hover:border-purple-500/40 transition"
            >
              <div className="space-y-3">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    {post.format}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                      post.status === 'approved'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : post.status === 'awaiting_approval'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                    }`}
                  >
                    {post.status.replace('_', ' ')}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1">
                  {post.title}
                </h3>

                {post.hook && (
                  <p className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 line-clamp-1 bg-purple-50 dark:bg-purple-950/40 p-2 rounded-lg">
                    {post.hook}
                  </p>
                )}

                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                  {post.caption}
                </p>

                {post.hashtags && (
                  <p className="text-[10px] text-indigo-400 line-clamp-1 font-medium">
                    {post.hashtags}
                  </p>
                )}
              </div>

              {/* Action buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPreviewPost(post)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    title="Preview in Feed"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEditor(post)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    title="Quick Edit"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDuplicate(post)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    title="Duplicate Draft"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  {post.id && (
                    <button
                      onClick={() => handleDelete(post.id!)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      title="Delete Draft"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {post.status !== 'approved' && (
                    <button
                      onClick={() => handleApprove(post)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold flex items-center gap-1 transition"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                  )}

                  {post.status === 'approved' && (
                    <button
                      onClick={() => handlePublishPost(post)}
                      disabled={publishingId === post.id}
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold flex items-center gap-1 transition disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{publishingId === post.id ? 'Publishing...' : 'Publish'}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Edit Modal */}
      {editingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Edit Draft: {editingPost.title}
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Caption</label>
              <textarea
                rows={6}
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Hashtags</label>
              <textarea
                rows={2}
                value={editHashtags}
                onChange={(e) => setEditHashtags(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingPost(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={isUpdating}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
              >
                {isUpdating ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <PostPreviewModal
        post={previewPost}
        isOpen={Boolean(previewPost)}
        onClose={() => setPreviewPost(null)}
        username={instagramAccount?.username || 'autosocial_creator'}
        userAvatar={instagramAccount?.profile_picture || instagramAccount?.profilePictureUrl}
      />
    </div>
  );
};
