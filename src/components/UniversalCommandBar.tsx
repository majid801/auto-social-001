import React, { useState } from 'react';
import {
  Search,
  Sparkles,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  FileText,
  Image as ImageIcon,
  Calendar,
  Instagram,
  Film,
  Layers,
  Smartphone,
  X,
} from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { parseUniversalCommand, fetchMediaList } from '../services/api';
import { ParsedCommandIntent, Post } from '../types';
import { NavTab } from './Sidebar';

interface UniversalCommandBarProps {
  onNavigate: (tab: NavTab) => void;
  instagramAccount?: any;
  isPubloraConnected?: boolean;
  compact?: boolean;
  onCommandExecuted?: (command: string, intent: ParsedCommandIntent) => void;
}

const SAMPLE_COMMANDS = [
  'Create an Instagram Reel about artificial intelligence',
  'Generate an image about machine learning',
  'Write a caption about my new product',
  'Generate 20 Instagram content ideas',
  'Create a seven-day content calendar',
  'Show my scheduled posts',
  'Show my drafts',
  'Find my generated images',
  'Create a carousel about Python programming',
  'Show my Instagram account status',
];

const VALID_TABS: NavTab[] = [
  'dashboard',
  'command-centre',
  'accounts',
  'content-studio',
  'image-generator',
  'video-reels',
  'carousel-creator',
  'story-creator',
  'composer',
  'calendar',
  'drafts',
  'scheduled',
  'automations',
  'media',
  'analytics',
  'inbox',
  'skills',
  'monetization',
  'history',
  'settings',
];

