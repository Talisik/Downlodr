# Skedulosa Feature — Architecture Diagram & Flow
> Generated: 2026-03-17 | Downlodr v3

---

## 1. HIGH-LEVEL OVERVIEW

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          SKEDULOSA FEATURE                              │
│                                                                         │
│   "Scheduled subscription downloads — monitor channels/playlists and   │
│    automatically download new content on a recurring schedule."         │
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐  │
│  │   STORES     │    │    UTILS     │    │        PAGES             │  │
│  │              │◄───│              │◄───│                          │  │
│  │ skedulosa    │    │ download     │    │ Schedule / Subscription  │  │
│  │ Store        │    │ Utils        │    │ History / Selected View  │  │
│  │              │    │              │    │                          │  │
│  │ subscription │    │ schedule     │    │ ─── Tab Pages ───        │  │
│  │ Store        │    │ Manager      │    │ Downloads / Analytics    │  │
│  │              │    │ Utils        │    │ Activity Log / Settings  │  │
│  └──────────────┘    └──────────────┘    └──────────────────────────┘  │
│          │                  │                        │                  │
│          └──────────────────┴────────────────────────┘                 │
│                             │                                           │
│                    SERVICE LAYER                                        │
│              SubscriptionDownloadSyncService                            │
│         (bridges Skedulosa ↔ Core Downloader)                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. ROUTING STRUCTURE

```
/skedulosa  (SkedulosaLayout)
│
├── [SkedulosaRouteGuard]  ← Redirects to /no-schedule if store is empty
│   │
│   ├── /skedulosa/schedule              → SkedulosaSchedulePage    (INDEX)
│   ├── /skedulosa/subscription          → SkedulosaSubscriptionPage
│   ├── /skedulosa/history               → SkedulosaHistoryPage
│   ├── /skedulosa/selected-subscription/:channelId?
│   │                                    → SelectedSubscriptionView
│   │                                        ├── Tab: Downloads     → SkedulosaDownloads
│   │                                        ├── Tab: Analytics     → SkedulosaAnalytics
│   │                                        ├── Tab: Activity Log  → SkedulosaActivityLog
│   │                                        └── Tab: Settings      → SkedulosaSettings
│   │
│   ├── /skedulosa/utils-demo            → SkedulosaUtilsDemoPage   (bypass guard)
│   └── /skedulosa/subscription-downloads→ SkedulosaSubscriptionDownloadsPage (bypass guard)
│
└── /skedulosa/no-schedule               → NoSchedulePage           (bypass guard)


LAYOUT COMPONENTS per route:
┌──────────────────────────────────────────────────┐
│  TitleBar                                        │
│  TaskBar  ←── contains PageNavigation            │
│  ┌──────────────────┬───────────────────────┐    │
│  │SkedulosaNavigation│     <Outlet />        │    │
│  │  (sidebar)       │  (page renders here)  │    │
│  └──────────────────┴───────────────────────┘    │
└──────────────────────────────────────────────────┘
```

---

## 3. STORE LAYER

