# Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone `/onboarding` route with 6 interactive feature demos, a floating pill navigator, first-run auto-launch, and a Help modal entry point — all using dummy data with no backend calls.

**Architecture:** `src/onboarding/` is a self-contained feature module (mirroring `src/afda/`). `OnboardingLayout` owns the full-screen container and floating pill; each of 6 feature demos is an independent component. A shared `useDemoSimulator` hook drives fake progress animations. The only external dependencies are adding a `onboardingShown` flag to `useSettingStore`, wiring the route in `App.tsx`, and adding a button to `HelpModal`.

**Tech Stack:** React 18, TypeScript, Tailwind CSS (custom dark mode tokens), Framer Motion, lucide-react, react-icons, Zustand (existing store only).

---

## File Map

**Create:**
- `src/onboarding/types/onboardingTypes.ts` — feature enum + all dummy data constants
- `src/onboarding/hooks/useDemoSimulator.ts` — interval-based progress state machine
- `src/onboarding/components/shared/FakeProgressBar.tsx` — reusable animated bar
- `src/onboarding/components/shared/FakeDownloadRow.tsx` — simulated download table row
- `src/onboarding/components/shared/DemoShell.tsx` — title/subtitle/content wrapper with fade animation
- `src/onboarding/components/OnboardingPill.tsx` — floating bottom pill (dots + dropdown + exit)
- `src/onboarding/components/OnboardingLayout.tsx` — full-screen container
- `src/onboarding/pages/OnboardingPage.tsx` — route entry point
- `src/onboarding/components/demos/VideoDownloadDemo.tsx`
- `src/onboarding/components/demos/PlaylistDemo.tsx`
- `src/onboarding/components/demos/AfdaSingleDemo.tsx`
- `src/onboarding/components/demos/AfdaSubscriptionDemo.tsx`
- `src/onboarding/components/demos/YtChannelDemo.tsx`
- `src/onboarding/components/demos/VideoPlayerDemo.tsx`

**Modify:**
- `src/core-app/store/settingsStore.tsx` — add `onboardingShown` flag + migration
- `src/App.tsx` — add `/onboarding` route + `OnboardingNavigator` component
- `src/downlodr/components/modal/custom/HelpModal.tsx` — add "Take a Tour" button

---

## Task 1: Add `onboardingShown` to settingsStore

**Files:**
- Modify: `src/core-app/store/settingsStore.tsx`

- [ ] **Step 1: Bump the version constant from 2 to 3**

In `settingsStore.tsx`, change line:
```ts
const MAIN_SETTINGS_VERSION = 2;
```
to:
```ts
const MAIN_SETTINGS_VERSION = 3;
```

- [ ] **Step 2: Add `onboardingShown` to the `DownloadSettings` interface**

After the `addonOnboardingShown` line in the interface:
```ts
addonOnboardingShown: boolean;
onboardingShown: boolean;
```

- [ ] **Step 3: Add `updateOnboardingShown` to the `SettingsStore` interface**

After the `updateAddonOnboardingShown` line:
```ts
updateAddonOnboardingShown: (shown: boolean) => void;
updateOnboardingShown: (shown: boolean) => void;
```

- [ ] **Step 4: Add `onboardingShown: false` to the v0→v1 migration default state**

In `migrateMainStore`, inside the `version === undefined || version === 0` branch, add to `defaultState.settings`:
```ts
addonOnboardingShown: false,
onboardingShown: false,
```

- [ ] **Step 5: Update the v2→v3 migration to also set `onboardingShown: true` for existing users**

Replace the existing `if (version === 2)` block:
```ts
if (version === 2) {
  return {
    ...(persistedState as any),
    settings: {
      ...(persistedState as any).settings,
      dontShowAppUpdates: false,
      dontShowPluginUpdates: false,
      onboardingShown: true, // existing users skip onboarding
    },
  };
}
```

- [ ] **Step 6: Add `onboardingShown: false` to the store's default `settings` object**

In the `create<SettingsStore>()(persist(...))` block, add after `addonOnboardingShown: false`:
```ts
addonOnboardingShown: false,
onboardingShown: false,
```

- [ ] **Step 7: Add `updateOnboardingShown` implementation**

After `updateAddonOnboardingShown`:
```ts
updateOnboardingShown: (shown: boolean) =>
  set((state) => ({
    settings: { ...state.settings, onboardingShown: shown },
  })),
```

- [ ] **Step 8: Commit**

```bash
git add src/core-app/store/settingsStore.tsx
git commit -m "feat: add onboardingShown flag to settingsStore"
```

---

## Task 2: Types and Dummy Data

**Files:**
- Create: `src/onboarding/types/onboardingTypes.ts`

- [ ] **Step 1: Create the file with the feature enum and all dummy data**

