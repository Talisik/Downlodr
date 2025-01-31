/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { VideoFormatService } from '../DataFunctions/GetDownloadMetaData';

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
  id: string;
  videoUrl: string;
  name: string;
  downloadName: string;
  size: number;
  speed: string;
  timeLeft: string;
  DateAdded: string;
  progress: number;
  location: string;
  status: string;
  ext: string;
  controllerId?: string;
  tags: string[];
  category: string[];
  extractorKey: string;
}

interface ForDownload extends BaseDownload {
  status: string;
  downloadStart: boolean;
  formatId: string;
  audioExt: string;
  audioFormatId: string;
}

interface Downloading extends BaseDownload {
  status:
    | 'downloading'
    | 'finished'
    | 'failed'
    | 'cancelled'
    | 'initializing'
    | 'getting metadata'
    | 'paused';
  formatId: string;
  backupExt?: string;
  backupFormatId?: string;
  backupAudioExt?: string;
  backupAudioFormatId?: string;
}

interface FinishedDownloads extends BaseDownload {
  status: string;
}

interface HistoryDownloads extends BaseDownload {
  status: string;
}

interface DownloadStore {
  downloading: Downloading[];
  finishedDownloads: FinishedDownloads[];
  historyDownloads: HistoryDownloads[];
  forDownloads: ForDownload[];
  availableTags: string[];
  availableCategories: string[];

  checkFinishedDownloads: () => void;
  updateDownload: (id: string, result: any) => void;

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
  ) => void;

  setDownload: (
    videoUrl: string,
    location: string,
    maxDownload: string,
  ) => void;

  deleteDownload: (id: string) => void;
  deleteDownloading: (id: string) => void;

  addTag: (downloadId: string, tag: string) => void;
  removeTag: (downloadId: string, tag: string) => void;

  addCategory: (downloadId: string, category: string) => void;
  removeCategory: (downloadId: string, category: string) => void;

  renameCategory: (oldName: string, newName: string) => void;
  deleteCategory: (category: string) => void;

  renameTag: (oldName: string, newName: string) => void;
  deleteTag: (tag: string) => void;

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
  ) => void;

  fetchMetadataInBackground: (
    downloadId: string,
    videoUrl: string,
    downloadFolder: string,
  ) => void;
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
        console.log(`In download store: speed ${limitRate}`);

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
            },
          ],
        }));
      },

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

          // Process formats using the service
          const { formatOptions, defaultFormatId, defaultExt } =
            await VideoFormatService.processVideoFormats(info);

          // Get default audio format if available
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
                    name: info.data.title,
                    downloadName: info.data.title,
                    status: 'to download',
                    ext: defaultExt,
                    formatId: defaultFormatId,
                    extractorKey: info.data.extractor_key,
                    audioExt: defaultAudioFormat?.fileExtension || '',
                    audioFormatId: defaultAudioFormat?.formatId || '',
                    downloadStart: false,
                    formats: formatOptions, // Store available formats for later use
                  }
                : download,
            ),
          }));
        } catch (error) {
          console.error('Error fetching metadata:', error);
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

      fetchMetadataInBackground: async (
        downloadId: string,
        videoUrl: string,
        downloadFolder: string,
      ) => {
        try {
          const info = await window.ytdlp.getInfo(videoUrl);

          // Process formats using the service
          const { formatOptions, defaultFormatId, defaultExt } =
            await VideoFormatService.processVideoFormats(info);

          // Update download with metadata
          get().updateDownload(downloadId, {
            title: info.data.title,
            formats: formatOptions,
            extractorKey: info.data.extractor_key,
            status: 'ready',
            formatId: defaultFormatId,
            ext: defaultExt,
            downloadFolder,
            thumbnail: info.data.thumbnail,
          });
        } catch (error) {
          console.error('Error fetching metadata:', error);
          get().updateDownload(downloadId, {
            status: 'error',
            error: 'Failed to fetch video information',
          });
        }
      },

      //End of store
    }),
    {
      name: 'downlodr-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        historyDownloads: state.historyDownloads,
        availableTags: state.availableTags,
        availableCategories: state.availableCategories,
      }),
    },
  ),
);

export default useDownloadStore;