### 3a. useSkedulosaStore  (src/skedulosa/store/skedulosaStore.tsx)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         useSkedulosaStore                               │
│                    (Zustand + IndexedDB persist)                        │
├─────────────────────────┬───────────────────────────────────────────────┤
│         STATE           │               TYPES                          │
├─────────────────────────┼───────────────────────────────────────────────┤
│                         │                                               │
│  subscriptions          │  Subscription {                               │
│    Subscription[]       │    id: string                                 │
│                         │    downloads: Download[]                      │
│  scheduledChannels      │    schedule_time: ScheduleTime[]              │
│    ScheduledChannel[]   │    last_checked_time: string                  │
│    (auto-synced from    │    source: string       ← display name        │
│     subscriptions)      │    sourceUrl: string    ← feed/channel URL    │
│                         │    recurring: boolean                         │
│  statusFilter           │    status: string                             │
│    StatusFilterSlug     │    date_created: string                       │
│                         │    upload_cadence: string                     │
│  categoryFilter         │    settings: SubscriptionSettings[]           │
│    CategoryFilterSlug   │  }                                            │
│                         │                                               │
│                         │  Download {                                   │
│                         │    id: string                                 │
│                         │    status: string                             │
│                         │    name: string                               │
│                         │    thumbnail_location: string                 │
│                         │    size: string       ← e.g. "120.5 MB"      │
│                         │    speed: string      ← e.g. "2.3 MB/s"      │
│                         │    date_added: string ← ISO date string       │
│                         │  }                                            │
│                         │                                               │
│                         │  ScheduledChannel {   ← LEGACY wrapper        │
│                         │    channelId: string                          │
│                         │    channelName: string                        │
│                         │    channelUrl: string                         │
│                         │    schedule: ScheduleEntry[]                  │
│                         │    + all Subscription fields                  │
│                         │  }                                            │
│                         │                                               │
│                         │  SubscriptionSettings {                       │
│                         │    frequency: string                          │
│                         │    download_quality: string                   │
│                         │    save_location: string                      │
│                         │    download_priority: string                  │
│                         │    lookback_period: string                    │
│                         │    file_naming_format: string                 │
│                         │  }                                            │
│                         │                                               │
│                         │  StatusFilterSlug:                            │
│                         │    'all' | 'active' | 'paused' |             │
│                         │    'needs-attention' | 'error'                │
│                         │                                               │
│                         │  CategoryFilterSlug:                          │
│                         │    'all' | 'youtube'                          │
├─────────────────────────┴───────────────────────────────────────────────┤
│                            ACTIONS                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  setStatusFilter(slug: StatusFilterSlug) → void                         │
│  setCategoryFilter(slug: CategoryFilterSlug) → void                     │
│                                                                         │
│  addSubscription(subscription: Subscription) → void                     │
│  removeSubscription(subscriptionId: string) → void                      │
│  updateSubscription(subscriptionId: string,                             │
│                     subscription: Subscription) → void                  │
│  getSubscription(subscriptionId: string) → Subscription | undefined     │
│  getSubscriptions() → Subscription[]                                    │
│  getFilteredSubscriptions() → Subscription[]                            │
│                                                                         │
│  ── Legacy (ScheduledChannel wrappers) ──────────────────────────────── │
│  addScheduledChannel(channel: ScheduledChannel) → void                  │
│  removeScheduledChannel(channelId: string) → void                       │
│  updateScheduledChannel(channelId: string,                              │
│                          channel: ScheduledChannel) → void              │
│  getScheduledChannel(channelId: string) → ScheduledChannel | undefined  │
│  getScheduledChannels() → ScheduledChannel[]                            │
│  getFilteredScheduledChannels() → ScheduledChannel[]                    │
│                                                                         │
│  ── Download management ─────────────────────────────────────────────── │
│  addDownloadToSubscription(                                             │
│    subscriptionId: string,                                              │
│    input: SubscriptionDownloadInput  {                                  │
│      id: string                                                         │
│      name: string                                                       │
│      size?: string                                                      │
│      speed?: string                                                     │
│      status?: string                                                    │
│      thumbnail_location?: string                                        │
│      date_added?: string                                                │
│    }                                                                    │
│  ) → void                                                               │
│                                                                         │
│  updateSubscriptionDownload(                                            │
│    subscriptionId: string,                                              │
│    downloadId: string,                                                  │
│    updates: Partial<Download>                                           │
│  ) → void                                                               │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                     EXPORTED HELPERS                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  filterSubscriptionsByStatusAndCategory(                                │
│    subscriptions: Subscription[],                                       │
│    statusFilter: StatusFilterSlug,                                      │
│    categoryFilter: CategoryFilterSlug                                   │
│  ) → Subscription[]                                                     │
│                                                                         │
│  filterChannelsByStatusAndCategory(   ← deprecated                      │
│    channels: ScheduledChannel[],                                        │
│    statusFilter: StatusFilterSlug,                                      │
│    categoryFilter: CategoryFilterSlug                                   │
│  ) → ScheduledChannel[]                                                 │
│                                                                         │
│  channelToSubscription(channel: ScheduledChannel) → Subscription        │
│                                                                         │
│  STATUS_FILTER_OPTIONS   → StatusFilterOption[]                         │
│  CATEGORY_FILTER_OPTIONS → CategoryFilterOption[]                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3b. subscriptionStore  (src/skedulosa/store/subscriptionStore.tsx)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          subscriptionStore                              │
│               (Zustand persist → 'subscription-store')                  │
│                   PURPOSE: Trial / expiration tracking                  │
├─────────────────────────────────────────────────────────────────────────┤
│  STATE                                                                  │
│    subscriptions: { id: string, expirationDate: Date }[]                │
│    expirationDate: Date  ← Trial expiry (currently 2026-03-29)          │
│                                                                         │
│  ACTIONS                                                                │
│    addSubscription({ id, expirationDate }) → void                       │
│    removeSubscription(id: string) → void                                │
│    getSubscriptions() → Subscription[]                                  │
│    getExpirationDate() → Date                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. UTILS LAYER

