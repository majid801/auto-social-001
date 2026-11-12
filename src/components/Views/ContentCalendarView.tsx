import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  Filter,
  Eye,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Instagram,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Post, PostFormat, PostStatus } from '../../types';
import { PostPreviewModal } from '../PostPreviewModal';
import { NavTab } from '../Sidebar';

interface ContentCalendarViewProps {
  onNavigate: (tab: NavTab) => void;
  instagramAccount: any;
}

type CalendarViewMode = 'month' | 'week' | 'list';

export const ContentCalendarView: React.FC<ContentCalendarViewProps> = ({
  onNavigate,
  instagramAccount,
}) => {
  const { user } = useAuth();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedFormatFilter, setSelectedFormatFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');

  // Preview Modal state
  const [activePreviewPost, setActivePreviewPost] = useState<Post | null>(null);

  useEffect(() => {
    if (!user) return;
    loadPosts();
  }, [user]);

  const loadPosts = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'posts'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Post[];
      setPosts(items);
    } catch (err) {
      console.error('Error loading calendar posts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to remove this post from your calendar?')) return;
    try {
      await deleteDoc(doc(db, 'posts', postId));
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `posts/${postId}`);
    }
  };

  // Month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const today = () => {
    setCurrentDate(new Date());
  };

  // Filter posts
  const filteredPosts = posts.filter((p) => {
    if (selectedFormatFilter !== 'all' && p.format !== selectedFormatFilter) return false;
    if (selectedStatusFilter !== 'all' && p.status !== selectedStatusFilter) return false;
    return true;
  });

  // Calculate days in current month
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const getStatusBadge = (status: PostStatus) => {
    switch (status) {
      case 'published':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'scheduled':
      case 'approved':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'awaiting_approval':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'failed':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      {/* Top Header & Calendar Controls */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {monthNames[month]} {year}
            </h2>
            <p className="text-xs text-slate-400">
              {filteredPosts.length} posts planned • Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </p>
          </div>
        </div>

        {/* View Toggle, Filter & Nav */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Format filter */}
          <select
            value={selectedFormatFilter}
            onChange={(e) => setSelectedFormatFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300"
          >
            <option value="all">All Formats</option>
            <option value="reel">Reels</option>
            <option value="post">Posts</option>
            <option value="carousel">Carousels</option>
            <option value="story">Stories</option>
          </select>

          {/* Status filter */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300"
          >
            <option value="all">All Statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="approved">Approved</option>
            <option value="draft">Drafts</option>
            <option value="published">Published</option>
            <option value="failed">Failed</option>
          </select>

          {/* View mode toggle */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
            <button
              onClick={() => setViewMode('month')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                viewMode === 'month' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                viewMode === 'list' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              List
            </button>
          </div>

          {/* Month buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={today}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold transition"
            >
              Today
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => onNavigate('content-studio')}
            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1 shadow-xs transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create</span>
          </button>
        </div>
      </div>

      {/* Calendar Grid Mode */}
      {viewMode === 'month' ? (
        <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          {/* Day of Week Header */}
          <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-semibold text-slate-400">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>

          {/* Month Days Grid */}
          <div className="grid grid-cols-7 gap-2">
            {/* Empty slots before first day of month */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[90px] rounded-xl bg-slate-50/50 dark:bg-slate-950/20 border border-transparent" />
            ))}

            {/* Days in Month */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNumber = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
              const dayPosts = filteredPosts.filter((p) => {
                const postDate = p.scheduledTime || p.publishedTime || p.createdAt;
                return postDate && postDate.startsWith(dateStr);
              });
              const isToday =
                new Date().getDate() === dayNumber &&
                new Date().getMonth() === month &&
                new Date().getFullYear() === year;

              return (
                <div
                  key={dayNumber}
                  className={`min-h-[100px] p-2 rounded-xl border flex flex-col justify-between transition ${
                    isToday
                      ? 'bg-purple-500/5 border-purple-500/40 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold ${isToday ? 'text-purple-400' : 'text-slate-700 dark:text-slate-300'}`}>
                      {dayNumber}
                    </span>
                    {dayPosts.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 font-semibold">
                        {dayPosts.length}
                      </span>
                    )}
                  </div>

                  {/* Day Posts List */}
                  <div className="space-y-1 overflow-y-auto max-h-[85px] custom-scrollbar">
                    {dayPosts.map((post) => (
                      <div
                        key={post.id}
                        onClick={() => setActivePreviewPost(post)}
                        className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 cursor-pointer text-[10px] truncate transition flex items-center justify-between gap-1 shadow-2xs"
                      >
                        <span className="truncate font-medium text-slate-800 dark:text-slate-200">{post.title}</span>
                        <span className={`px-1 py-0.2 rounded text-[9px] shrink-0 border ${getStatusBadge(post.status)}`}>
                          {post.format}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div />
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* List Mode */
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          {filteredPosts.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <CalendarIcon className="w-10 h-10 mx-auto text-slate-500 mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No content matches filters</p>
              <p className="text-xs mt-1">Schedule posts from the AI Studio or reset your filters.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredPosts.map((post) => (
                <div
                  key={post.id}
                  className="py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-purple-500/10 text-purple-400 font-bold flex items-center justify-center shrink-0 border border-purple-500/20 text-[10px] uppercase">
                      {post.format}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white truncate text-xs sm:text-sm">
                        {post.title}
                      </p>
                      <p className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="capitalize">{post.format}</span>
                        <span>•</span>
                        <span>{post.scheduledTime || post.publishedTime || post.createdAt}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadge(post.status)}`}>
                      {post.status.replace('_', ' ')}
                    </span>
                    <button
                      onClick={() => setActivePreviewPost(post)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                      title="Preview Post"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {post.id && (
                      <button
                        onClick={() => handleDeletePost(post.id!)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                        title="Delete Post"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      <PostPreviewModal
        post={activePreviewPost}
        isOpen={Boolean(activePreviewPost)}
        onClose={() => setActivePreviewPost(null)}
        username={instagramAccount?.username || 'autosocial_creator'}
        userAvatar={instagramAccount?.profile_picture || instagramAccount?.profilePictureUrl}
      />
    </div>
  );
};
