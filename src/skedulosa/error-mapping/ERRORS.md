# Nemesis Error Reference

A complete mapping of every error Nemesis can produce, paired with a plain-language name and explanation.

---

## How to Read This Document

Each entry follows this structure:

| Field | Meaning |
|---|---|
| **Raw Error** | The exact internal error text Nemesis produces |
| **User-Friendly Name** | A short, plain-language label for the error |
| **What It Means** | A clear explanation of what went wrong and why |
| **What To Do** | Suggested next steps |

---

## Channel & URL Errors

---

### ERR-001

| | |
|---|---|
| **Raw Error** | `No channel URL provided.` / `Missing channel URL` |
| **User-Friendly Name** | **No Channel URL Entered** |
| **What It Means** | You tried to add or analyze a channel but left the URL field blank. Nemesis needs a valid YouTube channel URL to do anything. |
| **What To Do** | Enter a full YouTube channel URL (e.g. `https://www.youtube.com/@ChannelName`) and try again. |

---

### ERR-002

| | |
|---|---|
| **Raw Error** | `Failed to analyze channel: ${err.message}` |
| **User-Friendly Name** | **Channel Analysis Failed** |
| **What It Means** | Nemesis tried to look up the channel's details and upload history but something went wrong in the process. This can happen due to a network hiccup, a private/unavailable channel, or a temporary issue with YouTube. |
| **What To Do** | Check that the channel is public, verify your internet connection, and try again. If it keeps failing, the channel may be restricted or YouTube may be temporarily blocking requests. |

---

### ERR-003

| | |
|---|---|
| **Raw Error** | `Failed to fetch channel details: ${err.message}` |
| **User-Friendly Name** | **Could Not Load Channel Info** |
| **What It Means** | Nemesis was unable to retrieve basic information about the channel (name, description, video count, etc.). The channel may not exist, may be private, or there may be a connection problem. |
| **What To Do** | Double-check the channel URL is correct and the channel is publicly accessible. Try again after a moment. |

---

### ERR-004

| | |
|---|---|
| **Raw Error** | `Failed to fetch upload dates: ${err.message}` |
| **User-Friendly Name** | **Could Not Load Upload History** |
| **What It Means** | Nemesis tried to pull the list of video upload dates from the channel but the request failed. This is needed to figure out when the channel typically posts. |
| **What To Do** | Retry the operation. If this keeps happening, the channel may have upload history that is hidden or restricted. |

---

### ERR-005

| | |
|---|---|
| **Raw Error** | `Failed to fetch accurate timestamps: ${err.message}` |
| **User-Friendly Name** | **Could Not Get Precise Upload Times** |
| **What It Means** | Nemesis attempted to fetch exact upload timestamps for the channel's videos (not just dates, but times of day) and the request failed. Accurate timestamps are used to determine the best time to run scrapers. |
| **What To Do** | Try again. If the error persists, Nemesis will fall back to a less precise schedule automatically. |

---

## Download Errors

---

### ERR-006

| | |
|---|---|
| **Raw Error** | `Invalid video URL (missing or bad YouTube ID)` |
| **User-Friendly Name** | **Invalid Video URL** |
| **What It Means** | The video URL you provided doesn't look like a valid YouTube URL, or the video ID within it is malformed or missing. |
| **What To Do** | Make sure the URL is a standard YouTube video link (e.g. `https://www.youtube.com/watch?v=XXXXXXXXXXX` or `https://youtu.be/XXXXXXXXXXX`). |

---

### ERR-007

| | |
|---|---|
| **Raw Error** | `Could not extract video ID from URL` |
| **User-Friendly Name** | **Could Not Read Video ID** |
| **What It Means** | Nemesis found a URL but was not able to pull the unique video ID from it. This usually means the URL is in an unusual or unsupported format. |
| **What To Do** | Copy the video URL directly from your browser's address bar while on the YouTube video page and try again. |

---

### ERR-008