### 4a. subscriptionDownloadUtils.ts  (src/skedulosa/utils/)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    subscriptionDownloadUtils                            │
│              Storage, counts, timing, and heatmap analytics             │
├────────────────────────────────┬────────────────────────────────────────┤
│  FUNCTION                      │  SIGNATURE & RETURN                    │
├────────────────────────────────┼────────────────────────────────────────┤
│                                │                                        │
│  formatBytesToHuman            │  (bytes: number)                       │
│                                │  → string  e.g. "1.2 GB", "500 MB"    │
│                                │                                        │
│  getTotalStorageUsedBytes      │  (subscriptions: Subscription[])       │
│                                │  → number  (total bytes, all subs)     │
│                                │                                        │
│  getTotalStoragePerSubscription│  (subscriptions: Subscription[])       │
│                                │  → Record<subId, bytes>                │
│                                │                                        │
│  getTotalStorageForDownloads   │  (downloads: Download[])               │
│  ← USE THIS for single channel │  → number  (total bytes)               │
│                                │                                        │
│  getDownloadCountPerSubscription│ (subscriptions: Subscription[])       │
│                                │  → Record<subId, count>                │
│                                │                                        │
│  getLastDownloadedTimeAgoPerSub│  (subscriptions: Subscription[],       │
│                                │   now?: Date)                          │
│                                │  → Record<subId, string | null>        │
│                                │     e.g. "2 hours ago", null if empty  │
│                                │                                        │
│  getFinishedDownloadPercentPerSub│(subscriptions: Subscription[])       │
│                                │  → Record<subId, 0-100>                │
│                                │                                        │
│  getAverageSizeBytesPerSub     │  (subscriptions: Subscription[])       │
│                                │  → Record<subId, bytes>                │
│                                │                                        │
│  buildHeatMapFromDates         │  (dates: Array<Date | string>,         │
│                                │   now?: Date)                          │
│                                │  → HeatMapData {                       │
│                                │       grid: number[][]  [3×7]          │
│                                │       cells: HeatMapCell[]             │
│                                │       rows: ['morning','afternoon',    │
│                                │              'night']                  │
│                                │       columns: ['Mon'..'Sun']          │
│                                │     }                                  │
│                                │                                        │
│  buildHeatMapFromSubscriptionDl│  (subscriptions: Subscription[])       │
│                                │  → HeatMapData  (uses date_added)      │
│                                │                                        │
├────────────────────────────────┴────────────────────────────────────────┤
│  TYPES                                                                  │
│    TimeOfDayBucket  = 'morning' | 'afternoon' | 'night'                 │
│    DayOfWeekIndex   = 0 | 1 | 2 | 3 | 4 | 5 | 6  (Mon=0 … Sun=6)      │
│    HeatMapCell      = { dayOfWeek, timeOfDay, count }                   │
│    HeatMapData      = { rows, columns, grid, cells }                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4b. scheduleManagerUtils.ts  (src/skedulosa/utils/)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       scheduleManagerUtils                              │
│          Schedule formatting, progress, status display, and             │
│          converting download payloads into subscription inputs           │
├────────────────────────────────┬────────────────────────────────────────┤
│  FUNCTION                      │  SIGNATURE & RETURN                    │
├────────────────────────────────┼────────────────────────────────────────┤
│                                │                                        │
│  createSubscriptionDownloadInput│ (payload: SubscriptionDownloadPayload,│
│                                │  overrides?: Partial<SubscriptionDl…>) │
│                                │  → SubscriptionDownloadInput           │
│                                │                                        │
│  getScheduledDownloadsCountToday│ (subscriptions: Subscription[])       │
│                                │  → number  (downloads added today)     │
│                                │                                        │
│  formatSchedule                │  (entry: ScheduleEntry)                │
│                                │  → string                              │
│                                │  e.g. "Every Monday 6:00 AM"           │
│                                │       "Daily 6:00 AM"                  │
│                                │                                        │
│  formatNextRun                 │  (entry: ScheduleEntry, now?: Date)    │
│                                │  → string                              │
│                                │  e.g. "Tomorrow 6:00 AM"              │
│                                │       "in 2 hours"                     │
│                                │       "Mon 6:00 AM"                    │
│                                │                                        │
│  formatProgress                │  (downloads: Download[])               │
│                                │  → { text: string, percentage: number }│
│                                │  e.g. { text: "4 / 10", pct: 40 }     │
│                                │                                        │
│  formatStatus                  │  (status: string)                      │
│                                │  → ScheduleStatusDisplay               │
│                                │  Active   → "Running"                  │
│                                │  Paused   → "Pending"                  │
│                                │  Error    → "Missed"                   │
│                                │                                        │
├────────────────────────────────┴────────────────────────────────────────┤
│  TYPES                                                                  │
│    SubscriptionDownloadPayload = {                                      │
│      id: string                                                         │
│      name: string                                                       │
│      displayName?: string                                               │
│      size?: string                                                      │
│      speed?: string                                                     │
│      thumbnails?: object                                                │
│      status?: string                                                    │
│    }                                                                    │
│    ScheduleStatusDisplay = 'Running' | 'Pending' | 'Missed' | string   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4c. generateDummySubscription.ts  (src/skedulosa/utils/)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     generateDummySubscription                           │
│              Generates a full Subscription with fake data.              │
│              Used in SkedulosaUtilsDemoPage for testing.                │
├─────────────────────────────────────────────────────────────────────────┤
│  generateDummySubscription() → Subscription                             │
│    Sources:  youtube / vimeo / twitch / rumble / odysee                 │
│    Statuses: Active / Paused / Error / Needs Attention                  │
│    Includes: random downloads, schedule times, settings                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. SERVICE LAYER

