/* eslint-disable @typescript-eslint/no-explicit-any */
export interface DownlodrPlugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  initialize: (api: PluginAPI) => Promise<void> | void;
  onUnload?: () => Promise<void> | void;
}

export interface PluginAPI {
  // Core functionalities plugins can access
  downloads: DownloadAPI;
  ui: UIAPI;
  formats: FormatAPI;
  utilities: UtilityAPI;
}

export interface DownloadAPI {
  registerDownloadSource: (source: DownloadSource) => void;
  getActiveDownloads: () => Download[];
  addDownload: (url: string, options: DownloadOptions) => Promise<string>;
  cancelDownload?: (id: string) => Promise<boolean>;
  pauseDownload?: (id: string) => Promise<boolean>;
  getInfo: (url: string) => Promise<DownloadInfo>;
}

export interface UIAPI {
  registerMenuItem: (menuItem: MenuItem) => Promise<string>;
  unregisterMenuItem: (id: string) => Promise<boolean>;
  registerFormatProvider: (provider: FormatProvider) => string;
  registerSettingsPage: (page: SettingsPage) => string;
  showNotification: (options: NotificationOptions) => void;
}

export interface FormatAPI {
  registerFormatHandler?: (handler: any) => string;
  getSupportedFormats?: () => string[];
}

export interface UtilityAPI {
  formatFileSize: (size: number) => string;
  openExternalLink: (url: string) => Promise<void>;
  selectDirectory: () => Promise<string>;
}

export interface FormatProvider {
  id: string;
  name: string;
  getFormats: (url: string) => Promise<Format[]>;
}

export interface Format {
  id: string;
  name: string;
  extension: string;
  quality?: string;
}

export interface SettingsPage {
  id: string;
  title: string;
  component: any;
}

export interface NotificationOptions {
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  duration?: number;
}

export interface DownloadSource {
  id: string;
  name: string;
  canHandle: (url: string) => boolean;
  getInfo: (url: string) => Promise<DownloadInfo>;
}

export interface Download {
  id: string;
  url?: string;
  name: string;
  progress: number;
  status: 'queued' | 'downloading' | 'paused' | 'completed' | 'error';
  size?: number;
  downloaded?: number;
  location: string;
  format?: string;
}

export interface DownloadOptions {
  name: string;
  downloadName?: string;
  size?: number;
  format?: string;
  location?: string;
  ext?: string;
  speed?: string;
  timeLeft?: string;
  formatId?: string;
  audioFormatId?: string;
  audioExt?: string;
  extractorKey?: string;
  limitRate?: string;
  automaticCaption?: any;
  thumbnails?: any;
  getTranscript?: boolean;
  getThumbnail?: boolean;
}

export interface DownloadInfo {
  title: string;
  formats: Format[];
  thumbnail?: string;
  duration?: number;
  uploader?: string;
}

export interface FormatHandler {
  id: string;
  name: string;
  supportedExtensions: string[];
  canHandle: (format: string) => boolean;
  process?: (file: string, options?: any) => Promise<string>;
  getFormatDetails?: (format: string) => {
    name: string;
    description?: string;
    icon?: string;
  };
}

export interface MenuItem {
  id?: string;
  handlerId?: string;
  label: string;
  icon?: string;
  onClick: (contextData?: any) => void;
  disabled?: boolean;
  pluginId?: string;
  tooltip?: string;
  submenu?: MenuItem[];
  order?: number;
  context?: 'download' | 'main' | 'all';
}

export interface NotifItem {
  id?: string;
  handlerId?: string;
  title: string;
  message: string;
  type: string;
  duration: number;
  onClick: (contextData?: any) => void;
  disabled?: boolean;
  pluginId?: string;
  tooltip?: string;
  submenu?: MenuItem[];
  order?: number;
  context?: 'download' | 'main' | 'all';
}
