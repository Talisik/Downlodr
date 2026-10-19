# Changelog

## 1.17.11-exp

### New feature
- Added favoriting subscriptions (Skedulosa channels and AFDA websites), shown on the Favorites page.
- Added bulk tag and category assignment from the right-click menu when several rows are selected.

### Added
- Added the Toolbar type filter pills to the Favorites, Category and Tag pages.
- Added a page-jump dropdown to the pagination controls.
- Added sorting by favorite on the Status page.
- Added a confirmation before deleting a category or tag from the sidebar.

### Adjusted
- Adjusted bulk tag and category menus to show a partial mark (–) when only some selected items have a value.
- Adjusted bulk tag and category toasts to show how many downloads changed and how many already had it.
- Adjusted the pagination dropdown hover effect.

### Fixed
- Fixed favorited items disappearing from Favorites once their download started.
- Fixed renaming a category from the sidebar.
- Fixed articles showing as videos in Category, Tag and Favorites pages, where tag, category, rename and remove did nothing.
- Fixed renaming or deleting a tag or category globally not updating articles.

## 1.17.10-exp

### New feature
- Added per-site login in a built-in browser window, saved across restarts.
- Added importing a cookies.txt file for downloads that need a login.
- Added sharing a whole category from the sidebar.
- Added auto-healing for AFDA scrapes that only fetch listing pages.

### Added
- Added shift-click to select a range of rows in the download and article lists.
- Added bulk tag and category assignment for selected downloads.
- Added the URL and app version to telemetry error reports.
- Added an automated test suite covering downloads, playlists, AFDA, subscriptions, transcripts and settings.

### Adjusted
- Adjusted Settings and Advanced Settings to share one visual style.
- Adjusted the column settings to show required columns separately.
- Adjusted the advanced button background color in Settings.
- Adjusted table group borders in AFDA and Subscriptions.
- Adjusted the subscription header to abbreviate long month names.
- Removed the Chrome option from browser cookie settings.

### Fixed
- Fixed the "None" cookie setting still using browser cookies.
- Fixed context menus going off screen, and they now highlight their target row.
- Fixed add-on downloads breaking when started twice at once.
- Fixed the caption plugin icon not matching the bundled plugin icons.
- Fixed video info lookups failing without saying why.

### Plugin Update
- Updated afda-backend from 1.3.0 to 1.11.1.
- Updated video-nemesis-toolkit from 1.0.0 to 1.0.2.
