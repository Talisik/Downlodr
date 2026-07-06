import { useEffect } from 'react';
import { useAfdaWebsitesStore } from '@/afda/store/afdaWebsitesStore';

export function useAfdaWebsitesInit() {
  const hydrate = useAfdaWebsitesStore((s) => s.hydrate);

  useEffect(() => {
    const bridge = typeof window !== 'undefined' ? (window as any).afdaBridge : undefined;
    if (!bridge) return;

    bridge.store.getAll()
      .then((websites: unknown[]) => hydrate(websites as any))
      .catch((err: unknown) => console.error('[afda] Failed to load websites:', err));
  }, []);
}
