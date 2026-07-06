export enum OnboardingFeature {
  VideoDownload = 'video-download',
  Playlist = 'playlist',
  AfdaSingle = 'afda-single',
  AfdaSubscription = 'afda-subscription',
  YtChannel = 'yt-channel',
  VideoPlayer = 'video-player',
  SmartOrganize = 'smart-organize',
}

export const FEATURE_ORDER: OnboardingFeature[] = [
  OnboardingFeature.VideoDownload,
  OnboardingFeature.YtChannel,
  OnboardingFeature.AfdaSingle,
  OnboardingFeature.AfdaSubscription,
];

export const FEATURE_LABELS: Record<OnboardingFeature, string> = {
  [OnboardingFeature.VideoDownload]: 'Download a video',
  [OnboardingFeature.Playlist]: 'Playlist Download',
  [OnboardingFeature.AfdaSingle]: 'Download an article',
  [OnboardingFeature.AfdaSubscription]: 'Subscribe to a article website',
  [OnboardingFeature.YtChannel]: 'Subscribe to a channel',
  [OnboardingFeature.VideoPlayer]: 'Video Player',
  [OnboardingFeature.SmartOrganize]: 'Smart Organize',
};

export interface SoCategory {
  name: string;
  count: number;
  videos: string[];
}

export const SO_CATEGORIES: SoCategory[] = [
  {
    name: 'Cooking & Recipes',
    count: 4,
    videos: [
      'How to make sourdough — full guide',
      'Fresh pasta from scratch',
      'The perfect steak',
      'Sushi at home',
    ],
  },
  {
    name: 'Programming',
    count: 3,
    videos: [
      'Python in 100 seconds',
      'Rust for beginners',
      'Node.js crash course',
    ],
  },
];

export interface DummyVideo {
  id: string;
  title: string;
  channel: string;
  duration: string;
  size: string;
}

export interface DummyArticle {
  id: string;
  title: string;
  site: string;
  date: string;
}

export const DUMMY_VIDEOS: DummyVideo[] = [
  {
    id: '1',
    title: 'How to Build a React App',
    channel: 'Code with Mika',
    duration: '12:34',
    size: '128 MB',
  },
  {
    id: '2',
    title: 'Mastering TypeScript in 2025',
    channel: 'Dev Tutorials',
    duration: '24:11',
    size: '256 MB',
  },
  {
    id: '3',
    title: 'CSS Grid vs Flexbox Explained',
    channel: 'Web Dev Pro',
    duration: '08:52',
    size: '94 MB',
  },
  {
    id: '4',
    title: 'Node.js Full Course for Beginners',
    channel: 'Code with Mika',
    duration: '45:00',
    size: '512 MB',
  },
  {
    id: '5',
    title: 'Building REST APIs with Express',
    channel: 'Dev Tutorials',
    duration: '31:17',
    size: '320 MB',
  },
];

export const DUMMY_ARTICLES: DummyArticle[] = [
  {
    id: '1',
    title: 'The Future of AI in Healthcare',
    site: 'techcrunch.com',
    date: '2026-06-01',
  },
  {
    id: '2',
    title: 'Why TypeScript Is Winning',
    site: 'smashingmagazine.com',
    date: '2026-05-28',
  },
  {
    id: '3',
    title: 'Inside the New Chip Architecture',
    site: 'arstechnica.com',
    date: '2026-05-20',
  },
];

export const DUMMY_CHANNEL = {
  name: 'MKBHD',
  handle: '@mkbhd',
  subscribers: '18.2M',
  url: 'youtube.com/@mkbhd',
  videos: [
    { id: 'c1', title: 'The Best Smartphone of 2026', duration: '14:22' },
    { id: 'c2', title: 'Laptop Review: Is It Worth It?', duration: '11:45' },
    { id: 'c3', title: 'My Studio Tour 2026', duration: '09:10' },
  ],
};

export const DUMMY_PLAYLIST = {
  title: 'JavaScript Crash Course',
  url: 'youtube.com/playlist?list=PLxxx',
  videos: DUMMY_VIDEOS,
};

export const DUMMY_SINGLE_VIDEO = DUMMY_VIDEOS[0];
export const DUMMY_SINGLE_URL = 'youtube.com/watch?v=dQw4w9WgXcQ';
export const DUMMY_ARTICLE_URL =
  'techcrunch.com/2026/06/01/future-of-ai-healthcare';
export const DUMMY_SUBSCRIPTION_URL = 'techcrunch.com';
export const DUMMY_CHANNEL_URL = 'youtube.com/@mkbhd';