### SubscriptionDownloadSyncService  (src/skedulosa/services/subscriptionDownloadSync.ts)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                  SubscriptionDownloadSyncService                        │
│                         (Singleton)                                     │
│                                                                         │
│   Bridges the core Downlodr download queue ↔ Skedulosa store.           │
│   When a subscription triggers a download, this service:               │
│    1. Registers the queued download                                     │
│    2. Tracks start / progress / completion                              │
│    3. Writes results back to useSkedulosaStore                          │
├─────────────────────────────────────────────────────────────────────────┤
│  ACCESS                                                                 │
│    import { subscriptionDownloadSync } from '…/subscriptionDownloadSync'│
│    // singleton — do not instantiate directly                           │
├────────────────────────────────┬────────────────────────────────────────┤
│  METHOD                        │  SIGNATURE                             │
├────────────────────────────────┼────────────────────────────────────────┤
│                                │                                        │
│  registerQueuedSubscription    │  (queueId: string,                     │
│  Download                      │   subscriptionId: string,              │
│                                │   downloadData: {                      │
│                                │     name: string,                      │
│                                │     displayName?: string,              │
│                                │     thumbnails?: object,               │
│                                │     size?: string,                     │
│                                │     speed?: string                     │
│                                │   }) → void                            │
│                                │                                        │
│  onDownloadStarted             │  (actualDownloadId: string,            │
│                                │   queuedDownload: QueuedDownload)      │
│                                │  → void                                │
│                                │  Writes to skedulosaStore with         │
│                                │  status 'initializing'                 │
│                                │                                        │
│  syncDownloadStatus            │  (downloadId: string,                  │
│                                │   updates: {                           │
│                                │     status?: string,                   │
│                                │     progress?: number,                 │
│                                │     speed?: string,                    │
│                                │     size?: string                      │
│                                │   }) → void                            │
│                                │  Throttled 1000ms for progress/speed   │
│                                │                                        │
│  onDownloadCompleted           │  (downloadId: string,                  │
│                                │   status: 'finished' | 'failed')       │
│                                │  → void                                │
│                                │                                        │
│  cleanup                       │  () → void                             │
│                                │  Clears all internal tracking maps     │
├────────────────────────────────┴────────────────────────────────────────┤
│  INTERNAL MAPS (O(1) lookup)                                            │
│    queueId       → { subscriptionId, downloadData }                    │
│    downloadId    → subscriptionId                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6. PAGE & COMPONENT REFERENCE

