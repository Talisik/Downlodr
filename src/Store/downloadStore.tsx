/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

function uuidv4() {
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
    (
      +c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))
    ).toString(16),
  );
}

// Base interface for all download types
interface BaseDownload {
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
}

interface ForDownload extends BaseDownload {
  status: 'To Download';
  downloadStart: boolean;
  formatId: string;
  audioExt: string;
  audioFormatId: string;
}

interface Downloading extends BaseDownload {
  status: 'downloading' | 'finished' | 'failed' | 'cancelled' | 'initializing';
  formatId: string;
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
  ) => void;

  setDownload: (
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
    downloadStart: boolean,
    audioExt: string,
    audioFormatId: string,
  ) => void;

  deleteDownload: (id: string) => void;
}

const useDownloadStore = create<DownloadStore>()(
  persist(
    (set, get) => ({
      forDownloads: [],
      downloading: [],
      finishedDownloads: [],
      historyDownloads: [],

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

              // Set up a periodic check for this specific download
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
              controllerId: '---',
            },
          ],
        }));
      },

      setDownload: async (
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
        downloadStart,
        audioExt,
        audioFormatId,
      ) => {
        if (!location || !downloadName) {
          console.error('Invalid path parameters:', { location, downloadName });
          return;
        }
        const downloadId = uuidv4();
        set((state) => ({
          ...state,
          forDownloads: [
            ...state.forDownloads,
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
              status: 'To Download',
              ext,
              downloadStart,
              formatId,
              audioExt,
              audioFormatId,
            },
          ],
        }));
      },

      deleteDownload: (id: string) => {
        set((state) => {
          // Check which collection contains the id and only filter that one
          if (state.downloading.some((d) => d.id === id)) {
            return {
              downloading: state.downloading.filter((d) => d.id !== id),
            };
          }
          if (state.finishedDownloads.some((d) => d.id === id)) {
            return {
              finishedDownloads: state.finishedDownloads.filter(
                (d) => d.id !== id,
              ),
            };
          }
          if (state.historyDownloads.some((d) => d.id === id)) {
            return {
              historyDownloads: state.historyDownloads.filter(
                (d) => d.id !== id,
              ),
            };
          }
          if (state.forDownloads.some((d) => d.id === id)) {
            return {
              forDownloads: state.forDownloads.filter((d) => d.id !== id),
            };
          }
          return state;
        });
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

      //End of store
    }),
    {
      name: 'downlodr-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ historyDownloads: state.historyDownloads }),
    },
  ),
);

export default useDownloadStore;
