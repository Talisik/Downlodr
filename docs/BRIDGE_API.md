# Video Nemesis Toolkit — Bridge API Reference

## What the APIs Actually Do

### The Setup Call: `registerVideoNemesisIpcHandlers`

This is the only thing you call to wire the entire toolkit. It opens the SQLite DB, runs migrations to create all tables, instantiates a `DownloadWorker` and a `YouTubeChannelScraper` in memory, and then registers every IPC channel handler against Electron's `ipcMain`. After this call the workers exist but are **not running** — you have to start them explicitly. The `sendToRenderer` callback you pass in is how the toolkit pushes events back to the renderer without the renderer having to poll.

---

### Channel Management

**`toolkit:channels:create`** — Saves a YouTube channel to the DB with all its filtering rules. The key fields are `url` (the channel URL), `schedule_id` (which schedule group it belongs to), and the word filters (`all_words`, `any_words`, `none_words`). These word filters are checked against video titles at scrape time — if a video title doesn't match the rules, it gets skipped and never queued for download. You can also set duration limits (`min_duration_minutes`, `max_duration_minutes`) to only queue videos in a certain length range. `first_scrape_limit` caps how many videos get pulled on the very first scrape so you don't accidentally queue a channel's entire backlog.

**`toolkit:channels:update`** — Patches any of those fields on an existing channel without touching the rest.

**`toolkit:channels:setActive`** — Flips a channel on or off. Inactive channels are completely skipped by the scraper — it's a soft-disable without deleting it.

**`toolkit:channels:list`** — Returns all channels, optionally filtering to only active ones or only channels belonging to a specific schedule.

---

### Schedules

Schedules are just **grouping containers** for channels. They don't have timing logic themselves — that lives in the channel slots or the intelligent schedule. A schedule is basically a named bucket. You create one, get back its `id`, then attach channels to it via `schedule_id` on channel create. The `schedules:list` endpoint returns schedules enriched with when the next scrape will fire, pulled from the slot data.

---

### Channel Slots (Manual Schedule)

Slots are the **manual scheduling system** — you define "scrape this channel every Tuesday at 3pm" by adding a slot with `day_of_week: 2` and `time_minutes: 900`. The scraper checks these when it wakes up and runs any channel that has a slot matching the current day/time (within a 15-minute window by default).

**`toolkit:channelSlots:replace`** — The main one you'll use. Wipes all existing slots for a channel and saves a new set in one call. Use this when the user edits their schedule.

**`toolkit:channelSlots:add`** — Adds a single slot without touching others. Useful for incrementally adding scrape times.

**`toolkit:channelSlots:getNextRun`** — Looks at both manual slots AND the intelligent schedule and returns whichever fires soonest as an ISO timestamp. Good for showing the user "next scrape in 2h 14m".

---

### Channel Analysis & Intelligent Schedule

This is the ML-ish scheduling path. Instead of you manually defining "scrape Tuesdays at 3pm", the toolkit figures out when a channel typically uploads and predicts the next scrape time automatically.

**`toolkit:channelAnalyze:schedule`** — The preview/analysis step. You hand it a channel URL, it calls yt-dlp to fetch up to 50 recent videos, looks at their upload timestamps, and runs `IntelligentScheduleService.analyzeTimestamps()` on them. It detects patterns (daily, weekly, twice-weekly, etc.), returns a `confidence` score, tells you if the channel is erratic, gives you `suggestedSlots` (the median upload time per day of week, for if you want to fall back to manual mode), and gives you `nextScrapeTime` — a prediction of when the channel will upload next. **Nothing is saved to DB by this call** — it's just analysis.

**`toolkit:channelFetch:accurateTimestamps`** — A slower variant that fetches only 10 videos but uses `fullMetadata: true` in yt-dlp, which gives exact upload times instead of date-only approximations. The standard analyze call detects if timestamps are date-only (all midnight UTC) and automatically triggers this as a second pass, but you can call it manually too if you need precision.

