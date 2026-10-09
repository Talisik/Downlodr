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

/**
 * macOS draws its own traffic lights (see the titleBarStyle branch in
 * main.ts), so this bar must not render window controls there — two sets of
 * buttons, one of them fake, in the same 32px strip.
 *
 * Read synchronously from the user agent rather than through the app-info
 * IPC, which is async: resolving it after mount would lay the bar out once
 * without the traffic-light gutter and then shift it, visibly, on every
 * launch. The renderer is Chromium, so the UA is a dependable signal.
 */
const IS_MAC = navigator.userAgent.includes('Macintosh');

/**
 * Left padding reserved for the native traffic lights: 12px inset + three
 * 12px circles + two 8px gaps ≈ 64px, rounded up for breathing room. Keep in
 * step with trafficLightPosition in main.ts.
 */
const TRAFFIC_LIGHT_GUTTER = 'pl-[76px] pr-2';

const TitleBar: React.FC<TitleBarProps> = ({ className }) => {
  const { theme } = useTheme();
  const [isMaximized, setIsMaximized] = React.useState<boolean>(false);

  React.useEffect(() => {
    // Only the custom maximize button cares, and macOS never renders it.
    if (IS_MAC) return;
    window.appBehaviorBridge?.onMaximizeChange(setIsMaximized);
    return () => {
      window.appBehaviorBridge?.offMaximizeChange();
    };
  }, []);

  // Adjust downlodr logo used depending on the light/dark mode
  // pointer-events: none so the <img> doesn't start an HTML image drag and
  // steal the mouse from the window drag region it sits in.
  const logoStyle: React.CSSProperties = {
    height: '24px',
    width: 'auto',
    pointerEvents: 'none',
  };

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

  const windowButtonClass =
    'rounded-md hover:bg-gray-100 dark:hover:bg-darkModeCompliment hover:opacity-100 p-1';

  return (
    <>
      <div className={`flex flex-col ${className ?? ''}`}>
        {/* Window controls are ours to draw on Windows and Linux only.
            macOS renders real traffic lights top-left instead, which
            also get the hover glyphs, the fullscreen behaviour on green
            and the accessibility affordances that an imitation cannot.
            They sit on their own row above the logo; the empty space
            around them is still a drag handle. */}
        {!IS_MAC && (
          <div className="flex justify-end items-center gap-2 h-6 px-2 drag-area">
            <div className="flex items-center gap-2 no-drag">
              {/* Minimize Button */}
              <button
                className={windowButtonClass}
                onClick={() => window.downlodrFunctions?.minimizeApp()}
              >
                <IoMdRemove size={16} />
              </button>

              {/* Maximize Button with dynamic icon */}
              <button
                className={windowButtonClass}
                onClick={() => window.downlodrFunctions?.maximizeApp()}
              >
                {isMaximized ? <PiBrowsers size={16} /> : <RxBox size={14} />}
              </button>

              {/* Close Button */}
              <button
                className={windowButtonClass}
                onClick={() => window.downlodrFunctions?.closeApp()}
              >
                <IoMdClose size={16} />
              </button>
            </div>
          </div>
        )}

        <div
          className={`flex justify-between items-center h-8 ${
            IS_MAC ? TRAFFIC_LIGHT_GUTTER : 'px-2'
          }`}
        >
          {/* Logo + drag handle — self-stretch gives it the row's full height
              so the whole strip is draggable, not just the logo. On macOS it
              starts after the traffic-light gutter. */}
          <div className="text-sm flex-1 self-stretch flex items-center drag-area">
            {getLogoSrc()}
          </div>

          {/*Dark Mode/Light Mode — in line with the logo */}
          <div className="flex items-center no-drag">
            <ModeToggle />
          </div>
        </div>
      </div>
    </>
  );
};

export default TitleBar;
