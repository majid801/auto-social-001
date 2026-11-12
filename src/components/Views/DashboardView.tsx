import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Instagram,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Zap,
  TrendingUp,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Post, AutomationRule } from '../../types';
import { NavTab } from '../Sidebar';

interface DashboardViewProps {
  onNavigate: (tab: NavTab) => void;
  isPubloraConnected: boolean;
  instagramAccount: any;
  onRefreshPublora: () => void;
  isRefreshingPublora: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  isPubloraConnected,
  instagramAccount,
  onRefreshPublora,
  isRefreshingPublora,
}) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [activeAutomationsCount, setActiveAutomationsCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [quickTopic, setQuickTopic] = useState<string>('');

  useEffect(() => {
    if (!user) return;
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch user's posts
      const postsRef = collection(db, 'posts');
      const q = query(
        postsRef,
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const snapshot = await getDocs(q);
      const fetchedPosts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Post[];
      setPosts(fetchedPosts);

      // Fetch automations count
      const autoRef = collection(db, 'automations');
      const autoQuery = query(
        autoRef,
        where('userId', '==', user.uid),
        where('isEnabled', '==', true)
      );
      const autoSnap = await getDocs(autoQuery);
      setActiveAutomationsCount(autoSnap.size);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const draftsCount = posts.filter((p) => p.status === 'draft').length;
  const awaitingApprovalCount = posts.filter((p) => p.status === 'awaiting_approval').length;
  const scheduledCount = posts.filter((p) => p.status === 'scheduled' || p.status === 'approved').length;
  const publishedCount = posts.filter((p) => p.status === 'published').length;
  const failedCount = posts.filter((p) => p.status === 'failed').length;

  const upcomingPosts = posts
    .filter((p) => p.status === 'scheduled' || p.status === 'approved')
    .slice(0, 4);

  const handleLaunchStudioWithTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTopic.trim()) {
      onNavigate('content-studio');
      return;
    }
    // Store quick prompt in session so studio picks it up
    sessionStorage.setItem('autosocial_initial_prompt', quickTopic);
    onNavigate('content-studio');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in">
      {/* Top Banner: Publora Instagram Connection Status */}
      <div className={`p-5 rounded-2xl border transition-all ${
        isPubloraConnected
          ? 'bg-gradient-to-r from-emerald-950/30 via-slate-900 to-slate-900 border-emerald-500/30 shadow-lg shadow-emerald-950/20'
          : 'bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 border-amber-500/30 shadow-lg shadow-amber-950/20'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
              isPubloraConnected
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
            }`}>
              <Instagram className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">
                  {isPubloraConnected ? 'Instagram Publishing Active' : 'Publora Instagram Connection Required'}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                  isPubloraConnected
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                }`}>
                  {isPubloraConnected ? 'Connected via Publora' : 'API Key Setup'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isPubloraConnected && instagramAccount
                  ? `Authenticated as @${instagramAccount.username || instagramAccount.name || 'Instagram User'} • Verified with Publora v1 API`
                  : 'Configure PUBLORA_API_KEY in AI Studio Secrets to sync your connected Instagram account & enable automated publishing.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={onRefreshPublora}
              disabled={isRefreshingPublora}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingPublora ? 'animate-spin' : ''}`} />
              <span>Verify</span>
            </button>
            <button
              onClick={() => onNavigate('accounts')}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-purple-600/20 transition flex items-center justify-center gap-1.5"
            >
              <span>{isPubloraConnected ? 'Manage Account' : 'Setup Publora Key'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick AI Generator Launch Bar */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-900/40 via-indigo-950/40 to-slate-900 border border-purple-500/20 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-purple-400 font-semibold text-xs tracking-wider uppercase mb-1">
            <Sparkles className="w-3.5 h-3.5" /> Instant Instagram Content Creator
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-white mb-2">
            What Instagram content would you like to create today?
          </h2>
          <p className="text-xs text-slate-400 mb-4 max-w-2xl">
            Enter your idea, niche topic, or hook. Gemini AI will generate a complete package with caption, hashtags, CTA, and scene-by-scene Reel script ready for Instagram.
          </p>

          <form onSubmit={handleLaunchStudioWithTopic} className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={quickTopic}
              onChange={(e) => setQuickTopic(e.target.value)}
              placeholder="e.g. 5 AI productivity tools every student must know in 2026..."
              className="flex-1 px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white placeholder-slate-500 text-sm focus:outline-hidden focus:border-purple-500 transition"
            />
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:via-pink-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-lg shadow-purple-600/30 transition flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Package</span>
            </button>
          </form>
        </div>
      </div>

      {/* Metrics Row: 5 Clean Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div
          onClick={() => onNavigate('drafts')}
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 cursor-pointer transition shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium">Drafts</span>
            <FileText className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{draftsCount}</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Saved drafts</p>
        </div>

        <div
          onClick={() => onNavigate('drafts')}
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-500/50 cursor-pointer transition shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium">Awaiting Approval</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{awaitingApprovalCount}</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Ready for review</p>
        </div>

        <div
          onClick={() => onNavigate('calendar')}
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 cursor-pointer transition shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium">Scheduled</span>
            <Calendar className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{scheduledCount}</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Queued for publishing</p>
        </div>

        <div
          onClick={() => onNavigate('history')}
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 cursor-pointer transition shadow-xs"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium">Published</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{publishedCount}</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Live Instagram posts</p>
        </div>

        <div
          onClick={() => onNavigate('automations')}
          className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 cursor-pointer transition shadow-xs col-span-2 sm:col-span-1"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-medium">Automations</span>
            <Zap className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{activeAutomationsCount}</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Active workflows</p>
        </div>
      </div>

      {/* Main Two-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Upcoming Content Schedule & Activity */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-500" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Upcoming Instagram Content
                </h3>
              </div>
              <button
                onClick={() => onNavigate('calendar')}
                className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
              >
                <span>View Full Calendar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {upcomingPosts.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-slate-50 dark:bg-slate-950/50 border border-dashed border-slate-300 dark:border-slate-800">
                <Calendar className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">No scheduled posts yet</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                  Generate ideas in the AI Studio or approve saved drafts to queue them up for automated Instagram publishing.
                </p>
                <button
                  onClick={() => onNavigate('content-studio')}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-xs"
                >
                  Create First Post
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingPosts.map((post) => (
                  <div
                    key={post.id}
                    className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-400 font-bold flex items-center justify-center shrink-0 border border-purple-500/20 text-xs uppercase">
                        {post.format}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {post.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                          <span className="capitalize">{post.format}</span>
                          <span>•</span>
                          <span className="text-purple-600 dark:text-purple-400 font-medium">
                            {post.suggestedPostingTime || post.scheduledTime || 'Scheduled'}
                          </span>
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 shrink-0">
                      {post.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Shortcuts to Specialized Studios */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div
              onClick={() => onNavigate('image-generator')}
              className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-pink-500/50 cursor-pointer transition shadow-xs group"
            >
              <div className="w-8 h-8 rounded-lg bg-pink-500/10 text-pink-400 flex items-center justify-center mb-2.5 group-hover:scale-105 transition">
                <Sparkles className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">AI Image Generator</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">1080x1080 & 1080x1350 designs</p>
            </div>

            <div
              onClick={() => onNavigate('video-reels')}
              className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 cursor-pointer transition shadow-xs group"
            >
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center mb-2.5 group-hover:scale-105 transition">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">Reels & Video Studio</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Scriptwriting & retention hooks</p>
            </div>

            <div
              onClick={() => onNavigate('skills')}
              className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 cursor-pointer transition shadow-xs group"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-2.5 group-hover:scale-105 transition">
                <Zap className="w-4 h-4" />
              </div>
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">13 Agent Skills</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">ig-audit, ig-viral, carousels</p>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Publora Provider Info & Plan Limits */}
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Publora Provider Status
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
                <span className="text-slate-400 block text-[11px]">Publishing API</span>
                <span className="font-semibold text-slate-900 dark:text-white">https://api.publora.com/api/v1</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
                <span className="text-slate-400 block text-[11px]">Authentication Header</span>
                <span className="font-mono text-purple-400 text-[11px]">x-publora-key (Server Secret)</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80">
                <span className="text-slate-400 block text-[11px]">Provider Free Plan Limits</span>
                <p className="text-[11px] text-slate-400 mt-1">
                  Publora Starter plan includes monthly post quotas, 1 connected Instagram account, and concurrent scheduling. Full limits are reconciled directly from your account.
                </p>
              </div>

              <div className="pt-2">
                <a
                  href="https://docs.publora.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <span>Publora Documentation</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