### Pages

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  PAGE                          │  STORE CONSUMED          │  UTILS USED          │
├──────────────────────────────────────────────────────────────────────────────────┤
│ SkedulosaSchedulePage          │ scheduledChannels        │ formatSchedule()      │
│   /skedulosa/schedule          │ statusFilter             │ formatNextRun()       │
│                                │ categoryFilter           │ formatProgress()      │
│                                │                          │ formatStatus()        │
├──────────────────────────────────────────────────────────────────────────────────┤
│ SkedulosaSubscriptionPage      │ subscriptions            │ getTotalStorage       │
│   /skedulosa/subscription      │ scheduledChannels        │ PerSubscription()     │
│                                │ statusFilter             │ formatBytesToHuman()  │
│                                │ categoryFilter           │                       │
├──────────────────────────────────────────────────────────────────────────────────┤
│ SkedulosaHistoryPage           │ subscriptions            │ formatDistanceToNow() │
│   /skedulosa/history           │                          │ (date-fns)            │
│                                │                          │ SpeedGraph (downlodr) │
├──────────────────────────────────────────────────────────────────────────────────┤
│ SelectedSubscriptionView       │ scheduledChannels        │ formatBytesToHuman()  │
│   /skedulosa/selected-         │ statusFilter             │ getTotalStorageFor    │
│    subscription/:channelId     │ categoryFilter           │  Downloads()          │
│                                │                          │ formatRelativeTime()  │
├──────────────────────────────────────────────────────────────────────────────────┤
│ SkedulosaSubscriptionDownloads │ subscriptions            │ none                  │
│   /skedulosa/subscription-     │                          │                       │
│    downloads                   │                          │                       │
├──────────────────────────────────────────────────────────────────────────────────┤
│ NoSchedulePage                 │ none                     │ none                  │
│   /skedulosa/no-schedule       │                          │                       │
├──────────────────────────────────────────────────────────────────────────────────┤
│ SkedulosaUtilsDemoPage         │ none (uses dummy data)   │ ALL utils             │
│   /skedulosa/utils-demo        │                          │ generateDummy…()      │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Components

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  COMPONENT                     │  STORE CONSUMED          │  UTILS USED          │
├──────────────────────────────────────────────────────────────────────────────────┤
│ SkedulosaNavigation            │ statusFilter             │ none                  │
│  (sidebar)                     │ categoryFilter           │                       │
│                                │ setStatusFilter()        │                       │
│                                │ setCategoryFilter()      │                       │
├──────────────────────────────────────────────────────────────────────────────────┤
│ SkedulosaTableTaskbar          │ subscriptions            │ getScheduledDownloads │
│  (stats bar)                   │                          │  CountToday()         │
│                                │                          │ getTotalStorageUsed   │
│                                │                          │  Bytes()              │
│                                │                          │ formatBytesToHuman()  │
├──────────────────────────────────────────────────────────────────────────────────┤
│ SkedulosaSubscribeModal        │ addSubscription()        │ none                  │
│  (add subscription form)       │ useSettingStore          │                       │
│                                │  (defaultLocation)       │                       │
├──────────────────────────────────────────────────────────────────────────────────┤
│ AddedSubscriptionModal         │ none                     │ none                  │
│  (success confirmation)        │                          │                       │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. DATA FLOW DIAGRAM

