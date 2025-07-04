/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/plugins/pluginAPI.ts
import { toast } from '../Components/SubComponents/shadcn/hooks/use-toast';
import { formatFileSize } from '../Pages/StatusSpecificDownload';
import useDownloadStore from '../Store/downloadStore';
import { useMainStore } from '../Store/mainStore';
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

const taskBarItemHandlerMap = new Map<string, string>(); // id -> handlerId

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
      const itemId = taskBarItem.id || `${pluginId}-taskbar-${Date.now()}`;

      // Store the handler locally in renderer process
      window.PluginHandlers = window.PluginHandlers || {};

      if (taskBarItem.onClick) {
        window.PluginHandlers[handlerId] = taskBarItem.onClick;
        // Store the mapping
        taskBarItemHandlerMap.set(itemId, handlerId);
      }

      // Create a serializable version without function properties
      const serializableItem = {
        ...taskBarItem,
        pluginId,
        handlerId,
        id: itemId,
        onClick: undefined as unknown as (contextData?: any) => void,
      };

      // Register the item without the onClick function
      return await window.plugins.registerTaskBarItem(serializableItem);
    },

    unregisterTaskBarItem: async (id: string) => {
      return await window.plugins.unregisterTaskBarItem(id);
    },

    getTaskBarItems: async () => {
      return await window.plugins.getTaskBarItems();
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

    setTaskBarButtonsVisibility: (visibility) => {
      const { setTaskBarButtonsVisibility } = useMainStore.getState();
      setTaskBarButtonsVisibility(visibility);
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
  const api = {
    registerDownloadSource: (source: any) => {
      // Register a new download source
    },

    getAllDownloads: () => {
      const { downloading, forDownloads } = useDownloadStore.getState();
      return { downloading, forDownloads };
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

    addDownload: async (url: string, options: any) => {
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

    cancelDownload: async (id: string) => {
      const {
        deleteDownloading,
        downloading,
        forDownloads,
        removeFromForDownloads,
      } = useDownloadStore.getState();

      try {
        // Check if given id is a pending download
        const pendingDownload = forDownloads.find((d) => d.id === id);
        if (pendingDownload && pendingDownload.status === 'to download') {
          removeFromForDownloads(id);
          return true;
        }

        // Check if given id is an active download
        const activeDownload = downloading.find((d) => d.id === id);
        if (activeDownload) {
          if (activeDownload.status === 'paused') {
            deleteDownloading(id);
            return true;
          } else if (activeDownload.controllerId) {
            const success = await window.ytdlp.killController(
              activeDownload.controllerId,
            );
            if (success) {
              deleteDownloading(id);
              return true;
            } else {
              console.error(
                `Could not stop download with controller ${activeDownload.controllerId}`,
              );
              return false;
            }
          }
        }

        // Download not found
        console.warn(`Download with id ${id} not found`);
        return false;
      } catch (error) {
        console.error(`Error canceling download ${id}:`, error);
        return false;
      }
    },

    stopAllDownloads: async () => {
      const {
        deleteDownloading,
        downloading,
        forDownloads,
        removeFromForDownloads,
      } = useDownloadStore.getState();

      try {
        // Handle all pending downloads
        forDownloads.forEach((download) => {
          if (download.status === 'to download') {
            removeFromForDownloads(download.id);
          }
        });

        // Handle all active downloads
        if (downloading && downloading.length > 0) {
          for (const download of downloading) {
            if (download.status === 'paused') {
              deleteDownloading(download.id);
            } else if (download.controllerId) {
              try {
                const success = await window.ytdlp.killController(
                  download.controllerId,
                );

                if (success) {
                  deleteDownloading(download.id);
                } else {
                  console.error(
                    `Could not stop download with controller ${download.controllerId}`,
                  );
                }
              } catch (error) {
                console.error(
                  `Error stopping download with controller ${download.controllerId}:`,
                  error,
                );
              }
            }
          }
        }

        return true;
      } catch (error) {
        console.error('Error stopping all downloads:', error);
        return false;
      }
    },

    pauseDownload: async (downloadId?: string) => {
      const { downloading, updateDownloadStatus } = useDownloadStore.getState();

      try {
        // If no downloadId is provided, find the first item with status 'downloading'
        const currentDownload =
          downloadId && downloading.some((d) => d.id === downloadId)
            ? downloading.find((d) => d.id === downloadId)
            : downloading.find(
                (d) => d.status?.trim().toLowerCase() === 'downloading',
              );

        if (!currentDownload) {
          console.warn('No download found to pause');
          toast({
            variant: 'destructive',
            title: 'No Download Found',
            description: 'No active download found to pause',
            duration: 3000,
          });
          return false;
        }

        // If the download is active and has a controllerId, pause it
        if (currentDownload && currentDownload.controllerId) {
          try {
            updateDownloadStatus(currentDownload.id, 'paused');

            const response = await window.ytdlp.killController(
              currentDownload.controllerId,
            );

            if (response) {
              setTimeout(() => {
                updateDownloadStatus(currentDownload.id, 'paused');
              }, 1200);

              return true;
            } else {
              updateDownloadStatus(currentDownload.id, 'downloading');
              return false;
            }
          } catch (error) {
            updateDownloadStatus(currentDownload.id, 'downloading');
            console.error('Error in pause operation:', error);

            return false;
          }
        }

        // Handle the case where the download doesn't have a valid controllerId
        console.warn(
          'Download found but no valid controllerId:',
          currentDownload,
        );

        return false;
      } catch (error) {
        console.error('Error in pauseDownload:', error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'An unexpected error occurred',
          duration: 3000,
        });
      }
    },

    pauseAllDownloads: async () => {
      const { downloading } = useDownloadStore.getState();

      if (downloading.length === 0) {
        return {
          success: true,
          totalDownloads: 0,
          pausedCount: 0,
          failedCount: 0,
          results: [],
        };
      }

      // Pause all downloads in parallel
      const pausePromises = downloading.map(async (download) => {
        try {
          const success = await api.pauseDownload(download.id);
          return {
            downloadId: download.id,
            downloadName: download.name,
            success: success === true,
            error: null as unknown as string,
          };
        } catch (error) {
          return {
            downloadId: download.id,
            downloadName: download.name,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      const results = await Promise.allSettled(pausePromises);

      // Process results
      const processedResults = results.map((result) =>
        result.status === 'fulfilled'
          ? result.value
          : {
              downloadId: 'unknown',
              downloadName: 'unknown',
              success: false,
              error:
                result.reason instanceof Error
                  ? result.reason.message
                  : String(result.reason),
            },
      );

      const pausedCount = processedResults.filter((r) => r.success).length;
      const failedCount = processedResults.length - pausedCount;

      return {
        success: failedCount === 0,
        totalDownloads: downloading.length,
        pausedCount,
        failedCount,
        results: processedResults,
      };
    },

    resumeDownload: async (downloadId?: string) => {
      const { downloading, deleteDownloading, addDownload } =
        useDownloadStore.getState();

      try {
        // If no downloadId is provided, find the first item with status 'paused'
        const currentDownload =
          downloadId && downloading.some((d) => d.id === downloadId)
            ? downloading.find((d) => d.id === downloadId)
            : downloading.find(
                (d) => d.status?.trim().toLowerCase() === 'paused',
              );

        if (!currentDownload) {
          console.warn('No download found to resume');
          return false;
        }

        // If the download is already paused, resume it
        if (currentDownload.status === 'paused') {
          addDownload(
            currentDownload.videoUrl,
            currentDownload.name,
            currentDownload.downloadName,
            currentDownload.size,
            currentDownload.speed,
            currentDownload.timeLeft,
            new Date().toISOString(),
            currentDownload.progress,
            currentDownload.location,
            'downloading',
            currentDownload.backupExt,
            currentDownload.backupFormatId,
            currentDownload.backupAudioExt,
            currentDownload.backupAudioFormatId,
            currentDownload.extractorKey,
            '',
            currentDownload.automaticCaption,
            currentDownload.thumbnails,
            currentDownload.getTranscript || false,
            currentDownload.getThumbnail || false,
            currentDownload.duration || 60,
            false,
          );

          deleteDownloading(currentDownload.id);
          return true;
        } else {
          console.warn('Download found but not paused:', currentDownload);
          return false;
        }
      } catch (error) {
        console.error('Error in resumeDownload:', error);
        return false;
      }
    },

    resumeAllDownloads: async () => {
      const { downloading } = useDownloadStore.getState();

      const pausedDownloads = downloading.filter(
        (d) => d.status?.trim().toLowerCase() === 'paused',
      );

      if (pausedDownloads.length === 0) {
        return {
          success: true,
          totalDownloads: 0,
          resumedCount: 0,
          failedCount: 0,
          results: [],
        };
      }

      // Resume all downloads in parallel
      const resumePromises = pausedDownloads.map(async (download) => {
        try {
          const success = await api.resumeDownload(download.id);
          return {
            downloadId: download.id,
            downloadName: download.name,
            success,
            error: null as unknown as string,
          };
        } catch (error) {
          return {
            downloadId: download.id,
            downloadName: download.name,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      const results = await Promise.allSettled(resumePromises);

      // Process results
      const processedResults = results.map((result) =>
        result.status === 'fulfilled'
          ? result.value
          : {
              downloadId: 'unknown',
              downloadName: 'unknown',
              success: false,
              error:
                result.reason instanceof Error
                  ? result.reason.message
                  : String(result.reason),
            },
      );

      const resumedCount = processedResults.filter((r) => r.success).length;
      const failedCount = processedResults.length - resumedCount;

      return {
        success: failedCount === 0,
        totalDownloads: pausedDownloads.length,
        resumedCount,
        failedCount,
        results: processedResults,
      };
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

  return api;
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
    getTaskBarItems: async () => {
      return await window.plugins.getTaskBarItems();
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
    setTaskBarButtonsVisibility: (visibility) => {
      const { setTaskBarButtonsVisibility } = useMainStore.getState();
      setTaskBarButtonsVisibility(visibility);
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
