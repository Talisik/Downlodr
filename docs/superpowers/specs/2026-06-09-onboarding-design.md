# Onboarding Feature Design

**Date:** 2026-06-09
**Branch:** feat/modular-install

---

## Overview

A standalone interactive onboarding experience that showcases all 6 major app features using dummy data — no real backend, no yt-dlp/ffmpeg/nemesis/afda invocations. Users see a faithful visual replica of each feature even if add-ons are not installed.

---

## Goals

- Show new users what the app can do before they've downloaded anything
- Works regardless of which add-ons are installed
- Visually indistinguishable from the real app (same Tailwind classes, colors, icons, layouts)
- Accessible on first run and from Help modal at any time

---

## Folder Structure

Mirrors `src/afda/` as a top-level feature module:

```
src/onboarding/
├── components/
│   ├── OnboardingLayout.tsx          # Full-screen container, renders active demo
│   ├── OnboardingPill.tsx            # Floating bottom-center pill toolbar
│   ├── demos/
│   │   ├── VideoDownloadDemo.tsx
│   │   ├── PlaylistDemo.tsx
│   │   ├── AfdaSingleDemo.tsx
│   │   ├── AfdaSubscriptionDemo.tsx
│   │   ├── YtChannelDemo.tsx
│   │   └── VideoPlayerDemo.tsx
│   └── shared/
│       ├── DemoShell.tsx             # Common wrapper: title, subtitle, content area
│       ├── FakeProgressBar.tsx       # Animated progress bar (matches real app style)
│       └── FakeDownloadRow.tsx       # Simulated download table row
├── hooks/
│   └── useDemoSimulator.ts           # Fake progress state machine
├── pages/
│   └── OnboardingPage.tsx            # Route entry point `/onboarding`
└── types/
    └── onboardingTypes.ts            # Feature enum, dummy data constants, demo state types
```

No `store/` — all state is ephemeral React local state. The one persistent flag goes in `useSettingStore`.

---

## Route & First-Run Integration

### New route
Add `/onboarding` to `App.tsx`'s router, outside `MainLayout`, so no sidebar/titlebar/toolbar renders:

```tsx
<Route path="/onboarding" element={<OnboardingPage />} />
```

### First-run detection
Add `onboardingShown: boolean` (default `false`) to `useSettingStore`. In `App.tsx`, after the existing `addonOnboardingShown` effect, add:

```tsx
useEffect(() => {
  if (settings.onboardingShown) return;
  const timer = setTimeout(() => {
    navigate('/onboarding');
  }, 1500);
  return () => clearTimeout(timer);
}, [settings.onboardingShown]);
```

On exit, call `updateOnboardingShown(true)` and `navigate('/status/all')`.

### HelpModal entry point
Add a "Take a Tour" button at the top of HelpModal's content area. Clicking it closes the modal and navigates to `/onboarding`. No flag check — always accessible.

---

## OnboardingLayout

Full-screen page:
- Background: `bg-gray-50 dark:bg-darkMode` (matches app background)
- Centers the active demo content in the viewport
- Renders `<OnboardingPill>` fixed at the bottom center
- Passes `activeFeature`, `setActiveFeature`, and `onExit` down as props

---

## OnboardingPill (Floating Toolbar)

Fixed position: `fixed bottom-6 left-1/2 -translate-x-1/2 z-50`

Shape: pill (`rounded-full`) with `bg-white dark:bg-darkModeDropdown border border-divider dark:border-darkModeCompliment shadow-xl`

Layout (left → right):
1. **Progress dots** (6 dots): filled/orange for visited features, hollow for unvisited, active dot slightly larger. Clicking a dot navigates to that feature.
2. **Feature dropdown** (center): shows current feature name with a chevron. Dropdown lists all 6 features. Styled with `bg-white dark:bg-darkModeDropdown`.
3. **Exit button** (right): `✕` icon, navigates away and sets `onboardingShown = true`.

Framer Motion: pill fades + slides up on mount (`y: 20 → 0, opacity: 0 → 1`).

Feature order and labels:
1. Video Download
2. Playlist Download
3. AFDA – Single Article
4. AFDA – Subscription
5. YT Channel Subscription
6. Video Player

