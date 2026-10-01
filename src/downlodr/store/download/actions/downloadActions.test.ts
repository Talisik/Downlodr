import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDownloadActions } from './downloadActions';
import { createStoreHarness } from './testUtils/storeHarness';

vi.mock('@/core-app/components/shadcn/hooks/use-toast', () => ({
  toast: vi.fn(),
}));

const addQueueMock = vi.fn();
const joinDownloadPathMock = vi.fn(
  async (loc: string, name: string) => `${loc}/${name}`,
);
const fileExistsMock = vi.fn(async () => true);
const deleteFolderMock = vi.fn(async () => true);

function fakeGet() {
  return {
    updateDownload: vi.fn(),
    forDownloads: [] as any[],
    removeFromForDownloads: vi.fn(),
    addQueue: addQueueMock,
  } as any;
}

const checkInternetConnectionMock = vi.fn(async () => true);

beforeEach(() => {
  addQueueMock.mockClear();
  joinDownloadPathMock.mockClear();
  fileExistsMock.mockClear();
  deleteFolderMock.mockClear();
  fileExistsMock.mockResolvedValue(true);
  checkInternetConnectionMock.mockReset();
  checkInternetConnectionMock.mockResolvedValue(true);
  (window as any).downlodrFunctions = {
    joinDownloadPath: joinDownloadPathMock,
    fileExists: fileExistsMock,
    deleteFolder: deleteFolderMock,
    checkInternetConnection: checkInternetConnectionMock,
  };
  (window as any).ytdlp = {
    getInfo: vi.fn(),
  };
});

vi.mock('@/downlodr/utils/metadata/formatService', () => ({
  FormatService: {
    processVideoFormats: vi.fn(async () => ({
      formatOptions: [{ formatId: 'best', fileExtension: 'mp4', label: 'Best' }],
      defaultFormatId: 'best',
      defaultExt: 'mp4',
    })),
  },
}));
vi.mock('@/downlodr/store/playlistSelectionStore', () => ({
  usePlaylistSelectionStore: {
    getState: () => ({ setPendingPlaylistUrl: vi.fn() }),
  },
}));
vi.mock('@/downlodr/utils/download/infoFetchQueue', () => ({
  acquireInfoFetchSlot: vi.fn(async () => undefined),
  releaseInfoFetchSlot: vi.fn(),
}));
// Only startForDownload's path (queueForDownload) reaches processFileName, and
// it imports the download store — closing the
// downloadStore -> downloadActions -> filterName -> downloadStore cycle that
// controller.test.ts documents. Uniquifying a filename is its own unit.
vi.mock('@/downlodr/utils/download/filterName', () => ({
  processFileName: vi.fn(async (_base: string, name: string) => name),
}));

/**
 * `setDownload` reads live state via `get().forDownloads` and calls
 * `get().removeFromForDownloads(...)` on error paths. The static `fakeGet()`
 * object above can't support that, so this builds a `get` *function* (as the
 * real store provides) that re-reads the harness's current state on every
 * call, with an injectable `removeFromForDownloads` spy so tests can assert
 * on it directly.
 */
function createLiveGet(
  harness: ReturnType<typeof createStoreHarness>,
  overrides: Partial<ReturnType<typeof fakeGet>> = {},
) {
  return () => ({
    ...fakeGet(),
    forDownloads: harness.getState().forDownloads,
    ...overrides,
  });
}

const basePayload = {
  videoUrl: 'https://example.com/v1',
  name: 'My Video',
  downloadName: 'My Video',
  displayName: 'My Video',
  size: 0,
  speed: '',
  channelName: '',
  timeLeft: '',
  DateAdded: '',
  progress: 0,
  location: 'C:/dl',
  status: 'to download',
  ext: 'mp4',
  formatId: '',
  audioExt: '',
  audioFormatId: '',
  extractorKey: '',
  limitRate: '',
  automaticCaption: null,
  thumbnails: null,
  getTranscript: false,
  getThumbnail: false,
  duration: 0,
  isCreateFolder: false,
  thumnailsLocation: '',
  autoCaptionLocation: '',
} as any;

describe('addDownload (adding a download)', () => {
  it('forwards the payload to addQueue when location and downloadName are present', async () => {
    const harness = createStoreHarness();
    const actions = createDownloadActions(harness.set, fakeGet);

    await actions.addDownload(basePayload);

    expect(addQueueMock).toHaveBeenCalledTimes(1);
    expect(addQueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        videoUrl: basePayload.videoUrl,
        name: basePayload.name,
        location: basePayload.location,
      }),
    );
  });

  it('does nothing when location is missing', async () => {
    const harness = createStoreHarness();
    const actions = createDownloadActions(harness.set, fakeGet);

    await actions.addDownload({ ...basePayload, location: '' });

    expect(addQueueMock).not.toHaveBeenCalled();
  });

  it('keeps the favorite when a paused download is resumed (re-added)', async () => {
    const harness = createStoreHarness();
    const actions = createDownloadActions(harness.set, fakeGet);

    await actions.addDownload({ ...basePayload, favorited: true });

    expect(addQueueMock).toHaveBeenCalledWith(
      expect.objectContaining({ favorited: true }),
    );
  });
});

