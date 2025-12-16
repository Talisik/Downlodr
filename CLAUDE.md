# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Downlodr is an Electron desktop application for downloading videos/audio from 1800+ platforms (YouTube, Vimeo, TikTok, etc.). Built with Electron Forge + Vite, React, TypeScript, and TailwindCSS.

## Development Commands

```bash
# Install dependencies
yarn

# Start development server
yarn start

# Lint code
yarn lint

# Build for distribution
yarn make                    # Standard Electron Forge packaging
yarn build:dmg               # macOS DMG with code signing/notarization
yarn build:intel             # macOS Intel-specific build
yarn build:linux             # Linux build
yarn test:dmg                # Test DMG creation without notarization
```

## Architecture

### Process Model (Electron)
- **Main Process** (`src/main.ts`): Window management, system operations, IPC coordination, native OS integration (tray, notifications)
- **Renderer Process** (`src/renderer.tsx`, `src/App.tsx`): React UI, user interactions, state management
- **Preload Script** (`src/preload.ts`): Secure bridge between main/renderer with contextIsolation

### State Management (Zustand)
- `mainStore.tsx`: App-wide UI preferences and settings
- `downloadStore.tsx`: Download items, status, operations
- `pluginStore.tsx`: Plugin configuration
- `playlistStore.tsx`: Playlist operations
- `taskbarDownloadStore.tsx`: Taskbar download state
- `telemetryStore.tsx`: Usage telemetry

### Key Directories
- `src/Components/`: React components (Main/, SubComponents/, shadcn/)
- `src/Pages/`: Main views (StatusSpecificDownload, History, PlugInManager)
- `src/DataFunctions/`: Utility functions (updateChecker, urlValidation, etc.)
- `src/plugins/`: Plugin system (registry, loader, security, extension points)
- `src/schema/`: TypeScript type definitions
- `src/Layout/`: Page layout components

### External Dependencies
- **yt-dlp-helper**: Core download engine (GitHub: Talisik/yt-dlp-helper)
- **FFmpeg**: Media processing (architecture-specific binaries in `binaries/`)
- **Radix UI**: UI primitives
- **Lucide React**: Icons

## yt-dlp Integration

```typescript
// Always use setupYTDLPBinary() before operations
setupYTDLPBinary();

// API methods
YTDLP.getInfo(url)              // Get video info
YTDLP.getPlaylistInfo(options)  // Get playlist info
YTDLP.download({ args })        // Start download
YTDLP.getYTDLPVersion()         // Get version
```

Test compatibility before yt-dlp updates:
```bash
node test-ytdlp-update-compatibility.js
```

## Build Configuration

- `forge.config.ts`: Electron Forge configuration with platform-specific makers
- Platform binaries: `yt-dlp_macos`, `yt-dlp_linux`, `yt-dlp.exe`
- FFmpeg binaries: `binaries/ffmpeg-arm64`, `binaries/ffmpeg-x64`, `binaries/ffmpeg-linux`
- macOS code signing requires `APPLE_IDENTITY` environment variable

## Plugin System

Plugins extend functionality through:
- `src/plugins/registry.ts`: Plugin registration
- `src/plugins/extensionPoints.ts`: Extension point definitions
- `src/plugins/security.ts`: Plugin sandboxing
- `src/plugins/PluginLoader.tsx`: Dynamic plugin loading

## IPC Communication Pattern

Renderer → Main communication flows through preload-exposed APIs:
1. Renderer calls preload API function
2. Preload forwards via ipcRenderer
3. Main process handles via ipcMain
4. Results return through the same chain
