# SelectedSubscriptionView Redesign

**Date:** 2026-03-26
**File:** `src/skedulosa/pages/SelectedSubscriptionView.tsx`
**Related tab:** `src/skedulosa/pages/selectedTabPages/SkedulosaDownloads.tsx`

---

## Overview

Redesign `SelectedSubscriptionView` to match the Figma layout: a left channel navigation panel, a channel info header, and a tab carousel with a styled Downloads table.

---

## Layout

The view is a horizontal split with a fixed-height scroll container:

```
[ Left Nav ~1/5, overflow-y-auto, h-full ] [ Right Content ~4/5 ]
```

The outer flex row needs `min-h-0` so child `h-full` + `overflow-y-auto` correctly constrains scroll.

The right content stacks vertically:

```
[ Info Header      ]
[ Tab Bar          ]
[ Active Tab Panel ]
```

---

## Section 1 — Left Channel Nav

- Header: "Channel" label
- `overflow-y-auto` scrollable `<ul>` of channels from `channelsForNav`
  - **Note:** `channelsForNav` reflects the active status/category filter. This is intentional — the nav mirrors the filtered list.
- Each item:
  - Small circular avatar (32×32): use `<Avatar>/<AvatarImage>/<AvatarFallback>` from `@/core-app/components/shadcn/components/ui/avatar`
    - `AvatarImage src`: resolved inline inside the `.map()` as `subscriptions.find(s => s.id === channel.channelId)?.channel_details?.avatarUrl` — `channelsForNav` items are `ScheduledChannel` and do not carry `channel_details`; the lookup must go back to the `subscriptions` array
    - `AvatarFallback`: first character of `channel.channelName`, uppercase (e.g. "A" for "ABC CBS News")
  - Channel name text (truncated with `truncate`)
- Selected channel: `bg-gray-200 dark:bg-darkModeCompliment`, `font-semibold`
- Non-selected: normal text, `hover:bg-gray-100 dark:hover:bg-darkModeCompliment/50`
- Uses existing `<Link>` routing to `/skedulosa/selected-subscription/:channelId`
- Empty state unchanged (existing "No scheduled channels" message)

---

## Section 2 — Info Header

All data comes from **`selectedSubscription`** (type `Subscription`), not from `selectedChannel` (type `ScheduledChannel`). `channel_details` is only available on `Subscription`.

Rendered only when `selectedSubscription` is defined.

**Left cluster (flex row, items-center, gap-3):**
- Large circular avatar (56×56): `<Avatar>/<AvatarImage>/<AvatarFallback>` — same logic as nav items
- Channel name: `selectedSubscription.source`, bold, large text

**Stats row (flex row, gap-4, below name):**

| Stat | Value | Label | Guard |
|------|-------|-------|-------|
| Downloads | `selectedSubscription.downloads.length` | "downloads" | none |
| Storage | `formatBytesToHuman(getTotalStorageForDownloads(selectedSubscription.downloads))` | "storage" | none |
| Created | `new Date(selectedSubscription.date_created).toLocaleDateString()` | "created" | wrap in try/catch or check validity |
| Last Checked | `selectedSubscription.last_checked_time ? formatRelativeTime(selectedSubscription.last_checked_time) : 'Never'` | "last checked" | guard against empty string |

Each stat card: value on top (large, semi-bold), muted label below (small, gray).

**Right cluster (top-right, ml-auto):**
- "Check Now" button — guard: only rendered when `selectedSubscription` is defined. Uses existing `scrapeStatus` state (idle/running/done/error) and `handleScrapeNow`. All color/disabled logic unchanged. Inside `handleScrapeNow`, add an early return guard: if `selectedSubscription.toolkit_channel_id === undefined`, bail out **before** calling `setScrapeStatus('running')` and before calling `bridge.runScraperOnce` — guarding after `setScrapeStatus` would leave the spinner stuck indefinitely (the field is typed as `toolkit_channel_id?: number`).
- Debug buttons (`Get all schedule`, `Get list`) are **removed** entirely.

---

## Section 3 — Tab Bar

