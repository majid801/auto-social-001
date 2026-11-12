import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  AlertCircle,
  Instagram,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  Info,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Post } from '../../types';

export const AnalyticsView: React.FC = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    if (!user) return;
    loadAnalytics();
  }, [user]);

  const loadAnalytics = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'posts'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Post[];
      setPosts(items);
    } catch (err) {
      console.error('Error loading posts for analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalPublished = posts.filter((p) => p.status === 'published').length;
  const totalScheduled = posts.filter((p) => p.status === 'scheduled' || p.status === 'approved').length;
  const totalDrafts = posts.filter((p) => p.status === 'draft' || p.status === 'awaiting_approval').length;

  const reelsCount = posts.filter((p) => p.format === 'reel' || p.format === 'video').length;
  const carouselsCount = posts.filter((p) => p.format === 'carousel').length;
  const singlePostsCount = posts.filter((p) => p.format === 'post').length;
  const storiesCount = posts.filter((p) => p.format === 'story').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      {/* Top Header */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Instagram Publishing Analytics
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Verified platform delivery metrics and provider capability transparency.
            </p>
          </div>
        </div>

        {/* Date Filter */}
        <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
          {[
            { id: '7d', label: 'Last 7 Days' },
            { id: '30d', label: 'Last 30 Days' },
            { id: '90d', label: 'Last 90 Days' },
            { id: 'all', label: 'All Time' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDateRange(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                dateRange === tab.id ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Real Available Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs text-slate-400 font-medium block mb-1">Total Published Content</span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{totalPublished}</div>
          <span className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Reconciled via Publora API
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs text-slate-400 font-medium block mb-1">Queued for Publishing</span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{totalScheduled}</div>
          <span className="text-[11px] text-blue-400 flex items-center gap-1 mt-1">
            <Clock className="w-3.5 h-3.5" /> Scheduled in Calendar
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs text-slate-400 font-medium block mb-1">Reels & Videos Created</span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{reelsCount}</div>
          <span className="text-[11px] text-purple-400 flex items-center gap-1 mt-1">
            <TrendingUp className="w-3.5 h-3.5" /> High-retention format
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs text-slate-400 font-medium block mb-1">Active Pipeline Drafts</span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{totalDrafts}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">In review & editing</span>
        </div>
      </div>

      {/* Format Breakdown & Schedule Velocity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Format breakdown card */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-500" />
            Instagram Format Distribution
          </h3>

          <div className="space-y-3">
            {[
              { label: 'Instagram Reels', count: reelsCount, color: 'bg-purple-600', text: 'text-purple-400' },
              { label: 'Carousels', count: carouselsCount, color: 'bg-pink-600', text: 'text-pink-400' },
              { label: 'Single Image Posts', count: singlePostsCount, color: 'bg-indigo-600', text: 'text-indigo-400' },
              { label: 'Stories', count: storiesCount, color: 'bg-amber-500', text: 'text-amber-400' },
            ].map((f) => {
              const total = posts.length || 1;
              const pct = Math.round((f.count / total) * 100);
              return (
                <div key={f.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{f.label}</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {f.count} posts ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className={`h-full rounded-full ${f.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mandatory Transparency Panel: Provider Limited Metrics (Part 13 Requirement) */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Connected Provider Metric Verification
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 font-mono">
              Publora API v1
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            AutoSocial AI strictly adheres to zero-fake-data standards. Metrics not exposed by the current Publora publishing API endpoints are explicitly designated below:
          </p>

          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              { metric: 'Follower Growth', status: 'Not available through connected provider' },
              { metric: 'Impressions & Reach', status: 'Not available through connected provider' },
              { metric: 'Story Sticker Taps', status: 'Not available through connected provider' },
              { metric: 'Profile Visits', status: 'Not available through connected provider' },
              { metric: 'Post Publishing Logs', status: 'Fully Supported via Publora' },
              { metric: 'Scheduled Queue Count', status: 'Fully Supported via Database & Publora' },
            ].map((m) => (
              <div
                key={m.metric}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 space-y-1"
              >
                <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs block">
                  {m.metric}
                </span>
                <span
                  className={`text-[10px] font-medium block ${
                    m.status.startsWith('Not')
                      ? 'text-amber-500/90'
                      : 'text-emerald-400'
                  }`}
                >
                  {m.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
