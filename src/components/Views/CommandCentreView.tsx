import React, { useState, useEffect } from 'react';
import {
  Search,
  Sparkles,
  History,
  Layers,
  Film,
  Image as ImageIcon,
  Calendar,
  FileText,
  Clock,
  Instagram,
  Zap,
  BarChart3,
  MessageSquare,
  Wand2,
  Settings,
  PenSquare,
  Smartphone,
  ArrowRight,
  Trash2,
} from 'lucide-react';
import { UniversalCommandBar } from '../UniversalCommandBar';
import { ParsedCommandIntent } from '../../types';
import { NavTab } from '../Sidebar';

interface CommandCentreViewProps {
  onNavigate: (tab: NavTab) => void;
  instagramAccount: any;
  isPubloraConnected: boolean;
}

interface CommandHistoryEntry {
  id: string;
  command: string;
  intentCategory: string;
  targetTab: string;
  summary: string;
  timestamp: string;
}

const CAPABILITY_CARDS: Array<{
  category: string;
  label: string;
  example: string;
  icon: any;
  color: string;
}> = [
  {
    category: 'reel_creation',
    label: 'Reel Creation',
    example: 'Create an Instagram Reel about artificial intelligence',
    icon: Film,
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  },
  {
    category: 'image_generation',
    label: 'AI Image Generation',
    example: 'Generate an image about machine learning',
    icon: ImageIcon,
    color: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
  },
  {
    category: 'caption_generation',
    label: 'Caption Writing',
    example: 'Write a caption about my new product',
    icon: PenSquare,
    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  },
  {
    category: 'text_generation',
    label: '20 Content Ideas',
    example: 'Generate 20 Instagram content ideas',
    icon: Sparkles,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  },
  {
    category: 'calendar_management',
    label: '7-Day Calendar Plan',
    example: 'Create a seven-day content calendar',
    icon: Calendar,
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  },
  {
    category: 'scheduling',
    label: 'Scheduled Posts',
    example: 'Show my scheduled posts',
    icon: Clock,
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  },
  {
    category: 'draft_management',
    label: 'Drafts & Approvals',
    example: 'Show my drafts',
    icon: FileText,
    color: 'text-slate-300 bg-slate-500/10 border-slate-500/20',
  },
  {
    category: 'media_search',
    label: 'Media Search',
    example: 'Find my generated images',
    icon: Search,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    category: 'carousel_creation',
    label: 'Carousel Builder',
    example: 'Create a carousel about Python programming',
    icon: Layers,
    color: 'text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20',
  },
  {
    category: 'hashtag_generation',
    label: 'Hashtag Research',
    example: 'Generate hashtags for my latest post',
    icon: Wand2,
    color: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
  },
  {
    category: 'story_creation',
    label: 'Story Sequences',
    example: 'Create a 4-frame interactive story about behind the scenes',
    icon: Smartphone,
    color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  },
  {
    category: 'video_generation',
    label: 'AI Video Studio',
    example: 'Generate an AI video about futuristic neural networks',
    icon: Film,
    color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  },
  {
    category: 'publishing',
    label: 'Publishing & History',
    example: 'Show my Instagram publishing history',
    icon: Instagram,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  },
  {
    category: 'automation',
    label: 'Automation Centre',
    example: 'Open the automation centre',
    icon: Zap,
    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  },
  {
    category: 'account_management',
    label: 'Account Status',
    example: 'Show my Instagram account status',
    icon: Instagram,
    color: 'text-pink-400 bg-pink-500/10 border-pink-500/20',
  },
  {
    category: 'analytics',
    label: 'Analytics & Insights',
    example: 'Create a weekly content strategy',
    icon: BarChart3,
    color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  },
  {
    category: 'settings',
    label: 'System Settings',
    example: 'Open publishing rules and timezone settings',
    icon: Settings,
    color: 'text-slate-300 bg-slate-500/10 border-slate-500/20',
  },
];

export const CommandCentreView: React.FC<CommandCentreViewProps> = ({
  onNavigate,
  instagramAccount,
  isPubloraConnected,
}) => {
  const [history, setHistory] = useState<CommandHistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem('autosocial_command_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('autosocial_command_history', JSON.stringify(history.slice(0, 20)));
    } catch {
      // ignore storage errors
    }
  }, [history]);

  const handleCommandExecuted = (command: string, intent: ParsedCommandIntent) => {
    const entry: CommandHistoryEntry = {
      id: `${Date.now()}`,
      command,
      intentCategory: intent.intentCategory,
      targetTab: intent.targetTab,
      summary: intent.summary,
      timestamp: new Date().toISOString(),
    };
    setHistory((prev) => [entry, ...prev].slice(0, 20));
  };

  const triggerCapabilitySample = (sample: string, category: string) => {
    const targetMap: Record<string, NavTab> = {
      reel_creation: 'video-reels',
      image_generation: 'image-generator',
      caption_generation: 'content-studio',
      text_generation: 'content-studio',
      calendar_management: 'content-studio',
      scheduling: 'scheduled',
      draft_management: 'drafts',
      media_search: 'media',
      carousel_creation: 'carousel-creator',
      hashtag_generation: 'content-studio',
      story_creation: 'story-creator',
      video_generation: 'video-reels',
      publishing: 'history',
      automation: 'automations',
      account_management: 'accounts',
      analytics: 'analytics',
      settings: 'settings',
    };

    const formatMap: Record<string, string> = {
      text_generation: 'ideas',
      calendar_management: 'calendar',
      caption_generation: 'post',
      hashtag_generation: 'hashtags',
      carousel_creation: 'carousel',
      story_creation: 'story',
      reel_creation: 'reel',
      video_generation: 'video',
    };

    sessionStorage.setItem(
      'autosocial_command_context',
      JSON.stringify({
        command: sample,
        topic: sample,
        format: formatMap[category] || '',
        intentCategory: category,
        autoRun: true,
        timestamp: Date.now(),
      })
    );
    onNavigate(targetMap[category] || 'content-studio');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      <UniversalCommandBar
        onNavigate={onNavigate}
        instagramAccount={instagramAccount}
        isPubloraConnected={isPubloraConnected}
        onCommandExecuted={handleCommandExecuted}
      />

      {/* 17-Intent Capability Matrix */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              All 17 Supported AI Command Intents
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Click any workflow below to launch it immediately or type your own natural-language command above.
            </p>
          </div>
          <span className="text-[11px] font-mono text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-lg border border-purple-500/20">
            Powered by Gemini 4 Hydrogen Intent Router
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CAPABILITY_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.category}
                type="button"
                onClick={() => triggerCapabilitySample(card.example, card.category)}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 text-left transition group flex items-start gap-3"
              >
                <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${card.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{card.label}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-400 group-hover:translate-x-0.5 transition shrink-0" />
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    "{card.example}"
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Command Execution History */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-4 h-4 text-purple-500" />
            Recent Command Executions ({history.length})
          </h3>
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => setHistory([])}
              className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">
            Your natural-language commands and routed actions will appear here.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {history.map((item) => (
              <div key={item.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-white truncate">
                    "{item.command}"
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {item.summary}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-mono text-[10px]">
                    {item.intentCategory}
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate(item.targetTab as NavTab)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-purple-600 hover:text-white text-slate-600 dark:text-slate-300 text-[11px] font-semibold transition"
                  >
                    Open {item.targetTab}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
