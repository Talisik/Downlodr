// src/plugins/extensionPoints.ts
import {
  DownloadSource,
  Download,
  DownloadOptions,
  SettingsPage,
  MenuItem,
  NotifItem,
  FormatHandler,
  FormatProvider,
} from './types';

export interface DownloadAPI {
  // Allow plugins to add new download sources
  registerDownloadSource: (source: DownloadSource) => void;
  getActiveDownloads: () => Download[];
  addDownload: (url: string, options: DownloadOptions) => Promise<string>;
  cancelDownload: (id: string) => Promise<boolean>;
  pauseDownload: (id: string) => Promise<boolean>;
}

export interface UIAPI {
  // Let plugins add UI elements
  registerMenuItem: (menuItem: MenuItem) => string;
  unregisterMenuItem: (id: string) => void;
  registerFormatProvider: (provider: FormatProvider) => string;
  registerSettingsPage: (page: SettingsPage) => string;
  showNotification: (notifItem: NotifItem) => void;
}

export interface FormatAPI {
  // Allow plugins to add custom format handlers
  registerFormatHandler: (handler: FormatHandler) => string;
  getSupportedFormats: () => string[];
}

export interface UtilityAPI {
  // Expose safe utility functions
  formatFileSize: (size: number) => string;
  openExternalLink: (url: string) => Promise<void>;
  selectDirectory: () => Promise<string>;
}
