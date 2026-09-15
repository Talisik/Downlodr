import { useCallback, useState } from 'react';
import { useDownloadStore } from '@/downlodr/store/downloadStore';

export type AutoTagState = 'idle' | 'running' | 'done' | 'error';

export interface UseAutoTagReturn {
  state: AutoTagState;
  error: string | null;
  tagDownloads: (ids?: string[]) => Promise<void>;
}

export function useAutoTag(): UseAutoTagReturn {
  const [state, setState] = useState<AutoTagState>('idle');
  const [error, setError] = useState<string | null>(null);
  const applyAutoTags = useDownloadStore((s) => s.applyAutoTags);

  const tagDownloads = useCallback(
    async (ids?: string[]) => {
      const store = useDownloadStore.getState();
      const pool = [...store.finishedDownloads, ...store.historyDownloads];
      const selected = ids ? pool.filter((d) => ids.includes(d.id)) : pool;

      const inputs = selected.map((d) => ({
        id: d.id,
        title: d.name || d.displayName || '',
        description: d.description,
        channel: d.channelName,
        category: d.nativeCategory,
        artist: d.musicArtist,
        track: d.musicTrack,
        album: d.musicAlbum,
        transcriptLocation: d.transcriptLocation,
      }));
      if (inputs.length === 0) return;

      setState('running');
      setError(null);
      try {
        const res = await window.autoTagBridge.run(inputs);
        if (res.ok) {
          applyAutoTags(res.results);
          setState('done');
          return;
        }
        setError((res as { message: string }).message);
        setState('error');
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setState('error');
      }
    },
    [applyAutoTags],
  );

  return { state, error, tagDownloads };
}
