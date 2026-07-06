# SelectedSubscriptionView Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `SelectedSubscriptionView` to match the Figma layout — left channel nav, info header with stats, underline tab bar, and a full Downloads table.

**Architecture:** Two files are modified. `SkedulosaDownloads.tsx` is upgraded first (it becomes a self-contained table that reads from the store). Then `SelectedSubscriptionView.tsx` is rewritten to use the new three-panel layout, consuming the upgraded tab component.

**Tech Stack:** React, Zustand, Tailwind CSS, React Router v6, shadcn Avatar component (`@radix-ui/react-avatar`), React Icons (`react-icons/lu`, `react-icons/fi`)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/skedulosa/pages/selectedTabPages/SkedulosaDownloads.tsx` | **Rewrite** | Self-contained downloads table — reads subscription from store by channelId, renders sorted table with delete/view actions |
| `src/skedulosa/pages/SelectedSubscriptionView.tsx` | **Rewrite** | Three-panel layout: left channel nav, info header with stat cards and Check Now button, underline tab bar wiring to tab components |

---

## Task 1: Upgrade `SkedulosaDownloads.tsx` to a real downloads table

**Files:**
- Modify: `src/skedulosa/pages/selectedTabPages/SkedulosaDownloads.tsx`

- [ ] **Step 1: Replace the stub with the full component**

Replace the entire contents of `src/skedulosa/pages/selectedTabPages/SkedulosaDownloads.tsx` with:

```tsx
import { useMemo } from 'react';
import { LuTrash2, LuPlay } from 'react-icons/lu';
import { useSkedulosaStore } from '@/skedulosa/store/skedulosaStore';
import { formatRelativeTime } from '@/downlodr/pages/status/statusPageUtils';

interface DownloadTabProps {
  channelId: string | undefined;
}

