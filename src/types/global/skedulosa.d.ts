/* eslint-disable prettier/prettier */
/** Skedulosa (video-nemesis-toolkit): channel subscriptions and scheduled downloads. */
declare global {
  interface Window {
    // ─── Skedulosa (video-nemesis-toolkit) bridge ─────────────────────────
    skedulosaBridge: {
      // Schedules
      listSchedules: () => Promise<unknown[]>;
      getSchedule: (id: string) => Promise<unknown>;
      createSchedule: (payload: { name?: string | null }) => Promise<unknown>;
      updateSchedule: (id: number, payload: { name?: string | null }) => Promise<unknown>;
      deleteSchedule: (id: number) => Promise<void>;
      // Channels
      listChannels: (activeOnly?: boolean, scheduleId?: number) => Promise<unknown[]>;
      getChannel: (id: number) => Promise<unknown>;
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
        first_scrape_limit?: number,
      }) => Promise<unknown>;
      updateChannel: (id: number, payload: {
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
      }) => Promise<unknown>;
      deleteChannel: (id: number) => Promise<void>;
      setChannelActive: (id: number, isActive: boolean) => Promise<void>;
      // Channel Slots
      listChannelSlots: (channelId: number) => Promise<unknown[]>;
      replaceChannelSlots: (channelId: number, slots: { day_of_week: number; time_minutes: number }[]) => Promise<unknown[]>;
      addChannelSlot: (channelId: number, slot: { day_of_week: number; time_minutes: number }) => Promise<unknown>;
      getNextRun: (fromDate?: string) => Promise<string | null>;
      // Channel Analysis
      analyzeChannelSchedule: (channelUrl: string) => Promise<unknown>;
      fetchAccurateTimestamps: (channelUrl: string) => Promise<unknown>;
      fetchChannelDetails: (channelUrl: string) => Promise<unknown>;
      fetchUploadDates: (channelUrl: string, daysBack?: number, maxPerDay?: number) => Promise<{ dates: string[]; error?: string }>;
      saveAnalysisVideos: (channelId: number, videos: unknown[]) => Promise<unknown>;
      // Intelligent Schedule
      getIntelligentSchedule: (channelId: number) => Promise<unknown>;
      getUpcomingSchedules: (hoursAhead?: number) => Promise<unknown[]>;
      getOverdueSchedules: () => Promise<unknown[]>;
      getScheduleStats: () => Promise<unknown>;
      refreshAllIntelligentSchedules: () => Promise<unknown>;
      // Download Tasks
      listDownloadTasks: (status?: string) => Promise<unknown[]>;
      getDownloadTask: (id: number) => Promise<unknown>;
      addDownloadTask: (payload: { video_url: string; channel_id: number }) => Promise<unknown>;
      markDownloadTaskFinished: (id: number) => Promise<unknown>;
      deleteDownloadTask: (id: number) => Promise<{ deleted: number }>;
      clearPendingDownloadTasks: () => Promise<{ cleared: boolean }>;
      // Download History
      listDownloadHistory: (filters?: { channelId?: number; status?: string; limit?: number; offset?: number }) => Promise<unknown[]>;
      // Video Details
      listVideoDetails: (channelName?: string) => Promise<unknown[]>;
      getVideoDetail: (videoUrl: string) => Promise<unknown>;
      // Scraper Control
      startScraper: () => Promise<void>;
      stopScraper: () => Promise<void>;
      runScraperOnce: (channelId?: number) => Promise<void>;
      // Download Worker Control
      startDownloadWorker: () => Promise<void>;
      stopDownloadWorker: () => Promise<void>;
      getDownloadWorkerStatus: () => Promise<{ running: boolean }>;
      // Process Info
      getProcessLoad: () => Promise<{ memory: { rss: number; heapUsed: number; heapTotal: number; external: number }; cpu: { user: number; system: number } }>;
      // Push Events
      onDownloadQueuePushed: (callback: (tasks: unknown[]) => void) => void;
      onScraperStatus: (callback: (status: { phase: string; nextRunAt?: string }) => void) => void;
      removeDownloadQueueListener: () => void;
      removeScraperStatusListener: () => void;
      onScraperChannelLog: (callback: (message: string) => void) => void;
      removeScraperChannelLogListener: () => void;
      onChannelScraped: (callback: (payload: { channelId: number; lastScrapedAt: string }) => void) => void;
      removeChannelScrapedListener: () => void;
      onChannelCreated: (callback: (channel: unknown) => void) => void;
      removeChannelCreatedListener: () => void;
      onChannelScraping: (callback: (payload: unknown) => void) => void;
      removeChannelScrapingListener: () => void;
      onChannelUpdated: (callback: (payload: unknown) => void) => void;
      removeChannelUpdatedListener: () => void;
      onChannelDeleted: (callback: (payload: { id: number }) => void) => void;
      removeChannelDeletedListener: () => void;
    };
  }
}

export {};
