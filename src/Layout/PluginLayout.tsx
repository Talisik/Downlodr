import TitleBar from '../Components/Main/Shared/TitleBar';
import DropdownBar from '../Components/Main/Shared/DropdownBar';
import { Outlet } from 'react-router-dom';
import PageNavigation from '../Components/Main/Shared/PageNavigation';

const PluginLayout = () => {
  return (
    <div className="h-screen flex flex-col bg-white dark:bg-darkMode text-gray-900 dark:text-gray-100">
      <TitleBar className="h-10 p-2 bg-titleBar dark:bg-darkMode border-b-2 border-gray-200 dark:border-darkModeCompliment" />
      <DropdownBar className="h-11 pl-4 bg-nav-main dark:bg-darkMode border-b-2 border-gray-200 dark:border-darkModeCompliment" />
      <div className="bg-nav-main dark:bg-darkMode border-b border-gray-200 dark:border-darkModeCompliment">
        <div className="pl-[16px] pr-[24px] py-[8px]">
          <PageNavigation />
        </div>
      </div>
      {/* Main content area - no sidebar navigation */}
      <div className="flex-1 overflow-hidden h-[calc(100vh-120px)]">
        <main className="h-full overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default PluginLayout;
