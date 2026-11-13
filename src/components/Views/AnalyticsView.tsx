import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  CheckCircle2,
  Layers,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
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

  const filteredPosts = useMemo(() => {
    if (dateRange === 'all') return posts;
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const cutoff = Date.now() - days * 86400000;
    return posts.filter((p) => {
      const ts = new Date(p.publishedTime || p.scheduledTime || p.createdAt).getTime();
      return !isNaN(ts) && ts >= cutoff;
    });
  }, [posts, dateRange]);

  const totalPublished = filteredPosts.filter((p) => p.status === 'published').length;
  const totalScheduled = filteredPosts.filter(
    (p) => p.status === 'scheduled' || p.status === 'approved'
  ).length;
  const totalDrafts = filteredPosts.filter(
    (p) => p.status === 'draft' || p.status === 'awaiting_approval'
  ).length;

  const reelsCount = filteredPosts.filter(
    (p) => p.format === 'reel' || p.format === 'video'
  ).length;
  const carouselsCount = filteredPosts.filter((p) => p.format === 'carousel').length;
  const singlePostsCount = filteredPosts.filter((p) => p.format === 'post').length;
  const storiesCount = filteredPosts.filter((p) => p.format === 'story').length;

  const formatChartData = [
    { name: 'Reels/Video', count: reelsCount },
    { name: 'Carousels', count: carouselsCount },
    { name: 'Posts', count: singlePostsCount },
    { name: 'Stories', count: storiesCount },
  ];

  // Aggregate real activity by date
  const velocityChartData = useMemo(() => {
    const map = new Map<string, { date: string; created: number; published: number }>();
    for (const p of filteredPosts) {
      const dt = new Date(p.publishedTime || p.scheduledTime || p.createdAt);
      if (isNaN(dt.getTime())) continue;
      const key = dt.toISOString().slice(5, 10);
      const entry = map.get(key) || { date: key, created: 0, published: 0 };
      entry.created += 1;
      if (p.status === 'published') entry.published += 1;
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredPosts]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
            <BarChart3 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Instagram Publishing Analytics
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Real workspace publishing metrics and transparent provider capability reporting.
            </p>
          </div>
        </div>

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
                dateRange === tab.id ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
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
          <span className="text-xs text-slate-400 font-medium block mb-1">
            Total Published Content
          </span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {loading ? '—' : totalPublished}
          </div>
          <span className="text-[11px] text-emerald-400 flex items-center gap-1 mt-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Reconciled via Publora API
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs text-slate-400 font-medium block mb-1">
            Queued for Publishing
          </span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {loading ? '—' : totalScheduled}
          </div>
          <span className="text-[11px] text-blue-400 flex items-center gap-1 mt-1">
            <Clock className="w-3.5 h-3.5" /> Scheduled in Calendar
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs text-slate-400 font-medium block mb-1">
            Reels & Videos Created
          </span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {loading ? '—' : reelsCount}
          </div>
          <span className="text-[11px] text-purple-400 flex items-center gap-1 mt-1">
            <TrendingUp className="w-3.5 h-3.5" /> High-retention format
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <span className="text-xs text-slate-400 font-medium block mb-1">
            Active Pipeline Drafts
          </span>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {loading ? '—' : totalDrafts}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">In review & editing</span>
        </div>
      </div>

      {/* Recharts Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-500" />
            Instagram Format Distribution
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={formatChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '12px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="#9333ea" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            Content Production & Publishing Timeline
          </h3>
          {velocityChartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-xs text-slate-400">
              No timestamped posts in the selected date window yet.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={velocityChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="created"
                    stroke="#8b5cf6"
                    fill="#8b5cf6"
                    fillOpacity={0.2}
                    name="Created/Planned"
                  />
                  <Area
                    type="monotone"
                    dataKey="published"
                    stroke="#10b981"
                    fill="#10b981"
                    fillOpacity={0.25}
                    name="Published"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Mandatory Transparency Panel */}
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
          AutoSocial AI displays strictly real workspace and Publora records. Metrics not exposed by Publora's current API scope are marked transparently below:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
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
                  m.status.startsWith('Not') ? 'text-amber-500/90' : 'text-emerald-400'
                }`}
              >
                {m.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
