/**
 *
 * Zustand store for managing downloads in the application.
 * It provides functionalities to track the state of downloads, including those
 * that are currently downloading, finished, or in history. The store also allows
 * for managing tags and categories associated with downloads.
 *
 * Dependencies:
 * - Zustand: A small, fast state-management solution.
 * - Zustand middleware for persistence.
 * - VideoFormatService: A service for processing video formats.
 * - Toast: A notification system for user feedback.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { VideoFormatService } from '../DataFunctions/GetDownloadMetaData';
import { toast } from '../Components/SubComponents/shadcn/hooks/use-toast';

// give unique id to downloads
function uuidv4() {
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
    (
      +c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))
    ).toString(16),
  );
}

// Base interface for all download types
export interface BaseDownload {
  id: string; // Unique identifier for the download
  videoUrl: string; // URL of the video to be downloaded
  name: string; // Name of the video
  downloadName: string; // Name used for the download file
  size: number; // Size of the download in bytes
  speed: string; // Current download speed
  timeLeft: string; // Estimated time left for the download
  DateAdded: string; // Date when the download was added
  progress: number; // Current progress of the download (0-100)
  location: string; // File path where the download will be saved
  status: string; // Current status of the download
  ext: string; // File extension of the download
  controllerId?: string; // ID of the download controller
  tags: string[]; // Tags associated with the download
  category: string[]; // Categories associated with the download
  extractorKey: string; // Key for the extractor used
  formatId: string; // ID of the selected format
  audioExt: string; // Audio file extension
  audioFormatId: string; // ID of the audio format
  isLive: boolean; // Indicates if the download is a live stream
}

// Interface for downloads that are currently being processed
interface ForDownload extends BaseDownload {
  status: string; // Current status of the download
  downloadStart: boolean; // Indicates if the download has started
  formatId: string; // ID of the selected format
  audioExt: string; // Audio file extension
  audioFormatId: string; // ID of the audio format
}

// Interface for downloads that are currently downloading
interface Downloading extends BaseDownload {
  status:
    | 'downloading'
    | 'finished'
    | 'failed'
    | 'cancelled'
    | 'initializing'
    | 'getting metadata'
    | 'paused';
  formatId: string; // ID of the selected format
  backupExt?: string; // Backup file extension
  backupFormatId?: string; // Backup format ID
  backupAudioExt?: string; // Backup audio file extension
  backupAudioFormatId?: string; // Backup audio format ID
}

// Interface for finished downloads
interface FinishedDownloads extends BaseDownload {
  status: string; // Status of the finished download
}

// Interface for historical downloads
interface HistoryDownloads extends BaseDownload {
  status: string; // Status of the historical download
}

// Main interface for the download store
interface DownloadStore {
  downloading: Downloading[]; // List of currently downloading items
  finishedDownloads: FinishedDownloads[]; // List of finished downloads
  historyDownloads: HistoryDownloads[]; // List of download history logs
  forDownloads: ForDownload[]; // List of downloads that are queued
  availableTags: string[]; // List of available tags
  availableCategories: string[]; // List of available categories

  // Methods for managing downloads
  checkFinishedDownloads: () => void; // Check and update finished downloads
  updateDownload: (id: string, result: any) => void; // Update a specific download's status
  addDownload: (
    videoUrl: string,
    name: string,
    downloadName: string,
    size: number,
    speed: string,
    timeLeft: string,
    DateAdded: string,
    progress: number,
    location: string,
    status: string,
    ext: string,
    formatId: string,
    audioExt: string,
    audioFormatId: string,
    extractorKey: string,
    limitRate: string,
  ) => void; // Add a new download
  setDownload: (
    videoUrl: string,
    location: string,
    maxDownload: string,
  ) => void; // Set a download with metadata
  deleteDownload: (id: string) => void; // Delete a specific download
  deleteDownloading: (id: string) => void; // Delete a downloading item
  removeFromForDownloads: (id: string) => void; // Remove a download from the queue
  addTag: (downloadId: string, tag: string) => void; // Add a tag to a download
  removeTag: (downloadId: string, tag: string) => void; // Remove a tag from a download
  addCategory: (downloadId: string, category: string) => void; // Add a category to a download
  removeCategory: (downloadId: string, category: string) => void; // Remove a category from a download
  renameCategory: (oldName: string, newName: string) => void; // Rename a category
  deleteCategory: (category: string) => void; // Delete a category
  renameTag: (oldName: string, newName: string) => void; // Rename a tag
  deleteTag: (tag: string) => void; // Delete a tag
  updateDownloadStatus: (
    id: string,
    status:
      | 'downloading'
      | 'finished'
      | 'failed'
      | 'cancelled'
      | 'initializing'
      | 'getting metadata'
      | 'paused',
  ) => void; // Update the status of a download
  renameDownload: (downloadId: string, newName: string) => void; // Rename a download
}

const useDownloadStore = create<DownloadStore>()(
  persist(
    (set, get) => ({
      forDownloads: [] as ForDownload[],
      downloading: [] as Downloading[],
      finishedDownloads: [] as FinishedDownloads[],
      historyDownloads: [] as HistoryDownloads[],
      availableTags: [] as string[],
      availableCategories: [] as string[],

      checkFinishedDownloads: async () => {
        const currentDownloads = get().downloading;
        const finishedDownloads = currentDownloads.filter(
          (downloading) => downloading.status === 'finished',
        );

        if (finishedDownloads.length > 0) {
          for (const download of finishedDownloads) {
            const filePath = `${download.location}${download.name}`;
            const exists = await window.downlodrFunctions.fileExists(filePath);
            console.log(`Checking file: ${filePath}, exists: ${exists}`);

            if (!exists) {
              console.log(
                `File doesn't exist yet, setting status to initializing for ${download.id}`,
              );
              set((state) => ({
                downloading: state.downloading.map((d) =>
                  d.id === download.id ? { ...d, status: 'initializing' } : d,
                ),
              }));

              // check for this specific download
              const checkInterval = setInterval(async () => {
                const fileExists = await window.downlodrFunctions.fileExists(
                  filePath,
                );
                if (fileExists) {
                  clearInterval(checkInterval);
                  console.log(
                    `File now exists, moving download ${download.id} to finished/history`,
                  );
                  set((state) => ({
                    finishedDownloads: state.finishedDownloads.some(
                      (fd) => fd.id === download.id,
                    )
                      ? state.finishedDownloads
                      : [...state.finishedDownloads, download],

                    historyDownloads: state.historyDownloads.some(
                      (hd) => hd.id === download.id,
                    )
                      ? state.historyDownloads
                      : [...state.historyDownloads, download],

                    downloading: state.downloading.filter(
                      (d) => d.id !== download.id,
                    ),
                  }));
                }
              }, 1000); // Check every second

              // Clear interval after 5 minutes to prevent infinite checking
              setTimeout(() => {
                clearInterval(checkInterval);
              }, 300000); // 5 minutes
            } else {
              console.log(
                `File exists, moving download ${download.id} to finished/history`,
              );
              set((state) => ({
                finishedDownloads: state.finishedDownloads.some(
                  (fd) => fd.id === download.id,
                )
                  ? state.finishedDownloads
                  : [...state.finishedDownloads, download],

                historyDownloads: state.historyDownloads.some(
                  (hd) => hd.id === download.id,
                )
                  ? state.historyDownloads
                  : [...state.historyDownloads, download],

                downloading: state.downloading.filter(
                  (d) => d.id !== download.id,
                ),
              }));
            }
          }
        }
      },

      removeFromForDownloads: (id: string) => {
        set((state) => ({
          forDownloads: state.forDownloads.filter(
            (download) => download.id !== id,
          ),
        }));
      },

      updateDownload: (id, result) => {
        if (!result || !result.data) return;

        set((state) => ({
          downloading: state.downloading.map((downloading) =>
            downloading.id === id
              ? {
                  ...downloading,
                  speed: result.data._speed_str || '',
                  progress: parseFloat(result.data._percent_str) || 0,
                  timeLeft: result.data._eta_str || '',
                  size: parseFloat(result.data.total_bytes) || downloading.size,
                  status: result.data.status || downloading.status,

                  controllerId: result.controllerId ?? downloading.controllerId,
                }
              : downloading,
          ),
        }));
        get().checkFinishedDownloads();
      },

      addDownload: async (
        videoUrl,
        name,
        downloadName,
        size,
        speed,
        timeLeft,
        DateAdded,
        progress,
        location,
        status,
        ext,
        formatId,
        audioExt,
        audioFormatId,
        extractorKey,
        limitRate,
      ) => {
        if (!location || !downloadName) {
          console.error('Invalid path parameters:', { location, downloadName });
          return;
        }
        const args = {
          url: videoUrl,
          outputFilepath: await window.downlodrFunctions.joinDownloadPath(
            location,
            downloadName,
          ),
          videoFormat: formatId,
          remuxVideo: ext,
          audioExt: audioExt,
          audioFormatId: audioFormatId,
          limitRate: limitRate,
        };

        const downloadId = (window as any).ytdlp.download(
          args,
          (result: any) => {
            if (result.type === 'controller' && result.controllerId) {
              set((state) => ({
                downloading: state.downloading.map((download) =>
                  download.id === downloadId
                    ? { ...download, controllerId: result.controllerId }
                    : download,
                ),
              }));
            }
            if (result.data) {
              set((state) => ({
                downloading: state.downloading.map((download) =>
                  download.id === downloadId
                    ? {
                        ...download,
                        speed: result.data._speed_str || '',
                        progress: parseFloat(result.data._percent_str) || 0,
                        timeLeft: result.data._eta_str || '',
                        size:
                          parseFloat(result.data.downloaded_bytes) ||
                          download.size,
                        status: result.data.status || download.status,
                      }
                    : download,
                ),
              }));
            }
            get().checkFinishedDownloads();
          },
        );

        set((state) => ({
          downloading: [
            ...state.downloading,
            {
              id: downloadId,
              videoUrl,
              name,
              downloadName,
              size,
              speed,
              timeLeft,
              DateAdded,
              progress,
              location,
              status: 'downloading',
              ext,
              formatId,
              backupExt: ext,
              backupFormatId: formatId,
              backupAudioExt: audioExt,
              backupAudioFormatId: audioFormatId,
              controllerId: '---',
              tags: [],
              category: [],
              extractorKey,
              audioExt: '',
              audioFormatId: '',
              isLive: false,
            },
          ],
        }));
      },

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      setDownload: async (videoUrl, location, limitRate) => {
        if (!location) {
          console.error('Invalid path parameters:', { location });
          return;
        }

        const downloadId = uuidv4();

        // Add initial entry with minimal info
        set((state) => ({
          ...state,
          forDownloads: [
            ...state.forDownloads,
            {
              // BaseDownload properties
              id: downloadId,
              videoUrl,
              name: 'Fetching metadata...',
              downloadName: '',
              size: 0,
              speed: '',
              timeLeft: '',
              DateAdded: new Date().toISOString(),
              progress: 0,
              location,
              status: 'getting metadata',
              ext: '',
              controllerId: undefined,
              tags: [],
              category: [],
              extractorKey: '',
              isLive: false,
              // ForDownload specific properties
              downloadStart: false,
              formatId: '',
              audioExt: '',
              audioFormatId: '',
            },
          ],
        }));

        try {
          // Fetch metadata in background
          const info = await window.ytdlp.getInfo(videoUrl);
          console.log('download metadata', info);
          // Process formats using the service
          const { formatOptions, defaultFormatId, defaultExt } =
            await VideoFormatService.processVideoFormats(info);

          // Get default audio format if available
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const defaultAudioFormat = formatOptions.find((f) =>
            f.label.includes('Audio Only'),
          );

          // Update the forDownloads entry with metadata
          set((state) => ({
            ...state,
            forDownloads: state.forDownloads.map((download) =>
              download.id === downloadId
                ? {
                    ...download,
                    name: `${info.data.title}`,
                    downloadName: `${info.data.title}`,
                    status: 'to download',
                    ext: defaultExt,
                    formatId: defaultFormatId,
                    extractorKey: info.data.extractor_key,
                    audioExt: '',
                    audioFormatId: '',
                    downloadStart: false,
                    formats: formatOptions,
                    isLive: info.data.is_live,
                  }
                : download,
            ),
          }));
          const currentDownload = get().forDownloads.find(
            (d) => d.id === downloadId,
          );
          if (currentDownload?.isLive) {
            toast({
              variant: 'destructive',
              title: 'Live Video Links Not Allowed',
              description:
                'Live video links are not supported. Please enter a valid URL.',
            });

            const { removeFromForDownloads } = get(); // Get the current state methods
            removeFromForDownloads(downloadId); // Call the method            return;
          }
        } catch (error) {
          console.error('Error fetching metadata:', error);
          toast({
            variant: 'destructive',
            title: `Could not find video metadata`,
            description: 'Please enter a valid video URL',
          });

          // Access the method correctly
          const { removeFromForDownloads } = get(); // Get the current state methods
          removeFromForDownloads(downloadId); // Call the method

          // Update status to error
          set((state) => ({
            ...state,
            forDownloads: state.forDownloads.map((download) =>
              download.id === downloadId
                ? {
                    ...download,
                    status: 'metadata_error',
                    error: 'Failed to fetch video information',
                  }
                : download,
            ),
          }));
        }

        return downloadId;
      },

      deleteDownload: (id: string) => {
        set((state) => ({
          downloading: state.downloading.filter((d) => d.id !== id),
          finishedDownloads: state.finishedDownloads.filter((d) => d.id !== id),
          historyDownloads: state.historyDownloads.filter((d) => d.id !== id),
          forDownloads: state.forDownloads.filter((d) => d.id !== id),
        }));
      },

      setDownloadingToCancelled: () => {
        set((state) => ({
          downloading: state.downloading.map((downloading) => ({
            ...downloading,
            status: 'cancelled',
          })),
        }));
      },

      deleteDownloading: (id: string) => {
        set((state) => ({
          downloading: state.downloading.filter(
            (downloading) => downloading.id !== id,
          ),
        }));
      },

      addTag: (downloadId: string, tag: string) => {
        set((state) => {
          const updateDownloadTags = <T extends BaseDownload>(
            downloads: T[],
          ): T[] => {
            return downloads.map((download) =>
              download.id === downloadId
                ? { ...download, tags: [...(download.tags || []), tag] }
                : download,
            );
          };

          return {
            ...state,
            availableTags: state.availableTags.includes(tag)
              ? state.availableTags
              : [...state.availableTags, tag],
            downloading: updateDownloadTags(state.downloading),
            finishedDownloads: updateDownloadTags(state.finishedDownloads),
            historyDownloads: updateDownloadTags(state.historyDownloads),
            forDownloads: updateDownloadTags(state.forDownloads),
          };
        });
      },

      removeTag: (downloadId: string, tag: string) => {
        set((state) => {
          const updateDownloadTags = <T extends BaseDownload>(
            downloads: T[],
          ): T[] => {
            return downloads.map((download) =>
              download.id === downloadId
                ? { ...download, tags: download.tags.filter((t) => t !== tag) }
                : download,
            );
          };

          return {
            ...state,
            downloading: updateDownloadTags(state.downloading),
            finishedDownloads: updateDownloadTags(state.finishedDownloads),
            historyDownloads: updateDownloadTags(state.historyDownloads),
            forDownloads: updateDownloadTags(state.forDownloads),
          };
        });
      },

      addCategory: (downloadId: string, category: string) => {
        set((state) => {
          const updateDownloadCategories = <T extends BaseDownload>(
            downloads: T[],
          ): T[] => {
            return downloads.map((download) =>
              download.id === downloadId
                ? {
                    ...download,
                    category: [...(download.category || []), category],
                  }
                : download,
            );
          };

          return {
            ...state,
            availableCategories: state.availableCategories.includes(category)
              ? state.availableCategories
              : [...state.availableCategories, category],
            downloading: updateDownloadCategories(state.downloading),
            finishedDownloads: updateDownloadCategories(
              state.finishedDownloads,
            ),
            historyDownloads: updateDownloadCategories(state.historyDownloads),
            forDownloads: updateDownloadCategories(state.forDownloads),
          };
        });
      },

      removeCategory: (downloadId: string, category: string) => {
        set((state) => {
          const updateDownloadCategories = <T extends BaseDownload>(
            downloads: T[],
          ): T[] => {
            return downloads.map((download) =>
              download.id === downloadId
                ? {
                    ...download,
                    category: (download.category || []).filter(
                      (c) => c !== category,
                    ),
                  }
                : download,
            );
          };

          return {
            ...state,
            downloading: updateDownloadCategories(state.downloading),
            finishedDownloads: updateDownloadCategories(
              state.finishedDownloads,
            ),
            historyDownloads: updateDownloadCategories(state.historyDownloads),
            forDownloads: updateDownloadCategories(state.forDownloads),
          };
        });
      },

      renameCategory: (oldName: string, newName: string) =>
        set((state) => {
          const updateDownloads = <T extends BaseDownload>(
            downloads: T[],
          ): T[] =>
            downloads.map((download) => ({
              ...download,
              category: download.category?.map((cat) =>
                cat === oldName ? newName : cat,
              ),
            }));

          return {
            ...state,
            availableCategories: state.availableCategories.map((cat) =>
              cat === oldName ? newName : cat,
            ),
            downloading: updateDownloads(state.downloading),
            finishedDownloads: updateDownloads(state.finishedDownloads),
            historyDownloads: updateDownloads(state.historyDownloads),
            forDownloads: updateDownloads(state.forDownloads),
          };
        }),

      deleteCategory: (category: string) =>
        set((state) => {
          const updateDownloads = <T extends BaseDownload>(
            downloads: T[],
          ): T[] =>
            downloads.map((download) => ({
              ...download,
              category: download.category?.filter((cat) => cat !== category),
            }));

          return {
            ...state,
            availableCategories: state.availableCategories.filter(
              (cat) => cat !== category,
            ),
            downloading: updateDownloads(state.downloading),
            finishedDownloads: updateDownloads(state.finishedDownloads),
            historyDownloads: updateDownloads(state.historyDownloads),
            forDownloads: updateDownloads(state.forDownloads),
          };
        }),

      renameTag: (oldName: string, newName: string) =>
        set((state) => {
          const updateDownloads = <T extends BaseDownload>(
            downloads: T[],
          ): T[] =>
            downloads.map((download) => ({
              ...download,
              tags: download.tags?.map((tag) =>
                tag === oldName ? newName : tag,
              ),
            }));

          return {
            ...state,
            availableTags: state.availableTags.map((tag) =>
              tag === oldName ? newName : tag,
            ),
            downloading: updateDownloads(state.downloading),
            finishedDownloads: updateDownloads(state.finishedDownloads),
            historyDownloads: updateDownloads(state.historyDownloads),
            forDownloads: updateDownloads(state.forDownloads),
          };
        }),

      deleteTag: (tag: string) =>
        set((state) => {
          const updateDownloads = <T extends BaseDownload>(
            downloads: T[],
          ): T[] =>
            downloads.map((download) => ({
              ...download,
              tags: download.tags?.filter((t) => t !== tag),
            }));

          return {
            ...state,
            availableTags: state.availableTags.filter((t) => t !== tag),
            downloading: updateDownloads(state.downloading),
            finishedDownloads: updateDownloads(state.finishedDownloads),
            historyDownloads: updateDownloads(state.historyDownloads),
            forDownloads: updateDownloads(state.forDownloads),
          };
        }),

      updateDownloadStatus: (
        id: string,
        status:
          | 'downloading'
          | 'finished'
          | 'failed'
          | 'cancelled'
          | 'initializing'
          | 'getting metadata'
          | 'paused',
      ) => {
        console.log('Updating status for id:', id, 'to:', status);
        console.log('Current downloads:', get().downloading);

        set((state) => {
          const newState = {
            ...state,
            downloading: state.downloading.map((download) => {
              if (download.id === id) {
                console.log('Found matching download, updating status');
                return { ...download, status };
              }
              return download;
            }),
          };
          console.log('New state downloads:', newState.downloading);
          return newState;
        });
      },

      renameDownload: (downloadId: string, newName: string) => {
        set((state) => {
          // Update name in all relevant arrays
          const updateDownloadsArray = (downloads: ForDownload[]) =>
            downloads.map((download) =>
              download.id === downloadId
                ? { ...download, name: newName }
                : download,
            );

          return {
            forDownloads: updateDownloadsArray(state.forDownloads),
          };
        });
      },
      //End of store
    }),
    {
      name: 'downlodr-storage', // Name of the storage
      storage: createJSONStorage(() => localStorage), // Use local storage for persistence
      partialize: (state) => ({
        historyDownloads: state.historyDownloads,
        availableTags: state.availableTags,
        availableCategories: state.availableCategories,
      }),
    },
  ),
);

export default useDownloadStore;
