# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Downlodr is an Electron-based desktop application for downloading videos from 1,800+ platforms using yt-dlp and FFmpeg. Built with React, TypeScript, Vite, and Zustand for state management.

**Prerequisites:** Node.js v22.12.0+ (or Node.js v20.19.0+), yarn v1.22.19+

## Common Commands

### Development
```bash
yarn              # Install dependencies
yarn start        # Start development mode
yarn lint         # Run ESLint
```

### Building & Packaging

**Linux:**
```bash
# Download binaries and build Linux packages (DEB, RPM, ZIP)
./scripts/build-linux.sh

# Build with force flag (skip binary checks)
./scripts/build-linux.sh --force

# Individual package makers
yarn make:linux          # All Linux packages
yarn make:linux:deb      # DEB package only
yarn make:linux:rpm      # RPM package only
yarn make:linux:zip      # ZIP archive only
```

**General:**
```bash
yarn package    # Package app without creating distributable
yarn make       # Create distributable for current platform
yarn publish    # Publish to configured publishers
```

### Scripts
- `scripts/build-linux.sh` - Downloads yt-dlp and FFmpeg binaries, builds Linux packages
- `scripts/setup-linux-build.sh` - Sets up Linux build environment and dependencies

## Architecture

### Electron Process Architecture

**Main Process (`src/main.ts`):**
- Application lifecycle management
- IPC handlers for file operations, downloads, and system interactions
- Window creation and management (including tray icon)
- Plugin system initialization via `PluginManager`
- yt-dlp process management and coordination
- Update checking and notification system
- Telemetry service integration

**Preload (`src/preload.ts`):**
- Context bridge exposing `downlodrFunctions` API to renderer
- IPC communication layer between renderer and main process
- Download progress throttling system (`BalancedDownloadThrottler`)
- UUID generation for download tracking
- Plugin API exposure to renderer

**Renderer (`src/renderer.tsx`, `src/App.tsx`):**
- React application entry point
- Router configuration for page navigation
- Theme provider and global state initialization

### State Management (Zustand Stores)

Located in `src/Store/`:

- **`downloadStore.tsx`**: Core download management
  - Three-phase download system (video 0-50%, audio 51-100%, merge/process)
  - Queue management with concurrent download limits
  - Progress tracking with phase-aware calculations
  - IndexedDB persistence for downloads
  - Tags and categories management
  - Status tracking: downloading, finished, failed, paused, stopped

- **`mainStore.tsx`**: Application-wide settings and UI state
  - User preferences (download path, speed limits, concurrent downloads)
  - Modal visibility states
  - Column visibility preferences

- **`taskbarDownloadStore.tsx`**: Quick download interface state
  - URL input and validation
  - Format selection state
  - Quick action controls

- **`playlistStore.tsx`**: Playlist/channel download management
  - Metadata fetching for playlists
  - Individual video selection within playlists

- **`pluginStore.tsx`**: Plugin system state
  - Installed and available plugins tracking
  - Plugin enable/disable state
  - Extension point registrations

- **`telemetryStore.tsx`**: Analytics and error reporting preferences

### Plugin System

Architecture located in `src/plugins/`:

- **`pluginManager.ts`**: Main process plugin lifecycle manager
  - Plugin installation, loading, and unloading
  - Plugin directory management in userData
  - Plugin enable/disable state persistence

- **`registry.ts`**: Plugin registration and discovery system
- **`security.ts`**: Plugin validation and sandboxing (ZIP extraction, manifest validation)
- **`extensionPoints.ts`**: Extension point definitions for plugins to hook into
- **`pluginAPI.ts`**: API exposed to plugins for interacting with Downlodr
- **`types.ts`**: TypeScript interfaces for plugin development

**Plugin Extension Points:**
- Task bar items
- Side panel extensions
- Modal extensions
- Context menu items
- Download interceptors

### Download Process Flow

1. **Initialization**: User inputs URL → Metadata fetched via yt-dlp → Format selection
2. **Queue Management**: Download added to queue → DownloadController processes based on `maxDownloadNum`
3. **Phase 1 (Video)**: `downloadPhase: 'video'`, progress 0-50%, `rawProgress` tracks actual yt-dlp output
4. **Phase 2 (Audio)**: `downloadPhase: 'audio'`, progress 51-100%, second stream download
5. **Phase 3 (Merge)**: Status changes to 'initializing', merger combines streams via FFmpeg
6. **Completion**: Log parsing detects process exit code → Move to finished/failed → Continue queue

Key files:
- Progress updates throttled via `preload.ts` (150ms for progress, 500ms for logs)
- Download metadata utilities in `src/Utils/Metadata/`
- Error handling in `src/Utils/ErrorCodeHelper.ts`

### Component Structure

- **`src/Components/Main/`**: Core application components (modals, navigation, title bar, task bar)
- **`src/Components/SubComponents/custom/`**: Custom reusable components (download list, context menus, format selectors)
- **`src/Components/SubComponents/shadcn/`**: Shadcn UI component library integration
- **`src/Pages/`**: Main page components (History, StatusSpecificDownload, PlugInManager)
- **`src/Layout/`**: Layout wrappers (MainLayout, PluginLayout)

### Utilities

- **`src/Utils/Data/`**: Data processing helpers (URL validation, string formatting, update checker)
- **`src/Utils/Metadata/`**: Video metadata extraction and processing (captions, language, download info)
- **`src/Utils/Telemetry/`**: Error tracking and analytics service
- **`src/Utils/indexedDBStorage.ts`**: Persistent storage layer for downloads

### Build Configuration

- **`forge.config.js`**: Electron Forge configuration
  - Platform-specific makers (DEB, RPM, ZIP)
  - Post-package hook copies platform-specific binaries to `resources/bin/`
  - Linux binaries from `binaries/linux/` (yt-dlp, ffmpeg, ffprobe)
  - Windows binaries from project root (yt-dlp.exe)

- **Vite configs**: `vite.main.config.ts`, `vite.preload.config.ts`, `vite.renderer.config.ts`
- **TypeScript**: Path alias `@/*` maps to `./src/*`

## Platform-Specific Notes

### Linux Build Process
1. Script downloads latest yt-dlp and FFmpeg binaries
2. Extracts and places in `binaries/linux/`
3. Forge's postPackage hook copies to package's `resources/bin/`
4. Runtime detection in main process resolves binary paths based on platform

### Binary Management
- Development: Binaries resolved from `binaries/linux/` or project root
- Production: Binaries bundled in `resources/bin/` via postPackage hook
- yt-dlp-helper package provides Node.js wrapper around yt-dlp binary

## Data Schemas

Key type definitions in `src/schema/`:
- `download.ts`: Download object structure with progress tracking
- `ytdlp.ts`: yt-dlp options and format specifications
- `metadata.ts`: Video metadata structure
- `componentSchema.ts`: UI component prop types