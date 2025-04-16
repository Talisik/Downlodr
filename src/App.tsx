/**
 * Main application component for the React application.
 * This component defines the structure of the UI, setting up the routing and theming for the app.
 *
 * Dependencies:
 * - React Router: For handling navigation between different pages.
 * - ThemeProvider: A custom component for managing theme settings.
 * - Various page components: AllDownloads, Downloading, History, etc.
 */
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import { ThemeProvider } from './Components/ThemeProvider';
import MainLayout from './Layout/MainLayout';
// import AllDownloads from './Pages/AllDownloads';
import History from './Pages/History';
import PluginManager from './Pages/PlugInManager';
import NotFound from './Pages/SubPages/NotFound';
import CategoryPage from './Pages/SubPages/CategoryPage';
import TagPage from './Pages/SubPages/TagsPage';
import PluginDetails from './Pages/SubPages/PluginDetails';
import { Toaster } from './Components/SubComponents/shadcn/components/ui/toaster';
import UpdateNotification from './Components/SubComponents/custom/UpdateNotifications';
import StatusSpecificDownloads from './Pages/StatusSpecificDownload';
import { useEffect } from 'react';
import { useMainStore } from './Store/mainStore';
import { PluginLoader } from './plugins/PluginLoader';

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
            <Route path="/plugin-manager" element={<PluginManager />} />
            <Route path="/plugin-details" element={<PluginDetails />} />
            <Route path="/history" element={<History />} />
            <Route path="/category/:categoryId" element={<CategoryPage />} />
            <Route path="/tags/:tagId" element={<TagPage />} />
            <Route
              path="/status/:status"
              element={<StatusSpecificDownloads />}
            />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Router>
      <Toaster />
      <UpdateNotification />
      <PluginLoader />
    </ThemeProvider>
  );
};

export default App;