describe('retryDownload (retrying a download)', () => {
  it('deletes the stale per-download subfolder before re-queueing when isCreateFolder is true and the folder exists', async () => {
    const harness = createStoreHarness();
    const actions = createDownloadActions(harness.set, fakeGet);

    await actions.retryDownload({ ...basePayload, isCreateFolder: true });

    expect(joinDownloadPathMock).toHaveBeenCalledWith('C:/dl', 'My Video');
    expect(fileExistsMock).toHaveBeenCalled();
    expect(deleteFolderMock).toHaveBeenCalledWith('C:/dl/My Video');
    expect(addQueueMock).toHaveBeenCalledTimes(1);
  });

  it('skips deleteFolder when the subfolder does not exist, but still re-queues', async () => {
    fileExistsMock.mockResolvedValue(false);
    const harness = createStoreHarness();
    const actions = createDownloadActions(harness.set, fakeGet);

    await actions.retryDownload({ ...basePayload, isCreateFolder: true });

    expect(deleteFolderMock).not.toHaveBeenCalled();
    expect(addQueueMock).toHaveBeenCalledTimes(1);
  });

  it('skips the folder check entirely when isCreateFolder is false', async () => {
    const harness = createStoreHarness();
    const actions = createDownloadActions(harness.set, fakeGet);

    await actions.retryDownload({ ...basePayload, isCreateFolder: false });

    expect(joinDownloadPathMock).not.toHaveBeenCalled();
    expect(deleteFolderMock).not.toHaveBeenCalled();
    expect(addQueueMock).toHaveBeenCalledTimes(1);
  });
});

describe('renameDownload / updateDownloadStatus', () => {
  it('renameDownload updates name and displayName only for the matching forDownloads entry', () => {
    const harness = createStoreHarness({
      forDownloads: [
        { ...basePayload, id: 'd1' } as any,
        { ...basePayload, id: 'd2' } as any,
      ],
    });
    const actions = createDownloadActions(harness.set, fakeGet);

    actions.renameDownload('d1', 'Renamed');

    const [d1, d2] = harness.getState().forDownloads;
    expect(d1.name).toBe('Renamed');
    expect(d1.displayName).toBe('Renamed');
    expect(d2.name).toBe('My Video');
  });

  it('updateDownloadStatus updates status only for the matching downloading entry', () => {
    const harness = createStoreHarness({
      downloading: [
        { ...basePayload, id: 'd1', status: 'downloading' } as any,
        { ...basePayload, id: 'd2', status: 'downloading' } as any,
      ],
    });
    const actions = createDownloadActions(harness.set, fakeGet);

    actions.updateDownloadStatus('d1', 'paused');

    const [d1, d2] = harness.getState().downloading;
    expect(d1.status).toBe('paused');
    expect(d2.status).toBe('downloading');
  });
});

