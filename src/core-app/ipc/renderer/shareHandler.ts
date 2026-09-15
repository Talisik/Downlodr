import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('shareBridge', {
  record: (payload: {
    senderUserId: string;
    longUrl: string;
    title?: string;
    listId?: string;
  }) => ipcRenderer.invoke('share:record', payload),
});
