# Downlodr Architecture

## System Overview

Downlodr is a cross-platform desktop application built with Electron, which combines web technologies (HTML, CSS, JavaScript/TypeScript) with a Node.js runtime to create a native-like desktop experience. The application uses a main process and renderer process architecture, which is typical for Electron applications.

## Core Components

### 1. Main Process (`main.ts`)

The Main Process is the application's entry point and responsible for:

- Creating and managing application windows
- Handling system-level operations (file system access, notifications, tray integration)
- Coordinating IPC (Inter-Process Communication) with the renderer process
- Managing the application lifecycle
- Integrating with native OS features (tray, notifications)

### 2. Renderer Process (`renderer.tsx`, `App.tsx`)

The Renderer Process handles the user interface and is responsible for:

- Rendering the UI components using React
- Handling user interactions
- Communicating with the Main Process via IPC
- Managing application state through Zustand stores

### 3. Preload Script (`preload.ts`)

The Preload Script acts as a secure bridge between the renderer and main processes:

- Exposes a controlled set of API functions to the renderer
- Maintains security through contextIsolation
- Provides a way for the renderer to access main process capabilities

## State Management

Downlodr uses Zustand for state management with separate stores:

- **Main Store** (`mainStore.tsx`): Manages application-wide state including UI preferences and settings
- **Download Store** (`downloadStore.tsx`): Manages download items, their status, and operations
- **Plugin Store** (`pluginStore.tsx`): Manages plugin configuration and state
- **Playlist Store** (`playlistStore.tsx`): Manages playlist information and operations

## Component Architecture

### Pages

- **StatusSpecificDownload**: Handles the main download management interface
- **History**: Displays historical download records
- **PluginManager**: Manages installable plugins

### Components

Components are organized hierarchically:

- **Main Components**: Core application components
- **Sub Components**: Reusable smaller components
- **Shared Components**: Components shared across different pages
- **Modal Components**: Dialog and overlay components

## External Dependencies

### Core Dependencies

- **Electron**: Provides the desktop application framework
- **React**: UI library
- **Vite**: Build tool and development server
- **TypeScript**: Type-safe JavaScript
- **Zustand**: State management

### Functional Dependencies

- **YTDLP Helper**: Core downloading engine
- **FFMPEG**: Media processing
- **Radix UI**: UI component primitives
- **TailwindCSS**: Utility-first CSS framework

## Data Flow

1. User interactions in the UI trigger actions in the Renderer process
2. Actions that require native capabilities are sent to the Main process via IPC
3. The Main process performs the requested operations (e.g., file system access, download operations)
4. Results are sent back to the Renderer process
5. UI is updated based on the results

## Plugin System

Downlodr includes a plugin system that allows for extensibility:

- **PluginManager**: Manages the loading, enabling, and disabling of plugins
- **Plugin Registry**: Maintains a registry of available plugins
- **Plugin API**: Provides interfaces for plugins to interact with the application

## Security Model

- **Context Isolation**: Prevents direct access to Node.js APIs from the renderer process
- **Content Security Policy**: Restricts resources that can be loaded
- **Preload Script**: Provides controlled access to specific main process capabilities

## Build and Packaging

Downlodr uses Electron Forge for building and packaging:

- **Development**: Uses Vite for fast development and hot reloading
- **Production**: Packages the application for distribution with Electron Forge
- **Platform Support**: Currently packaged for Windows, with potential for macOS and Linux support
