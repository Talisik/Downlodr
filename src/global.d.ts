/* eslint-disable prettier/prettier */
/**
 * Type definitions for global variables and functions used in the application.
 * These match the IPC renderer bridges exposed in src/core-app/ipc/renderer/.
 * Use the bridge names (e.g. window.fileInfoBridge) or the composed API
 * (e.g. window.downlodrFunctions) once the preload wires them.
 */
import type {
  FormatSelectorResult,
  MenuItem,
  MenuItemRegistration,
  PluginInfo,
  PluginManifest,
  PluginModalOptions,
  PluginSidePanelOptions,
  PluginSidePanelResult,
  SaveDialogOptions,
  SaveDialogResult,
  TaskBarItem,
  TaskBarItemRegistration,
  UpdateInfo,
  WriteFileOptions,
  WriteFileResult,
} from './plugins/schema/types';

// --- Shared response types (from main process handlers) ---
export interface AppInfo {
  app_name: string;
  app_platform: string;
  electron_version: string;
  app_arch: string;
}

export interface BrowserInfo {
  browser_name: string;
  browser_version: string;
  browser_arch: string;
}

export interface DeviceInfo {
  user_name: string;
  host_name: string;
  host_id: string;
  host_type: string;
  host_arch: string;
  os_type: string;
  os_description: string;
  os_name: string;
  os_version: string;
  cpu_model: string;
  cpu_cores: number;
  cpu_threads: number;
  memory_total_gb: number;
  memory_available_gb: number;
}

export type GetInfoResponse = Record<string, unknown> | null;

// --- YT-DLP download status (passed to progress callback) ---
export interface YtdlpDownloadStatus {
  type?: string;
  downloadId?: string;
  controllerId?: string;
  data?: { status?: string; [key: string]: unknown };
  [key: string]: unknown;
}

// --- YT-DLP playlist info (getPlaylistInfo response) ---
export interface PlaylistInfoEntry {
  id: string;
  url: string;
  title: string;
  thumbnails: { url: string }[];
  channel: string;
}

export interface PlaylistInfoResponse {
  data: {
    title: string;
    entries: PlaylistInfoEntry[];
  };
}

