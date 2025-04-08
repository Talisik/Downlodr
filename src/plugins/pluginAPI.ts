/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/plugins/pluginAPI.ts
import { PluginAPI, DownloadAPI, UIAPI, FormatAPI, UtilityAPI } from './types';
import useDownloadStore from '../Store/downloadStore';
import { formatFileSize } from '../Pages/StatusSpecificDownload'; // Import from where the function is defined

export function createPluginAPI(pluginId: string): PluginAPI {
  return {
    downloads: createDownloadAPI(pluginId),
    ui: createUIAPI(pluginId),
    formats: createFormatAPI(pluginId),
    utilities: createUtilityAPI(pluginId),
  };
}

function createDownloadAPI(pluginId: string): DownloadAPI {
  return {
    registerDownloadSource: (source: any) => {
      // Register a new download source
    },
    getActiveDownloads: () => {
      // Map store downloads to the Download interface expected by plugins
      return useDownloadStore.getState().downloading.map((download) => ({
        id: download.id || '',
        // url: download.url || '', // Add the missing url property
        name: download.name,
        progress: download.progress,
        status: download.status as any, // Cast to the expected status type
        size: download.size,
        downloaded: download.progress * download.size,
        location: download.location,
      }));
    },
    addDownload: async (url, options) => {
      const { addDownload } = useDownloadStore.getState();

      // Add download with plugin-provided options
      addDownload(
        url,
        options.name,
        options.downloadName,
        options.size || 0,
        options.speed || '',
        options.timeLeft || '',
        new Date().toISOString(),
        0,
        options.location,
        'to download',
        options.ext || '',
        options.formatId || '',
        options.audioExt || '',
        options.audioFormatId || '',
        options.extractorKey || '',
        options.limitRate || '',
      );

      return options.name; // Return ID
    },
    cancelDownload: async (id: any) => {
      // Logic to cancel a download
      return true;
    },
    pauseDownload: async (id: any) => {
      // Logic to pause a download
      return true;
    },
  };
}

function createUIAPI(pluginId: string): UIAPI {
  // Implement UI extension functionality
  return {
    registerMenuItem: (menuItem: any) => {
      // Store menu item in a global registry
      return `${pluginId}:menu:${Date.now()}`;
    },
    unregisterMenuItem: (id: any) => {
      // Remove menu item
    },
    registerFormatProvider: (provider: any) => {
      // Register custom format provider
      return `${pluginId}:format:${Date.now()}`;
    },
    registerSettingsPage: (page: any) => {
      // Register settings page
      return `${pluginId}:settings:${Date.now()}`;
    },
    showNotification: (options: any) => {
      // Show notification
    },
  };
}

function createFormatAPI(pluginId: string): FormatAPI {
  return {
    registerFormatHandler: (handler) => {
      // Register format handler
      return `${pluginId}:handler:${Date.now()}`;
    },
    getSupportedFormats: () => {
      // Return supported formats
      return ['mp4', 'webm', 'mp3'];
    },
  };
}

function createUtilityAPI(pluginId: string): UtilityAPI {
  return {
    formatFileSize: (size) => formatFileSize(size),
    openExternalLink: async (url) => {
      await window.downlodrFunctions.openExternalLink(url);
    },
    selectDirectory: async () => {
      return await window.ytdlp.selectDownloadDirectory();
    },
  };
}
