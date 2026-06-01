/**
 * Composes window.downlodrFunctions, window.ytdlp, window.updateAPI, etc.
 * from the IPC bridges. Call once from the renderer (e.g. in App.tsx) so
 * existing code using window.downlodrFunctions and window.updateAPI keeps working.
 */
export function initComposedWindowApi(): void {
  const w = typeof window !== 'undefined' ? window : undefined;
  if (!w) return;

  const appBehavior = w.appBehaviorBridge;
  const appInfo = w.appInfoBridge;
  const appControl = w.appControlBridge;
  const fileInfo = w.fileInfoBridge;
  const fileFn = w.fileFunctionsBridge;
  const browserFn = w.browserFunctionsBridge;
  const ytdlpBridge = w.ytdlpFunctionsBridge;
  const pluginBridge = w.pluginControlBridge;
  const updateBridge = w.updateFunctionsBridge;
  const transcribe = w.transcribeBridge;
  const devTools = w.electronDevToolsBridge;

  if (appBehavior && fileInfo && fileFn && browserFn && appInfo) {
    w.downlodrFunctions = {
      closeApp: appBehavior.closeApp,
      minimizeApp: appBehavior.minimizeApp,
      maximizeApp: appBehavior.maximizeApp,
      openExternalLink: browserFn.openExternalLink,
      openVideo: fileFn.openVideo,
      deleteFile: fileFn.deleteFile,
      deleteFolder: fileFn.deleteFolder,
      getDownloadFolder: fileInfo.getDownloadFolder,
      getAppInfo: appInfo.getAppInfo,
      getBrowserInfo: appInfo.getBrowserInfo,
      getHostInfo: appInfo.getHostInfo,
      isValidPath: fileInfo.isValidPath,
      joinDownloadPath: fileInfo.joinDownloadPath,
      validatePath: fileInfo.validatePath,
      openFolder: fileFn.openFolder,
      fileExists: fileInfo.fileExists,
      getFileSize: fileInfo.getFileSize,
      getDirectorySize: fileInfo.getDirectorySize,
      showInputContextMenu: appBehavior.showInputContextMenu,
      invokeMainProcess: appBehavior.invokeMainProcess,
      downloadFile: fileFn.downloadFile,
      ensureDirectoryExists: fileInfo.ensureDirectoryExists,
      getThumbnailDataUrl: browserFn.getThumbnailDataUrl,
      getOSType: appInfo.getOSType,
      getPathSeparator: fileInfo.getPathSeparator,
      getBundledBinaryPath: appInfo.getBundledBinaryPath,
      checkInternetConnection: browserFn.checkInternetConnection,
      ffmpegWhisperTranscribe: transcribe.ffmpegWhisperTranscribe,
      onFFmpegProgress: transcribe.onFFmpegProgress,
      selectVideoFile: fileFn.selectVideoFile,
    };
  }

  if (ytdlpBridge) {
    w.ytdlp = {
      getPlaylistInfo: ytdlpBridge.getPlaylistInfo,
      getInfo: ytdlpBridge.getInfo,
      selectDownloadDirectory: ytdlpBridge.selectDownloadDirectory,
      download: ytdlpBridge.download,
      killController: ytdlpBridge.killController,
      stop: ytdlpBridge.stop,
      downloadYTDLP: ytdlpBridge.downloadYTDLP,
      getCurrentVersion: ytdlpBridge.getCurrentVersion,
      getLatestVersion: ytdlpBridge.getLatestVersion,
      checkAndUpdate: ytdlpBridge.checkAndUpdate,
      getDirectUrl: ytdlpBridge.getDirectUrl,
      readCaptionFile: ytdlpBridge.readCaptionFile,
    };
  }

  if (devTools) {
    w.electronDevTools = { toggle: devTools.toggle };
  }

  if (updateBridge) {
    w.updateAPI = {
      onUpdateAvailable: updateBridge.onUpdateAvailable,
      onYtdlpAutoUpdated: updateBridge.onYtdlpAutoUpdated,
      onYtdlpAutoInstalled: updateBridge.onYtdlpAutoInstalled,
      checkForUpdates: updateBridge.checkForUpdates,
      getCurrentVersion: updateBridge.getCurrentVersion,
    };
  }

  if (pluginBridge) {
    w.plugins = {
      list: pluginBridge.list,
      getCode: pluginBridge.getCode,
      install: pluginBridge.install,
      uninstall: pluginBridge.uninstall,
      getMenuItems: pluginBridge.getMenuItems,
      executeMenuItem: pluginBridge.executeMenuItem,
      loadUnzipped: pluginBridge.loadUnzipped,
      extractPlugin: pluginBridge.extractPlugin,
      writeFile: pluginBridge.writeFile,
      readFile: pluginBridge.readFile,
      readFileContents: pluginBridge.readFileContents,
      registerMenuItem: pluginBridge.registerMenuItem,
      unregisterMenuItem: pluginBridge.unregisterMenuItem,
      reload: pluginBridge.reload,
      onReloaded: pluginBridge.onReloaded,
      getEnabledPlugins: pluginBridge.getEnabledPlugins,
      setPluginEnabled: pluginBridge.setPluginEnabled,
      onPluginStateChanged: pluginBridge.onPluginStateChanged,
      getPluginLocation: pluginBridge.getPluginLocation,
      openPluginFolder: pluginBridge.openPluginFolder,
      registerTaskBarItem: pluginBridge.registerTaskBarItem,
      unregisterTaskBarItem: pluginBridge.unregisterTaskBarItem,
      getTaskBarItems: pluginBridge.getTaskBarItems,
      executeTaskBarItem: pluginBridge.executeTaskBarItem,
      saveFileDialog: pluginBridge.saveFileDialog,
    };
  }

  if (appControl) {
    w.appControl = {
      showWindow: appControl.showWindow,
      hideWindow: appControl.hideWindow,
      quitApp: appControl.quitApp,
      setAutoLaunch: appControl.setAutoLaunch,
      getAutoLaunch: appControl.getAutoLaunch,
      getClipboardText: appControl.getClipboardText,
      onClipboardChange: appControl.onClipboardChange,
      offClipboardChange: appControl.offClipboardChange,
      startClipboardMonitoring: appControl.startClipboardMonitoring,
      stopClipboardMonitoring: appControl.stopClipboardMonitoring,
      isClipboardMonitoringActive: appControl.isClipboardMonitoringActive,
      clearLastClipboardText: appControl.clearLastClipboardText,
      clearClipboard: appControl.clearClipboard,
      isWindowFocused: appControl.isWindowFocused,
    };
  }
}
