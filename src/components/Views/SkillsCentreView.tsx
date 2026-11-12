import React, { useState, useEffect } from 'react';
import {
  Wand2,
  Sparkles,
  Play,
  RotateCcw,
  Copy,
  Check,
  Save,
  Search,
  ExternalLink,
  History,
  FileText,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { SkillRun } from '../../types';
import { runInstagramAgentSkill } from '../../services/api';

interface SkillDefinition {
  id: string;
  name: string;
  category: 'Strategy' | 'Copywriting' | 'Video & Reels' | 'Engagement';
  description: string;
  placeholder: string;
  iconBg: string;
}

const AGENT_SKILLS: SkillDefinition[] = [
  {
    id: 'ig-audit',
    name: 'ig-audit: Profile & Niche Audit',
    category: 'Strategy',
    description: 'Score your profile out of 100 with bio critique, visual aesthetic consistency, and top 5 immediate fixes.',
    placeholder: 'Enter your Instagram handle, bio text, and primary niche...',
    iconBg: 'bg-purple-500/10 text-purple-400',
  },
  {
    id: 'ig-viral',
    name: 'ig-viral: Virality & Hook Analyzer',
    category: 'Strategy',
    description: 'Calculates a virality score (0-100), isolates psychological triggers, and outputs 5 upgraded scroll-stopping hooks.',
    placeholder: 'Paste your content idea or draft hook to evaluate virality potential...',
    iconBg: 'bg-pink-500/10 text-pink-400',
  },
  {
    id: 'ig-caption',
    name: 'ig-caption: Viral Caption Formula',
    category: 'Copywriting',
    description: 'Generates 3 proven caption variations (Storytelling, Quick Tip, Curiosity Gap) with emoji bullet points.',
    placeholder: 'Topic: 3 habits that helped me learn Python in 30 days...',
    iconBg: 'bg-indigo-500/10 text-indigo-400',
  },
  {
    id: 'ig-human',
    name: 'ig-human: AI Copy Humanizer',
    category: 'Copywriting',
    description: 'Rewrites robotic AI text into authentic, punchy creator voice, stripping corporate buzzwords.',
    placeholder: 'Paste your draft text that feels too robotic or generic...',
    iconBg: 'bg-amber-500/10 text-amber-400',
  },
  {
    id: 'ig-profile',
    name: 'ig-profile: Bio Conversion Booster',
    category: 'Copywriting',
    description: 'Optimizes Name field SEO keywords, value proposition, social proof, and bio link CTA.',
    placeholder: 'Describe your expertise, audience, and what you want followers to do...',
    iconBg: 'bg-emerald-500/10 text-emerald-400',
  },
  {
    id: 'ig-reel',
    name: 'ig-reel: 100% Retention Reel Script',
    category: 'Video & Reels',
    description: 'Crafts 15-30s viral Reel scripts structured for high completion rate: 0-3s Hook, Rapid Value, Loop CTA.',
    placeholder: 'Reel topic: Why most people fail at prompting AI models...',
    iconBg: 'bg-rose-500/10 text-rose-400',
  },
  {
    id: 'ig-carousel',
    name: 'ig-carousel: 7-Slide Retention Deck',
    category: 'Video & Reels',
    description: 'Full educational carousel blueprint: Hook Slide 1, value delivery slides 2-6, and Save/Share CTA Slide 7.',
    placeholder: 'Carousel topic: The 2026 Roadmap to becoming an AI Software Engineer...',
    iconBg: 'bg-blue-500/10 text-blue-400',
  },
  {
    id: 'ig-story',
    name: 'ig-story: Interactive Story Sequence',
    category: 'Engagement',
    description: 'Generates 4-frame interactive story sequences designed for sticker interactions, polls, and DM replies.',
    placeholder: 'Topic: Asking followers about their favorite tech stack...',
    iconBg: 'bg-teal-500/10 text-teal-400',
  },
  {
    id: 'ig-comment',
    name: 'ig-comment: Networking Comments',
    category: 'Engagement',
    description: 'Generates 5 thoughtful, non-spammy networking comments to leave on authority accounts in your niche.',
    placeholder: 'Topic or creator post you want to leave an insightful comment on...',
    iconBg: 'bg-violet-500/10 text-violet-400',
  },
  {
    id: 'ig-reply',
    name: 'ig-reply: Comment Reply Synthesizer',
    category: 'Engagement',
    description: 'Crafts witty, conversational replies to follower comments to boost Instagram engagement algorithmic ranking.',
    placeholder: 'Follower comment: "Does this really work on Android?"...',
    iconBg: 'bg-sky-500/10 text-sky-400',
  },
  {
    id: 'ig-plan',
    name: 'ig-plan: 7-Day Growth Roadmap',
    category: 'Strategy',
    description: 'Prepares a structured weekly Instagram content schedule with format allocation and hooks.',
    placeholder: 'Your niche, current follower count, and primary growth goal for the week...',
    iconBg: 'bg-cyan-500/10 text-cyan-400',
  },
  {
    id: 'ig-repurpose',
    name: 'ig-repurpose: Omnichannel Converter',
    category: 'Copywriting',
    description: 'Transforms a single article, video transcript, or thought into Reel + Carousel + Feed + Story.',
    placeholder: 'Paste an excerpt or summary of long-form content to repurpose...',
    iconBg: 'bg-fuchsia-500/10 text-fuchsia-400',
  },
  {
    id: 'ig-dm',
    name: 'ig-dm: Direct Message Nurture Sequence',
    category: 'Engagement',
    description: 'Generates a 3-step conversational outreach and DM relationship sequence without being spammy.',
    placeholder: 'Describe your brand offer or free lead magnet for new followers...',
    iconBg: 'bg-yellow-500/10 text-yellow-400',
  },
];

export const SkillsCentreView: React.FC = () => {
  const { user } = useAuth();

  const [selectedSkill, setSelectedSkill] = useState<SkillDefinition>(AGENT_SKILLS[0]);
  const [skillInput, setSkillInput] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [skillOutput, setSkillOutput] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [historyRuns, setHistoryRuns] = useState<SkillRun[]>([]);

  useEffect(() => {
    if (!user) return;
    loadSkillHistory();
  }, [user]);

  const loadSkillHistory = async () => {
    if (!user) return;
    try {
      const q = query(collection(db, 'skillRuns'), where('userId', '==', user.uid));
      const snap = await getDocs(q);
      setHistoryRuns(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as SkillRun[]);
    } catch (err) {
      console.error('Error loading skill runs:', err);
    }
  };

  const handleRunSkill = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!skillInput.trim()) return;

    setIsRunning(true);
    setSavedSuccess(false);

    try {
      const res = await runInstagramAgentSkill(selectedSkill.id, skillInput);
      if (res.success && res.output) {
        setSkillOutput(res.output);

        // Record execution in Firestore
        if (user) {
          const runPayload: Omit<SkillRun, 'id'> = {
            userId: user.uid,
            skillId: selectedSkill.id,
            skillName: selectedSkill.name,
            inputParams: skillInput,
            resultOutput: res.output,
            createdAt: new Date().toISOString(),
          };
          const docRef = await addDoc(collection(db, 'skillRuns'), runPayload);
          setHistoryRuns((prev) => [{ id: docRef.id, ...runPayload }, ...prev]);
        }
      }
    } catch (err: any) {
      alert(`Skill run failed: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(skillOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredSkills = AGENT_SKILLS.filter((s) => {
    if (activeCategory !== 'All' && s.category !== activeCategory) return false;
    if (searchQuery) {
      return (
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      {/* Top Header */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20">
            <Wand2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Instagram Agent Skills Hub (13 Tools)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Based on the open-source Instagram Agent Skill suite (Jakeschincariol/instagram-agent-skill).
            </p>
          </div>
        </div>

        <a
          href="https://github.com/Jakeschincariol/instagram-agent-skill"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1 font-mono"
        >
          <span>MIT License</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Skill Selector (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Search & Categories */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search 13 skills..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex flex-wrap gap-1 text-[11px]">
              {['All', 'Strategy', 'Copywriting', 'Video & Reels', 'Engagement'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition ${
                    activeCategory === cat
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Skill List items */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar pr-1">
            {filteredSkills.map((skill) => (
              <div
                key={skill.id}
                onClick={() => {
                  setSelectedSkill(skill);
                  setSkillOutput('');
                }}
                className={`p-3.5 rounded-xl border cursor-pointer transition flex items-center justify-between gap-2 ${
                  selectedSkill.id === skill.id
                    ? 'bg-purple-500/10 border-purple-500 shadow-xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-900 dark:text-white block truncate">
                    {skill.name}
                  </span>
                  <span className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                    {skill.description}
                  </span>
                </div>
                <ChevronRight className={`w-4 h-4 shrink-0 ${selectedSkill.id === skill.id ? 'text-purple-400' : 'text-slate-500'}`} />
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Execution Workspace (8 Cols) */}
        <div className="lg:col-span-8 space-y-5">
          {/* Active Skill Execution Box */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block mb-1">
                {selectedSkill.category} Skill
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {selectedSkill.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {selectedSkill.description}
              </p>
            </div>

            <form onSubmit={handleRunSkill} className="space-y-3">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Workflow Input / Prompt Context
              </label>
              <textarea
                rows={4}
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                placeholder={selectedSkill.placeholder}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 text-xs sm:text-sm focus:outline-hidden focus:border-purple-500 transition resize-none leading-relaxed"
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isRunning || !skillInput.trim()}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-purple-600/20 transition flex items-center gap-2 disabled:opacity-50"
                >
                  {isRunning ? (
                    <>
                      <RotateCcw className="w-4 h-4 animate-spin" />
                      <span>Running Skill...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Execute Skill</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Generated Skill Output */}
            {skillOutput && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> Workflow Output
                  </span>
                  <button
                    onClick={handleCopy}
                    className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy Output'}</span>
                  </button>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed font-mono">
                  {skillOutput}
                </div>
              </div>
            )}
          </div>

          {/* History of executions */}
          {historyRuns.length > 0 && (
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                <History className="w-4 h-4" /> Recent Agent Skill Runs ({historyRuns.length})
              </span>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {historyRuns.slice(0, 5).map((run) => (
                  <div key={run.id} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-900 dark:text-white mr-2">
                        {run.skillName}
                      </span>
                      <span className="text-slate-400 truncate">"{run.inputParams}"</span>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">
                      {new Date(run.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
