import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('transcribeBridge', {
  ffmpegWhisperTranscribe: (options: {
    inputFile: string;
    outputFile: string;
    modelPath: string;
    language?: string;
    format?: string;
    /** Tags this job's progress events; see the main-process handler. */
    jobId?: string;
  }) => ipcRenderer.invoke('ffmpeg:whisper-transcribe', options),
  onFFmpegProgress: (callback: (progress: string) => void) => {
    const wrappedCallback = (_: any, progress: string) => callback(progress);
    ipcRenderer.on('ffmpeg:progress', wrappedCallback);
    return () => ipcRenderer.removeListener('ffmpeg:progress', wrappedCallback);
  },
});
