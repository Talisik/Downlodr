import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePlaylistSelectionStore } from './playlistSelectionStore';

beforeEach(() => {
  usePlaylistSelectionStore.getState().reset();
  (window as any).ytdlp = { getPlaylistInfo: vi.fn() };
});

describe('loadPlaylist', () => {
  it('dedupes repeated entries by id and populates playlistVideos', async () => {
    (window as any).ytdlp.getPlaylistInfo = vi.fn(async () => ({
      data: {
        title: 'My Playlist',
        entries: [
          { id: 'v1', url: 'u1', title: 't1', channel: 'c1', thumbnails: [{ url: 'th1' }] },
          { id: 'v1', url: 'u1-dup', title: 't1-dup', channel: 'c1', thumbnails: [] },
          { id: 'v2', url: 'u2', title: 't2', channel: 'c2', thumbnails: [] },
        ],
      },
    }));

    const ok = await usePlaylistSelectionStore.getState().loadPlaylist('https://example.com/playlist');

    expect(ok).toBe(true);
    const state = usePlaylistSelectionStore.getState();
    expect(state.playlistVideos.map((v) => v.id)).toEqual(['v1', 'v2']);
    expect(state.playlistVideos[0].title).toBe('t1'); // first occurrence wins
    expect(state.videoTitle).toBe('My Playlist');
  });

  it('resets to failure state when getPlaylistInfo rejects', async () => {
    (window as any).ytdlp.getPlaylistInfo = vi.fn(async () => {
      throw new Error('network error');
    });

    const ok = await usePlaylistSelectionStore.getState().loadPlaylist('https://example.com/playlist');

    expect(ok).toBe(false);
    expect(usePlaylistSelectionStore.getState().isLoading).toBe(false);
  });
});

describe('setPlaylistData', () => {
  it('starts every video selected', () => {
    usePlaylistSelectionStore.getState().setPlaylistData({
      playlistUrl: 'u',
      videoTitle: 't',
      playlistVideos: [
        { id: 'v1', url: 'u1', title: 't1', channel: 'c1', thumbnail: '' },
        { id: 'v2', url: 'u2', title: 't2', channel: 'c2', thumbnail: '' },
      ] as any,
    });

    expect(usePlaylistSelectionStore.getState().selectedVideoIds).toEqual(new Set(['v1', 'v2']));
  });
});

describe('toggleVideo', () => {
  it('adds then removes a video from the selection', () => {
    usePlaylistSelectionStore.getState().setPlaylistData({
      playlistUrl: 'u',
      videoTitle: 't',
      playlistVideos: [{ id: 'v1', url: 'u1', title: 't1', channel: 'c1', thumbnail: '' }] as any,
    });
    usePlaylistSelectionStore.getState().toggleVideo('v1'); // deselect (starts selected)
    expect(usePlaylistSelectionStore.getState().selectedVideoIds.has('v1')).toBe(false);

    usePlaylistSelectionStore.getState().toggleVideo('v1'); // reselect
    expect(usePlaylistSelectionStore.getState().selectedVideoIds.has('v1')).toBe(true);
  });
});

describe('selectAll', () => {
  it('toggles between all-selected and none-selected', () => {
    usePlaylistSelectionStore.getState().setPlaylistData({
      playlistUrl: 'u',
      videoTitle: 't',
      playlistVideos: [
        { id: 'v1', url: 'u1', title: 't1', channel: 'c1', thumbnail: '' },
        { id: 'v2', url: 'u2', title: 't2', channel: 'c2', thumbnail: '' },
      ] as any,
    });

    usePlaylistSelectionStore.getState().selectAll(); // all -> none
    expect(usePlaylistSelectionStore.getState().selectedVideoIds.size).toBe(0);

    usePlaylistSelectionStore.getState().selectAll(); // none -> all
    expect(usePlaylistSelectionStore.getState().selectedVideoIds.size).toBe(2);
  });
});
