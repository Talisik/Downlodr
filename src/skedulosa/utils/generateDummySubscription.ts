import type { AfdaSubscription } from '@/afda/types/afdaTypes';
import type {
  Download,
  ScheduleDay,
  ScheduleTime,
  Subscription,
  SubscriptionSettings,
} from '@/skedulosa/store/skedulosaStore';

const SOURCES = ['youtube', 'vimeo', 'twitch', 'rumble', 'odysee'] as const;
const STATUSES = ['Active', 'Paused', 'Error', 'Needs Attention'] as const;
const DOWNLOAD_STATUSES = [
  'completed',
  'downloading',
  'pending',
  'failed',
] as const;
const QUALITIES = ['Best Quality', '1080p', '720p', '480p', 'Audio only'];
const FREQUENCIES = ['6 Hours', '12 Hours', 'Daily', 'Every 2 days', 'Weekly'];
const LOOKBACK_PERIODS = ['1 day', '3 days', '7 days', '14 days', '30 days'];
const SAVE_LOCATIONS = [
  'C:\\Downloads\\Videos',
  'D:\\Media\\Skedulosa',
  '/home/user/Downloads',
  '~/Videos/skedulosa',
];
const FILE_NAMING = [
  '%(title)s.%(ext)s',
  '%(uploader)s - %(title)s.%(ext)s',
  '%(title)s [%(id)s].%(ext)s',
];
const PRIORITIES = ['high', 'normal', 'low'];
const UPLOAD_CADENCES = [
  'Daily',
  '2-3 per week',
  'Weekly',
  'Irregular',
  'Multiple per day',
];
const CHANNEL_NAME_PREFIXES = [
  'Tech',
  'Gaming',
  'Music',
  'Vlog',
  'News',
  'Tutorial',
  'Comedy',
  'Science',
];
const CHANNEL_NAME_SUFFIXES = [
  'Channel',
  'Hub',
  'Show',
  'Daily',
  'Studio',
  'Live',
  'Central',
];

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 11)}`;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: readonly T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function randomPastDate(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  return d.toISOString();
}

function randomSize(): string {
  const value = (Math.random() * 900 + 100).toFixed(1);
  const unit = pick(['MB', 'GB']);
  return `${value} ${unit}`;
}

function randomSpeed(): string {
  const value = (Math.random() * 8 + 0.5).toFixed(1);
  return `${value} MB/s`;
}

const ALL_DAYS: ScheduleDay[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

function generateDummyDownload(): Download {
  return {
    id: randomId(),
    status: pick(DOWNLOAD_STATUSES),
    name: `Video_${randomId().slice(0, 8)}.mp4`,
    thumbnail_location: `https://i.ytimg.com/vi/${randomId().slice(
      0,
      11,
    )}/default.jpg`,
    size: randomSize(),
    speed: randomSpeed(),
    date_added: randomPastDate(30),
  };
}

function generateDummySettings(): SubscriptionSettings {
  return {
    frequency: pick(FREQUENCIES),
    download_quality: pick(QUALITIES),
    save_location: pick(SAVE_LOCATIONS),
    download_priority: pick(PRIORITIES),
    lookback_period: pick(LOOKBACK_PERIODS),
    file_naming_format: pick(FILE_NAMING),
  };
}

function generateDummyScheduleTime(): ScheduleTime[] {
  const count = Math.floor(Math.random() * 4) + 1;
  return pickN(ALL_DAYS, count).map((day) => ({ day }));
}

function generateDummyChannelName(): string {
  const prefix = pick(CHANNEL_NAME_PREFIXES);
  const suffix = pick(CHANNEL_NAME_SUFFIXES);
  const num = Math.floor(Math.random() * 999) + 1;
  return `${prefix} ${suffix} ${num}`;
}

const ARTICLE_SECTION_NAMES = [
  'Tech News',
  'Science Weekly',
  'World Affairs',
  'Business Insights',
  'Health & Wellness',
  'Entertainment Digest',
  'Sports Roundup',
  'Culture & Arts',
];
const ARTICLE_SITES = [
  'reuters.com',
  'bbc.com',
  'techcrunch.com',
  'theverge.com',
  'wired.com',
  'arstechnica.com',
  'nytimes.com',
  'theguardian.com',
];

function generateDummyArticleDownload(): Download {
  const site = pick(ARTICLE_SITES);
  return {
    id: randomId(),
    status: pick(DOWNLOAD_STATUSES),
    name: `Article_${randomId().slice(0, 8)}.pdf`,
    thumbnail_location: `https://${site}/favicon.ico`,
    size: `${(Math.random() * 2 + 0.1).toFixed(2)} MB`,
    speed: randomSpeed(),
    date_added: randomPastDate(30),
  };
}

/**
 * Generates a single AFDA subscription with random, unique dummy data.
 * Safe to call multiple times; each result has unique ids and varied fields.
 */
export function generateDummyAfdaSubscription(): AfdaSubscription {
  const id = `afda-dummy-${randomId()}`;
  const site = pick(ARTICLE_SITES);
  const sectionName = pick(ARTICLE_SECTION_NAMES);
  const downloadCount = Math.floor(Math.random() * 5);
  const downloads: Download[] = Array.from({ length: downloadCount }, () =>
    generateDummyArticleDownload(),
  );

  return {
    id,
    source_type: 'afda',
    downloads,
    schedule_time: generateDummyScheduleTime(),
    last_checked_time: randomPastDate(7),
    source: sectionName,
    sourceUrl: `https://${site}/sections/${sectionName.toLowerCase().replace(/\s+/g, '-')}`,
    recurring: Math.random() > 0.2,
    status: pick(STATUSES),
    date_created: randomPastDate(365),
    upload_cadence: pick(UPLOAD_CADENCES),
    settings: [generateDummySettings()],
    section_details: {
      websiteName: sectionName,
      websiteUrl: `https://${site}/sections/${sectionName.toLowerCase().replace(/\s+/g, '-')}`,
      articleCount: Math.floor(Math.random() * 200) + 10,
      sectionCount: Math.floor(Math.random() * 8) + 2,
      site,
    },
    activity_log: [],
  };
}

/**
 * Generates a single subscription with random, unique dummy data.
 * Safe to call multiple times; each result has unique ids and varied fields.
 */
export function generateDummySubscription(): Subscription {
  const subscriptionId = randomId();
  const downloadCount = Math.floor(Math.random() * 5);
  const downloads: Download[] = Array.from({ length: downloadCount }, () =>
    generateDummyDownload(),
  );

  const source = pick(SOURCES);
  return {
    id: subscriptionId,
    downloads,
    schedule_time: generateDummyScheduleTime(),
    last_checked_time: randomPastDate(7),
    source,
    sourceUrl: `https://www.${source}.com/channel/${randomId()}`,
    recurring: Math.random() > 0.2,
    status: pick(STATUSES),
    date_created: randomPastDate(365),
    upload_cadence: pick(UPLOAD_CADENCES),
    settings: [
      generateDummySettings(),
      ...(Math.random() > 0.6 ? [generateDummySettings()] : []),
    ],
  };
}
