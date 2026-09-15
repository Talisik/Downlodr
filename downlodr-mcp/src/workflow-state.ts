/**
 * Workflow State Tracker
 *
 * In-memory store that records which prerequisite MCP tools have been called
 * so that action tools (create_channel, queue_download, etc.) can reject
 * calls when Claude skips required steps.
 *
 * Sessions auto-expire after 30 minutes to prevent stale state.
 */

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ─── Subscribe workflow ──────────────────────────────────────────────────────

export interface SubscribeSession {
  url: string;
  createdAt: number;
  listChannelsCalled: boolean;
  analyzeScheduleCalled: boolean;
  fetchDetailsCalled: boolean;
  videoCount?: number;
  channelName?: string;
}

// ─── Download workflow ───────────────────────────────────────────────────────

export interface DownloadSession {
  url: string;
  createdAt: number;
  getVideoInfoCalled: boolean;
  videoTitle?: string;
}

// ─── Global flags (not per-URL) ──────────────────────────────────────────────

interface GlobalState {
  /** True after downlodr_list_channels has been called at least once in the current window */
  listChannelsCalled: boolean;
  listChannelsCalledAt: number;
  /** True after downlodr_list_download_tasks has been called at least once */
  listDownloadTasksCalled: boolean;
  listDownloadTasksCalledAt: number;
}

// ─── Store ───────────────────────────────────────────────────────────────────

const subscribeSessions = new Map<string, SubscribeSession>();
const downloadSessions = new Map<string, DownloadSession>();
const globalState: GlobalState = {
  listChannelsCalled: false,
  listChannelsCalledAt: 0,
  listDownloadTasksCalled: false,
  listDownloadTasksCalledAt: 0,
};

/** Normalize URL for consistent map keys */
function normalizeUrl(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, '');
}

/** Remove expired sessions */
function sweep<T extends { createdAt: number }>(map: Map<string, T>): void {
  const now = Date.now();
  for (const [key, session] of map) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      map.delete(key);
    }
  }
}

// ─── Subscribe workflow helpers ──────────────────────────────────────────────

export function getOrCreateSubscribeSession(url: string): SubscribeSession {
  sweep(subscribeSessions);
  const key = normalizeUrl(url);
  let session = subscribeSessions.get(key);
  if (!session) {
    session = {
      url: key,
      createdAt: Date.now(),
      listChannelsCalled: false,
      analyzeScheduleCalled: false,
      fetchDetailsCalled: false,
    };
    subscribeSessions.set(key, session);
  }
  return session;
}

export function recordAnalyzeSchedule(url: string, videoCount: number): void {
  const session = getOrCreateSubscribeSession(url);
  session.analyzeScheduleCalled = true;
  session.videoCount = videoCount;
}

export function recordFetchDetails(url: string, channelName: string): void {
  const session = getOrCreateSubscribeSession(url);
  session.fetchDetailsCalled = true;
  session.channelName = channelName;
}

export function recordListChannels(): void {
  globalState.listChannelsCalled = true;
  globalState.listChannelsCalledAt = Date.now();
  // Also mark on all active subscribe sessions
  for (const session of subscribeSessions.values()) {
    session.listChannelsCalled = true;
  }
}

export function getSubscribeSession(url: string): SubscribeSession | undefined {
  sweep(subscribeSessions);
  return subscribeSessions.get(normalizeUrl(url));
}

// ─── Download workflow helpers ───────────────────────────────────────────────

export function recordGetVideoInfo(url: string, title?: string): void {
  sweep(downloadSessions);
  const key = normalizeUrl(url);
  let session = downloadSessions.get(key);
  if (!session) {
    session = {
      url: key,
      createdAt: Date.now(),
      getVideoInfoCalled: false,
    };
    downloadSessions.set(key, session);
  }
  session.getVideoInfoCalled = true;
  if (title) session.videoTitle = title;
}

export function getDownloadSession(url: string): DownloadSession | undefined {
  sweep(downloadSessions);
  return downloadSessions.get(normalizeUrl(url));
}

// ─── Global state helpers ────────────────────────────────────────────────────

export function recordListDownloadTasks(): void {
  globalState.listDownloadTasksCalled = true;
  globalState.listDownloadTasksCalledAt = Date.now();
}

export function isListChannelsRecent(): boolean {
  if (!globalState.listChannelsCalled) return false;
  return Date.now() - globalState.listChannelsCalledAt < SESSION_TTL_MS;
}

