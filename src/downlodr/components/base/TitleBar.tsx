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
import { RxBox } from 'react-icons/rx';
import DownlodrLogoDark from '../../../assets/logo/downlodr_dark.svg';
import DownlodrLogoLight from '../../../assets/logo/downlodr_light.svg';
import { useTheme } from '../../../core-app/components/ThemeProvider';
import { ModeToggle } from './ModeToggle';
interface TitleBarProps {
  className?: string;
}

const TitleBar: React.FC<TitleBarProps> = ({ className }) => {
  const { theme } = useTheme();
  const [isMaximized, setIsMaximized] = React.useState<boolean>(false);

  React.useEffect(() => {
    window.appBehaviorBridge?.onMaximizeChange(setIsMaximized);
    return () => {
      window.appBehaviorBridge?.offMaximizeChange();
    };
  }, []);

  // Adjust downlodr logo used depending on the light/dark mode
  const logoStyle = { height: '24px', width: 'auto' };

  const getLogoSrc = () => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? (
        <img src={DownlodrLogoDark} alt="Downlodr Logo" style={logoStyle} />
      ) : (
        <img src={DownlodrLogoLight} alt="Downlodr Logo" style={logoStyle} />
      );
    }
    return theme === 'dark' ? (
      <img src={DownlodrLogoDark} alt="Downlodr Logo" style={logoStyle} />
    ) : (
      <img src={DownlodrLogoLight} alt="Downlodr Logo" style={logoStyle} />
    );
  };

  return (
    <>
      <div className={className}>
        <div className="flex justify-between items-center h-full px-2">
          {/* Title */}
          <div className="text-sm flex-1 drag-area">{getLogoSrc()}</div>

          {/* Buttons */}
          <div className="flex space-x-4 no-drag">
            {/* Help Button */}

            {/*Dark Mode/Light Mode */}
            <ModeToggle />

            {/* Minimize Button */}
            <button
              className="rounded-md hover:bg-gray-100 dark:hover:bg-darkModeCompliment hover:opacity-100 p-1 m-2"
              onClick={() => window.downlodrFunctions?.minimizeApp()}
            >
              <IoMdRemove size={16} />
            </button>

            {/* Maximize Button with dynamic icon */}
            <button
              className="rounded-md hover:bg-gray-100 dark:hover:bg-darkModeCompliment hover:opacity-100 p-1 m-2"
              onClick={() => window.downlodrFunctions?.maximizeApp()}
            >
              {isMaximized ? <PiBrowsers size={16} /> : <RxBox size={14} />}
            </button>

            {/* Close Button */}
            <button
              className="rounded-md hover:bg-gray-100 dark:hover:bg-darkModeCompliment hover:opacity-100 p-1 m-2"
              onClick={() => window.downlodrFunctions?.closeApp()}
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
