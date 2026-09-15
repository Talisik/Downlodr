# Video Nemesis Toolkit – Subscription Flow

This document covers the end-to-end flow for subscribing to a YouTube channel and having it automatically scraped at designated times. Two modes are supported: **Intelligent** (AI-predicted schedule) and **Manual** (user-picked times).

---

## App Startup (required for both modes)

Start the scraper and download worker once when the Electron app is ready. Without this, no scraping or downloading happens automatically.

```ts
await invoke('toolkit:scraper:start');
await invoke('toolkit:downloadWorker:start');
```

To listen for live updates in the renderer:

```ts
// New videos queued after a scrape
window.toolkit.onDownloadQueuePushed((tasks) => {
  console.log('New download tasks:', tasks);
});

// Scraper phase changes (sleeping / running / finished / idle)
window.toolkit.onScraperStatus(({ phase, nextRunAt }) => {
  console.log('Scraper:', phase, nextRunAt);
});
```

---

## Mode A — Intelligent Schedule (AI-predicted)

The package analyzes the channel's upload history and predicts the next scrape time automatically.

### Step 1 — Analyze the channel

Call this when the user enters a channel URL. No data is saved yet.

**IPC:** `toolkit:channelAnalyze:schedule`

```ts
const result = await invoke('toolkit:channelAnalyze:schedule', channelUrl);
```

**Returns:**
```ts
{
  intelligentPrediction: {
    nextScrapeTime: "2026-03-25T14:00:00Z",  // predicted next scrape
    pattern: "Every 3 days",                  // human-readable upload pattern
    confidence: 0.85,                         // 0–1; higher = more reliable
    expectedVideos: 2,                        // expected new videos per scrape
    isErratic: false                          // true = unpredictable schedule
  },
  suggestedSlots: [                           // for manual mode fallback
    { day_of_week: 1, time_minutes: 840 },
    { day_of_week: 4, time_minutes: 840 }
  ],
  videoCount: 50,                             // videos analyzed
  message: "Schedule analysis complete"
}
```

Show `intelligentPrediction.pattern`, `confidence`, and `nextScrapeTime` to the user for confirmation.

---

### Step 2 — Create a schedule container

A schedule is a named group that channels belong to. Create one per logical group (e.g. "Tech Channels"). Reuse existing ones by calling `toolkit:schedules:list` first.

**IPC:** `toolkit:schedules:create`

```ts
const schedule = await invoke('toolkit:schedules:create', { name: "My Subscriptions" });
// → { id: 1, name: "My Subscriptions" }
```

---

### Step 3 — Create the channel

Links the channel URL to a schedule. All filter options are optional.

**IPC:** `toolkit:channels:create`

```ts
const channel = await invoke('toolkit:channels:create', {
  schedule_id: schedule.id,
  url: "https://youtube.com/@SomeChannel",
  name: "SomeChannel",

  // Optional filters
  download_format: "mp4",           // default: "mp4"
  download_subtitles: 0,            // 1 = yes
  download_thumbnails: 0,           // 1 = yes
  min_duration_minutes: null,       // ignore short videos
  max_duration_minutes: null,       // ignore long videos
  all_words: [],                    // title must contain ALL these words
  any_words: [],                    // title must contain ANY of these words
  none_words: [],                   // title must NOT contain these words
  first_scrape_limit: 5,            // how many videos to fetch on first scrape
});
// → { id: 7, schedule_id: 1, url: "...", name: "SomeChannel", ... }
```

---

### Step 4 — Save analysis videos (seeds the intelligent schedule)

This is what actually writes the prediction into the database so the scraper knows when to wake up. **Do not skip this step.** Pass the videos from the analyze result.

**IPC:** `toolkit:channelAnalysisVideos:save`

```ts
// `videos` comes from the analyze call's raw video list
await invoke('toolkit:channelAnalysisVideos:save', channel.id, videos);
```

Internally this calls `updateChannelSchedule()` which writes a row to `intelligent_schedule` with `next_scrape_time`. The scraper reads this table to decide when to run.

---

### What happens automatically after setup

