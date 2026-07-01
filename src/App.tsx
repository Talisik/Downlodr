/**
 * Main application component for the React application.
 * This component defines the structure of the UI, setting up the routing and theming for the app.
 *
 * Dependencies:
 * - React Router: For handling navigation between different pages.
 * - ThemeProvider: A custom component for managing theme settings.
 * - Various page components: AllDownloads, Downloading, History, etc.
 *
 */
import ClipboardLinkDetector from '@/core-app/components/clipboard/ClipboardLinkDetector';
import StoreRehydrationLoader from '@/core-app/components/loader/StoreRehydrationLoader';
import UpdateNotification from '@/core-app/components/notification/UpdateNotification';
import { Toaster } from '@/core-app/components/shadcn/components/ui/toaster';
import TelemetryConsentModal from '@/core-app/components/telemetry/TelemetryConsentModal';
import AddonManagerModal from '@/downlodr/components/modal/custom/AddonManagerModal';
import { ThemeProvider } from '@/core-app/components/ThemeProvider';
import NotFound from '@/core-app/pages/NotFound';
import { useSettingStore } from '@/core-app/store/settingsStore';
import i18n from '@/core-app/i18n';
import {
  initializeTelemetry,
  useTelemetryStore,
} from '@/core-app/store/telemetryStore';
import { otelLogs } from '@/core-app/telemetry/otel-logs';
import { eventManager } from '@/core-app/utils/manager/eventManager';
import FavoritesPage from '@/downlodr/pages/FavoritesPage';
import StatusSpecificDownloads from '@/downlodr/pages/StatusPage';
import { useEffect, useRef, useState } from 'react';
import {
  Navigate,
  Route,
  HashRouter as Router,
  Routes,
  useNavigate,
} from 'react-router-dom';
import MainLayout from './core-app/layout/DownloadLayout';
import OnboardingPage from './onboarding/pages/OnboardingPage';
import History from './downlodr/pages/History';
import { PluginInitialize } from './plugins/components/PluginInitialize';
import PluginLayout from './plugins/layout/PluginLayout';
import PluginDetail from './plugins/pages/PluginDetail';
import PluginPage from './plugins/pages/PluginPage';
import SkedulosaLayout from './skedulosa/layout/SkedulosaLayout';
import NoSchedulePage from './skedulosa/pages/NoSchedulePage';
import SelectedSubscriptionView from './skedulosa/pages/SelectedSubscriptionView';
import SkedulosaSelectedViewTable from './skedulosa/pages/SkedulosaSelectedViewTable';
import AfdaSelectedViewTable from './afda/pages/AfdaSelectedViewTable';
import SkedulosaHistoryPage from './skedulosa/pages/SkedulosaHistoryPage';
import SkedulosaHome from './skedulosa/pages/SkedulosaHome';
import SkedulosaSchedulePage from './skedulosa/pages/SkedulosaSchedulePage';
import SkedulosaSubscriptionPage from './skedulosa/pages/SkedulosaSubscriptionPage';
import SkedulosaSubscriptionDownloadsPage from './skedulosa/pages/SkedulosaSubscriptionDownloadsPage';
import SkedulosaUtilsDemoPage from './skedulosa/pages/SkedulosaUtilsDemoPage';
import ToolkitTestPage from './skedulosa/pages/ToolkitTestPage';
import { useSkedulosaDownloadBridge } from './skedulosa/hooks/useSkedulosaDownloadBridge';
import { useYtdlpRecovery } from './skedulosa/hooks/useYtdlpRecovery';
import { useAfdaWebsitesInit } from './afda/hooks/useAfdaWebsitesInit';
import { useAfdaArticleSync } from './afda/hooks/useAfdaArticleSync';
import { useToast } from '@/core-app/components/shadcn/hooks/use-toast';
import { useAddonStore } from '@/core-app/store/addonStore';
import SkedulosaRouteGuard from './skedulosa/utils/routeGuard';
import GlobalScanningModal from './skedulosa/components/GlobalScanningModal';
import GlobalAddonDownloadToast from '@/core-app/components/GlobalAddonDownloadToast';
import CategoryPage from './smart-organize/base/pages/CategoryPage';
import TagPage from './smart-organize/base/pages/TagPage';
import AfdaSelectedTableGroup from './afda/pages/AfdaSelectedTableGroup';
import SubscriptionSelectedTableGroup from './skedulosa/pages/SubscriptionSelectedTableGroup';
import { useScrapingProgressToast } from './skedulosa/hooks/useScrapingProgressToast';

