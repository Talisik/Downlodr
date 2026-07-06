import { create } from 'zustand';
import type { MapperResult } from '@/afda/types/mapperTypes';

/**
 * Holds a finished mapper run until AfdaAddWebsiteModal consumes it — the AFDA
 * counterpart of skedulosaStore's pendingAnalysisData. The modal unmounts when
 * the user leaves /skedulosa (e.g. "Run in background" on the scanning modal),
 * so completion must be stashed somewhere that survives the unmount.
 * Not persisted.
 */
interface AfdaMapperState {
  pendingResult: MapperResult | null;
  pendingError: { fqdn: string; message: string } | null;
  setPendingResult: (result: MapperResult) => void;
  setPendingError: (error: { fqdn: string; message: string }) => void;
  clearPending: () => void;
}

export const useAfdaMapperStore = create<AfdaMapperState>((set) => ({
  pendingResult: null,
  pendingError: null,
  setPendingResult: (result) =>
    set({ pendingResult: result, pendingError: null }),
  setPendingError: (error) => set({ pendingError: error, pendingResult: null }),
  clearPending: () => set({ pendingResult: null, pendingError: null }),
}));
