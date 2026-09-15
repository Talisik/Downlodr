import { useEffect } from 'react';
import {
  useAfdaWebsitesStore,
  socialSourceToWebsite,
} from '@/afda/store/afdaWebsitesStore';

export function useAfdaWebsitesInit() {
  const hydrate = useAfdaWebsitesStore((s) => s.hydrate);
  const hydrateSocial = useAfdaWebsitesStore((s) => s.hydrateSocial);

  useEffect(() => {
    const bridge =
      typeof window !== 'undefined' ? (window as any).afdaBridge : undefined;
    if (!bridge) return;

    const load = () => {
      bridge.store
        .getAll()
        .then((websites: unknown[]) => hydrate(websites as any))
        .catch((err: unknown) =>
          console.error('[afda] Failed to load websites:', err),
        );

      // Social sources come from a separate backend table — load + merge them in.
      // Tolerant of older addons where social.sources isn't exposed.
      bridge.social?.sources
        ?.list?.()
        .then((rows: unknown) => {
          if (Array.isArray(rows)) {
            hydrateSocial(rows.map((r) => socialSourceToWebsite(r as never)));
          }
        })
        .catch((err: unknown) =>
          console.error('[afda] Failed to load social sources:', err),
        );
    };

    load();

    // Add-on handlers register after first paint (deferred init); the
    // mount-time load can race ahead of them. Reload once ready.
    const unsubReady = (window as any).addonBridge?.on?.servicesReady?.(load);

    // Re-hydrate when the main process pushes an update (e.g. after chat adds a website)
    const unsub = bridge.on.storeHydrate?.((data: { websites: any[] }) => {
      if (Array.isArray(data?.websites)) hydrate(data.websites);
    });
    return () => {
      unsub?.();
      unsubReady?.();
    };
  }, []);
}
