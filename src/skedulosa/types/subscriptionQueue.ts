import type {
  SubscriptionChannelDetails,
} from '@/skedulosa/store/skedulosaStore';

/**
 * All form data captured at the moment the user clicks "Subscribe".
 * Nothing from the toolkit DB — those IDs are assigned during queue processing.
 */
export type QueuedSubscriptionData = {
  channelName: string;
  sourceURL: string;
  /** 'auto-detect' | 'manual' */
  selectedFrequency: string;
  /** Day abbreviations e.g. ['mon', 'wed'] */
  selectedDays: string[];
  saveToPath: string;
  /** App-level default location snapshot — used when saveToPath is empty */
  defaultLocation: string;
  qualityPreset: string;
  /** Hour of day as a string e.g. '6' */
  checkAtHour: string;
  firstScrapeLimit: number;
  /** Raw video list from analyzeChannelSchedule — seeds the intelligent scheduler */
  analysisVideos: unknown[];
  /** Flattened from channelAnalysis.intelligentPrediction — null when not available */
  intelligentPrediction: {
    nextScrapeTime: string;
    pattern: string;
    confidence: number;
    expectedVideos: number;
    isErratic: boolean;
  } | null;
  /** Channel avatar/subscriber info — null if the details fetch failed (non-fatal) */
  channelDetails: SubscriptionChannelDetails | null;
  /** Callback the parent component passed to the modal — called after Zustand store registration (toolkit DB errors are non-fatal and do not prevent this callback) */
  onSubscriptionCreated?: (channelName: string, subscriptionId: string) => void;
};
