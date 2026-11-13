import React, { useState, useEffect } from 'react';
import {
  History,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Search,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Post } from '../../types';
import { publishPostViaPublora, fetchPubloraPosts } from '../../services/api';
import { PostPreviewModal } from '../PostPreviewModal';

interface PublishingHistoryViewProps {
  isPubloraConnected: boolean;
  instagramAccount: any;
}

export const PublishingHistoryView: React.FC<PublishingHistoryViewProps> = ({
  isPubloraConnected,
  instagramAccount,
}) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [confirmRetryId, setConfirmRetryId] = useState<string | null>(null);
  const [previewPost, setPreviewPost] = useState<Post | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    loadPublishingHistory();
  }, [user]);

  const loadPublishingHistory = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'posts'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const items = (snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Post[]).filter(
        (p) => p.status === 'published' || p.status === 'failed' || p.status === 'scheduled'
      );
      items.sort((a, b) => {
        const da = new Date(a.publishedTime || a.scheduledTime || a.createdAt).getTime();
        const dbTime = new Date(b.publishedTime || b.scheduledTime || b.createdAt).getTime();
        return dbTime - da;
      });
      setPosts(items);
    } catch (err) {
      console.error('Error loading publishing history:', err);
      setFeedback({ type: 'error', message: 'Failed to load publishing history from Firestore.' });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncWithPublora = async () => {
    if (!isPubloraConnected) {
      setFeedback({
        type: 'error',
        message: 'Publora account is not connected. Verify your connection in Instagram Account.',
      });
      return;
    }

    setIsSyncing(true);
    setFeedback(null);
    try {
      const res = await fetchPubloraPosts();
      if (!res.success) {
        setFeedback({ type: 'error', message: res.error || 'Could not fetch Publora post statuses.' });
        return;
      }

      const remoteList: any[] = Array.isArray(res.posts)
        ? res.posts
        : Array.isArray(res.data?.posts)
        ? res.data.posts
        : Array.isArray(res.data)
        ? res.data
        : [];

      const byId = new Map<string, any>();
      for (const r of remoteList) {
        const key = r.id || r._id || r.postGroupId;
        if (key) byId.set(String(key), r);
      }

      let updatedCount = 0;
      const updatedPosts = await Promise.all(
        posts.map(async (p) => {
          if (!p.publoraPostId || !p.id) return p;
          const remote = byId.get(String(p.publoraPostId));
          if (!remote) return p;

          const remoteStatus = String(remote.status || '').toLowerCase();
          let mappedStatus = p.status;
          if (remoteStatus.includes('publish') || remoteStatus === 'posted' || remoteStatus === 'success') {
            mappedStatus = 'published';
          } else if (remoteStatus.includes('fail') || remoteStatus === 'error') {
            mappedStatus = 'failed';
          } else if (remoteStatus.includes('sched') || remoteStatus === 'queued') {
            mappedStatus = 'scheduled';
          }

          if (mappedStatus !== p.status || remote.status !== p.publoraStatus) {
            const now = new Date().toISOString();
            const patch: Partial<Post> = {
              status: mappedStatus,
              publoraStatus: remote.status || mappedStatus,
              updatedAt: now,
              ...(mappedStatus === 'published' && !p.publishedTime
                ? { publishedTime: remote.publishedAt || now }
                : {}),
              ...(mappedStatus === 'failed' && remote.error
                ? { failureReason: String(remote.error) }
                : {}),
            };
            await updateDoc(doc(db, 'posts', p.id), patch);
            updatedCount++;
            return { ...p, ...patch };
          }
          return p;
        })
      );

      setPosts(updatedPosts);
      setFeedback({
        type: 'success',
        message: `Synced with Publora (${remoteList.length} provider record(s) checked, ${updatedCount} status update(s) reconciled).`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Sync error: ${err.message}` });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRetryPublish = async (post: Post) => {
    if (!post.id) return;
    setConfirmRetryId(null);
    setFeedback(null);

    if (!isPubloraConnected) {
      setFeedback({ type: 'error', message: 'Publora is not connected.' });
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
        message: 'Cannot retry publish without media attached. Attach media via Composer first.',
      });
      return;
    }

    setRetryingId(post.id);

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

      const now = new Date().toISOString();
      if (res.success) {
        const patch: Partial<Post> = {
          status: 'published',
          publoraPostId: res.postGroupId || res.data?.id || res.data?.postGroupId || 'live-submission',
          publoraStatus: 'published',
          publishedTime: now,
          failureReason: '',
          updatedAt: now,
        };
        await updateDoc(doc(db, 'posts', post.id), patch);
        setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, ...patch } : p)));
        setFeedback({ type: 'success', message: `Retried and published "${post.title}" to Instagram.` });
      } else {
        const errMsg = res.error || 'Provider rejected request';
        await updateDoc(doc(db, 'posts', post.id), {
          failureReason: errMsg,
          updatedAt: now,
        });
        setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, failureReason: errMsg } : p)));
        setFeedback({ type: 'error', message: `Retry failed: ${errMsg}` });
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Retry error: ${err.message}` });
    } finally {
      setRetryingId(null);
    }
  };

  const filtered = posts.filter((p) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        p.caption.toLowerCase().includes(q) ||
        (p.publoraPostId && p.publoraPostId.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      {/* Top Header */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Instagram Publishing Audit & History
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Provider submission IDs, idempotency reconciliation, and error audit logs.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search publishing logs..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
            />
          </div>
          <button
            onClick={handleSyncWithPublora}
            disabled={isSyncing}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Publora Status'}</span>
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

      {/* Idempotency & Safe Publishing Protection Note */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-800 dark:text-slate-200">
            Double-Submission Protection (Idempotency Key Enforcement)
          </p>
          <p className="leading-relaxed">
            Every submission sent to Publora attaches a unique <code className="text-purple-400">Idempotency-Key</code> header and follows the 3-step media upload & verification flow so network retries will never duplicate posts on your Instagram feed.
          </p>
        </div>
      </div>

      {/* History Table */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">Loading publishing logs...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <History className="w-10 h-10 mx-auto text-slate-500 mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No publishing history found</p>
            <p className="text-xs mt-1">Scheduled and published posts submitted via Publora will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {filtered.map((post) => (
              <div
                key={post.id}
                className="py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 font-bold flex items-center justify-center shrink-0 border border-purple-500/20 text-[10px] uppercase">
                    {post.format}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-semibold text-slate-900 dark:text-white truncate text-sm">
                      {post.title}
                    </p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
                      <span>Provider Submission ID:</span>
                      <code className="text-purple-400 font-mono font-medium">
                        {post.publoraPostId || 'Queued'}
                      </code>
                      {post.publoraStatus && (
                        <span className="text-slate-500">({post.publoraStatus})</span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Timestamp: {new Date(post.publishedTime || post.scheduledTime || post.createdAt).toLocaleString()}
                    </p>
                    {post.failureReason && (
                      <p className="text-[11px] text-rose-400 mt-1">
                        Error: {post.failureReason}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-center">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                      post.status === 'published'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : post.status === 'scheduled'
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}
                  >
                    {post.status.toUpperCase()}
                  </span>

                  <button
                    onClick={() => setPreviewPost(post)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    title="Preview Post"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  {post.status === 'failed' && confirmRetryId !== post.id && (
                    <button
                      onClick={() => setConfirmRetryId(post.id || null)}
                      disabled={retryingId === post.id}
                      className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-1 transition disabled:opacity-50"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${retryingId === post.id ? 'animate-spin' : ''}`} />
                      <span>Retry</span>
                    </button>
                  )}

                  {confirmRetryId === post.id && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setConfirmRetryId(null)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-[11px]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleRetryPublish(post)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold"
                      >
                        Confirm Retry Live
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
