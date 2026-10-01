import { useEffect } from 'react';
import {
  useAfdaWebsitesStore,
  socialSourceToWebsite,
} from '@/afda/store/afdaWebsitesStore';
// Side-effect import: registers the cache's subscription to the websites store
// before the first hydrate lands, regardless of which pages import it.
import '@/afda/store/afdaWebsiteMetaCache';

export function useAfdaWebsitesInit() {
  const hydrate = useAfdaWebsitesStore((s) => s.hydrate);
  const hydrateSocial = useAfdaWebsitesStore((s) => s.hydrateSocial);
  const setLoaded = useAfdaWebsitesStore((s) => s.setLoaded);

  useEffect(() => {
    const bridge =
      typeof window !== 'undefined' ? (window as any).afdaBridge : undefined;
    if (!bridge) return;

    const load = () => {
      const websitesLoad = bridge.store
        .getAll()
        .then((websites: unknown[]) => {
          hydrate(websites as any);
          return true;
        })
        .catch((err: unknown) => {
          console.error('[afda] Failed to load websites:', err);
          return false;
        });

      // Social sources come from a separate backend table — load + merge them in.
      // Tolerant of older addons where social.sources isn't exposed.
      const socialLoad = Promise.resolve(bridge.social?.sources?.list?.())
        .then((rows: unknown) => {
          if (Array.isArray(rows)) {
            hydrateSocial(rows.map((r) => socialSourceToWebsite(r as never)));
          }
        })
        .catch((err: unknown) =>
          console.error('[afda] Failed to load social sources:', err),
        );

      // Only mark loaded once both have settled, so a social row doesn't flash
      // its raw id while the article load finishes first. A failed social load
      // (older add-on) still counts — it won't succeed on retry either.
      void Promise.all([websitesLoad, socialLoad]).then(([websitesOk]) => {
        if (websitesOk) setLoaded();
      });
    };

    load();

    // Add-on handlers register after first paint (deferred init); the
    // mount-time load can race ahead of them. Reload once ready.
    const unsubReady = (window as any).addonBridge?.on?.servicesReady?.(load);
    // The AFDA worker boots separately and can finish after services-ready,
    // which would leave both loads above failed (social sources never
    // recover — store:hydrate only carries article websites). Reload once
    // the worker is actually up.
    const unsubAfdaReady = bridge.on.ready?.(load);

    // Re-hydrate when the main process pushes an update (e.g. after chat adds a website)
    const unsub = bridge.on.storeHydrate?.((data: { websites: any[] }) => {
      if (Array.isArray(data?.websites)) hydrate(data.websites);
    });
    return () => {
      unsub?.();
      unsubReady?.();
      unsubAfdaReady?.();
    };
  }, []);
}
