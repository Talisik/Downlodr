
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
  getAllDownloads: () => any;
  getActiveDownloads: () => Download[];
  addDownload: (url: string, options: DownloadOptions) => Promise<string>;
  cancelDownload?: (id: string) => Promise<boolean>;
  pauseDownload?: (downloadId?: string) => Promise<boolean>;
  pauseAllDownloads?: () => void;
  resumeDownload?: (downloadId?: string) => Promise<boolean>;
  resumeAllDownloads?: () => void;
  stopAllDownloads?: () => Promise<boolean>;
  getInfo: (url: string) => Promise<DownloadInfo>;
}

export interface UIAPI {
  registerMenuItem: (menuItem: MenuItem) => Promise<string>;
  unregisterMenuItem: (id: string) => Promise<boolean>;
  registerFormatProvider: (provider: FormatProvider) => string;
  registerSettingsPage: (page: SettingsPage) => string;
  showNotification: (options: NotificationOptions) => void;
  showFormatSelector: (
    options: FormatSelectorOptions,
  ) => Promise<FormatSelectorResult | null>;
  registerTaskBarItem: (item: TaskBarItem) => Promise<string>;
  unregisterTaskBarItem: (id: string) => Promise<boolean>;
  getTaskBarItems: () => Promise<TaskBarItem[]>;
  showPluginSidePanel: (
    options: PluginSidePanelOptions,
  ) => Promise<PluginSidePanelResult | null>;
  showPluginModal: (
    options: PluginModalOptions,
  ) => Promise<PluginModalResult | null>;
  showSaveFileDialog: (options: SaveDialogOptions) => Promise<SaveDialogResult>;
  closePluginPanel: () => void;
  setTaskBarButtonsVisibility: (
    visibility: Partial<TaskBarButtonsVisibility>,
  ) => void;
}

export interface FormatAPI {
  registerFormatHandler?: (handler: any) => string;
  getSupportedFormats?: () => string[];
}

export interface UtilityAPI {
  formatFileSize: (size: number) => string;
  openExternalLink: (url: string) => Promise<void>;
  selectDirectory: () => Promise<string | null>;
  writeFile: (options: WriteFileOptions) => Promise<WriteFileResult>;
  saveFileWithDialog: (
    options: SaveFileDialogOptions,
  ) => Promise<WriteFileResult>;
  readFileContents: (
    filePath: string,
  ) => Promise<{ success: boolean; data?: string; error?: string }>;
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
  duration: number;
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
  /** Unique identifier for the menu item */
  id?: string;

  /** Unique handler identifier for this specific menu item instance */
  handlerId?: string;

  /** Display label for the menu item */
  label: string;

  /** Icon for the menu item (SVG string, icon name, or path) */
  icon?: string;

  /** Click handler function */
  onClick: (contextData?: any) => void;

  /** Whether the menu item is disabled */
  disabled?: boolean;

  /** ID of the plugin that registered this item */
  pluginId?: string;

  /** Optional tooltip text */
  tooltip?: string;

  /** Nested submenu items */
  submenu?: MenuItem[];

  /** Display order for sorting menu items */
  order?: number;

  /** Context where the menu item should appear */
  context?: 'download' | 'main' | 'all';

  /** Optional keyboard shortcut */
  shortcut?: string;

  /** Optional separator before this item */
  separator?: boolean;

  /** Optional additional data for the item */
  data?: Record<string, any>;
}

export interface MenuItemRegistration {
  /** Unique identifier for the menu item */
  id?: string;

  /** Display label for the menu item */
  label: string;

  /** Icon for the menu item (SVG string, icon name, or path) */
  icon?: string;

  /** Click handler function */
  onClick: (contextData?: any) => void;

  /** Whether the menu item is disabled (defaults to false) */
  disabled?: boolean;

  /** Optional tooltip text */
  tooltip?: string;

  /** Nested submenu items */
  submenu?: MenuItemRegistration[];

  /** Display order for sorting menu items */
  order?: number;

  /** Context where the menu item should appear (defaults to 'all') */
  context?: 'download' | 'main' | 'all';

  /** Optional keyboard shortcut */
  shortcut?: string;

