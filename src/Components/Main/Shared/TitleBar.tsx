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
  const [appVersion, setAppVersion] = React.useState<string>('');

  // Fetch app version on mount
  React.useEffect(() => {
    const getVersion = async () => {
      try {
        if (window.updateAPI?.getCurrentVersion) {
          const version = await window.updateAPI.getCurrentVersion();
          if (version) {
            setAppVersion(version);
          }
        }
      } catch (error) {
        console.error('Error getting app version:', error);
      }
    };
    getVersion();
  }, []);

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
          // macOS native title bar with hiddenInset style - respect traffic lights
          <div
            className="flex items-center justify-between h-full px-6 py-2"
            style={
              {
                WebkitAppRegion: 'drag',
                paddingLeft: '80px', // Leave space for traffic lights
              } as React.CSSProperties
            }
          >
            {/* Main content area - draggable (left empty to keep drag region) */}
            <div className="flex-1" />

            {/* Right controls - not draggable */}
            <div
              className="flex items-center space-x-3"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              <ModeToggle />
              <img src={getLogoSrc()} alt="Downlodr" className="h-5" />
              {appVersion && (
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  v{appVersion}
                </span>
              )}
            </div>
          </div>
        ) : (
          // Windows/Linux custom title bar with full window controls
          <div className="flex justify-between items-center h-full px-4 py-2">
            {/* Title/Drag Region */}
            <div
              className="text-sm flex-1"
              style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
            />
            {/* Buttons */}
            <div
              className="flex items-center space-x-3"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            >
              <ModeToggle />
              <img src={getLogoSrc()} alt="Downlodr" className="h-5" />
              {appVersion && (
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  v{appVersion}
                </span>
              )}
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