function OnboardingNavigator() {
  const navigate = useNavigate();
  const onboardingShown = useSettingStore((s) => s.settings.onboardingShown);
  const telemetryConsentShown = useTelemetryStore((s) => s.settings.telemetryConsentShown);

  useEffect(() => {
    if (telemetryConsentShown && !onboardingShown) {
      navigate('/onboarding');
    }
  }, [telemetryConsentShown, onboardingShown]);

  return null;
}

const App = () => {
  useSkedulosaDownloadBridge();
  useYtdlpRecovery();
  useScrapingProgressToast();
  useAfdaWebsitesInit();
  useAfdaArticleSync();

  const initFromMain = useAddonStore((s) => s.initFromMain);
  useEffect(() => { void initFromMain(); }, []);

  const { toast } = useToast();
  const afdaStatus = useAddonStore((s) => s.afda.status);
  const skedulosaStatus = useAddonStore((s) => s.skedulosa.status);
  const prevAfdaStatus = useRef(afdaStatus);
  const prevSkedulosaStatus = useRef(skedulosaStatus);

  useEffect(() => {
    if (prevAfdaStatus.current === 'downloading' && afdaStatus === 'ready') {
      toast({ title: 'Article Fetcher add-on installed', description: 'Restart downlodr to activate.' });
    }
    prevAfdaStatus.current = afdaStatus;
  }, [afdaStatus]);

  useEffect(() => {
    if (prevSkedulosaStatus.current === 'downloading' && skedulosaStatus === 'ready') {
      toast({ title: 'Subscriptions add-on installed', description: 'Restart downlodr to activate.' });
    }
    prevSkedulosaStatus.current = skedulosaStatus;
  }, [skedulosaStatus]);

  const { settings, updateAddonOnboardingShown } = useSettingStore();
  const language = useSettingStore((state) => state.settings.language);

  useEffect(() => {
    if (language && i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language]);

  const { updateTelemetryConsentShown, settings: telemetrySettings } =
    useTelemetryStore();

  const [showTelemetryConsentModal, setShowTelemetryConsentModal] =
    useState(false);

  // Check if we should show telemetry consent modal (only once, after rehydration)
  useEffect(() => {
    if (telemetrySettings.telemetryConsentShown) {
      setShowTelemetryConsentModal(false);
      return;
    }
    // Small delay to allow app to fully load
    const timer = setTimeout(() => {
      setShowTelemetryConsentModal(true);
    }, 1000);
    return () => clearTimeout(timer);
  }, [telemetrySettings.telemetryConsentShown]);

  // Handle telemetry consent modal close
  const handleTelemetryConsentClose = () => {
    setShowTelemetryConsentModal(false);
    // Ensure consent shown flag is set even if user closes modal without choosing
    if (!telemetrySettings.telemetryConsentShown) {
      updateTelemetryConsentShown(true);
    }
  };

  const [showAddonOnboardingModal, setShowAddonOnboardingModal] =
    useState(false);

  // TEMP: addon onboarding modal disabled — only shown when user clicks subscriptions nav
  // useEffect(() => {
  //   if (settings.addonOnboardingShown) {
  //     setShowAddonOnboardingModal(false);
  //     return;
  //   }
  //   const timer = setTimeout(() => {
  //     setShowAddonOnboardingModal(true);
  //   }, 1500);
  //   return () => clearTimeout(timer);
  // }, [settings.addonOnboardingShown]);

  const handleAddonOnboardingClose = () => {
    setShowAddonOnboardingModal(false);
    updateAddonOnboardingShown(true);
  };

  // Initialize telemetry store on app startup (runs once)
  useEffect(() => {
    const initAppTelemetry = async () => {
      try {
        const telemetryId = await initializeTelemetry();
        if (telemetryId) {
          // console.log('📊 Telemetry ready for app-wide usage');
        }
        otelLogs.initialize();
      } catch (error) {
        console.error('❌ Failed to initialize app telemetry:', error);
        // App continues to function normally even if telemetry fails
      }
    };

    initAppTelemetry();
  }, []); // Empty dependency array = runs once on mount

  // Start the skedulosa scraper loop on app startup
  useEffect(() => {
    if (window.skedulosaBridge) {
      console.log('Starting Skedulosa scraper loop');
      window.skedulosaBridge
        .startScraper()
        .catch((err) =>
          console.error('Failed to start skedulosa scraper:', err),
        );
    }
    return () => {
      if (window.skedulosaBridge) {
        window.skedulosaBridge
          .stopScraper()
          .catch((err) =>
            console.error('Failed to stop skedulosa scraper:', err),
          );
      }
    };
  }, []);

  // Sync setting with main process on startup
  useEffect(() => {
    if (window.backgroundSettings) {
      window.backgroundSettings
        .setRunInBackground(settings.runInBackground)
        .then(() => console.log('Background setting synced on startup'))
        .catch((err) =>
          console.error('Failed to sync background setting:', err),
        );
    }
  }, [settings.runInBackground]);

  // Handle YT-DLP auto-update events
  useEffect(() => {
    const removeListeners: Array<(() => void) | undefined> = [];

    if (window.updateAPI) {
      // Handle YT-DLP auto-updated event
      if (window.updateAPI.onYtdlpAutoUpdated) {
        const removeYtdlpUpdated = window.updateAPI.onYtdlpAutoUpdated(
          (updateInfo) => {
            // hello
          },
        );
        removeListeners.push(removeYtdlpUpdated);
      }

      // Handle YT-DLP auto-installed event
      if (window.updateAPI.onYtdlpAutoInstalled) {
        const removeYtdlpInstalled = window.updateAPI.onYtdlpAutoInstalled(
          (installInfo) => {
            //hello
          },
        );
        removeListeners.push(removeYtdlpInstalled);
      }
    }

    // Cleanup function to remove all event listeners
    return () => {
      removeListeners.forEach((removeListener) => {
        if (removeListener) {
          removeListener();
        }
      });
      // Clean up the centralized event manager on app unmount
      eventManager.cleanup();
    };
  }, []); // Empty dependency array = runs once on mount

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <StoreRehydrationLoader>
        <Router>
          <OnboardingNavigator />
          <Routes>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Navigate to="/status/all" replace />} />
              <Route path="/history" element={<History />} />
              <Route
                path="/status"
                element={<Navigate to="/status/all" replace />}
              />
              <Route
                path="/status/:status"
                element={<StatusSpecificDownloads />}
              />
              <Route path="/status/favorites" element={<FavoritesPage />} />
              <Route path="/status/group/afda/:websiteId" element={<AfdaSelectedTableGroup />} />
              <Route path="/status/group/subscription/:subscriptionId" element={<SubscriptionSelectedTableGroup />} />
              <Route path="*" element={<NotFound />} />
              <Route path="/tags/:tagId" element={<TagPage />} />
              <Route path="/category/:categoryId" element={<CategoryPage />} />
            </Route>
            <Route path="/plugins" element={<PluginLayout />}>
              <Route index element={<PluginPage />} />
              <Route path="details" element={<PluginDetail />} />
              {/* Additional plugin routes can be added here 
              <Route
                path="/plugins/toolkit-test"
                element={<ToolkitTestPage />}
              />
              */}
            </Route>

            <Route path="/skedulosa" element={<SkedulosaLayout />}>
              <Route
                index
                element={<Navigate to="/skedulosa/subscription" replace />}
              />
              <Route element={<SkedulosaRouteGuard />}>
                <Route element={<SkedulosaHome />}>
                  <Route
                    path="/skedulosa/no-schedule"
                    element={<NoSchedulePage />}
                  />
                  <Route
                    index
                    path="/skedulosa/schedule"
                    element={<SkedulosaSchedulePage />}
                  />
                  <Route
                    path="/skedulosa/subscription"
                    element={<SkedulosaSubscriptionPage />}
                  />
                  <Route
                    path="/skedulosa/history"
                    element={<SkedulosaHistoryPage />}
                  />
                  <Route
                    path="/skedulosa/selected-subscription/:channelId?"
                    element={<SkedulosaSelectedViewTable />}
                  />
                  <Route
                    path="/skedulosa/selected-article/:channelId?"
                    element={<AfdaSelectedViewTable />}
                  />
                  <Route
                    path="/skedulosa/subscription-downloads"
                    element={<SkedulosaSubscriptionDownloadsPage />}
                  />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Route>
            </Route>
          </Routes>
          <GlobalScanningModal />
          <GlobalAddonDownloadToast />
        </Router>
        <Toaster />
        <PluginInitialize />
        <UpdateNotification />
        <ClipboardLinkDetector />
        <TelemetryConsentModal
          isOpen={showTelemetryConsentModal}
          onClose={handleTelemetryConsentClose}
        />
        <AddonManagerModal
          isOpen={showAddonOnboardingModal}
          onClose={handleAddonOnboardingClose}
        />
      </StoreRehydrationLoader>
    </ThemeProvider>
  );
};

export default App;
