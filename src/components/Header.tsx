import React from 'react';
import { Menu, Sparkles, Instagram, Key, RefreshCw } from 'lucide-react';
import { NavTab } from './Sidebar';

interface HeaderProps {
  currentTab: NavTab;
  onOpenMobileSidebar: () => void;
  onQuickCreate: () => void;
  isPubloraConnected: boolean;
  onRefreshPublora: () => void;
  isRefreshingPublora: boolean;
  onOpenAccountSetup: () => void;
}

const TAB_TITLES: Record<NavTab, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Overview of your Instagram automation pipeline & activity' },
  accounts: { title: 'Instagram Account', subtitle: 'Real connected Instagram profile via Publora API' },
  'content-studio': { title: 'AI Content Studio', subtitle: 'Generate high-converting Reels, posts, carousels, and stories with Gemini' },
  'image-generator': { title: 'AI Image Generator', subtitle: 'Create aesthetic Instagram-optimized graphics and backgrounds' },
  'video-reels': { title: 'Reels & Video Studio', subtitle: 'Scene-by-scene scriptwriting, voiceover, hooks, and video assets' },
  calendar: { title: 'Content Calendar', subtitle: 'Schedule, visualize, and reschedule planned Instagram content' },
  drafts: { title: 'Drafts & Approval', subtitle: 'Review, edit, and approve content before publishing' },
  automations: { title: 'Automation Centre', subtitle: 'Autonomous 24/7 background content workflows and scheduled jobs' },
  media: { title: 'Media Library', subtitle: 'Manage verified uploaded and AI-generated image & video assets' },
  analytics: { title: 'Instagram Analytics', subtitle: 'Real performance metrics and provider capability reporting' },
  inbox: { title: 'Instagram Inbox', subtitle: 'Comments and Direct Message management with AI reply suggestions' },
  skills: { title: 'Agent Skills Centre', subtitle: '13 specialized open-source Instagram AI tools and workflows' },
  monetization: { title: 'Brand Campaigns & Revenue', subtitle: 'Track sponsorships, deliverables, and collaboration income' },
  history: { title: 'Publishing History', subtitle: 'Live log of every post submission, provider ID, and status' },
  settings: { title: 'Settings & API Keys', subtitle: 'Publora key, Gemini status, timezones, and auto-publishing rules' },
};

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenMobileSidebar,
  onQuickCreate,
  isPubloraConnected,
  onRefreshPublora,
  isRefreshingPublora,
  onOpenAccountSetup,
}) => {
  const currentInfo = TAB_TITLES[currentTab] || { title: 'AutoSocial AI', subtitle: 'Instagram Automation Platform' };

  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 transition-colors">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Mobile hamburger & title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileSidebar}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden transition"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              {currentInfo.title}
            </h1>
            <p className="hidden sm:block text-xs text-slate-500 dark:text-slate-400">
              {currentInfo.subtitle}
            </p>
          </div>
        </div>

        {/* Right: Publora Badge + Actions */}
        <div className="flex items-center gap-2.5">
          {/* Publora Status Button */}
          <button
            onClick={onOpenAccountSetup}
            className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
              isPubloraConnected
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
                : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/20'
            }`}
          >
            <Instagram className="w-3.5 h-3.5" />
            <span>{isPubloraConnected ? 'Publora Connected' : 'Publora API Setup'}</span>
            {!isPubloraConnected && <Key className="w-3 h-3 ml-0.5" />}
          </button>

          {/* Refresh connection status */}
          <button
            onClick={onRefreshPublora}
            disabled={isRefreshingPublora}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
            title="Refresh Publora connection"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshingPublora ? 'animate-spin text-purple-500' : ''}`} />
          </button>

          {/* Quick Create Button */}
          {currentTab !== 'content-studio' && (
            <button
              onClick={onQuickCreate}
              className="flex items-center gap-1.5 px-3.5 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-purple-600/25 transition active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              <span>Create Content</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
