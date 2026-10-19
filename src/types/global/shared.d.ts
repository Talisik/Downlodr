/* eslint-disable prettier/prettier */
/** Response shapes shared by several bridges. Re-exported from src/global.d.ts. */
// --- Shared response types (from main process handlers) ---
export interface AppInfo {
  app_name: string;
  app_platform: string;
  electron_version: string;
  app_arch: string;
}

export interface BrowserInfo {
  browser_name: string;
  browser_version: string;
  browser_arch: string;
}

export interface DeviceInfo {
  user_name: string;
  host_name: string;
  host_id: string;
  host_type: string;
  host_arch: string;
  os_type: string;
  os_description: string;
  os_name: string;
  os_version: string;
  cpu_model: string;
  cpu_cores: number;
  cpu_threads: number;
  memory_total_gb: number;
  memory_available_gb: number;
}

export type GetInfoResponse = Record<string, unknown> | null;

// --- YT-DLP download status (passed to progress callback) ---
export interface YtdlpDownloadStatus {
  type?: string;
  downloadId?: string;
  controllerId?: string;
  data?: { status?: string; [key: string]: unknown };
  [key: string]: unknown;
}

// --- YT-DLP playlist info (getPlaylistInfo response) ---
export interface PlaylistInfoEntry {
  id: string;
  url: string;
  title: string;
  thumbnails: { url: string }[];
  channel: string;
}

export interface PlaylistInfoResponse {
  data: {
    title: string;
    entries: PlaylistInfoEntry[];
  };
}