```ts
export enum OnboardingFeature {
  VideoDownload = 'video-download',
  Playlist = 'playlist',
  AfdaSingle = 'afda-single',
  AfdaSubscription = 'afda-subscription',
  YtChannel = 'yt-channel',
  VideoPlayer = 'video-player',
}

export const FEATURE_ORDER: OnboardingFeature[] = [
  OnboardingFeature.VideoDownload,
  OnboardingFeature.Playlist,
  OnboardingFeature.AfdaSingle,
  OnboardingFeature.AfdaSubscription,
  OnboardingFeature.YtChannel,
  OnboardingFeature.VideoPlayer,
];

export const FEATURE_LABELS: Record<OnboardingFeature, string> = {
  [OnboardingFeature.VideoDownload]: 'Video Download',
  [OnboardingFeature.Playlist]: 'Playlist Download',
  [OnboardingFeature.AfdaSingle]: 'AFDA – Single Article',
  [OnboardingFeature.AfdaSubscription]: 'AFDA – Subscription',
  [OnboardingFeature.YtChannel]: 'YT Channel Subscription',
  [OnboardingFeature.VideoPlayer]: 'Video Player',
};

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
  { id: '1', title: 'How to Build a React App', channel: 'Code with Mika', duration: '12:34', size: '128 MB' },
  { id: '2', title: 'Mastering TypeScript in 2025', channel: 'Dev Tutorials', duration: '24:11', size: '256 MB' },
  { id: '3', title: 'CSS Grid vs Flexbox Explained', channel: 'Web Dev Pro', duration: '08:52', size: '94 MB' },
  { id: '4', title: 'Node.js Full Course for Beginners', channel: 'Code with Mika', duration: '45:00', size: '512 MB' },
  { id: '5', title: 'Building REST APIs with Express', channel: 'Dev Tutorials', duration: '31:17', size: '320 MB' },
];

export const DUMMY_ARTICLES: DummyArticle[] = [
  { id: '1', title: 'The Future of AI in Healthcare', site: 'techcrunch.com', date: '2026-06-01' },
  { id: '2', title: 'Why TypeScript Is Winning', site: 'smashingmagazine.com', date: '2026-05-28' },
  { id: '3', title: 'Inside the New Chip Architecture', site: 'arstechnica.com', date: '2026-05-20' },
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
export const DUMMY_ARTICLE_URL = 'techcrunch.com/2026/06/01/future-of-ai-healthcare';
export const DUMMY_SUBSCRIPTION_URL = 'techcrunch.com';
export const DUMMY_CHANNEL_URL = 'youtube.com/@mkbhd';
```

- [ ] **Step 2: Commit**

```bash
git add src/onboarding/types/onboardingTypes.ts
git commit -m "feat: add onboarding types and dummy data"
```

---

## Task 3: useDemoSimulator Hook

**Files:**
- Create: `src/onboarding/hooks/useDemoSimulator.ts`

- [ ] **Step 1: Create the hook**

```ts
import { useCallback, useEffect, useRef, useState } from 'react';

export type DemoStatus = 'idle' | 'running' | 'complete';

export interface DemoSimulator {
  progress: number;
  status: DemoStatus;
  start: () => void;
  reset: () => void;
}

export function useDemoSimulator(durationMs = 3000): DemoSimulator {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<DemoStatus>('idle');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const clear = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const start = useCallback(() => {
    clear();
    setProgress(0);
    setStatus('running');
    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const next = Math.min(100, Math.round((elapsed / durationMs) * 100));
      setProgress(next);
      if (next >= 100) {
        clear();
        setStatus('complete');
      }
    }, 50);
  }, [durationMs]);

  const reset = useCallback(() => {
    clear();
    setProgress(0);
    setStatus('idle');
  }, []);

  useEffect(() => () => clear(), []);

  return { progress, status, start, reset };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/onboarding/hooks/useDemoSimulator.ts
git commit -m "feat: add useDemoSimulator hook"
```

---

## Task 4: FakeProgressBar Component

**Files:**
- Create: `src/onboarding/components/shared/FakeProgressBar.tsx`

- [ ] **Step 1: Create the component**

