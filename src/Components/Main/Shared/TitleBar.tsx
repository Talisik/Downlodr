import React, { useState } from 'react';
import { IoMdClose, IoMdRemove } from 'react-icons/io';
import { PiBrowsers } from 'react-icons/pi';
import { FiHelpCircle } from 'react-icons/fi';
import downlodrLogoLight from '../../../Assets/Logo/Downlodr-Logo.svg';
import downlodrLogoDark from '../../../Assets/Logo/Downlodr-LogoDark.svg';
import { ModeToggle } from '../../../Components/SubComponents/custom/ModeToggle';
import { useTheme } from '../../../Components/ThemeProvider';
import HelpModal from '../../Main/Modal/HelpModal';

interface TitleBarProps {
  className?: string;
}

const TitleBar: React.FC<TitleBarProps> = ({ className }) => {
  const { theme } = useTheme();

  const getLogoSrc = () => {
    if (theme === 'system') {
      // Check system preference
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? downlodrLogoDark
        : downlodrLogoLight;
    }
    // Direct theme selection
    return theme === 'dark' ? downlodrLogoDark : downlodrLogoLight;
  };

  return (
    <>
      <div className={className}>
        <div className="flex justify-between items-center h-full px-4">
          {/* Title */}
          <div className="text-sm flex-1 drag-area">
            <img src={getLogoSrc()} alt="Downlodr" className="h-5" />
          </div>

          {/* Buttons */}
          <div className="flex space-x-4 no-drag">
            {/* Help Button */}

            {/*Dark Mode/Light Mode */}
            <ModeToggle />

            {/* Minimize Button */}
            <button
              className="hover:bg-gray-100 dark:hover:bg-gray-700 p-1"
              onClick={() => window.downlodrFunctions.minimizeApp()}
            >
              <IoMdRemove size={16} />
            </button>

            {/* Maximize Button */}
            <button
              className="hover:bg-gray-100 dark:hover:bg-gray-700 p-1"
              onClick={() => window.downlodrFunctions.maximizeApp()}
            >
              <PiBrowsers size={16} />
            </button>

            {/* Close Button */}
            <button
              className="hover:bg-gray-100 dark:hover:bg-gray-700 p-1"
              onClick={() => window.downlodrFunctions.closeApp()}
            >
              <IoMdClose size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default TitleBar;
