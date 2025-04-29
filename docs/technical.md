# Downlodr Technical Documentation

## Development Environment

### Prerequisites

- **Node.js**: Version ^20.17.0
- **Yarn**: Version ^1.22.19
- **Operating System**: Windows, macOS, or Linux (primary development on Windows)

### Development Setup

1. Clone the repository
2. Run `yarn` to install dependencies
3. Run `yarn add github:Talisik/yt-dlp-helper` to install the yt-dlp package
4. Use `yarn start` to run the application in development mode

### Building & Packaging

- Use `yarn make` to create distributable packages
- Electron Forge handles packaging for different platforms
- Currently packaged primarily for Windows

## Technology Stack

### Core Technologies

- **Electron**: v33.3.1 - Cross-platform desktop application framework
- **Electron Forge**: v7.6.0 - Tool for building and publishing Electron applications
- **React**: v19.0.0 - UI component library
- **TypeScript**: v4.5.4 - Typed JavaScript
- **Vite**: v5.0.12 - Development server and build tool

### State Management

- **Zustand**: v5.0.3 - Lightweight state management library
  - Multiple stores for different concerns:
    - `mainStore`: UI and global application state
    - `downloadStore`: Download-related state and operations
    - `pluginStore`: Plugin management state
    - `playlistStore`: Playlist-related state

### UI Framework

- **TailwindCSS**: v3.4.17 - Utility-first CSS framework
- **Radix UI**: Component primitives for accessible UI elements
- **Lucide React**: Icon library
- **React Router DOM**: Navigation management

### Core Functionality

- **YTDLP Helper**: Custom wrapper around yt-dlp for video downloading
- **FFMPEG**: Media processing library used by yt-dlp
- **Axios**: HTTP client for web requests

## System Architecture

### Process Model

- **Main Process**: Node.js process that runs Electron
- **Renderer Process**: Chromium process that displays the UI
- **Preload Script**: Bridge between main and renderer processes

### IPC (Inter-Process Communication)

- Secure communication between main and renderer processes
- Context isolation to prevent direct access to Node.js APIs
- Exposed API through the preload script

### File System Integration

- Direct access to file system through the main process
- Secure handling of file operations
- Custom download destination management

### Plugin System

- Extensible architecture for adding new functionality
- Plugin manager for loading and managing plugins
- Registry of available plugins

## Code Organization

### Directory Structure

- `/src`: Main source code
  - `/main.ts`: Entry point for the Electron application
  - `/renderer.tsx`: Entry point for the React UI
  - `/preload.ts`: Preload script for IPC bridging
  - `/Components`: React components
  - `/Pages`: Main application pages/views
  - `/Store`: Zustand stores
  - `/Assets`: Static assets
  - `/DataFunctions`: Utility functions for data operations
  - `/Layout`: Layout components
  - `/plugins`: Plugin system

### Design Patterns

#### Electron IPC Pattern

- Main process exposes an API to the renderer process
- Preload script provides a secure bridge
- TypeScript interfaces ensure type safety

#### Store Pattern

- Zustand stores for state management
- Separate concerns with multiple stores
- Reactive updates with subscription model

#### Component Composition

- Reusable UI components
- Composition over inheritance
- Separation of concerns

## Key Technical Decisions

### 1. Electron with Vite

- **Rationale**: Fast development experience with hot module replacement
- **Trade-offs**: Adds complexity to the build process
- **Benefits**: Improved developer experience and build performance

### 2. Zustand for State Management

- **Rationale**: Lightweight alternative to Redux with simpler API
- **Trade-offs**: Less established than Redux, fewer middleware options
- **Benefits**: Reduced boilerplate, better performance, TypeScript integration

### 3. Custom YTDLP Integration

- **Rationale**: Need for deep integration with the downloading engine
- **Trade-offs**: Maintenance overhead for custom wrapper
- **Benefits**: Fine-grained control over download processes

### 4. Electron Forge for Packaging

- **Rationale**: Simplified packaging and distribution process
- **Trade-offs**: Less flexibility than manual configuration
- **Benefits**: Consistent build outputs across platforms

## Technical Constraints

### 1. Platform Limitations

- Some APIs are platform-specific, requiring conditional code
- macOS and Linux support require additional testing
- Native features may behave differently across platforms

### 2. Performance Considerations

- Download operations are CPU and network intensive
- UI must remain responsive during downloads
- Memory usage must be monitored, especially with many concurrent downloads

### 3. Security Concerns

- Downloaded content must be scanned/verified
- User permissions must be respected
- IPC calls must be validated

### 4. Distribution Challenges

- Application size (due to FFMPEG and other dependencies)
- Auto-update mechanisms
- Platform-specific packaging requirements

## Error Handling & Logging

### Error Strategy

- Graceful degradation when errors occur
- User-friendly error messages
- Detailed logging for debugging

### Logging Implementation

- Console logging in development
- Error reporting in production
- Crash reporting via Electron's crash reporter

## Testing Approach

### Manual Testing

- UI/UX testing on different platforms
- Download testing with various sources
- Edge case testing for error handling

### Automated Testing (Future)

- Unit tests for utility functions
- Integration tests for core functionality
- E2E tests for critical user flows

## Future Technical Roadmap

### Short-term Technical Goals

- Improved test coverage
- Enhanced plugin API
- Optimized download engine

### Long-term Technical Vision

- Cross-platform parity
- Advanced media processing features
- Cloud integration capabilities