```
USER ADDS A SUBSCRIPTION
────────────────────────
User fills form in SkedulosaSubscribeModal
       │
       ▼
addSubscription(subscription: Subscription)
       │
       ▼
useSkedulosaStore.subscriptions[] updated
       │
       ▼  (auto-sync inside store)
useSkedulosaStore.scheduledChannels[] updated  ← legacy derived array
       │
       ├──► SkedulosaNavigation re-renders (guard no longer redirects)
       ├──► SkedulosaSchedulePage re-renders (reads scheduledChannels)
       ├──► SkedulosaSubscriptionPage re-renders (reads subscriptions)
       └──► SkedulosaTableTaskbar re-renders (reads subscriptions for stats)


DOWNLOAD TRIGGERED BY SCHEDULE
───────────────────────────────
Scheduler detects new content for subscription
       │
       ▼
subscriptionDownloadSync.registerQueuedSubscriptionDownload(
  queueId, subscriptionId, { name, size, … }
)
       │  (queued download registered in internal map)
       ▼
Core downlodr picks up queue → download starts
       │
       ▼
subscriptionDownloadSync.onDownloadStarted(
  actualDownloadId, queuedDownload
)
       │  (writes 'initializing' status to skedulosaStore)
       ▼
useSkedulosaStore.addDownloadToSubscription(subscriptionId, input)
       │
       ▼
As download progresses:
subscriptionDownloadSync.syncDownloadStatus(downloadId, { status, speed, size })
       │  (throttled 1000ms — not every frame)
       ▼
useSkedulosaStore.updateSubscriptionDownload(subscriptionId, downloadId, updates)
       │
       ▼
On finish/fail:
subscriptionDownloadSync.onDownloadCompleted(downloadId, 'finished' | 'failed')
       │
       ▼
useSkedulosaStore.updateSubscriptionDownload(..., { status: 'finished' | 'failed' })


READING / DISPLAYING DATA
──────────────────────────
Component needs subscription data
       │
       ├── For ALL subs with filters:
       │     useSkedulosaStore(s => s.subscriptions)
       │     + filterSubscriptionsByStatusAndCategory(subs, status, category)
       │
       ├── For a SINGLE channel (SelectedSubscriptionView):
       │     filteredChannels.find(ch => ch.channelId === channelId)
       │
       ├── For DISPLAY formatting:
       │     formatBytesToHuman(getTotalStorageForDownloads(channel.downloads))
       │     formatSchedule(entry)           → "Every Monday 6:00 AM"
       │     formatNextRun(entry)            → "Tomorrow 6:00 AM"
       │     formatProgress(channel.downloads) → { text: "4/10", percentage: 40 }
       │     formatStatus(channel.status)   → "Running" | "Pending" | "Missed"
       │
       └── For ANALYTICS (heatmap):
             buildHeatMapFromSubscriptionDownloads(subscriptions)
             → HeatMapData { grid[3][7], cells[], rows[], columns[] }
```

---

## 8. QUICK REFERENCE — WHICH FUNCTION TO USE

```
SCENARIO                              FUNCTION                         ARG TYPE
─────────────────────────────────────────────────────────────────────────────────
Show total storage for ONE channel    getTotalStorageForDownloads()    Download[]
Show total storage across ALL subs    getTotalStorageUsedBytes()       Subscription[]
Show storage per sub (map by id)      getTotalStoragePerSubscription() Subscription[]
Human-readable bytes string           formatBytesToHuman()             number (bytes)

Count downloads for ONE channel       channel.downloads.length         —
Count downloads per sub (map by id)   getDownloadCountPerSubscription()Subscription[]

Downloads added today                 getScheduledDownloadsCountToday()Subscription[]
Last download time per sub            getLastDownloadedTimeAgoPerSub() Subscription[]
Finished % per sub                    getFinishedDownloadPercentPerSub()Subscription[]
Average download size per sub         getAverageSizeBytesPerSub()      Subscription[]

Schedule display text                 formatSchedule()                 ScheduleEntry
Next run display text                 formatNextRun()                  ScheduleEntry, now?
Progress bar data                     formatProgress()                 Download[]
Status badge text                     formatStatus()                   string

Build analytics heatmap               buildHeatMapFromSubscriptionDl() Subscription[]
Filter subscriptions by UI filters    filterSubscriptionsByStatus…()   Subs[], Status, Category
```

---

## 9. CROSS-FEATURE DEPENDENCIES

```
skedulosa/
  ├── uses from downlodr/
  │     ├── SpeedGraph component         (SkedulosaHistoryPage)
  │     ├── formatRelativeTime()         (SelectedSubscriptionView)
  │     ├── iconMapper (getExtractorIcon)(SkedulosaSubscriptionPage)
  │     └── QueuedDownload type          (subscriptionDownloadSync.ts)
  │
  ├── uses from core-app/
  │     ├── useSettingStore (defaultLocation) (SkedulosaSubscribeModal)
  │     ├── Button, Input, RadioGroup, ToggleGroup components
  │     ├── TooltipWrapper component
  │     ├── BaseModal component
  │     └── useToast hook
  │
  └── external libraries
        ├── zustand + zustand/middleware/persist
        ├── react-router-dom (NavLink, Navigate, Outlet, useParams)
        ├── date-fns (formatDistanceToNow)
        └── react-icons (Bi, Bs, Fi, Lu icons)
```

---

*File: task-plan/skedulosa-feature-diagram.md*
*Last updated: 2026-03-17*
