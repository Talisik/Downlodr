/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    downlodrFunctions: {
      //Title bar functions
      closeApp: () => void;
      minimizeApp: () => void;
      maximizeApp: () => void;

      //Downlodr functions
      openVideo: (videoPath: string) => Promise<void>; // Should return a Promise<void> since it's an async operation
      deleteFile: (videoPath: string) => Promise<boolean>; // Should return a Promise<boolean> since it's an async operation
      getDownloadFolder: () => Promise<string>; // Should return a Promise<string> since it's an async operation
      isValidPath: (videoPath: string) => Promise<boolean>; // Should return a Promise<boolean> since it's an async operation
      joinDownloadPath: (
        downloadPath: string,
        fileName: string,
      ) => Promise<string>; // New method added
      validatePath: (folderPath: string) => Promise<boolean>;
      openFolder: (
        folderPath: string,
      ) => Promise<{ success: boolean; error?: string }>;
      fileExists: (path: string) => Promise<boolean>;
    };
    ytdlp: {
      getPlaylistInfo: (options: { url: string }) => any;
      getInfo: (url: string) => Promise<any>;
      selectDownloadDirectory: () => Promise<string>;
      download: (
        options: { url: string; outputFilepath: string; videoFormat: string },
        progressCallback: (progress: any) => void,
      ) => { downloadId: string; controllerId: string | undefined };
      onDownloadStatusUpdate: (
        id: string,
        callback: (result: any) => void,
      ) => void;
      offDownloadStatusUpdate: (
        id: string,
        callback: (result: any) => void,
      ) => void;
      killController: (
        controllerId: string,
      ) => Promise<{ success: boolean; error?: string }>; // New method added
      stop: (id: string) => Promise<boolean>;
    };
    electronDevTools: {
      toggle: () => void;
    };
  }
}

export {};
