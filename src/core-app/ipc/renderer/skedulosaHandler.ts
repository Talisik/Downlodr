import { contextBridge, ipcRenderer } from 'electron';

/**
 * Renderer-side bridge for Skedulosa (video-nemesis-toolkit).
 * Exposes all toolkit IPC channels to the renderer via window.skedulosaBridge.
 *
 * Usage in renderer:
 *   const schedules = await window.skedulosaBridge.listSchedules();
 *   await window.skedulosaBridge.startScraper();
 *   window.skedulosaBridge.onDownloadQueuePushed((tasks) => { ... });
 */
contextBridge.exposeInMainWorld('skedulosaBridge', {
  // ─── Schedules ────────────────────────────────────────────────────────────
  listSchedules: () =>
    ipcRenderer.invoke('toolkit:schedules:list'),

  getSchedule: (id: number) =>
    ipcRenderer.invoke('toolkit:schedules:get', id),

  createSchedule: (payload: { name?: string | null }) =>
    ipcRenderer.invoke('toolkit:schedules:create', payload),

  updateSchedule: (id: number, payload: { name?: string | null }) =>
    ipcRenderer.invoke('toolkit:schedules:update', id, payload),

  deleteSchedule: (id: number) =>
    ipcRenderer.invoke('toolkit:schedules:delete', id),

  // ─── Channels ─────────────────────────────────────────────────────────────
  // handler signature: (db, activeOnly?: boolean, scheduleId?: number)
  // args[0] = activeOnly, args[1] = scheduleId
  listChannels: (activeOnly?: boolean, scheduleId?: number) =>
    ipcRenderer.invoke('toolkit:channels:list', activeOnly, scheduleId),

  getChannel: (id: number) =>
    ipcRenderer.invoke('toolkit:channels:get', id),

  // handler expects snake_case: schedule_id, url, name, all_words, any_words, etc.
  createChannel: (payload: {
    schedule_id: number;
    url: string;
    name?: string | null;
    all_words?: string[];
    any_words?: string[];
    none_words?: string[];
    min_duration_minutes?: number | null;
    max_duration_minutes?: number | null;
    download_format?: string;
    download_subtitles?: number;
    download_thumbnails?: number;
    active?: number;
    first_scrape_limit?: number; 
  }) =>
    ipcRenderer.invoke('toolkit:channels:create', payload),

  // handler expects snake_case update fields: active (number 0|1), not isActive (boolean)
  updateChannel: (
    id: number,
    payload: {
      url?: string;
      name?: string | null;
      all_words?: string[];
      any_words?: string[];
      none_words?: string[];
      min_duration_minutes?: number | null;
      max_duration_minutes?: number | null;
      download_format?: string;
      download_subtitles?: number;
      download_thumbnails?: number;
      active?: number;
    },
  ) =>
    ipcRenderer.invoke('toolkit:channels:update', id, payload),

  deleteChannel: (id: number) =>
    ipcRenderer.invoke('toolkit:channels:delete', id),

  setChannelActive: (id: number, isActive: boolean) =>
    ipcRenderer.invoke('toolkit:channels:setActive', id, isActive),

  // ─── Channel Slots (run times) ────────────────────────────────────────────
  listChannelSlots: (channelId: number) =>
    ipcRenderer.invoke('toolkit:channelSlots:list', channelId),

  // handler expects snake_case slot objects: { day_of_week, time_minutes }
  replaceChannelSlots: (
    channelId: number,
    slots: { day_of_week: number; time_minutes: number }[],
  ) =>
    ipcRenderer.invoke('toolkit:channelSlots:replace', channelId, slots),

  // handler reads args[1] as dayOfWeek (number) and args[2] as timeMinutes (number) — positional
  addChannelSlot: (
    channelId: number,
    slot: { day_of_week: number; time_minutes: number },
  ) =>
    ipcRenderer.invoke(
      'toolkit:channelSlots:add',
      channelId,
      slot.day_of_week,
      slot.time_minutes,
    ),

  // handler reads args[0] as fromDate (ISO string or ms number); pass undefined to use current time
  getNextRun: (fromDate?: string) =>
    ipcRenderer.invoke('toolkit:channelSlots:getNextRun', fromDate),

  // ─── Channel Analysis ─────────────────────────────────────────────────────
  analyzeChannelSchedule: (channelUrl: string) =>
    ipcRenderer.invoke('toolkit:channelAnalyze:schedule', channelUrl),

  fetchAccurateTimestamps: (channelUrl: string) =>
    ipcRenderer.invoke('toolkit:channelFetch:accurateTimestamps', channelUrl),

  fetchChannelDetails: (channelUrl: string) =>
    ipcRenderer.invoke('toolkit:channel:fetchDetails', channelUrl),

  // handler reads args[0] as channelUrl (string), args[1] as daysBack (number, optional), args[2] as maxPerDay (number, optional)
  fetchUploadDates: (channelUrl: string, daysBack?: number, maxPerDay?: number) =>
    ipcRenderer.invoke('toolkit:channel:fetchUploadDates', channelUrl, daysBack, maxPerDay),

  // handler reads args[0] as channelId (number) and args[1] as videos[] — positional, not wrapped
  saveAnalysisVideos: (channelId: number, videos: unknown[]) =>
    ipcRenderer.invoke('toolkit:channelAnalysisVideos:save', channelId, videos),

  // ─── Intelligent Schedule ─────────────────────────────────────────────────
  getIntelligentSchedule: (channelId: number) =>
    ipcRenderer.invoke('toolkit:intelligentSchedule:get', channelId),

  getUpcomingSchedules: (hoursAhead?: number) =>
    ipcRenderer.invoke('toolkit:intelligentSchedule:getUpcoming', hoursAhead),

  getOverdueSchedules: () =>
    ipcRenderer.invoke('toolkit:intelligentSchedule:getOverdue'),

  getScheduleStats: () =>
    ipcRenderer.invoke('toolkit:intelligentSchedule:getStats'),

  refreshAllIntelligentSchedules: () =>
    ipcRenderer.invoke('toolkit:intelligentSchedule:refreshAll'),

  // Returns merged manual + intelligent scrape events for the current week, sorted ascending by time
  getThisWeekSched: () =>
    ipcRenderer.invoke('toolkit:schedule:getThisWeekSched'),

  // ─── Download Tasks ───────────────────────────────────────────────────────
  listDownloadTasks: (status?: string) =>
    ipcRenderer.invoke('toolkit:downloadTasks:list', status),

  getDownloadTask: (id: number) =>
    ipcRenderer.invoke('toolkit:downloadTasks:get', id),

  // handler expects { video_url: string, channel_id: number }
  addDownloadTask: (payload: { video_url: string; channel_id: number }) =>
    ipcRenderer.invoke('toolkit:downloadTasks:add', payload),

  markDownloadTaskFinished: (id: number) =>
    ipcRenderer.invoke('toolkit:downloadTasks:markFinished', id),

  deleteDownloadTask: (id: number) =>
    ipcRenderer.invoke('toolkit:downloadTasks:delete', id),

  clearPendingDownloadTasks: () =>
    ipcRenderer.invoke('toolkit:downloadTasks:clearPending'),

  // ─── Download History ─────────────────────────────────────────────────────
  listDownloadHistory: (filters?: {
    channelId?: number;
    status?: string;
    limit?: number;
    offset?: number;
  }) =>
    ipcRenderer.invoke('toolkit:downloadHistory:list', filters),

  // ─── Video Details ────────────────────────────────────────────────────────
  // handler reads args[0] as channelName (string), not channelId (number)
  listVideoDetails: (channelName?: string) =>
    ipcRenderer.invoke('toolkit:videoDetails:list', channelName),

  // handler reads args[0] as videoUrl (string)
  getVideoDetail: (videoUrl: string) =>
    ipcRenderer.invoke('toolkit:videoDetails:get', videoUrl),

  // ─── Scraper Control ──────────────────────────────────────────────────────
  startScraper: () =>
    ipcRenderer.invoke('toolkit:scraper:start'),

  stopScraper: () =>
    ipcRenderer.invoke('toolkit:scraper:stop'),

  runScraperOnce: (channelId?: number) =>
    ipcRenderer.invoke('toolkit:scraper:runOnce', channelId),

  // ─── Download Worker Control ──────────────────────────────────────────────
  startDownloadWorker: () =>
    ipcRenderer.invoke('toolkit:downloadWorker:start'),

  stopDownloadWorker: () =>
    ipcRenderer.invoke('toolkit:downloadWorker:stop'),

  getDownloadWorkerStatus: () =>
    ipcRenderer.invoke('toolkit:downloadWorker:getStatus'),

  // ─── Process Info ─────────────────────────────────────────────────────────
  getProcessLoad: () =>
    ipcRenderer.invoke('toolkit:process:load'),

  

  // ─── Push Events (Main → Renderer) ───────────────────────────────────────
  /** Called when scraper finishes a run and pushes pending download tasks */
  onDownloadQueuePushed: (callback: (tasks: unknown[]) => void) => {
    // Remove any previous listener before registering to prevent stacking
    // when the hook re-mounts (e.g. React StrictMode, hot reload).
    ipcRenderer.removeAllListeners('toolkit:downloadQueue:pushed');
    ipcRenderer.on('toolkit:downloadQueue:pushed', (_event, tasks) =>
      callback(tasks),
    );
  },

  /** Called when scraper status changes: { phase: 'idle'|'sleeping'|'running'|'finished', nextRunAt?: string } */
  onScraperStatus: (
    callback: (status: { phase: string; nextRunAt?: string }) => void,
  ) => {
    ipcRenderer.on('toolkit:scraper:status', (_event, status) =>
      callback(status),
    );
  },

  /** Remove push event listeners (call on component unmount) */
  removeDownloadQueueListener: () => {
    ipcRenderer.removeAllListeners('toolkit:downloadQueue:pushed');
  },

  removeScraperStatusListener: () => {
    ipcRenderer.removeAllListeners('toolkit:scraper:status');
  },

  /** Called after each individual channel scrape: { channelId, lastScrapedAt } */
  onChannelScraped: (
    callback: (payload: { channelId: number; lastScrapedAt: string }) => void,
  ) => {
    ipcRenderer.on('toolkit:scraper:channelScraped', (_event, payload) =>
      callback(payload),
    );
  },

  removeChannelScrapedListener: () => {
    ipcRenderer.removeAllListeners('toolkit:scraper:channelScraped');
  },

  /** Called for each [scraper] console.log message from the main process */
  onScraperChannelLog: (callback: (message: string) => void) => {
    ipcRenderer.removeAllListeners('toolkit:scraper:channelLog');
    ipcRenderer.on('toolkit:scraper:channelLog', (_event, message) =>
      callback(message),
    );
  },

  removeScraperChannelLogListener: () => {
    ipcRenderer.removeAllListeners('toolkit:scraper:channelLog');
  },

  /** Fired by the MCP bridge after it creates a channel — lets the UI store add it without a restart */
  onChannelCreated: (callback: (channel: unknown) => void) => {
    ipcRenderer.removeAllListeners('toolkit:channel:created');
    ipcRenderer.on('toolkit:channel:created', (_event, channel) => callback(channel));
  },

  removeChannelCreatedListener: () => {
    ipcRenderer.removeAllListeners('toolkit:channel:created');
  },

  /** Fired by the MCP bridge after it updates a channel (rename, active toggle, etc.) */
  onChannelUpdated: (callback: (payload: unknown) => void) => {
    ipcRenderer.removeAllListeners('toolkit:channel:updated');
    ipcRenderer.on('toolkit:channel:updated', (_event, payload) => callback(payload));
  },

  removeChannelUpdatedListener: () => {
    ipcRenderer.removeAllListeners('toolkit:channel:updated');
  },

  /** Fired by the MCP bridge after it deletes a channel */
  onChannelDeleted: (callback: (payload: { id: number }) => void) => {
    ipcRenderer.removeAllListeners('toolkit:channel:deleted');
    ipcRenderer.on('toolkit:channel:deleted', (_event, payload) => callback(payload as { id: number }));
  },

  removeChannelDeletedListener: () => {
    ipcRenderer.removeAllListeners('toolkit:channel:deleted');
  },
});
