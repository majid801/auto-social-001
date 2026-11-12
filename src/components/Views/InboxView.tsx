import React, { useState } from 'react';
import {
  MessageSquare,
  Sparkles,
  Send,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Instagram,
  ShieldCheck,
  Bot,
} from 'lucide-react';
import { runInstagramAgentSkill } from '../../services/api';

export const InboxView: React.FC = () => {
  const [followerComment, setFollowerComment] = useState<string>('');
  const [isGeneratingReply, setIsGeneratingReply] = useState<boolean>(false);
  const [replySuggestions, setReplySuggestions] = useState<string[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleGenerateReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!followerComment.trim()) return;

    setIsGeneratingReply(true);
    try {
      const res = await runInstagramAgentSkill('ig-reply', followerComment);
      if (res.success && res.output) {
        // Parse or format into suggestions
        const lines = res.output
          .split('\n')
          .filter((l: string) => l.trim().length > 0 && !l.startsWith('#'))
          .map((l: string) => l.replace(/^[0-9]+[.)]\s*/, '').replace(/^"|"$/g, '').trim());

        setReplySuggestions(lines.slice(0, 3));
      }
    } catch (err) {
      console.error('Reply suggestion error:', err);
    } finally {
      setIsGeneratingReply(false);
    }
  };

  const copyReply = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in pb-12">
      {/* Top Header */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Instagram Inbox & Comment Hub
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Direct message workflows and Gemini AI comment reply assistant.
            </p>
          </div>
        </div>
      </div>

      {/* Official Provider Notice per Part 14 */}
      <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          Direct Instagram Messaging API Status
        </div>
        <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
          Publora is designed for scheduled feed and reel publishing. Live webhook syncing of private Instagram Direct Messages requires dedicated Meta Graph API Webhooks permissions. To ensure zero account risk, AutoSocial AI does not use unauthorized browser scraping.
        </p>
      </div>

      {/* AI Smart Comment Reply Generator */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            AI Smart Reply & Engagement Assistant
          </h3>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Paste any follower comment or DM question to generate 3 high-converting, personalized creator replies that foster community growth.
        </p>

        <form onSubmit={handleGenerateReply} className="space-y-3">
          <textarea
            rows={3}
            value={followerComment}
            onChange={(e) => setFollowerComment(e.target.value)}
            placeholder='e.g. "What laptop do you recommend for studying AI engineering under $1000?"'
            className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-hidden focus:border-purple-500 transition resize-none"
          />

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isGeneratingReply || !followerComment.trim()}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-md shadow-purple-600/20 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {isGeneratingReply ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Synthesizing Replies...</span>
                </>
              ) : (
                <>
                  <Bot className="w-3.5 h-3.5" />
                  <span>Generate Reply Variations</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Reply Variations Output */}
        {replySuggestions.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block">
              Creator Reply Options
            </span>

            {replySuggestions.map((reply, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 text-xs"
              >
                <p className="text-slate-800 dark:text-slate-200 leading-relaxed flex-1">
                  "{reply}"
                </p>
                <button
                  onClick={() => copyReply(reply, idx)}
                  className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-purple-600 hover:text-white text-slate-700 dark:text-slate-300 text-[11px] font-semibold flex items-center gap-1 transition shrink-0"
                >
                  {copiedIdx === idx ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedIdx === idx ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
