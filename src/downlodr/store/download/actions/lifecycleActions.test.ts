import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createLifecycleActions } from './lifecycleActions';
import { createStoreHarness } from './testUtils/storeHarness';

const { restartLiveDownloadMock } = vi.hoisted(() => ({
  restartLiveDownloadMock: vi.fn(),
}));

vi.mock('../controller', () => ({
  DownloadController: {
    getInstance: () => ({ restartLiveDownload: restartLiveDownloadMock }),
  },
}));
vi.mock('@/skedulosa/services/subscriptionDownloadSync', () => ({
  subscriptionDownloadSync: { onDownloadCompleted: vi.fn(), syncDownloadStatus: vi.fn() },
}));
vi.mock('@/skedulosa/store/skedulosaStore', () => ({
  useSkedulosaStore: { getState: () => ({ updateSubscriptionDownload: vi.fn() }) },
}));
vi.mock('@/auto-tag/queue/autoTagQueue', () => ({
  enqueueTier1: vi.fn(),
  enqueueTier2: vi.fn(),
}));
vi.mock('@/core-app/client/config', () => ({ config: { telemetry: { endpoint: 'https://x' } } }));
vi.mock('@/core-app/telemetry/utils/telemetryService', () => ({
  TelemetryService: class {
    async init() {}
    async sendDownloadError() {}
  },
}));

const baseDownloading = {
  id: 'd1',
  videoUrl: '',
  name: 'Video 1',
  downloadName: 'Video 1',
  channelName: '',
  size: 0,
  speed: '',
  timeLeft: '',
  DateAdded: '',
  progress: 0,
  location: '',
  status: 'downloading',
  ext: '',
  tags: [],
  category: [],
  extractorKey: '',
  formatId: '',
  audioExt: '',
  audioFormatId: '',
  isLive: false,
  automaticCaption: null,
  thumbnails: null,
  getTranscript: false,
  getThumbnail: false,
  duration: 0,
  completionCount: 0,
} as any;

/**
 * Creates a get function that includes the required stub methods
 * (checkFinishedDownloads, processQueue, checkStalledDownloads) so that
 * the completion branch's scheduled setTimeout callbacks don't throw
 * when they fire.
 */
function createGetWithStubs(harness: ReturnType<typeof createStoreHarness>) {
  return () => ({
    ...harness.get(),
    checkFinishedDownloads: vi.fn(),
    processQueue: vi.fn(),
    checkStalledDownloads: vi.fn(),
  });
}

describe('updateDownload — completion branch', () => {
  it('marks a download finished on exit code 0', () => {
    const harness = createStoreHarness({ downloading: [{ ...baseDownloading }] });
    const actions = createLifecycleActions(harness.set, createGetWithStubs(harness) as any);

    actions.updateDownload('d1', {
      type: 'completion',
      data: { log: 'done', exitCode: 0 },
    });

    expect(harness.getState().downloading[0].status).toBe('finished');
  });

  it('marks a non-live download failed on a non-zero exit code', () => {
    const harness = createStoreHarness({ downloading: [{ ...baseDownloading }] });
    const actions = createLifecycleActions(harness.set, createGetWithStubs(harness) as any);

    actions.updateDownload('d1', {
      type: 'completion',
      data: { log: 'boom', exitCode: 1 },
    });

    expect(harness.getState().downloading[0].status).toBe('failed');
  });

  it('keeps a live download in "downloading" status and schedules a retry instead of failing immediately', () => {
    const harness = createStoreHarness({
      downloading: [{ ...baseDownloading, isLive: true, liveRetryCount: 0 }],
    });
    const actions = createLifecycleActions(harness.set, createGetWithStubs(harness) as any);

    actions.updateDownload('d1', {
      type: 'completion',
      data: { log: 'stream blip', exitCode: 1 },
    });

    expect(harness.getState().downloading[0].status).toBe('downloading');
  });

  it('never auto-retries a live download the user asked to finish', () => {
    vi.useFakeTimers();
    restartLiveDownloadMock.mockClear();
    const harness = createStoreHarness({
      downloading: [
        {
          ...baseDownloading,
          isLive: true,
          liveRetryCount: 0,
          isFinishingRecording: true,
        },
      ],
    });
    const actions = createLifecycleActions(harness.set, createGetWithStubs(harness) as any);

    actions.updateDownload('d1', {
      type: 'completion',
      data: { log: 'Interrupted by user', exitCode: 1 },
    });
    vi.runAllTimers();
    vi.useRealTimers();

    expect(restartLiveDownloadMock).not.toHaveBeenCalled();
    expect(harness.getState().downloading[0].status).not.toBe('downloading');
  });
});