---

## DemoShell (Shared Wrapper)

Each demo renders inside `DemoShell`:
- Feature badge (small pill, `bg-primary/10 text-primary text-xs`)
- Feature title (`text-2xl font-bold dark:text-white`)
- Subtitle/description (`text-sm text-gray-500 dark:text-gray-400`)
- Content area: the actual demo UI
- Framer Motion: content fades in on feature switch (`AnimatePresence` + `motion.div`)

---

## Feature Demos

All demos use real Tailwind classes from actual components. Key classes: `dark:bg-darkModeTable`, `dark:text-darkModeLight`, `dark:border-darkModeCompliment`, `dark:hover:bg-darkModeHover`, `bg-primary` (#F45513 orange), `text-xs`.

### 1. Video Download Demo
Replicates `TaskbarInputField` + `ExpandedDownloadDetail`.

**Layout:**
- Fake URL input bar (pre-filled with a dummy YouTube URL, non-editable display)
- "Download" button (`bg-primary text-white`)
- Below: a download table with one row

**Key interaction:**
- Clicking "Download" → `useDemoSimulator` starts → `FakeProgressBar` animates 0→100% over ~3s
- Row shows: thumbnail placeholder, fake title ("How to Build a React App"), channel ("Code with Mika"), speed ("2.4 MB/s"), size ("128 MB"), status dot → green "Finished" when complete
- Progress bar: track `bg-[#E8E8E8] dark:bg-darkModeDarkGray`, fill `bg-green-500`
- "Reset" link appears after completion to replay

### 2. Playlist Download Demo
Replicates `AdditionalOptions` playlist panel.

**Layout:**
- Fake input showing a playlist URL
- Panel below: left column (download options checkboxes), right column (scrollable list of 5 fake videos)
- Each video item: `w-24 h-16` thumbnail, title (`text-xs font-medium`), channel (`text-xxs text-gray-400`)

**Key interaction:**
- "Download All" button → 5 `FakeProgressBar`s stagger (0ms, 300ms, 600ms, 900ms, 1200ms delays)
- Each bar runs at slightly different speeds to look natural
- Checkboxes styled with orange fill (`#F45513`) when checked

### 3. AFDA – Single Article Demo
Replicates `ArticleDownloadTableRow`.

**Layout:**
- Fake article URL input
- "Fetch Article" button
- Below: a table row (same structure as real `ArticleDownloadTableRow`)

**Key interaction:**
- Clicking "Fetch Article" → 1.5s simulated parse delay (spinner + "Analyzing article…" text)
- Row appears: thumbnail (`h-9 w-16 bg-blue-50 dark:bg-blue-900/20 rounded`), fake title ("The Future of AI in Healthcare"), site name in blue, status icon → green finished
- Icons: `AiOutlineFileWord` for article, `IoMdDownload` for download action

### 4. AFDA – Subscription Demo
Replicates `AfdaTableGroup` + child `ArticleDownloadTableRow`s.

**Layout:**
- Fake website URL input (e.g. "techcrunch.com")
- "Add Subscription" button
- Below: a subscription group row (collapsed) with favicon, "SUB" badge (`bg-primary rounded-xl px-3 text-white`), site name, article count

**Key interaction:**
- Clicking "Add Subscription" → 2s "Scanning website…" animation
- Group row appears, then auto-expands to show 3 child article rows fading in sequentially
- Chevron (`FiChevronRight`) rotates to `rotate-90` when expanded

### 5. YT Channel Subscription Demo
Replicates the channel subscription flow (similar to `AfdaTableGroup` but for video channels).

**Layout:**
- Fake channel URL input (e.g. `youtube.com/@mkbhd`)
- "Subscribe" button
- Below: channel card with avatar, channel name, subscriber count

**Key interaction:**
- Clicking "Subscribe" → 1.5s resolve animation
- Channel card appears: `w-10 h-10 rounded-full` avatar placeholder, channel name bold, "3 new videos found" subtitle
- 3 fake video thumbnail cards slide in below: `w-24 h-16 bg-black rounded`, title `text-xs`, duration badge

### 6. Video Player Demo
Replicates `VideoPlayerPanel`.

**Layout:**
- Left sidebar: scrollable list of 3 fake video items (thumbnail + title + channel)
- Center: 16:9 black player area with a poster image, scrubber bar, play/pause button, volume icon
- Right sidebar: metadata tabs (Info, Captions) — static content

**Key interaction:**
- Clicking play/pause button → Framer Motion toggles between play icon and pause icon
- Scrubber shows a static fake progress (no actual seeking)
- Active sidebar item: `bg-blue-50 dark:bg-darkModeTableBorder border-l-2 border-primary`
- Player background: `bg-black`

---

## useDemoSimulator Hook

```ts
type DemoStatus = 'idle' | 'running' | 'complete';

interface DemoSimulator {
  progress: number;   // 0–100
  status: DemoStatus;
  start: () => void;
  reset: () => void;
}

function useDemoSimulator(durationMs: number = 3000): DemoSimulator
```

Uses `setInterval` internally, incrementing progress based on elapsed time. Returns stable `start`/`reset` callbacks. Multiple simulators can run independently (each demo instantiates its own).

---

## Dummy Data

All static constants in `src/onboarding/types/onboardingTypes.ts`:

```ts
export const DUMMY_VIDEOS = [
  { id: '1', title: 'How to Build a React App', channel: 'Code with Mika', duration: '12:34', size: '128 MB' },
  { id: '2', title: 'Mastering TypeScript in 2025', channel: 'Dev Tutorials', duration: '24:11', size: '256 MB' },
  // ...5 total
];

export const DUMMY_ARTICLES = [
  { id: '1', title: 'The Future of AI in Healthcare', site: 'techcrunch.com', date: '2026-06-01' },
  // ...3 total
];

export const DUMMY_CHANNEL = {
  name: 'MKBHD', handle: '@mkbhd', subscribers: '18.2M',
  videos: [/* 3 fake video objects */],
};

export const DUMMY_PLAYLIST = {
  title: 'JavaScript Crash Course',
  videos: [/* 5 fake video objects */],
};

export enum OnboardingFeature {
  VideoDownload = 'video-download',
  Playlist = 'playlist',
  AfdaSingle = 'afda-single',
  AfdaSubscription = 'afda-subscription',
  YtChannel = 'yt-channel',
  VideoPlayer = 'video-player',
}
```

---

## Visual Fidelity Rules

All demo components must follow these rules to match the real app:

| Rule | Value |
|---|---|
| Dark mode backgrounds | `dark:bg-darkModeTable` (#272727) for tables, `dark:bg-darkModeDropdown` (#18181B) for dropdowns |
| Text on dark | `dark:text-darkModeLight` (#D4D4D8) |
| Hover states | `dark:hover:bg-darkModeHover` (#3E3E46) |
| Progress bar track | `bg-[#E8E8E8] dark:bg-darkModeDarkGray` |
| Progress bar fill | `bg-green-500` (downloading), `bg-primary` (analyzing) |
| Accent / primary | `bg-primary` / `text-primary` = `#F45513` orange |
| Borders | `dark:border-darkModeCompliment` or `dark:border-gray-700` |
| Rounded | `rounded-lg` (cards/panels), `rounded-md` (rows), `rounded-full` (pill, dots, avatars) |
| Text size | `text-xs` (body), `text-[11px]` (metadata), `text-2xl` (demo title) |
| Icons | lucide-react + react-icons (same libraries as real app) |

---

## Persistence

`useSettingStore` change:
- Add `onboardingShown: boolean` with default `false`
- Add `updateOnboardingShown(value: boolean): void` action

`HelpModal` change:
- Add "Take a Tour" button (top of modal content, above tabs)
- Uses `useNavigate()` + `onClose()` when clicked

`App.tsx` change:
- Add `useEffect` that auto-navigates to `/onboarding` on first run (1.5s delay, same pattern as `addonOnboardingShown`)

---

## Out of Scope

- No real IPC calls or backend communication
- No actual video playback in the VideoPlayer demo (poster image only)
- No i18n for onboarding strings (hardcoded English)
- No mobile/responsive layout (app is desktop-only)
