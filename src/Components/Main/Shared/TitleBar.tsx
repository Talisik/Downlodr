/**
 * A custom React fixed component
 * A Fixed element in the header portion of Downlodr, displays the title/logo of Downlodr with the window controls (maximize, minimize, and close)
 *
 * @param className - for UI of TitleBar
 * @returns JSX.Element - The rendered component displaying a TitleBar
 *
 */
import React from 'react';
import { IoMdClose, IoMdRemove } from 'react-icons/io';
import { PiBrowsers } from 'react-icons/pi';
import downlodrLogoLight from '../../../Assets/Logo/Downlodr-Logo.svg';
import downlodrLogoDark from '../../../Assets/Logo/Downlodr-LogoDark.svg';
import { ModeToggle } from '../../../Components/SubComponents/custom/ModeToggle';
import { useTheme } from '../../../Components/ThemeProvider';
import { RxBox } from 'react-icons/rx';

interface TitleBarProps {
  className?: string;
}

const TitleBar: React.FC<TitleBarProps> = ({ className }) => {
  const { theme } = useTheme();
  const [isMaximized, setIsMaximized] = React.useState<boolean>(false);

  // Function to toggle maximize/restore
  const handleMaximizeRestore = () => {
    window.downlodrFunctions.maximizeApp();
    setIsMaximized(!isMaximized);
  };

  // Adjust downlodr logo used depending on the light/dark mode
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
              className="hover:bg-gray-100 dark:hover:bg-gray-700 p-1 m-2"
              onClick={() => window.downlodrFunctions.minimizeApp()}
            >
              <IoMdRemove size={16} />
            </button>

            {/* Maximize Button with dynamic icon */}
            <button
              className="hover:bg-gray-100 dark:hover:bg-gray-700 p-1 m-2"
              onClick={handleMaximizeRestore}
            >
              {isMaximized ? <PiBrowsers size={16} /> : <RxBox size={14} />}
            </button>

            {/* Close Button */}
            <button
              className="hover:bg-gray-100 dark:hover:bg-gray-700 p-1 m-2"
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
