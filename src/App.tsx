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
import Downloading from './Pages/Downloading';
// import AllDownloads from './Pages/AllDownloads';
import History from './Pages/History';
import CompletedDownloads from './Pages/CompletedDownloads';
import NotFound from './Pages/SubPages/NotFound';
import CategoryPage from './Pages/SubPages/CategoryPage';
import TagPage from './Pages/SubPages/TagsPage';
import { Toaster } from './Components/SubComponents/shadcn/components/ui/toaster';
import UpdateNotification from './Components/SubComponents/custom/UpdateNotifications';
import StatusSpecificDownloads from './Pages/StatusSpecificDownload';

const App = () => {
  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <Router>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/status/all" replace />} />
            <Route path="/downloading" element={<Downloading />} />
            <Route path="/completed" element={<CompletedDownloads />} />
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
    </ThemeProvider>
  );
};

export default App;