**`toolkit:channelAnalysisVideos:save`** — This is what actually commits the analysis to the DB and activates the intelligent schedule. You pass it the channel's DB id and the array of videos from the analyze call. It upserts those videos into `channel_analysis_videos`, then calls `IntelligentScheduleService.updateChannelSchedule()` which reads all stored timestamps, runs `YouTubeSmartScheduler.analyze()`, and writes the prediction into the `intelligent_schedule` table. From this point on the scraper will use this prediction to know when to wake up.

---

### Intelligent Schedule Queries

These are read-only windows into the intelligent schedule table.

**`toolkit:intelligentSchedule:get`** — Returns the prediction row for one channel: the predicted `next_scrape_time`, the detected `pattern` (e.g. `"weekly"`, `"twice-weekly"`), `confidence` (0–1), `expected_videos`, and whether the channel is `is_erratic`.

**`toolkit:intelligentSchedule:getUpcoming`** — All channels with a predicted scrape within the next N hours (default 24). Useful for a dashboard that shows "what's coming up".

**`toolkit:intelligentSchedule:getOverdue`** — Channels whose predicted scrape time has already passed. These will be scraped immediately when the scraper next runs.

**`toolkit:intelligentSchedule:refreshAll`** — Re-runs the analysis algorithm over all stored `channel_analysis_videos` and rewrites every channel's prediction. Expensive, run sparingly.

---

### Scraper Control

The `YouTubeChannelScraper` is a background loop that lives in the main process. It does a **two-pass scrape**: pass 1 is a fast flat-playlist scan to find new video IDs; pass 2 fetches full metadata only for the new videos to get accurate timestamps. After scraping, it saves new videos to `download_tasks` as `pending`, updates the `channel_analysis_videos` table, and calls `updateChannelSchedule` to refine the prediction. Then it goes back to sleep until the next predicted scrape time.

**`toolkit:scraper:start`** — Starts the loop. On startup it runs `handleOfflineScenario` first, which detects any channels that were due while the app was closed and reschedules them progressively (the most overdue in 2 minutes, others staggered up to 2 hours). Then it either uses a fixed `pollIntervalMs` (legacy poll mode) or the smarter schedule-loop mode where it sleeps until the next actual predicted scrape time.

**`toolkit:scraper:stop`** — Cleanly cancels the sleep timer and interval, closes the DB connection.

**`toolkit:scraper:runOnce`** — Triggers one scrape cycle immediately, optionally for a specific channel ID.

- When a **channel ID is provided** (`runOnce(channelId)`):
  - Only that channel is considered for scraping (subject to `channelCheckIntervalMs` and active/schedule checks).
  - After the run, the toolkit queries `download_task` for **pending tasks belonging to that channel only** and pushes those via the `downloadQueue:pushed` event.
- When **no channel ID is given** (`runOnce()`):
  - Runs in "schedule-driven mode": checks intelligent schedule first, then falls back to slot-based schedule.
  - All due channels may be scraped, and the subsequent `downloadQueue:pushed` event includes **all pending tasks across all channels**.
  - A channel that was scraped within `channelCheckIntervalMs` (default 30 min) is skipped even if it appears due.

---

### Download Worker Control

The `DownloadWorker` polls `download_tasks` for rows with `status = 'pending'` and calls yt-dlp to download them. It runs entirely independently of the scraper.

**`toolkit:downloadWorker:start`** / **`toolkit:downloadWorker:stop`** — Start/stop the polling loop. The worker does NOT auto-start — you must call start explicitly.

**`toolkit:downloadWorker:getStatus`** — Returns `{ running: boolean }`. Note this is the in-memory flag set when you call start/stop, not an actual process check.

---

### Download Tasks & History

**`toolkit:downloadTasks:add`** — Manually enqueue a specific video URL for download. The scraper does this automatically for discovered videos, but you can also use this to let users paste a URL.

**`toolkit:downloadTasks:list`** — All tasks, optionally filtered by status (`pending`, `downloading`, `downloaded`, `failed`).

