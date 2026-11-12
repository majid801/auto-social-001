import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { LandingPageView } from './components/Views/LandingPageView';
import { DashboardView } from './components/Views/DashboardView';
import { InstagramAccountsView } from './components/Views/InstagramAccountsView';
import { ContentStudioView } from './components/Views/ContentStudioView';
import { ImageGeneratorView } from './components/Views/ImageGeneratorView';
import { VideoReelsStudioView } from './components/Views/VideoReelsStudioView';
import { ContentCalendarView } from './components/Views/ContentCalendarView';
import { DraftsView } from './components/Views/DraftsView';
import { AutomationCentreView } from './components/Views/AutomationCentreView';
import { MediaLibraryView } from './components/Views/MediaLibraryView';
import { AnalyticsView } from './components/Views/AnalyticsView';
import { InboxView } from './components/Views/InboxView';
import { SkillsCentreView } from './components/Views/SkillsCentreView';
import { MonetizationView } from './components/Views/MonetizationView';
import { PublishingHistoryView } from './components/Views/PublishingHistoryView';
import { SettingsView } from './components/Views/SettingsView';
import { fetchPubloraConnections, PubloraConnectionResponse } from './services/api';

function MainApp() {
  const { user, loading } = useAuth();

  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('autosocial_theme') !== 'light';
  });

  // Publora state
  const [isPubloraConnected, setIsPubloraConnected] = useState<boolean>(false);
  const [instagramAccount, setInstagramAccount] = useState<any>(null);
  const [isRefreshingPublora, setIsRefreshingPublora] = useState<boolean>(false);
  const [rawPubloraResponse, setRawPubloraResponse] = useState<any>(null);

  // Sync dark mode class on document
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('autosocial_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('autosocial_theme', 'light');
    }
  }, [isDarkMode]);

  // Load Publora connection status when authenticated
  useEffect(() => {
    if (user) {
      loadPubloraStatus();
    }
  }, [user]);

  const loadPubloraStatus = async () => {
    setIsRefreshingPublora(true);
    try {
      const res: PubloraConnectionResponse = await fetchPubloraConnections();
      setRawPubloraResponse(res);
      if (res.success && res.instagramAccounts && res.instagramAccounts.length > 0) {
        setIsPubloraConnected(true);
        setInstagramAccount(res.instagramAccounts[0]);
      } else {
        setIsPubloraConnected(false);
        setInstagramAccount(null);
      }
    } catch (err) {
      console.error('Failed to load Publora status:', err);
      setIsPubloraConnected(false);
    } finally {
      setIsRefreshingPublora(false);
    }
  };

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-500 animate-pulse flex items-center justify-center text-white font-black text-xl shadow-xl shadow-purple-600/30">
          AI
        </div>
        <p className="text-xs font-semibold text-slate-400 tracking-wide">
          Loading AutoSocial AI Platform...
        </p>
      </div>
    );
  }

  // If user is not logged in, render the SaaS landing page
  if (!user) {
    return <LandingPageView />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col antialiased">
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
        isDarkMode={isDarkMode}
        onToggleTheme={toggleTheme}
        isPubloraConnected={isPubloraConnected}
        instagramUsername={instagramAccount?.username || instagramAccount?.name}
      />

      {/* Main Content Area */}
      <div className="lg:pl-72 flex-1 flex flex-col min-w-0">
        <Header
          currentTab={currentTab}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onQuickCreate={() => setCurrentTab('content-studio')}
          isPubloraConnected={isPubloraConnected}
          onRefreshPublora={loadPubloraStatus}
          isRefreshingPublora={isRefreshingPublora}
          onOpenAccountSetup={() => setCurrentTab('accounts')}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {currentTab === 'dashboard' && (
            <DashboardView
              onNavigate={setCurrentTab}
              isPubloraConnected={isPubloraConnected}
              instagramAccount={instagramAccount}
              onRefreshPublora={loadPubloraStatus}
              isRefreshingPublora={isRefreshingPublora}
            />
          )}

          {currentTab === 'accounts' && (
            <InstagramAccountsView
              isPubloraConnected={isPubloraConnected}
              instagramAccount={instagramAccount}
              onRefreshPublora={loadPubloraStatus}
              isRefreshingPublora={isRefreshingPublora}
              rawPubloraResponse={rawPubloraResponse}
            />
          )}

          {currentTab === 'content-studio' && (
            <ContentStudioView
              onNavigate={setCurrentTab}
              isPubloraConnected={isPubloraConnected}
              instagramAccount={instagramAccount}
            />
          )}

          {currentTab === 'image-generator' && (
            <ImageGeneratorView onNavigate={setCurrentTab} />
          )}

          {currentTab === 'video-reels' && (
            <VideoReelsStudioView onNavigate={setCurrentTab} />
          )}

          {currentTab === 'calendar' && (
            <ContentCalendarView
              onNavigate={setCurrentTab}
              instagramAccount={instagramAccount}
            />
          )}

          {currentTab === 'drafts' && (
            <DraftsView
              onNavigate={setCurrentTab}
              isPubloraConnected={isPubloraConnected}
              instagramAccount={instagramAccount}
            />
          )}

          {currentTab === 'automations' && <AutomationCentreView />}

          {currentTab === 'media' && <MediaLibraryView />}

          {currentTab === 'analytics' && <AnalyticsView />}

          {currentTab === 'inbox' && <InboxView />}

          {currentTab === 'skills' && <SkillsCentreView />}

          {currentTab === 'monetization' && <MonetizationView />}

          {currentTab === 'history' && (
            <PublishingHistoryView
              isPubloraConnected={isPubloraConnected}
              instagramAccount={instagramAccount}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsView
              isPubloraConnected={isPubloraConnected}
              onRefreshPublora={loadPubloraStatus}
              isRefreshingPublora={isRefreshingPublora}
              isDarkMode={isDarkMode}
              onToggleTheme={toggleTheme}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
