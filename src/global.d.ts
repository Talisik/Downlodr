/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Type definitions for global variables and functions used in the application.
 * This file extends the Window interface to include custom functions and properties
 * that are accessible in the renderer process.
 */
import { FormatSelectorResult, MenuItem, PluginInfo, PluginManifest, PluginModalOptions, PluginSidePanelOptions, PluginSidePanelResult, TaskBarItem } from './plugins/types';
import { SaveDialogOptions, SaveDialogResult, WriteFileOptions, WriteFileResult } from './Schema/downlodrFunction';

// Auto-updater types
type AppUpdateStatusType =
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

interface AppUpdateStatus {
  status: AppUpdateStatusType;
  version?: string;
  releaseNotes?: string;
  releaseDate?: string;
  downloadUrl?: string;
  error?: string;
}

interface AppUpdateDownloadProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

declare global {
  interface Window {
    electronAPI: {
      // File conversion functionality
      convertFile: (options: {
        downloadId: string;
        inputPath: string;
        targetFormat: string;
        keepOriginal: boolean;
        downloadName: string;
        saveToCustomLocation?: boolean;
      }) => Promise<{
        success: boolean;
        outputPath?: string;
        error?: string;
      }>;
      // Enhanced FFmpeg status checking
      checkFfmpegStatus: () => Promise<{
        available: boolean;
        version?: string;
        path?: string;
        architecture?: string;
        error?: string;
      }>;
      // Conversion control functions
      pauseConversion: (downloadId: string) => Promise<{
        success: boolean;
        message?: string;
        error?: string;
      }>;
      resumeConversion: (downloadId: string) => Promise<{
        success: boolean;
        message?: string;
        error?: string;
      }>;
      stopConversion: (downloadId: string) => Promise<{
        success: boolean;
        message?: string;
        error?: string;
      }>;
    };
    downlodrFunctions: {
      //Title bar functions
      closeApp: () => void;
      minimizeApp: () => void;
      maximizeApp: () => void;
      openExternalLink: (link: string) => Promise<void>;

      //Downlodr functions
      openVideo: (videoPath: string) => Promise<void>; // Opens a video file
      deleteFile: (videoPath: string) => Promise<boolean>; // Deletes a specified file from storage/drive
      deleteFolder: (folderPath: string) => Promise<boolean>; // Deletes a specified folder from storage/drive
      getDownloadFolder: () => Promise<string>; // Retrieves the default download folder path
      isValidPath: (videoPath: string) => Promise<boolean>; // Validates a given file path if it exists
      joinDownloadPath: (
        downloadPath: string,
        fileName: string,
      ) => Promise<string>; // Joins a download path with a filename
      validatePath: (folderPath: string) => Promise<boolean>; // Validates a folder path
      openFolder: (
        folderPath: string,
        filePath: string,
      ) => Promise<{ success: boolean; error?: string }>; // Opens a specified folder
      fileExists: (path: string) => Promise<boolean>; // Checks if a file exists at the specified path
      getFileSize: (path: string) => Promise<number | null>; // Gets the size of a file in bytes
      getDirectorySize: (path: string) => Promise<number>; // Gets the total size of all files in a directory in bytes
      showInputContextMenu: () => void; // Shows the input field context menu (right-click menu)
      invokeMainProcess: (channel: string, ...args: any[]) => Promise<any>;
      downloadFile: (
        url: string,
        outputPath: string,
      ) => Promise<{
        success: boolean;
        path?: string;
        error?: string;
      }>;
      ensureDirectoryExists: (dirPath: string) => Promise<boolean>; // Creates directory if it doesn't exist
      getThumbnailDataUrl: (path: string) => Promise<string | null>;
      getOSType: () => Promise<'windows' | 'macos' | 'linux' | string>; // Gets the current operating system type
      getPathSeparator: () => Promise<string>; // Gets the path separator for the current OS
      // Enhanced FFmpeg status checking
      checkFfmpegStatus: () => Promise<{
        available: boolean;
        version?: string;
        path?: string;
        architecture?: string;
        error?: string;
      }>;
      // File conversion functionality
      convertFile: (options: {
        downloadId: string;
        inputPath: string;
        targetFormat: string;
        keepOriginal: boolean;
        downloadName: string;
      }) => Promise<{
        success: boolean;
        outputPath?: string;
        error?: string;
      }>;
    };
    ytdlp: {
      getPlaylistInfo: (options: { url: string }) => any; // Retrieves information about a playlist
      getInfo: (url: string) => Promise<GetInfoResponse>; // Retrieves information about a video
      selectDownloadDirectory: () => Promise<string>; // Prompts the user to select a download directory
      download: (
        options: { url: string; outputFilepath: string; videoFormat: string },
        progressCallback: (progress: any) => void,
      ) => { downloadId: string; controllerId: string | undefined }; // Initiates a download
      onDownloadStatusUpdate: (
        id: string,
        callback: (result: any) => void,
      ) => void; // Subscribes to download status updates
      offDownloadStatusUpdate: (
        id: string,
        callback: (result: any) => void,
      ) => void; // Unsubscribes from download status updates
      killController: (
        controllerId: string,
      ) => Promise<{ success: boolean; error?: string }>; // Kills a download controller
      stop: (id: string) => Promise<boolean>;
      downloadYTDLP: (options?: {
        filePath?: string;
        version?: string;
        platform?: string;
        forceDownload?: boolean;
      }) => Promise<{ success: boolean; error?: string }>; // Downloads YTDLP binary with custom options
      getCurrentVersion: () => Promise<{ success: boolean; version?: string; error?: string }>; // Gets current YT-DLP version
      getLatestVersion: () => Promise<{ success: boolean; version?: string; message?: string; error?: string }>; // Gets latest YT-DLP version
      checkAndUpdate: () => Promise<{ 
        success: boolean; 
        action: 'downloaded' | 'updated' | 'up-to-date' | 'error';
        message: string;
        currentVersion?: string;
        latestVersion?: string;
        error?: string;
      }>; // Checks and updates YT-DLP to latest version automatically
    };
    electronDevTools: {
      toggle: () => void; // Toggles the visibility of the developer tools
    };
    updateAPI: {
      onUpdateAvailable: (
        callback: (updateInfo: UpdateInfo) => void,
      ) => () => void;
      onYtdlpAutoUpdated: (
        callback: (updateInfo: {
          fromVersion: string;
          toVersion: string;
          message: string;
        }) => void,
      ) => () => void;
      onYtdlpAutoInstalled: (
        callback: (installInfo: {
          version: string;
          message: string;
        }) => void,
      ) => () => void;
      onYtdlpUpdateAvailable: (
        callback: (updateInfo: {
          currentVersion: string;
          latestVersion: string;
          message: string;
        }) => void,
      ) => () => void;
      onUpdateCheckStarted: (callback: () => void) => () => void;
      onUpdateCheckCompleted: (
        callback: (updateInfo: UpdateInfo) => void,
      ) => () => void;
      onUpdateCheckError: (callback: (error: any) => void) => () => void;
      onOpenSettingsModal: (callback: () => void) => () => void;
      checkForUpdates: () => Promise<UpdateInfo>;
      getCurrentVersion: () => Promise<string>; // Gets current app version without GitHub API call
    };
    appAutoUpdater: {
      getStatus: () => Promise<AppUpdateStatus>;
      checkForUpdates: () => Promise<AppUpdateStatus>;
      downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
      installUpdate: () => Promise<{ success: boolean; error?: string }>;
      onUpdateStatus: (callback: (status: AppUpdateStatus) => void) => () => void;
      onDownloadProgress: (
        callback: (progress: AppUpdateDownloadProgress) => void,
      ) => () => void;
    };
    backgroundSettings: {
      getRunInBackground: () => Promise<boolean>;
      setRunInBackground: (value: boolean) => Promise<boolean>;
      onBackgroundSettingSync: (callback: () => void) => () => void;
      removeBackgroundSettingSync: (callback: () => void) => void;
    };
    notifications: {
      notifyDownloadFinished: (downloadInfo: {
        name: string;
        id: string;
        location: string;
      }) => void;
    };
    plugins: {
      list: () => Promise<PluginInfo[]>;
      getCode: (
        pluginId: string,
      ) => Promise<{ code: string; manifest: PluginManifest; error?: string }>;
      install: (pluginPath: string) => Promise<boolean | string>;
      uninstall: (pluginId: string) => Promise<boolean>;
      getMenuItems: (context: string) => Promise<MenuItem[]>;
      executeMenuItem: (id: string, contextData?: any) => Promise<void>;
      loadUnzipped: (pluginDirPath: string) => Promise<boolean>;
      extractPlugin: (zipPath: string, extractTo: string) => Promise<string>;
      writeFile: (options: WriteFileOptions & { videoPath?: string }) => Promise<WriteFileResult>;
      readFile: (
        filePath: string,
      ) => Promise<{ success: boolean; data?: string; error?: string }>;
      readFileContents: (options: {
        filePath: string;
        pluginId?: string;
      }) => Promise<{ success: boolean; data?: string; error?: string }>;

      registerMenuItem: (menuItem: MenuItem) => Promise<string>;
      unregisterMenuItem: (id: string) => Promise<boolean>;
      reload: () => Promise<boolean>;
      onReloaded: (callback: () => void) => () => void;
      getEnabledPlugins: () => Promise<Record<string, boolean>>;
      setPluginEnabled: (
        pluginId: string,
        enabled: boolean,
      ) => Promise<boolean>;
      onPluginStateChanged: (
        callback: (data: { pluginId: string; enabled: boolean }) => void,
      ) => () => void;
      getPluginLocation: (pluginId: string) => Promise<string | null>;
      openPluginFolder: (pluginId: string) => Promise<boolean>;

      // TaskBar items
      registerTaskBarItem: (item: TaskBarItem) => Promise<string>;
      unregisterTaskBarItem: (id: string) => Promise<boolean>;
      getTaskBarItems: () => Promise<TaskBarItem[]>;
      executeTaskBarItem: (id: string, contextData?: any) => Promise<boolean>;
      saveFileDialog: (options: SaveDialogOptions) => Promise<SaveDialogResult>;
    };
    PluginHandlers?: Record<string, (contextData?: any) => void>;
    formatSelectorManager?: {
      showFormatSelector: (options: FormatSelectorOptions) => Promise<FormatSelectorResult>;
    };
    pluginSidePanelManager?: {
      showPluginSidePanel: (options: PluginSidePanelOptions) => Promise<PluginSidePanelResult>;
    };
    pluginModalManager?: {
      showPluginModal: (options: PluginModalOptions) => Promise<PluginModalResult>;
    };
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
    activityIndicator: {
      start: () => Promise<boolean>;
      stop: () => Promise<boolean>;
    };
    notificationAPI?: {
      showNotification: (config: {
        title: string;
        body: string;
        icon?: string;
        actions?: Array<{ action: string; title: string }>;
      }) => Promise<{
        title: string;
        body: string;
        icon?: string;
        onclick?: (event: Event) => void;
      }>;
      requestPermissions: () => Promise<boolean>;
      hasPermissions: () => Promise<boolean>;
    };
    dockBadgeAPI?: {
      setBadgeCount: (count: number) => Promise<void>;
      getBadgeCount: () => Promise<number>;
      clearBadge: () => Promise<void>;
    };
    telemetryAPI?: {
      consentRequired: () => Promise<boolean>;
      consentCompleted: () => Promise<boolean>;
    };
    
  }
}


export { };

