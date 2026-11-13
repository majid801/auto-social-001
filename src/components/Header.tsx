import React from 'react';
import { Menu, Sparkles, Instagram, Key, RefreshCw, Search } from 'lucide-react';
import { NavTab } from './Sidebar';

interface HeaderProps {
  currentTab: NavTab;
  onOpenMobileSidebar: () => void;
  onQuickCreate: () => void;
  onOpenCommandCentre: () => void;
  isPubloraConnected: boolean;
  onRefreshPublora: () => void;
  isRefreshingPublora: boolean;
  onOpenAccountSetup: () => void;
}

const TAB_TITLES: Record<NavTab, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Central AI command bar, Instagram pipeline overview & live provider status',
  },
  'command-centre': {
    title: 'AI Search & Command Centre',
    subtitle: 'Natural-language AI router & command execution across all Instagram workflows',
  },
  accounts: {
    title: 'Instagram Account',
    subtitle: 'Real connected Instagram profile via Publora v1 API',
  },
  'content-studio': {
    title: 'AI Content Studio',
    subtitle: 'Generate captions, hashtags, hooks, scripts, ideas & calendars with Gemini',
  },
  'image-generator': {
    title: 'AI Image Generator',
    subtitle: 'Create Instagram feed graphics, carousel visuals, and covers',
  },
  'video-reels': {
    title: 'Reels & Video Studio',
    subtitle: 'AI video generation, scene-by-scene scripts, voiceovers & retention hooks',
  },
  'carousel-creator': {
    title: 'Carousel Creator',
    subtitle: 'Design 2-10 slide Instagram carousels with per-slide copy & visuals',
  },
  'story-creator': {
    title: 'Story Creator',
    subtitle: 'Build interactive 9:16 Instagram Story frames with stickers & CTAs',
  },
  composer: {
    title: 'Unified Post Composer',
    subtitle: 'Assemble media, validate Instagram format rules, preview & schedule or publish',
  },
  calendar: {
    title: 'Content Calendar',
    subtitle: 'Daily, Weekly, Monthly & List views with drag-and-drop rescheduling',
  },
  drafts: {
    title: 'Drafts & Approval',
    subtitle: 'Review, edit, duplicate, and approve content before publishing',
  },
  scheduled: {
    title: 'Scheduled Posts Queue',
    subtitle: 'Manage queued Instagram posts, reschedule times & reconcile Publora status',
  },
  automations: {
    title: 'Automation Centre',
    subtitle: 'Autonomous server-side scheduled content & publishing workflows',
  },
  media: {
    title: 'Media Library',
    subtitle: 'Search, sort, rename, preview & manage uploaded and AI-generated assets',
  },
  analytics: {
    title: 'Instagram Analytics',
    subtitle: 'Real publishing metrics & transparent provider capability reporting',
  },
  inbox: {
    title: 'Instagram Inbox',
    subtitle: 'AI smart comment replies & transparent DM API availability',
  },
  skills: {
    title: 'Agent Skills Centre',
    subtitle: '13 specialized Instagram AI workflows with history & draft export',
  },
  monetization: {
    title: 'Brand Campaigns & Revenue',
    subtitle: 'Track sponsorships, deliverables, invoices & collaboration income',
  },
  history: {
    title: 'Publishing History',
    subtitle: 'Publora postGroupId audit trail, status sync & retry controls',
  },
  settings: {
    title: 'Settings & Rules',
    subtitle: 'Publora configuration, timezones & approved automatic publishing rules',
  },
};

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenMobileSidebar,
  onQuickCreate,
  onOpenCommandCentre,
  isPubloraConnected,
  onRefreshPublora,
  isRefreshingPublora,
  onOpenAccountSetup,
}) => {
  const currentInfo = TAB_TITLES[currentTab] || {
    title: 'AutoSocial AI',
    subtitle: 'Instagram Automation Platform',
  };

  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 transition-colors">
      <div className="flex items-center justify-between gap-4">
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

        <div className="flex items-center gap-2">
          {currentTab !== 'command-centre' && (
            <button
              onClick={onOpenCommandCentre}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-purple-500/10 hover:border-purple-500/40 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-xs font-medium transition"
              title="Open AI Search & Command Bar (Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5 text-purple-400" />
              <span>AI Command...</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-900 text-[10px] font-mono text-slate-400">
                ⌘K
              </kbd>
            </button>
          )}

          <button
            onClick={onOpenAccountSetup}
            className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
              isPubloraConnected
                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
                : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/20'
            }`}
          >
            <Instagram className="w-3.5 h-3.5" />
            <span>{isPubloraConnected ? 'Publora Connected' : 'Publora Setup'}</span>
            {!isPubloraConnected && <Key className="w-3 h-3 ml-0.5" />}
          </button>

          <button
            onClick={onRefreshPublora}
            disabled={isRefreshingPublora}
            className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
            title="Refresh Publora connection"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshingPublora ? 'animate-spin text-purple-500' : ''}`}
            />
          </button>

          {currentTab !== 'composer' && (
            <button
              onClick={onQuickCreate}
              className="flex items-center gap-1.5 px-3.5 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-purple-600/25 transition active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              <span>Compose Post</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
