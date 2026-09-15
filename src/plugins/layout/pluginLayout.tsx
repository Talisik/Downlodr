import SelectingDirectory from '@/core-app/overlays/SelectingDirectory';
import TaskBar from '@/downlodr/components/base/Taskbar';
import TitleBar from '@/downlodr/components/base/TitleBar';
import { Component, ReactNode, ErrorInfo } from 'react';
import { Outlet } from 'react-router-dom';
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

const PluginLayout = () => {
  return (
    <ErrorBoundary>
      <div className="h-screen flex flex-col bg-[#F9F9F9] dark:bg-darkMode text-gray-900 dark:text-gray-100 p-4 pt-3 gap-2">
        <TitleBar className="h-8 bg-[#F9F9F9] dark:bg-darkMode" />
        <TaskBar className="rounded-md w-full px-6 py-2 pl-[8px] bg-white dark:bg-darkModeTable" />
        <div className="flex flex-1 overflow-hidden h-[calc(100vh-120px)] gap-2">
          <main className="flex-1 overflow-auto bg-white dark:bg-darkMode rounded-md">
            <Outlet />
          </main>
        </div>
      </div>
      <SelectingDirectory />
    </ErrorBoundary>
  );
};

export default PluginLayout;