export function isListDownloadTasksRecent(): boolean {
  if (!globalState.listDownloadTasksCalled) return false;
  return Date.now() - globalState.listDownloadTasksCalledAt < SESSION_TTL_MS;
}

// ─── Prerequisite check helpers (return error message or null) ───────────────

export interface PrereqError {
  /** Short machine-readable code */
  code: string;
  /** Human-readable message for Claude to show / understand */
  message: string;
}

export function checkSubscribePrereqs(
  url: string,
  firstScrapeLimit: number,
): PrereqError | null {
  const session = getSubscribeSession(url);

  if (!session || !session.analyzeScheduleCalled) {
    return {
      code: 'MISSING_ANALYSIS',
      message:
        'BLOCKED: You must call downlodr_analyze_channel_schedule(channelUrl) first before subscribing. ' +
        'The UI always analyzes the channel\'s upload pattern before allowing a subscription. ' +
        'Call that tool now, show the results to the user, then retry.',
    };
  }

  if (!isListChannelsRecent()) {
    return {
      code: 'MISSING_DUPLICATE_CHECK',
      message:
        'BLOCKED: You must call downlodr_list_channels first to check for duplicate subscriptions. ' +
        'The UI always checks for duplicates before subscribing. Call that tool now and verify the channel is not already subscribed.',
    };
  }

  if (firstScrapeLimit > 5) {
    return {
      code: 'SCRAPE_LIMIT_TOO_HIGH',
      message:
        `BLOCKED: first_scrape_limit (${firstScrapeLimit}) exceeds the UI maximum of 5. ` +
        'The UI only offers options 1–5 (or fewer if the channel has fewer videos). Ask the user for a valid value.',
    };
  }

  if (session.videoCount !== undefined && firstScrapeLimit > session.videoCount) {
    return {
      code: 'SCRAPE_LIMIT_EXCEEDS_COUNT',
      message:
        `BLOCKED: first_scrape_limit (${firstScrapeLimit}) exceeds the channel's video count (${session.videoCount}). ` +
        `Ask the user for a value between 0 and ${Math.min(session.videoCount, 5)}.`,
    };
  }

  return null;
}

export function checkDownloadPrereqs(url: string): PrereqError | null {
  const session = getDownloadSession(url);

  if (!session || !session.getVideoInfoCalled) {
    return {
      code: 'MISSING_VIDEO_INFO',
      message:
        'BLOCKED: You must call downlodr_get_video_info(url) first before starting a download. ' +
        'The UI always fetches video metadata (title, formats) and shows it to the user before downloading. ' +
        'Call that tool now, display the title and format options, then retry.',
    };
  }

  return null;
}

/**
 * The batch form of checkDownloadPrereqs: every url in the batch needs its own
 * get_video_info, because the card names each video and the agent cannot name
 * one it never looked up.
 */
export function checkBatchDownloadPrereqs(urls: string[]): PrereqError | null {
  const missing = urls.filter((u) => {
    const session = getDownloadSession(u);
    return !session || !session.getVideoInfoCalled;
  });
  if (missing.length === 0) return null;
  return {
    code: 'MISSING_VIDEO_INFO',
    message:
      `BLOCKED: You must call downlodr_get_video_info(url) for every video in a batch ` +
      `before downloading it. Missing for: ${missing.join(', ')}. ` +
      `Call get_video_info for each of those, then retry.`,
  };
}

export function checkDeleteChannelPrereqs(): PrereqError | null {
  if (!isListChannelsRecent()) {
    return {
      code: 'MISSING_CHANNEL_LIST',
      message:
        'BLOCKED: You must call downlodr_list_channels first to verify the channel exists. ' +
        'Call that tool, confirm with the user which channel to delete, then retry.',
    };
  }
  return null;
}

export function checkStartScraperPrereqs(): PrereqError | null {
  if (!isListChannelsRecent()) {
    return {
      code: 'MISSING_CHANNEL_LIST',
      message:
        'BLOCKED: You must call downlodr_list_channels first to confirm there are channels to scrape. ' +
        'Call that tool and show the user their subscriptions before starting the scraper.',
    };
  }
  return null;
}

export function checkStartDownloadWorkerPrereqs(): PrereqError | null {
  if (!isListDownloadTasksRecent()) {
    return {
      code: 'MISSING_TASK_LIST',
      message:
        'BLOCKED: You must call downlodr_list_download_tasks first to confirm there are pending tasks. ' +
        'Call that tool and show the user the queued videos before starting the download worker.',
    };
  }
  return null;
}