| | |
|---|---|
| **Raw Error** | `[download] spawn error for ${id}:` |
| **User-Friendly Name** | **Download Could Not Start** |
| **What It Means** | Nemesis tried to launch the download process for a video but failed before it even began. This often means the yt-dlp tool could not be started — it may be missing, corrupted, or blocked. |
| **What To Do** | Verify that yt-dlp is installed correctly and accessible. Restart Nemesis and try the download again. |

---

### ERR-009

| | |
|---|---|
| **Raw Error** | `[download] yt-dlp exit ${code} for ${id}:` |
| **User-Friendly Name** | **Download Failed — Tool Exited with an Error** |
| **What It Means** | The download started but yt-dlp stopped partway through and returned an error code. This can happen if the video is unavailable, age-restricted, deleted, or if there's a network interruption. |
| **What To Do** | Check if the video is still publicly available on YouTube. If it is, try downloading it again. Persistent failures may indicate the video has restrictions Nemesis cannot bypass. |

---

## Scraper / yt-dlp Errors

---

### ERR-010

| | |
|---|---|
| **Raw Error** | `yt-dlp timed out after ${N}s fetching channel details.` |
| **User-Friendly Name** | **Channel Info Request Timed Out** |
| **What It Means** | Nemesis waited up to 60 seconds for yt-dlp to fetch the channel's details, but it never got a response in time. The channel might be very large, or YouTube might be responding slowly. |
| **What To Do** | Try again later. If the channel has tens of thousands of videos, this may take longer than usual. |

---

### ERR-011

| | |
|---|---|
| **Raw Error** | `yt-dlp timed out after ${N}s fetching upload dates.` |
| **User-Friendly Name** | **Upload Date Request Timed Out** |
| **What It Means** | Nemesis tried to fetch video upload dates from YouTube but the request exceeded the 2-minute time limit. This usually happens with very large channels. |
| **What To Do** | Try again. Channels with large video libraries take longer to process. You can also try at a time when your internet connection is faster. |

---

### ERR-012

| | |
|---|---|
| **Raw Error** | `yt-dlp timed out fetching upload dates (flat-playlist).` |
| **User-Friendly Name** | **Quick Playlist Scan Timed Out** |
| **What It Means** | Nemesis tried to do a fast, lightweight scan of the channel's video list (called a flat-playlist) but it timed out. This pass is faster than a full scan, so a timeout here usually signals a very slow connection or a very large channel. |
| **What To Do** | Check your internet connection and try again. |

---

### ERR-013

| | |
|---|---|
| **Raw Error** | `yt-dlp timed out after ${N}s. Channel may be large or slow. Try increasing timeout.` |
| **User-Friendly Name** | **Scraper Timed Out — Channel Too Large or Too Slow** |
| **What It Means** | The scraper ran for the maximum allowed time (5 minutes) without finishing. The channel may have an unusually large number of videos, or YouTube is responding very slowly right now. |
| **What To Do** | Try again during off-peak hours. If this channel consistently times out, it may be too large for the default settings. |

---

### ERR-014

| | |
|---|---|
| **Raw Error** | `yt-dlp exit ${code}: ${stderr}` |
| **User-Friendly Name** | **Scraper Tool Returned an Error** |
| **What It Means** | yt-dlp ran but exited with a non-zero exit code, meaning something went wrong during the scrape. The exit code and error output (shown in logs) describe the specific cause. Common causes include rate-limiting from YouTube, a changed page structure, or an unavailable channel. |
| **What To Do** | Check the Nemesis logs for the specific yt-dlp error message. If YouTube rate-limited the request, wait a while before trying again. Make sure yt-dlp is up to date. |

---

### ERR-015

| | |
|---|---|
| **Raw Error** | `Failed to parse yt-dlp JSON output: ${stdout}` |
| **User-Friendly Name** | **Could Not Read Scraper Output** |
| **What It Means** | yt-dlp completed but the data it returned wasn't in the expected format — Nemesis couldn't understand the response. This usually means yt-dlp returned an error page or unexpected content instead of valid video data. |
| **What To Do** | Update yt-dlp to the latest version, then try again. If the problem persists, the channel's data format may have changed on YouTube's end. |

