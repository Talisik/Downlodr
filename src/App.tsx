/**
 * Main application component for the React application.
 * This component defines the structure of the UI, setting up the routing and theming for the app.
 *
 * Dependencies:
 * - React Router: For handling navigation between different pages.
 * - ThemeProvider: A custom component for managing theme settings.
 * - Various page components: AllDownloads, Downloading, History, etc.
 */
import { useEffect } from 'react';
import {
  Navigate,
  Route,
  HashRouter as Router,
  Routes,
} from 'react-router-dom';
import ClipboardLinkDetector from './Components/SubComponents/custom/ClipboardLinkDetector';
import UpdateNotification from './Components/SubComponents/custom/UpdateNotifications';
import { Toaster } from './Components/SubComponents/shadcn/components/ui/toaster';
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
import { PluginLoader } from './plugins/PluginLoader';
import FormatSelectorManager from './plugins/components/FormatSelectorManager';
import PluginModalManager from './plugins/components/PluginModalManager';
import PluginSidePanelManager from './plugins/components/PluginSidePanelManager';
import SystemTrayHandler from './Components/SubComponents/custom/SystemTrayHandler';
import ActivityMonitor from './Components/SubComponents/custom/ActivityMonitor';
import NotificationManager from './Components/SubComponents/custom/NotificationManager';

const App = () => {
  const { settings } = useMainStore();

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
      console.log(
        '• window.testNotifications.testDownloadComplete() - Test download notification',
      );
      console.log(
        '• window.testNotifications.testDockBadge() - Test dock badge',
      );

      // Add comprehensive test functions
      (window as any).testNotifications = {
        testAll: async () => {
          console.log('🧪 Testing all notification features...');
          await (window as any).testNotifications.testPermissions();
          await (window as any).testNotifications.testDownloadComplete();
          await (window as any).testNotifications.testDockBadge();
        },

        testPermissions: async () => {
          console.log('🔐 Testing notification permissions...');
          if (window.notificationAPI) {
            const hasPermissions =
              await window.notificationAPI.hasPermissions();
            console.log('Current permissions:', hasPermissions);

            if (!hasPermissions) {
              const granted = await window.notificationAPI.requestPermissions();
              console.log('Permission request result:', granted);
            }
          }
        },

        testDownloadComplete: async () => {
          console.log('📥 Testing download complete notification...');
          if (window.notificationAPI) {
            try {
              const result = await window.notificationAPI.showNotification({
                title: 'Download Complete',
                body: 'Test video has finished downloading',
                icon: '/Assets/AppLogo/notif.png',
              });
              console.log('Notification result:', result);
            } catch (error) {
              console.error('Notification test failed:', error);
            }
          } else {
            console.error('notificationAPI not available');
          }
        },

        testDockBadge: async () => {
          console.log('🏷️ Testing dock badge...');
          if (window.dockBadgeAPI) {
            try {
              // Test setting badge
              await window.dockBadgeAPI.setBadgeCount(5);
              const count = await window.dockBadgeAPI.getBadgeCount();
              console.log('Badge count set to 5, actual count:', count);

              // Test clearing badge after 3 seconds
              setTimeout(async () => {
                await window.dockBadgeAPI.clearBadge();
                const newCount = await window.dockBadgeAPI.getBadgeCount();
                console.log('Badge cleared, new count:', newCount);
              }, 3000);
            } catch (error) {
              console.error('Dock badge test failed:', error);
            }
          } else {
            console.error('dockBadgeAPI not available');
          }
        },
      };
    }

    // Add test functions for dock badge in global window for debugging
    (window as any).testDockBadge = {
      setBadgeCount: async (count: number) => {
        console.log(`Testing dock badge with count: ${count}`);
        if (window.dockBadgeAPI) {
          try {
            const result = await window.dockBadgeAPI.setBadgeCount(count);
            console.log('Dock badge set result:', result);
            return result;
          } catch (error) {
            console.error('Failed to set dock badge:', error);
            return false;
          }
        } else {
          console.error('dockBadgeAPI not available');
          return false;
        }
      },
      getBadgeCount: async () => {
        if (window.dockBadgeAPI) {
          try {
            const count = await window.dockBadgeAPI.getBadgeCount();
            console.log('Current dock badge count:', count);
            return count;
          } catch (error) {
            console.error('Failed to get dock badge count:', error);
            return null;
          }
        } else {
          console.error('dockBadgeAPI not available');
          return null;
        }
      },
      clearBadge: async () => {
        if (window.dockBadgeAPI) {
          try {
            const result = await window.dockBadgeAPI.clearBadge();
            console.log('Badge cleared:', result);
            return result;
          } catch (error) {
            console.error('Failed to clear badge:', error);
            return false;
          }
        } else {
          console.error('dockBadgeAPI not available');
          return false;
        }
      },
    };
  }, [settings.runInBackground]);

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
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
