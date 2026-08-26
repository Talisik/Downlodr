/**
 * A custom React fixed component
 * A Fixed element in the header portion of Downlodr, displays the title/logo
 * of Downlodr next to the theme toggle. macOS-only build: window controls
 * (minimize, maximize, close) are the native traffic-light buttons — no
 * custom Windows-style buttons are rendered here.
 *
 * @param className - for UI of TitleBar
 * @returns JSX.Element - The rendered component displaying a TitleBar
 *
 */

import React from 'react';
import DownlodrLogoDark from '../../../assets/logo/downlodr_dark.svg';
import DownlodrLogoLight from '../../../assets/logo/downlodr_light.svg';
import { useTheme } from '../../../core-app/components/ThemeProvider';
import { ModeToggle } from './ModeToggle';
interface TitleBarProps {
  className?: string;
}

const TitleBar: React.FC<TitleBarProps> = ({ className }) => {
  const { theme } = useTheme();

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

  // macOS renders native traffic-light buttons (titleBarStyle: 'hiddenInset'
  // + trafficLightPosition: { x: 12, y: 10 } in main.ts) as an overlay on
  // top of this web content, not as DOM elements — nothing here can push
  // them aside via z-index. Without a matching left inset any content there
  // paints directly underneath, covering the yellow/green traffic lights
  // entirely. 78px clears the ~64px-wide dot cluster (12px x-offset + 3×12px
  // dots + 2×8px gaps) plus a small margin.
  //
  // `process` is NOT available here: contextIsolation keeps Node globals
  // out of the page's own JS regardless of nodeIntegration, so the
  // platform has to come from the preload-exposed bridge instead (see
  // baseAppHandler.ts's platformInfo).
  const isDarwin = window.platformInfo?.platform === 'darwin';

  return (
    <>
      <div className={className}>
        <div
          className="flex justify-between items-center h-full px-2"
          style={isDarwin ? { paddingLeft: '78px' } : undefined}
        >
          {/* Empty drag region — clicking/dragging here moves the window.
              Window controls are the native macOS traffic lights. */}
          <div className="text-sm flex-1 drag-area" />

          {/* Logo + theme toggle */}
          <div className="flex items-center space-x-4 no-drag">
            {getLogoSrc()}
            <ModeToggle />
          </div>
        </div>
      </div>
    </>
  );
};

export default TitleBar;