---

### ERR-016

| | |
|---|---|
| **Raw Error** | `[scraper] yt-dlp failed for channel ${channelId}:` |
| **User-Friendly Name** | **Channel Scrape Failed** |
| **What It Means** | The scraper ran for a specific channel but failed to complete. The error usually appears with more detail in the logs. |
| **What To Do** | Check the Nemesis log for more details. Ensure the channel is still active and your internet is working. |

---

### ERR-017

| | |
|---|---|
| **Raw Error** | `[scraper] failed to fetch full metadata for channel ${channelId}:` |
| **User-Friendly Name** | **Could Not Load Full Video Metadata** |
| **What It Means** | Nemesis completed the quick scan of a channel but failed during the deeper pass where it fetches full video details (titles, descriptions, durations, etc.). |
| **What To Do** | Try triggering a re-scrape of this channel. If the channel is very large, the full metadata pass may need more time. |

---

## Schedule & Intelligence Errors

---

### ERR-018

| | |
|---|---|
| **Raw Error** | `[intelligent-schedule] Error analyzing channel ${channelId}:` |
| **User-Friendly Name** | **Smart Schedule Analysis Failed** |
| **What It Means** | Nemesis tried to analyze the channel's upload history to build an intelligent scrape schedule, but something went wrong during the analysis. |
| **What To Do** | Try re-adding or re-analyzing the channel. If the issue continues, Nemesis will fall back to a manual or default schedule. |

---

### ERR-019

| | |
|---|---|
| **Raw Error** | `[intelligent-schedule] Error getting due channels:` |
| **User-Friendly Name** | **Could Not Load Channels Due for Scraping** |
| **What It Means** | Nemesis tried to fetch the list of channels that are scheduled to be scraped right now, but the database query failed. |
| **What To Do** | This is usually a temporary issue. Restart Nemesis if it keeps happening. |

---

### ERR-020

| | |
|---|---|
| **Raw Error** | `[intelligent-schedule] Error getting next schedule:` |
| **User-Friendly Name** | **Could Not Find Next Scheduled Scrape** |
| **What It Means** | Nemesis was unable to determine when the next scrape is supposed to run. This means the scheduler may not fire at the correct time. |
| **What To Do** | Open the schedule settings and verify the channel's schedule is configured correctly. Restarting Nemesis usually resolves this. |

---

### ERR-021

| | |
|---|---|
| **Raw Error** | `[intelligent-schedule] Error handling offline scenario:` |
| **User-Friendly Name** | **Offline Recovery Failed** |
| **What It Means** | Nemesis detected that it had been offline (e.g., the computer was shut down or sleeping) and tried to adjust the schedule to account for missed scrapes — but something went wrong during that recovery step. |
| **What To Do** | Manually trigger a scrape for any channels that may have been missed. Restarting Nemesis will reset the offline detection state. |

---

### ERR-022

| | |
|---|---|
| **Raw Error** | `[intelligent-schedule] Error getting channel schedule:` |
| **User-Friendly Name** | **Could Not Load Channel Schedule** |
| **What It Means** | Nemesis was unable to read the schedule data for a specific channel from its database. |
| **What To Do** | Check that the channel is still in your list and try refreshing. If the schedule is missing, you may need to re-analyze the channel. |

---

### ERR-023

| | |
|---|---|
| **Raw Error** | `[intelligent-schedule] Error refreshing all schedules:` |
| **User-Friendly Name** | **Schedule Refresh Failed** |
| **What It Means** | Nemesis tried to update and recalculate the scrape schedules for all channels but encountered an error. Some schedules may be stale. |
| **What To Do** | Try triggering a manual schedule refresh. If the problem persists, restarting Nemesis will force a full schedule rebuild on startup. |

