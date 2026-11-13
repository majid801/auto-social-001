import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Eye,
  Trash2,
  Edit3,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, getDocs, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Post, PostStatus } from '../../types';
import { updatePubloraPost, triggerSchedulerTick } from '../../services/api';
import { PostPreviewModal } from '../PostPreviewModal';
import { NavTab } from '../Sidebar';

interface ContentCalendarViewProps {
  onNavigate: (tab: NavTab) => void;
  instagramAccount: any;
}

type CalendarViewMode = 'day' | 'week' | 'month' | 'list';

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
  const [draggedPostId, setDraggedPostId] = useState<string | null>(null);

  // Modals & feedback
  const [activePreviewPost, setActivePreviewPost] = useState<Post | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [editTime, setEditTime] = useState<string>('18:00');
  const [editStatus, setEditStatus] = useState<PostStatus>('scheduled');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
    setConfirmDeleteId(null);
    try {
      await deleteDoc(doc(db, 'posts', postId));
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setFeedback({ type: 'success', message: 'Post removed from calendar.' });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `posts/${postId}`);
    }
  };

  const reschedulePostToDate = async (post: Post, targetDateStr: string, timeStr?: string) => {
    if (!post.id) return;
    const existingTime = post.scheduledTime
      ? new Date(post.scheduledTime).toTimeString().slice(0, 5)
      : '18:00';
    const finalTime = timeStr || existingTime || '18:00';
    const newIso = new Date(`${targetDateStr}T${finalTime}`).toISOString();

    try {
      if (post.publoraPostId) {
        await updatePubloraPost(post.publoraPostId, {
          status: 'scheduled',
          scheduledTime: newIso,
        }).catch(() => {});
      }
      await updateDoc(doc(db, 'posts', post.id), {
        scheduledTime: newIso,
        status: post.status === 'draft' ? 'scheduled' : post.status,
        updatedAt: new Date().toISOString(),
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? {
                ...p,
                scheduledTime: newIso,
                status: p.status === 'draft' ? 'scheduled' : p.status,
              }
            : p
        )
      );
      triggerSchedulerTick().catch(() => {});
      setFeedback({
        type: 'success',
        message: `Rescheduled "${post.title}" to ${new Date(newIso).toLocaleString()}`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Rescheduling failed.' });
    }
  };

  const openEditModal = (post: Post) => {
    setEditingPost(post);
    const dt = new Date(post.scheduledTime || post.publishedTime || post.createdAt);
    setEditDate(!isNaN(dt.getTime()) ? dt.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    setEditTime(!isNaN(dt.getTime()) ? dt.toTimeString().slice(0, 5) : '18:00');
    setEditStatus(post.status);
  };

  const saveEditModal = async () => {
    if (!editingPost?.id || !editDate) return;
    const iso = new Date(`${editDate}T${editTime || '18:00'}`).toISOString();
    try {
      await updateDoc(doc(db, 'posts', editingPost.id), {
        scheduledTime: iso,
        status: editStatus,
        updatedAt: new Date().toISOString(),
      });
      setPosts((prev) =>
        prev.map((p) =>
          p.id === editingPost.id ? { ...p, scheduledTime: iso, status: editStatus } : p
        )
      );
      setEditingPost(null);
      triggerSchedulerTick().catch(() => {});
      setFeedback({ type: 'success', message: 'Calendar slot updated.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Failed updating slot.' });
    }
  };

  // Date navigation
  const navigatePeriod = (dir: -1 | 1) => {
    const next = new Date(currentDate);
    if (viewMode === 'day') next.setDate(next.getDate() + dir);
    else if (viewMode === 'week') next.setDate(next.getDate() + dir * 7);
    else next.setMonth(next.getMonth() + dir);
    setCurrentDate(next);
  };

  const filteredPosts = posts.filter((p) => {
    if (selectedFormatFilter !== 'all' && p.format !== selectedFormatFilter) return false;
    if (selectedStatusFilter !== 'all' && p.status !== selectedStatusFilter) return false;
    return true;
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  // Week days around currentDate
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
  const weekDates = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  const getPostsForDateStr = (dateStr: string) =>
    filteredPosts.filter((p) => {
      const postDate = p.scheduledTime || p.publishedTime || p.createdAt;
      if (!postDate) return false;
      const d = new Date(postDate);
      if (isNaN(d.getTime())) return postDate.startsWith(dateStr);
      const localYmd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
      ).padStart(2, '0')}`;
      return localYmd === dateStr;
    });

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

  const currentYmd = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(currentDate.getDate()).padStart(2, '0')}`;

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      {/* Top Header & Calendar Controls */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {viewMode === 'day'
                ? currentDate.toDateString()
                : `${monthNames[month]} ${year}`}
            </h2>
            <p className="text-xs text-slate-400">
              {filteredPosts.length} posts • Drag & drop posts between days to reschedule •{' '}
              {Intl.DateTimeFormat().resolvedOptions().timeZone}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
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

          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
            {(['day', 'week', 'month', 'list'] as CalendarViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2.5 py-1 rounded-lg font-medium capitalize transition ${
                  viewMode === mode
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => navigatePeriod(-1)}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold"
            >
              Today
            </button>
            <button
              onClick={() => navigatePeriod(1)}
              className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => onNavigate('composer')}
            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Schedule</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
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
        <div className="p-10 text-center text-xs text-slate-400">Loading calendar posts...</div>
      ) : viewMode === 'month' ? (
        <div className="p-4 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs font-semibold text-slate-400">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="min-h-[95px] rounded-xl bg-slate-50/50 dark:bg-slate-950/20"
              />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNumber = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(
                dayNumber
              ).padStart(2, '0')}`;
              const dayPosts = getPostsForDateStr(dateStr);
              const isToday =
                new Date().getDate() === dayNumber &&
                new Date().getMonth() === month &&
                new Date().getFullYear() === year;

              return (
                <div
                  key={dayNumber}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (!draggedPostId) return;
                    const dragged = posts.find((p) => p.id === draggedPostId);
                    setDraggedPostId(null);
                    if (dragged) reschedulePostToDate(dragged, dateStr);
                  }}
                  className={`min-h-[105px] p-2 rounded-xl border flex flex-col justify-between transition ${
                    isToday
                      ? 'bg-purple-500/5 border-purple-500/40'
                      : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800/80 hover:border-purple-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-bold ${
                        isToday ? 'text-purple-400' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {dayNumber}
                    </span>
                    {dayPosts.length > 0 && (
                      <span className="text-[10px] px-1.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold">
                        {dayPosts.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 overflow-y-auto max-h-[85px] custom-scrollbar">
                    {dayPosts.map((post) => (
                      <div
                        key={post.id}
                        draggable={Boolean(post.id)}
                        onDragStart={() => post.id && setDraggedPostId(post.id)}
                        onClick={() => openEditModal(post)}
                        className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 cursor-grab active:cursor-grabbing text-[10px] truncate flex items-center justify-between gap-1"
                        title="Click to edit/reschedule or drag to another day"
                      >
                        <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                          {post.title}
                        </span>
                        <span
                          className={`px-1 rounded text-[9px] shrink-0 border ${getStatusBadge(
                            post.status
                          )}`}
                        >
                          {post.format}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : viewMode === 'week' ? (
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
          {weekDates.map((d) => {
            const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
              2,
              '0'
            )}-${String(d.getDate()).padStart(2, '0')}`;
            const dayPosts = getPostsForDateStr(ymd);
            return (
              <div
                key={ymd}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (!draggedPostId) return;
                  const dragged = posts.find((p) => p.id === draggedPostId);
                  setDraggedPostId(null);
                  if (dragged) reschedulePostToDate(dragged, ymd);
                }}
                className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 min-h-[260px] space-y-2"
              >
                <div className="pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                  </span>
                  <span className="text-[10px] text-purple-400 font-semibold">
                    {dayPosts.length}
                  </span>
                </div>
                {dayPosts.map((post) => (
                  <div
                    key={post.id}
                    draggable={Boolean(post.id)}
                    onDragStart={() => post.id && setDraggedPostId(post.id)}
                    onClick={() => openEditModal(post)}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 cursor-grab text-xs space-y-1"
                  >
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold border ${getStatusBadge(
                        post.status
                      )}`}
                    >
                      {post.format} • {post.status}
                    </span>
                    <p className="font-semibold text-slate-900 dark:text-white line-clamp-2">
                      {post.title}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      {post.scheduledTime
                        ? new Date(post.scheduledTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </p>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : viewMode === 'day' ? (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Schedule for {currentDate.toLocaleDateString()}
          </h3>
          {getPostsForDateStr(currentYmd).length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">
              No Instagram posts planned for this day.
            </p>
          ) : (
            <div className="space-y-3">
              {getPostsForDateStr(currentYmd).map((post) => (
                <div
                  key={post.id}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
                >
                  <div>
                    <span className="text-[10px] font-bold uppercase text-purple-400">
                      {post.format} • {post.status}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {post.title}
                    </h4>
                    <p className="text-xs text-slate-400 line-clamp-2">{post.caption}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setActivePreviewPost(post)}
                      className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEditModal(post)}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-semibold"
                    >
                      Edit Slot
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          {filteredPosts.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <CalendarIcon className="w-10 h-10 mx-auto text-slate-500 mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No content matches filters
              </p>
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
                        <span>
                          {post.scheduledTime
                            ? new Date(post.scheduledTime).toLocaleString()
                            : post.publishedTime || post.createdAt}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadge(
                        post.status
                      )}`}
                    >
                      {post.status.replace('_', ' ')}
                    </span>
                    <button
                      onClick={() => openEditModal(post)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                      title="Edit Schedule"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setActivePreviewPost(post)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                      title="Preview Post"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    {post.id &&
                      (confirmDeleteId === post.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-[10px]"
                          >
                            Keep
                          </button>
                          <button
                            onClick={() => handleDeletePost(post.id!)}
                            className="px-2 py-1 rounded bg-rose-600 text-white text-[10px] font-bold"
                          >
                            Delete
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(post.id!)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                          title="Delete Post"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit / Reschedule Slot Modal */}
      {editingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
                Edit Slot: {editingPost.title}
              </h3>
              <button
                onClick={() => setActivePreviewPost(editingPost)}
                className="text-xs text-purple-400 hover:underline flex items-center gap-1"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Date</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Time</label>
                <input
                  type="time"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="text-xs">
              <label className="block text-slate-400 mb-1">Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as PostStatus)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              >
                <option value="draft">Draft</option>
                <option value="awaiting_approval">Awaiting Approval</option>
                <option value="approved">Approved</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>

            <div className="flex items-center justify-between pt-2">
              {editingPost.id && (
                <button
                  type="button"
                  onClick={() => {
                    const id = editingPost.id!;
                    setEditingPost(null);
                    handleDeletePost(id);
                  }}
                  className="px-3 py-2 rounded-xl bg-rose-500/10 text-rose-400 text-xs font-semibold"
                >
                  Delete Post
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setEditingPost(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEditModal}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
