/**
 * A custom React fixed component
 * A Fixed element in the header portion of Downlodr, displays the title/logo of Downlodr with the window controls (maximize, minimize, and close)
 *
 * @param className - for UI of TitleBar
 * @returns JSX.Element - The rendered component displaying a TitleBar
 *
 */
import downlodrLogoLight from '@/Assets/Logo/Downlodr-Logo.svg';
import downlodrLogoDark from '@/Assets/Logo/Downlodr-LogoDark.svg';
import ExitModal from '@/Components/Main/Modal/ExitModal';
import { ModeToggle } from '@/Components/SubComponents/custom/ModeToggle';
import { useTheme } from '@/Components/ThemeProvider';
import { useMainStore } from '@/Store/mainStore';
import React from 'react';
import { IoMdClose, IoMdRemove } from 'react-icons/io';
import { PiBrowsers } from 'react-icons/pi';
import { RxBox } from 'react-icons/rx';
interface TitleBarProps {
  className?: string;
}

const TitleBar: React.FC<TitleBarProps> = ({ className }) => {
  const { theme } = useTheme();
  const [isMaximized, setIsMaximized] = React.useState<boolean>(false);

  // Detect macOS platform in renderer
  const isMacOS = React.useMemo(() => {
    if (typeof navigator !== 'undefined') {
      return /mac/i.test(navigator.platform);
    }
    return false;
  }, []);

  // Get settings from store
  const { settings, isExitModalOpen, setIsExitModalOpen } = useMainStore();
  const runInBackgroundEnabled = settings.runInBackground;
  const showExitModal = settings.exitModal ?? true;

  // Function to toggle maximize/restore
  const handleMaximizeRestore = () => {
    window.downlodrFunctions.maximizeApp();
    setIsMaximized(!isMaximized);
  };

  // Handle close button click
  const handleCloseClick = () => {
    console.log('Settings object:', settings);
    console.log('runInBackgroundEnabled:', runInBackgroundEnabled);
    console.log('showExitModal:', showExitModal);
    console.log('settings.exitModal:', settings.exitModal);
    // If run in background is enabled and user hasn't disabled the exit modal, show the modal
    if (runInBackgroundEnabled && showExitModal) {
      setIsExitModalOpen(true);
    } else if (runInBackgroundEnabled) {
      // Run in background enabled but modal disabled - just hide window
      window.downlodrFunctions.closeApp();
    } else {
      // Run in background disabled - actually quit the app
      window.appControl.quitApp();
    }
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
        {isMacOS ? (
          // macOS native title bar - fully draggable with controls on right
          <div className="flex items-center justify-between h-full px-6 drag-area">
            {/* Left spacer for traffic lights */}
            <div className="w-20" />

            {/* Right controls */}
            <div className="flex items-center space-x-3 no-drag">
              <ModeToggle />
              <img src={getLogoSrc()} alt="Downlodr" className="h-5" />
            </div>
          </div>
        ) : (
          // Windows/Linux custom title bar
          <div className="flex justify-between items-center h-full px-4 py-2">
            {/* Title */}
            <div className="text-sm flex-1 drag-area">
              <img src={getLogoSrc()} alt="Downlodr" className="h-5" />
            </div>
            {/* Buttons */}
            <div className="flex space-x-4 no-drag">
              <ModeToggle />
              {/* Minimize Button */}
              <button
                className="rounded-md bg-transparent hover:bg-lightGray dark:hover:bg-darkModeHover transition-colors duration-200 p-1 m-2 text-gray-700 dark:text-darkModeLight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={() => window.downlodrFunctions.minimizeApp()}
              >
                <IoMdRemove size={16} />
              </button>
              {/* Maximize Button with dynamic icon */}
              <button
                className="rounded-md bg-transparent hover:bg-lightGray dark:hover:bg-darkModeHover transition-colors duration-200 p-1 m-2 text-gray-700 dark:text-darkModeLight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={handleMaximizeRestore}
              >
                {isMaximized ? <PiBrowsers size={16} /> : <RxBox size={14} />}
              </button>
              {/* Close Button */}
              <button
                className="rounded-md bg-transparent hover:bg-red-500 dark:hover:bg-red-600 hover:text-white transition-colors duration-200 p-1 m-2 text-gray-700 dark:text-darkModeLight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onClick={handleCloseClick}
              >
                <IoMdClose size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      <ExitModal
        isOpen={isExitModalOpen}
        onClose={() => {
          setIsExitModalOpen(false);
        }}
        onConfirm={() => {
          setIsExitModalOpen(false);
          // Hide the window since we're running in background
          window.downlodrFunctions.closeApp();
        }}
      />
    </>
  );
};

export default TitleBar;
