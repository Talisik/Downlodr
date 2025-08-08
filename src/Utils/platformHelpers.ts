/**
 * Platform detection utilities for cross-platform behavior
 */
import React from 'react';

export interface PlatformInfo {
  isMacOS: boolean;
  isWindows: boolean;
  isLinux: boolean;
  platform: string;
}

/**
 * Get current platform information
 * Uses IPC to get platform info from main process
 */
export const getPlatformInfo = async (): Promise<PlatformInfo> => {
  try {
    // Check if we have access to IPC
    if (typeof window !== 'undefined' && window.electronAPI) {
      const platform = await window.electronAPI.getPlatform();
      return {
        isMacOS: platform === 'darwin',
        isWindows: platform === 'win32',
        isLinux: platform === 'linux',
        platform,
      };
    }

    // Fallback for development/browser context
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.indexOf('mac') !== -1) {
      return {
        isMacOS: true,
        isWindows: false,
        isLinux: false,
        platform: 'darwin',
      };
    } else if (userAgent.indexOf('win') !== -1) {
      return {
        isMacOS: false,
        isWindows: true,
        isLinux: false,
        platform: 'win32',
      };
    } else {
      return {
        isMacOS: false,
        isWindows: false,
        isLinux: true,
        platform: 'linux',
      };
    }
  } catch (error) {
    console.warn('Failed to detect platform, defaulting to non-macOS', error);
    return {
      isMacOS: false,
      isWindows: true,
      isLinux: false,
      platform: 'win32',
    };
  }
};

/**
 * React hook for platform detection
 */
export const usePlatform = () => {
  const [platformInfo, setPlatformInfo] = React.useState<PlatformInfo>({
    isMacOS: false,
    isWindows: true,
    isLinux: false,
    platform: 'win32',
  });

  React.useEffect(() => {
    getPlatformInfo().then(setPlatformInfo);
  }, []);

  return platformInfo;
};
