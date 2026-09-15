import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { bridgeGet, bridgePost } from '../client.js';
import {
  recordListChannels,
  recordAnalyzeSchedule,
  recordFetchDetails,
  recordListDownloadTasks,
  checkSubscribePrereqs,
  checkDeleteChannelPrereqs,
  checkStartScraperPrereqs,
  checkStartDownloadWorkerPrereqs,
  isListChannelsRecent,
} from '../workflow-state.js';

export async function handleListChannels() {
  const rows = await bridgeGet<unknown[]>('/subscriptions/channels');
  recordListChannels();
  return rows;
}

export async function handleGetChannel({ channelId }: { channelId: number }) {
  return bridgeGet<unknown>(`/subscriptions/channels/${channelId}`);
}

export async function handleFetchChannelDetails({ channelUrl, maxVideoCount }: { channelUrl: string; maxVideoCount?: number }) {
  const result = await bridgePost<Record<string, unknown>>('/subscriptions/channels/fetch-details', {
    channelUrl,
    opts: maxVideoCount !== undefined ? { maxVideoCount } : undefined,
  });
  recordFetchDetails(channelUrl, (result.channelName as string) ?? '');
  return result;
}

export async function handleAnalyzeChannelSchedule({ channelUrl }: { channelUrl: string }) {
  const result = await bridgePost<Record<string, unknown>>('/subscriptions/channels/analyze-schedule', { channelUrl });
  recordAnalyzeSchedule(channelUrl, (result.videoCount as number) ?? 0);
  return result;
}

export async function handleRunScraperOnce({ channelId }: { channelId?: number }) {
  return bridgePost<unknown>('/subscriptions/scraper/run-once', { channelId });
}

export async function handleStartScraper({ scheduleId }: { scheduleId?: number }) {
  const prereqError = checkStartScraperPrereqs();
  if (prereqError) throw new Error(`${prereqError.message} [${prereqError.code}]`);
  return bridgePost<unknown>('/subscriptions/scraper/start', { scheduleId });
}

export async function handleStopScraper({ scheduleId }: { scheduleId?: number }) {
  return bridgePost<unknown>('/subscriptions/scraper/stop', { scheduleId });
}

export async function handleListDownloadTasks({ status }: { status?: string }) {
  const params: Record<string, string> = {};
  if (status) params.status = status;
  const rows = await bridgeGet<unknown[]>('/subscriptions/download-tasks/by-status', params);
  recordListDownloadTasks();
  return rows;
}

export async function handleGetDownloadWorkerStatus() {
  return bridgeGet<{ running: boolean }>('/subscriptions/download-worker/status');
}

export async function handleStartDownloadWorker() {
  const prereqError = checkStartDownloadWorkerPrereqs();
  if (prereqError) throw new Error(`${prereqError.message} [${prereqError.code}]`);
  return bridgePost<unknown>('/subscriptions/download-worker/start', {});
}

export async function handleStopDownloadWorker() {
  return bridgePost<unknown>('/subscriptions/download-worker/stop', {});
}

export async function handleListDownloadHistory() {
  return bridgeGet<unknown[]>('/subscriptions/history');
}

export async function handleGetWeeklySchedule() {
  return bridgeGet<unknown[]>('/subscriptions/schedule/week');
}

export async function handleGetIntelligentSchedules() {
  return bridgeGet<unknown[]>('/subscriptions/intelligent-schedules');
}

export async function handleGetProcessLoad() {
  return bridgeGet<unknown>('/subscriptions/process-load');
}

export async function handleCreateChannel(payload: {
  url: string;
  name: string;
  first_scrape_limit: number;
  schedule_mode: 'auto-detect' | 'manual';
  download_format?: string;
  all_words?: string[];
  any_words?: string[];
  none_words?: string[];
  min_duration_minutes?: number;
  max_duration_minutes?: number;
  download_subtitles?: number;
  download_thumbnails?: number;
  manual_days?: number[];
  manual_hour?: number;
}) {
  const prereqError = checkSubscribePrereqs(payload.url, payload.first_scrape_limit);
  if (prereqError) throw new Error(`${prereqError.message} [${prereqError.code}]`);
  const { manual_days, manual_hour, schedule_mode: _sm, ...rest } = payload;
  if (manual_days && manual_days.length > 0 && manual_hour !== undefined) {
    (rest as Record<string, unknown>).slots = manual_days.map((d) => ({
      day_of_week: d,
      time_minutes: manual_hour * 60,
    }));
  }
  return bridgePost<unknown>('/subscriptions/channels', rest);
}

