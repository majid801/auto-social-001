import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar, NavTab } from './components/Sidebar';
import { Header } from './components/Header';
import { LandingPageView } from './components/Views/LandingPageView';
import { DashboardView } from './components/Views/DashboardView';
import { CommandCentreView } from './components/Views/CommandCentreView';
import { InstagramAccountsView } from './components/Views/InstagramAccountsView';
import { ContentStudioView } from './components/Views/ContentStudioView';
import { ImageGeneratorView } from './components/Views/ImageGeneratorView';
import { VideoReelsStudioView } from './components/Views/VideoReelsStudioView';
import { CarouselCreatorView } from './components/Views/CarouselCreatorView';
import { StoryCreatorView } from './components/Views/StoryCreatorView';
import { PostComposerView } from './components/Views/PostComposerView';
import { ContentCalendarView } from './components/Views/ContentCalendarView';
import { DraftsView } from './components/Views/DraftsView';
import { ScheduledQueueView } from './components/Views/ScheduledQueueView';
import { AutomationCentreView } from './components/Views/AutomationCentreView';
import { MediaLibraryView } from './components/Views/MediaLibraryView';
import { AnalyticsView } from './components/Views/AnalyticsView';
import { InboxView } from './components/Views/InboxView';
import { SkillsCentreView } from './components/Views/SkillsCentreView';
import { MonetizationView } from './components/Views/MonetizationView';
import { PublishingHistoryView } from './components/Views/PublishingHistoryView';
import { SettingsView } from './components/Views/SettingsView';
import {
  fetchPubloraConnections,
  PubloraConnectionResponse,
  syncSchedulerWithServer,
  fetchSchedulerState,
  ackServerDrafts,
} from './services/api';
import { collection, query, where, getDocs, updateDoc, addDoc, doc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { Post, AutomationRule } from './types';

function MainApp() {
  const { user, userProfile, loading } = useAuth();

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

  // Global Cmd+K / Ctrl+K shortcut to open Universal AI Command Centre
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCurrentTab('command-centre');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load Publora connection status when authenticated
  useEffect(() => {
    if (user) {
      loadPubloraStatus();
    }
  }, [user]);

  const syncBackgroundScheduler = useCallback(async () => {
    if (!user) return;
    try {
      const [postsSnap, autoSnap] = await Promise.all([
        getDocs(query(collection(db, 'posts'), where('userId', '==', user.uid))),
        getDocs(query(collection(db, 'automations'), where('userId', '==', user.uid))),
      ]);

      const allPosts = postsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Post[];
      const syncPosts = allPosts.filter((p) => p.status === 'scheduled' || p.status === 'approved');
      const automations = autoSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as AutomationRule[];

      await syncSchedulerWithServer({
        userId: user.uid,
        posts: syncPosts,
        automations,
        autoPublishApproved: Boolean(userProfile?.autoPublishApproved),
      });

      // Reconcile server-updated post statuses & server-generated drafts back to Firestore
      const stateRes = await fetchSchedulerState(user.uid);
      if (stateRes.success) {
        const serverPosts: any[] = Array.isArray(stateRes.posts) ? stateRes.posts : [];
        for (const sp of serverPosts) {
          if (!sp.id) continue;
          const localMatch = allPosts.find((lp) => lp.id === sp.id);
          if (localMatch && (sp.status === 'published' || sp.status === 'failed') && sp.status !== localMatch.status) {
            await updateDoc(doc(db, 'posts', sp.id), {
              status: sp.status,
              ...(sp.publoraPostId ? { publoraPostId: sp.publoraPostId } : {}),
              ...(sp.publishedTime ? { publishedTime: sp.publishedTime } : {}),
              ...(sp.failureReason ? { failureReason: sp.failureReason } : {}),
              updatedAt: new Date().toISOString(),
            });
          }
        }

        const generatedDrafts: any[] = Array.isArray(stateRes.generatedDrafts) ? stateRes.generatedDrafts : [];
        if (generatedDrafts.length > 0) {
          for (const draft of generatedDrafts) {
            const now = new Date().toISOString();
            await addDoc(collection(db, 'posts'), {
              userId: user.uid,
              title: draft.title || 'Automated Instagram Draft',
              topic: draft.topic || draft.title || '',
              format: draft.format || 'post',
              status: 'draft',
              caption: draft.caption || '',
              hashtags: draft.hashtags || '',
              hook: draft.hook || '',
              cta: draft.cta || '',
              createdAt: now,
              updatedAt: now,
            });
          }
          await ackServerDrafts(user.uid);
        }
      }
    } catch (err) {
      console.error('Background scheduler sync error:', err);
    }
  }, [user, userProfile?.autoPublishApproved]);

  useEffect(() => {
    if (!user) return;
    const initialTimer = setTimeout(() => {
      syncBackgroundScheduler();
    }, 2500);
    const interval = setInterval(() => {
      syncBackgroundScheduler();
    }, 60000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [user, syncBackgroundScheduler]);

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
          onQuickCreate={() => setCurrentTab('composer')}
          onOpenCommandCentre={() => setCurrentTab('command-centre')}
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

          {currentTab === 'command-centre' && (
            <CommandCentreView
              onNavigate={setCurrentTab}
              instagramAccount={instagramAccount}
              isPubloraConnected={isPubloraConnected}
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

          {currentTab === 'carousel-creator' && (
            <CarouselCreatorView
              onNavigate={setCurrentTab}
              isPubloraConnected={isPubloraConnected}
              instagramAccount={instagramAccount}
            />
          )}

          {currentTab === 'story-creator' && (
            <StoryCreatorView
              onNavigate={setCurrentTab}
              isPubloraConnected={isPubloraConnected}
              instagramAccount={instagramAccount}
            />
          )}

          {currentTab === 'composer' && (
            <PostComposerView
              onNavigate={setCurrentTab}
              isPubloraConnected={isPubloraConnected}
              instagramAccount={instagramAccount}
            />
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

          {currentTab === 'scheduled' && (
            <ScheduledQueueView
              onNavigate={setCurrentTab}
              isPubloraConnected={isPubloraConnected}
              instagramAccount={instagramAccount}
            />
          )}

          {currentTab === 'automations' && <AutomationCentreView />}

          {currentTab === 'media' && <MediaLibraryView onNavigate={setCurrentTab} />}

          {currentTab === 'analytics' && <AnalyticsView />}

          {currentTab === 'inbox' && <InboxView />}

          {currentTab === 'skills' && <SkillsCentreView onNavigate={setCurrentTab} />}

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
