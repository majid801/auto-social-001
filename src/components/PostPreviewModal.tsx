import React, { useState, useEffect } from 'react';
import {
  X,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  Music,
  Volume2,
  Instagram,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Post } from '../types';

interface PostPreviewModalProps {
  post: Post | null;
  isOpen: boolean;
  onClose: () => void;
  username?: string;
  userAvatar?: string;
}

export const PostPreviewModal: React.FC<PostPreviewModalProps> = ({
  post,
  isOpen,
  onClose,
  username = 'creator_profile',
  userAvatar,
}) => {
  const [activeMediaIdx, setActiveMediaIdx] = useState<number>(0);

  useEffect(() => {
    setActiveMediaIdx(0);
  }, [post?.id, isOpen]);

  if (!isOpen || !post) return null;

  const isReel = post.format === 'reel' || post.format === 'video';
  const isStory = post.format === 'story';
  const isCarousel = post.format === 'carousel';

  const mediaList =
    post.mediaUrls && post.mediaUrls.length > 0
      ? post.mediaUrls
      : post.mediaUrl
      ? [post.mediaUrl]
      : [];

  const currentMedia = mediaList[activeMediaIdx] || '';
  const currentIsVideo =
    post.mediaType === 'video' || currentMedia.toLowerCase().endsWith('.mp4');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-sm sm:max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2">
            <Instagram className="w-4 h-4 text-pink-500" />
            <span className="text-xs font-semibold text-white tracking-wide uppercase">
              Instagram {isReel ? 'Reels' : isStory ? 'Story' : isCarousel ? 'Carousel' : 'Feed'} Preview
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instagram App UI */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-4 bg-black text-white">
          {/* Post Header */}
          <div className="flex items-center justify-between pb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-[2px]">
                {userAvatar ? (
                  <img
                    src={userAvatar}
                    alt={username}
                    className="w-full h-full rounded-full object-cover bg-black"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold">
                    {username.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-white tracking-tight">@{username}</p>
                {(post.scheduledTime || post.suggestedPostingTime) && (
                  <p className="text-[10px] text-slate-400">
                    Scheduled:{' '}
                    {post.scheduledTime
                      ? new Date(post.scheduledTime).toLocaleString()
                      : post.suggestedPostingTime}
                  </p>
                )}
              </div>
            </div>
            <MoreHorizontal className="w-4 h-4 text-slate-400" />
          </div>

          {/* Media Area */}
          <div className="relative w-full rounded-2xl overflow-hidden bg-slate-950 aspect-square sm:aspect-4/5 flex items-center justify-center border border-slate-800/80">
            {currentMedia ? (
              currentIsVideo ? (
                <video
                  src={currentMedia}
                  controls
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={currentMedia}
                  alt={post.title}
                  className="w-full h-full object-cover"
                />
              )
            ) : (
              <div className="p-6 text-center text-slate-500">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-purple-400">
                  <Instagram className="w-7 h-7" />
                </div>
                <p className="text-xs font-medium text-slate-300 mb-1">{post.title}</p>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  {post.visualStyle || 'Visual media preview will appear here upon upload or AI generation.'}
                </p>
                {isReel && (
                  <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 text-[10px] border border-purple-500/30">
                    <Music className="w-3 h-3" />
                    <span>{post.musicDescription || 'Trending Audio Suggestion'}</span>
                  </div>
                )}
              </div>
            )}

            {/* Carousel multi-slide controls */}
            {mediaList.length > 1 && (
              <>
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/70 text-white text-[10px] font-semibold">
                  {activeMediaIdx + 1} / {mediaList.length}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setActiveMediaIdx((prev) => (prev - 1 + mediaList.length) % mediaList.length)
                  }
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMediaIdx((prev) => (prev + 1) % mediaList.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}

            {isReel && (
              <div className="absolute bottom-3 right-3 p-1.5 rounded-full bg-black/60 text-white backdrop-blur-xs">
                <Volume2 className="w-3.5 h-3.5" />
              </div>
            )}
          </div>

          {/* Carousel dot indicators */}
          {mediaList.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 pt-2.5">
              {mediaList.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveMediaIdx(i)}
                  className={`w-1.5 h-1.5 rounded-full transition ${
                    i === activeMediaIdx ? 'bg-purple-400 scale-125' : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Interaction Bar */}
          <div className="flex items-center justify-between pt-3 pb-2">
            <div className="flex items-center gap-4">
              <button className="text-white hover:text-red-500 transition">
                <Heart className="w-5 h-5" />
              </button>
              <button className="text-white hover:text-slate-300 transition">
                <MessageCircle className="w-5 h-5" />
              </button>
              <button className="text-white hover:text-slate-300 transition">
                <Send className="w-5 h-5" />
              </button>
            </div>
            <button className="text-white hover:text-slate-300 transition">
              <Bookmark className="w-5 h-5" />
            </button>
          </div>

          {/* Caption & Hashtags */}
          <div className="space-y-1.5 text-xs text-slate-200">
            {post.hook && (
              <p className="font-bold text-white bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                {post.hook}
              </p>
            )}

            <div className="whitespace-pre-line leading-relaxed text-[11px] sm:text-xs">
              <span className="font-semibold text-white mr-1.5">@{username}</span>
              {post.caption}
            </div>

            {post.cta && (
              <p className="text-purple-400 font-medium text-[11px]">
                {post.cta}
              </p>
            )}

            {post.hashtags && (
              <p className="text-indigo-400/90 text-[11px] font-medium leading-relaxed">
                {post.hashtags}
              </p>
            )}
          </div>

          {/* Reel script breakdown if present */}
          {post.script && (
            <div className="mt-4 pt-3 border-t border-slate-800/80">
              <p className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider mb-2">
                Reel Script Breakdown
              </p>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
                {post.script}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 bg-slate-950 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
