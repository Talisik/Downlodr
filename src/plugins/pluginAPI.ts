/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/plugins/pluginAPI.ts
import { toast } from '../Components/SubComponents/shadcn/hooks/use-toast';
import { formatFileSize } from '../Pages/StatusSpecificDownload';
import useDownloadStore from '../Store/downloadStore';
import { usePluginStore } from '../Store/pluginStore';
import {
  DownloadAPI,
  FormatAPI,
  FormatProvider,
  FormatSelectorOptions,
  FormatSelectorResult,
  MenuItem,
  NotificationOptions,
  PluginAPI,
  PluginModalOptions,
  PluginModalResult,
  PluginSidePanelOptions,
  PluginSidePanelResult,
  SaveDialogOptions,
  SaveDialogResult,
  SaveFileDialogOptions,
  SettingsPage,
  TaskBarItem,
  UIAPI,
  UtilityAPI,
  WriteFileOptions,
  WriteFileResult,
} from './types';

export function createPluginAPI(pluginId: string): PluginAPI {
  // Create UI API
  const uiAPI: UIAPI = {
    registerMenuItem: (menuItem: MenuItem) => {
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
      return window.plugins.unregisterMenuItem(id);
    },

    registerFormatProvider: (provider: FormatProvider) => {
      return `${pluginId}:format:${Date.now()}`;
    },

    registerSettingsPage: (page: SettingsPage) => {
      return `${pluginId}:settings:${Date.now()}`;
    },

    showNotification: (options: NotificationOptions) => {
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
        duration: options.duration || 3000,
        variant: variant,
      });
    },

    showFormatSelector: async (
      options: FormatSelectorOptions,
    ): Promise<FormatSelectorResult | null> => {
      if (!window.formatSelectorManager) {
        console.error('Format selector manager not available');
        return null;
      }

      try {
        // Call the format selector manager to show the UI
        return await window.formatSelectorManager.showFormatSelector(options);
      } catch (error) {
        console.error('Error showing format selector:', error);
        return null;
      }
    },

    registerTaskBarItem: async (taskBarItem: TaskBarItem) => {
      // Create a unique handler ID
      const handlerId = `${pluginId}:taskbar:${Date.now()}`;

      // Store the handler locally in renderer process
      window.PluginHandlers = window.PluginHandlers || {};

      if (taskBarItem.onClick) {
        window.PluginHandlers[handlerId] = taskBarItem.onClick;
      }

      // Create a serializable version without function properties
      const serializableItem = {
        ...taskBarItem,
        pluginId,
        handlerId,
        id: taskBarItem.id || `${pluginId}-taskbar-${Date.now()}`,
        onClick: undefined as unknown as (contextData?: any) => void,
      };

      // Register the item without the onClick function
      return await window.plugins.registerTaskBarItem(serializableItem);
    },

    unregisterTaskBarItem: async (id: string) => {
      return await window.plugins.unregisterTaskBarItem(id);
    },

    showPluginSidePanel: async (
      options: PluginSidePanelOptions,
    ): Promise<PluginSidePanelResult | null> => {
      if (!window.pluginSidePanelManager) {
        console.error('Plugin side panel manager not available');
        return null;
      }

      try {
        // Call the plugin side panel manager to show the UI
        return await window.pluginSidePanelManager.showPluginSidePanel(options);
      } catch (error) {
        console.error('Error showing plugin side panel:', error);
        return null;
      }
    },

    showPluginModal: async (
      options: PluginModalOptions,
    ): Promise<PluginModalResult | null> => {
      if (!window.pluginModalManager) {
        console.error('Plugin modal manager not available');
        return null;
      }

      try {
        // Call the plugin modal manager to show the UI
        return await window.pluginModalManager.showPluginModal(options);
      } catch (error) {
        console.error('Error showing plugin modal:', error);
        return null;
      }
    },

    showSaveFileDialog: async (
      options: SaveDialogOptions,
    ): Promise<SaveDialogResult> => {
      try {
        // Use the IPC method to show the dialog from the main process
        return await window.plugins.saveFileDialog({
          ...options,
          pluginId,
        });
      } catch (error) {
        console.error('Error showing save file dialog:', error);
        return { canceled: true, success: false };
      }
    },

    closePluginPanel: () => {
      if (window.pluginSidePanelManager) {
        // If there's an active request, close it
        const updateIsOpenPluginSidebar =
          usePluginStore.getState().updateIsOpenPluginSidebar;
        updateIsOpenPluginSidebar(false);
      }
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
        options.duration || 60,
        false,
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
    showFormatSelector: async (
      options: FormatSelectorOptions,
    ): Promise<FormatSelectorResult | null> => {
      if (!window.formatSelectorManager) {
        console.error('Format selector manager not available');
        return null;
      }

      try {
        return await window.formatSelectorManager.showFormatSelector(options);
      } catch (error) {
        console.error('Error showing format selector:', error);
        return null;
      }
    },
    registerTaskBarItem: (taskBarItem: TaskBarItem) => {
      // Store taskbar item in a global registry
      return Promise.resolve(`${pluginId}:taskbar:${Date.now()}`);
    },
    unregisterTaskBarItem: (id: string) => {
      // Remove taskbar item
      return Promise.resolve(true);
    },
    showPluginSidePanel: async (
      options: PluginSidePanelOptions,
    ): Promise<PluginSidePanelResult | null> => {
      if (!window.pluginSidePanelManager) {
        console.error('Plugin side panel manager not available');
        return null;
      }

      try {
        // Call the plugin side panel manager to show the UI
        return await window.pluginSidePanelManager.showPluginSidePanel(options);
      } catch (error) {
        console.error('Error showing plugin side panel:', error);
        return null;
      }
    },
    showPluginModal: async (
      options: PluginModalOptions,
    ): Promise<PluginModalResult | null> => {
      if (!window.pluginModalManager) {
        console.error('Plugin modal manager not available');
        return null;
      }

      try {
        // Call the plugin modal manager to show the UI
        return await window.pluginModalManager.showPluginModal(options);
      } catch (error) {
        console.error('Error showing plugin modal:', error);
        return null;
      }
    },
    showSaveFileDialog: async (
      options: SaveDialogOptions,
    ): Promise<SaveDialogResult> => {
      try {
        // Use the IPC method to show the dialog from the main process
        return await window.plugins.saveFileDialog({
          ...options,
          pluginId,
        });
      } catch (error) {
        console.error('Error showing save file dialog:', error);
        return { canceled: true, success: false };
      }
    },
    closePluginPanel: () => {
      if (window.pluginSidePanelManager) {
        // If there's an active request, close it
        const updateIsOpenPluginSidebar =
          usePluginStore.getState().updateIsOpenPluginSidebar;
        updateIsOpenPluginSidebar(false);
      }
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

    // Add file reading API
    readFileContents: async (
      filePath: string,
    ): Promise<{ success: boolean; data?: string; error?: string }> => {
      try {
        const result = await window.plugins.readFileContents({
          filePath,
          // pluginId,
        });

        return {
          success: true,
          data: result.data,
        };
      } catch (error) {
        console.error('Error reading file contents:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    writeFile: async (options: WriteFileOptions): Promise<WriteFileResult> => {
      try {
        return await window.plugins.writeFile({
          ...options,
          pluginId,
        });
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },

    saveFileWithDialog: async (
      options: SaveFileDialogOptions,
    ): Promise<WriteFileResult> => {
      try {
        return await window.plugins.saveFileDialog({
          ...options,
          pluginId,
        });
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}