export async function handleUpdateChannel(channelId: number, updates: Record<string, unknown>) {
  if (!isListChannelsRecent()) throw new Error('Must call list-channels first [MISSING_CHANNEL_LIST]');
  return bridgePost<unknown>(`/subscriptions/channels/${channelId}/update`, updates);
}

export async function handleDeleteChannel({ channelId }: { channelId: number }) {
  const prereqError = checkDeleteChannelPrereqs();
  if (prereqError) throw new Error(`${prereqError.message} [${prereqError.code}]`);
  return bridgePost<unknown>(`/subscriptions/channels/${channelId}/delete`, {});
}

export async function handleSetChannelActive({ channelId, active }: { channelId: number; active: boolean }) {
  return bridgePost<unknown>(`/subscriptions/channels/${channelId}/active`, { active });
}

export async function handleFetchChannelUploadDates({ channelUrl, daysBack = 90 }: { channelUrl: string; daysBack?: number }) {
  return bridgePost<unknown>('/subscriptions/channels/fetch-upload-dates', { channelUrl, daysBack });
}

export async function handleListSchedules() {
  return bridgeGet<unknown[]>('/subscriptions/schedules');
}

export async function handleCreateSchedule({ name }: { name?: string }) {
  return bridgePost<unknown>('/subscriptions/schedules', { name });
}

export async function handleUpdateSchedule({ scheduleId, name }: { scheduleId: number; name?: string }) {
  return bridgePost<unknown>(`/subscriptions/schedules/${scheduleId}/update`, { name });
}

export async function handleDeleteSchedule({ scheduleId }: { scheduleId: number }) {
  return bridgePost<unknown>(`/subscriptions/schedules/${scheduleId}/delete`, {});
}

export async function handleGetChannelSlots({ channelId }: { channelId: number }) {
  return bridgeGet<unknown[]>(`/subscriptions/channels/${channelId}/slots`);
}

export async function handleAddChannelSlot({ channelId, day_of_week, time_minutes }: { channelId: number; day_of_week: number; time_minutes: number }) {
  return bridgePost<unknown>(`/subscriptions/channels/${channelId}/slots`, { day_of_week, time_minutes });
}

export async function handleReplaceChannelSlots({ channelId, slots }: { channelId: number; slots: Array<{ day_of_week: number; time_minutes: number }> }) {
  return bridgePost<unknown>(`/subscriptions/channels/${channelId}/slots/replace`, { slots });
}

export async function handleGetNextScrapeRun({ fromDate }: { fromDate?: string }) {
  const params: Record<string, string> = {};
  if (fromDate) params.fromDate = fromDate;
  return bridgeGet<{ nextRun: string | null }>('/subscriptions/slots/next-run', params);
}

export async function handleGetUpcomingScapes({ hoursAhead = 24 }: { hoursAhead?: number }) {
  return bridgeGet<unknown[]>('/subscriptions/intelligent-schedule/upcoming', { hoursAhead });
}

export async function handleGetOverdueScrapes() {
  return bridgeGet<unknown[]>('/subscriptions/intelligent-schedule/overdue');
}

export async function handleGetIntelligentScheduleStats() {
  return bridgeGet<unknown>('/subscriptions/intelligent-schedule/stats');
}

export async function handleRefreshAllIntelligentSchedules() {
  return bridgePost<{ updated: number }>('/subscriptions/intelligent-schedule/refresh-all', {});
}

export async function handleAddDownloadTask({ video_url, channel_id }: { video_url: string; channel_id?: number }) {
  return bridgePost<unknown>('/subscriptions/download-tasks', { video_url, channel_id });
}

export async function handleMarkDownloadTaskFinished({ taskId }: { taskId: number }) {
  return bridgePost<unknown>(`/subscriptions/download-tasks/${taskId}/finish`, {});
}

