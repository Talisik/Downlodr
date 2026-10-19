/* eslint-disable prettier/prettier */
/** Filesystem and browser helpers (fileHandler, browserHandler). */
declare global {
  interface Window {
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
      getFreeDiskSpace: (path: string) => Promise<number | null>;
    };

    /** Open/delete video, download file, select file (fileHandler) */
    fileFunctionsBridge: {
      selectVideoFile: () => Promise<string | null>;
      downloadFile: (url: string, outputPath: string) => Promise<{ success: boolean; path?: string; error?: string }>;
      openVideo: (filePath: string) => Promise<void>;
      deleteFile: (filepath: string) => Promise<boolean>;
      deleteFolder: (folderpath: string) => Promise<boolean>;
      copyFile: (sourcePath: string, destinationPath: string) => Promise<boolean>;
      openFolder: (folderPath: string, filePath: string) => Promise<{ success: boolean; error?: string }>;
      saveBufferToFile: (data: number[], filePath: string) => Promise<{ success: boolean; error?: string }>;
      htmlToPdf: (htmlContent: string) => Promise<{ success: boolean; data?: number[]; error?: string }>;
    };

    /** External link, thumbnail, internet check (browserHandler) */
    browserFunctionsBridge: {
      openExternalLink: (link: string) => Promise<void>;
      getThumbnailDataUrl: (path: string) => Promise<string | null>;
      checkInternetConnection: () => Promise<boolean>;
      checkSiteReachable: (url: string) => Promise<
        | { reachable: true }
        | {
            reachable: false;
            reason: 'invalid' | 'not_found' | 'refused' | 'timeout' | 'other';
          }
      >;
    };
  }
}

export {};