Horizontal tab strip. Active indicator: `border-b-2 border-primary` underline on the active button. This **replaces** the existing `shadow-xs` approach — remove `shadow-xs` from active tab class and replace with `border-b-2 border-primary`.

Tabs (in order): **Downloads** | **Analytics** | **Activity Log** | **Settings**

Tab state: change `useState<string[]>(['downloads'])` to `useState<string>('downloads')`. Match active tab with `activeTab === 'downloads'` instead of `activeTab.includes(...)`. Also update `handleTabChange` from `setActiveTab([tabValue])` to `setActiveTab(tabValue)` to match the new type.

---

## Section 4 — Downloads Tab (`SkedulosaDownloads.tsx`)

Reads the subscription by `channelId` from `useSkedulosaStore` directly inside the component:

```ts
const subscription = useSkedulosaStore(s => s.subscriptions.find(sub => sub.id === channelId));
const downloads = useMemo(() => {
  if (!subscription) return [];
  return [...subscription.downloads].sort(
    (a, b) => new Date(b.date_added).getTime() - new Date(a.date_added).getTime()
  );
}, [subscription]);
```

**Do NOT reuse `sortDownloadsByColumn` from statusPageUtils** — it uses camelCase keys (`dateAdded`) incompatible with `Download.date_added` (snake_case). Use the inline comparator above.

### Table columns (in order):

| Column | Content | Notes |
|--------|---------|-------|
| **Title** | Thumbnail (40×40, `object-cover rounded`) + video name | `download.thumbnail_location`; fallback: gray `bg-gray-200` div |
| **Size** | `download.size` | Raw string (e.g. "100 MB") |
| **Speed** | `download.speed` | Raw string (e.g. "1.2 MB/s") |
| **Status** | Colored badge pill | `completed` → green; `queued`/`pending` → yellow; `error` → red; others → gray |
| **Date Added** | `download.date_added ? formatRelativeTime(download.date_added) : '—'` | Guard against empty |
| **Actions** | Delete icon button + View icon button | See below |

**Actions column:**
- Delete: calls `removeSubscriptionDownload(subscription.id, download.id)` from store
- View: opens `download.video_location` via `window.downlodrFunctions?.openFile(video_location)` — **button is hidden (not rendered) when `video_location` is undefined or empty**

### Empty state:
If `downloads.length === 0`, render: `<p>No downloads yet.</p>` centered in the table area.

---

## Cleanup

- Remove unused import `{ download }` from `'yt-dlp-helper'` (current line 15 of `SelectedSubscriptionView.tsx`)
- Remove debug button handlers `handleGetSched` and `handleGetList` if not used elsewhere

---

## Data Sources

| Need | Source |
|------|--------|
| Subscription data | `useSkedulosaStore(s => s.subscriptions.find(sub => sub.id === channelId))` |
| Channel nav list | `useSkedulosaStore` → `scheduledChannels` filtered → `channelsForNav` |
| Delete download | `useSkedulosaStore(s => s.removeSubscriptionDownload)` |
| Storage calc | `getTotalStorageForDownloads` from `subscriptionDownloadUtils` |
| Human-readable bytes | `formatBytesToHuman` from `subscriptionDownloadUtils` |
| Relative time | `formatRelativeTime` from `@/downlodr/pages/status/statusPageUtils` |
| Avatar component | `Avatar`, `AvatarImage`, `AvatarFallback` from `@/core-app/components/shadcn/components/ui/avatar` |

---

## Files to Modify

1. **`src/skedulosa/pages/SelectedSubscriptionView.tsx`** — full layout redesign
2. **`src/skedulosa/pages/selectedTabPages/SkedulosaDownloads.tsx`** — upgrade stub to real downloads table

## Files Left Unchanged

- `SkedulosaAnalytics.tsx` — stub stays
- `SkedulosaActivityLog.tsx` — stub stays
- `SkedulosaSettings.tsx` — stub stays
- `skedulosaStore.tsx` — no changes needed
- `subscriptionDownloadUtils.ts` — no changes needed
