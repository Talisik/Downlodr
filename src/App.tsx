/**
 * Main application component for the React application.
 * This component defines the structure of the UI, setting up the routing and theming for the app.
 *
 * Dependencies:
 * - React Router: For handling navigation between different pages.
 * - ThemeProvider: A custom component for managing theme settings.
 * - Various page components: AllDownloads, Downloading, History, etc.
 */
import { useEffect, useState } from 'react';
import {
  Navigate,
  Route,
  HashRouter as Router,
  Routes,
} from 'react-router-dom';
import TelemetryConsentModal from './Components/Main/Modal/TelemetryConsentModal';
import ClipboardLinkDetector from './Components/SubComponents/custom/ClipboardLinkDetector';
import StoreRehydrationLoader from './Components/SubComponents/custom/StoreRehydrationLoader';
import UpdateNotification from './Components/SubComponents/custom/UpdateNotifications';
import { Toaster } from './Components/SubComponents/shadcn/components/ui/toaster';
import { useToast } from './Components/SubComponents/shadcn/hooks/use-toast';
import { ThemeProvider } from './Components/ThemeProvider';
import MainLayout from './Layout/MainLayout';
import PluginLayout from './Layout/PluginLayout';
import History from './Pages/History';
import PluginManager from './Pages/PlugInManager';
import StatusSpecificDownloads from './Pages/StatusSpecificDownload';
import CategoryPage from './Pages/SubPages/CategoryPage';
import NotFound from './Pages/SubPages/NotFound';
import PluginDetails from './Pages/SubPages/PluginDetails';
import TagPage from './Pages/SubPages/TagsPage';
import { useMainStore } from './Store/mainStore';
import { initializeTelemetry } from './Store/telemetryStore';
import { PluginLoader } from './plugins/PluginLoader';
import FormatSelectorManager from './plugins/components/FormatSelectorManager';
import PluginModalManager from './plugins/components/PluginModalManager';
import PluginSidePanelManager from './plugins/components/PluginSidePanelManager';
import SystemTrayHandler from './Components/SubComponents/custom/SystemTrayHandler';
import ActivityMonitor from './Components/SubComponents/custom/ActivityMonitor';
import NotificationManager from './Components/SubComponents/custom/NotificationManager';
import { testNotifications } from './Utils/testNotifications';

const App = () => {
  const { settings, updateTelemetryConsentShown } = useMainStore();
  const [showTelemetryConsentModal, setShowTelemetryConsentModal] =
    useState(false);
  const { toast } = useToast();

  // Check if we should show telemetry consent modal
  useEffect(() => {
    // Show consent modal if it hasn't been shown before
    if (!settings.telemetryConsentShown) {
      // Small delay to allow app to fully load
      const timer = setTimeout(() => {
        setShowTelemetryConsentModal(true);
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [settings.telemetryConsentShown]);

  // Handle telemetry consent modal close
  const handleTelemetryConsentClose = () => {
    setShowTelemetryConsentModal(false);
    // Ensure consent shown flag is set even if user closes modal without choosing
    if (!settings.telemetryConsentShown) {
      updateTelemetryConsentShown(true);
    }
  };

  // Initialize telemetry store on app startup (runs once)
  useEffect(() => {
    const initAppTelemetry = async () => {
      try {
        const telemetryId = await initializeTelemetry();
        // console.log('✅ App telemetry initialized:', telemetryId);

        // Optional: Log app startup event
        if (telemetryId) {
          // console.log('📊 Telemetry ready for app-wide usage');
        }
      } catch (error) {
        console.error('❌ Failed to initialize app telemetry:', error);
        // App continues to function normally even if telemetry fails
      }
    };

    initAppTelemetry();
  }, []); // Empty dependency array = runs once on mount

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

    // Initialize test utilities for development
    if (process.env.NODE_ENV === 'development') {
      console.log('📱 Notification system loaded! Test with:');
      console.log('• window.testNotifications.testAll() - Test all features');
      console.log('• window.testNotifications.testDownloadComplete() - Test download notification');
      console.log('• window.testNotifications.testDockBadge() - Test dock badge');
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
            /*
            toast({
              title: 'YT-DLP Updated Successfully',
              description: updateInfo.message,
              duration: 5000,
            });
            */
          },
        );
        removeListeners.push(removeYtdlpUpdated);
      }

      // Handle YT-DLP auto-installed event
      if (window.updateAPI.onYtdlpAutoInstalled) {
        const removeYtdlpInstalled = window.updateAPI.onYtdlpAutoInstalled(
          (installInfo) => {
            /*
            toast({
              title: 'YT-DLP Installed Successfully',
              description: installInfo.message,
              duration: 5000,
            });
            */
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
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Navigate to="/status/all" replace />} />
              <Route path="/history" element={<History />} />
              <Route path="/category/:categoryId" element={<CategoryPage />} />
              <Route path="/tags/:tagId" element={<TagPage />} />
              <Route
                path="/status/:status"
                element={<StatusSpecificDownloads />}
              />
              <Route path="*" element={<NotFound />} />
            </Route>

          <Route path="/plugins" element={<PluginLayout />}>
            <Route index element={<PluginManager />} />
            <Route path="details" element={<PluginDetails />} />
          </Route>
        </Routes>
      </Router>
      <Toaster />
      <UpdateNotification />
      <ClipboardLinkDetector />
      <PluginLoader />
      <FormatSelectorManager />
      <PluginSidePanelManager />
      <PluginModalManager />
      <SystemTrayHandler />
      <ActivityMonitor />
      <NotificationManager />
    </ThemeProvider>
  );
};

export default App;