describe('setDownload (the URL-to-download entry point)', () => {
  it('does nothing when location is missing', async () => {
    const harness = createStoreHarness();
    const actions = createDownloadActions(harness.set, createLiveGet(harness));

    const id = await actions.setDownload('https://example.com/v1', '', '');

    expect(id).toBeUndefined();
    expect(harness.getState().forDownloads).toEqual([]);
  });

  it('creates a forDownloads entry, then fills it in with metadata on success', async () => {
    (window as any).ytdlp.getInfo = vi.fn(async () => ({
      data: {
        title: 'My Video',
        channel: 'My Channel',
        upload_date: '20240115',
        duration: 120,
        extractor_key: 'Youtube',
      },
    }));
    const harness = createStoreHarness();
    const actions = createDownloadActions(harness.set, createLiveGet(harness));

    const id = await actions.setDownload('https://example.com/v1', 'C:/dl', '');

    expect(id).toBeTruthy();
    const entry = harness.getState().forDownloads.find((d) => d.id === id);
    expect(entry).toBeTruthy();
    expect(entry?.status).toBe('to download');
    expect(entry?.name).toBe('My Video');
    expect(entry?.displayName).toBe('My Video');
    expect(entry?.channelName).toBe('My Channel');
    expect(entry?.extractorKey).toBe('Youtube');
    expect(entry?.ext).toBe('mp4');
    expect(entry?.formatId).toBe('best');
    expect(entry?.duration).toBe(120);
    expect(entry?.location).toBe('C:/dl');
  });

  it('routes a playlist URL to the selection page instead of failing', async () => {
    (window as any).ytdlp.getInfo = vi.fn(async () => {
      throw new Error('PLAYLIST_URL:12:something');
    });
    const harness = createStoreHarness();
    const removeFromForDownloads = vi.fn();
    const actions = createDownloadActions(
      harness.set,
      createLiveGet(harness, { removeFromForDownloads }),
    );

    const id = await actions.setDownload('https://example.com/playlist', 'C:/dl', '');

    expect(id).toBeTruthy();
    expect(removeFromForDownloads).toHaveBeenCalledWith(id);
  });

  it('sets a metadata_error status and removes the entry for an unsupported site', async () => {
    (window as any).ytdlp.getInfo = vi.fn(async () => {
      throw new Error('UNSUPPORTED_SITE');
    });
    const harness = createStoreHarness();
    const removeFromForDownloads = vi.fn();
    const actions = createDownloadActions(
      harness.set,
      createLiveGet(harness, { removeFromForDownloads }),
    );

    const id = await actions.setDownload('https://example.com/v1', 'C:/dl', '');

    expect(removeFromForDownloads).toHaveBeenCalledWith(id);
    const entry = harness.getState().forDownloads.find((d) => d.id === id);
    expect(entry?.status).toBe('metadata_error');
    expect(entry?.error).toBe('This site is not supported by yt-dlp');
  });

  it('reports a site that blocked the request instead of "invalid URL"', async () => {
    (window as any).ytdlp.getInfo = vi.fn(async () => {
      throw new Error('BLOCKED_BY_SITE: Cloudflare');
    });
    const harness = createStoreHarness();
    const removeFromForDownloads = vi.fn();
    const actions = createDownloadActions(
      harness.set,
      createLiveGet(harness, { removeFromForDownloads }),
    );

    const id = await actions.setDownload('https://example.com/v1', 'C:/dl', '');

    const entry = harness.getState().forDownloads.find((d) => d.id === id);
    expect(entry?.status).toBe('metadata_error');
    expect(entry?.error).toBe('The site blocked the request (bot protection)');
  });
});

describe('startForDownload (starting a row already in the list)', () => {
  const row = {
    ...basePayload,
    id: 'f1',
    ext: 'mp4',
    formatId: '137',
  } as any;

  it('moves a to-download row into the run queue', async () => {
    const harness = createStoreHarness({ forDownloads: [row] });
    const removeFromForDownloads = vi.fn();
    const actions = createDownloadActions(
      harness.set,
      createLiveGet(harness, { removeFromForDownloads }),
    );

    const result = await actions.startForDownload('f1');

    expect(result).toEqual({ ok: true });
    expect(addQueueMock).toHaveBeenCalledTimes(1);
    expect(addQueueMock.mock.calls[0][0]).toMatchObject({
      videoUrl: row.videoUrl,
      status: 'queued',
      formatId: '137',
    });
    expect(removeFromForDownloads).toHaveBeenCalledWith('f1');
  });

  it('reports an unknown id instead of queueing nothing silently', async () => {
    const harness = createStoreHarness({ forDownloads: [row] });
    const actions = createDownloadActions(harness.set, createLiveGet(harness));

    expect(await actions.startForDownload('nope')).toEqual({
      error: 'No to-download row with id nope.',
    });
    expect(addQueueMock).not.toHaveBeenCalled();
  });

  it('refuses a row whose format was never resolved', async () => {
    // The filename is built from `ext || audioExt`. With neither, the row
    // would land on disk as "My Video.undefined".
    const harness = createStoreHarness({
      forDownloads: [{ ...row, ext: '', audioExt: '', formatId: '' }],
    });
    const actions = createDownloadActions(harness.set, createLiveGet(harness));

    expect(await actions.startForDownload('f1')).toEqual({
      error:
        'That row has no format selected yet, so it cannot be started. ' +
        'The user picks a format on the row in Downlodr.',
    });
    expect(addQueueMock).not.toHaveBeenCalled();
  });

  it('passes a speed limit through to the queued row', async () => {
    const harness = createStoreHarness({ forDownloads: [row] });
    const actions = createDownloadActions(harness.set, createLiveGet(harness));

    await actions.startForDownload('f1', '5M');

    expect(addQueueMock.mock.calls[0][0]).toMatchObject({ limitRate: '5M' });
  });
});

describe('retryDownload keeps the favorite', () => {
  it('forwards favorited to addQueue', async () => {
    const harness = createStoreHarness();
    const actions = createDownloadActions(harness.set, fakeGet);

    await actions.retryDownload({
      ...basePayload,
      isCreateFolder: false,
      favorited: true,
    });

    expect(addQueueMock).toHaveBeenCalledWith(
      expect.objectContaining({ favorited: true }),
    );
  });
});
