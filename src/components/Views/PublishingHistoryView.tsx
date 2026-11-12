import React, { useState, useEffect } from 'react';
import {
  History,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Clock,
  ExternalLink,
  ShieldCheck,
  Search,
  Eye,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
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
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [previewPost, setPreviewPost] = useState<Post | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

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
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Post[];
      setPosts(items.filter((p) => p.status === 'published' || p.status === 'failed' || p.status === 'scheduled'));
    } catch (err) {
      console.error('Error loading publishing history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRetryPublish = async (post: Post) => {
    if (!post.id || !isPubloraConnected) return;
    setRetryingId(post.id);

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
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? { ...p, status: 'published', publishedTime: new Date().toISOString() }
              : p
          )
        );
      } else {
        alert(`Retry failed: ${res.error || 'Provider rejected request'}`);
      }
    } catch (err: any) {
      alert(`Retry error: ${err.message}`);
    } finally {
      setRetryingId(null);
    }
  };

  const filtered = posts.filter((p) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.caption.toLowerCase().includes(q);
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

        {/* Search */}
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
      </div>

      {/* Idempotency & Safe Publishing Protection Note */}
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-800 dark:text-slate-200">
            Double-Submission Protection (Idempotency Key Enforcement)
          </p>
          <p className="leading-relaxed">
            Every submission sent to Publora is attached with a cryptographically unique `Idempotency-Key` header. This guarantees that network retries or duplicate clicks will never result in multiple duplicate posts published to your Instagram feed.
          </p>
        </div>
      </div>

      {/* History Table */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        {filtered.length === 0 ? (
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
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 font-bold flex items-center justify-center shrink-0 border border-purple-500/20 text-xs uppercase">
                    {post.format}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-semibold text-slate-900 dark:text-white truncate text-sm">
                      {post.title}
                    </p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-2">
                      <span>Provider Submission ID:</span>
                      <code className="text-purple-400 font-mono font-medium">
                        {post.publoraPostId || 'Queued'}
                      </code>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Timestamp: {post.publishedTime || post.scheduledTime || post.createdAt}
                    </p>
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

                  {post.status === 'failed' && (
                    <button
                      onClick={() => handleRetryPublish(post)}
                      disabled={retryingId === post.id}
                      className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-1 transition disabled:opacity-50"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${retryingId === post.id ? 'animate-spin' : ''}`} />
                      <span>Retry</span>
                    </button>
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