declare global {
  const __TELEMETRY_ENDPOINT__: string;
  const __TELEMETRY_TIMEOUT__: string;
  const __TELEMETRY_RETRY_ATTEMPTS__: string;
  const __TELEMETRY_SCHEMA_URL__: string;

  interface Window {
    // ========== Actual IPC bridges (exposed by renderer handlers) ==========

    /** App window behavior & generic invoke (baseAppHandler) */
    appBehaviorBridge: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      showInputContextMenu: () => void;
      invokeMainProcess: (channel: string, ...args: unknown[]) => Promise<unknown>;
      minimizeApp: () => void;
      maximizeApp: () => void;
      closeApp: () => void;
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

    /** Video blob/chunk (fileHandler) */
    videoBridge: {
      getVideoBlob: (filePath: string) => Promise<unknown>;
      getVideoChunk: (filePath: string, start: number, end: number) => Promise<unknown>;
    };

    /** Paths, directory, file size (fileHandler) */
    fileInfoBridge: {
      getPathSeparator: () => Promise<string>;
      ensureDirectoryExists: (dirPath: string) => Promise<boolean>;
      normalizePath: (filepath: string) => Promise<string>;
      getDownloadFolder: () => Promise<string>;
      isValidPath: (filepath: string) => Promise<boolean>;
      joinDownloadPath: (downloadPath: string, fileName: string) => Promise<string>;
      validatePath: (folderPath: string) => Promise<boolean>;
      fileExists: (path: string) => Promise<boolean>;
      getFileSize: (path: string) => Promise<number | null>;
      getDirectorySize: (path: string) => Promise<number>;
    };

    /** Open/delete video, download file, select file (fileHandler) */
    fileFunctionsBridge: {
      selectVideoFile: () => Promise<string | null>;
      downloadFile: (url: string, outputPath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      openVideo: (filePath: string) => Promise<void>;
      deleteFile: (filepath: string) => Promise<boolean>;
      deleteFolder: (folderpath: string) => Promise<boolean>;
      openFolder: (folderPath: string, filePath: string) => Promise<{ success: boolean; error?: string }>;
    };

    /** External link, thumbnail, internet check (browserHandler) */
    browserFunctionsBridge: {
      openExternalLink: (link: string) => Promise<void>;
      getThumbnailDataUrl: (path: string) => Promise<string | null>;
      checkInternetConnection: () => Promise<boolean>;
    };

    /** YT-DLP: info, download, stop, version (downlodrHandler) */
    ytdlpFunctionsBridge: {
      getPlaylistInfo: (url: string) => Promise<PlaylistInfoResponse>;
      getInfo: (url: string) => Promise<GetInfoResponse>;
      killController: (id: string) => Promise<unknown>;
      stop: (id: string) => Promise<boolean>;
      selectDownloadDirectory: () => Promise<string>;
      downloadYTDLP: (options?: {
        filePath?: string;
        version?: string;
        platform?: string;
        forceDownload?: boolean;
      }) => Promise<{ success: boolean; error?: string }>;
      getCurrentVersion: () => Promise<{ success: boolean; version?: string; error?: string }>;
      getLatestVersion: () => Promise<{ success: boolean; version?: string; message?: string; error?: string }>;
      checkAndUpdate: () => Promise<{
        success: boolean;
        action: 'downloaded' | 'updated' | 'up-to-date' | 'error';
        message: string;
        currentVersion?: string;
        latestVersion?: string;
        error?: string;
      }>;
      /** Returns download id; status updates delivered via callback */
      download: (
        args: { url: string; outputFilepath: string; videoFormat: string },
        callback: (result: YtdlpDownloadStatus) => void,
      ) => string;
      getDirectUrl: (url: string) => Promise<string>;
      readCaptionFile: (filePath: string) => Promise<string>;
    };

    /** Plugins: list, install, menu, taskbar, file ops (pluginHandler) */
    pluginControlBridge: {
      list: () => Promise<PluginInfo[]>;
      getCode: (pluginId: string) => Promise<{ code: string; manifest: PluginManifest; error?: string }>;
      install: (pluginPath: string) => Promise<boolean | string>;
      uninstall: (pluginId: string) => Promise<boolean>;
      getMenuItems: (context: string) => Promise<MenuItem[]>;
      executeMenuItem: (id: string, contextData?: unknown) => Promise<void>;
      loadUnzipped: (pluginDirPath: string) => Promise<boolean>;
      extractPlugin: (zipPath: string, extractTo: string) => Promise<string>;
      writeFile: (options: WriteFileOptions) => Promise<WriteFileResult>;
      registerMenuItem: (menuItem: MenuItemRegistration) => Promise<string>;
      unregisterMenuItem: (id: string) => Promise<boolean>;
      getPluginDataPath: (pluginId: string) => Promise<string>;
      saveFileDialog: (options: SaveDialogOptions) => Promise<SaveDialogResult>;
      reload: () => Promise<boolean>;
      onReloaded: (callback: () => void) => () => void;
      getEnabledPlugins: () => Promise<Record<string, boolean>>;
      setPluginEnabled: (pluginId: string, enabled: boolean) => Promise<boolean>;
      onPluginStateChanged: (callback: (data: { pluginId: string; enabled: boolean }) => void) => () => void;
      getPluginLocation: (pluginId: string) => Promise<string | null>;
      openPluginFolder: (pluginId: string) => Promise<boolean>;
      registerTaskBarItem: (item: TaskBarItemRegistration) => Promise<string>;
      unregisterTaskBarItem: (id: string) => Promise<boolean>;
      getTaskBarItems: () => Promise<TaskBarItem[]>;
      executeTaskBarItem: (id: string, contextData?: unknown) => Promise<boolean>;
      readFile: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>;
      readFileContents: (options: { filePath: string; pluginId?: string }) => Promise<{ success: boolean; data?: string; error?: string }>;
      closePluginPanel: () => Promise<void>;
    };

    /** Plugin utilities (pluginHandler) */
    pluginFunctionsBridge: {
      convertToDocx: (content: string, title?: string) => Promise<unknown>;
    };

    /** App/YT-DLP updates (updateHandler) */
    updateFunctionsBridge: {
      onUpdateAvailable: (callback: (updateInfo: UpdateInfo) => void) => () => void;
      onYtdlpAutoUpdated: (callback: (updateInfo: { fromVersion: string; toVersion: string; message: string }) => void) => () => void;
      onYtdlpAutoInstalled: (callback: (installInfo: { version: string; message: string }) => void) => () => void;
      checkForUpdates: () => Promise<UpdateInfo>;
      getCurrentVersion: () => Promise<string>;
    };

    /** Transcription (transcriptHandler) */
    transcribeBridge: {
      ffmpegWhisperTranscribe: (options: {
        inputFile: string;
        outputFile: string;
        modelPath: string;
        language?: string;
        format?: string;
      }) => Promise<{ success: boolean; outputFile: string; stdout: string; stderr: string }>;
      onFFmpegProgress: (callback: (progress: string) => void) => () => void;
    };

    /** Telemetry (telemetryHandler) */
    telemetry: {
      logInfo: (message: string, data: string) => Promise<unknown>;
      logError: (message: string, data: Record<string, unknown>, error: string) => Promise<unknown>;
      logWarning: (message: string, data: string) => Promise<unknown>;
      getTelemetryAppInfo: () => Promise<unknown>;
    };

    // ========== Composed API (same shape as bridges; assign in preload for app compatibility) ==========

    /** Single namespace for app + file + browser + transcript (use bridges or this) */
    downlodrFunctions: {
      closeApp: () => void;
      minimizeApp: () => void;
      maximizeApp: () => void;
      openExternalLink: (link: string) => Promise<void>;
      openVideo: (videoPath: string) => Promise<void>;
      deleteFile: (videoPath: string) => Promise<boolean>;
      deleteFolder: (folderPath: string) => Promise<boolean>;
      getDownloadFolder: () => Promise<string>;
      getAppInfo: () => Promise<AppInfo | null>;
      getBrowserInfo: () => Promise<BrowserInfo | null>;
      getHostInfo: () => Promise<DeviceInfo | null>;
      isValidPath: (videoPath: string) => Promise<boolean>;
      joinDownloadPath: (downloadPath: string, fileName: string) => Promise<string>;
      validatePath: (folderPath: string) => Promise<boolean>;
      openFolder: (folderPath: string, filePath: string) => Promise<{ success: boolean; error?: string }>;
      fileExists: (path: string) => Promise<boolean>;
      getFileSize: (path: string) => Promise<number | null>;
      getDirectorySize: (path: string) => Promise<number>;
      showInputContextMenu: () => void;
      invokeMainProcess: (channel: string, ...args: unknown[]) => Promise<unknown>;
      downloadFile: (url: string, outputPath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      ensureDirectoryExists: (dirPath: string) => Promise<boolean>;
      getThumbnailDataUrl: (path: string) => Promise<string | null>;
      getOSType: () => Promise<string>;
      getPathSeparator: () => Promise<string>;
      getBundledBinaryPath: (binaryName: string) => Promise<string | null>;
      checkInternetConnection: () => Promise<boolean>;
      ffmpegWhisperTranscribe: (options: {
        inputFile: string;
        outputFile: string;
        modelPath: string;
        language?: string;
        format?: string;
      }) => Promise<{ success: boolean; outputFile: string; stdout: string; stderr: string }>;
      onFFmpegProgress: (callback: (progress: string) => void) => () => void;
      selectVideoFile: () => Promise<string | null>;
    };

    /** YT-DLP API (use ytdlpFunctionsBridge or this) */
    ytdlp: {
      getPlaylistInfo: (url: string) => Promise<PlaylistInfoResponse>;
      getInfo: (url: string) => Promise<GetInfoResponse>;
      selectDownloadDirectory: () => Promise<string>;
      download: (
        options: { url: string; outputFilepath: string; videoFormat: string },
        progressCallback: (result: YtdlpDownloadStatus) => void,
      ) => string;
      killController: (controllerId: string) => Promise<unknown>;
      stop: (id: string) => Promise<boolean>;
      downloadYTDLP: (options?: { filePath?: string; version?: string; platform?: string; forceDownload?: boolean }) => Promise<{ success: boolean; error?: string }>;
      getCurrentVersion: () => Promise<{ success: boolean; version?: string; error?: string }>;
      getLatestVersion: () => Promise<{ success: boolean; version?: string; message?: string; error?: string }>;
      checkAndUpdate: () => Promise<{
        success: boolean;
        action: 'downloaded' | 'updated' | 'up-to-date' | 'error';
        message: string;
        currentVersion?: string;
        latestVersion?: string;
        error?: string;
      }>;
      getDirectUrl: (url: string) => Promise<string>;
      readCaptionFile: (filePath: string) => Promise<string>;
    };

    /** Use electronDevToolsBridge or this */
    electronDevTools: {
      toggle: () => void;
    };

    /** Use updateFunctionsBridge or this */
    updateAPI: {
      onUpdateAvailable: (callback: (updateInfo: UpdateInfo) => void) => () => void;
      onYtdlpAutoUpdated: (callback: (info: { fromVersion: string; toVersion: string; message: string }) => void) => () => void;
      onYtdlpAutoInstalled: (callback: (info: { version: string; message: string }) => void) => () => void;
      onYtdlpUpdateAvailable?: (callback: (info: { currentVersion: string; latestVersion: string; message: string }) => void) => () => void;
      checkForUpdates: () => Promise<UpdateInfo>;
      getCurrentVersion: () => Promise<string>;
    };

    /** Use pluginControlBridge or this */
    plugins: {
      list: () => Promise<PluginInfo[]>;
      getCode: (pluginId: string) => Promise<{ code: string; manifest: PluginManifest; error?: string }>;
      install: (pluginPath: string) => Promise<boolean | string>;
      uninstall: (pluginId: string) => Promise<boolean>;
      getMenuItems: (context: string) => Promise<MenuItem[]>;
      executeMenuItem: (id: string, contextData?: unknown) => Promise<void>;
      loadUnzipped: (pluginDirPath: string) => Promise<boolean>;
      extractPlugin: (zipPath: string, extractTo: string) => Promise<string>;
      writeFile: (options: WriteFileOptions) => Promise<WriteFileResult>;
      readFile: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>;
      readFileContents: (options: { filePath: string; pluginId?: string }) => Promise<{ success: boolean; data?: string; error?: string }>;
      registerMenuItem: (menuItem: MenuItemRegistration) => Promise<string>;
      unregisterMenuItem: (id: string) => Promise<boolean>;
      reload: () => Promise<boolean>;
      onReloaded: (callback: () => void) => () => void;
      getEnabledPlugins: () => Promise<Record<string, boolean>>;
      setPluginEnabled: (pluginId: string, enabled: boolean) => Promise<boolean>;
      onPluginStateChanged: (callback: (data: { pluginId: string; enabled: boolean }) => void) => () => void;
      getPluginLocation: (pluginId: string) => Promise<string | null>;
      openPluginFolder: (pluginId: string) => Promise<boolean>;
      registerTaskBarItem: (item: TaskBarItemRegistration) => Promise<string>;
      unregisterTaskBarItem: (id: string) => Promise<boolean>;
      getTaskBarItems: () => Promise<TaskBarItem[]>;
      executeTaskBarItem: (id: string, contextData?: unknown) => Promise<boolean>;
      saveFileDialog: (options: SaveDialogOptions) => Promise<SaveDialogResult>;
    };

    /** Use appControlBridge or this */
    appControl: {
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
      clearLastClipboardText: () => Promise<void>;
      clearClipboard: () => Promise<boolean>;
      isWindowFocused: () => Promise<boolean>;
    };

    // ─── Skedulosa (video-nemesis-toolkit) bridge ─────────────────────────
    skedulosaBridge: {
      // Schedules
      listSchedules: () => Promise<unknown[]>;
      getSchedule: (id: string) => Promise<unknown>;
      createSchedule: (payload: { name?: string | null }) => Promise<unknown>;
      updateSchedule: (id: number, payload: { name?: string | null }) => Promise<unknown>;
      deleteSchedule: (id: number) => Promise<void>;
      // Channels
      listChannels: (activeOnly?: boolean, scheduleId?: number) => Promise<unknown[]>;
      getChannel: (id: number) => Promise<unknown>;
      createChannel: (payload: {
        schedule_id: number;
        url: string;
        name?: string | null;
        all_words?: string[];
        any_words?: string[];
        none_words?: string[];
        min_duration_minutes?: number | null;
        max_duration_minutes?: number | null;
        download_format?: string;
        download_subtitles?: number;
        download_thumbnails?: number;
        active?: number;
        first_scrape_limit?: number,  
      }) => Promise<unknown>;
      updateChannel: (id: number, payload: {
        url?: string;
        name?: string | null;
        all_words?: string[];
        any_words?: string[];
        none_words?: string[];
        min_duration_minutes?: number | null;
        max_duration_minutes?: number | null;
        download_format?: string;
        download_subtitles?: number;
        download_thumbnails?: number;
        active?: number;
      }) => Promise<unknown>;
      deleteChannel: (id: number) => Promise<void>;
      setChannelActive: (id: number, isActive: boolean) => Promise<void>;
      // Channel Slots
      listChannelSlots: (channelId: number) => Promise<unknown[]>;
      replaceChannelSlots: (channelId: number, slots: { day_of_week: number; time_minutes: number }[]) => Promise<unknown[]>;
      addChannelSlot: (channelId: number, slot: { day_of_week: number; time_minutes: number }) => Promise<unknown>;
      getNextRun: (fromDate?: string) => Promise<string | null>;
      // Channel Analysis
      analyzeChannelSchedule: (channelUrl: string) => Promise<unknown>;
      fetchAccurateTimestamps: (channelUrl: string) => Promise<unknown>;
      fetchChannelDetails: (channelUrl: string) => Promise<unknown>;
      fetchUploadDates: (channelUrl: string, daysBack?: number, maxPerDay?: number) => Promise<{ dates: string[]; error?: string }>;
      saveAnalysisVideos: (channelId: number, videos: unknown[]) => Promise<unknown>;
      // Intelligent Schedule
      getIntelligentSchedule: (channelId: number) => Promise<unknown>;
      getUpcomingSchedules: (hoursAhead?: number) => Promise<unknown[]>;
      getOverdueSchedules: () => Promise<unknown[]>;
      getScheduleStats: () => Promise<unknown>;
      refreshAllIntelligentSchedules: () => Promise<unknown>;
      // Download Tasks
      listDownloadTasks: (status?: string) => Promise<unknown[]>;
      getDownloadTask: (id: number) => Promise<unknown>;
      addDownloadTask: (payload: { video_url: string; channel_id: number }) => Promise<unknown>;
      markDownloadTaskFinished: (id: number) => Promise<unknown>;
      deleteDownloadTask: (id: number) => Promise<{ deleted: number }>;
      clearPendingDownloadTasks: () => Promise<{ cleared: boolean }>;
      // Download History
      listDownloadHistory: (filters?: { channelId?: number; status?: string; limit?: number; offset?: number }) => Promise<unknown[]>;
      // Video Details
      listVideoDetails: (channelName?: string) => Promise<unknown[]>;
      getVideoDetail: (videoUrl: string) => Promise<unknown>;
      // Scraper Control
      startScraper: () => Promise<void>;
      stopScraper: () => Promise<void>;
      runScraperOnce: (channelId?: number) => Promise<void>;
      // Download Worker Control
      startDownloadWorker: () => Promise<void>;
      stopDownloadWorker: () => Promise<void>;
      getDownloadWorkerStatus: () => Promise<{ running: boolean }>;
      // Process Info
      getProcessLoad: () => Promise<{ memory: { rss: number; heapUsed: number; heapTotal: number; external: number }; cpu: { user: number; system: number } }>;
      // Push Events
      onDownloadQueuePushed: (callback: (tasks: unknown[]) => void) => void;
      onScraperStatus: (callback: (status: { phase: string; nextRunAt?: string }) => void) => void;
      removeDownloadQueueListener: () => void;
      removeScraperStatusListener: () => void;
      onScraperChannelLog: (callback: (message: string) => void) => void;
      removeScraperChannelLogListener: () => void;
    };

    // Optional UI managers (may be set by app)
    PluginHandlers?: Record<string, (contextData?: unknown) => void>;
    formatSelectorManager?: {
      showFormatSelector: (options: import('./plugins/schema/types').FormatSelectorOptions) => Promise<FormatSelectorResult | null>;
    };
    pluginModalManager?: {
      showPluginModal: (options: PluginModalOptions) => Promise<import('./plugins/schema/types').PluginModalResult | null>;
    };
    pluginSidePanelManager?: {
      showPluginSidePanel: (options: PluginSidePanelOptions) => Promise<PluginSidePanelResult>;
    };
  }
}

export { };

