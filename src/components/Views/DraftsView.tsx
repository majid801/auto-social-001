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
  Search,
  PenSquare,
  Calendar,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, getDocs, updateDoc, deleteDoc, doc, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Post } from '../../types';
import { publishPostViaPublora, triggerSchedulerTick } from '../../services/api';
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

  // Schedule modal state
  const [schedulingPost, setSchedulingPost] = useState<Post | null>(null);
  const [scheduleDate, setScheduleDate] = useState<string>('');
  const [scheduleTime, setScheduleTime] = useState<string>('18:30');
  const [isScheduling, setIsScheduling] = useState<boolean>(false);

  // Preview & inline confirmations
  const [previewPost, setPreviewPost] = useState<Post | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [confirmPublishId, setConfirmPublishId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() })) as Post[];
      items.sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
      setPosts(items.filter((p) => ['draft', 'awaiting_approval', 'approved'].includes(p.status)));
    } catch (err) {
      console.error('Error loading drafts:', err);
      setFeedback({ type: 'error', message: 'Failed to load drafts from Firestore.' });
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
      setFeedback({ type: 'success', message: `"${post.title}" marked as approved.` });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `posts/${post.id}`);
    }
  };

  const handlePublishPost = async (post: Post) => {
    if (!post.id) return;
    setFeedback(null);

    if (!isPubloraConnected) {
      setFeedback({
        type: 'error',
        message: 'Publora Instagram account is not connected. Open Instagram Account to verify connection.',
      });
      setConfirmPublishId(null);
      return;
    }

    const mediaUrls = post.mediaUrls && post.mediaUrls.length > 0
      ? post.mediaUrls
      : post.mediaUrl
      ? [post.mediaUrl]
      : [];

    if (mediaUrls.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Instagram requires at least 1 image or video before publishing. Click "Open in Composer" to attach media.',
      });
      setConfirmPublishId(null);
      return;
    }

    if (post.format === 'carousel' && mediaUrls.length < 2) {
      setFeedback({
        type: 'error',
        message: 'Instagram carousels require at least 2 images. Open in Composer or Carousel Creator to attach slides.',
      });
      setConfirmPublishId(null);
      return;
    }

    setPublishingId(post.id);
    setConfirmPublishId(null);

    try {
      const fullCaption = `${post.caption || ''}${post.hashtags ? `\n\n${post.hashtags}` : ''}`.trim();
      const res = await publishPostViaPublora({
        caption: fullCaption,
        hashtags: post.hashtags,
        mediaUrl: mediaUrls[0],
        mediaUrls,
        format: post.format,
        platformId: instagramAccount?.platformId || instagramAccount?.id,
        publishNow: true,
      });

      if (res.success) {
        const now = new Date().toISOString();
        await updateDoc(doc(db, 'posts', post.id), {
          status: 'published',
          publoraPostId: res.postGroupId || res.data?.id || res.data?.postGroupId || 'live-submission',
          publoraStatus: 'published',
          publishedTime: now,
          updatedAt: now,
        });
        setPosts((prev) => prev.filter((p) => p.id !== post.id));
        setFeedback({ type: 'success', message: `Published "${post.title}" to Instagram via Publora.` });
      } else {
        setFeedback({
          type: 'error',
          message: `Publishing failed: ${res.error || 'Provider rejected request'}`,
        });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Publish error: ${err.message}` });
    } finally {
      setPublishingId(null);
    }
  };

  const handleOpenInComposer = (post: Post) => {
    const firstMedia = post.mediaUrl || (post.mediaUrls && post.mediaUrls[0]) || '';
    sessionStorage.setItem(
      'autosocial_composer_prefill',
      JSON.stringify({
        title: post.title,
        topic: post.topic || post.title,
        format: post.format,
        caption: post.caption,
        hashtags: post.hashtags,
        hook: post.hook || '',
        cta: post.cta || '',
        mediaUrl: firstMedia,
        mediaUrls: post.mediaUrls || (firstMedia ? [firstMedia] : []),
        mediaType: post.mediaType || (firstMedia.endsWith('.mp4') ? 'video' : 'image'),
      })
    );
    onNavigate('composer');
  };

  const openScheduleModal = (post: Post) => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    setScheduleDate(tomorrow.toISOString().split('T')[0]);
    setScheduleTime('18:30');
    setSchedulingPost(post);
  };

  const handleConfirmSchedule = async () => {
    if (!schedulingPost?.id || !scheduleDate || !scheduleTime) return;
    setIsScheduling(true);
    setFeedback(null);
    try {
      const scheduledIso = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
      const mediaUrls = schedulingPost.mediaUrls && schedulingPost.mediaUrls.length > 0
        ? schedulingPost.mediaUrls
        : schedulingPost.mediaUrl
        ? [schedulingPost.mediaUrl]
        : [];

      let publoraPostId = schedulingPost.publoraPostId;
      let publoraStatus = 'queued_local';

      // If connected and has media, submit scheduled post to Publora too
      if (isPubloraConnected && mediaUrls.length > 0) {
        const fullCaption = `${schedulingPost.caption || ''}${schedulingPost.hashtags ? `\n\n${schedulingPost.hashtags}` : ''}`.trim();
        const res = await publishPostViaPublora({
          caption: fullCaption,
          hashtags: schedulingPost.hashtags,
          mediaUrl: mediaUrls[0],
          mediaUrls,
          format: schedulingPost.format,
          platformId: instagramAccount?.platformId || instagramAccount?.id,
          scheduledTime: scheduledIso,
          publishNow: false,
        });
        if (res.success) {
          publoraPostId = res.postGroupId || res.data?.id || publoraPostId;
          publoraStatus = 'scheduled_publora';
        }
      }

      await updateDoc(doc(db, 'posts', schedulingPost.id), {
        status: 'scheduled',
        scheduledTime: scheduledIso,
        ...(publoraPostId ? { publoraPostId } : {}),
        publoraStatus,
        updatedAt: new Date().toISOString(),
      });

      setPosts((prev) => prev.filter((p) => p.id !== schedulingPost.id));
      triggerSchedulerTick().catch(() => {});
      setFeedback({
        type: 'success',
        message: `Scheduled "${schedulingPost.title}" for ${new Date(scheduledIso).toLocaleString()}.`,
      });
      setSchedulingPost(null);
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Failed to schedule draft: ${err.message}` });
    } finally {
      setIsScheduling(false);
    }
  };

  const handleDuplicate = async (post: Post) => {
    if (!user) return;
    try {
      const { id: _ignoreId, ...rest } = post;
      const payload: Omit<Post, 'id'> = {
        ...rest,
        title: `${post.title} (Copy)`,
        status: 'draft',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const newDoc = await addDoc(collection(db, 'posts'), payload);
      setPosts((prev) => [{ id: newDoc.id, ...payload }, ...prev]);
      setFeedback({ type: 'success', message: `Duplicated "${post.title}".` });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'posts');
    }
  };

  const handleDelete = async (postId: string) => {
    setConfirmDeleteId(null);
    try {
      await deleteDoc(doc(db, 'posts', postId));
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setFeedback({ type: 'success', message: 'Draft deleted.' });
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
      setFeedback({ type: 'success', message: 'Draft changes saved.' });
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
            Review, refine captions, schedule to your calendar, or approve content before publishing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadDrafts}
            disabled={loading}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => onNavigate('content-studio')}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Content Draft</span>
          </button>
        </div>
      </div>

      {/* Inline Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-[11px] font-semibold underline shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
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
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading drafts...</div>
      ) : filtered.length === 0 ? (
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
          {filtered.map((post) => {
            const hasMedia = Boolean(post.mediaUrl || (post.mediaUrls && post.mediaUrls.length > 0));
            return (
              <div
                key={post.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between space-y-4 hover:border-purple-500/40 transition"
              >
                <div className="space-y-3">
                  {/* Header row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        {post.format}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          hasMedia
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                        }`}
                      >
                        {hasMedia ? 'Media Ready' : 'No Media'}
                      </span>
                    </div>
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

                {/* Inline confirmations */}
                {confirmDeleteId === post.id && (
                  <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-rose-400 font-semibold">Delete draft?</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 rounded bg-slate-800 text-slate-300"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => post.id && handleDelete(post.id)}
                        className="px-2 py-1 rounded bg-rose-600 text-white font-semibold"
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                )}

                {confirmPublishId === post.id && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-amber-400 font-semibold">Publish live to IG?</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setConfirmPublishId(null)}
                        className="px-2 py-1 rounded bg-slate-800 text-slate-300"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handlePublishPost(post)}
                        className="px-2 py-1 rounded bg-emerald-600 text-white font-semibold"
                      >
                        Confirm Live
                      </button>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
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
                      onClick={() => handleOpenInComposer(post)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 transition"
                      title="Open in Unified Composer"
                    >
                      <PenSquare className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openScheduleModal(post)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition"
                      title="Schedule Draft"
                    >
                      <Calendar className="w-4 h-4" />
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
                        onClick={() => setConfirmDeleteId(post.id!)}
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
                        onClick={() => setConfirmPublishId(post.id || null)}
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
            );
          })}
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

      {/* Schedule Modal */}
      {schedulingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              Schedule Draft: {schedulingPost.title}
            </h3>
            <p className="text-xs text-slate-400">
              {schedulingPost.mediaUrl || (schedulingPost.mediaUrls && schedulingPost.mediaUrls.length > 0)
                ? 'This draft has media attached and will be queued with the scheduler & Publora.'
                : 'Note: No media attached yet. You can attach media in the Composer before it goes live.'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Date</label>
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Time</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSchedulingPost(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSchedule}
                disabled={isScheduling}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50"
              >
                {isScheduling ? 'Scheduling...' : 'Confirm Schedule'}
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
