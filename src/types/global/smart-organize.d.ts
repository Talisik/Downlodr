/* eslint-disable prettier/prettier */
/** Smart Organize and auto-tagging. */
import type {
  SmartOrganizeDownloadInput,
  SmartOrganizeHandlerResult,
  SmartOrganizeProgress,
} from '@/smart-organize/schema/smartOrganizeTypes';

declare global {
  interface Window {
    /** Smart Organize — ML-powered video categorization (smartOrganizeBridge) */
    smartOrganizeBridge: {
      start: (downloads: SmartOrganizeDownloadInput[]) => Promise<SmartOrganizeHandlerResult>;
      cancel: () => void;
      onProgress: (callback: (progress: SmartOrganizeProgress) => void) => () => void;
    };

    /** Auto-tagging (tagBridge) — see src/auto-tag */
    autoTagBridge: {
      run: (
        inputs: {
          id: string;
          title: string;
          description?: string;
          channel?: string;
          category?: string;
          artist?: string;
          track?: string;
          album?: string;
          transcriptLocation?: string;
        }[],
      ) => Promise<
        | { ok: true; results: { id: string; tags: string[]; tier: 1 | 2 }[] }
        | { ok: false; message: string }
      >;
    };
  }
}
