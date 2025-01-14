import React from 'react';
import { IoMdClose, IoMdRemove } from 'react-icons/io';
import { MdOutlineWbSunny } from "react-icons/md";
import downlodrLogo from '../../../Assets/Logo/Downlodr-Logo.svg';

interface TitleBarProps {
  className?: string;
}

const TitleBar: React.FC<TitleBarProps> = ({ className }) => {
  return (
    <div className={className}>
      <div className="flex justify-between items-center h-full px-4">
      {/* Title */}
      <div className="text-sm flex-1 drag-area"><img src={downlodrLogo} alt="Downlodr" className="h-5" /></div>

        {/* Buttons */}
        <div className="flex space-x-4 no-drag">

          {/*Dark Mode/Light Mode */}
          <button className="hover:bg-gray-100 p-1">
            <MdOutlineWbSunny size={16} />
          </button>

          {/* Minimize Button */}
          <button className="hover:bg-gray-100 p-1" onClick={() => window.downlodrFunctions.minimizeApp()}>
            <IoMdRemove size={16} />
          </button>

          {/* Close Button */}
          <button className="hover:bg-gray-100 p-1"  onClick={() => window.downlodrFunctions.closeApp()}>
            <IoMdClose size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TitleBar;