export async function handleListVideoDetails({ channelName }: { channelName?: string }) {
  const params: Record<string, string> = {};
  if (channelName) params.channelName = channelName;
  return bridgeGet<unknown[]>('/subscriptions/video-details', params);
}

export async function handleGetVideoDetailsByUrl({ url }: { url: string }) {
  return bridgeGet<unknown>('/subscriptions/video-details/by-url', { url });
}

export function registerSubscriptionTools(server: McpServer): void {

  // ═══════════════════════════════════════════════════════════════════════════
  // CHANNELS — read
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    'downlodr_list_channels',
    'List all subscribed YouTube channels in Downlodr (Skedulosa module).',
    {},
    async () => {
      const rows = await bridgeGet<unknown[]>('/subscriptions/channels');
      recordListChannels();
      return { content: [{ type: 'text' as const, text: JSON.stringify(rows, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_get_channel',
    'Get details for a specific subscribed channel by its ID.',
    { channelId: z.number().describe('Channel ID from downlodr_list_channels') },
    async ({ channelId }) => {
      const row = await bridgeGet<unknown>(`/subscriptions/channels/${channelId}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(row, null, 2) }] };
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // CHANNELS — write
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    'downlodr_create_channel',
    [
      'Subscribe to a YouTube channel. You MUST collect ALL required fields from the user before calling this — do not call with defaults you assumed.',
      '',
      'Required conversation steps before calling:',
      '1. Confirm the channel URL with the user (search first if only a name was given)',
      '2. ASK: "How many recent videos to download first?" — options: 0=None (default), 1, 2, 3, 4. DO NOT assume 0.',
      '3. ASK: "Auto-detect schedule or set manually?" — options: auto-detect (default), manual',
      '4. Show a confirmation summary and get explicit yes/no before calling',
      '',
      'first_scrape_limit: 0 means no backlog (new videos only). Only set higher if user explicitly asked for backlog.',
      'confirmed: must be true — only set this after the user says yes to your confirmation summary.',
    ].join('\n'),
    {
      url: z.string().describe('YouTube channel URL — must be confirmed with the user, not assumed'),
      name: z.string().describe('Display name — use the actual channel name, confirmed with user'),
      first_scrape_limit: z.number().describe('Videos to download from backlog: 0=none (default), 1-4=that many. MUST be explicitly chosen by user, not assumed.'),
      confirmed: z.boolean().describe('Set to true ONLY after showing the user a full summary (channel name, URL, first_scrape_limit, schedule mode) and they said yes. Never set to true without explicit user confirmation.'),
      schedule_mode: z.enum(['auto-detect', 'manual']).describe('How to schedule scraping — must be chosen by user. auto-detect uses AI pattern analysis.'),
      download_format: z.string().optional().describe('Download format: mp4 (default), mkv, webm'),
      all_words: z.array(z.string()).optional().describe('Only download videos with ALL these words in title'),
      any_words: z.array(z.string()).optional().describe('Only download videos with ANY of these words in title'),
      none_words: z.array(z.string()).optional().describe('Skip videos with any of these words in title'),
      min_duration_minutes: z.number().optional().describe('Minimum video duration in minutes'),
      max_duration_minutes: z.number().optional().describe('Maximum video duration in minutes'),
      download_subtitles: z.number().optional().describe('1 to download subtitles, 0 to skip (default 0)'),
      download_thumbnails: z.number().optional().describe('1 to download thumbnails, 0 to skip (default 0)'),
      manual_days: z.array(z.number()).optional().describe('Day slots for manual schedule (0=Sun..6=Sat) — only if schedule_mode is manual'),
      manual_hour: z.number().optional().describe('Hour of day for manual schedule (0-23) — only if schedule_mode is manual'),
    },
    async ({ confirmed, schedule_mode: _schedule_mode, manual_days, manual_hour, ...payload }) => {
      if (!confirmed) {
        return {
          content: [{
            type: 'text' as const,
            text: 'Cannot subscribe: confirmed is false. Show the user a full summary of the subscription settings and ask for explicit yes/no confirmation before calling this tool.',
          }],
        };
      }

      // ── Workflow guardrail: check prerequisites ──
      const prereqError = checkSubscribePrereqs(
        payload.url,
        payload.first_scrape_limit,
      );
      if (prereqError) {
        return {
          content: [{
            type: 'text' as const,
            text: `${prereqError.message}\n\n[Guardrail code: ${prereqError.code}]`,
          }],
        };
      }

      // Add manual slots to payload if provided
      if (manual_days && manual_days.length > 0 && manual_hour !== undefined) {
        (payload as Record<string, unknown>).slots = manual_days.map((d) => ({
          day_of_week: d,
          time_minutes: manual_hour * 60,
        }));
      }
      const result = await bridgePost<unknown>('/subscriptions/channels', payload);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_update_channel',
    'Update a subscribed channel. confirmed must be true — only set it after showing the user what will change and getting explicit yes/no.',
    {
      channelId: z.number().describe('Channel ID to update'),
      confirmed: z.boolean().describe('Set true only after showing user a summary of changes and they said yes.'),
      url: z.string().optional().describe('New channel URL'),
      name: z.string().optional().describe('New display name'),
      download_format: z.string().optional().describe('Download format: "mp4", "mkv", etc.'),
      all_words: z.array(z.string()).optional().describe('Title must contain ALL of these words'),
      any_words: z.array(z.string()).optional().describe('Title must contain ANY of these words'),
      none_words: z.array(z.string()).optional().describe('Skip if title contains any of these words'),
      min_duration_minutes: z.number().nullable().optional().describe('Minimum duration filter (null to clear)'),
      max_duration_minutes: z.number().nullable().optional().describe('Maximum duration filter (null to clear)'),
      download_subtitles: z.number().optional().describe('1 to enable, 0 to disable'),
      download_thumbnails: z.number().optional().describe('1 to enable, 0 to disable'),
      first_scrape_limit: z.number().nullable().optional().describe('First-scrape video limit (null = unlimited)'),
      active: z.number().optional().describe('1 to enable, 0 to disable'),
    },
    async ({ channelId, confirmed, ...updates }) => {
      if (!confirmed) {
        return { content: [{ type: 'text' as const, text: 'Cannot update: confirmed is false. Show the user what will change and get explicit yes/no first.' }] };
      }
      // ── Workflow guardrail: must have listed channels first ──
      if (!isListChannelsRecent()) {
        return {
          content: [{
            type: 'text' as const,
            text: 'BLOCKED: You must call downlodr_list_channels first to verify the channel exists and show current settings. [Guardrail code: MISSING_CHANNEL_LIST]',
          }],
        };
      }
      const result = await bridgePost<unknown>(`/subscriptions/channels/${channelId}/update`, updates);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_delete_channel',
    'Delete a channel subscription permanently (removes all history and queued tasks). confirmed must be true — only set after telling the user what will be deleted and they said yes.',
    {
      channelId: z.number().describe('Channel ID to delete'),
      confirmed: z.boolean().describe('Set true only after user explicitly confirmed deletion. Never assume yes.'),
    },
    async ({ channelId, confirmed }) => {
      if (!confirmed) {
        return { content: [{ type: 'text' as const, text: 'Cannot delete: confirmed is false. Tell the user what will be permanently deleted and ask "Are you sure? (yes/no)" first.' }] };
      }
      // ── Workflow guardrail: must have listed channels first ──
      const deletePrereq = checkDeleteChannelPrereqs();
      if (deletePrereq) {
        return {
          content: [{
            type: 'text' as const,
            text: `${deletePrereq.message}\n\n[Guardrail code: ${deletePrereq.code}]`,
          }],
        };
      }
      const result = await bridgePost<unknown>(`/subscriptions/channels/${channelId}/delete`, {});
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_set_channel_active',
    'Enable or disable a subscribed channel (pauses/resumes scraping without deleting).',
    {
      channelId: z.number().describe('Channel ID'),
      active: z.boolean().describe('true to enable, false to disable'),
    },
    async ({ channelId, active }) => {
      const result = await bridgePost<unknown>(`/subscriptions/channels/${channelId}/active`, { active });
      return {
        content: [{
          type: 'text' as const,
          text: `Channel ${channelId} ${active ? 'enabled' : 'disabled'}.`,
        }],
      };
    },
  );

  server.tool(
    'downlodr_fetch_channel_details',
    'Fetch public metadata for a YouTube channel URL via yt-dlp: name, avatar, subscriber count, video count.',
    {
      channelUrl: z.string().describe('YouTube channel URL'),
      maxVideoCount: z.number().optional().describe('Max videos to scan for metadata (default: auto)'),
    },
    async ({ channelUrl, maxVideoCount }) => {
      const result = await bridgePost<unknown>('/subscriptions/channels/fetch-details', {
        channelUrl,
        opts: maxVideoCount !== undefined ? { maxVideoCount } : undefined,
      });
      // Record that fetch details was called for this URL
      const details = result as Record<string, unknown>;
      recordFetchDetails(channelUrl, (details.channelName as string) ?? '');
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_analyze_channel_schedule',
    'Analyze a YouTube channel\'s upload history to predict its posting schedule. Returns intelligent prediction and suggested time slots.',
    {
      channelUrl: z.string().describe('YouTube channel URL to analyze (uses last 50 videos)'),
    },
    async ({ channelUrl }) => {
      const result = await bridgePost<unknown>('/subscriptions/channels/analyze-schedule', { channelUrl });
      // Record that analysis was completed for this URL
      const analysis = result as Record<string, unknown>;
      recordAnalyzeSchedule(channelUrl, (analysis.videoCount as number) ?? 0);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_fetch_channel_upload_dates',
    'Fetch recent upload dates for a channel via yt-dlp. Useful for manual schedule analysis.',
    {
      channelUrl: z.string().describe('YouTube channel URL'),
      daysBack: z.number().optional().describe('How many days back to look (default 90)'),
    },
    async ({ channelUrl, daysBack = 90 }) => {
      const result = await bridgePost<unknown>('/subscriptions/channels/fetch-upload-dates', { channelUrl, daysBack });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SCHEDULES — read + write
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    'downlodr_list_schedules',
    'List all download schedules configured in Downlodr.',
    {},
    async () => {
      const rows = await bridgeGet<unknown[]>('/subscriptions/schedules');
      return { content: [{ type: 'text' as const, text: JSON.stringify(rows, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_create_schedule',
    'Create a new download schedule that channels can be assigned to.',
    { name: z.string().optional().describe('Schedule name (optional)') },
    async ({ name }) => {
      const result = await bridgePost<unknown>('/subscriptions/schedules', { name });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_update_schedule',
    'Update a schedule\'s metadata (e.g. rename it).',
    {
      scheduleId: z.number().describe('Schedule ID from downlodr_list_schedules'),
      name: z.string().optional().describe('New schedule name'),
    },
    async ({ scheduleId, name }) => {
      const result = await bridgePost<unknown>(`/subscriptions/schedules/${scheduleId}/update`, { name });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_delete_schedule',
    'Delete a schedule from Downlodr.',
    { scheduleId: z.number().describe('Schedule ID to delete') },
    async ({ scheduleId }) => {
      const result = await bridgePost<unknown>(`/subscriptions/schedules/${scheduleId}/delete`, {});
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // CHANNEL SLOTS — time slots for manual scheduling
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    'downlodr_get_channel_slots',
    'Get the time slots configured for a specific channel (day of week and time of day for scraping).',
    { channelId: z.number().describe('Channel ID from downlodr_list_channels') },
    async ({ channelId }) => {
      const rows = await bridgeGet<unknown[]>(`/subscriptions/channels/${channelId}/slots`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(rows, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_add_channel_slot',
    'Add a single scrape time slot to a channel (day of week + time).',
    {
      channelId: z.number().describe('Channel ID'),
      day_of_week: z.number().min(0).max(6).describe('Day of week: 0=Sunday, 1=Monday, ..., 6=Saturday'),
      time_minutes: z.number().min(0).max(1439).describe('Time as minutes from midnight (e.g. 540 = 9:00 AM)'),
    },
    async ({ channelId, day_of_week, time_minutes }) => {
      const result = await bridgePost<unknown>(`/subscriptions/channels/${channelId}/slots`, {
        day_of_week,
        time_minutes,
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_replace_channel_slots',
    'Replace all time slots for a channel atomically (set the complete weekly schedule at once).',
    {
      channelId: z.number().describe('Channel ID'),
      slots: z.array(z.object({
        day_of_week: z.number().min(0).max(6).describe('0=Sunday … 6=Saturday'),
        time_minutes: z.number().min(0).max(1439).describe('Minutes from midnight'),
      })).describe('Complete list of slots to set (replaces existing)'),
    },
    async ({ channelId, slots }) => {
      const result = await bridgePost<unknown>(`/subscriptions/channels/${channelId}/slots/replace`, { slots });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_get_next_scrape_run',
    'Get the next scheduled scrape time across all channels (earliest of manual slots and intelligent schedules).',
    {
      fromDate: z.string().optional().describe('ISO date string to calculate from (default: now)'),
    },
    async ({ fromDate }) => {
      const params: Record<string, string> = {};
      if (fromDate) params.fromDate = fromDate;
      const result = await bridgeGet<{ nextRun: string | null }>('/subscriptions/slots/next-run', params);
      return {
        content: [{
          type: 'text' as const,
          text: result.nextRun
            ? `Next scrape scheduled at: ${result.nextRun}`
            : 'No scrape runs scheduled.',
        }],
      };
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // WEEKLY SCHEDULE & INTELLIGENT SCHEDULES
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    'downlodr_get_weekly_schedule',
    'Get all channel scrape events for the current week (both manual slots and AI-predicted), sorted by time.',
    {},
    async () => {
      const rows = await bridgeGet<unknown[]>('/subscriptions/schedule/week');
      return { content: [{ type: 'text' as const, text: JSON.stringify(rows, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_get_intelligent_schedules',
    'Get AI-predicted upload schedules for all subscribed channels (pattern, confidence, expected frequency, next scrape time).',
    {},
    async () => {
      const rows = await bridgeGet<unknown[]>('/subscriptions/intelligent-schedules');
      return { content: [{ type: 'text' as const, text: JSON.stringify(rows, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_get_upcoming_scrapes',
    'Get all channels with scrapes scheduled within N hours (intelligent schedule).',
    {
      hoursAhead: z.number().optional().describe('Hours to look ahead (default 24)'),
    },
    async ({ hoursAhead = 24 }) => {
      const result = await bridgeGet<unknown[]>('/subscriptions/intelligent-schedule/upcoming', { hoursAhead });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_get_overdue_scrapes',
    'Get all channels whose intelligent schedule scrape time has passed (overdue).',
    {},
    async () => {
      const result = await bridgeGet<unknown[]>('/subscriptions/intelligent-schedule/overdue');
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_get_intelligent_schedule_stats',
    'Get global statistics for the intelligent scheduling system (total schedules, coverage, confidence distribution).',
    {},
    async () => {
      const result = await bridgeGet<unknown>('/subscriptions/intelligent-schedule/stats');
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_refresh_all_intelligent_schedules',
    'Recompute AI-predicted schedules for all channels using their stored analysis videos.',
    {},
    async () => {
      const result = await bridgePost<{ updated: number }>('/subscriptions/intelligent-schedule/refresh-all', {});
      return {
        content: [{
          type: 'text' as const,
          text: `Refreshed intelligent schedules for ${result.updated} channel(s).`,
        }],
      };
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SCRAPER CONTROL
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    'downlodr_start_scraper',
    'Start the background YouTube scraper. IMPORTANT: Call downlodr_get_workflows first — only start if the user explicitly asked to begin scraping.',
    {
      scheduleId: z.number().optional().describe('Only start scraper for this schedule ID (omit to start all)'),
    },
    async ({ scheduleId }) => {
      // ── Workflow guardrail: must have listed channels first ──
      const scraperPrereq = checkStartScraperPrereqs();
      if (scraperPrereq) {
        return {
          content: [{
            type: 'text' as const,
            text: `${scraperPrereq.message}\n\n[Guardrail code: ${scraperPrereq.code}]`,
          }],
        };
      }
      const result = await bridgePost<unknown>('/subscriptions/scraper/start', { scheduleId });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_stop_scraper',
    'Stop the background YouTube scraper.',
    {
      scheduleId: z.number().optional().describe('Only stop scraper for this schedule ID (omit to stop all)'),
    },
    async ({ scheduleId }) => {
      const result = await bridgePost<unknown>('/subscriptions/scraper/stop', { scheduleId });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_run_scraper_once',
    'Run the scraper once immediately. IMPORTANT: Call downlodr_get_workflows first and follow the scraping workflow — update first_scrape_limit before running if the user wants a specific number of videos.',
    {
      channelId: z.number().optional().describe('Only scrape this channel ID (omit to scrape all active channels)'),
    },
    async ({ channelId }) => {
      const result = await bridgePost<unknown>('/subscriptions/scraper/run-once', { channelId });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // DOWNLOAD WORKER CONTROL
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    'downlodr_start_download_worker',
    'Start the download worker. IMPORTANT: Call downlodr_get_workflows first — only start if the user explicitly asked to begin downloading queued videos.',
    {},
    async () => {
      // ── Workflow guardrail: must have listed download tasks first ──
      const workerPrereq = checkStartDownloadWorkerPrereqs();
      if (workerPrereq) {
        return {
          content: [{
            type: 'text' as const,
            text: `${workerPrereq.message}\n\n[Guardrail code: ${workerPrereq.code}]`,
          }],
        };
      }
      const result = await bridgePost<unknown>('/subscriptions/download-worker/start', {});
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_stop_download_worker',
    'Stop the download worker.',
    {},
    async () => {
      const result = await bridgePost<unknown>('/subscriptions/download-worker/stop', {});
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_get_download_worker_status',
    'Check whether the subscription download worker is currently running.',
    {},
    async () => {
      const result = await bridgeGet<{ running: boolean }>('/subscriptions/download-worker/status');
      return {
        content: [{
          type: 'text' as const,
          text: `Download worker is ${result.running ? 'running' : 'stopped'}.`,
        }],
      };
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // DOWNLOAD TASKS
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    'downlodr_list_download_tasks',
    'List pending and recent subscription download tasks from the Skedulosa queue.',
    {
      status: z.enum(['pending', 'downloading', 'downloaded', 'failed']).optional().describe('Filter by task status'),
    },
    async ({ status }) => {
      const params: Record<string, string> = {};
      if (status) params.status = status;
      const rows = await bridgeGet<unknown[]>('/subscriptions/download-tasks/by-status', params);
      recordListDownloadTasks();
      return { content: [{ type: 'text' as const, text: JSON.stringify(rows, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_add_download_task',
    'Add a video URL to the subscription download queue.',
    {
      video_url: z.string().describe('Video URL to queue for download'),
      channel_id: z.number().optional().describe('Channel ID this video belongs to'),
    },
    async ({ video_url, channel_id }) => {
      const result = await bridgePost<unknown>('/subscriptions/download-tasks', { video_url, channel_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_mark_download_task_finished',
    'Mark a download task as finished/downloaded.',
    { taskId: z.number().describe('Download task ID') },
    async ({ taskId }) => {
      const result = await bridgePost<unknown>(`/subscriptions/download-tasks/${taskId}/finish`, {});
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_list_download_history',
    'List completed subscription downloads from the Skedulosa history (last 100).',
    {},
    async () => {
      const rows = await bridgeGet<unknown[]>('/subscriptions/history');
      return { content: [{ type: 'text' as const, text: JSON.stringify(rows, null, 2) }] };
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // VIDEO DETAILS
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    'downlodr_list_video_details',
    'List scraped video metadata stored in the Skedulosa database.',
    {
      channelName: z.string().optional().describe('Filter by channel name'),
    },
    async ({ channelName }) => {
      const params: Record<string, string> = {};
      if (channelName) params.channelName = channelName;
      const result = await bridgeGet<unknown[]>('/subscriptions/video-details', params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_get_video_details_by_url',
    'Get scraped metadata for a specific video URL from the Skedulosa database.',
    { url: z.string().describe('Video URL to look up') },
    async ({ url }) => {
      const result = await bridgeGet<unknown>('/subscriptions/video-details/by-url', { url });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // PROCESS METRICS
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    'downlodr_get_process_load',
    'Get current CPU and memory usage of the Downlodr main process.',
    {},
    async () => {
      const result = await bridgeGet<unknown>('/subscriptions/process-load');
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
