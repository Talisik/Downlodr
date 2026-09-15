// src/afda/types/afdaTypes.ts
import type {
  ActivityLogEntry,
  Download,
  ScheduleTime,
  SubscriptionSettings,
} from '@/skedulosa/store/skedulosaStore';
import type { AfdaWebsiteInfo } from '@/afda/backend/schema/afdaWebsiteSchema';

export type { AfdaWebsiteInfo };

export interface AfdaSubscription {
  id: string;
  source_type: 'afda';
  downloads: Download[];
  schedule_time: ScheduleTime[];
  last_checked_time: string;
  /** Display name of the section or publication. */
  source: string;
  /** Section URL used for fetching articles. */
  sourceUrl: string;
  recurring: boolean;
  status: string;
  date_created: string;
  upload_cadence: string;
  settings: SubscriptionSettings[];
  /** Website metadata fetched at subscribe time. */
  section_details?: AfdaWebsiteInfo;
  /** Chronological log of events for this subscription. */
  activity_log?: ActivityLogEntry[];
}
