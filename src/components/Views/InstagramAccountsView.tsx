import React, { useState } from 'react';
import {
  Instagram,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Key,
  ExternalLink,
  ShieldCheck,
  Zap,
  Info,
  Calendar,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { testPubloraConnection } from '../../services/api';

interface InstagramAccountsViewProps {
  isPubloraConnected: boolean;
  instagramAccount: any;
  onRefreshPublora: () => void;
  isRefreshingPublora: boolean;
  rawPubloraResponse: any;
}

export const InstagramAccountsView: React.FC<InstagramAccountsViewProps> = ({
  isPubloraConnected,
  instagramAccount,
  onRefreshPublora,
  isRefreshingPublora,
  rawPubloraResponse,
}) => {
  const [testingConnection, setTestingConnection] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<any>(null);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await testPubloraConnection({
        accountId: instagramAccount?.id || instagramAccount?.accountId,
        platform: 'instagram',
      });
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fade-in">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-pink-500/20">
            <Instagram className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              Instagram Account Management
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Powered exclusively via the official Publora REST API. Only Instagram accounts are supported.
            </p>
          </div>
        </div>

        <button
          onClick={onRefreshPublora}
          disabled={isRefreshingPublora}
          className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-2 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshingPublora ? 'animate-spin text-purple-400' : ''}`} />
          <span>Refresh Connection</span>
        </button>
      </div>

      {/* Connection State Card */}
      {isPubloraConnected && instagramAccount ? (
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-500/30 shadow-lg shadow-emerald-500/5 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-4">
              <div className="relative">
                {instagramAccount.profile_picture || instagramAccount.profilePictureUrl ? (
                  <img
                    src={instagramAccount.profile_picture || instagramAccount.profilePictureUrl}
                    alt={instagramAccount.username || 'Instagram'}
                    className="w-16 h-16 rounded-full object-cover border-2 border-emerald-500 p-0.5"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-600 to-pink-600 text-white font-bold flex items-center justify-center text-xl border-2 border-emerald-500">
                    {(instagramAccount.username || 'IG').slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 flex items-center justify-center text-white">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    @{instagramAccount.username || instagramAccount.name || 'instagram_user'}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
                    Verified Active
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Account ID: <span className="font-mono text-slate-700 dark:text-slate-300">{instagramAccount.id || instagramAccount.accountId || 'Publora-Linked'}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-purple-600/20 transition disabled:opacity-50"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{testingConnection ? 'Testing...' : 'Test API Connection'}</span>
              </button>
            </div>
          </div>

          {/* Test connection response indicator */}
          {testResult && (
            <div className={`p-4 rounded-xl border text-xs ${
              testResult.success !== false
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              <p className="font-semibold mb-1">
                {testResult.success !== false ? 'API Connection Verified Successfully' : 'Connection Test Reported Error'}
              </p>
              <pre className="font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}

          {/* Account Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400 block mb-1">Platform</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Instagram className="w-4 h-4 text-pink-500" />
                Instagram Only
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400 block mb-1">Authorization Status</span>
              <span className="text-sm font-semibold text-emerald-500 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                {instagramAccount.token_status || instagramAccount.status || 'Active & Valid'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400 block mb-1">Publishing Capabilities</span>
              <span className="text-xs font-semibold text-slate-900 dark:text-white">
                Reels, Single Post, Carousel, Stories
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Empty / Not Connected State */
        <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-amber-500/30 shadow-lg shadow-amber-500/5 space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/30">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                No Connected Instagram Account Retrieved from Publora
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                AutoSocial AI does not use mock or hardcoded accounts. To retrieve and publish to your real Instagram account, follow the official setup below.
              </p>
            </div>
          </div>

          {/* Setup Guide Box */}
          <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-4">
            <h4 className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-4 h-4" />
              How to Connect Your Publora API Key
            </h4>

            <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center text-[11px] shrink-0">1</span>
                <p>
                  Log into your Publora account at{' '}
                  <a href="https://app.publora.com" target="_blank" rel="noopener noreferrer" className="text-purple-400 underline font-semibold">
                    app.publora.com
                  </a>{' '}
                  and connect your Instagram account there.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center text-[11px] shrink-0">2</span>
                <p>
                  Copy your Publora API key from your Publora Dashboard (Settings → API Keys).
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center text-[11px] shrink-0">3</span>
                <p>
                  In Google AI Studio, open the <strong>Settings → Secrets</strong> panel and add a secret named:
                  <code className="mx-1.5 px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-purple-400 font-mono font-bold">
                    PUBLORA_API_KEY
                  </code>
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center text-[11px] shrink-0">4</span>
                <p>
                  Click the <strong>Refresh Connection</strong> button above to instantly verify and load your connected Instagram account!
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={onRefreshPublora}
              disabled={isRefreshingPublora}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-md shadow-purple-600/20 transition flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshingPublora ? 'animate-spin' : ''}`} />
              <span>{isRefreshingPublora ? 'Checking Publora API...' : 'Verify Publora Connection'}</span>
            </button>

            <a
              href="https://app.publora.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition"
            >
              <span>Open Publora Dashboard</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {/* Security & Authentication Notice */}
      <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-800 dark:text-slate-200">
            Zero-Password Instagram Security Policy
          </p>
          <p className="leading-relaxed">
            AutoSocial AI never asks for or stores your Instagram password. Authentication is completed securely via Publora's official OAuth authorization flow, and all API keys remain securely protected in server-side environment secrets.
          </p>
        </div>
      </div>
    </div>
  );
};
