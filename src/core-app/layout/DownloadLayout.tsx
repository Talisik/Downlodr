import { useSelectedDownloadStore } from '@/core-app/store/selectedDownloadStore';
import TaskBar from '@/downlodr/components/base/Taskbar';
import TitleBar from '@/downlodr/components/base/TitleBar';
import DownloadNavigationBar from '@/downlodr/components/navigation/DownloadNavigationBar';
import ArticleSidePanelManager from '@/afda/components/ArticleSidePanelManager';
import { Component, ErrorInfo, ReactNode, useRef, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useMainStore } from '../store/mainStore';
// import { useSlidePanel } from '@/core-app/hooks/animation/useSlidePanel';
// Error Boundary component
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Error Detection
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-center">
          <h1 className="text-xl text-red-600">Something went wrong</h1>
          <p className="text-gray-600">{this.state.error?.message}</p>
          <button
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
// End of Error Detection

const MainLayout = () => {
  const { isNavCollapsed, setIsNavCollapsed } = useMainStore();
  const clearAllSelections = useSelectedDownloadStore(
    (state) => state.clearAllSelections,
  );
  const toggleNavCollapse = () => {
    setIsNavCollapsed(!isNavCollapsed);
  };
  const location = useLocation();
  const previousMainPathRef = useRef<string | null>(null);
  // The content row: everything below the titlebar and taskbar.
  const contentRef = useRef<HTMLDivElement>(null);

  // Extract the top-level route segment (e.g. "downloads", "plugins", "subscriptions").
  const topSegment = location.pathname.split('/')[1] ?? '';

  useEffect(() => {
    if (
      previousMainPathRef.current !== null &&
      previousMainPathRef.current !== topSegment
    ) {
      clearAllSelections();
    }
    previousMainPathRef.current = topSegment;
  }, [topSegment]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearAllSelections();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearAllSelections]);

  return (
    <ErrorBoundary>
      <div className="h-screen flex flex-col bg-[#F9F9F9] dark:bg-darkMode text-gray-900 dark:text-gray-100 p-4 pt-3 gap-2">
        <TitleBar className="h-8 bg-[#F9F9F9] dark:bg-darkMode" />
        {/*<DropdownBar className="h-11 pl-4 bg-nav-main dark:bg-darkMode border-b-2 border-gray-200 dark:border-darkModeCompliment" />*/}
        <TaskBar className="rounded-md w-full px-6 py-2 pl-[8px] bg-white dark:bg-darkModeTable" />
        <div
          ref={contentRef}
          className="flex flex-1 overflow-hidden h-[calc(100vh-120px)] gap-2"
        >
          <DownloadNavigationBar
            className="rounded-md bg-white dark:bg-darkModeTable overflow-y-auto h-full"
            collapsed={isNavCollapsed}
            toggleCollapse={toggleNavCollapse}
          />
          <main className="flex-1 overflow-auto bg-white dark:bg-darkMode rounded-md">
            <Outlet />
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default MainLayout;
