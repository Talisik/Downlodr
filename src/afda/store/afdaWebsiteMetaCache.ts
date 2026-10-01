import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  useAfdaWebsitesStore,
  type WebsiteListItem,
} from '@/afda/store/afdaWebsitesStore';

// The live websites store starts empty every launch and is only filled once
// the AFDA worker is up — on a cold first launch after install/update, or when
// the add-on is outdated and the worker never starts, that leaves persisted
// article rows with nothing to resolve their subscriptionId against (so they
// render the raw id and a default icon). This cache remembers the last known
// display info per website so those rows render correctly immediately.
//
// localStorage (not IndexedDB like articleDownloadStore) on purpose: it
// rehydrates synchronously, so the cache is ready on the very first render.

export interface AfdaWebsiteMeta {
  name: string;
  url: string;
  kind?: WebsiteListItem['kind'];
}

interface AfdaWebsiteMetaCacheStore {
  meta: Record<string, AfdaWebsiteMeta>;
  upsert: (websites: WebsiteListItem[]) => void;
}

export const useAfdaWebsiteMetaCache = create<AfdaWebsiteMetaCacheStore>()(
  persist(
    (set) => ({
      meta: {},

      upsert: (websites) =>
        set((s) => {
          let changed = false;
          const next = { ...s.meta };
          for (const w of websites) {
            const prev = next[w.id];
            if (
              prev &&
              prev.name === w.name &&
              prev.url === w.url &&
              prev.kind === w.kind
            ) {
              continue;
            }
            next[w.id] = { name: w.name, url: w.url, kind: w.kind };
            changed = true;
          }
          return changed ? { meta: next } : s;
        }),
    }),
    {
      name: 'afda-website-meta-cache',
      partialize: (s) => ({ meta: s.meta }),
    },
  ),
);

// Only ever upsert — entries are never pruned, even on delete. Article rows can
// outlive their website in the Downloads list and should keep its name rather
// than fall back to the id; each entry is a few bytes, and a reused id is
// simply overwritten by the live entry on the next upsert.
useAfdaWebsitesStore.subscribe((state, prev) => {
  if (state.websites !== prev.websites) {
    useAfdaWebsiteMetaCache.getState().upsert(state.websites);
  }
});

/**
 * Display info for a website: the live store entry when loaded, otherwise the
 * last cached name/url/kind. Returns undefined only for a website never seen.
 */
export function useAfdaWebsiteDisplay(
  websiteId: string | undefined,
): AfdaWebsiteMeta | undefined {
  const live = useAfdaWebsitesStore((s) =>
    websiteId ? s.websites.find((w) => w.id === websiteId) : undefined,
  );
  const cached = useAfdaWebsiteMetaCache((s) =>
    websiteId ? s.meta[websiteId] : undefined,
  );
  if (live) return { name: live.name, url: live.url, kind: live.kind };
  return cached;
}
