/* eslint-disable prettier/prettier */
/** App shell: window, device info, clipboard, updates, telemetry, add-ons, boot splash. */
import type { UpdateInfo } from '@/plugins/schema/types';
import type { AppInfo, BrowserInfo, DeviceInfo } from './shared';

declare global {
  interface Window {
    /** App window behavior & generic invoke (baseAppHandler) */
    appBehaviorBridge: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      showInputContextMenu: () => void;
      invokeMainProcess: (channel: string, ...args: unknown[]) => Promise<unknown>;
      minimizeApp: () => void;
      maximizeApp: () => void;
      closeApp: () => void;
      onMaximizeChange: (callback: (isMaximized: boolean) => void) => void;
      offMaximizeChange: () => void;
    };

    /** App/device info (baseAppHandler) */
    appInfoBridge: {
      getBundledBinaryPath: (binaryName: string) => Promise<string | null>;
      getHostInfo: () => Promise<DeviceInfo | null>;
      getBrowserInfo: () => Promise<BrowserInfo | null>;
      getAppInfo: () => Promise<AppInfo | null>;
      getOSType: () => Promise<string>;
    };

    /** DevTools (baseAppHandler) */
    electronDevToolsBridge: {
      toggle: () => void;
    };

    /** Window visibility, clipboard, auto-launch (baseAppHandler) */
    appControlBridge: {
      showWindow: () => Promise<boolean>;
      hideWindow: () => Promise<boolean>;
      quitApp: () => Promise<void>;
      setAutoLaunch: (enabled: boolean) => Promise<void>;
      getAutoLaunch: () => Promise<boolean>;
      getClipboardText: () => Promise<string>;
      onClipboardChange: (callback: (text: string) => void) => void;
      offClipboardChange: () => void;
      startClipboardMonitoring: () => Promise<boolean>;
      stopClipboardMonitoring: () => Promise<boolean>;
      isClipboardMonitoringActive: () => Promise<boolean>;
      isWindowFocused: () => Promise<boolean>;
      clearLastClipboardText: () => Promise<void>;
      clearClipboard: () => Promise<boolean>;
    };

    /** Run in background (baseAppHandler) */
    backgroundSettings: {
      getRunInBackground: () => Promise<boolean>;
      setRunInBackground: (value: boolean) => Promise<boolean>;
    };

    /** Download finished notification (baseAppHandler) */
    notifications: {
      notifyDownloadFinished: (downloadInfo: {
        name: string;
        id: string;
        location: string;
      }) => void;
    };

    /** App/YT-DLP updates (updateHandler) */
    updateFunctionsBridge: {
      onUpdateAvailable: (callback: (updateInfo: UpdateInfo) => void) => () => void;
      onYtdlpAutoUpdated: (callback: (updateInfo: { fromVersion: string; toVersion: string; message: string }) => void) => () => void;
      onYtdlpAutoInstalled: (callback: (installInfo: { version: string; message: string }) => void) => () => void;
      checkForUpdates: () => Promise<UpdateInfo>;
      getCurrentVersion: () => Promise<string>;
      downloadUpdate: (url: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
      cancelDownload: () => Promise<void>;
      onDownloadProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void) => () => void;
      onDownloadComplete: (callback: (info: { filePath: string }) => void) => () => void;
      onDownloadError: (callback: (info: { error: string }) => void) => () => void;
      installUpdate: () => Promise<{ success: boolean; error?: string }>;
      getAutoUpdateState: () => Promise<{ status: string; percent?: number; transferred?: number; total?: number; updateInfo?: UpdateInfo; filePath?: string; error?: string }>;
      startAutoUpdateCheck: () => Promise<{ checked: boolean; hasUpdate?: boolean; reason?: string }>;
      onAutoUpdateStarted: (callback: (info: { updateInfo?: UpdateInfo }) => void) => () => void;
      onAutoUpdateProgress: (callback: (progress: { percent: number; transferred: number; total: number }) => void) => () => void;
      onAutoUpdateReady: (callback: (info: { filePath: string; updateInfo?: UpdateInfo }) => void) => () => void;
      onAutoUpdateError: (callback: (info: { error: string }) => void) => () => void;
    };

    /** Telemetry (telemetryHandler) */
    telemetry: {
      logInfo: (message: string, data: string) => Promise<unknown>;
      logError: (message: string, data: Record<string, unknown>, error: string) => Promise<unknown>;
      logWarning: (message: string, data: string) => Promise<unknown>;
      getTelemetryAppInfo: () => Promise<unknown>;
    };

    // ─── Add-on Manager bridge ────────────────────────────────────────────
    addonBridge: {
      getStatus: () => Promise<{
        afda: { status: string; installedVersion?: string; path: string | null };
        skedulosa: { status: string; installedVersion?: string; path: string | null };
        smartOrganize: { status: string; installedVersion?: string; path: string | null };
      }>;
      download: (pack: 'afda-backend' | 'video-nemesis-toolkit' | 'smart-organize-backend') => Promise<{ started: boolean }>;
      restart: () => Promise<void>;
      delete: (pack: 'afda-backend' | 'video-nemesis-toolkit' | 'smart-organize-backend') => Promise<{ success: boolean; deferred?: boolean; error?: string }>;
      openFolder: (pack: 'afda-backend' | 'video-nemesis-toolkit' | 'smart-organize-backend') => Promise<{ success: boolean }>;
      cancel: (pack: 'afda-backend' | 'video-nemesis-toolkit' | 'smart-organize-backend') => Promise<void>;
      on: {
        progress: (cb: (data: { pack: 'afda-backend' | 'video-nemesis-toolkit' | 'smart-organize-backend'; percent: number }) => void) => () => void;
        complete: (cb: (data: { pack: 'afda-backend' | 'video-nemesis-toolkit' | 'smart-organize-backend'; success: boolean; error?: string }) => void) => () => void;
        servicesReady: (cb: () => void) => () => void;
      };
    };

    // ─── Boot status bridge (splash screen only) ──────────────────────────
    bootStatusBridge: {
      onStatus: (cb: (message: string) => void) => () => void;
    };
  }
}
