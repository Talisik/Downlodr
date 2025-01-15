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

interface ForDownload {
  id: string;
  displayName: string;
  downloadName: string;
  ext: string;
  location: string;
  status: 'downloading' | 'finished' | 'failed' | 'cancelled' | 'To Download';
  downloadStart: boolean;
  videoUrl: string;
  formatId: string;
  audioFormat: string;
  audioQuality: string;
}

interface Downloading {
  id: string;
  videoUrl: string;
  name: string;
  downloadName: string;
  size: number;
  speed: string;
  timeLeft: string;
  DateAdded: string;
  ext: string;
  progress: number;
  location: string;
  status: 'downloading' | 'finished' | 'failed' | 'cancelled' | 'initializing';
  formatId: string;
  controllerId: string;
}

interface FinishedDownloads {
  id: string;
  videoUrl: string;
  name: string;
  size: number;
  speed: string;
  timeLeft: string;
  DateAdded: string;
  progress: number;
  location: string;
  status: string;
}

interface HistoryDownloads {
  id: string;
  videoUrl: string;
  name: string;
  size: number;
  speed: string;
  timeLeft: string;
  DateAdded: string;
  progress: number;
  location: string;
  status: string;
}

interface DownloadStore {
  downloads: Downloading[];
  addDownload: (download: Downloading) => void;
  updateDownload: (id: string, data: Partial<Downloading>) => void;
}

const useDownloadStore = create<DownloadStore>((set) => ({
  downloads: [],
  addDownload: (download) =>
    set((state) => ({ downloads: [...state.downloads, download] })),
  updateDownload: (id, data) =>
    set((state) => ({
      downloads: state.downloads.map((d) =>
        d.id === id ? { ...d, ...data } : d,
      ),
    })),
}));

export default useDownloadStore;
