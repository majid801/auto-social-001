import React, { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  RefreshCw,
  Trash2,
  Eye,
  Send,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  Plus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Post } from '../../types';
import {
  fetchPubloraPosts,
  updatePubloraPost,
  deletePubloraPost,
  publishPostViaPublora,
  triggerSchedulerTick,
} from '../../services/api';
import { PostPreviewModal } from '../PostPreviewModal';
import { NavTab } from '../Sidebar';

interface ScheduledQueueViewProps {
  onNavigate: (tab: NavTab) => void;
  isPubloraConnected: boolean;
  instagramAccount: any;
}

export const ScheduledQueueView: React.FC<ScheduledQueueViewProps> = ({
  onNavigate,
  isPubloraConnected,
  instagramAccount,
}) => {
  const { user } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [publoraQueue, setPubloraQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<Post | null>(null);
  const [newDate, setNewDate] = useState<string>('');
  const [newTime, setNewTime] = useState<string>('18:00');
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [confirmPublishId, setConfirmPublishId] = useState<string | null>(null);
  const [previewPost, setPreviewPost] = useState<Post | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    loadQueue();
  }, [user]);

  const loadQueue = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'posts'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const items = (snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Post[])
        .filter((p) => p.status === 'scheduled' || p.status === 'approved')
        .sort((a, b) => (a.scheduledTime || a.createdAt).localeCompare(b.scheduledTime || b.createdAt));
      setPosts(items);

      if (isPubloraConnected) {
        const pubRes = await fetchPubloraPosts({ status: 'scheduled' });
        const list = Array.isArray(pubRes) ? pubRes : pubRes?.posts || pubRes?.data || [];
        setPubloraQueue(list);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed loading scheduled queue.' });
    } finally {
      setLoading(false);
    }
  };

  const handleReconcile = async () => {
    setSyncing(true);
    setFeedback(null);
    try {
      await triggerSchedulerTick();
      await loadQueue();
      setFeedback({
        type: 'success',
        message: 'Reconciled scheduled queue with backend cron daemon & Publora API.',
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Reconciliation failed.' });
    } finally {
      setSyncing(false);
    }
  };

  const openReschedule = (post: Post) => {
    setRescheduleTarget(post);
    const dt = post.scheduledTime ? new Date(post.scheduledTime) : new Date(Date.now() + 86400000);
    setNewDate(!isNaN(dt.getTime()) ? dt.toISOString().slice(0, 10) : '');
    setNewTime(!isNaN(dt.getTime()) ? dt.toTimeString().slice(0, 5) : '18:00');
  };

  const saveReschedule = async () => {
    if (!rescheduleTarget?.id || !newDate) return;
    const iso = new Date(`${newDate}T${newTime || '18:00'}`).toISOString();
    setFeedback(null);

    try {
      if (rescheduleTarget.publoraPostId && isPubloraConnected) {
        await updatePubloraPost(rescheduleTarget.publoraPostId, {
          status: 'scheduled',
          scheduledTime: iso,
        });
      }
      await updateDoc(doc(db, 'posts', rescheduleTarget.id), {
        status: 'scheduled',
        scheduledTime: iso,
        updatedAt: new Date().toISOString(),
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === rescheduleTarget.id ? { ...p, status: 'scheduled', scheduledTime: iso } : p
        )
      );
      setRescheduleTarget(null);
      setFeedback({ type: 'success', message: `Post rescheduled to ${new Date(iso).toLocaleString()}.` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Reschedule failed.' });
    }
  };

  const handleCancelScheduled = async (post: Post) => {
    if (!post.id) return;
    setConfirmCancelId(null);
    try {
      if (post.publoraPostId && isPubloraConnected) {
        await deletePubloraPost(post.publoraPostId);
      }
      await deleteDoc(doc(db, 'posts', post.id));
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      setFeedback({ type: 'success', message: `Cancelled & removed "${post.title}" from queue.` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Cancellation failed.' });
    }
  };

  const handlePublishNow = async (post: Post) => {
    setConfirmPublishId(null);
    if (!post.id || !isPubloraConnected) return;

    try {
      const res = await publishPostViaPublora({
        caption: post.caption,
        hashtags: post.hashtags,
        mediaUrl: post.mediaUrl,
        mediaUrls: post.mediaUrls,
        format: post.format,
        platformId: instagramAccount?.platformId,
        publishNow: true,
      });

      if (!res.success) {
        setFeedback({ type: 'error', message: res.error || 'Publish failed.' });
        return;
      }

      await updateDoc(doc(db, 'posts', post.id), {
        status: 'published',
        publoraPostId: res.postGroupId || 'live-post',
        publishedTime: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      setFeedback({ type: 'success', message: `Published "${post.title}" to Instagram!` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Publish error.' });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Scheduled Instagram Posts Queue ({posts.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage upcoming posts synced with the persistent server scheduler & Publora API ({publoraQueue.length} remote scheduled).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReconcile}
            disabled={syncing}
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>Reconcile Queue</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('composer')}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Schedule Post</span>
          </button>
        </div>
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

      {loading ? (
        <div className="p-10 text-center text-xs text-slate-400">Loading scheduled queue...</div>
      ) : posts.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 space-y-3">
          <Calendar className="w-10 h-10 mx-auto text-slate-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            No Posts Currently in Queue
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Create or schedule a post in the Post Composer or Content Studio to see it queued for automatic publishing.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('composer')}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
          >
            Open Post Composer
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div
              key={post.id}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3 min-w-0">
                {post.mediaUrl ? (
                  <img
                    src={post.mediaUrl}
                    alt={post.title}
                    className="w-14 h-14 rounded-xl object-cover border border-slate-700 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center text-xs font-bold uppercase shrink-0">
                    {post.format}
                  </div>
                )}
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {post.format} • {post.status}
                    </span>
                    {!post.mediaUrl && (!post.mediaUrls || post.mediaUrls.length === 0) && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Needs Media
                      </span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {post.title}
                  </h4>
                  <p className="text-xs text-slate-400 line-clamp-1">{post.caption}</p>
                  <p className="text-[11px] text-purple-400 font-medium">
                    Scheduled:{' '}
                    {post.scheduledTime
                      ? new Date(post.scheduledTime).toLocaleString()
                      : 'Approved (No timestamp)'}
                    {post.publoraPostId ? ` • Publora ID: ${post.publoraPostId}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewPost(post)}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-white"
                  title="Preview"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => openReschedule(post)}
                  className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Reschedule</span>
                </button>

                {confirmPublishId === post.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setConfirmPublishId(null)}
                      className="px-2.5 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePublishNow(post)}
                      className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
                    >
                      Confirm Publish
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmPublishId(post.id || null)}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Publish Now</span>
                  </button>
                )}

                {confirmCancelId === post.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setConfirmCancelId(null)}
                      className="px-2.5 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs"
                    >
                      Keep
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancelScheduled(post)}
                      className="px-3 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold"
                    >
                      Confirm Delete
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmCancelId(post.id || null)}
                    className="p-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                    title="Cancel & Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Reschedule: {rescheduleTarget.title}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
              />
              <input
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRescheduleTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveReschedule}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
              >
                Save New Time
              </button>
            </div>
          </div>
        </div>
      )}

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
