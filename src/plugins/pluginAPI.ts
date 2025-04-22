/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/plugins/pluginAPI.ts
import {
  PluginAPI,
  DownloadAPI,
  UIAPI,
  FormatAPI,
  UtilityAPI,
  MenuItem,
  FormatProvider,
  SettingsPage,
  NotificationOptions,
} from './types';
import useDownloadStore from '../Store/downloadStore';
import { formatFileSize } from '../Pages/StatusSpecificDownload';
import { pluginRegistry } from './registry';
import { toast } from '../Components/SubComponents/shadcn/hooks/use-toast';

export function createPluginAPI(pluginId: string): PluginAPI {
  // Create UI API
  const uiAPI: UIAPI = {
    registerMenuItem: (menuItem: MenuItem) => {
      console.log(
        `Plugin ${pluginId} registering menu item via IPC:`,
        menuItem,
      );

      // Create a serializable version (without the onClick function)
      const serializableMenuItem = {
        ...menuItem,
        pluginId,
        onClick: undefined as unknown as (contextData?: any) => void,
      };

      // Store the handler locally in renderer process
      const handlerId = `${pluginId}:menu:${Date.now()}`;
      window.PluginHandlers = window.PluginHandlers || {};
      window.PluginHandlers[handlerId] = menuItem.onClick;

      // Send serializable version to main process
      return window.plugins.registerMenuItem({
        ...serializableMenuItem,
        handlerId,
        id: menuItem.id || `${pluginId}-menu-${Date.now()}`,
      });
    },

    unregisterMenuItem: (id: string) => {
      console.log(`Plugin ${pluginId} unregistering menu item via IPC:`, id);
      return window.plugins.unregisterMenuItem(id);
    },

    registerFormatProvider: (provider: FormatProvider) => {
      console.log(`Plugin ${pluginId} registering format provider:`, provider);
      return `${pluginId}:format:${Date.now()}`;
    },

    registerSettingsPage: (page: SettingsPage) => {
      console.log(`Plugin ${pluginId} registering settings page:`, page);
      return `${pluginId}:settings:${Date.now()}`;
    },

    showNotification: (options: NotificationOptions) => {
      console.log(`Plugin ${pluginId} showing notification:`, options);

      // Map NotificationOptions.type to toast variant
      let variant: 'default' | 'destructive' | 'success' = 'default';
      switch (options.type) {
        case 'success':
          variant = 'success';
          break;
        case 'error':
          variant = 'destructive';
          break;
        case 'warning':
          variant = 'destructive';
          break;
        case 'info':
        default:
          variant = 'default';
      }

      toast({
        title: options.title,
        description: options.message,
        duration: options.duration,
        variant: variant,
      });
    },
  };

  return {
    downloads: createDownloadAPI(pluginId),
    ui: uiAPI,
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
        options.automaticCaption || '',
        options.thumbnails,
        options.getTranscript || false,
        options.getThumbnail || false,
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
    getInfo: async (url: string) => {
      console.log(`Plugin ${pluginId} requesting info for URL: ${url}`);

      try {
        // Use the IPC handler instead of window.ytdlp
        const info = await window.downlodrFunctions.invokeMainProcess(
          'ytdlp:info',
          url,
        );

        if (!info || info.error) {
          throw new Error(info?.error || 'Failed to get video info');
        }

        // Map the data to match DownloadInfo interface
        return info;
      } catch (error) {
        console.error(`Error getting info for ${url}:`, error);
        throw new Error(`Failed to get video info: ${error.message}`);
      }
    },
  };
}

function createUIAPI(pluginId: string): UIAPI {
  return {
    registerMenuItem: (menuItem: MenuItem) => {
      // Store menu item in a global registry
      return Promise.resolve(`${pluginId}:menu:${Date.now()}`);
    },
    unregisterMenuItem: (id: string) => {
      // Remove menu item
      return Promise.resolve(true);
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