function StatusBadge({ status }: { status: string }) {
  const lower = status.toLowerCase();
  let cls = 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  if (lower === 'completed') cls = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300';
  else if (lower === 'queued' || lower === 'pending') cls = 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
  else if (lower === 'error') cls = 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

const DownloadTab = ({ channelId }: DownloadTabProps) => {
  const subscription = useSkedulosaStore((s) =>
    s.subscriptions.find((sub) => sub.id === channelId),
  );
  const removeSubscriptionDownload = useSkedulosaStore(
    (s) => s.removeSubscriptionDownload,
  );

  const downloads = useMemo(() => {
    if (!subscription) return [];
    return [...subscription.downloads].sort(
      (a, b) =>
        new Date(b.date_added).getTime() - new Date(a.date_added).getTime(),
    );
  }, [subscription]);

  if (!subscription || downloads.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400 text-sm">
        No downloads yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            <th className="py-2 pr-4 font-medium">Title</th>
            <th className="py-2 pr-4 font-medium">Size</th>
            <th className="py-2 pr-4 font-medium">Speed</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 pr-4 font-medium">Date Added</th>
            <th className="py-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {downloads.map((download) => (
            <tr
              key={download.id}
              className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-darkModeCompliment/30"
            >
              {/* Title + Thumbnail */}
              <td className="py-2 pr-4">
                <div className="flex items-center gap-2">
                  {download.thumbnail_location ? (
                    <img
                      src={download.thumbnail_location}
                      alt=""
                      className="w-10 h-10 object-cover rounded flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-gray-200 dark:bg-gray-700 flex-shrink-0" />
                  )}
                  <span className="truncate max-w-[200px] text-gray-900 dark:text-gray-100">
                    {download.name}
                  </span>
                </div>
              </td>
              {/* Size */}
              <td className="py-2 pr-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                {download.size || '—'}
              </td>
              {/* Speed */}
              <td className="py-2 pr-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                {download.speed || '—'}
              </td>
              {/* Status */}
              <td className="py-2 pr-4">
                <StatusBadge status={download.status} />
              </td>
              {/* Date Added */}
              <td className="py-2 pr-4 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                {download.date_added ? formatRelativeTime(download.date_added) : '—'}
              </td>
              {/* Actions */}
              <td className="py-2">
                <div className="flex items-center gap-1">
                  {download.video_location && (
                    <button
                      type="button"
                      title="View file"
                      onClick={() =>
                        window.downlodrFunctions?.openVideo(download.video_location!)
                      }
                      className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                    >
                      <LuPlay size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    title="Delete"
                    onClick={() =>
                      removeSubscriptionDownload(subscription.id, download.id)
                    }
                    className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                  >
                    <LuTrash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DownloadTab;
```

- [ ] **Step 2: Lint check**

```bash
yarn lint
```

Expected: no errors in `SkedulosaDownloads.tsx`. Fix any lint errors before continuing.

- [ ] **Step 3: Commit**

```bash
git add src/skedulosa/pages/selectedTabPages/SkedulosaDownloads.tsx
git commit -m "feat(skedulosa): upgrade SkedulosaDownloads to full downloads table"
```

---

## Task 2: Rewrite `SelectedSubscriptionView.tsx` — left nav + info header + tab bar

**Files:**
- Modify: `src/skedulosa/pages/SelectedSubscriptionView.tsx`

- [ ] **Step 1: Replace the entire file**

Replace the entire contents of `src/skedulosa/pages/SelectedSubscriptionView.tsx` with:

```tsx
import { useMemo, useState, useCallback, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  filterChannelsByStatusAndCategory,
  useSkedulosaStore,
} from '../store/skedulosaStore';
import {
  formatBytesToHuman,
  getTotalStorageForDownloads,
} from '../utils/subscriptionDownloadUtils';
import { formatRelativeTime } from '@/downlodr/pages/status/statusPageUtils';
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from '@/core-app/components/shadcn/components/ui/avatar';
import ActivityLogTab from './selectedTabPages/SkedulosaActivityLog';
import AnalyticsTab from './selectedTabPages/SkedulosaAnalytics';
import DownloadTab from './selectedTabPages/SkedulosaDownloads';
import SettingsTab from './selectedTabPages/SkedulosaSettings';

// ── Stat card ──────────────────────────────────────────────────────────────
function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-lg font-semibold text-gray-900 dark:text-gray-100 leading-tight">
        {value}
      </span>
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
const SelectedSubscriptionView = () => {
  const [activeTab, setActiveTab] = useState<string>('downloads');
  const [scrapeStatus, setScrapeStatus] = useState<
    'idle' | 'running' | 'done' | 'error'
  >('idle');
  const scrapeResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { channelId } = useParams();
  const scheduledChannels = useSkedulosaStore((s) => s.scheduledChannels);
  const subscriptions = useSkedulosaStore((s) => s.subscriptions);
  const statusFilter = useSkedulosaStore((s) => s.statusFilter);
  const categoryFilter = useSkedulosaStore((s) => s.categoryFilter);

  const selectedChannelId = channelId ?? null;

  const filteredChannels = useMemo(
    () =>
      filterChannelsByStatusAndCategory(
        scheduledChannels,
        statusFilter,
        categoryFilter,
      ),
    [scheduledChannels, statusFilter, categoryFilter],
  );

  const selectedSubscription = useMemo(
    () => subscriptions.find((s) => s.id === selectedChannelId),
    [subscriptions, selectedChannelId],
  );

  // Selected channel pinned to top; rest follow
  const channelsForNav = useMemo(() => {
    if (!selectedChannelId) return filteredChannels;
    const selected = filteredChannels.find(
      (ch) => ch.channelId === selectedChannelId,
    );
    const rest = filteredChannels.filter(
      (ch) => ch.channelId !== selectedChannelId,
    );
    return selected ? [selected, ...rest] : filteredChannels;
  }, [filteredChannels, selectedChannelId]);

  const handleScrapeNow = useCallback(async () => {
    if (!selectedSubscription) return;
    // Guard: toolkit_channel_id must exist before starting any state change
    if (selectedSubscription.toolkit_channel_id === undefined) return;
    const bridge =
      typeof window !== 'undefined' ? window.skedulosaBridge : undefined;
    if (!bridge) return;
    if (scrapeResetTimer.current) {
      clearTimeout(scrapeResetTimer.current);
      scrapeResetTimer.current = null;
    }
    setScrapeStatus('running');
    try {
      await bridge.runScraperOnce(selectedSubscription.toolkit_channel_id);
      setScrapeStatus('done');
      scrapeResetTimer.current = setTimeout(() => setScrapeStatus('idle'), 3000);
    } catch (err) {
      console.error('[skedulosa] scrapeNow failed', err);
      setScrapeStatus('error');
      scrapeResetTimer.current = setTimeout(() => setScrapeStatus('idle'), 4000);
    }
  }, [selectedSubscription]);

  const handleTabChange = (tabValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveTab(tabValue);
  };

  // ── Stat card values ────────────────────────────────────────────────────
  const downloadCount = selectedSubscription?.downloads.length ?? 0;
  const storageStr = formatBytesToHuman(
    getTotalStorageForDownloads(selectedSubscription?.downloads ?? []),
  );
  const createdStr = (() => {
    try {
      return selectedSubscription
        ? new Date(selectedSubscription.date_created).toLocaleDateString()
        : '—';
    } catch {
      return '—';
    }
  })();
  const lastCheckedStr = selectedSubscription?.last_checked_time
    ? formatRelativeTime(selectedSubscription.last_checked_time)
    : 'Never';

  // ── Empty state ─────────────────────────────────────────────────────────
  if (filteredChannels.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Schedule
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          No scheduled channels yet. Add a channel from the home page to see
          entries here.
        </p>
      </div>
    );
  }

  // ── Tab buttons config ──────────────────────────────────────────────────
  const tabs = [
    { id: 'downloads', label: 'Downloads' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'activity log', label: 'Activity Log' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="flex flex-row h-full min-h-0">
      {/* ── Left channel nav ─────────────────────────────────────────── */}
      <nav
        aria-label="Channel list"
        className="w-1/5 flex flex-col overflow-y-auto border-r border-gray-200 dark:border-gray-700 flex-shrink-0"
      >
        <div className="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Channel
        </div>
        <ul className="list-none p-0 m-0 px-2 space-y-0.5">
          {channelsForNav.map((channel) => {
            const isSelected = channel.channelId === selectedChannelId;
            const avatarUrl = subscriptions.find(
              (s) => s.id === channel.channelId,
            )?.channel_details?.avatarUrl;
            const fallbackChar = channel.channelName.charAt(0).toUpperCase();
            return (
              <li key={channel.channelId}>
                <Link
                  to={`/skedulosa/selected-subscription/${channel.channelId}`}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 ${
                    isSelected
                      ? 'bg-gray-200 dark:bg-darkModeCompliment font-semibold text-gray-900 dark:text-gray-100'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-darkModeCompliment/50'
                  }`}
                  aria-current={isSelected ? 'page' : undefined}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={avatarUrl} alt={channel.channelName} />
                    <AvatarFallback className="text-xs">
                      {fallbackChar}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm">{channel.channelName}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Right content ────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* ── Info header ─────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          {selectedSubscription ? (
            <>
              <div className="flex items-center justify-between mb-3">
                {/* Avatar + name */}
                <div className="flex items-center gap-3">
                  <Avatar className="h-14 w-14 flex-shrink-0">
                    <AvatarImage
                      src={selectedSubscription.channel_details?.avatarUrl}
                      alt={selectedSubscription.source}
                    />
                    <AvatarFallback className="text-lg">
                      {selectedSubscription.source.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {selectedSubscription.source}
                  </span>
                </div>

                {/* Check Now button */}
                <button
                  type="button"
                  onClick={handleScrapeNow}
                  disabled={scrapeStatus === 'running'}
                  className={`px-3 py-1.5 rounded text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                    scrapeStatus === 'done'
                      ? 'bg-emerald-600 text-white'
                      : scrapeStatus === 'error'
                        ? 'bg-red-600 text-white'
                        : 'bg-primary hover:bg-primary/90 text-white'
                  }`}
                >
                  {scrapeStatus === 'running'
                    ? 'Checking…'
                    : scrapeStatus === 'done'
                      ? 'Done!'
                      : scrapeStatus === 'error'
                        ? 'Failed'
                        : 'Check Now'}
                </button>
              </div>

              {/* Stat cards */}
              <div className="flex flex-row gap-6">
                <StatCard value={String(downloadCount)} label="downloads" />
                <StatCard value={storageStr} label="storage" />
                <StatCard value={createdStr} label="created" />
                <StatCard value={lastCheckedStr} label="last checked" />
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Select a channel from the list.
            </p>
          )}
        </div>

        {/* ── Tab bar ─────────────────────────────────────────────────── */}
        <div className="flex flex-row border-b border-gray-200 dark:border-gray-700 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={(e) => handleTabChange(tab.id, e)}
              className={`px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-b-2 border-primary text-gray-900 dark:text-gray-100'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab panel ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'downloads' && <DownloadTab channelId={channelId} />}
          {activeTab === 'analytics' && <AnalyticsTab channelId={channelId} />}
          {activeTab === 'activity log' && (
            <ActivityLogTab channelId={channelId} />
          )}
          {activeTab === 'settings' && <SettingsTab channelId={channelId} />}
        </div>
      </div>
    </div>
  );
};

export default SelectedSubscriptionView;
```

- [ ] **Step 2: Lint check**

```bash
yarn lint
```

Expected: no errors. Fix any lint errors before continuing.

- [ ] **Step 3: Start the app and verify visually**

```bash
yarn start
```

Navigate to `/skedulosa/selected-subscription/:id` and confirm:
1. Left nav shows channel list with avatars and "Channel" header
2. Info header shows avatar, name, 4 stat cards, and Check Now button
3. Tab bar shows underline on active tab, no shadow
4. Downloads tab renders the table (or "No downloads yet." if empty)
5. Switching tabs renders the correct panel

- [ ] **Step 4: Commit**

```bash
git add src/skedulosa/pages/SelectedSubscriptionView.tsx
git commit -m "feat(skedulosa): redesign SelectedSubscriptionView with nav, info header, and tab bar"
```

---

## Self-Review Checklist

- [x] Left nav with Avatar, initials fallback, active state, filtered list — Task 2 Step 1
- [x] Info header from `selectedSubscription` (not `selectedChannel`) — Task 2 Step 1
- [x] 4 stat cards: downloads, storage, created (toLocaleDateString), last checked (with 'Never' guard) — Task 2 Step 1
- [x] Check Now guard: early return before `setScrapeStatus` if `toolkit_channel_id` undefined — Task 2 Step 1
- [x] Debug buttons removed — Task 2 Step 1
- [x] Tab state `useState<string>`, `handleTabChange` calls `setActiveTab(tabValue)`, render uses `===` — Task 2 Step 1
- [x] Active tab indicator `border-b-2 border-primary`, `shadow-xs` removed — Task 2 Step 1
- [x] Downloads table: all 6 columns, inline sort on `date_added`, no `sortDownloadsByColumn` — Task 1 Step 1
- [x] View button hidden when `video_location` undefined/empty — Task 1 Step 1
- [x] Delete calls `removeSubscriptionDownload(subscription.id, download.id)` — Task 1 Step 1
- [x] Empty state "No downloads yet." — Task 1 Step 1
- [x] Unused `{ download }` import from `yt-dlp-helper` removed — Task 2 Step 1
- [x] `handleGetSched` and `handleGetList` removed — Task 2 Step 1
- [x] Avatar lookup: `subscriptions.find(s => s.id === channel.channelId)?.channel_details?.avatarUrl` — Task 2 Step 1
