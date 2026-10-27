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
 * Heights of the controls row and the logo row. On macOS the controls row is
 * empty space for the native traffic lights, which end at 22px
 * (trafficLightPosition y: 10 in main.ts + 12px circles) — keep in step. The
 * logo row is tightened there too so the logo sits just under them.
 *
 * Elsewhere the controls get a 4px top margin: flush against the window's top
 * edge they sit inside the OS resize border, which swallows their clicks.
 */
const CONTROLS_ROW_HEIGHT = IS_MAC ? 'h-[22px]' : 'h-7';
const CONTROLS_MARGIN = IS_MAC ? '' : 'mt-1';
const LOGO_ROW_HEIGHT = IS_MAC ? 'h-7' : 'h-8';

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
            Either way they sit on their own row above the logo, with the
            theme toggle at its right end; on macOS the rest of that row is
            left clear for the traffic lights, and the empty space is still
            a drag handle. */}
        <div
          className={`flex justify-end items-center gap-2 ${CONTROLS_ROW_HEIGHT} px-2 drag-area`}
        >
          <div className={`flex items-center gap-2 no-drag ${CONTROLS_MARGIN}`}>
            {/* Dark Mode/Light Mode — in line with the window controls */}
            <ModeToggle />

            {!IS_MAC && (
              <div className="flex items-center gap-1 ml-2">
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
            )}
          </div>
        </div>

        <div
          className={`flex justify-between items-center ${LOGO_ROW_HEIGHT} px-2`}
        >
          {/* Logo + drag handle — self-stretch gives it the row's full height
              so the whole strip is draggable, not just the logo. */}
          <div className="text-sm flex-1 self-stretch flex items-center drag-area">
            {getLogoSrc()}
          </div>
        </div>
      </div>
    </>
  );
};

export default TitleBar;
