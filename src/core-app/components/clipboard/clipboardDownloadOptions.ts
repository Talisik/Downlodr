import { useSettingStore } from '@/core-app/store/settingsStore';
import { useTaskbarDownloadStore } from '@/downlodr/store/taskbarDownloadStore';

/**
 * The download options for a link picked up from the clipboard — the same
 * choices the taskbar input would use (captions, thumbnail, folder), read at
 * the moment the link is detected.
 *
 * Read from the stores rather than from component state: the clipboard
 * listener is registered once and keeps the closure it was created with, so
 * anything captured at mount (the old hard-coded getTranscript: false, the
 * folder from the first render) never follows later changes.
 */
export function getClipboardDownloadOptions() {
  const { settings } = useSettingStore.getState();
  const { getTranscript, getThumbnail, downloadFolder } =
    useTaskbarDownloadStore.getState();

  return {
    folder: downloadFolder || settings.defaultLocation,
    limitRate:
      settings.defaultDownloadSpeed === 0
        ? ''
        : `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`,
    options: { getTranscript, getThumbnail },
  };
}
