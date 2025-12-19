# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Downlodr is an Electron desktop application for downloading videos from various platforms (YouTube, Vimeo, Twitch, Twitter, TikTok, etc.) using yt-dlp as the backend. Built with Electron Forge + Vite + React + TypeScript.

## Common Commands

```bash
# Install dependencies
yarn

# Run in development mode (opens DevTools automatically)
yarn start

# Build and package for distribution
yarn make

# Run linting
yarn lint
```

## Architecture

### Electron Process Model

The app follows Electron's multi-process architecture:

- **Main Process** (`src/main.ts`): Handles system tray, window management, IPC handlers, yt-dlp operations, clipboard monitoring, plugin management, and file system operations
- **Preload Script** (`src/preload.ts`): Exposes secure APIs to renderer via `contextBridge`. Key exposed objects:
  - `window.downlodrFunctions` - File/folder operations, path utilities
  - `window.ytdlp` - Video info fetching, download control
  - `window.appControl` - Window visibility, clipboard monitoring
  - `window.plugins` - Plugin lifecycle management
  - `window.updateAPI` - App and yt-dlp update events
- **Renderer Process** (`src/renderer.tsx`, `src/App.tsx`): React application with routing

### State Management

Uses Zustand stores with IndexedDB persistence:

- **`src/Store/mainStore.tsx`**: App settings (download location, speed limits, telemetry consent, UI preferences)
- **`src/Store/download/`**: Refactored download store with separate files:
  - `downloadStore.ts` - Main store with download queue, active downloads, history
  - `types.ts` - TypeScript interfaces for download states
  - `selectors.ts` - Memoized selectors for performance
  - `controller.ts` - Download control logic
  - `migration.ts` - Store version migrations
- **`src/Store/playlistStore.tsx`**: Playlist download management
- **`src/Store/pluginStore.tsx`**: Plugin state

### Plugin System

Plugins are loaded from `{userData}/plugins/` directory:

- **Main process** (`src/plugins/pluginManager.ts`): Plugin loading, installation, IPC setup
- **Registry** (`src/plugins/registry.ts`): Menu items, taskbar items registration
- **Renderer** (`src/plugins/PluginLoader.tsx`): Plugin execution in renderer
- **Extension points** (`src/plugins/extensionPoints.ts`): Format selectors, side panels, modals

Plugins have a `manifest.json` and can register:
- Context menu items
- Taskbar buttons
- Side panel content
- Modal dialogs
- Format selector extensions

### Services Layer (`src/services/`)

- `api/`: HTTP client, GitHub API, telemetry API
- `download/`: Format selection, metadata extraction
- `update/`: App update checking
- `telemetry/`: Usage analytics

### UI Structure

- **Layouts**: `src/Layout/MainLayout.tsx` (main app), `src/Layout/PluginLayout.tsx` (plugin manager)
- **Pages**: `src/Pages/` - StatusSpecificDownload, History, PlugInManager
- **Components**: `src/Components/` with shadcn/ui components in `SubComponents/shadcn/`
- **Routing**: HashRouter with routes for `/status/:status`, `/history`, `/category/:categoryId`, `/tags/:tagId`, `/plugins`

### Key Patterns

- Path alias `@/*` maps to `src/*` (configured in tsconfig.json and vite.renderer.config.ts)
- IPC communication uses invoke/handle pattern with channel naming like `ytdlp:download`, `plugins:list`
- Downloads tracked by UUID, with controller IDs from yt-dlp-helper
- Clipboard monitoring runs in main process, sends `clipboard-changed` events to renderer
- System tray icon changes to indicate download completion

### Build Configuration

- `forge.config.ts`: Electron Forge configuration with NSIS installer for Windows
- Vite configs: `vite.main.config.ts`, `vite.preload.config.ts`, `vite.renderer.config.ts`
- `yt-dlp.exe` is copied to output during `postPackage` hook
