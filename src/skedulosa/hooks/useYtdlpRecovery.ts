import { useEffect } from 'react';
import { ytdlpRecoveryService } from '@/skedulosa/utils/ytdlpRecoveryService';

/**
 * Cleanup hook: stops the ytdlpRecoveryService timer when the Skedulosa
 * section unmounts. The service is started by showScrapeErrors when a
 * yt-dlp error is detected — this hook only handles teardown.
 *
 * Mount once at the App level alongside useSkedulosaDownloadBridge.
 */
export function useYtdlpRecovery(): void {
  useEffect(() => {
    return () => {
      ytdlpRecoveryService.stop();
    };
  }, []);
}
