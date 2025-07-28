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
        <div className="flex justify-between items-center h-full px-4 py-2">
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
              className="rounded-md hover:bg-gray-100 dark:hover:bg-darkModeCompliment hover:opacity-100 p-1 m-2"
              onClick={() => window.downlodrFunctions.minimizeApp()}
            >
              <IoMdRemove size={16} />
            </button>

            {/* Maximize Button with dynamic icon */}
            <button
              className="rounded-md hover:bg-gray-100 dark:hover:bg-darkModeCompliment hover:opacity-100 p-1 m-2"
              onClick={handleMaximizeRestore}
            >
              {isMaximized ? <PiBrowsers size={16} /> : <RxBox size={14} />}
            </button>

            {/* Close Button */}
            <button
              className="rounded-md hover:bg-gray-100 dark:hover:bg-darkModeCompliment hover:opacity-100 p-1 m-2"
              onClick={handleCloseClick}
            >
              <IoMdClose size={16} />
            </button>
          </div>
        </div>
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
