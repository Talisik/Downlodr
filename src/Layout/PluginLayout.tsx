import TitleBar from '../Components/Main/Shared/TitleBar';
import DropdownBar from '../Components/Main/Shared/DropdownBar';
import { NavLink, Outlet } from 'react-router-dom';

const PluginLayout = () => {
  return (
    <div className="h-screen flex flex-col bg-white dark:bg-darkMode text-gray-900 dark:text-gray-100">
      <TitleBar className="h-10 p-2 bg-titleBar dark:bg-[#1F2937] border-b border-gray-200 dark:border-componentBorder" />
      <DropdownBar className="h-11 pl-4 bg-nav-main dark:bg-darkMode border-b border-gray-200 dark:border-componentBorder" />
      <div className="bg-nav-main dark:bg-darkMode border-b border-gray-200 dark:border-componentBorder">
        <div
          className="flex w-[189px] items-start justify-between pr-[24px] pl-[16px]"
          style={{
            gap: '12px',
            paddingBottom: '8px',
            paddingTop: '8px',
          }}
        >
          <NavLink
            to="/status/all"
            className={({ isActive }) =>
              `px-3 py-1 rounded flex gap-1 font-semibold ${
                isActive || location.pathname.startsWith('/status/')
                  ? 'bg-[#F5F5F5] text-[#F45513] dark:bg-[#3E3E46] dark:text-white'
                  : 'hover:bg-gray-100 dark:hover:bg-darkModeHover dark:text-gray-200'
              }`
            }
            end={false}
          >
            <span>Downloads</span>
          </NavLink>
          <NavLink
            to="/plugins"
            className={({ isActive }) =>
              `px-3 py-1 rounded flex gap-1 font-semibold ${
                isActive
                  ? 'bg-[#F5F5F5] text-[#F45513] dark:bg-[#3E3E46] dark:text-white'
                  : 'hover:bg-gray-100 dark:hover:bg-darkModeHover dark:text-gray-200'
              }`
            }
          >
            <span>Plugins</span>
          </NavLink>
          <div className="h-6 w-[1.5px] bg-gray-300 dark:bg-gray-600 self-center"></div>
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