---

### ERR-024

| | |
|---|---|
| **Raw Error** | `[intelligent-schedule] Error setting fallback for channel ${channelId}:` |
| **User-Friendly Name** | **Could Not Set Backup Schedule** |
| **What It Means** | When Nemesis can't build a smart schedule (e.g., not enough upload history), it tries to use a simple fallback schedule instead. This error means even the fallback couldn't be saved. |
| **What To Do** | Manually set a schedule for this channel. Check that the database is accessible and not corrupted. |

---

### ERR-025

| | |
|---|---|
| **Raw Error** | `[scraper] no schedules (intelligent or slot-based); stopping schedule loop` |
| **User-Friendly Name** | **No Active Schedules Found — Scraper Stopped** |
| **What It Means** | The scraper started its loop but found zero active schedules — no channels have been set up to scrape automatically. The scheduler has paused itself. |
| **What To Do** | Add at least one channel with an active schedule. The scheduler will automatically resume once a schedule exists. |

---

### ERR-026

| | |
|---|---|
| **Raw Error** | `[scraper] runScheduleLoop error:` |
| **User-Friendly Name** | **Scheduler Loop Crashed** |
| **What It Means** | The background scheduling loop that continuously checks when to run scrapes encountered an unexpected error and may have stopped. |
| **What To Do** | Restart Nemesis to restore the scheduling loop. Check the logs for more detail about what caused the crash. |

---

## Schedule Inference Errors

---

### ERR-027

| | |
|---|---|
| **Raw Error** | `Could not fetch channel videos.` |
| **User-Friendly Name** | **Could Not Load Videos for Pattern Detection** |
| **What It Means** | Nemesis tried to fetch the channel's video list so it could analyze upload patterns, but the request failed entirely. Without this data, no smart schedule can be built. |
| **What To Do** | Ensure the channel is public and your internet connection is working, then try again. |

---

### ERR-028

| | |
|---|---|
| **Raw Error** | `No upload times found in the last videos (or channel has no videos). Add run times manually.` |
| **User-Friendly Name** | **No Upload Times Available** |
| **What It Means** | Nemesis looked at the channel's recent videos but couldn't find any upload timestamps. This might mean the channel has no videos, or the upload times are hidden/unavailable. Without upload times, the smart scheduler can't detect a pattern. |
| **What To Do** | Set the scrape times manually in the schedule settings. |

---

### ERR-029

| | |
|---|---|
| **Raw Error** | `Only ${N} video(s) with dates; need at least ${MIN} to detect a pattern. Add run times manually.` |
| **User-Friendly Name** | **Not Enough Videos to Detect an Upload Pattern** |
| **What It Means** | The channel doesn't have enough upload history for Nemesis to reliably figure out when it posts. Nemesis needs a minimum number of videos with dates to detect a pattern (e.g. "posts every Tuesday"). |
| **What To Do** | Add this channel's scrape times manually. As the channel posts more videos over time, Nemesis may eventually be able to build a smart schedule automatically. |

---

### ERR-030

| | |
|---|---|
| **Raw Error** | `Gaps between uploads varied a lot (${min}–${max} days). No regular interval...` |
| **User-Friendly Name** | **Irregular Upload Schedule Detected** |
| **What It Means** | Nemesis analyzed the channel's upload history but found the gaps between videos are wildly inconsistent — ranging from just a few days to many days. There's no clear upload rhythm to lock onto. |
| **What To Do** | Set the scrape schedule manually for a frequency that makes sense for this channel (e.g., daily). The smart scheduler cannot reliably predict this channel's uploads. |

---

### ERR-031

| | |
|---|---|
| **Raw Error** | `Gaps between uploads didn't match a clear pattern...` |
| **User-Friendly Name** | **No Clear Upload Pattern Found** |
| **What It Means** | The channel uploads somewhat regularly but not on a consistent enough schedule for Nemesis to detect a reliable pattern (e.g., not clearly weekly, bi-weekly, or daily). |
| **What To Do** | Manually configure the scrape frequency that best matches this channel's general posting cadence. |

