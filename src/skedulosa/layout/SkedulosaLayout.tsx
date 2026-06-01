import TaskBar from '@/downlodr/components/base/Taskbar';
import TitleBar from '@/downlodr/components/base/TitleBar';
import { Component, ErrorInfo, ReactNode, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { SkedulosaNavigation } from '../components/SkedulosaNavigation';
import { SubscriptionQueueProvider } from '../context/SubscriptionQueueContext';
import { SubscriptionQueueBanner } from '../components/SubscriptionQueueBanner';

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

const SkedulosaLayout = () => {
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const toggleNavCollapse = () => setIsNavCollapsed((prev) => !prev);

  return (
    <ErrorBoundary>
      <SubscriptionQueueProvider>
        <div className="h-screen flex flex-col bg-[#F9F9F9] dark:bg-darkMode text-gray-900 dark:text-gray-100 p-4 pt-3 gap-2">
          <TitleBar className="h-8 bg-[#F9F9F9] dark:bg-darkMode" />
          <TaskBar className="rounded-md w-full px-6 py-2 pl-[8px] bg-white dark:bg-darkMode" />
          <div className="flex flex-1 overflow-hidden h-[calc(100vh-120px)] gap-4">
            <SkedulosaNavigation
              className={`${
                isNavCollapsed ? 'w-[65px]' : 'w-[195px]'
              } rounded-md bg-white dark:bg-darkModeNavigation overflow-y-auto h-full transition-all duration-300`}
              collapsed={isNavCollapsed}
              toggleCollapse={toggleNavCollapse}
            />
            <main className="flex-1 overflow-auto bg-white dark:bg-darkMode rounded-md">
              <SubscriptionQueueBanner />
              <Outlet />
            </main>
          </div>
        </div>
      </SubscriptionQueueProvider>
    </ErrorBoundary>
  );
};

export default SkedulosaLayout;
