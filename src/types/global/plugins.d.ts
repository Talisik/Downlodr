/* eslint-disable prettier/prettier */
/** Plugin system bridges and the optional UI managers plugins drive. */
import type {
  FormatSelectorOptions,
  FormatSelectorResult,
  MenuItem,
  MenuItemRegistration,
  PluginInfo,
  PluginManifest,
  PluginModalOptions,
  PluginModalResult,
  PluginSidePanelOptions,
  PluginSidePanelResult,
  SaveDialogOptions,
  SaveDialogResult,
  TaskBarItem,
  TaskBarItemRegistration,
  WriteFileOptions,
  WriteFileResult,
} from '@/plugins/schema/types';

declare global {
  interface Window {
    /** Plugins: list, install, menu, taskbar, file ops (pluginHandler) */
    pluginControlBridge: {
      list: () => Promise<PluginInfo[]>;
      getCode: (pluginId: string) => Promise<{ code: string; manifest: PluginManifest; error?: string }>;
      install: (pluginPath: string) => Promise<boolean | string>;
      uninstall: (pluginId: string) => Promise<boolean>;
      getMenuItems: (context: string) => Promise<MenuItem[]>;
      executeMenuItem: (id: string, contextData?: unknown) => Promise<void>;
      loadUnzipped: (pluginDirPath: string) => Promise<boolean>;
      extractPlugin: (zipPath: string, extractTo: string) => Promise<string>;
      writeFile: (options: WriteFileOptions) => Promise<WriteFileResult>;
      registerMenuItem: (menuItem: MenuItemRegistration) => Promise<string>;
      unregisterMenuItem: (id: string) => Promise<boolean>;
      getPluginDataPath: (pluginId: string) => Promise<string>;
      saveFileDialog: (options: SaveDialogOptions) => Promise<SaveDialogResult>;
      reload: () => Promise<boolean>;
      onReloaded: (callback: () => void) => () => void;
      getEnabledPlugins: () => Promise<Record<string, boolean>>;
      setPluginEnabled: (pluginId: string, enabled: boolean) => Promise<boolean>;
      onPluginStateChanged: (callback: (data: { pluginId: string; enabled: boolean }) => void) => () => void;
      getPluginLocation: (pluginId: string) => Promise<string | null>;
      openPluginFolder: (pluginId: string) => Promise<boolean>;
      registerTaskBarItem: (item: TaskBarItemRegistration) => Promise<string>;
      unregisterTaskBarItem: (id: string) => Promise<boolean>;
      getTaskBarItems: () => Promise<TaskBarItem[]>;
      executeTaskBarItem: (id: string, contextData?: unknown) => Promise<boolean>;
      readFile: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>;
      readFileContents: (options: { filePath: string; pluginId?: string }) => Promise<{ success: boolean; data?: string; error?: string }>;
      closePluginPanel: () => Promise<void>;
    };

    /** Plugin utilities (pluginHandler) */
    pluginFunctionsBridge: {
      convertToDocx: (content: string, title?: string) => Promise<unknown>;
    };

    // Optional UI managers (may be set by app)
    PluginHandlers?: Record<string, (contextData?: unknown) => void>;
    formatSelectorManager?: {
      showFormatSelector: (options: FormatSelectorOptions) => Promise<FormatSelectorResult | null>;
    };
    pluginModalManager?: {
      showPluginModal: (options: PluginModalOptions) => Promise<PluginModalResult | null>;
    };
    pluginSidePanelManager?: {
      showPluginSidePanel: (options: PluginSidePanelOptions) => Promise<PluginSidePanelResult>;
    };
  }
}
