import React, { useState } from 'react';
import {
  Instagram,
  Sparkles,
  Zap,
  Calendar,
  Film,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  Image as ImageIcon,
  Wand2,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LandingPageView: React.FC = () => {
  const { signInWithGoogle, loading } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Google Sign-In failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-purple-500 selection:text-white">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
              <Instagram className="w-6 h-6" />
            </div>
            <div>
              <span className="font-extrabold text-white text-lg tracking-tight">AutoSocial AI</span>
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-semibold border border-purple-500/30">
                Instagram Only
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSignIn}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-purple-600/30 transition flex items-center gap-2 active:scale-95"
            >
              <span>Get Started with Google</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="relative overflow-hidden pt-16 pb-24 px-4 sm:px-8">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/15 rounded-full blur-[140px] pointer-events-none" />

          <div className="max-w-4xl mx-auto text-center relative z-10 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Dedicated Instagram Content Automation Platform</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-[1.15]">
              Autonomous Instagram Growth & Publishing Powered by{' '}
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">
                Gemini AI & Publora
              </span>
            </h1>

            <p className="text-sm sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Plan, generate high-retention Reels, create aesthetic graphics, schedule visually, and automatically publish to your real Instagram account. Zero fluff, 100% Instagram focused.
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={handleSignIn}
                disabled={loading}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:via-pink-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-purple-600/30 transition flex items-center justify-center gap-2.5 active:scale-95"
              >
                <span>Launch AutoSocial AI</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {authError && (
              <div role="alert" className="mx-auto max-w-2xl rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-left text-xs leading-relaxed text-amber-200">
                <strong className="mr-1">Google Sign-In could not continue.</strong>
                {authError}
              </div>
            )}

            <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Zero-password OAuth security
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-purple-400" />
                Official Publora v1 REST API
              </span>
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-pink-400" />
                Gemini content packages
              </span>
            </div>
          </div>
        </section>

        {/* 4-Step Workflow Section */}
        <section className="py-16 px-4 sm:px-8 border-t border-slate-900 bg-slate-950/60">
          <div className="max-w-6xl mx-auto space-y-12">
            <div className="text-center space-y-2">
              <h2 className="text-xs font-bold text-purple-400 uppercase tracking-widest">
                The Complete Instagram Workflow
              </h2>
              <p className="text-2xl sm:text-3xl font-extrabold text-white">
                From Raw Idea to Scheduled Instagram Reel in Minutes
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  step: '01',
                  title: 'Connect Account',
                  desc: 'Link your Instagram profile via official Publora API with zero password sharing.',
                },
                {
                  step: '02',
                  title: 'Generate Content',
                  desc: 'Gemini creates full packages: 0-3s hook, formatted caption, hashtags, and scene scripts.',
                },
                {
                  step: '03',
                  title: 'Visual Preview & Review',
                  desc: 'Preview inside a mobile mockup, edit scripts, attach media, and approve for publishing.',
                },
                {
                  step: '04',
                  title: 'Automated Publishing',
                  desc: 'Server-side scheduler dispatches your approved posts with duplicate protection.',
                },
              ].map((item) => (
                <div
                  key={item.step}
                  className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-3"
                >
                  <span className="text-2xl font-black text-purple-500/60 font-mono">
                    {item.step}
                  </span>
                  <h3 className="font-bold text-white text-base">{item.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Core Capabilities Grid */}
        <section className="py-20 px-4 sm:px-8 border-t border-slate-900">
          <div className="max-w-6xl mx-auto space-y-12">
            <div className="text-center space-y-2">
              <h2 className="text-xs font-bold text-purple-400 uppercase tracking-widest">
                Built Exclusively for Instagram Creators
              </h2>
              <p className="text-2xl sm:text-3xl font-extrabold text-white">
                Everything You Need to Dominate the Feed
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                  <Film className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-base">Reels & Video Studio</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Scene-by-scene script breakdowns, voiceover narrations, subtitle text overlays, and audio mood suggestions built for 100% viewer retention.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-base">AI Image Generator</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Generate 1080x1080 square and 1080x1350 portrait carousel designs with custom aesthetic presets using Gemini Imagen.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <Wand2 className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-base">13 Open-Source Agent Skills</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Integrated ig-audit, ig-caption, ig-viral, ig-human, and ig-carousel tools from the open-source Instagram agent repository.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-base">Content Calendar</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Visualize your planned feed and reels schedule across Monthly, Weekly, and List views with drag-and-drop rescheduling.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-base">24/7 Automation Centre</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  8 scheduled background routines that curate daily ideas, plan weekly schedules, and dispatch approved posts without keeping tabs open.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-base">Approved Publishing Protection</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Unapproved content is never published. Strict approval gates and cryptographic idempotency headers protect against double-posting.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-8 px-4 sm:px-8 text-center text-xs text-slate-500">
        <p>© 2026 AutoSocial AI. Dedicated Instagram Content Automation Platform.</p>
        <p className="mt-1">Built with Google AI Studio, Gemini 2.5, Firebase Firestore, and Publora API.</p>
      </footer>
    </div>
  );
};
