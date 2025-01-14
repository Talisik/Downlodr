
import TitleBar from '../Components/Main/Shared/TitleBar';
import DropdownBar from '../Components/Main/Shared/DropdownBar';
import TaskBar from '../Components/Main/Shared/TaskBar';
import Navigation from '../Components/Main/Shared/Navigation';
import { Outlet } from 'react-router-dom';


const MainLayout = () => {
    return (
<div className="h-screen flex flex-col">
  <TitleBar className="h-10 p-2 bg-titleBar border-b-2 border-gray-200" />
  <DropdownBar className="h-10 pl-4 bg-nav-main border-b-2 border-gray-200" />
  <TaskBar className="py-[9px] pr-[24px] pl-[8px] bg-nav-main border-b-2 border-gray-200" />
  <div className="flex flex-1 overflow-hidden h-[calc(100vh-120px)]">
    <Navigation className="w-[218px] overflow-y-auto h-full" />
    <main className="flex-1 overflow-auto">
      <Outlet />
    </main>
  </div>
</div>
    );
  };

  export default MainLayout;
