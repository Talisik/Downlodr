/* eslint-disable prettier/prettier */
import {
  DownloadStoreState,
  FailedDownloads,
} from '@/downlodr/store/download/types';

/** Zustand setter: accepts partial state or updater function */
type SetState = (
  partial:
    | Partial<DownloadStoreState>
    | ((state: DownloadStoreState) => Partial<DownloadStoreState>),
) => void;

/** Store getter */
type GetState = () => {
  failedDownloads: FailedDownloads[];
};

export function transcriptActions(set: SetState, get: GetState) {
  return {
    updateDownloadTranscript: (id: string, transcriptLocation: string) => {
      console.log(
        'Updating transcript location for download:',
        id,
        transcriptLocation,
      );
      set((state) => ({
        downloading: state.downloading.map((download) =>
          download.id === id
            ? { ...download, transcriptLocation, getTranscript: true }
            : download,
        ),
        finishedDownloads: state.finishedDownloads.map((download) =>
          download.id === id
            ? { ...download, transcriptLocation, getTranscript: true }
            : download,
        ),
        historyDownloads: state.historyDownloads.map((download) =>
          download.id === id
            ? { ...download, transcriptLocation, getTranscript: true }
            : download,
        ),
      }));
    },

    clearStuckTranscriptionStatus: () => {
      set((state) => {
        const clearIfTranscribing = <
          T extends {
            id: string;
            transcriptionStatus?: string;
            transcriptionProgress?: number;
          },
        >(
          d: T,
        ): T =>
          d.transcriptionStatus === 'transcribing'
            ? { ...d, transcriptionStatus: undefined, transcriptionProgress: undefined }
            : d;
        return {
          forDownloads: state.forDownloads.map(clearIfTranscribing),
          downloading: state.downloading.map(clearIfTranscribing),
          finishedDownloads: state.finishedDownloads.map(clearIfTranscribing),
          historyDownloads: state.historyDownloads.map(clearIfTranscribing),
          queuedDownloads: state.queuedDownloads.map(clearIfTranscribing),
        };
      });
    },
  };
}
