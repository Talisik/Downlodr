# Downlodr MCP Server

Connects Claude to the Downlodr Electron app. Claude can download videos, list subscriptions, search scraped articles, and more — all by talking to the running Downlodr app.

## Prerequisites

1. Downlodr must be **running** before Claude calls any tool.
2. Node.js 18+.

## Setup

### Build

```sh
cd downlodr-mcp
npm install
npm run build
```

### Connect to Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "downlodr": {
      "command": "node",
      "args": ["/absolute/path/to/downlodr_v3/downlodr-mcp/dist/index.js"],
      "type": "stdio"
    }
  }
}
```

### Connect to Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "downlodr": {
      "command": "node",
      "args": ["/absolute/path/to/downlodr_v3/downlodr-mcp/dist/index.js"]
    }
  }
}
```

## How it works

```
Claude
  ↕ stdio (MCP protocol)
downlodr-mcp/dist/index.js   ← this package
  ↕ HTTP + WebSocket on 127.0.0.1:7185
Downlodr Electron app (must be running)
  ↕ internal service calls
yt-dlp, AFDA, Skedulosa, SQLite DBs
```

The Downlodr app generates a random auth token on each launch and writes it to:
- **macOS**: `~/Library/Application Support/Downlodr/mcp-token.txt`
- **Windows**: `%APPDATA%\Downlodr\mcp-token.txt`
- **Linux**: `~/.config/Downlodr/mcp-token.txt`

The MCP server reads this file automatically.

## Available Tools

| Tool | Description |
|------|-------------|
| `downlodr_get_app_status` | Check if Downlodr is running |
| `downlodr_get_system_info` | CPU, memory, OS info |
| `downlodr_get_video_info` | Fetch metadata for any video URL |
| `downlodr_get_playlist_info` | Fetch playlist metadata |
| `downlodr_queue_download` | Queue a video in the to-download list (does not download) |
| `downlodr_wait_for_download` | Track download progress to completion |
| `downlodr_stop_download` | Cancel an active download |
| `downlodr_get_ytdlp_version` | Get installed yt-dlp version |
| `downlodr_list_channels` | List subscribed YouTube channels |
| `downlodr_get_channel` | Get details for a channel |
| `downlodr_list_schedules` | List download schedules |
| `downlodr_list_download_tasks` | List pending download queue |
| `downlodr_list_download_history` | List completed downloads |
| `downlodr_get_weekly_schedule` | Get this week's schedule |
| `downlodr_get_intelligent_schedules` | AI-predicted upload schedules |
| `downlodr_get_channel_slots` | Get time slots for a channel |
| `downlodr_transcript_info` | Transcript setup info |
| `downlodr_generate_transcript` | Get FFmpeg Whisper command |
| `downlodr_list_articles` | List AFDA scraped articles |
| `downlodr_search_articles` | Search articles by keyword |
| `downlodr_get_article` | Get full article content |
| `downlodr_list_manual_articles` | List manually parsed articles |
| `downlodr_list_websites` | List tracked AFDA websites |
| `downlodr_trigger_scrape` | Trigger an immediate scrape |
| `downlodr_list_scrape_jobs` | List recent scrape jobs |
| `downlodr_get_website_analytics` | Website analytics & heatmap |
| `downlodr_get_afda_setting` | Get an AFDA setting value |
