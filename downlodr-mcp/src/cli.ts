/**
 * Downlodr CLI
 *
 * Command names match the chatHandler tool names 1-to-1 so that skill .md
 * files can reference `downlodr <tool_name> [args]` directly.
 *
 * Each command calls the same bridge endpoint that chatHandler.executeTool()
 * calls — bypassing the MCP layer entirely.
 */

import { Command } from 'commander';
import os from 'os';
import path from 'path';
import { bridgeGet, bridgePost } from './client.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function print(data: unknown) {
  console.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
}

function fatal(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(1);
}

function parseIntList(val: string): number[] {
  return val.split(',').map((v) => parseInt(v.trim(), 10));
}

// ── CLI root ──────────────────────────────────────────────────────────────────

export function buildCli(): Command {
  const program = new Command('downlodr');
  program
    .description('Downlodr CLI — control the Downlodr app from your terminal')
    .version('1.0.0');

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  // get_app_status
  program
    .command('get_app_status')
    .description('Check if Downlodr is running and ready')
    .action(async () => {
      try { print(await bridgeGet('/status')); } catch (e) { fatal(e); }
    });

  // get_system_info
  program
    .command('get_system_info')
    .description('Get CPU, memory, OS, and app version for the machine running Downlodr')
    .action(async () => {
      try { print(await bridgeGet('/system/info')); } catch (e) { fatal(e); }
    });

  // get_download_folder
  program
    .command('get_download_folder')
    .description('Get the default Downloads folder path on this machine')
    .action(() => {
      print({ folder: path.join(os.homedir(), 'Downloads') });
    });

  // ═══════════════════════════════════════════════════════════════════════════
  // CORE DOWNLOADS
  // ═══════════════════════════════════════════════════════════════════════════

  // get_video_info
  program
    .command('get_video_info')
    .description('Fetch metadata and available formats for a video URL')
    .argument('<url>', 'Video URL')
    .action(async (url: string) => {
      try { print(await bridgeGet('/downloads/info', { url })); } catch (e) { fatal(e); }
    });

  // get_playlist_info
  program
    .command('get_playlist_info')
    .description('Fetch metadata for a playlist URL')
    .argument('<url>', 'Playlist URL')
    .action(async (url: string) => {
      try { print(await bridgeGet('/downloads/playlist', { url })); } catch (e) { fatal(e); }
    });

  // get_ytdlp_version
  program
    .command('get_ytdlp_version')
    .description('Show the yt-dlp version installed in Downlodr')
    .action(async () => {
      try { print(await bridgeGet('/downloads/ytdlp-version')); } catch (e) { fatal(e); }
    });

  // queue_download
  program
    .command('queue_download')
    .description('Queue a video in the to-download list — it does NOT start downloading (use download_video for that). Prerequisites: call get_video_info first, then get_download_folder to build outputFilepath')
    .argument('<url>', 'Video URL')
    .requiredOption('--output <path>', 'Full output file path including filename and extension')
    .option('--format <fmt>', 'yt-dlp format string (default: bestvideo+bestaudio/best)', 'bestvideo+bestaudio/best')
    .option('--audio-ext <ext>', 'Audio container extension for merging, e.g. m4a or mp3')
    .option('--limit-rate <rate>', 'Speed cap e.g. 5M for 5 MB/s')
    .action(async (url: string, opts: { output: string; format: string; audioExt?: string; limitRate?: string }) => {
      try {
        print(await bridgePost('/downloads/queue', {
          url,
          outputFilepath: opts.output,
          videoFormat: opts.format,
          ...(opts.audioExt ? { audioExt: opts.audioExt } : {}),
          ...(opts.limitRate ? { limitRate: opts.limitRate } : {}),
        }));
      } catch (e) { fatal(e); }
    });

  // download_video
  program
    .command('download_video')
    .description('Download a video for real (queue_download only queues). Prerequisites: call get_video_info first, then get_download_folder to build --output')
    .argument('<url>', 'Video URL')
    .requiredOption('--output <path>', 'Full output file path including filename and extension')
    .option('--quality <q>', 'best (default), a resolution like 1080p, worst, or audio/mp3 for audio only', 'best')
    .option('--limit-rate <rate>', 'Speed cap e.g. 5M for 5 MB/s')
    .option('--thumbnail', 'Pre-tick Save thumbnail on the card')
    .option('--transcript', 'Pre-tick Save transcript on the card (existing subtitle track, not a transcription)')
    .action(async (url: string, opts: { output: string; quality: string; limitRate?: string; thumbnail?: boolean; transcript?: boolean }) => {
      try {
        print(await bridgePost('/downloads/download-now', {
          url,
          outputFilepath: opts.output,
          quality: opts.quality,
          ...(opts.limitRate ? { limitRate: opts.limitRate } : {}),
          ...(opts.thumbnail ? { getThumbnail: true } : {}),
          ...(opts.transcript ? { getTranscript: true } : {}),
        }));
      } catch (e) { fatal(e); }
    });

  // download_videos
  program
    .command('download_videos')
    .description('Download up to 6 videos behind one confirmation card. Prerequisites: get_video_info for every url, then get_download_folder')
    .requiredOption('--items <json>', 'JSON array of {url, outputFilepath}, at most 6')
    .option('--quality <q>', 'best (default), 1080p, worst, or audio/mp3', 'best')
    .option('--limit-rate <rate>', 'Speed cap e.g. 5M')
    .option('--thumbnail', 'Pre-tick Save thumbnail on the card')
    .option('--transcript', 'Pre-tick Save transcript on the card (existing subtitle track, not a transcription)')
    .option('--chunk <i/n>', 'Chunk label for runs longer than 6, e.g. 2/4')
    .option('--duplicates-removed <n>', 'How many duplicate links you dropped, so the card can say so')
    // Accepted so the documented command line is valid on this binary too, but
    // not forwarded: the gate that reads it lives in the embedded agent's
    // in-process dispatch (chatHandler's download_videos case), and the bridge
    // endpoint this path POSTs to has no such check. An agent that learned the
    // flag from the docs must not hit "unknown option" when the real CLI runs it.
    .option('--confirmed', 'You have already shown the user the list of videos')
    .action(async (opts: {
      items: string;
      quality: string;
      limitRate?: string;
      thumbnail?: boolean;
      transcript?: boolean;
      chunk?: string;
      duplicatesRemoved?: string;
      confirmed?: boolean;
    }) => {
      try {
        const items = JSON.parse(opts.items);
        if (!Array.isArray(items)) {
          fatal('--items must be a JSON array of {url, outputFilepath}.');
        }
        if (items.length === 0 || items.length > 6) {
          fatal(
            `--items has ${items.length} entries; download_videos takes 1-6. ` +
              'Split into chunks of 6 and call this once per chunk with --chunk i/n.',
          );
        }
        const [index, total] = (opts.chunk ?? '').split('/').map(Number);
        const duplicatesRemoved = Number(opts.duplicatesRemoved);
        print(await bridgePost('/downloads/download-now', {
          items,
          quality: opts.quality,
          ...(opts.limitRate ? { limitRate: opts.limitRate } : {}),
          ...(opts.thumbnail ? { getThumbnail: true } : {}),
          ...(opts.transcript ? { getTranscript: true } : {}),
          ...(index && total ? { chunk: { index, total } } : {}),
          ...(Number.isFinite(duplicatesRemoved) && duplicatesRemoved > 0 ? { duplicatesRemoved } : {}),
        }));
      } catch (e) { fatal(e); }
    });

  // stop_download
  program
    .command('stop_download')
    .description('Stop/cancel a download by its list ID (downloading, paused, queued, or to-download). Use list_downloads to get the id')
    .argument('<id>', 'Download ID from list_downloads')
    .action(async (id: string) => {
      try { print(await bridgePost('/downloads/command', { action: 'stop', id })); } catch (e) { fatal(e); }
    });

  // pause_download
  program
    .command('pause_download')
    .description('Pause an active download by its list ID. Does NOT toggle: pausing an already-paused download is an error. Use list_downloads to get the id')
    .argument('<id>', 'Download ID from list_downloads')
    .action(async (id: string) => {
      try { print(await bridgePost('/downloads/command', { action: 'pause', id })); } catch (e) { fatal(e); }
    });

  // resume_download
  program
    .command('resume_download')
    .description('Resume a paused download by its list ID. Does NOT toggle: resuming a download that is not paused is an error')
    .argument('<id>', 'Download ID from list_downloads')
    .action(async (id: string) => {
      try { print(await bridgePost('/downloads/command', { action: 'resume', id })); } catch (e) { fatal(e); }
    });

  // start_queued_download
  program
    .command('start_queued_download')
    .description('Start a video that is sitting in the to-download list (the complement to queue_download). The row must already have a format selected')
    .argument('<id>', 'Download ID from list_downloads')
    .option('--limit-rate <rate>', 'Speed cap e.g. 5M for 5 MB/s')
    .action(async (id: string, opts: { limitRate?: string }) => {
      try {
        print(await bridgePost('/downloads/command', {
          action: 'start_queued',
          id,
          ...(opts.limitRate ? { limitRate: opts.limitRate } : {}),
        }));
      } catch (e) { fatal(e); }
    });

  // pause_all_downloads
  program
    .command('pause_all_downloads')
    .description('Pause every active download. Returns how many were paused')
    .action(async () => {
      try { print(await bridgePost('/downloads/command', { action: 'pause_all' })); } catch (e) { fatal(e); }
    });

  // resume_all_downloads
  program
    .command('resume_all_downloads')
    .description('Resume every paused download. Returns how many were resumed')
    .action(async () => {
      try { print(await bridgePost('/downloads/command', { action: 'resume_all' })); } catch (e) { fatal(e); }
    });

  // stop_all_downloads
  program
    .command('stop_all_downloads')
    .description('Stop every active and queued download. Destructive: stopped downloads leave the list and must be restarted from scratch')
    .action(async () => {
      try { print(await bridgePost('/downloads/command', { action: 'stop_all' })); } catch (e) { fatal(e); }
    });

  // stop_download_controller (headless fallback only)
  program
    .command('stop_download_controller')
    .description('Cancel a headless/standalone download by its controllerId (only downloads started via the headless fallback return one)')
    .argument('<controllerId>', 'Controller ID returned by queue_download in headless mode')
    .action(async (controllerId: string) => {
      try { print(await bridgePost('/downloads/stop', { controllerId })); } catch (e) { fatal(e); }
    });

  // remove_from_queue
  program
    .command('remove_from_queue')
    .description('Remove a single queued download from the queue by its list ID')
    .argument('<id>', 'Download ID from list_downloads')
    .action(async (id: string) => {
      try { print(await bridgePost('/downloads/command', { action: 'remove_from_queue', id })); } catch (e) { fatal(e); }
    });

  // move_queue_item
  program
    .command('move_queue_item')
    .description('Reorder a queued download up or down in the queue')
    .argument('<id>', 'Download ID from list_downloads')
    .argument('<direction>', "'up' or 'down'")
    .action(async (id: string, direction: string) => {
      try { print(await bridgePost('/downloads/command', { action: 'move_queue', id, direction })); } catch (e) { fatal(e); }
    });

  // clear_queue
  program
    .command('clear_queue')
    .description('Remove all queued downloads from the queue')
    .action(async () => {
      try { print(await bridgePost('/downloads/command', { action: 'clear_queue' })); } catch (e) { fatal(e); }
    });

  // clear_failed_downloads
  program
    .command('clear_failed_downloads')
    .description('Remove all failed downloads from the list')
    .action(async () => {
      try { print(await bridgePost('/downloads/command', { action: 'clear_failed' })); } catch (e) { fatal(e); }
    });

  // list_downloads
  program
    .command('list_downloads')
    .description('List downloads with optional filters')
    .option('--status <status>', 'Filter by status: downloading, queued, paused, finished, failed')
    .option('--search <q>', 'Search by filename')
    .option('--tag <tag>', 'Filter by tag')
    .option('--category <cat>', 'Filter by category')
    .action(async (opts: { status?: string; search?: string; tag?: string; category?: string }) => {
      try {
        const params: Record<string, string> = {};
        if (opts.status) params.status = opts.status;
        if (opts.search) params.search = opts.search;
        if (opts.tag) params.tag = opts.tag;
        if (opts.category) params.category = opts.category;
        print(await bridgeGet('/downloads/list', params));
      } catch (e) { fatal(e); }
    });

  // get_download_details
  program
    .command('get_download_details')
    .description('Get details for a specific download by ID')
    .argument('<id>', 'Download ID')
    .action(async (id: string) => {
      try { print(await bridgeGet(`/downloads/${encodeURIComponent(id)}`)); } catch (e) { fatal(e); }
    });

  // get_download_log
  program
    .command('get_download_log')
    .description('Get the log output for a specific download')
    .argument('<id>', 'Download ID')
    .action(async (id: string) => {
      try { print(await bridgeGet(`/downloads/${encodeURIComponent(id)}/log`)); } catch (e) { fatal(e); }
    });

  // rename_download
  program
    .command('rename_download')
    .description('Rename a download')
    .argument('<id>', 'Download ID')
    .argument('<newName>', 'New display name (max 30 chars)')
    .action(async (id: string, newName: string) => {
      try { print(await bridgePost('/downloads/command', { action: 'rename', id, newName })); } catch (e) { fatal(e); }
    });

  // delete_download
  program
    .command('delete_download')
    .description('Delete a download entry')
    .argument('<id>', 'Download ID')
    .action(async (id: string) => {
      try { print(await bridgePost('/downloads/command', { action: 'delete', id })); } catch (e) { fatal(e); }
    });

  // retry_download
  program
    .command('retry_download')
    .description('Retry a failed download')
    .argument('<id>', 'Download ID')
    .action(async (id: string) => {
      try { print(await bridgePost('/downloads/command', { action: 'retry', id })); } catch (e) { fatal(e); }
    });

  // open_download_file
  program
    .command('open_download_file')
    .description('Open a downloaded file in the default app')
    .argument('<id>', 'Download ID')
    .action(async (id: string) => {
      try { print(await bridgePost('/downloads/command', { action: 'open_file', id })); } catch (e) { fatal(e); }
    });

  // open_download_folder
  program
    .command('open_download_folder')
    .description('Open the folder containing a download in Finder/Explorer')
    .argument('<id>', 'Download ID')
    .action(async (id: string) => {
      try { print(await bridgePost('/downloads/command', { action: 'open_folder', id })); } catch (e) { fatal(e); }
    });

  // ── download tags ──────────────────────────────────────────────────────────

  // list_download_tags
  program
    .command('list_download_tags')
    .description('List all download tags')
    .action(async () => {
      try { print(await bridgeGet('/downloads/tags')); } catch (e) { fatal(e); }
    });

  // add_download_tag
  program
    .command('add_download_tag')
    .description('Add a tag to a download (max 10 chars)')
    .argument('<id>', 'Download ID')
    .argument('<tag>', 'Tag name (max 10 chars)')
    .action(async (id: string, tag: string) => {
      try { print(await bridgePost('/downloads/command', { action: 'add_tag', id, tag })); } catch (e) { fatal(e); }
    });

  // remove_download_tag
  program
    .command('remove_download_tag')
    .description('Remove a tag from a download')
    .argument('<id>', 'Download ID')
    .argument('<tag>', 'Tag name to remove')
    .action(async (id: string, tag: string) => {
      try { print(await bridgePost('/downloads/command', { action: 'remove_tag', id, tag })); } catch (e) { fatal(e); }
    });

  // rename_download_tag
  program
    .command('rename_download_tag')
    .description('Rename a tag globally across all downloads')
    .argument('<oldName>', 'Current tag name')
    .argument('<newName>', 'New tag name')
    .action(async (oldName: string, newName: string) => {
      try { print(await bridgePost('/downloads/command', { action: 'rename_tag', oldName, newName })); } catch (e) { fatal(e); }
    });

  // delete_download_tag
  program
    .command('delete_download_tag')
    .description('Delete a tag globally from all downloads')
    .argument('<tag>', 'Tag name to delete')
    .action(async (tag: string) => {
      try { print(await bridgePost('/downloads/command', { action: 'delete_tag', tag })); } catch (e) { fatal(e); }
    });

  // ── download categories ────────────────────────────────────────────────────

  // list_download_categories
  program
    .command('list_download_categories')
    .description('List all download categories')
    .action(async () => {
      try { print(await bridgeGet('/downloads/categories')); } catch (e) { fatal(e); }
    });

  // add_download_category
  program
    .command('add_download_category')
    .description('Assign a category to a download (max 15 chars)')
    .argument('<id>', 'Download ID')
    .argument('<category>', 'Category name (max 15 chars)')
    .action(async (id: string, category: string) => {
      try { print(await bridgePost('/downloads/command', { action: 'add_category', id, category })); } catch (e) { fatal(e); }
    });

  // remove_download_category
  program
    .command('remove_download_category')
    .description('Remove a category from a download')
    .argument('<id>', 'Download ID')
    .argument('<category>', 'Category name to remove')
    .action(async (id: string, category: string) => {
      try { print(await bridgePost('/downloads/command', { action: 'remove_category', id, category })); } catch (e) { fatal(e); }
    });

  // rename_download_category
  program
    .command('rename_download_category')
    .description('Rename a category globally across all downloads')
    .argument('<oldName>', 'Current category name')
    .argument('<newName>', 'New category name')
    .action(async (oldName: string, newName: string) => {
      try { print(await bridgePost('/downloads/command', { action: 'rename_category', oldName, newName })); } catch (e) { fatal(e); }
    });

  // delete_download_category
  program
    .command('delete_download_category')
    .description('Delete a category globally from all downloads')
    .argument('<category>', 'Category name to delete')
    .action(async (category: string) => {
      try { print(await bridgePost('/downloads/command', { action: 'delete_category', category })); } catch (e) { fatal(e); }
    });

  // ── download favorites ─────────────────────────────────────────────────────

  // list_download_favorites
  program
    .command('list_download_favorites')
    .description('List all favorited downloads')
    .action(async () => {
      try { print(await bridgeGet('/downloads/favorites')); } catch (e) { fatal(e); }
    });

  // add_download_favorite
  program
    .command('add_download_favorite')
    .description('Mark a download as a favorite')
    .argument('<id>', 'Download ID')
    .action(async (id: string) => {
      try { print(await bridgePost('/downloads/command', { action: 'add_favorite', id })); } catch (e) { fatal(e); }
    });

  // remove_download_favorite
  program
    .command('remove_download_favorite')
    .description('Remove a download from favorites')
    .argument('<id>', 'Download ID')
    .action(async (id: string) => {
      try { print(await bridgePost('/downloads/command', { action: 'remove_favorite', id })); } catch (e) { fatal(e); }
    });

  // ═══════════════════════════════════════════════════════════════════════════
  // SKEDULOSA — YouTube subscriptions
  // ═══════════════════════════════════════════════════════════════════════════

  // analyze_channel_schedule
  program
    .command('analyze_channel_schedule')
    .description('Analyze a YouTube channel upload schedule. Call this FIRST before subscribing')
    .argument('<channelUrl>', 'YouTube channel URL or ytsearch:Name')
    .action(async (channelUrl: string) => {
      try { print(await bridgePost('/subscriptions/channels/analyze-schedule', { channelUrl })); } catch (e) { fatal(e); }
    });

  // fetch_channel_details
  program
    .command('fetch_channel_details')
    .description('Get channel name, subscriber count, and avatar. Call after analyze_channel_schedule')
    .argument('<channelUrl>', 'YouTube channel URL')
    .action(async (channelUrl: string) => {
      try { print(await bridgePost('/subscriptions/channels/fetch-details', { channelUrl })); } catch (e) { fatal(e); }
    });

  // fetch_channel_upload_dates
  program
    .command('fetch_channel_upload_dates')
    .description('Fetch recent upload dates for a channel via yt-dlp')
    .argument('<channelUrl>', 'YouTube channel URL')
    .option('--days-back <n>', 'How many days back to look (default 90)', '90')
    .action(async (channelUrl: string, opts: { daysBack: string }) => {
      try { print(await bridgePost('/subscriptions/channels/fetch-upload-dates', { channelUrl, daysBack: Number(opts.daysBack) })); } catch (e) { fatal(e); }
    });

  // list_subscriptions
  program
    .command('list_subscriptions')
    .description('List all subscribed YouTube channels')
    .action(async () => {
      try { print(await bridgeGet('/subscriptions/channels')); } catch (e) { fatal(e); }
    });

  // find_subscription
  program
    .command('find_subscription')
    .description('Find a subscribed channel by name or URL query')
    .argument('<query>', 'Channel name or URL fragment to search for')
    .action(async (query: string) => {
      try {
        const channels = await bridgeGet<Record<string, unknown>[]>('/subscriptions/channels');
        const q = query.toLowerCase();
        const match = channels.find((c) =>
          String(c.name ?? '').toLowerCase().includes(q) ||
          String(c.channel_name ?? '').toLowerCase().includes(q) ||
          String(c.url ?? '').toLowerCase().includes(q)
        );
        if (match) {
          print({ id: match.id, name: match.name ?? match.channel_name, url: match.url });
        } else {
          print({ error: `No subscription found matching "${query}". Use list_subscriptions to see subscribed channels.` });
        }
      } catch (e) { fatal(e); }
    });

  // get_channel_details
  program
    .command('get_channel_details')
    .description('Get full details for a subscribed channel by ID')
    .argument('<channelId>', 'Channel ID')
    .action(async (channelId: string) => {
      try { print(await bridgeGet(`/subscriptions/channels/${channelId}`)); } catch (e) { fatal(e); }
    });

  // subscribe_channel
  program
    .command('subscribe_channel')
    .description('Subscribe to a YouTube channel. Prerequisites: analyze_channel_schedule, fetch_channel_details')
    .argument('<url>', 'YouTube channel URL')
    .requiredOption('--name <name>', 'Display name for the channel')
    .option('--first-scrape <n>', 'Videos to download from backlog (0–5, default 1)', '1')
    .option('--format <fmt>', 'Container format: mp4 (default), mkv, webm', 'mp4')
    .option('--frequency <mode>', 'Check-frequency mode: auto-detect (default) or manual', 'auto-detect')
    .option('--slots <json>', 'Time-slots JSON array. Auto-detect: pass suggestedSlots from analyze_channel_schedule. Manual: built from --days/--check-at-hour if omitted.')
    .option('--days <list>', 'Manual mode: comma-separated days to check, e.g. "mon,thu" (sun,mon,tue,wed,thu,fri,sat)')
    .option('--check-at-hour <h>', 'Manual mode: hour of day to check, 0–23 (default 6)', '6')
    .option('--quality <preset>', 'Manual mode: "Lowest Quality", "Low Quality", or "Best Quality" (default)', 'Best Quality')
    .option('--save-to <path>', 'Manual mode: absolute folder for this channel\'s downloads (default: app default location)')
    .option('--timezone <tz>', 'Manual mode: IANA timezone for the schedule, e.g. "America/New_York" (default UTC)', 'UTC')
    .action(async (url: string, opts: { name: string; firstScrape: string; format: string; frequency: string; slots?: string; days?: string; checkAtHour: string; quality: string; saveTo?: string; timezone: string }) => {
      try {
        const isManual = opts.frequency === 'manual';

        // Resolve slots: explicit --slots wins; otherwise (manual) build from --days/--check-at-hour
        const DAY_NUM: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
        let slots: { day_of_week: number; time_minutes: number }[] | undefined;
        if (opts.slots) {
          slots = JSON.parse(opts.slots);
        } else if (isManual && opts.days) {
          const timeMinutes = Number(opts.checkAtHour) * 60;
          slots = opts.days
            .split(',')
            .map((d) => d.trim().toLowerCase())
            .filter((d) => d in DAY_NUM)
            .map((d) => ({ day_of_week: DAY_NUM[d]!, time_minutes: timeMinutes }));
        }

        print(await bridgePost('/subscriptions/channels', {
          url,
          name: opts.name,
          first_scrape_limit: Number(opts.firstScrape),
          download_format: opts.format,
          frequency: opts.frequency,
          ...(isManual ? {
            download_quality: opts.quality,
            timezone: opts.timezone,
            ...(opts.saveTo ? { save_location: opts.saveTo } : {}),
          } : {}),
          ...(slots && slots.length > 0 ? { slots } : {}),
        }));
      } catch (e) { fatal(e); }
    });

  // update_channel
  program
    .command('update_channel')
    .description('Update a subscribed channel. Prerequisites: list_subscriptions')
    .argument('<channelId>', 'Channel ID')
    .option('--name <name>', 'New display name')
    .option('--format <fmt>', 'New download format: mp4, mkv, webm')
    .option('--active <0|1>', 'Enable (1) or disable (0)')
    .option('--subtitles <0|1>', 'Download subtitles: 1=yes, 0=no')
    .option('--thumbnails <0|1>', 'Download thumbnails: 1=yes, 0=no')
    .option('--first-scrape <n>', 'Update first-scrape video limit')
    .option('--min-duration <minutes>', 'Minimum video duration filter')
    .option('--max-duration <minutes>', 'Maximum video duration filter')
    .option('--all-words <list>', 'Title must contain ALL these words (comma-separated)')
    .option('--any-words <list>', 'Title must contain ANY of these words (comma-separated)')
    .option('--none-words <list>', 'Skip videos with any of these words (comma-separated)')
    .action(async (channelId: string, opts: Record<string, string | undefined>) => {
      try {
        const updates: Record<string, unknown> = {};
        if (opts.name) updates.name = opts.name;
        if (opts.format) updates.download_format = opts.format;
        if (opts.active !== undefined) updates.active = Number(opts.active);
        if (opts.subtitles !== undefined) updates.download_subtitles = Number(opts.subtitles);
        if (opts.thumbnails !== undefined) updates.download_thumbnails = Number(opts.thumbnails);
        if (opts.firstScrape !== undefined) updates.first_scrape_limit = Number(opts.firstScrape);
        if (opts.minDuration !== undefined) updates.min_duration_minutes = Number(opts.minDuration);
        if (opts.maxDuration !== undefined) updates.max_duration_minutes = Number(opts.maxDuration);
        if (opts.allWords) updates.all_words = opts.allWords.split(',').map((s) => s.trim());
        if (opts.anyWords) updates.any_words = opts.anyWords.split(',').map((s) => s.trim());
        if (opts.noneWords) updates.none_words = opts.noneWords.split(',').map((s) => s.trim());
        print(await bridgePost(`/subscriptions/channels/${channelId}/update`, updates));
      } catch (e) { fatal(e); }
    });

  // set_channel_active
  program
    .command('set_channel_active')
    .description('Enable or disable a subscribed channel without deleting it')
    .argument('<channelId>', 'Channel ID')
    .argument('<active>', 'true or false')
    .action(async (channelId: string, active: string) => {
      try { print(await bridgePost(`/subscriptions/channels/${channelId}/active`, { active: active === 'true' || active === '1' })); } catch (e) { fatal(e); }
    });

  // delete_subscription
  program
    .command('delete_subscription')
    .description('Permanently delete a channel subscription and all its history')
    .argument('<channelId>', 'Channel ID')
    .action(async (channelId: string) => {
      try { print(await bridgePost(`/subscriptions/channels/${channelId}/delete`, {})); } catch (e) { fatal(e); }
    });

  // scrape_now
  program
    .command('scrape_now')
    .description('Check for new videos on subscribed channels right now')
    .option('--channel-id <id>', 'Only scrape this channel ID (omit to scrape all)')
    .action(async (opts: { channelId?: string }) => {
      try {
        print(await bridgePost('/subscriptions/scraper/run-once',
          opts.channelId ? { channelId: Number(opts.channelId) } : {}
        ));
      } catch (e) { fatal(e); }
    });

  // start_scraper
  program
    .command('start_scraper')
    .description('Start the background YouTube scraper')
    .action(async () => {
      try { print(await bridgePost('/subscriptions/scraper/start', {})); } catch (e) { fatal(e); }
    });

  // stop_scraper
  program
    .command('stop_scraper')
    .description('Stop the background YouTube scraper')
    .action(async () => {
      try { print(await bridgePost('/subscriptions/scraper/stop', {})); } catch (e) { fatal(e); }
    });

  // ── download worker & tasks ────────────────────────────────────────────────

  // get_download_worker_status
  program
    .command('get_download_worker_status')
    .description('Check whether the subscription download worker is running')
    .action(async () => {
      try { print(await bridgeGet('/subscriptions/download-worker/status')); } catch (e) { fatal(e); }
    });

  // start_download_worker
  program
    .command('start_download_worker')
    .description('Start the download worker to process queued subscription videos. Prerequisites: list_download_tasks')
    .action(async () => {
      try { print(await bridgePost('/subscriptions/download-worker/start', {})); } catch (e) { fatal(e); }
    });

  // stop_download_worker
  program
    .command('stop_download_worker')
    .description('Stop the download worker')
    .action(async () => {
      try { print(await bridgePost('/subscriptions/download-worker/stop', {})); } catch (e) { fatal(e); }
    });

  // list_download_tasks
  program
    .command('list_download_tasks')
    .description('List subscription download tasks from the Skedulosa queue')
    .option('--status <status>', 'Filter by status: pending, downloading, downloaded, failed')
    .action(async (opts: { status?: string }) => {
      try {
        print(opts.status
          ? await bridgeGet('/subscriptions/download-tasks/by-status', { status: opts.status })
          : await bridgeGet('/subscriptions/tasks')
        );
      } catch (e) { fatal(e); }
    });

  // add_download_task
  program
    .command('add_download_task')
    .description('Add a video URL to the subscription download queue')
    .argument('<videoUrl>', 'Video URL to queue')
    .option('--format <fmt>', 'Download format')
    .action(async (videoUrl: string, opts: { format?: string }) => {
      try {
        print(await bridgePost('/subscriptions/download-tasks', {
          video_url: videoUrl,
          ...(opts.format ? { download_format: opts.format } : {}),
        }));
      } catch (e) { fatal(e); }
    });

  // mark_download_task_finished
  program
    .command('mark_download_task_finished')
    .description('Mark a download task as finished')
    .argument('<taskId>', 'Download task ID')
    .action(async (taskId: string) => {
      try { print(await bridgePost(`/subscriptions/download-tasks/${taskId}/finish`, {})); } catch (e) { fatal(e); }
    });

  // delete_download_task
  program
    .command('delete_download_task')
    .description('Delete a single subscription download task from the Skedulosa queue by its ID')
    .argument('<taskId>', 'Download task ID from list_download_tasks')
    .action(async (taskId: string) => {
      try { print(await bridgePost(`/subscriptions/download-tasks/${taskId}/delete`, {})); } catch (e) { fatal(e); }
    });

  // clear_pending_download_tasks
  program
    .command('clear_pending_download_tasks')
    .description('Clear all pending tasks from the Skedulosa download queue (marks them downloaded so the worker skips them)')
    .action(async () => {
      try { print(await bridgePost('/subscriptions/download-tasks/clear-pending', {})); } catch (e) { fatal(e); }
    });

  // list_download_history
  program
    .command('list_download_history')
    .description('List completed subscription download history')
    .option('--channel-id <id>', 'Filter to a specific channel ID')
    .action(async (opts: { channelId?: string }) => {
      try {
        const rows = await bridgeGet<Record<string, unknown>[]>('/subscriptions/history');
        if (opts.channelId) {
          print(rows.filter((r) => Number(r.channel_id) === Number(opts.channelId)));
        } else {
          print(rows);
        }
      } catch (e) { fatal(e); }
    });

  // list_scraped_videos
  program
    .command('list_scraped_videos')
    .description('List scraped video metadata stored in the Skedulosa database')
    .option('--channel <name>', 'Filter by channel name')
    .action(async (opts: { channel?: string }) => {
      try {
        print(opts.channel
          ? await bridgeGet('/subscriptions/video-details', { channelName: opts.channel })
          : await bridgeGet('/subscriptions/video-details')
        );
      } catch (e) { fatal(e); }
    });

  // get_video_details_by_url
  program
    .command('get_video_details_by_url')
    .description('Get scraped metadata for a specific video URL')
    .argument('<url>', 'Video URL')
    .action(async (url: string) => {
      try { print(await bridgeGet('/subscriptions/video-details/by-url', { url })); } catch (e) { fatal(e); }
    });

  // ── schedules ──────────────────────────────────────────────────────────────

  // list_schedules
  program
    .command('list_schedules')
    .description('List all download schedules')
    .action(async () => {
      try { print(await bridgeGet('/subscriptions/schedules')); } catch (e) { fatal(e); }
    });

  // create_schedule
  program
    .command('create_schedule')
    .description('Create a new download schedule')
    .option('--name <name>', 'Schedule name')
    .option('--config <json>', 'Schedule config JSON')
    .action(async (opts: { name?: string; config?: string }) => {
      try {
        print(await bridgePost('/subscriptions/schedules', {
          ...(opts.name ? { name: opts.name } : {}),
          ...(opts.config ? { config: JSON.parse(opts.config) } : {}),
        }));
      } catch (e) { fatal(e); }
    });

  // update_schedule
  program
    .command('update_schedule')
    .description('Update a schedule')
    .argument('<scheduleId>', 'Schedule ID')
    .requiredOption('--patch <json>', 'Patch fields as JSON object')
    .action(async (scheduleId: string, opts: { patch: string }) => {
      try { print(await bridgePost(`/subscriptions/schedules/${scheduleId}/update`, JSON.parse(opts.patch))); } catch (e) { fatal(e); }
    });

  // delete_schedule
  program
    .command('delete_schedule')
    .description('Delete a schedule')
    .argument('<scheduleId>', 'Schedule ID')
    .action(async (scheduleId: string) => {
      try { print(await bridgePost(`/subscriptions/schedules/${scheduleId}/delete`, {})); } catch (e) { fatal(e); }
    });

  // ── channel slots ──────────────────────────────────────────────────────────

  // get_channel_slots
  program
    .command('get_channel_slots')
    .description('Show weekly scrape time slots for a channel')
    .argument('<channelId>', 'Channel ID')
    .action(async (channelId: string) => {
      try { print(await bridgeGet(`/subscriptions/channels/${channelId}/slots`)); } catch (e) { fatal(e); }
    });

  // add_channel_slot
  program
    .command('add_channel_slot')
    .description('Add a scrape time slot to a channel')
    .argument('<channelId>', 'Channel ID')
    .requiredOption('--day <n>', 'Day of week: 0=Sunday … 6=Saturday')
    .requiredOption('--time <minutes>', 'Time as minutes from midnight (e.g. 540 = 9:00 AM)')
    .action(async (channelId: string, opts: { day: string; time: string }) => {
      try { print(await bridgePost(`/subscriptions/channels/${channelId}/slots`, { day_of_week: Number(opts.day), time_minutes: Number(opts.time) })); } catch (e) { fatal(e); }
    });

  // replace_channel_slots
  program
    .command('replace_channel_slots')
    .description('Replace all time slots for a channel atomically')
    .argument('<channelId>', 'Channel ID')
    .requiredOption('--slots <json>', 'JSON array of {day_of_week, time_minutes}')
    .action(async (channelId: string, opts: { slots: string }) => {
      try { print(await bridgePost(`/subscriptions/channels/${channelId}/slots/replace`, { slots: JSON.parse(opts.slots) })); } catch (e) { fatal(e); }
    });

  // ── intelligent schedules ──────────────────────────────────────────────────

  // get_weekly_schedule
  program
    .command('get_weekly_schedule')
    .description('Get all channel scrape events for the current week')
    .action(async () => {
      try { print(await bridgeGet('/subscriptions/schedule/week')); } catch (e) { fatal(e); }
    });

  // get_intelligent_schedules
  program
    .command('get_intelligent_schedules')
    .description('Get AI-predicted upload schedules for all subscribed channels')
    .action(async () => {
      try { print(await bridgeGet('/subscriptions/intelligent-schedules')); } catch (e) { fatal(e); }
    });

  // get_upcoming_scrapes
  program
    .command('get_upcoming_scrapes')
    .description('Get channels with scrapes scheduled within N hours')
    .option('--hours <n>', 'Hours to look ahead (default 24)', '24')
    .action(async (opts: { hours: string }) => {
      try { print(await bridgeGet('/subscriptions/intelligent-schedule/upcoming', { hoursAhead: Number(opts.hours) })); } catch (e) { fatal(e); }
    });

  // get_subscription_overdue
  program
    .command('get_subscription_overdue')
    .description('Get channels whose scheduled scrape time has already passed')
    .action(async () => {
      try { print(await bridgeGet('/subscriptions/intelligent-schedule/overdue')); } catch (e) { fatal(e); }
    });

  // get_subscription_schedule_stats
  program
    .command('get_subscription_schedule_stats')
    .description('Get global statistics for the AI scheduling system')
    .action(async () => {
      try { print(await bridgeGet('/subscriptions/intelligent-schedule/stats')); } catch (e) { fatal(e); }
    });

  // refresh_subscription_schedules
  program
    .command('refresh_subscription_schedules')
    .description('Recompute AI-predicted schedules for all channels')
    .action(async () => {
      try { print(await bridgePost('/subscriptions/intelligent-schedule/refresh-all', {})); } catch (e) { fatal(e); }
    });

  // get_next_scrape_run
  program
    .command('get_next_scrape_run')
    .description('Show the next scheduled scrape time across all channels')
    .option('--from <isoDate>', 'Calculate from this date (default: now)')
    .action(async (opts: { from?: string }) => {
      try {
        print(opts.from
          ? await bridgeGet('/subscriptions/slots/next-run', { fromDate: opts.from })
          : await bridgeGet('/subscriptions/slots/next-run')
        );
      } catch (e) { fatal(e); }
    });

  // get_process_load
  program
    .command('get_process_load')
    .description('Get CPU and memory usage of the Downlodr process')
    .action(async () => {
      try { print(await bridgeGet('/subscriptions/process-load')); } catch (e) { fatal(e); }
    });

  // ═══════════════════════════════════════════════════════════════════════════
  // AFDA — article scraping
  // ═══════════════════════════════════════════════════════════════════════════

  // list_websites
  program
    .command('list_websites')
    .description('List all tracked websites including their sections')
    .action(async () => {
      try { print(await bridgeGet('/afda/websites')); } catch (e) { fatal(e); }
    });

  // find_website
  program
    .command('find_website')
    .description('Find a tracked website by domain name, website name, or URL query')
    .argument('<query>', 'Domain, name, or URL fragment to search for')
    .action(async (query: string) => {
      try {
        const sites = await bridgeGet<Record<string, unknown>[]>('/afda/websites');
        const q = query.toLowerCase();
        const match = sites.find((s) =>
          String(s.fqdn ?? '').toLowerCase().includes(q) ||
          String(s.website_name ?? '').toLowerCase().includes(q) ||
          String(s.website_url ?? '').toLowerCase().includes(q)
        );
        if (match) {
          print({ id: match.id, website_name: match.website_name, fqdn: match.fqdn });
        } else {
          print({ error: `No website found matching "${query}". Use list_websites to see tracked sites.` });
        }
      } catch (e) { fatal(e); }
    });

  // find_section
  program
    .command('find_section')
    .description('Find a section within a website by path or name query')
    .requiredOption('--website <query>', 'Website domain or name to search in')
    .requiredOption('--section <query>', 'Section path or name to find')
    .action(async (opts: { website: string; section: string }) => {
      try {
        const sites = await bridgeGet<Record<string, unknown>[]>('/afda/websites');
        const wq = opts.website.toLowerCase();
        const site = sites.find((s) =>
          String(s.fqdn ?? '').toLowerCase().includes(wq) ||
          String(s.website_name ?? '').toLowerCase().includes(wq)
        );
        if (!site) { print({ error: `No website found matching "${opts.website}".` }); return; }
        const sections = Array.isArray(site.sections) ? site.sections as Record<string, unknown>[] : [];
        const sq = opts.section.toLowerCase();
        const match = sections.find((sec) =>
          String(sec.section_path ?? '').toLowerCase().includes(sq) ||
          String(sec.section_name ?? sec.name ?? '').toLowerCase().includes(sq)
        ) ?? sections[0];
        if (match) {
          print({ id: match.id, section_path: match.section_path, website_id: site.id });
        } else {
          print({ error: `No section found matching "${opts.section}".` });
        }
      } catch (e) { fatal(e); }
    });

  // run_mapper
  program
    .command('run_mapper')
    .description('Run the mapper to auto-discover article sections on a website (fire-and-forget)')
    .argument('<url>', 'Website URL')
    .argument('<fqdn>', 'Domain name e.g. example.com')
    .argument('<name>', 'Display name for the website')
    .option('--category <cat>', 'Category label (default: News)', 'News')
    .action(async (url: string, fqdn: string, name: string, opts: { category: string }) => {
      try { print(await bridgePost('/afda/mapper/run', { website_url: url, fqdn, website_name: name, website_category: opts.category })); } catch (e) { fatal(e); }
    });

  // run_mapper_sync
  program
    .command('run_mapper_sync')
    .description('Run the mapper synchronously and wait for the result before returning')
    .argument('<url>', 'Website URL')
    .argument('<fqdn>', 'Domain name e.g. example.com')
    .argument('<name>', 'Display name for the website')
    .option('--category <cat>', 'Category label (default: News)', 'News')
    .action(async (url: string, fqdn: string, name: string, opts: { category: string }) => {
      try { print(await bridgePost('/afda/mapper/run-sync', { website_url: url, fqdn, website_name: name, website_category: opts.category })); } catch (e) { fatal(e); }
    });

  // run_mapper_batch
  program
    .command('run_mapper_batch')
    .description('Run the mapper on multiple websites in parallel (fire-and-forget)')
    .requiredOption('--batch-id <id>', 'Unique ID for this batch run')
    .requiredOption('--items <json>', 'JSON array of {website_url, fqdn, website_name, website_category?}')
    .action(async (opts: { batchId: string; items: string }) => {
      try { print(await bridgePost('/afda/mapper/batch', { batchId: opts.batchId, items: JSON.parse(opts.items) })); } catch (e) { fatal(e); }
    });

  // get_mapper_batch_status
  program
    .command('get_mapper_batch_status')
    .description('Get the current status of a mapper batch run')
    .argument('<batchId>', 'Batch ID')
    .action(async (batchId: string) => {
      try { print(await bridgeGet('/afda/mapper/batch/status', { batchId })); } catch (e) { fatal(e); }
    });

  // cancel_mapper_batch
  program
    .command('cancel_mapper_batch')
    .description('Cancel an active mapper batch run')
    .argument('<batchId>', 'Batch ID')
    .action(async (batchId: string) => {
      try { print(await bridgePost('/afda/mapper/batch/cancel', { batchId })); } catch (e) { fatal(e); }
    });

  // add_website
  program
    .command('add_website')
    .description('Add a new website for article scraping. Prerequisites: run_mapper_sync, list_websites')
    .requiredOption('--fqdn <fqdn>', 'Domain name e.g. example.com')
    .requiredOption('--url <url>', 'Full website URL')
    .requiredOption('--name <name>', 'Display name for the website')
    .option('--category <cat>', 'Category label (default: News)', 'News')
    .option('--mapper-raw <json>', 'Mapper config JSON from run_mapper_sync')
    .option('--section-links <json>', 'Section links JSON array from run_mapper_sync')
    .option('--sections <json>', 'Sections config JSON array')
    .option('--pagination <json>', 'Pagination config JSON object')
    .action(async (opts: { fqdn: string; url: string; name: string; category: string; mapperRaw?: string; sectionLinks?: string; sections?: string; pagination?: string }) => {
      try {
        print(await bridgePost('/afda/websites', {
          fqdn: opts.fqdn,
          website_url: opts.url,
          website_name: opts.name,
          category: opts.category,
          ...(opts.mapperRaw ? { mapper_raw: opts.mapperRaw } : {}),
          ...(opts.sectionLinks ? { section_links: JSON.parse(opts.sectionLinks) } : {}),
          ...(opts.sections ? { sections: JSON.parse(opts.sections) } : { sections: [{ path: '/', name: 'Home', max_articles_per_run: 10 }] }),
          ...(opts.pagination ? { pagination: JSON.parse(opts.pagination) } : {}),
        }));
      } catch (e) { fatal(e); }
    });

  // update_website
  program
    .command('update_website')
    .description('Update metadata for a tracked website')
    .argument('<websiteId>', 'Website ID')
    .option('--name <name>', 'New display name')
    .option('--category <cat>', 'New category')
    .action(async (websiteId: string, opts: { name?: string; category?: string }) => {
      try {
        const patch: Record<string, unknown> = {};
        if (opts.name) patch.website_name = opts.name;
        if (opts.category) patch.website_category = opts.category;
        print(await bridgePost(`/afda/websites/${websiteId}/update`, patch));
      } catch (e) { fatal(e); }
    });

  // delete_website
  program
    .command('delete_website')
    .description('Delete a tracked website and all its scraped articles')
    .argument('<websiteId>', 'Website ID')
    .action(async (websiteId: string) => {
      try { print(await bridgePost(`/afda/websites/${websiteId}/delete`, {})); } catch (e) { fatal(e); }
    });

  // add_website_sections
  program
    .command('add_website_sections')
    .description('Append new sections to an existing website')
    .argument('<websiteId>', 'Website ID')
    .option('--sections <json>', 'JSON array of {section_url, section_path}')
    .action(async (websiteId: string, opts: { sections?: string }) => {
      try {
        print(await bridgePost('/afda/websites/add-sections', {
          website_id: Number(websiteId),
          ...(opts.sections ? { sections: JSON.parse(opts.sections) } : {}),
        }));
      } catch (e) { fatal(e); }
    });

  // reset_initial_scrape
  program
    .command('reset_initial_scrape')
    .description('Clear initial_scrape_done for all sections, allowing a fresh full scrape')
    .argument('<websiteId>', 'Website ID')
    .action(async (websiteId: string) => {
      try { print(await bridgePost('/afda/websites/reset-initial-scrape', { website_id: Number(websiteId) })); } catch (e) { fatal(e); }
    });

  // scrape_website
  program
    .command('scrape_website')
    .description('Trigger an immediate article scrape for a website')
    .argument('<websiteId>', 'Website ID')
    .option('--section-id <id>', 'Only scrape this section ID (omit to scrape all sections)')
    .action(async (websiteId: string, opts: { sectionId?: string }) => {
      try {
        print(await bridgePost('/afda/scrape', {
          websiteId: Number(websiteId),
          ...(opts.sectionId ? { sectionId: Number(opts.sectionId) } : {}),
        }));
      } catch (e) { fatal(e); }
    });

  // scrape_section_now
  program
    .command('scrape_section_now')
    .description('Start an immediate manual scrape for a specific section')
    .argument('<sectionId>', 'Section ID')
    .action(async (sectionId: string) => {
      try { print(await bridgePost('/afda/scrape/run-now', { section_id: Number(sectionId) })); } catch (e) { fatal(e); }
    });

  // add_section
  program
    .command('add_section')
    .description('Add a new section (scrape target URL path) to an existing website')
    .argument('<websiteId>', 'Website ID')
    .requiredOption('--path <path>', 'URL path of the section e.g. /news/tech')
    .option('--name <name>', 'Display name (defaults to path)')
    .action(async (websiteId: string, opts: { path: string; name?: string }) => {
      try { print(await bridgePost('/afda/sections', { website_id: Number(websiteId), path: opts.path, name: opts.name ?? opts.path })); } catch (e) { fatal(e); }
    });

  // find_section already added above

  // delete_sections
  program
    .command('delete_sections')
    .description('Delete one or more sections and all their articles and scrape jobs')
    .requiredOption('--ids <list>', 'Comma-separated section IDs to delete')
    .action(async (opts: { ids: string }) => {
      try { print(await bridgePost('/afda/sections/delete', { section_ids: parseIntList(opts.ids) })); } catch (e) { fatal(e); }
    });

  // set_section_schedule
  program
    .command('set_section_schedule')
    .description('Update the cron schedule for a section')
    .argument('<sectionId>', 'Section ID')
    .requiredOption('--config <json>', 'Schedule config JSON e.g. \'{"cron":"0 */6 * * *"}\'')
    .option('--follow-manual', 'Follow manual schedule pattern')
    .action(async (sectionId: string, opts: { config: string; followManual?: boolean }) => {
      try { print(await bridgePost(`/afda/sections/${sectionId}/schedule/update`, { config: JSON.parse(opts.config), follow_manual: opts.followManual ?? false })); } catch (e) { fatal(e); }
    });

  // assign_section_schedule
  program
    .command('assign_section_schedule')
    .description('Register a cron schedule for a section (starts automatic scraping)')
    .argument('<sectionId>', 'Section ID')
    .option('--config <json>', 'Schedule config JSON')
    .action(async (sectionId: string, opts: { config?: string }) => {
      try {
        print(await bridgePost('/afda/schedule/assign', {
          section_id: Number(sectionId),
          ...(opts.config ? { config: JSON.parse(opts.config) } : {}),
        }));
      } catch (e) { fatal(e); }
    });

  // pause_section_schedule
  program
    .command('pause_section_schedule')
    .description('Pause automatic scraping for a section')
    .argument('<sectionId>', 'Section ID')
    .action(async (sectionId: string) => {
      try { print(await bridgePost('/afda/schedule/pause', { section_id: Number(sectionId) })); } catch (e) { fatal(e); }
    });

  // resume_section_schedule
  program
    .command('resume_section_schedule')
    .description('Resume automatic scraping for a paused section')
    .argument('<sectionId>', 'Section ID')
    .action(async (sectionId: string) => {
      try { print(await bridgePost('/afda/schedule/resume', { section_id: Number(sectionId) })); } catch (e) { fatal(e); }
    });

  // set_section_max_articles
  program
    .command('set_section_max_articles')
    .description('Cap the number of articles downloaded per scrape run for a section (0 = unlimited)')
    .argument('<sectionId>', 'Section ID')
    .argument('<max>', 'Max articles per run (0 = unlimited)')
    .action(async (sectionId: string, max: string) => {
      try {
        const n = Number(max);
        print(await bridgePost(`/afda/sections/${sectionId}/max-articles/update`, { max_articles_per_run: n === 0 ? null : n }));
      } catch (e) { fatal(e); }
    });

  // run_temporal_analyzer
  program
    .command('run_temporal_analyzer')
    .description('Run temporal analysis on a section to infer upload frequency and best scrape schedule')
    .argument('<sectionId>', 'Section ID')
    .action(async (sectionId: string) => {
      try { print(await bridgePost('/afda/temporal/run', { section_id: Number(sectionId) })); } catch (e) { fatal(e); }
    });

  // ── articles ───────────────────────────────────────────────────────────────

  // search_articles
  program
    .command('search_articles')
    .description('Search scraped articles by keyword')
    .argument('<query>', 'Search keyword')
    .option('-l, --limit <n>', 'Max results (default 10)', '10')
    .action(async (query: string, opts: { limit: string }) => {
      try { print(await bridgeGet('/afda/articles/search', { q: query, limit: Number(opts.limit) })); } catch (e) { fatal(e); }
    });

  // list_articles
  program
    .command('list_articles')
    .description('List scraped articles, sorted by most recent')
    .option('--website-id <id>', 'Filter to a specific website ID')
    .option('-l, --limit <n>', 'Max results (default 20)', '20')
    .action(async (opts: { websiteId?: string; limit: string }) => {
      try {
        const params: Record<string, string | number> = { limit: Number(opts.limit), sort_key: 'published_at', sort_dir: 'desc' };
        if (opts.websiteId) params.website_ids = opts.websiteId;
        print(await bridgeGet('/afda/articles/filtered', params));
      } catch (e) { fatal(e); }
    });

  // filter_articles
  program
    .command('filter_articles')
    .description('Advanced article filtering by website, section, date range, and keyword')
    .option('--search <q>', 'Keyword search')
    .option('--website-id <id>', 'Filter to a specific website ID')
    .option('--section-ids <list>', 'Comma-separated section IDs')
    .option('--date-from <date>', 'Start date (ISO string)')
    .option('--date-to <date>', 'End date (ISO string)')
    .option('--sort-key <field>', 'Sort field (default: published_at)')
    .option('--sort-dir <asc|desc>', 'Sort direction (default: desc)')
    .option('-l, --limit <n>', 'Max results (default 20)', '20')
    .option('--offset <n>', 'Pagination offset (default 0)', '0')
    .action(async (opts: { search?: string; websiteId?: string; sectionIds?: string; dateFrom?: string; dateTo?: string; sortKey?: string; sortDir?: string; limit: string; offset: string }) => {
      try {
        const params: Record<string, string | number> = { limit: Number(opts.limit), offset: Number(opts.offset), sort_key: opts.sortKey ?? 'published_at', sort_dir: opts.sortDir ?? 'desc' };
        if (opts.search) params.search = opts.search;
        if (opts.websiteId) params.website_ids = opts.websiteId;
        if (opts.sectionIds) params.section_ids = opts.sectionIds;
        if (opts.dateFrom) params.date_from = opts.dateFrom;
        if (opts.dateTo) params.date_to = opts.dateTo;
        print(await bridgeGet('/afda/articles/filtered', params));
      } catch (e) { fatal(e); }
    });

  // count_articles
  program
    .command('count_articles')
    .description('Count articles matching filters')
    .option('--search <q>', 'Keyword search')
    .option('--website-id <id>', 'Filter to a website ID')
    .option('--section-ids <list>', 'Comma-separated section IDs')
    .option('--date-from <date>', 'Start date (ISO string)')
    .option('--date-to <date>', 'End date (ISO string)')
    .action(async (opts: { search?: string; websiteId?: string; sectionIds?: string; dateFrom?: string; dateTo?: string }) => {
      try {
        const params: Record<string, string> = {};
        if (opts.search) params.search = opts.search;
        if (opts.websiteId) params.website_ids = opts.websiteId;
        if (opts.sectionIds) params.section_ids = opts.sectionIds;
        if (opts.dateFrom) params.date_from = opts.dateFrom;
        if (opts.dateTo) params.date_to = opts.dateTo;
        print(await bridgeGet('/afda/articles/count', params));
      } catch (e) { fatal(e); }
    });

  // get_article
  program
    .command('get_article')
    .description('Get the full content of a scraped article by ID')
    .argument('<articleId>', 'Article ID')
    .action(async (articleId: string) => {
      try { print(await bridgeGet(`/afda/articles/${articleId}`)); } catch (e) { fatal(e); }
    });

  // list_article_domains
  program
    .command('list_article_domains')
    .description('List all unique domains (FQDNs) present in scraped articles')
    .action(async () => {
      try { print(await bridgeGet('/afda/articles/fqdns')); } catch (e) { fatal(e); }
    });

  // list_article_section_paths
  program
    .command('list_article_section_paths')
    .description('List all unique section paths present in scraped articles')
    .action(async () => {
      try { print(await bridgeGet('/afda/articles/section-paths')); } catch (e) { fatal(e); }
    });

  // reparse_article
  program
    .command('reparse_article')
    .description('Re-fetch and re-parse a scraped article by ID')
    .argument('<articleId>', 'Article ID')
    .action(async (articleId: string) => {
      try { print(await bridgePost('/afda/articles/reparse', { article_id: Number(articleId) })); } catch (e) { fatal(e); }
    });

  // parse_url
  program
    .command('parse_url')
    .description('Fetch and parse a URL on-demand, storing it as a manual article')
    .argument('<url>', 'URL to fetch and parse')
    .action(async (url: string) => {
      try { print(await bridgePost('/afda/articles/parse', { url })); } catch (e) { fatal(e); }
    });

  // export_articles
  program
    .command('export_articles')
    .description('Export scraped articles to CSV, XLSX, or JSON')
    .requiredOption('-o, --output-dir <path>', 'Directory to write exported files')
    .option('--format <fmt>', 'Export format: csv, xlsx, or json (default: csv)', 'csv')
    .option('--website-id <id>', 'Filter to a website ID')
    .action(async (opts: { outputDir: string; format: string; websiteId?: string }) => {
      try {
        print(await bridgePost('/afda/articles/export', {
          output_dir: opts.outputDir,
          format: opts.format,
          ...(opts.websiteId ? { website_ids: [Number(opts.websiteId)] } : {}),
        }));
      } catch (e) { fatal(e); }
    });

  // ── manual articles ────────────────────────────────────────────────────────

  // list_manual_articles
  program
    .command('list_manual_articles')
    .description('List manually parsed articles (on-demand URL parses)')
    .option('--search <q>', 'Keyword search')
    .option('-l, --limit <n>', 'Max results (default 50)', '50')
    .option('--offset <n>', 'Pagination offset (default 0)', '0')
    .action(async (opts: { search?: string; limit: string; offset: string }) => {
      try {
        const params: Record<string, string | number> = { limit: Number(opts.limit), offset: Number(opts.offset) };
        if (opts.search) params.search = opts.search;
        print(await bridgeGet('/afda/manual-articles', params));
      } catch (e) { fatal(e); }
    });

  // count_manual_articles
  program
    .command('count_manual_articles')
    .description('Count manually parsed articles')
    .option('--search <q>', 'Keyword search')
    .action(async (opts: { search?: string }) => {
      try {
        print(opts.search
          ? await bridgeGet('/afda/manual-articles/count', { search: opts.search })
          : await bridgeGet('/afda/manual-articles/count')
        );
      } catch (e) { fatal(e); }
    });

  // get_manual_article
  program
    .command('get_manual_article')
    .description('Get a single manually parsed article by ID')
    .argument('<id>', 'Manual article ID')
    .action(async (id: string) => {
      try { print(await bridgeGet(`/afda/manual-articles/${id}`)); } catch (e) { fatal(e); }
    });

  // reparse_manual_article
  program
    .command('reparse_manual_article')
    .description('Re-fetch and re-parse a manually submitted article by ID')
    .argument('<id>', 'Manual article ID')
    .action(async (id: string) => {
      try { print(await bridgePost(`/afda/manual-articles/${id}/reparse`, {})); } catch (e) { fatal(e); }
    });

  // delete_manual_article
  program
    .command('delete_manual_article')
    .description('Delete a manually parsed article by ID')
    .argument('<id>', 'Manual article ID')
    .action(async (id: string) => {
      try { print(await bridgePost(`/afda/manual-articles/${id}/delete`, {})); } catch (e) { fatal(e); }
    });

  // ── AFDA settings & auth ───────────────────────────────────────────────────

  // get_afda_setting
  program
    .command('get_afda_setting')
    .description('Get an AFDA setting by key e.g. concurrency, lookback_mode, lookback_value')
    .argument('<key>', 'Setting key name')
    .action(async (key: string) => {
      try { print(await bridgeGet('/afda/settings', { key })); } catch (e) { fatal(e); }
    });

  // set_afda_setting
  program
    .command('set_afda_setting')
    .description('Set an AFDA setting by key')
    .argument('<key>', 'Setting key name')
    .argument('<value>', 'New value')
    .action(async (key: string, value: string) => {
      try { print(await bridgePost('/afda/settings', { key, value })); } catch (e) { fatal(e); }
    });

  // set_afda_load_control
  program
    .command('set_afda_load_control')
    .description('Set the maximum number of concurrent scrape jobs (1–20)')
    .argument('<max>', 'Max concurrent scrapes')
    .action(async (max: string) => {
      try { print(await bridgePost('/afda/settings/load-control', { max: Number(max) })); } catch (e) { fatal(e); }
    });

  // open_website_login
  program
    .command('open_website_login')
    .description('Open the login flow for a website that requires authentication to scrape')
    .argument('<websiteId>', 'Website ID')
    .requiredOption('--login-url <url>', 'Login page URL')
    .action(async (websiteId: string, opts: { loginUrl: string }) => {
      try { print(await bridgePost('/afda/auth/login', { websiteId: Number(websiteId), loginUrl: opts.loginUrl })); } catch (e) { fatal(e); }
    });

  // get_website_auth_status
  program
    .command('get_website_auth_status')
    .description('Check whether a website has active stored authentication credentials')
    .argument('<websiteId>', 'Website ID')
    .action(async (websiteId: string) => {
      try { print(await bridgeGet('/afda/auth/status', { websiteId })); } catch (e) { fatal(e); }
    });

  // clear_website_auth
  program
    .command('clear_website_auth')
    .description('Clear stored authentication credentials for a website')
    .argument('<websiteId>', 'Website ID')
    .action(async (websiteId: string) => {
      try { print(await bridgePost('/afda/auth/clear', { websiteId: Number(websiteId) })); } catch (e) { fatal(e); }
    });

  // get_website_analytics
  program
    .command('get_website_analytics')
    .description('Get article download rate, upload cadence, and activity heatmap for a website')
    .argument('<websiteId>', 'Website ID')
    .option('--days <n>', 'Time window in days (default 30)', '30')
    .action(async (websiteId: string, opts: { days: string }) => {
      try { print(await bridgeGet('/afda/analytics', { websiteId: Number(websiteId), days: Number(opts.days) })); } catch (e) { fatal(e); }
    });

  // get_afda_schedules
  program
    .command('get_afda_schedules')
    .description('List all AFDA scrape schedules')
    .option('--website-id <id>', 'Filter by website ID')
    .action(async (opts: { websiteId?: string }) => {
      try {
        print(opts.websiteId
          ? await bridgeGet('/afda/schedule', { website_id: opts.websiteId })
          : await bridgeGet('/afda/schedule')
        );
      } catch (e) { fatal(e); }
    });

  // get_afda_store
  program
    .command('get_afda_store')
    .description('Dump the full AFDA data store: all websites, sections, and schedules in one call')
    .action(async () => {
      try { print(await bridgeGet('/afda/store')); } catch (e) { fatal(e); }
    });

  // list_scrape_jobs
  program
    .command('list_scrape_jobs')
    .description('List recent scrape jobs')
    .option('-l, --limit <n>', 'Number of jobs to return (default 20)', '20')
    .option('--section-id <id>', 'Filter by section ID')
    .action(async (opts: { limit: string; sectionId?: string }) => {
      try {
        const params: Record<string, string | number> = { limit: Number(opts.limit) };
        if (opts.sectionId) params.sectionId = opts.sectionId;
        print(await bridgeGet('/afda/jobs', params));
      } catch (e) { fatal(e); }
    });

  // get_scrape_job_status
  program
    .command('get_scrape_job_status')
    .description('Get the status of a specific scrape job')
    .argument('<jobId>', 'Scrape job ID')
    .action(async (jobId: string) => {
      try { print(await bridgeGet('/afda/scrape/job-status', { job_id: jobId })); } catch (e) { fatal(e); }
    });

  // get_scrape_job_size
  program
    .command('get_scrape_job_size')
    .description('Get the total article byte size for a scrape job')
    .argument('<jobId>', 'Scrape job ID')
    .action(async (jobId: string) => {
      try { print(await bridgeGet('/afda/scrape/job-size', { job_id: jobId })); } catch (e) { fatal(e); }
    });

  // get_scrape_job_articles
  program
    .command('get_scrape_job_articles')
    .description('Get all article URLs collected in a scrape job')
    .argument('<jobId>', 'Scrape job ID')
    .action(async (jobId: string) => {
      try { print(await bridgeGet('/afda/scrape/job-articles', { job_id: jobId })); } catch (e) { fatal(e); }
    });

  // ═══════════════════════════════════════════════════════════════════════════
  // AFDA — SOCIAL SOURCES (X / Reddit / Facebook / YouTube)
  // ═══════════════════════════════════════════════════════════════════════════

  // scrape_social_profile — on-demand, no persistence
  program
    .command('scrape_social_profile')
    .description('Scrape a social profile/feed on-demand (X, Reddit, Facebook, YouTube). Platform auto-detected. Does not save.')
    .argument('<url>', 'Profile/feed URL')
    .option('--platform <p>', 'Platform override: x, reddit, fb, youtube')
    .option('--account <name>', 'accounts.json username for an authenticated FB/X session')
    .option('--nitter', 'For X only — use the Nitter path instead of the X API')
    .action(async (url: string, opts: { platform?: string; account?: string; nitter?: boolean }) => {
      try {
        print(await bridgePost('/afda/social/scrape', {
          url,
          ...(opts.platform ? { platform: opts.platform } : {}),
          ...(opts.account ? { account: opts.account } : {}),
          ...(opts.nitter ? { useNitter: true } : {}),
        }));
      } catch (e) { fatal(e); }
    });

  // list_social_sources
  program
    .command('list_social_sources')
    .description('List all tracked social sources')
    .action(async () => {
      try { print(await bridgeGet('/afda/social/sources')); } catch (e) { fatal(e); }
    });

  // get_social_source
  program
    .command('get_social_source')
    .description('Get one tracked social source by ID')
    .argument('<id>', 'Social source ID')
    .action(async (id: string) => {
      try { print(await bridgeGet(`/afda/social/sources/${Number(id)}`)); } catch (e) { fatal(e); }
    });

  // get_social_posts
  program
    .command('get_social_posts')
    .description('List stored posts for a tracked social source (paginated)')
    .argument('<id>', 'Social source ID')
    .option('-l, --limit <n>', 'Max posts (default 20)', '20')
    .option('--offset <n>', 'Pagination offset (default 0)', '0')
    .action(async (id: string, opts: { limit: string; offset: string }) => {
      try {
        print(await bridgeGet(`/afda/social/sources/${Number(id)}/posts`, {
          limit: Number(opts.limit),
          offset: Number(opts.offset),
        }));
      } catch (e) { fatal(e); }
    });

  // add_social_source
  program
    .command('add_social_source')
    .description('Track a social profile for scheduled scraping. Platform auto-detected from URL.')
    .argument('<url>', 'Profile/feed URL')
    .option('--label <label>', 'Display label')
    .option('--account <name>', 'Auth account username')
    .option('--platform <p>', 'Platform override: x, reddit, fb, youtube')
    .action(async (url: string, opts: { label?: string; account?: string; platform?: string }) => {
      try {
        print(await bridgePost('/afda/social/sources', {
          url,
          ...(opts.label ? { label: opts.label } : {}),
          ...(opts.account ? { account: opts.account } : {}),
          ...(opts.platform ? { platform: opts.platform } : {}),
        }));
      } catch (e) { fatal(e); }
    });

  // update_social_source
  program
    .command('update_social_source')
    .description('Update a tracked social source label or auth account')
    .argument('<id>', 'Social source ID')
    .option('--label <label>', 'New display label')
    .option('--account <name>', 'New auth account username')
    .action(async (id: string, opts: { label?: string; account?: string }) => {
      try {
        const patch: Record<string, unknown> = {};
        if (opts.label !== undefined) patch.label = opts.label;
        if (opts.account !== undefined) patch.account = opts.account;
        print(await bridgePost(`/afda/social/sources/${Number(id)}/update`, patch));
      } catch (e) { fatal(e); }
    });

  // delete_social_source
  program
    .command('delete_social_source')
    .description('Delete a tracked social source and all its stored posts')
    .argument('<id>', 'Social source ID')
    .action(async (id: string) => {
      try { print(await bridgePost(`/afda/social/sources/${Number(id)}/delete`, {})); } catch (e) { fatal(e); }
    });

  // scrape_social_source_now
  program
    .command('scrape_social_source_now')
    .description('Immediately scrape a tracked social source and store new posts')
    .argument('<id>', 'Social source ID')
    .action(async (id: string) => {
      try { print(await bridgePost(`/afda/social/sources/${Number(id)}/scrape-now`, {})); } catch (e) { fatal(e); }
    });

  // assign_social_schedule
  program
    .command('assign_social_schedule')
    .description('Set a recurring scrape schedule for a tracked social source')
    .argument('<id>', 'Social source ID')
    .requiredOption('--config <json>', 'ScheduleConfig JSON, e.g. \'{"type":"preset","preset":"every_1h"}\'')
    .action(async (id: string, opts: { config: string }) => {
      try {
        print(await bridgePost(`/afda/social/sources/${Number(id)}/schedule/assign`, {
          config: JSON.parse(opts.config),
        }));
      } catch (e) { fatal(e); }
    });

  // pause_social_schedule
  program
    .command('pause_social_schedule')
    .description('Pause scheduled scraping for a tracked social source')
    .argument('<id>', 'Social source ID')
    .action(async (id: string) => {
      try { print(await bridgePost(`/afda/social/sources/${Number(id)}/schedule/pause`, {})); } catch (e) { fatal(e); }
    });

  // resume_social_schedule
  program
    .command('resume_social_schedule')
    .description('Resume scheduled scraping for a paused social source')
    .argument('<id>', 'Social source ID')
    .action(async (id: string) => {
      try { print(await bridgePost(`/afda/social/sources/${Number(id)}/schedule/resume`, {})); } catch (e) { fatal(e); }
    });

  // task_complete — no-op in CLI context, just prints the summary
  program
    .command('task_complete')
    .description('Mark a skill task as complete and print a summary')
    .argument('<summary>', 'Summary message to display')
    .action((summary: string) => {
      print({ status: 'complete', summary });
    });

  return program;
}
