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
    </ThemeProvider>
  );
};

export default App;
