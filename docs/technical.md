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
- **React Icons**: Icon library
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

### Update System Enhancement

**Channel-Aware Version Management**

The update system now supports channel-aware version checking to ensure users receive appropriate updates based on their current version channel:

#### Implementation Details

- **Channel Detection**: Automatically detects version channel from version suffix (e.g., `-exp`, `-stable`)
- **Filtered Updates**: Only checks for updates within the same channel
  - Experimental versions (`-exp`) only see experimental updates
  - Stable versions (`-stable`) only see stable updates
  - Versions without channels only see releases without channel suffixes
- **Backward Compatibility**: Maintains compatibility with existing version formats

#### Technical Components

```typescript
// Channel extraction from version string
function getVersionChannel(version: string): string | null

// Release filtering by channel
function filterReleasesByChannel(releases: GitHubRelease[], targetChannel: string | null): GitHubRelease[]
```

#### Benefits

- **User Safety**: Prevents accidental promotion between stability channels
- **Development Workflow**: Allows parallel development of stable and experimental releases
- **Controlled Distribution**: Enables targeted rollouts to specific user groups

#### Usage Examples

- Current version `1.3.9-exp` → Only checks releases tagged with `-exp`
- Current version `1.3.9-stable` → Only checks releases tagged with `-stable`
- Current version `1.3.9` → Only checks releases without channel suffixes

#### Enhanced Return Object
The `checkForUpdates()` function now returns:
- `currentChannel`: The detected channel of the current version
- `message`: Informative message when no releases found for channel
- Improved error handling with channel context

### SpeedGraph Component

**Real-time Download Speed Visualization**

The SpeedGraph component provides a Windows-like line graph visualization for tracking download speeds in real-time. It features gradient fills, trend detection, and performance optimizations.

#### Key Features

- **Real-time Updates**: Efficiently tracks and displays speed changes every second
- **Trend Detection**: Automatically detects increasing, decreasing, or stable speed patterns
- **Visual Feedback**: Background color changes (green for increasing, red for decreasing speeds)
- **Gradient Fills**: Beautiful area fills under the speed curve
- **Performance Optimized**: Throttling and memoization to prevent excessive re-renders
- **Configurable**: Customizable dimensions, data points, and update intervals

#### Technical Implementation

```typescript
interface SpeedGraphProps {
  currentSpeed: string; // Current speed string (e.g., "1.5 MB/s", "512 KB/s")
  className?: string;
  width?: number;
  height?: number;
  maxDataPoints?: number; // Maximum number of data points to keep
  updateInterval?: number; // Update frequency in milliseconds
  showHeader?: boolean; // Whether to show the header with speed text
  showStatus?: boolean; // Whether to show the status indicator
}
```

#### Usage Examples

```typescript
// Basic usage
<SpeedGraph currentSpeed={download.speed} />

// With status indicator
<SpeedGraph currentSpeed={download.speed} showStatus={true} />

// Custom size and settings
<SpeedGraph 
  currentSpeed={download.speed}
  width={300}
  height={100}
  maxDataPoints={45}
  updateInterval={500}
  showStatus={true}
/>

// Integration with download store
const DownloadSpeedDisplay = ({ downloadId }) => {
  const downloads = useDownloadStore((state) => state.downloading);
  const download = downloads.find(d => d.id === downloadId);
  
  if (!download) return null;
  
  return (
    <SpeedGraph 
      currentSpeed={download.speed}
      showStatus={true}
      width={250}
      height={90}
    />
  );
};
```

#### Performance Optimizations

- **Throttling**: Updates are throttled to prevent excessive re-renders
- **Memoization**: Speed parsing is memoized to avoid unnecessary calculations
- **Data Limiting**: Automatically limits data points to prevent memory issues
- **Efficient Rendering**: Uses SVG for smooth graphics without performance overhead

#### Trend Detection Algorithm

The component uses a sophisticated trend detection algorithm:

1. **Data Collection**: Collects speed data points over time
2. **Moving Average**: Calculates moving averages to smooth out fluctuations
3. **Threshold Detection**: Uses configurable thresholds to determine trends
4. **Visual Feedback**: Changes colors and gradients based on detected trends

#### Color Scheme

- **Green**: Increasing speeds (`#10b981`)
- **Red**: Decreasing speeds (`#ef4444`)
- **Gray**: Stable speeds (`#6b7280`)

All colors include gradient variations for visual appeal and dark mode support.
