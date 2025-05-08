/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Type definitions for global variables and functions used in the application.
 * This file extends the Window interface to include custom functions and properties
 * that are accessible in the renderer process.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    downlodrFunctions: {
      //Title bar functions
      closeApp: () => void;
      minimizeApp: () => void;
      maximizeApp: () => void;
      openExternalLink: (link: string) => Promise<void>;

      //Downlodr functions
      openVideo: (videoPath: string) => Promise<void>; // Opens a video file
      deleteFile: (videoPath: string) => Promise<boolean>; // Deletes a specified file from storage/drive
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
    };
    ytdlp: {
      getPlaylistInfo: (options: { url: string }) => any; // Retrieves information about a playlist
      getInfo: (url: string) => Promise<any>; // Retrieves information about a video
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
    };
    electronDevTools: {
      toggle: () => void; // Toggles the visibility of the developer tools
    };
    updateAPI: {
      onUpdateAvailable: (
        callback: (updateInfo: UpdateInfo) => void,
      ) => () => void;
      checkForUpdates: () => Promise<UpdateInfo>;
    };
    backgroundSettings: {
      getRunInBackground: () => Promise<boolean>;
      setRunInBackground: (value: boolean) => Promise<boolean>;
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
      ) => Promise<{ code: string; manifest: any; error?: string }>;
      install: (pluginPath: string) => Promise<boolean | string>;
      uninstall: (pluginId: string) => Promise<boolean>;
      getMenuItems: (context: any) => Promise<MenuItem[]>;
      executeMenuItem: (id: string, contextData?: any) => Promise<void>;
      loadUnzipped: (pluginDirPath: string) => Promise<boolean>;
      writeFile: (options: WriteFileOptions) => Promise<WriteFileResult>;
      readFile: (
        filePath: string,
      ) => Promise<{ success: boolean; data?: string; error?: string }>;
      readFileContents: (options: {
        filePath: string;
        pluginId?: string;
      }) => Promise<{ success: boolean; data?: string; error?: string }>;

      // Add these new methods
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
  }
}

interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
}

interface MenuItem {
  id: string;
  label: string;
  context?: string;
  pluginId?: string;
  onClick: (contextData?: any) => void;
  handlerId?: string;
}

interface TaskBarItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  tooltip?: string;
  pluginId?: string;
  onClick?: (contextData?: any) => void;
  handlerId?: string;
}

interface WriteFileOptions {
  fileName: string;
  content: string;
  fileType?: string;
  directory?: string;
  overwrite?: boolean;
  customPath?: string;
  pluginId: string;
}

interface WriteFileResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

interface SaveDialogOptions {
  defaultPath?: string;
  content: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  title?: string;
  pluginId: string;
}

interface SaveDialogResult {
  success: boolean;
  filePath?: string;
  canceled?: boolean;
  error?: string;
}

export {};
