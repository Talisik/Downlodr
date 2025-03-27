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
      showInputContextMenu: () => void; // Shows the input field context menu (right-click menu)
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
      onUpdateAvailable: (callback: (updateInfo: UpdateInfo) => void) => void;
      checkForUpdates: () => Promise<UpdateInfo>; // Changed return type from void to UpdateInfo
    };
  }
}

export {};
