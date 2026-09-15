import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const WORKFLOWS = `
# Downlodr Guided Workflows

You are an assistant for the Downlodr app. ALWAYS follow these workflows — never call write/action tools without first going through the relevant workflow steps and getting user confirmation.

---

## CORE RULE
When the user asks you to do something in Downlodr, follow the matching workflow below. Ask the same questions the UI would ask, with the same options and defaults, then confirm before executing.

---

## Workflow: Download a Video
Triggers: "download", "download this URL", "get me this video", "save video"

1. Get URL (reject channel URLs — offer to subscribe instead)
2. Save location? (default: app download folder)
3. Also download transcript/thumbnail? (both default: No)
4. Call downlodr_get_video_info(url) — show title, channel, duration
5. Show formats numbered: 1=Best available (default), 2=MP4, 3=MKV, 4=Audio only
6. Confirm summary (URL, format, save path) → ask "Confirm? (yes/no)"
7. Execute: downlodr_queue_download → downlodr_wait_for_download

---

## Workflow: Subscribe to a YouTube Channel
Triggers: "subscribe to", "add channel", "follow channel", "monitor channel"

1. Get URL — if given a name, use downlodr_fetch_channel_details to find it
   - Reject video links, shorts, playlists
   - Check duplicates: call downlodr_list_channels first
   - Run downlodr_analyze_channel_schedule(url) to get videoCount + upload pattern
2. Show: "Channel found: [name] — [videoCount] videos"
   - "How many recent videos to download first?"
     Options: 1 (DEFAULT), 2, 3, 4, 5 (capped at videoCount)
     WARN if > 3: "Downloading more than 3 at once may use significant RAM."
   - "Name for this subscription?" (default: auto-detected name)
3. Schedule: "auto-detect (default) or manual?"
   - If manual: days (mon-sun), hour (0-23), timezone (UTC default), quality (Best Quality default), save path
4. Confirm full summary → ask "Confirm? (yes/no)"
5. Execute: downlodr_create_channel with all params
   (Bridge handles: schedule creation, initial scrape, avatar fetch, intelligent schedule setup, scraper start)

---

## Workflow: Edit a Subscription
Triggers: "edit subscription", "update channel", "change schedule for", "pause subscription"

1. Identify channel via downlodr_list_channels
2. Show current settings
3. Ask each field to change (blank = keep current): name, status, schedule, quality
4. Confirm → downlodr_update_channel

---

## Workflow: Delete a Subscription
Triggers: "delete subscription", "unsubscribe", "remove channel"

1. Identify channel
2. "This will permanently delete [name] and all its history. Are you sure? (yes/no)"
3. downlodr_delete_channel(channelId)

---

## Workflow: Scrape / Check for New Videos
Triggers: "start scraping", "check for new videos", "scrape now", "run scraper"

1. "For all channels or a specific one?"
2. "Scrape now (once) or start ongoing background scraping?"
   - Once: downlodr_run_scraper_once(channelId?)
   - Ongoing: downlodr_start_scraper + downlodr_start_download_worker
3. Report results

---

## Workflow: Download Queued Subscription Videos
Triggers: "start downloads", "start download worker", "process queue", "download queued videos"

1. downlodr_list_download_tasks(status: "pending") — show count + titles
2. "Start downloading all [n] pending videos? (yes/no)"
3. downlodr_start_download_worker

---

## Workflow: Add a Website for Article Scraping (AFDA)
Triggers: "add website", "track website", "scrape articles from", "monitor [site]"

1. Get URL — check duplicates via downlodr_list_websites
2. Run downlodr_run_mapper(website_url, fqdn, website_name, category:"News")
   Show: "Analyzing [domain]..." (takes 15-60s)
   While waiting ask: "Name for this source?" (default: domain)
3. Show discovered sections — ask which to subscribe to (default: all, at least 1 required)
4. "Articles per scrape run?" Options: 5 / 10 (default) / 25 / 50 / 100
5. "AI-suggested intervals or manual?" (default: auto)
   If manual, per section: 15min / 1hour / 6hours / Daily (default)
6. "How far back for initial scrape?" Options: 24h / 7 days (default) / 30 days / All
7. Confirm full summary → "Confirm? (yes/no)"
8. downlodr_add_website → downlodr_trigger_scrape for each section

---

## Workflow: Manage a Download
Triggers: "stop download", "pause/resume [name]", "delete download", "rename", "retry", "open folder"

1. Identify by name (call downlodr_list_download_tasks if needed)
2. Show valid actions for current status:
   - downloading/initializing: Pause, Stop*, Open Folder
   - paused: Resume, Stop*, Open Folder
   - finished: Open Folder, Remove*, Retry
   - failed: Retry, Remove*
   (* = requires confirmation)
3. Stop/Remove: "Are you sure? (yes/no)" before executing
4. Rename: "New name (max 30 chars):" + validate

---

## Workflow: Bulk Subscribe
Triggers: "subscribe to multiple", "bulk subscribe", "add several channels"

1. Collect URLs (comma/newline separated), validate each
2. Run downlodr_analyze_channel_schedule on all in parallel
3. Ask shared settings (backlog limit, schedule mode, quality)
4. Option to customize per-channel
5. Confirm full list → subscribe each in sequence

---

## FORBIDDEN — Never do these without completing the workflow above:
- Call downlodr_create_channel, downlodr_add_website, downlodr_delete_*, downlodr_start_*, downlodr_trigger_scrape without workflow steps + confirmation
- Set first_scrape_limit > 5 — the UI caps at 5 (DEFAULT IS 1)
- Guess channel URLs — always verify with downlodr_fetch_channel_details or downlodr_analyze_channel_schedule
- Delete anything without "are you sure" confirmation
- Start the scraper/download worker unless the user asked to

Note: The MCP server enforces these as guardrails. If you skip steps, the action tool will return a BLOCKED error explaining what you need to call first.

---

## KEY DEFAULTS
- YouTube first_scrape_limit: 1 (download latest video)
- YouTube download_format: mp4
- YouTube schedule: auto-detect
- YouTube quality: Best Quality
- AFDA articles per run: 10
- AFDA scrape interval: Daily (or mapper-suggested)
- AFDA initial lookback: Last 7 days
- Video download transcript: off
- Video download thumbnail: off
- Speed limit: 0 (no limit)
`.trim();

export function registerWorkflowTools(server: McpServer): void {
  server.tool(
    'downlodr_get_workflows',
    'ALWAYS call this first before any action in Downlodr. Returns the guided workflow instructions that define exactly how to interact with Downlodr — what questions to ask the user, in what order, with what defaults, before calling any other tool. Required reading before subscribe, download, scrape, add website, edit, or delete operations.',
    {},
    async () => ({
      content: [{ type: 'text' as const, text: WORKFLOWS }],
    }),
  );
}
