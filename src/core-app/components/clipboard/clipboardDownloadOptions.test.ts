import { beforeEach, describe, expect, it } from 'vitest';
import { useSettingStore } from '@/core-app/store/settingsStore';
import { useTaskbarDownloadStore } from '@/downlodr/store/taskbarDownloadStore';
import { getClipboardDownloadOptions } from './clipboardDownloadOptions';

const setSettings = (patch: Record<string, unknown>) =>
  useSettingStore.setState((s) => ({ settings: { ...s.settings, ...patch } }));

describe('getClipboardDownloadOptions', () => {
  beforeEach(() => {
    setSettings({
      defaultLocation: 'C:/Default',
      defaultDownloadSpeed: 0,
      defaultDownloadSpeedBit: 'KB',
    });
    useTaskbarDownloadStore.setState({
      getTranscript: true,
      getThumbnail: true,
      downloadFolder: 'C:/Default',
    });
  });

  it('uses the captions and thumbnail choices from the input', () => {
    useTaskbarDownloadStore.setState({
      getTranscript: false,
      getThumbnail: false,
    });
    expect(getClipboardDownloadOptions().options).toEqual({
      getTranscript: false,
      getThumbnail: false,
    });

    useTaskbarDownloadStore.setState({ getTranscript: true });
    expect(getClipboardDownloadOptions().options.getTranscript).toBe(true);
  });

  it('uses the folder currently chosen in the input', () => {
    useTaskbarDownloadStore.setState({ downloadFolder: 'D:/Picked' });
    expect(getClipboardDownloadOptions().folder).toBe('D:/Picked');
  });

  it('falls back to the Settings location when the input has none', () => {
    useTaskbarDownloadStore.setState({ downloadFolder: '' });
    setSettings({ defaultLocation: 'E:/FromSettings' });
    expect(getClipboardDownloadOptions().folder).toBe('E:/FromSettings');
  });

  it('reads the speed limit at call time', () => {
    expect(getClipboardDownloadOptions().limitRate).toBe('');
    setSettings({ defaultDownloadSpeed: 500, defaultDownloadSpeedBit: 'KB' });
    expect(getClipboardDownloadOptions().limitRate).toBe('500KB');
  });
});
