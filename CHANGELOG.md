# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.9.14-exp-playground] - develop branch - 2026-04-27

### Added
- **Skedulosa** — full scheduled download feature with channel subscriptions, intelligent scheduling, history, analytics, and activity log
- Subscription view with per-channel detail tabs (downloads, analytics, activity log, settings)
- Bulk functions for skedulosa pages: select all, delete, clear pending tasks
- Context menus for subscription and schedule pages (edit, delete, pause, resume, clear pending)
- Confirmation modal for bulk delete and bulk operations in skedulosa
- Resize and drag for history and schedule page columns
- Skedulosa group view inside the main download status page
- Subscription queue with dedup logic and sequential scrape-per-channel ordering
- Activity tracker inside the scanning modal
- Run Once button for manual subscription trigger
- Progress toast during scraping operations
- Video streaming via yt-dlp (`ytdlp:getDirectUrl` IPC)
- **AFDA** — article download feature with side panel UI and article schema
- **Transcription** — Whisper-based transcript downloads; bulk transcript download via toolbar
- Transcript button in status page rows and toolbar
- Plugin system via Extendr package; plugins moved to dedicated plugin page
- Multi-select plugin support in toolbar
- Category tag page searchbar
- Enhanced search/filter UI combining downloads and categories with empty state
- System tray notifications with new Downlodr logo/icon
- Update notification component
- Tooltip wrapper component
- Confirm modal component
- Horizontal scroll for skedulosa pages
- Disabled tooltip for toolbar items
- Sticky headers for skedulosa page tables
- Next run and last run columns for skedulosa schedule page
- Animations across UI
- Help button restored to taskbar
- SQLite kill switch for database
- Log listener added to toolkit test page
- Dev toolkit page for skedulosa

### Changed
- Progress updates throttled to 150 ms intervals to reduce IPC overhead (status/completion events bypass throttle)
- Per-download log buffer capped at 50 KB to prevent memory growth
- Channel info fetch and intelligent scheduling now run sequentially
- Subscription queue waits for `scrapeOnce` to complete before processing the next channel
- First-run video scrape limit lowered to 1–5 videos
- Subscription banner display extended to 5 seconds
- UI refreshed to non-stroke based design across all features (downloads, plugins, skedulosa)
- Dark mode improvements across skedulosa pages, context menus, and empty states
- Scrollbar behavior updated to appear only on hover and scroll
- Removed metadata fetch on app startup for faster launch
- App name in Windows notifications updated to "Downlodr"
- Tray icon notification centered in notification pop-up
- Scraping modal errors now use default toast instead of modal error
- Redundant yt-dlp current version checker removed

### Fixed
- Orphaned yt-dlp processes now killed with SIGKILL on app quit (Windows process leak)
- Run in background enabled (DR2-358, DR2-354)
- Page navigation errors
- Navigation allowed while channel scanning runs in background
- Canceling channel scraping
- Navigate to newly created schedule after creation
- Error status filter for skedulosa
- Toast and scanning modal UI
- Telemetry store persistence and rehydration bug
- Transcript flow to plugins (DR2-337)
- SQLite packaging — asar file inclusion fix
- No-schedule route guard for skedulosa navigation
- Active navlink for downloads no longer triggered by skedulosa routes
- Skedulosa schedule page column layout
- YouTube link validation for channel subscription input
- Resume download now restores autocaption and thumbnail file locations
- JavaScript error for no-channel state in subscribe modal
- Scattered components inside download navigation bar

## [Unreleased]

### Added
- Allowed docx and talisik-shortener packages for plugin use
- Added automatic plugin creator via npm
- Added dark mode and light mode for CC to Markdown plugin
- Added dark mode and light mode for Metadata plugin
- Added docx formatting to CC to Markdown plugin

### Changed
- Updated plugin documentation
- Improved how plugin taskbar items are handled
- Updater now sticks to the same version type (e.g. experimental → experimental, stable → stable)
- Improved tagging and category logic
- Improved toast UI design
- Enhanced schema logic
- Made the app more responsive on various screen sizes

### Deprecated
- none

### Removed
- none

### Fixed
- Fixed dark/light mode toggle in the sidebar

### Security
- none

## [1.3.7] - 2025-05-23

### Added
- Workflows
- Changelog md

### Fixed
- Incorrect commit and tag logic

## [1.3.8] - 2025-06-06

### Added
- New metadata exporter plugin
- New sharing plugin
- New CC to markdown/text plugin
- New file converter plugin
- Plugin icons to details and manager screen

### Changed
- Adjusted rename modal UI and logic
- Adjusted child modals of download context menu
- Adjusted category and tags context menu
- Adjusted plugin types
- Adjusted plugin sidebars and menu items

### Deprecated
- Previous CC To Markdown Plugin
- Previous Download Metadata Plugin

### Removed
- none

### Fixed
- Fixed navigation context menu
- Fixed checkbox toggle
- Optimized updater logic

### Security
- none