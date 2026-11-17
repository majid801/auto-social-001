import React, { useState } from 'react';
import {
  Settings,
  Key,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Moon,
  Sun,
  Clock,
  Save,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SettingsViewProps {
  isPubloraConnected: boolean;
  onRefreshPublora: () => void;
  isRefreshingPublora: boolean;
  isDarkMode: boolean;
  onToggleTheme: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  isPubloraConnected,
  onRefreshPublora,
  isRefreshingPublora,
  isDarkMode,
  onToggleTheme,
}) => {
  const { user, userProfile, updateProfile } = useAuth();

  const [timezone, setTimezone] = useState<string>(
    userProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [autoPublishApproved, setAutoPublishApproved] = useState<boolean>(
    userProfile?.autoPublishApproved || false
  );
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await updateProfile({
        timezone,
        autoPublishApproved,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Settings update error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in pb-12">
      {/* Top Header Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            System & Publishing Settings
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure Publora credentials, automated publishing rules, and preferences.
          </p>
        </div>
      </div>

      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-cyan-500" />
          <h3 className="font-bold text-slate-900 dark:text-white text-base">Media generation capabilities</h3>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Genuine image generation uses the configured Gemini 2.5 Flash Image API and reports provider quota or permission failures without creating a fake AI result. Video Studio renders captioned scene videos locally with FFmpeg as H.264/AAC MP4; it does not claim native text-to-video generation.
        </p>
      </div>

      {/* Publora API Key Status Card (Part 3 Requirement) */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-purple-400" />
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Publora API Configuration (Server-Side Secret)
            </h3>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
              isPubloraConnected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}
          >
            {isPubloraConnected ? 'Configured & Active' : 'Setup Required'}
          </span>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          AutoSocial AI requires your official <strong>PUBLORA_API_KEY</strong> to authenticate with Publora's API and publish to your connected Instagram account.
        </p>

        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs text-slate-400">
          <p className="font-semibold text-slate-800 dark:text-slate-200">
            How to configure your Publora Secret:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-slate-600 dark:text-slate-300">
            <li>In Google AI Studio, open the top-right <strong>Settings → Secrets</strong> panel.</li>
            <li>Add a new secret named: <code className="text-purple-400 font-mono font-bold">PUBLORA_API_KEY</code></li>
            <li>Paste your key obtained from your <a href="https://app.publora.com" target="_blank" rel="noopener noreferrer" className="text-purple-400 underline font-semibold">Publora Dashboard</a>.</li>
            <li>Click <strong>Verify Connection</strong> below to test live credentials.</li>
          </ol>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onRefreshPublora}
            disabled={isRefreshingPublora}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 transition disabled:opacity-50"
          >
            <span>{isRefreshingPublora ? 'Verifying...' : 'Verify Connection Now'}</span>
          </button>

          <a
            href="https://app.publora.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <span>Publora Dashboard</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Approved Automatic Publishing Master Switch (Part 10 Requirement) */}
      <form onSubmit={handleSaveSettings} className="space-y-6">
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Enable Automatic Publishing of Approved Content
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                When enabled, the system automatically submits posts at scheduled times once they reach "Approved" status.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setAutoPublishApproved(!autoPublishApproved)}
              className={`w-12 h-6 rounded-full transition-colors relative focus:outline-hidden ${
                autoPublishApproved ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                  autoPublishApproved ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 text-[11px] text-purple-700 dark:text-purple-300">
            <strong>Safety Invariant:</strong> Unapproved content will never be published. Only drafts explicitly approved by you or generated via approved automated rules will ever be dispatched to Publora.
          </div>
        </div>

        {/* Timezone & Localization */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            Timezone & Scheduling Horizon
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Creator Timezone
            </label>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              All calendar slots and suggested posting times align to this timezone.
            </p>
          </div>
        </div>

        {/* User Account Details */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <h3 className="font-bold text-slate-900 dark:text-white text-base">
            Authenticated Profile
          </h3>

          <div className="text-xs space-y-1 text-slate-600 dark:text-slate-400">
            <p><strong>Email:</strong> {user?.email || 'N/A'}</p>
            <p><strong>Firebase UID:</strong> <code className="font-mono text-purple-400">{user?.uid || 'N/A'}</code></p>
            <p><strong>Authentication Method:</strong> Google OAuth 2.0 via Firebase Auth</p>
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center justify-between">
          {saveSuccess && (
            <div className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
              <Check className="w-4 h-4" />
              <span>Settings updated successfully!</span>
            </div>
          )}
          <div className="ml-auto">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-md shadow-purple-600/20 transition disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
