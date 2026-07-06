import { useEffect } from 'react';
import { useAfdaMapperStore } from '@/afda/store/afdaMapperStore';
import { useSkedulosaStore } from '@/skedulosa/store/skedulosaStore';
import { extractFqdn } from '@/afda/utils/extractFqdn';
import type { MapperResult } from '@/afda/types/mapperTypes';

/**
 * App-level owner of the AFDA mapper completion events.
 *
 * AfdaAddWebsiteModal starts the mapper but unmounts when the user leaves
 * /skedulosa (which "Run in background" on the scanning modal invites). If the
 * listeners lived in the modal, nobody would call finishChannelAnalysis()
 * after that unmount: analyzingStatus would stay 'analyzing' forever, the
 * background toast would never dismiss, and every subscribe modal (gated on
 * analyzingStatus === 'idle') would be wedged shut.
 *
 * Instead this component resolves the analysis lifecycle and stashes the
 * result in afdaMapperStore; the modal consumes it whenever it is (re)mounted.
 */
const GlobalAfdaMapperListener = () => {
  useEffect(() => {
    const bridge =
      typeof window !== 'undefined' ? (window as any).afdaBridge : undefined;
    if (!bridge?.on) return;

    // Only act on events for the run the user started from the add-website
    // flow. Stray mapper events (or ones arriving after Cancel reset the
    // analysis to 'idle') must not touch a YouTube analysis or re-wedge state.
    const matchesActiveAnalysis = (fqdn: string | undefined) => {
      const { analyzingStatus, analyzingChannel } =
        useSkedulosaStore.getState();
      return (
        !!fqdn &&
        analyzingStatus === 'analyzing' &&
        analyzingChannel !== null &&
        !analyzingChannel.isYouTube &&
        extractFqdn(analyzingChannel.url) === fqdn
      );
    };

    const unsubs: (() => void)[] = [
      bridge.on.mapperComplete((data: MapperResult) => {
        if (!matchesActiveAnalysis(data?.fqdn)) return;
        useAfdaMapperStore.getState().setPendingResult(data);
        useSkedulosaStore.getState().finishChannelAnalysis();
      }),
      bridge.on.mapperError((data: { fqdn: string; message: string }) => {
        if (!matchesActiveAnalysis(data?.fqdn)) return;
        useAfdaMapperStore.getState().setPendingError(data);
        useSkedulosaStore.getState().finishChannelAnalysis();
      }),
    ];
    return () => unsubs.forEach((fn) => fn());
  }, []);

  return null;
};

export default GlobalAfdaMapperListener;