  /** Optional separator before this item */
  separator?: boolean;

  /** Optional additional data for the item */
  data?: Record<string, any>;
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

export interface FormatSelectorOptions {
  title?: string;
  formats: FormatOption[];
  keepOriginal?: boolean;
  selectedItems?: Array<{
    id: string;
    name: string;
    selected: boolean;
  }>;
  showItemSelection?: boolean;
  showSelectAll?: boolean;
  selectAllDefault?: boolean;
  confirmButtonText?: string;
  cancelButtonText?: string;
}

export interface FormatOption {
  id: string;
  label: string;
  value: string;
  default?: boolean;
}

export interface FormatSelectorResult {
  selectedFormat: string;
  keepOriginal: boolean;
  selectedItems?: Array<{
    id: string;
    name: string;
    selected: boolean;
  }>;
}

export interface TaskBarItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  tooltip?: string;
  context: string;
  onClick?: (contextData?: any) => void;
  pluginId?: string;
  handlerId?: string;
  enabled?: boolean;
  shortcut?: string;
  data?: Record<string, any>;
  actionType?: 'single' | 'multiple';
  buttonStyle?: React.CSSProperties | string;
  iconStyle?: React.CSSProperties | string;
  labelStyle?: React.CSSProperties | string;
}

export interface PluginSidePanelOptions {
  title?: string;
  content: React.ReactNode | string;
  icon: string;
  width?: number | string;
  closable?: boolean;
  callbacks?: {
    onBrowse?: () => void;
    onCancel?: () => void;
    onConvert?: (format: string) => void;
    onFormatChange?: (format: string) => void;
    [key: string]: ((...args: any[]) => void) | undefined;
  };
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  main: string;
  author: string;
  license: string;
  minAppVersion: string;
  icon: string;
}

export interface PluginSidePanelResult {
  closed: boolean;
  data?: any;
}

export interface PluginModalOptions {
  title?: string;
  content: React.ReactNode | string;
  width?: number | string;
  height?: number | string;
  closable?: boolean;
  centered?: boolean;
  footer?: React.ReactNode | null;
  callbacks?: {
    onOk?: () => void;
    onCancel?: () => void;
    onClose?: () => void;
    [key: string]: ((...args: any[]) => void) | undefined;
  };
}

export interface PluginModalResult {
  closed: boolean;
  confirmed?: boolean;
  data?: any;
}

export interface SaveDialogOptions {
  defaultPath?: string;
  content: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  title?: string;
  pluginId?: string;
}

export interface SaveDialogResult {
  success: boolean;
  filePath?: string;
  canceled?: boolean;
  error?: string;
}

export interface WriteFileOptions {
  fileName: string;
  content: string;
  fileType?: 'txt' | 'json' | 'docx' | string;
  directory?: string; // Optional subdirectory within plugin data directory
  overwrite?: boolean; // Whether to overwrite existing file, defaults to false
  customPath?: string; // Allow custom path (will require permission)
}

export interface SaveFileDialogOptions {
  defaultPath?: string;
  content: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  title?: string;
}

export interface WriteFileResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  icon: string;
}

export interface TaskBarItemRegistration {
  /** Unique identifier for the taskbar item */
  id: string;

  /** Display label for the taskbar item */
  label: string;

  /** Icon for the taskbar item (SVG string, icon name, or path) */
  icon: string;

  /** Context where the taskbar item should appear */
  context: string;

  /** Optional tooltip text */
  tooltip?: string;

  /** Whether the item is currently enabled/disabled (defaults to true) */
  enabled?: boolean;

  /** Optional keyboard shortcut */
  shortcut?: string;

  /** Optional additional data for the item */
  data?: Record<string, any>;

  /** Type of the item to be handled by the onClick function */
  actionType?: 'single' | 'multiple';

  /** Optional button style */
  buttonStyle?: React.CSSProperties | string;

  /** Optional icon style */
  iconStyle?: React.CSSProperties | string;

  /** Optional label style */
  labelStyle?: React.CSSProperties | string;
}

export interface TaskBarButtonsVisibility {
  start: boolean;
  stop: boolean;
  stopAll: boolean;
}