```tsx
import React from 'react';

interface FakeProgressBarProps {
  progress: number;
  color?: 'green' | 'primary';
  className?: string;
}

const FakeProgressBar: React.FC<FakeProgressBarProps> = ({
  progress,
  color = 'green',
  className = '',
}) => {
  const fillClass = color === 'primary' ? 'bg-primary' : 'bg-green-500';

  return (
    <div
      className={`w-full h-1.5 rounded-full bg-[#E8E8E8] dark:bg-darkModeDarkGray overflow-hidden ${className}`}
    >
      <div
        className={`h-full rounded-full transition-all duration-100 ${fillClass}`}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

export default FakeProgressBar;
```

- [ ] **Step 2: Commit**

```bash
git add src/onboarding/components/shared/FakeProgressBar.tsx
git commit -m "feat: add FakeProgressBar shared component"
```

---

## Task 5: FakeDownloadRow Component

**Files:**
- Create: `src/onboarding/components/shared/FakeDownloadRow.tsx`

- [ ] **Step 1: Create the component**

Matches the visual structure of `ExpandedDownloadDetail` — thumbnail placeholder, title, channel, speed/size, progress bar, status dot.

```tsx
import React from 'react';
import { DemoStatus } from '../../hooks/useDemoSimulator';
import FakeProgressBar from './FakeProgressBar';

interface FakeDownloadRowProps {
  title: string;
  channel: string;
  size: string;
  progress: number;
  status: DemoStatus;
  speed?: string;
}

const FakeDownloadRow: React.FC<FakeDownloadRowProps> = ({
  title,
  channel,
  size,
  progress,
  status,
  speed = '2.4 MB/s',
}) => {
  const statusDotClass =
    status === 'complete'
      ? 'bg-green-500'
      : status === 'running'
      ? 'bg-primary animate-pulse'
      : 'bg-gray-400 dark:bg-darkModeDarkGray';

  return (
    <div className="w-full rounded-md border border-divider dark:border-darkModeCompliment bg-white dark:bg-darkModeTable shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2">
        {/* Thumbnail placeholder */}
        <div className="w-16 h-10 rounded bg-gray-200 dark:bg-darkModeDarkGray flex-shrink-0" />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium dark:text-darkModeLight truncate">{title}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{channel}</p>
          <div className="mt-1.5">
            <FakeProgressBar progress={progress} />
          </div>
        </div>

        {/* Meta */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${statusDotClass}`} />
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {status === 'complete' ? 'Finished' : status === 'running' ? speed : 'Queued'}
            </span>
          </div>
          <span className="text-[11px] text-gray-400 dark:text-gray-500">{size}</span>
        </div>
      </div>
    </div>
  );
};

export default FakeDownloadRow;
```

- [ ] **Step 2: Commit**

```bash
git add src/onboarding/components/shared/FakeDownloadRow.tsx
git commit -m "feat: add FakeDownloadRow shared component"
```

---

## Task 6: DemoShell Component

**Files:**
- Create: `src/onboarding/components/shared/DemoShell.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { motion } from 'framer-motion';
import React from 'react';

interface DemoShellProps {
  badge: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  featureKey: string;
}

const DemoShell: React.FC<DemoShellProps> = ({
  badge,
  title,
  subtitle,
  children,
  featureKey,
}) => {
  return (
    <motion.div
      key={featureKey}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col items-center w-full max-w-3xl mx-auto px-6 pb-28"
    >
      <div className="mb-6 text-center">
        <span className="inline-block bg-primary/10 text-primary text-xs font-medium px-3 py-1 rounded-full mb-3">
          {badge}
        </span>
        <h1 className="text-2xl font-bold dark:text-white text-gray-900 mb-1">
          {title}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
      </div>
      <div className="w-full">{children}</div>
    </motion.div>
  );
};

export default DemoShell;
```

- [ ] **Step 2: Commit**

```bash
git add src/onboarding/components/shared/DemoShell.tsx
git commit -m "feat: add DemoShell shared wrapper"
```

---

## Task 7: OnboardingPill Component

**Files:**
- Create: `src/onboarding/components/OnboardingPill.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, X } from 'lucide-react';
import React, { useRef, useState, useEffect } from 'react';
import { FEATURE_LABELS, FEATURE_ORDER, OnboardingFeature } from '../types/onboardingTypes';

interface OnboardingPillProps {
  active: OnboardingFeature;
  visited: Set<OnboardingFeature>;
  onSelect: (f: OnboardingFeature) => void;
  onExit: () => void;
}

const OnboardingPill: React.FC<OnboardingPillProps> = ({
  active,
  visited,
  onSelect,
  onExit,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
      ref={ref}
    >
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-white dark:bg-darkModeDropdown border border-divider dark:border-darkModeCompliment shadow-xl">
        {/* Progress dots */}
        <div className="flex items-center gap-1.5">
          {FEATURE_ORDER.map((f, i) => {
            const isActive = f === active;
            const isVisited = visited.has(f);
            return (
              <button
                key={f}
                onClick={() => onSelect(f)}
                title={FEATURE_LABELS[f]}
                className={`rounded-full transition-all duration-200 ${
                  isActive
                    ? 'w-3 h-3 bg-primary'
                    : isVisited
                    ? 'w-2 h-2 bg-primary/50'
                    : 'w-2 h-2 bg-gray-300 dark:bg-darkModeDarkGray'
                }`}
              />
            );
          })}
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-divider dark:bg-darkModeCompliment" />

        {/* Feature dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="flex items-center gap-1.5 text-xs font-medium dark:text-darkModeLight text-gray-700 hover:text-primary dark:hover:text-primary transition-colors min-w-[160px] justify-between"
          >
            <span>{FEATURE_LABELS[active]}</span>
            <ChevronDown
              size={13}
              className={`transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <AnimatePresence>
            {dropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.15 }}
                className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-52 rounded-lg bg-white dark:bg-darkModeDropdown border border-divider dark:border-darkModeCompliment shadow-lg py-1 z-10"
              >
                {FEATURE_ORDER.map((f) => (
                  <button
                    key={f}
                    onClick={() => { onSelect(f); setDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-gray-50 dark:hover:bg-darkModeHover ${
                      f === active
                        ? 'text-primary font-medium'
                        : 'dark:text-darkModeLight text-gray-700'
                    }`}
                  >
                    {FEATURE_LABELS[f]}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-divider dark:bg-darkModeCompliment" />

        {/* Exit */}
        <button
          onClick={onExit}
          className="text-gray-400 hover:text-gray-700 dark:hover:text-darkModeLight transition-colors"
          title="Exit tour"
        >
          <X size={15} />
        </button>
      </div>
    </motion.div>
  );
};

export default OnboardingPill;
```

- [ ] **Step 2: Commit**

```bash
git add src/onboarding/components/OnboardingPill.tsx
git commit -m "feat: add OnboardingPill floating toolbar"
```

---

## Task 8: OnboardingLayout Component

**Files:**
- Create: `src/onboarding/components/OnboardingLayout.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { AnimatePresence } from 'framer-motion';
import React, { useState } from 'react';
import { FEATURE_ORDER, OnboardingFeature } from '../types/onboardingTypes';
import AfdaSingleDemo from './demos/AfdaSingleDemo';
import AfdaSubscriptionDemo from './demos/AfdaSubscriptionDemo';
import PlaylistDemo from './demos/PlaylistDemo';
import VideoDownloadDemo from './demos/VideoDownloadDemo';
import VideoPlayerDemo from './demos/VideoPlayerDemo';
import YtChannelDemo from './demos/YtChannelDemo';
import OnboardingPill from './OnboardingPill';

interface OnboardingLayoutProps {
  onExit: () => void;
}

const DEMO_MAP: Record<OnboardingFeature, React.ReactNode> = {
  [OnboardingFeature.VideoDownload]: <VideoDownloadDemo />,
  [OnboardingFeature.Playlist]: <PlaylistDemo />,
  [OnboardingFeature.AfdaSingle]: <AfdaSingleDemo />,
  [OnboardingFeature.AfdaSubscription]: <AfdaSubscriptionDemo />,
  [OnboardingFeature.YtChannel]: <YtChannelDemo />,
  [OnboardingFeature.VideoPlayer]: <VideoPlayerDemo />,
};

const OnboardingLayout: React.FC<OnboardingLayoutProps> = ({ onExit }) => {
  const [active, setActive] = useState<OnboardingFeature>(FEATURE_ORDER[0]);
  const [visited, setVisited] = useState<Set<OnboardingFeature>>(
    new Set([FEATURE_ORDER[0]])
  );

  const handleSelect = (f: OnboardingFeature) => {
    setActive(f);
    setVisited((prev) => new Set([...prev, f]));
  };

  return (
    <div className="min-h-screen w-full bg-gray-50 dark:bg-darkMode flex flex-col items-center overflow-y-auto pt-12">
      <AnimatePresence mode="wait">
        {DEMO_MAP[active]}
      </AnimatePresence>
      <OnboardingPill
        active={active}
        visited={visited}
        onSelect={handleSelect}
        onExit={onExit}
      />
    </div>
  );
};

export default OnboardingLayout;
```

- [ ] **Step 2: Commit**

```bash
git add src/onboarding/components/OnboardingLayout.tsx
git commit -m "feat: add OnboardingLayout container"
```

---

## Task 9: OnboardingPage + Route + First-Run Navigator

**Files:**
- Create: `src/onboarding/pages/OnboardingPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create OnboardingPage**

```tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingStore } from '@/core-app/store/settingsStore';
import OnboardingLayout from '../components/OnboardingLayout';

const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { updateOnboardingShown } = useSettingStore();

  const handleExit = () => {
    updateOnboardingShown(true);
    navigate('/status/all');
  };

  return <OnboardingLayout onExit={handleExit} />;
};

export default OnboardingPage;
```

- [ ] **Step 2: Add `OnboardingNavigator` component and wire into `App.tsx`**

In `App.tsx`, add the import at the top with other imports:
```tsx
import OnboardingPage from './onboarding/pages/OnboardingPage';
```

Add this component definition right before `const App = () => {` (it must live inside the Router to use `useNavigate`):
```tsx
const OnboardingNavigator: React.FC = () => {
  const navigate = useNavigate();
  const { settings } = useSettingStore();

  useEffect(() => {
    if (settings.onboardingShown) return;
    const timer = setTimeout(() => {
      navigate('/onboarding');
    }, 1500);
    return () => clearTimeout(timer);
  }, [settings.onboardingShown]);

  return null;
};
```

- [ ] **Step 3: Add `/onboarding` route and `<OnboardingNavigator />` inside the Router in `App.tsx`**

Inside the `<Router>` block, add `<OnboardingNavigator />` and the route. The Routes block should become:
```tsx
<Router>
  <OnboardingNavigator />
  <Routes>
    <Route path="/onboarding" element={<OnboardingPage />} />
    <Route path="/" element={<MainLayout />}>
      {/* ... all existing routes unchanged ... */}
    </Route>
    {/* ... all other existing routes unchanged ... */}
  </Routes>
  <GlobalScanningModal />
</Router>
```

- [ ] **Step 4: Commit**

```bash
git add src/onboarding/pages/OnboardingPage.tsx src/App.tsx
git commit -m "feat: add /onboarding route and first-run navigator"
```

---

## Task 10: VideoDownloadDemo

**Files:**
- Create: `src/onboarding/components/demos/VideoDownloadDemo.tsx`

- [ ] **Step 1: Create the component**

Replicates the look of `TaskbarInputField` + `ExpandedDownloadDetail`.

```tsx
import React from 'react';
import { Download } from 'lucide-react';
import DemoShell from '../shared/DemoShell';
import FakeDownloadRow from '../shared/FakeDownloadRow';
import { useDemoSimulator } from '../../hooks/useDemoSimulator';
import { DUMMY_SINGLE_URL, DUMMY_SINGLE_VIDEO } from '../../types/onboardingTypes';
import { OnboardingFeature } from '../../types/onboardingTypes';

const VideoDownloadDemo: React.FC = () => {
  const sim = useDemoSimulator(3000);

  return (
    <DemoShell
      featureKey={OnboardingFeature.VideoDownload}
      badge="Core Feature"
      title="Download Any Video"
      subtitle="Paste a URL and downlodr handles the rest — format selection, speed control, and queue management."
    >
      {/* Fake input bar */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-divider dark:border-darkModeCompliment bg-white dark:bg-darkModeTable shadow-sm mb-4">
        <div className="flex-1 text-xs text-gray-400 dark:text-gray-500 truncate">
          {DUMMY_SINGLE_URL}
        </div>
        <button
          onClick={sim.status === 'idle' ? sim.start : undefined}
          disabled={sim.status === 'running'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors flex-shrink-0"
        >
          <Download size={12} />
          Download
        </button>
      </div>

      {/* Download table */}
      {sim.status !== 'idle' && (
        <div className="space-y-2">
          <FakeDownloadRow
            title={DUMMY_SINGLE_VIDEO.title}
            channel={DUMMY_SINGLE_VIDEO.channel}
            size={DUMMY_SINGLE_VIDEO.size}
            progress={sim.progress}
            status={sim.status}
          />
          {sim.status === 'complete' && (
            <div className="text-center">
              <button
                onClick={sim.reset}
                className="text-xs text-primary hover:underline"
              >
                Reset demo
              </button>
            </div>
          )}
        </div>
      )}

      {sim.status === 'idle' && (
        <div className="flex items-center justify-center h-20 rounded-lg border border-dashed border-divider dark:border-darkModeCompliment text-xs text-gray-400 dark:text-gray-500">
          Click Download to see it in action
        </div>
      )}
    </DemoShell>
  );
};

export default VideoDownloadDemo;
```

- [ ] **Step 2: Commit**

```bash
git add src/onboarding/components/demos/VideoDownloadDemo.tsx
git commit -m "feat: add VideoDownloadDemo"
```

---

## Task 11: PlaylistDemo

**Files:**
- Create: `src/onboarding/components/demos/PlaylistDemo.tsx`

- [ ] **Step 1: Create the component**

Replicates the `AdditionalOptions` playlist panel — left column checkboxes, right column scrollable video list.

```tsx
import React, { useState } from 'react';
import { Download } from 'lucide-react';
import DemoShell from '../shared/DemoShell';
import FakeProgressBar from '../shared/FakeProgressBar';
import { useDemoSimulator } from '../../hooks/useDemoSimulator';
import { DUMMY_PLAYLIST, OnboardingFeature } from '../../types/onboardingTypes';

const DURATIONS = [3000, 3600, 2800, 4200, 3300];

const PlaylistDemo: React.FC = () => {
  const sims = DURATIONS.map((d) => useDemoSimulator(d));
  const [started, setStarted] = useState(false);

  const handleDownloadAll = () => {
    setStarted(true);
    sims.forEach((sim, i) => {
      setTimeout(() => sim.start(), i * 300);
    });
  };

  const handleReset = () => {
    setStarted(false);
    sims.forEach((sim) => sim.reset());
  };

  const allDone = sims.every((s) => s.status === 'complete');

  return (
    <DemoShell
      featureKey={OnboardingFeature.Playlist}
      badge="Batch Downloading"
      title="Download Entire Playlists"
      subtitle="Queue a whole playlist at once. Choose which videos to include and downlodr handles them in parallel."
    >
      {/* Fake input bar */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-divider dark:border-darkModeCompliment bg-white dark:bg-darkModeTable shadow-sm mb-4">
        <div className="flex-1 text-xs text-gray-400 dark:text-gray-500 truncate">
          {DUMMY_PLAYLIST.url}
        </div>
        <span className="text-[11px] text-gray-400 dark:text-gray-500 flex-shrink-0">
          Playlist · {DUMMY_PLAYLIST.videos.length} videos
        </span>
      </div>

      {/* Playlist panel */}
      <div className="rounded-lg border border-divider dark:border-darkModeCompliment bg-white dark:bg-darkModeDropdown shadow-sm overflow-hidden">
        <div className="flex gap-0 divide-x divide-divider dark:divide-darkModeCompliment">
          {/* Left: options */}
          <div className="w-48 flex-shrink-0 p-4 space-y-3">
            <p className="text-xs font-medium dark:text-darkModeLight text-gray-700 mb-2">
              Options
            </p>
            {['Best Quality', 'Audio Only', 'Subtitles'].map((opt) => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                <span
                  className="w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: opt === 'Best Quality' ? '#F45513' : '#09090B',
                    borderColor: opt === 'Best Quality' ? '#F45513' : '#52525B',
                  }}
                >
                  {opt === 'Best Quality' && (
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                      <path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="text-xs dark:text-darkModeLight text-gray-700">{opt}</span>
              </label>
            ))}
            <div className="pt-2">
              <button
                onClick={started ? undefined : handleDownloadAll}
                disabled={started && !allDone}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                <Download size={11} />
                {allDone ? 'Done!' : 'Download All'}
              </button>
              {allDone && (
                <button onClick={handleReset} className="w-full mt-1 text-xs text-primary hover:underline">
                  Reset demo
                </button>
              )}
            </div>
          </div>

          {/* Right: video list */}
          <div className="flex-1 max-h-[220px] overflow-y-auto p-2 space-y-1">
            {DUMMY_PLAYLIST.videos.map((video, i) => (
              <div
                key={video.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-darkModeHover transition-colors"
              >
                <div className="w-24 h-16 rounded bg-gray-200 dark:bg-darkModeDarkGray flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium dark:text-darkModeLight truncate">{video.title}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{video.channel}</p>
                  {started && (
                    <div className="mt-1.5">
                      <FakeProgressBar progress={sims[i].progress} />
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-gray-400 flex-shrink-0">{video.duration}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DemoShell>
  );
};

export default PlaylistDemo;
```

- [ ] **Step 2: Commit**

```bash
git add src/onboarding/components/demos/PlaylistDemo.tsx
git commit -m "feat: add PlaylistDemo"
```

---

## Task 12: AfdaSingleDemo

**Files:**
- Create: `src/onboarding/components/demos/AfdaSingleDemo.tsx`

- [ ] **Step 1: Create the component**

Replicates the `ArticleDownloadTableRow` structure — thumbnail placeholder, title, site name in blue, status icon.

```tsx
import React, { useState } from 'react';
import { AiOutlineFileWord } from 'react-icons/ai';
import { IoMdDownload } from 'react-icons/io';
import { VscPlayCircle } from 'react-icons/vsc';
import DemoShell from '../shared/DemoShell';
import { DUMMY_ARTICLES, DUMMY_ARTICLE_URL, OnboardingFeature } from '../../types/onboardingTypes';

type FetchState = 'idle' | 'analyzing' | 'done';

const AfdaSingleDemo: React.FC = () => {
  const [state, setState] = useState<FetchState>('idle');
  const article = DUMMY_ARTICLES[0];

  const handleFetch = () => {
    setState('analyzing');
    setTimeout(() => setState('done'), 1500);
  };

  return (
    <DemoShell
      featureKey={OnboardingFeature.AfdaSingle}
      badge="AFDA Add-on"
      title="Download Any Article"
      subtitle="Paste an article URL and AFDA extracts the full content into a clean, readable document."
    >
      {/* Fake input bar */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-divider dark:border-darkModeCompliment bg-white dark:bg-darkModeTable shadow-sm mb-4">
        <div className="flex-1 text-xs text-gray-400 dark:text-gray-500 truncate">
          {DUMMY_ARTICLE_URL}
        </div>
        <button
          onClick={state === 'idle' ? handleFetch : undefined}
          disabled={state === 'analyzing'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors flex-shrink-0"
        >
          Fetch Article
        </button>
      </div>

      {/* Analyzing state */}
      {state === 'analyzing' && (
        <div className="flex items-center justify-center gap-2 h-16 rounded-lg border border-divider dark:border-darkModeCompliment bg-white dark:bg-darkModeTable text-xs text-gray-500 dark:text-gray-400">
          <span className="animate-spin text-primary">⟳</span>
          Analyzing article…
        </div>
      )}

      {/* Article row — matches ArticleDownloadTableRow structure */}
      {state === 'done' && (
        <div className="rounded-lg border border-divider dark:border-darkModeCompliment bg-white dark:bg-darkModeTable overflow-hidden">
          <div className="flex items-center gap-3 px-3 py-2 border-b border-divider dark:border-darkModeTableBorder">
            {/* Thumbnail / icon */}
            <div className="h-9 w-16 bg-blue-50 dark:bg-blue-900/20 rounded flex items-center justify-center flex-shrink-0">
              <AiOutlineFileWord size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            {/* Article info */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold dark:text-darkModeLight line-clamp-1">{article.title}</p>
              <p className="text-[11px] text-blue-600 dark:text-blue-400 truncate">{article.site}</p>
            </div>
            {/* Status */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <VscPlayCircle size={16} className="text-green-500" />
              <span className="text-[11px] text-green-500">Ready</span>
            </div>
          </div>
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[11px] text-gray-400 dark:text-gray-500">{article.date}</span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400 dark:text-gray-500">DOCX</span>
              <IoMdDownload size={16} style={{ color: '#FF9800' }} />
            </div>
          </div>
        </div>
      )}

      {state === 'done' && (
        <div className="text-center mt-2">
          <button onClick={() => setState('idle')} className="text-xs text-primary hover:underline">
            Reset demo
          </button>
        </div>
      )}

      {state === 'idle' && (
        <div className="flex items-center justify-center h-20 rounded-lg border border-dashed border-divider dark:border-darkModeCompliment text-xs text-gray-400 dark:text-gray-500">
          Click Fetch Article to see AFDA in action
        </div>
      )}
    </DemoShell>
  );
};

export default AfdaSingleDemo;
```

- [ ] **Step 2: Commit**

```bash
git add src/onboarding/components/demos/AfdaSingleDemo.tsx
git commit -m "feat: add AfdaSingleDemo"
```

---

## Task 13: AfdaSubscriptionDemo

**Files:**
- Create: `src/onboarding/components/demos/AfdaSubscriptionDemo.tsx`

- [ ] **Step 1: Create the component**

Replicates `AfdaTableGroup` — collapsible group row with "SUB" badge, favicon placeholder, article count, and child `ArticleDownloadTableRow`s.

```tsx
import React, { useState } from 'react';
import { FiChevronRight } from 'react-icons/fi';
import { LuNewspaper } from 'react-icons/lu';
import { AiOutlineFileWord } from 'react-icons/ai';
import { VscPlayCircle } from 'react-icons/vsc';
import DemoShell from '../shared/DemoShell';
import { DUMMY_ARTICLES, DUMMY_SUBSCRIPTION_URL, OnboardingFeature } from '../../types/onboardingTypes';

type ScanState = 'idle' | 'scanning' | 'done';

const AfdaSubscriptionDemo: React.FC = () => {
  const [state, setScanState] = useState<ScanState>('idle');
  const [expanded, setExpanded] = useState(false);

  const handleAdd = () => {
    setScanState('scanning');
    setTimeout(() => {
      setScanState('done');
      setTimeout(() => setExpanded(true), 300);
    }, 2000);
  };

  return (
    <DemoShell
      featureKey={OnboardingFeature.AfdaSubscription}
      badge="AFDA Add-on"
      title="Subscribe to Any Website"
      subtitle="Add a website once and AFDA automatically fetches new articles on your schedule."
    >
      {/* Fake input bar */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-divider dark:border-darkModeCompliment bg-white dark:bg-darkModeTable shadow-sm mb-4">
        <div className="flex-1 text-xs text-gray-400 dark:text-gray-500 truncate">
          {DUMMY_SUBSCRIPTION_URL}
        </div>
        <button
          onClick={state === 'idle' ? handleAdd : undefined}
          disabled={state === 'scanning'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors flex-shrink-0"
        >
          {state === 'idle' ? 'Add Subscription' : 'Scanning…'}
        </button>
      </div>

      {/* Scanning */}
      {state === 'scanning' && (
        <div className="flex items-center justify-center gap-2 h-16 rounded-lg border border-divider dark:border-darkModeCompliment bg-white dark:bg-darkModeTable text-xs text-gray-500 dark:text-gray-400">
          <span className="animate-spin text-primary">⟳</span>
          Scanning website for articles…
        </div>
      )}

      {/* Group row — matches AfdaTableGroup */}
      {(state === 'done') && (
        <div className="rounded-lg border border-divider dark:border-darkModeCompliment bg-white dark:bg-darkModeTable overflow-hidden">
          {/* Header row */}
          <div
            className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-darkModeHover transition-colors"
            onClick={() => setExpanded((e) => !e)}
          >
            <FiChevronRight
              size={15}
              className={`transition-transform duration-200 dark:text-gray-400 ${expanded ? 'rotate-90' : ''}`}
            />
            <div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <LuNewspaper size={16} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold dark:text-darkModeLight line-clamp-1">
                  {DUMMY_SUBSCRIPTION_URL}
                </p>
                <span className="bg-primary rounded-xl px-2 py-0.5 text-white text-[10px] font-medium">
                  SUB
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {DUMMY_ARTICLES.length} articles · Last added {DUMMY_ARTICLES[0].date}
              </p>
            </div>
          </div>

          {/* Child article rows */}
          {expanded && (
            <div className="border-t border-divider dark:border-darkModeTableBorder divide-y divide-divider dark:divide-darkModeTableBorder">
              {DUMMY_ARTICLES.map((article, i) => (
                <div
                  key={article.id}
                  className="flex items-center gap-3 px-3 py-2 pl-12 bg-gray-50 dark:bg-darkModeDarkGray/40 animate-fadeIn"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="h-9 w-16 bg-blue-50 dark:bg-blue-900/20 rounded flex items-center justify-center flex-shrink-0">
                    <AiOutlineFileWord size={18} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold dark:text-darkModeLight line-clamp-1">{article.title}</p>
                    <p className="text-[11px] text-blue-600 dark:text-blue-400">{article.site}</p>
                  </div>
                  <VscPlayCircle size={15} className="text-green-500 flex-shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {state === 'done' && (
        <div className="text-center mt-2">
          <button onClick={() => { setScanState('idle'); setExpanded(false); }} className="text-xs text-primary hover:underline">
            Reset demo
          </button>
        </div>
      )}

      {state === 'idle' && (
        <div className="flex items-center justify-center h-20 rounded-lg border border-dashed border-divider dark:border-darkModeCompliment text-xs text-gray-400 dark:text-gray-500">
          Click Add Subscription to see AFDA scan a site
        </div>
      )}
    </DemoShell>
  );
};

export default AfdaSubscriptionDemo;
```

- [ ] **Step 2: Commit**

```bash
git add src/onboarding/components/demos/AfdaSubscriptionDemo.tsx
git commit -m "feat: add AfdaSubscriptionDemo"
```

---

## Task 14: YtChannelDemo

**Files:**
- Create: `src/onboarding/components/demos/YtChannelDemo.tsx`

- [ ] **Step 1: Create the component**

```tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DemoShell from '../shared/DemoShell';
import { DUMMY_CHANNEL, DUMMY_CHANNEL_URL, OnboardingFeature } from '../../types/onboardingTypes';

type SubState = 'idle' | 'resolving' | 'done';

const YtChannelDemo: React.FC = () => {
  const [state, setState] = useState<SubState>('idle');

  const handleSubscribe = () => {
    setState('resolving');
    setTimeout(() => setState('done'), 1500);
  };

  return (
    <DemoShell
      featureKey={OnboardingFeature.YtChannel}
      badge="Channel Subscriptions"
      title="Subscribe to YouTube Channels"
      subtitle="Subscribe to a channel and downlodr automatically queues new videos as they're published."
    >
      {/* Fake input bar */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-divider dark:border-darkModeCompliment bg-white dark:bg-darkModeTable shadow-sm mb-4">
        <div className="flex-1 text-xs text-gray-400 dark:text-gray-500 truncate">
          {DUMMY_CHANNEL_URL}
        </div>
        <button
          onClick={state === 'idle' ? handleSubscribe : undefined}
          disabled={state === 'resolving'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors flex-shrink-0"
        >
          {state === 'resolving' ? 'Resolving…' : 'Subscribe'}
        </button>
      </div>

      {/* Resolving */}
      {state === 'resolving' && (
        <div className="flex items-center justify-center gap-2 h-16 rounded-lg border border-divider dark:border-darkModeCompliment bg-white dark:bg-darkModeTable text-xs text-gray-500 dark:text-gray-400">
          <span className="animate-spin text-primary">⟳</span>
          Resolving channel…
        </div>
      )}

      <AnimatePresence>
        {state === 'done' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {/* Channel card */}
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-divider dark:border-darkModeCompliment bg-white dark:bg-darkModeTable">
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-darkModeDarkGray flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold dark:text-darkModeLight">{DUMMY_CHANNEL.name}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {DUMMY_CHANNEL.handle} · {DUMMY_CHANNEL.subscribers} subscribers
                </p>
              </div>
              <span className="text-[11px] text-green-500 font-medium">
                {DUMMY_CHANNEL.videos.length} new videos found
              </span>
            </div>

            {/* Latest videos */}
            <div className="grid grid-cols-3 gap-3">
              {DUMMY_CHANNEL.videos.map((video, i) => (
                <motion.div
                  key={video.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.12 }}
                  className="rounded-lg border border-divider dark:border-darkModeCompliment bg-white dark:bg-darkModeTable overflow-hidden"
                >
                  <div className="w-full h-20 bg-black flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                      <span className="text-white text-xs">▶</span>
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="text-[11px] font-medium dark:text-darkModeLight line-clamp-2">{video.title}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{video.duration}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="text-center">
              <button onClick={() => setState('idle')} className="text-xs text-primary hover:underline">
                Reset demo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {state === 'idle' && (
        <div className="flex items-center justify-center h-20 rounded-lg border border-dashed border-divider dark:border-darkModeCompliment text-xs text-gray-400 dark:text-gray-500">
          Click Subscribe to resolve a channel
        </div>
      )}
    </DemoShell>
  );
};

export default YtChannelDemo;
```

- [ ] **Step 2: Commit**

```bash
git add src/onboarding/components/demos/YtChannelDemo.tsx
git commit -m "feat: add YtChannelDemo"
```

---

## Task 15: VideoPlayerDemo

**Files:**
- Create: `src/onboarding/components/demos/VideoPlayerDemo.tsx`

- [ ] **Step 1: Create the component**

Replicates `VideoPlayerPanel` — left sidebar (video list), center (16:9 player with poster, scrubber, controls), right sidebar (metadata tabs).

```tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Volume2 } from 'lucide-react';
import DemoShell from '../shared/DemoShell';
import { DUMMY_VIDEOS, OnboardingFeature } from '../../types/onboardingTypes';

const VideoPlayerDemo: React.FC = () => {
  const [playing, setPlaying] = useState(false);
  const [activeVideo, setActiveVideo] = useState(0);
  const [activeTab, setActiveTab] = useState<'info' | 'captions'>('info');

  const video = DUMMY_VIDEOS[activeVideo];

  return (
    <DemoShell
      featureKey={OnboardingFeature.VideoPlayer}
      badge="Built-in Player"
      title="Watch Downloaded Videos"
      subtitle="Play any downloaded video directly in downlodr — no external player needed."
    >
      <div
        className="rounded-lg border border-divider dark:border-darkModeCompliment bg-white dark:bg-darkModeTable shadow-sm overflow-hidden flex"
        style={{ height: 320 }}
      >
        {/* Left sidebar: video list */}
        <div className="w-52 flex-shrink-0 overflow-y-auto bg-white dark:bg-darkModeTable border-r border-divider dark:border-darkModeCompliment">
          {DUMMY_VIDEOS.slice(0, 3).map((v, i) => (
            <div
              key={v.id}
              onClick={() => setActiveVideo(i)}
              className={`flex items-start gap-2 p-2 cursor-pointer transition-colors ${
                i === activeVideo
                  ? 'bg-blue-50 dark:bg-darkModeTableBorder border-l-2 border-primary'
                  : 'hover:bg-gray-50 dark:hover:bg-darkModeHover border-l-2 border-transparent'
              }`}
            >
              <div className="w-20 h-14 bg-black rounded flex items-center justify-center flex-shrink-0">
                <span className="text-white/40 text-lg">▶</span>
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-[11px] font-medium dark:text-gray-200 line-clamp-2">{v.title}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate mt-0.5">{v.channel}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Center: player */}
        <div className="flex-1 flex flex-col bg-black min-w-0">
          {/* Header bar */}
          <div className="px-3 py-1 bg-gray-900 flex items-center justify-between">
            <span className="text-[11px] text-gray-400 truncate">{video.title}</span>
          </div>

          {/* 16:9 player area */}
          <div className="flex-1 flex items-center justify-center relative bg-black">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <span className="text-white/50 text-sm">▶</span>
            </div>
          </div>

          {/* Controls */}
          <div className="px-3 py-2 bg-gray-900 space-y-1.5">
            {/* Scrubber */}
            <div className="w-full h-1 rounded-full bg-gray-700">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: playing ? '35%' : '20%' }}
              />
            </div>
            {/* Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPlaying((p) => !p)}
                className="text-white hover:text-primary transition-colors"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {playing ? (
                    <motion.span key="pause" initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}>
                      <Pause size={16} />
                    </motion.span>
                  ) : (
                    <motion.span key="play" initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}>
                      <Play size={16} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
              <Volume2 size={14} className="text-gray-400" />
              <span className="text-[10px] text-gray-400 ml-auto">
                {playing ? '0:42' : '0:00'} / {video.duration}
              </span>
            </div>
          </div>
        </div>

        {/* Right sidebar: metadata */}
        <div className="w-56 flex-shrink-0 bg-white dark:bg-darkModeTable border-l border-divider dark:border-darkModeCompliment flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-divider dark:border-darkModeCompliment">
            {(['info', 'captions'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs font-medium capitalize transition-colors border-b-2 ${
                  activeTab === tab
                    ? 'text-primary border-primary'
                    : 'text-gray-500 dark:text-gray-400 border-transparent'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          {/* Content */}
          <div className="p-3 flex-1 overflow-y-auto">
            {activeTab === 'info' ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold dark:text-darkModeLight">{video.title}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">{video.channel}</p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-gray-400">{video.duration}</span>
                  <span className="text-[11px] text-gray-400">·</span>
                  <span className="text-[11px] text-gray-400">{video.size}</span>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                No captions available for this demo.
              </p>
            )}
          </div>
        </div>
      </div>
    </DemoShell>
  );
};

export default VideoPlayerDemo;
```

- [ ] **Step 2: Commit**

```bash
git add src/onboarding/components/demos/VideoPlayerDemo.tsx
git commit -m "feat: add VideoPlayerDemo"
```

---

## Task 16: HelpModal "Take a Tour" Button

**Files:**
- Modify: `src/downlodr/components/modal/custom/HelpModal.tsx`

- [ ] **Step 1: Add `useNavigate` import**

At the top of `HelpModal.tsx`, add to the existing react-router-dom import (or add a new one):
```tsx
import { useNavigate } from 'react-router-dom';
```

- [ ] **Step 2: Add `useNavigate` call inside the component**

Inside `HelpModal`, after the `useTranslation` line:
```tsx
const navigate = useNavigate();
```

- [ ] **Step 3: Add the "Take a Tour" button at the top of the modal content, above the tab bar**

Inside the `<BaseModal ...>` block, before the `{/* Custom Tab Implementation */}` div, insert:
```tsx
{/* Take a Tour button */}
<div className="flex items-center justify-between pb-4 border-b border-divider dark:border-gray-700">
  <div>
    <p className="text-sm font-medium dark:text-gray-200">Interactive Tour</p>
    <p className="text-xs text-gray-500 dark:text-gray-400">
      See every feature in action with a guided demo
    </p>
  </div>
  <button
    onClick={() => { onClose(); navigate('/onboarding'); }}
    className="flex-shrink-0 px-4 py-1.5 rounded-md bg-primary text-white text-xs font-medium hover:bg-primary/90 transition-colors"
  >
    Take a Tour
  </button>
</div>
```

- [ ] **Step 4: Commit**

```bash
git add src/downlodr/components/modal/custom/HelpModal.tsx
git commit -m "feat: add Take a Tour button to HelpModal"
```

---

## Self-Review

**Spec coverage check:**
- [x] `onboardingShown` flag in settingsStore — Task 1
- [x] Types + dummy data — Task 2
- [x] `useDemoSimulator` hook — Task 3
- [x] `FakeProgressBar` — Task 4
- [x] `FakeDownloadRow` — Task 5
- [x] `DemoShell` — Task 6
- [x] `OnboardingPill` (dots + dropdown + exit, Framer Motion mount) — Task 7
- [x] `OnboardingLayout` — Task 8
- [x] `OnboardingPage` + `/onboarding` route — Task 9
- [x] First-run `OnboardingNavigator` in App.tsx — Task 9
- [x] VideoDownloadDemo — Task 10
- [x] PlaylistDemo — Task 11
- [x] AfdaSingleDemo — Task 12
- [x] AfdaSubscriptionDemo — Task 13
- [x] YtChannelDemo — Task 14
- [x] VideoPlayerDemo — Task 15
- [x] HelpModal "Take a Tour" button — Task 16
- [x] Existing users skip onboarding (v2→v3 migration) — Task 1 Step 5
- [x] Visual fidelity (all components use real dark mode tokens) — throughout all demo tasks

**Type consistency check:**
- `DemoStatus` defined in `useDemoSimulator.ts`, imported by `FakeDownloadRow` — consistent
- `OnboardingFeature` enum used as `featureKey` prop in `DemoShell` and as keys in `DEMO_MAP` in `OnboardingLayout` — consistent
- `DummyVideo.duration` used in `PlaylistDemo`, `VideoPlayerDemo` — consistent with type definition
- `useDemoSimulator` returns `{ progress, status, start, reset }` — all four used correctly across demos