---

### ERR-032

| | |
|---|---|
| **Raw Error** | `Not enough uploads to detect interval.` |
| **User-Friendly Name** | **Too Few Uploads to Estimate Frequency** |
| **What It Means** | There aren't enough data points (videos) for Nemesis to estimate how often this channel posts. A minimum number of uploads is required to calculate a meaningful interval. |
| **What To Do** | Set a scrape interval manually. Check back after the channel has posted more videos. |

---

### ERR-033

| | |
|---|---|
| **Raw Error** | `Not enough videos to generate schedule` |
| **User-Friendly Name** | **Too Few Videos to Build a Schedule** |
| **What It Means** | Nemesis could not generate any schedule for this channel because it has too few videos overall. This is similar to ERR-032 but is the final failure point — no schedule of any kind could be produced. |
| **What To Do** | Create a schedule manually for this channel. |

---

## Internal / Data Errors

---

### ERR-034

| | |
|---|---|
| **Raw Error** | `[intelligent-schedule-data] Error getting schedule for channel ${channelId}:` |
| **User-Friendly Name** | **Database Read Failed — Channel Schedule** |
| **What It Means** | Nemesis tried to read a channel's schedule from its internal database but the query failed. This is usually a transient database error. |
| **What To Do** | Restart Nemesis. If the issue persists, the database file may be corrupted. |

---

### ERR-035

| | |
|---|---|
| **Raw Error** | `[intelligent-schedule-data] Error getting schedules:` / `Error getting all schedules:` |
| **User-Friendly Name** | **Database Read Failed — All Schedules** |
| **What It Means** | Nemesis failed to load the full list of scrape schedules from the database. The scheduler may not function correctly until this is resolved. |
| **What To Do** | Restart Nemesis. Check for any disk space or permission issues with the Nemesis data directory. |

---

### ERR-036

| | |
|---|---|
| **Raw Error** | `[intelligent-schedule-data] Error getting upcoming scrapes:` |
| **User-Friendly Name** | **Could Not Load Upcoming Scrapes** |
| **What It Means** | Nemesis failed to query which scrapes are coming up soon. The upcoming scrapes view in the UI may be empty or inaccurate. |
| **What To Do** | Restart Nemesis. This is typically a temporary database access issue. |

---

### ERR-037

| | |
|---|---|
| **Raw Error** | `[intelligent-schedule-data] Error getting overdue scrapes:` |
| **User-Friendly Name** | **Could Not Load Overdue Scrapes** |
| **What It Means** | Nemesis tried to find channels that missed their scheduled scrape time but couldn't query that data. Missed scrapes may not be caught up automatically. |
| **What To Do** | Restart Nemesis. If channels seem stuck, try manually triggering a scrape. |

---

### ERR-038

| | |
|---|---|
| **Raw Error** | `[intelligent-schedule-data] Error getting stats:` |
| **User-Friendly Name** | **Could Not Load Schedule Statistics** |
| **What It Means** | Nemesis failed to compute schedule stats (e.g., total channels tracked, scrapes completed, etc.). The stats panel in the UI may be empty or blank. |
| **What To Do** | This is a display-only issue and does not affect scraping. Restart Nemesis to restore the stats view. |

---

## Download Task Statuses (Not Errors, But Listed for Reference)

These are status states a download task can be in, not error conditions themselves — but they are useful for understanding what you're seeing.

| Status | User-Friendly Label | What It Means |
|---|---|---|
| `pending` | Queued | The download is waiting in line and hasn't started yet. |
| `downloading` | Downloading | The video is actively being downloaded right now. |
| `downloaded` | Complete | The video finished downloading successfully. |
| `download_failed` | Download Failed | The download started but did not complete. See the error details for the specific reason. |

---

*This document reflects all known error paths in the current Nemesis codebase. If you encounter an error not listed here, please report it.*