export const UniversalCommandBar: React.FC<UniversalCommandBarProps> = ({
  onNavigate,
  instagramAccount,
  isPubloraConnected,
  compact = false,
  onCommandExecuted,
}) => {
  const { user, userProfile } = useAuth();

  const [commandInput, setCommandInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [parsedIntent, setParsedIntent] = useState<ParsedCommandIntent | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<ParsedCommandIntent | null>(null);
  const [inlineResults, setInlineResults] = useState<{
    type: 'posts' | 'media' | 'account' | 'info';
    title: string;
    items: any[];
  } | null>(null);

  const routeToTarget = (intent: ParsedCommandIntent, rawCommand: string) => {
    const safeTab: NavTab = VALID_TABS.includes(intent.targetTab as NavTab)
      ? (intent.targetTab as NavTab)
      : 'content-studio';

    // Store rich command handoff context for destination views
    sessionStorage.setItem(
      'autosocial_command_context',
      JSON.stringify({
        command: rawCommand,
        topic: intent.topic || rawCommand,
        format: intent.contentFormat || '',
        aspectRatio: intent.aspectRatio || '',
        searchQuery: intent.searchQuery || '',
        scheduleHint: intent.scheduleHint || '',
        intentCategory: intent.intentCategory,
        autoRun: Boolean(intent.shouldAutoExecute),
        timestamp: Date.now(),
      })
    );

    if (intent.topic) {
      sessionStorage.setItem('autosocial_initial_prompt', intent.topic);
    }

    onNavigate(safeTab);
  };

  const executeQueryOrRoute = async (intent: ParsedCommandIntent, rawCommand: string) => {
    if (onCommandExecuted) {
      onCommandExecuted(rawCommand, intent);
    }

    // Account management quick card
    if (intent.intentCategory === 'account_management') {
      setInlineResults({
        type: 'account',
        title: 'Connected Instagram Account Status',
        items: [
          {
            connected: isPubloraConnected,
            username: instagramAccount?.username || 'Not linked',
            platformId: instagramAccount?.platformId || 'N/A',
            tokenStatus: instagramAccount?.tokenStatus || 'Unknown',
            expiresAt: instagramAccount?.accessTokenExpiresAt || 'N/A',
          },
        ],
      });
      return;
    }

    // Inline query previews for drafts, scheduled posts, publishing history, media search
    if (
      user &&
      ['draft_management', 'scheduling', 'calendar_management'].includes(intent.intentCategory) &&
      intent.actionType === 'query'
    ) {
      try {
        const snap = await getDocs(
          query(collection(db, 'posts'), where('userId', '==', user.uid))
        );
        let posts = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Post[];
        posts.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

        if (intent.intentCategory === 'draft_management') {
          posts = posts.filter((p) =>
            ['draft', 'awaiting_approval', 'approved'].includes(p.status)
          );
        } else if (intent.intentCategory === 'scheduling') {
          posts = posts.filter((p) => p.status === 'scheduled' || p.status === 'approved');
        }

        if (intent.searchQuery) {
          const sq = intent.searchQuery.toLowerCase();
          posts = posts.filter(
            (p) =>
              p.title?.toLowerCase().includes(sq) ||
              p.caption?.toLowerCase().includes(sq) ||
              p.topic?.toLowerCase().includes(sq)
          );
        }

        setInlineResults({
          type: 'posts',
          title: intent.summary || 'Matching Posts',
          items: posts.slice(0, 6),
        });
        return;
      } catch (err) {
        console.error('Command post query error:', err);
      }
    }

    if (intent.intentCategory === 'media_search') {
      try {
        const mediaRes = await fetchMediaList();
        let files = mediaRes.files || [];
        if (rawCommand.toLowerCase().includes('generated')) {
          files = files.filter((f: any) => f.filename.startsWith('ai-'));
        }
        if (intent.searchQuery) {
          const sq = intent.searchQuery.toLowerCase();
          const filtered = files.filter((f: any) => f.filename.toLowerCase().includes(sq));
          if (filtered.length > 0) files = filtered;
        }
        setInlineResults({
          type: 'media',
          title: `Media Assets Found (${files.length})`,
          items: files.slice(0, 8),
        });
        return;
      } catch (err) {
        console.error('Command media query error:', err);
      }
    }

    // Route straight into target studio/view with prefilled parameters
    routeToTarget(intent, rawCommand);
  };

  const handleSubmit = async (e?: React.FormEvent, overrideCmd?: string) => {
    if (e) e.preventDefault();
    const raw = (overrideCmd ?? commandInput).trim();
    if (!raw) return;

    if (overrideCmd) setCommandInput(overrideCmd);
    setIsProcessing(true);
    setErrorMsg(null);
    setParsedIntent(null);
    setPendingConfirm(null);
    setInlineResults(null);

    try {
      const res = await parseUniversalCommand(raw);
      if (!res.success || !res.intent) {
        setErrorMsg(res.error || 'Unable to parse command. Check GEMINI_API_KEY configuration.');
        return;
      }

      const intent: ParsedCommandIntent = res.intent;
      setParsedIntent(intent);

      // Publishing or destructive safety gate
      if (
        intent.requiresConfirmation &&
        !(intent.intentCategory === 'publishing' && userProfile?.autoPublishApproved)
      ) {
        setPendingConfirm(intent);
        return;
      }

      await executeQueryOrRoute(intent, raw);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Command execution failed');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={`${
          compact ? 'p-4' : 'p-6 sm:p-7'
        } rounded-2xl bg-gradient-to-br from-purple-900/50 via-indigo-950/60 to-slate-900 border border-purple-500/30 shadow-xl relative overflow-hidden`}
      >
        <div className="absolute -top-12 -right-12 w-80 h-80 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 text-purple-300 font-bold text-[11px] tracking-wider uppercase">
                <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                <span>Universal AI Command & Search Bar</span>
              </div>
              {!compact && (
                <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-1 tracking-tight">
                  Tell AutoSocial AI what you want to create, find, schedule, or automate
                </h2>
              )}
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded-full bg-slate-950/60 border border-purple-500/30 text-purple-300 font-medium self-start">
              17-Intent Gemini Router
            </span>
          </div>

          <form onSubmit={(e) => handleSubmit(e)} className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-5 h-5 text-purple-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                placeholder='Try: "Create an Instagram Reel about AI", "Generate an image about machine learning", "Show my drafts"...'
                className="w-full pl-12 pr-10 py-3.5 rounded-xl bg-slate-950/90 border border-slate-700/80 text-white placeholder-slate-400 text-sm focus:outline-hidden focus:border-purple-400 transition shadow-inner"
              />
              {commandInput && (
                <button
                  type="button"
                  onClick={() => {
                    setCommandInput('');
                    setParsedIntent(null);
                    setInlineResults(null);
                    setPendingConfirm(null);
                    setErrorMsg(null);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isProcessing || !commandInput.trim()}
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:via-pink-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-purple-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Understanding...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Run Command</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Sample natural language chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-medium mr-1">Try:</span>
            {SAMPLE_COMMANDS.slice(0, compact ? 4 : 7).map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => handleSubmit(undefined, sample)}
                className="px-2.5 py-1 rounded-lg bg-slate-950/70 hover:bg-purple-500/20 border border-slate-800 hover:border-purple-500/40 text-slate-300 hover:text-white text-[11px] transition"
              >
                {sample}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error feedback */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">AI Command Bar Error</p>
            <p className="mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Confirmation Gate for Destructive / Publishing Actions */}
      {pendingConfirm && (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-white">Explicit Approval Required</h4>
              <p className="text-xs text-slate-300 mt-1">
                {pendingConfirm.confirmationPrompt ||
                  `Detected "${pendingConfirm.intentCategory.replace('_', ' ')}": ${pendingConfirm.summary}. Confirm before opening or executing this action.`}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setPendingConfirm(null)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const confirmed = pendingConfirm;
                setPendingConfirm(null);
                routeToTarget(confirmed, commandInput);
              }}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirm & Proceed</span>
            </button>
          </div>
        </div>
      )}

      {/* Inline Query Results Card */}
      {inlineResults && (
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-purple-500/30 shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {inlineResults.title}
              </h3>
              {parsedIntent && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-mono">
                  {parsedIntent.intentCategory}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {parsedIntent && (
                <button
                  onClick={() => routeToTarget(parsedIntent, commandInput)}
                  className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1"
                >
                  <span>Open Full View</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setInlineResults(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {inlineResults.type === 'account' && inlineResults.items[0] && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <Instagram className="w-6 h-6 text-pink-500" />
                <div>
                  <p className="font-bold text-slate-900 dark:text-white">
                    @{inlineResults.items[0].username}
                  </p>
                  <p className="text-slate-400">
                    Platform ID: {inlineResults.items[0].platformId} • Token:{' '}
                    {inlineResults.items[0].tokenStatus}
                  </p>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                  inlineResults.items[0].connected
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-amber-500/15 text-amber-400'
                }`}
              >
                {inlineResults.items[0].connected ? 'Active via Publora' : 'Not Connected'}
              </span>
            </div>
          )}

          {inlineResults.type === 'posts' && (
            inlineResults.items.length === 0 ? (
              <p className="text-xs text-slate-400">No matching posts found in your workspace.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {inlineResults.items.map((p: Post) => (
                  <div
                    key={p.id}
                    onClick={() =>
                      onNavigate(
                        p.status === 'scheduled' ? 'scheduled' : p.status === 'published' ? 'history' : 'drafts'
                      )
                    }
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-purple-500/50 cursor-pointer transition space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="uppercase font-bold text-purple-400">{p.format}</span>
                      <span className="text-slate-400">{p.status.replace('_', ' ')}</span>
                    </div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {p.title}
                    </p>
                    <p className="text-[11px] text-slate-400 line-clamp-2">{p.caption}</p>
                  </div>
                ))}
              </div>
            )
          )}

          {inlineResults.type === 'media' && (
            inlineResults.items.length === 0 ? (
              <p className="text-xs text-slate-400">No matching media files found in /uploads.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {inlineResults.items.map((m: any) => (
                  <div
                    key={m.url}
                    onClick={() => onNavigate('media')}
                    className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 cursor-pointer hover:border-purple-500/50 transition"
                  >
                    <div className="aspect-square bg-black">
                      {m.mediaType === 'video' ? (
                        <video src={m.url} className="w-full h-full object-cover" />
                      ) : (
                        <img src={m.url} alt={m.filename} className="w-full h-full object-cover" />
                      )}
                    </div>
                    <p className="p-2 text-[10px] text-slate-300 truncate">{m.filename}</p>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};