```
[next_scrape_time arrives]
       ↓
Scraper wakes → yt-dlp fetches channel → filters new videos
       ↓
New video URLs → download_task table (status = 'pending')
       ↓
toolkit:downloadQueue:pushed event fires → renderer updated
       ↓
DownloadWorker picks up task → yt-dlp downloads file
       ↓
Scraper re-analyzes upload pattern → updates next_scrape_time
```

---

## Mode B — Manual Schedule (user-picked times)

The user picks specific days and times. No AI analysis needed.

### Step 1 — Create schedule + channel

Same as Mode A Steps 2 and 3 above.

```ts
const schedule = await invoke('toolkit:schedules:create', { name: "My Subscriptions" });

const channel = await invoke('toolkit:channels:create', {
  schedule_id: schedule.id,
  url: "https://youtube.com/@SomeChannel",
  name: "SomeChannel",
  download_format: "mp4",
});
```

---

### Step 2 — Save manual slots

Convert user-picked times to `day_of_week` (0 = Sunday … 6 = Saturday) and `time_minutes` (minutes since midnight, 0–1439). This call **replaces** all existing slots for the channel.

**IPC:** `toolkit:channelSlots:replace`

```ts
await invoke('toolkit:channelSlots:replace', channel.id, [
  { day_of_week: 1, time_minutes: 540 },   // Monday 9:00 AM  (9 * 60)
  { day_of_week: 4, time_minutes: 840 },   // Thursday 2:00 PM (14 * 60)
]);
```

To add a single slot without clearing existing ones use `toolkit:channelSlots:add`:

```ts
await invoke('toolkit:channelSlots:add', channel.id, 1, 540);
//                                                    ^day ^time_minutes
```

**Do NOT call `toolkit:channelAnalysisVideos:save`** in manual mode — slots and intelligent schedules are independent systems.

---

### What happens automatically after setup

```
[Monday 9:00 AM arrives (± 15 min window)]
       ↓
Scraper wakes → yt-dlp fetches channel → ALL new videos queued (no upload-window filter)
       ↓
download_task rows inserted → DownloadWorker downloads files
       ↓
Scraper sleeps until Thursday 2:00 PM
```

> **Note:** In manual mode the slots control **when to scrape**, not which videos are accepted.
> Every new video found since the last scrape gets queued regardless of when it was uploaded.

---

## Comparison

| | Intelligent | Manual |
|---|---|---|
| Trigger | `intelligent_schedule.next_scrape_time` | `channel_slots` day + time match |
| Adapts over time | Yes — re-analyzes after each scrape | No — fixed recurring schedule |
| Video filter | Only videos in predicted upload window | All new videos |
| Offline recovery | Adaptive staggered backoff on restart | Past-due slot check on restart |
| Required setup call | `toolkit:channelAnalysisVideos:save` | `toolkit:channelSlots:replace` |
| Skip analysis step | No — scraper won't know when to run | Yes — no analysis needed |

---

## Useful IPC calls for UI

| Purpose | IPC Channel | Args |
|---|---|---|
| List all schedules | `toolkit:schedules:list` | — |
| List channels in a schedule | `toolkit:channels:list` | `activeOnly?, scheduleId?` |
| Get next scrape time | `toolkit:channelSlots:getNextRun` | — |
| Get intelligent schedule for channel | `toolkit:intelligentSchedule:get` | `channelId` |
| Get upcoming scrapes | `toolkit:intelligentSchedule:getUpcoming` | `hoursAhead?` (default 24) |
| Toggle channel on/off | `toolkit:channels:setActive` | `channelId, active (bool)` |
| Fetch channel name/avatar | `toolkit:channel:fetchDetails` | `channelUrl` |
| Run scraper immediately | `toolkit:scraper:runOnce` | `channelId?` |
| List pending download tasks | `toolkit:downloadTasks:list` | `status?` |
| List download history | `toolkit:downloadHistory:list` | `filters?` |

---

## Time conversion helpers

```ts
// User time "14:30" → time_minutes
function toTimeMinutes(hh: number, mm: number): number {
  return hh * 60 + mm;
}

// time_minutes → display string
function fromTimeMinutes(minutes: number): string {
  const hh = Math.floor(minutes / 60).toString().padStart(2, '0');
  const mm = (minutes % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

// day_of_week labels (0=Sun)
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
```
