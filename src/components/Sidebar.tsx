import React from 'react';
import {
  LayoutDashboard,
  Instagram,
  Sparkles,
  Image as ImageIcon,
  Film,
  Calendar,
  FileText,
  Zap,
  FolderOpen,
  BarChart3,
  MessageSquare,
  Wand2,
  DollarSign,
  History,
  Settings,
  LogOut,
  Moon,
  Sun,
  Search,
  Layers,
  Smartphone,
  PenSquare,
  Clock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type NavTab =
  | 'dashboard'
  | 'command-centre'
  | 'accounts'
  | 'content-studio'
  | 'image-generator'
  | 'video-reels'
  | 'carousel-creator'
  | 'story-creator'
  | 'composer'
  | 'calendar'
  | 'drafts'
  | 'scheduled'
  | 'automations'
  | 'media'
  | 'analytics'
  | 'inbox'
  | 'skills'
  | 'monetization'
  | 'history'
  | 'settings';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  isPubloraConnected: boolean;
  instagramUsername?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isOpen,
  onClose,
  isDarkMode,
  onToggleTheme,
  isPubloraConnected,
  instagramUsername,
}) => {
  const { user, logout } = useAuth();

  const navGroups: Array<{
    group: string;
    items: Array<{ id: NavTab; label: string; icon: any; badge?: string; highlight?: boolean }>;
  }> = [
    {
      group: 'Overview & Command',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'command-centre', label: 'AI Command Centre', icon: Search, highlight: true },
        {
          id: 'accounts',
          label: 'Instagram Account',
          icon: Instagram,
          badge: isPubloraConnected ? 'Connected' : 'Offline',
        },
      ],
    },
    {
      group: 'Creation Studios',
      items: [
        { id: 'content-studio', label: 'AI Content Studio', icon: Sparkles, highlight: true },
        { id: 'image-generator', label: 'AI Image Generator', icon: ImageIcon },
        { id: 'video-reels', label: 'Reels & Video Studio', icon: Film },
        { id: 'carousel-creator', label: 'Carousel Creator', icon: Layers },
        { id: 'story-creator', label: 'Story Creator', icon: Smartphone },
        { id: 'composer', label: 'Post Composer', icon: PenSquare },
      ],
    },
    {
      group: 'Schedule & Automation',
      items: [
        { id: 'calendar', label: 'Content Calendar', icon: Calendar },
        { id: 'drafts', label: 'Drafts & Approval', icon: FileText },
        { id: 'scheduled', label: 'Scheduled Queue', icon: Clock },
        { id: 'automations', label: 'Automation Centre', icon: Zap },
        { id: 'history', label: 'Publishing History', icon: History },
      ],
    },
    {
      group: 'Assets, Growth & Ops',
      items: [
        { id: 'media', label: 'Media Library', icon: FolderOpen },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
        { id: 'inbox', label: 'Instagram Inbox', icon: MessageSquare },
        { id: 'skills', label: 'Agent Skills (13)', icon: Wand2 },
        { id: 'monetization', label: 'Brand Campaigns', icon: DollarSign },
        { id: 'settings', label: 'Settings', icon: Settings },
      ],
    },
  ];

  const handleNavClick = (id: NavTab) => {
    onSelectTab(id);
    onClose();
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 flex flex-col bg-slate-900 border-r border-slate-800 text-slate-300 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo & Branding */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
              <Instagram className="w-6 h-6" />
            </div>
            <div>
              <div className="font-extrabold text-white text-lg tracking-tight flex items-center gap-1.5">
                AutoSocial{' '}
                <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-semibold border border-purple-500/30">
                  AI
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Instagram-Only Automation</p>
            </div>
          </div>
        </div>

        {/* Live Instagram Account Card */}
        <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-400 flex items-center gap-1 font-medium">
              <Instagram className="w-3.5 h-3.5 text-pink-400" /> Account Status
            </span>
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                isPubloraConnected
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isPubloraConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              {isPubloraConnected ? 'Publora Active' : 'Setup Required'}
            </span>
          </div>
          <div className="text-xs font-semibold text-white truncate">
            {instagramUsername ? `@${instagramUsername}` : 'No Instagram Linked'}
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4 custom-scrollbar">
          {navGroups.map((group) => (
            <div key={group.group} className="space-y-1">
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {group.group}
              </p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/25'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={`w-4 h-4 ${
                          isActive
                            ? 'text-white'
                            : item.highlight
                            ? 'text-purple-400'
                            : 'text-slate-400'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          isPubloraConnected
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                    {item.highlight && !isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User profile & actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 space-y-3">
          <div className="flex items-center justify-between">
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition text-xs flex items-center gap-2"
              title="Toggle theme"
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-300" />
              )}
              <span className="text-xs">{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
            </button>

            <button
              onClick={logout}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition text-xs flex items-center gap-1.5"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>

          {user && (
            <div className="flex items-center gap-2.5 pt-2 border-t border-slate-800/80">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User'}
                  className="w-8 h-8 rounded-full border border-purple-500/40"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-purple-600/30 text-purple-300 font-bold flex items-center justify-center text-xs border border-purple-500/40">
                  {user.email?.[0].toUpperCase() || 'U'}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">
                  {user.displayName || 'Instagram Creator'}
                </p>
                <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