**`toolkit:downloadTasks:markFinished`** — Marks a task as `downloaded`. The worker does this automatically on success, but you'd call this manually if you handle the download yourself.

**`toolkit:downloadHistory:list`** — The completed downloads log. Supports filters you can pass to scope results.

---

### Channel Metadata Helpers

**`toolkit:channel:fetchDetails`** — Calls yt-dlp to scrape the channel page and returns `name`, `avatar`, `subscribers`, and `videoCount`. Used to populate channel info when a user first adds a URL.

**`toolkit:channel:fetchUploadDates`** — Returns a flat list of upload date strings (`YYYY-MM-DD HH:mm:ss UTC`) for a channel going back N days (default 90). Useful for rendering a calendar or heat map of upload activity.

---

### Weekly View & Monitoring

**`toolkit:schedule:getThisWeekSched`** — Returns every scrape event that will happen this week (Mon–Sun), merging both manual slot events and intelligent schedule predictions into one sorted list. Each event has the channel name, id, time, and whether its source is `"manual"` or `"intelligent"`.

**`toolkit:process:load`** — Returns the Node process's current RSS memory, heap usage, and CPU user/system time. Pure diagnostics.

---

## Setup Flow: Scheduled Scraping + Downloading

The sequence of calls needed to get the full pipeline working from a user adding a channel to videos being downloaded.

```
1. schedules:create({ name: "My Schedule" })
   → returns { id: 1 }

   This is just the container. You need at least one.

2. channel:fetchDetails(channelUrl)
   → returns { name, avatar, subscribers, videoCount }

   Use this to show the user what channel they're adding
   before saving anything.

3. channelAnalyze:schedule(channelUrl)
   → returns { intelligentPrediction, suggestedSlots, videoCount, message }

   This tells you:
   - When the channel typically uploads (nextScrapeTime, pattern)
   - How confident the prediction is
   - Whether the channel is erratic (meaning manual slots might be better)
   - suggestedSlots ready to pass directly to channelSlots:replace

   If videoCount < 3, prediction failed — you'll need to fall
   back to manual slot entry.

4. channels:create({
     schedule_id: 1,
     url: channelUrl,
     name: "Channel Name",
     first_scrape_limit: 5,        // don't backfill the whole history
     min_duration_minutes: 3,      // skip shorts
     download_format: "mp4",
     active: 1
   })
   → returns { id: 7 }

5a. IF using intelligent schedule (prediction was confident):
    channelAnalysisVideos:save(channelId, videosFromStep3)
    → This saves the analysis data and writes the first intelligent
      schedule prediction. The scraper will now know when to wake up.

5b. IF using manual slots (erratic channel or user preference):
    channelSlots:replace(channelId, suggestedSlots)
    → Or let the user pick their own slots and pass those instead.

6. scraper:start()
   → Starts the scrape loop. It will immediately check for overdue
     channels (offline recovery), then sleep until the next
     predicted or slot-based scrape time.

7. downloadWorker:start()
   → Starts polling download_tasks for pending items. Run this
     in parallel with step 6 — they're independent.
```

### What Happens Automatically After Setup

```
Scraper wakes at predicted time
→ scrapes channel for new videos
→ filters by duration/word rules
→ inserts into download_tasks as "pending"
→ pushes downloadQueue:pushed event to renderer (if sendToRenderer configured)
→ updates channel_analysis_videos with new timestamps
→ refines next intelligent schedule prediction
→ goes back to sleep

DownloadWorker polls every pollIntervalMs
→ picks up pending tasks
→ calls yt-dlp to download
→ marks task as "downloaded"
```

> **Key insight:** Step 5a is what activates the intelligent scheduler. Without it, the scraper has no prediction and will stop its schedule loop. If you skip it and only do 5b, the scraper runs on the manual slot timing instead. Both work, but intelligent mode will progressively get more accurate as it accumulates more upload timestamps from actual scrapes.
