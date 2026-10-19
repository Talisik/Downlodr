/* eslint-disable prettier/prettier */
/**
 * Composed / legacy namespaces. Same shapes as the bridges in the sibling
 * files; the preload assigns these for older call sites.
 */
import type {
  MenuItem,
  MenuItemRegistration,
  PluginInfo,
  PluginManifest,
  SaveDialogOptions,
  SaveDialogResult,
  TaskBarItem,
  TaskBarItemRegistration,
  UpdateInfo,
  WriteFileOptions,
  WriteFileResult,
} from '@/plugins/schema/types';
import type {
  AppInfo,
  BrowserInfo,
  DeviceInfo,
  GetInfoResponse,
  PlaylistInfoResponse,
  YtdlpDownloadStatus,
} from './shared';

declare global {
  interface Window {
    /** Single namespace for app + file + browser + transcript (use bridges or this) */
    downlodrFunctions: {
      closeApp: () => void;
      minimizeApp: () => void;
      maximizeApp: () => void;
      openExternalLink: (link: string) => Promise<void>;
      openVideo: (videoPath: string) => Promise<void>;
      deleteFile: (videoPath: string) => Promise<boolean>;
      deleteFolder: (folderPath: string) => Promise<boolean>;
      copyFile: (sourcePath: string, destinationPath: string) => Promise<boolean>;
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
      getFreeDiskSpace: (path: string) => Promise<number | null>;
      showInputContextMenu: () => void;
      invokeMainProcess: (channel: string, ...args: unknown[]) => Promise<unknown>;
      downloadFile: (url: string, outputPath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      ensureDirectoryExists: (dirPath: string) => Promise<boolean>;
      getThumbnailDataUrl: (path: string) => Promise<string | null>;
      getOSType: () => Promise<string>;
      getPathSeparator: () => Promise<string>;
      getBundledBinaryPath: (binaryName: string) => Promise<string | null>;
      checkInternetConnection: () => Promise<boolean>;
      checkSiteReachable: (url: string) => Promise<
        | { reachable: true }
        | {
            reachable: false;
            reason: 'invalid' | 'not_found' | 'refused' | 'timeout' | 'other';
          }
      >;
      ffmpegWhisperTranscribe: (options: {
        inputFile: string;
        outputFile: string;
        modelPath: string;
        language?: string;
        format?: string;
        /** Tags this job's progress events; see the main-process handler. */
        jobId?: string;
      }) => Promise<{ success: boolean; outputFile: string; stdout: string; stderr: string }>;
      onFFmpegProgress: (callback: (progress: string) => void) => () => void;
      selectVideoFile: () => Promise<string | null>;
      saveBufferToFile: (data: number[], filePath: string) => Promise<{ success: boolean; error?: string }>;
      htmlToPdf: (htmlContent: string) => Promise<{ success: boolean; data?: number[]; error?: string }>;
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
      onUpdateStatus: (
        callback: (status: {
          state: 'updating' | 'updated' | 'failed';
          version: string | null;
        }) => void,
      ) => () => void;
      finishRecording: (controllerId: string) => Promise<unknown>;
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
      downloadPreview: (requestId: string, url: string) => Promise<string>;
      cancelPreviewDownload: (requestId: string) => Promise<void>;
      releasePreviewFile: (tempPath: string) => Promise<void>;
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
      getPluginDataPath: (pluginId: string) => Promise<string>;
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
  }
}
