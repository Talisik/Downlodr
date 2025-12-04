# Downlodr Auto-Update Implementation Guide

## Executive Summary

This document outlines the implementation strategy for adding auto-update functionality to Downlodr, an Electron-based video downloading application. The solution will allow users to receive update notifications and install updates seamlessly without manual uninstall/reinstall processes.

## Current Stack Analysis

**Downlodr Tech Stack:**
- **Framework:** ElectronJS
- **Build Tool:** Electron Forge
- **Frontend:** React + Vite
- **State Management:** Zustand
- **Language:** TypeScript
- **Styling:** TailwindCSS
- **Current Platform:** Windows (with potential for cross-platform)

## Auto-Update Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTO-UPDATE SYSTEM                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐      ┌──────────────┐      ┌───────────┐ │
│  │   Update     │      │   Release    │      │  User's   │ │
│  │   Server     │─────▶│   Files      │─────▶│    App    │ │
│  │ (GitHub/CDN) │      │  Storage     │      │ (Electron)│ │
│  └──────────────┘      └──────────────┘      └───────────┘ │
│         │                      │                     │       │
│         │                      │                     │       │
│    [Metadata]            [Artifacts]            [Updater]    │
│  - RELEASES.json        - .nupkg (Win)       - Check Updates │
│  - latest.yml           - .zip (Mac)         - Download      │
│  - version info         - .exe/.dmg          - Install       │
│                                              - Notify User   │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Options

### Option 1: update.electronjs.org (Recommended for Open Source)

**Pros:**
- Free and maintained by Electron team
- Zero infrastructure costs
- Automatic integration with GitHub Releases
- Simple setup (~5 minutes)

**Cons:**
- Requires public GitHub repository
- Limited customization
- Dependent on third-party service

**Best for:** Open source projects like Downlodr

### Option 2: Static Storage (S3, GCS, Cloudflare R2)

**Pros:**
- Full control over updates
- Works with private repositories
- Can implement staged rollouts
- Low cost ($1-5/month for small apps)

**Cons:**
- Requires setup and configuration
- Need to manage storage bucket
- Requires additional scripts

**Best for:** Private apps or when you need more control

### Option 3: Custom Update Server

**Pros:**
- Maximum control
- Custom analytics
- Advanced features (A/B testing, staged rollouts)

**Cons:**
- Requires server maintenance
- Higher complexity
- Additional infrastructure costs

**Best for:** Enterprise applications

---

## Recommended Implementation: update.electronjs.org

Given that Downlodr is an open-source project on GitHub, I recommend using **update.electronjs.org** for its simplicity and zero cost.

## Detailed Implementation Workflow

### Phase 1: Setup and Configuration

#### Step 1.1: Install Required Dependencies

```bash
# Install update-electron-app
yarn add update-electron-app

# Install electron-log for debugging (optional but recommended)
yarn add electron-log
```

#### Step 1.2: Configure Electron Forge for GitHub Publishing

Update your `forge.config.js` or `forge.config.ts`:

```typescript
// forge.config.ts
import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerNSIS } from '@electron-forge/maker-nsis';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { PublisherGithub } from '@electron-forge/publisher-github';

const config: ForgeConfig = {
  packagerConfig: {
    // App name and identifiers
    appBundleId: 'com.downlodr.app',
    appCategoryType: 'public.app-category.productivity',
    // Code signing (required for macOS auto-updates)
    osxSign: {
      identity: 'Developer ID Application: Your Name (TEAM_ID)',
      'hardened-runtime': true,
      entitlements: 'entitlements.plist',
      'entitlements-inherit': 'entitlements.plist',
      'signature-flags': 'library'
    },
    osxNotarize: {
      tool: 'notarytool',
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID
    }
  },
  rebuildConfig: {},
  makers: [
    // Windows Installer (Required for auto-updates on Windows)
    new MakerNSIS({
      oneClick: false,
      perMachine: false,
      allowToChangeInstallationDirectory: true,
      deleteAppDataOnUninstall: false,
    }),
    // ZIP for macOS (Required for auto-updates on macOS)
    new MakerZIP({
      platforms: ['darwin'],
    }),
    // DMG for macOS distribution
    new MakerZIP({
      platforms: ['darwin'],
      macUpdateManifestBaseUrl: 'https://github.com/Talisik/Downlodr/releases/download/latest/'
    }),
    // Linux installers (optional)
    new MakerDeb({}),
    new MakerRpm({}),
  ],
  publishers: [
    // GitHub Publisher - This enables update.electronjs.org
    new PublisherGithub({
      repository: {
        owner: 'Talisik',
        name: 'Downlodr',
      },
      // Use GitHub token from environment variable
      authToken: process.env.GITHUB_TOKEN,
      // Publish to draft release first (recommended)
      draft: true,
      // Pre-release flag
      prerelease: false,
    }),
  ],
  plugins: [
    // Your existing plugins...
  ],
};

export default config;
```

#### Step 1.3: Update package.json

Ensure your `package.json` has the correct repository information:

```json
{
  "name": "downlodr",
  "productName": "Downlodr",
  "version": "1.4.15",
  "description": "Powerful video downloading solution",
  "repository": {
    "type": "git",
    "url": "https://github.com/Talisik/Downlodr.git"
  },
  "author": {
    "name": "Talisik",
    "email": "support@downlodr.com"
  },
  "license": "MIT"
}
```

### Phase 2: Implement Auto-Update Logic

#### Step 2.1: Create Auto-Update Module

Create a new file `src/main/autoUpdater.ts`:

```typescript
// src/main/autoUpdater.ts
import { app, dialog, BrowserWindow } from 'electron';
import { updateElectronApp } from 'update-electron-app';
import log from 'electron-log';

// Configure logging
log.transports.file.level = 'info';
log.info('Auto-updater module loaded');

export function setupAutoUpdater(mainWindow: BrowserWindow | null) {
  // Skip updates in development
  if (!app.isPackaged) {
    log.info('Development mode - auto-updater disabled');
    return;
  }

  log.info('Initializing auto-updater');

  // Initialize the updater
  updateElectronApp({
    updateInterval: '1 hour', // Check for updates every hour
    logger: log,
    notifyUser: true, // Show notification dialog to user
  });

  log.info('Auto-updater initialized successfully');
}

// Advanced version with custom UI (optional)
export function setupAdvancedAutoUpdater(mainWindow: BrowserWindow | null) {
  if (!app.isPackaged) {
    return;
  }

  const { autoUpdater } = require('electron-updater');
  
  // Configure updater
  autoUpdater.logger = log;
  autoUpdater.autoDownload = false; // Manual download control
  autoUpdater.autoInstallOnAppQuit = true;

  // Check for updates on app start
  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 3000); // Wait 3 seconds after startup

  // Check for updates every hour
  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, 60 * 60 * 1000);

  // Event: Update available
  autoUpdater.on('update-available', (info) => {
    log.info('Update available:', info);
    
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('update-available', {
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes,
      });
    }

    // Show dialog to user
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'Update Available',
      message: `A new version (${info.version}) is available!`,
      detail: 'Would you like to download it now?',
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1,
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.downloadUpdate();
      }
    });
  });

  // Event: Update not available
  autoUpdater.on('update-not-available', (info) => {
    log.info('Update not available:', info);
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('update-not-available');
    }
  });

  // Event: Download progress
  autoUpdater.on('download-progress', (progressObj) => {
    const message = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`;
    log.info(message);
    
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('download-progress', {
        percent: progressObj.percent,
        transferred: progressObj.transferred,
        total: progressObj.total,
        bytesPerSecond: progressObj.bytesPerSecond,
      });
    }
  });

  // Event: Update downloaded
  autoUpdater.on('update-downloaded', (info) => {
    log.info('Update downloaded:', info);
    
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('update-downloaded', {
        version: info.version,
      });
    }

    // Show dialog to restart app
    dialog.showMessageBox(mainWindow!, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded successfully!',
      detail: 'The application will restart to apply the update.',
      buttons: ['Restart Now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall(false, true);
      }
    });
  });

  // Event: Error
  autoUpdater.on('error', (error) => {
    log.error('Auto-updater error:', error);
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('update-error', {
        message: error.message,
      });
    }
  });
}
```

#### Step 2.2: Integrate with Main Process

Update your main process file (e.g., `src/main/index.ts` or `src/index.ts`):

```typescript
// src/main/index.ts
import { app, BrowserWindow } from 'electron';
import { setupAutoUpdater } from './autoUpdater';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL || 
    `file://${path.join(__dirname, '../renderer/index.html')}`);

  // Setup auto-updater after window is ready
  mainWindow.once('ready-to-show', () => {
    setupAutoUpdater(mainWindow);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
```

### Phase 3: Create Update UI Components (React)

#### Step 3.1: Create Update Store (Zustand)

```typescript
// src/renderer/stores/updateStore.ts
import { create } from 'zustand';

interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
}

interface DownloadProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

interface UpdateState {
  updateAvailable: boolean;
  updateInfo: UpdateInfo | null;
  downloadProgress: DownloadProgress | null;
  updateDownloaded: boolean;
  updateError: string | null;
  isChecking: boolean;
  
  // Actions
  setUpdateAvailable: (info: UpdateInfo) => void;
  setDownloadProgress: (progress: DownloadProgress) => void;
  setUpdateDownloaded: (info: UpdateInfo) => void;
  setUpdateError: (error: string) => void;
  setIsChecking: (checking: boolean) => void;
  resetUpdate: () => void;
}

export const useUpdateStore = create<UpdateState>((set) => ({
  updateAvailable: false,
  updateInfo: null,
  downloadProgress: null,
  updateDownloaded: false,
  updateError: null,
  isChecking: false,

  setUpdateAvailable: (info) => set({ 
    updateAvailable: true, 
    updateInfo: info,
    isChecking: false,
  }),
  
  setDownloadProgress: (progress) => set({ 
    downloadProgress: progress 
  }),
  
  setUpdateDownloaded: (info) => set({ 
    updateDownloaded: true,
    updateInfo: info,
    downloadProgress: null,
  }),
  
  setUpdateError: (error) => set({ 
    updateError: error,
    isChecking: false,
  }),
  
  setIsChecking: (checking) => set({ 
    isChecking: checking 
  }),
  
  resetUpdate: () => set({
    updateAvailable: false,
    updateInfo: null,
    downloadProgress: null,
    updateDownloaded: false,
    updateError: null,
    isChecking: false,
  }),
}));
```

#### Step 3.2: Create Update Notification Component

```typescript
// src/renderer/components/UpdateNotification.tsx
import React, { useEffect } from 'react';
import { useUpdateStore } from '../stores/updateStore';

export const UpdateNotification: React.FC = () => {
  const {
    updateAvailable,
    updateInfo,
    downloadProgress,
    updateDownloaded,
    updateError,
    setUpdateAvailable,
    setDownloadProgress,
    setUpdateDownloaded,
    setUpdateError,
  } = useUpdateStore();

  useEffect(() => {
    // Listen for update events from main process
    window.electron.ipcRenderer.on('update-available', (info) => {
      setUpdateAvailable(info);
    });

    window.electron.ipcRenderer.on('download-progress', (progress) => {
      setDownloadProgress(progress);
    });

    window.electron.ipcRenderer.on('update-downloaded', (info) => {
      setUpdateDownloaded(info);
    });

    window.electron.ipcRenderer.on('update-error', (error) => {
      setUpdateError(error.message);
    });

    return () => {
      // Cleanup listeners
      window.electron.ipcRenderer.removeAllListeners('update-available');
      window.electron.ipcRenderer.removeAllListeners('download-progress');
      window.electron.ipcRenderer.removeAllListeners('update-downloaded');
      window.electron.ipcRenderer.removeAllListeners('update-error');
    };
  }, []);

  if (updateError) {
    return (
      <div className="fixed bottom-4 right-4 bg-red-500 text-white p-4 rounded-lg shadow-lg max-w-md">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Update Error</h3>
          <button 
            onClick={() => setUpdateError(null)}
            className="text-white hover:text-gray-200"
          >
            ✕
          </button>
        </div>
        <p className="text-sm">{updateError}</p>
      </div>
    );
  }

  if (updateDownloaded) {
    return (
      <div className="fixed bottom-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg max-w-md">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Update Ready!</h3>
        </div>
        <p className="text-sm mb-3">
          Version {updateInfo?.version} has been downloaded and is ready to install.
        </p>
        <button 
          onClick={() => window.electron.ipcRenderer.send('install-update')}
          className="w-full bg-white text-green-600 py-2 rounded font-medium hover:bg-gray-100"
        >
          Restart & Install Now
        </button>
      </div>
    );
  }

  if (downloadProgress) {
    return (
      <div className="fixed bottom-4 right-4 bg-blue-500 text-white p-4 rounded-lg shadow-lg max-w-md">
        <h3 className="font-semibold mb-2">Downloading Update...</h3>
        <div className="bg-white/20 rounded-full h-2 mb-2">
          <div 
            className="bg-white h-2 rounded-full transition-all duration-300"
            style={{ width: `${downloadProgress.percent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs">
          <span>{Math.round(downloadProgress.percent)}%</span>
          <span>
            {(downloadProgress.bytesPerSecond / 1024 / 1024).toFixed(2)} MB/s
          </span>
        </div>
      </div>
    );
  }

  if (updateAvailable) {
    return (
      <div className="fixed bottom-4 right-4 bg-purple-500 text-white p-4 rounded-lg shadow-lg max-w-md">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Update Available!</h3>
          <button 
            onClick={() => setUpdateAvailable(null)}
            className="text-white hover:text-gray-200"
          >
            ✕
          </button>
        </div>
        <p className="text-sm mb-3">
          Version {updateInfo?.version} is available. Would you like to download it now?
        </p>
        {updateInfo?.releaseNotes && (
          <div className="text-xs mb-3 bg-white/10 p-2 rounded max-h-24 overflow-y-auto">
            {updateInfo.releaseNotes}
          </div>
        )}
        <div className="flex gap-2">
          <button 
            onClick={() => window.electron.ipcRenderer.send('download-update')}
            className="flex-1 bg-white text-purple-600 py-2 rounded font-medium hover:bg-gray-100"
          >
            Download Update
          </button>
          <button 
            onClick={() => setUpdateAvailable(null)}
            className="flex-1 bg-purple-600 border border-white py-2 rounded font-medium hover:bg-purple-700"
          >
            Later
          </button>
        </div>
      </div>
    );
  }

  return null;
};
```

#### Step 3.3: Setup IPC Communication

Update your preload script:

```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel: string, ...args: any[]) => {
      const validChannels = ['download-update', 'install-update', 'check-for-updates'];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, ...args);
      }
    },
    on: (channel: string, callback: (...args: any[]) => void) => {
      const validChannels = [
        'update-available',
        'update-not-available',
        'download-progress',
        'update-downloaded',
        'update-error',
      ];
      if (validChannels.includes(channel)) {
        ipcRenderer.on(channel, (_, ...args) => callback(...args));
      }
    },
    removeAllListeners: (channel: string) => {
      ipcRenderer.removeAllListeners(channel);
    },
  },
});
```

Add IPC handlers to main process:

```typescript
// In your main process file
import { ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';

ipcMain.on('check-for-updates', () => {
  autoUpdater.checkForUpdates();
});

ipcMain.on('download-update', () => {
  autoUpdater.downloadUpdate();
});

ipcMain.on('install-update', () => {
  autoUpdater.quitAndInstall(false, true);
});
```

### Phase 4: Release Process

#### Step 4.1: Version Management

Create a version bump script `scripts/bump-version.js`:

```javascript
// scripts/bump-version.js
const fs = require('fs');
const path = require('path');

const packagePath = path.join(__dirname, '../package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

const [major, minor, patch] = pkg.version.split('.').map(Number);

// Determine version bump type from command line argument
const bumpType = process.argv[2] || 'patch';

let newVersion;
switch (bumpType) {
  case 'major':
    newVersion = `${major + 1}.0.0`;
    break;
  case 'minor':
    newVersion = `${major}.${minor + 1}.0`;
    break;
  case 'patch':
  default:
    newVersion = `${major}.${minor}.${patch + 1}`;
    break;
}

pkg.version = newVersion;
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');

console.log(`✅ Version bumped to ${newVersion}`);
```

Add script to package.json:

```json
{
  "scripts": {
    "version:patch": "node scripts/bump-version.js patch",
    "version:minor": "node scripts/bump-version.js minor",
    "version:major": "node scripts/bump-version.js major",
    "release": "yarn version:patch && yarn make && yarn publish"
  }
}
```

#### Step 4.2: GitHub Release Workflow

Create `.github/workflows/release.yml`:

```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ${{ matrix.os }}
    
    strategy:
      matrix:
        os: [windows-latest, macos-latest]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: yarn install
      
      - name: Build and package
        run: yarn make
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Publish to GitHub Releases
        run: yarn publish
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### Step 4.3: Release Checklist

Create `RELEASE.md`:

```markdown
# Release Checklist

## Pre-Release
- [ ] Update CHANGELOG.md with new features and bug fixes
- [ ] Test application thoroughly on all platforms
- [ ] Bump version number (`yarn version:patch|minor|major`)
- [ ] Commit version bump: `git commit -am "chore: bump version to x.x.x"`
- [ ] Create git tag: `git tag v1.x.x`
- [ ] Push commits and tags: `git push && git push --tags`

## Build & Publish
- [ ] Run `yarn make` to build for all platforms
- [ ] Run `yarn publish` to publish to GitHub Releases
- [ ] Verify artifacts are uploaded to GitHub Release
- [ ] Edit release notes on GitHub
- [ ] Publish the release (remove draft status)

## Post-Release
- [ ] Monitor update.electronjs.org for distribution
- [ ] Test auto-update on a client machine
- [ ] Announce release on social media/website
- [ ] Monitor error reports and logs

## Troubleshooting
If updates aren't working:
1. Check GitHub Release has proper artifacts (.exe, .nupkg, RELEASES)
2. Verify release is published (not draft)
3. Check app version in About dialog
4. Review electron-log output
5. Test with update.electronjs.org/update/:owner/:repo/:platform/:version
```

### Phase 5: Testing Strategy

#### Step 5.1: Local Testing Setup

Create `scripts/test-updates.js`:

```javascript
// scripts/test-updates.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Auto-Update Flow\n');

// Step 1: Build current version
console.log('1️⃣ Building current version...');
execSync('yarn make', { stdio: 'inherit' });

// Step 2: Install current version
console.log('\n2️⃣ Install the app from out/make folder');
console.log('   Then come back and press Enter to continue...');
process.stdin.once('data', () => {
  
  // Step 3: Bump version
  console.log('\n3️⃣ Bumping version...');
  execSync('node scripts/bump-version.js patch', { stdio: 'inherit' });
  
  // Step 4: Build new version
  console.log('\n4️⃣ Building new version...');
  execSync('yarn make', { stdio: 'inherit' });
  
  // Step 5: Create mock GitHub release
  console.log('\n5️⃣ Upload new version to GitHub Releases');
  console.log('   Or set up local testing server');
  console.log('\n✅ Testing setup complete!');
  console.log('   Open the installed app and check for updates.');
});
```

#### Step 5.2: Update Testing Scenarios

```markdown
# Test Scenarios

## Scenario 1: First Launch (No Update Available)
1. Install app v1.0.0
2. Launch app
3. Expected: No update notification
4. Check logs: Should show "Update not available"

## Scenario 2: Update Available
1. Install app v1.0.0
2. Publish v1.0.1 to GitHub
3. Wait 1-2 minutes for update.electronjs.org to sync
4. Launch app
5. Expected: "Update Available" notification appears
6. Click "Download Update"
7. Expected: Download progress bar appears
8. Wait for download to complete
9. Expected: "Update Ready" notification appears
10. Click "Restart & Install Now"
11. Expected: App restarts with v1.0.1

## Scenario 3: Background Update (App Already Running)
1. Have app v1.0.0 running
2. Publish v1.0.1 to GitHub
3. Wait for next update check (1 hour or trigger manually)
4. Expected: Update notification appears
5. Complete update process

## Scenario 4: Update Error Handling
1. Disconnect internet
2. Trigger update check
3. Expected: Error notification appears
4. Reconnect internet
5. Retry update
6. Expected: Update proceeds normally

```

### Phase 6: Monitoring and Analytics

#### Step 6.1: Update Analytics

Add analytics tracking to your auto-updater:

```typescript
// src/main/autoUpdater.ts
import analytics from './analytics'; // Your analytics service

autoUpdater.on('update-available', (info) => {
  analytics.track('Update Available', {
    currentVersion: app.getVersion(),
    newVersion: info.version,
    platform: process.platform,
  });
});

autoUpdater.on('update-downloaded', (info) => {
  analytics.track('Update Downloaded', {
    version: info.version,
    downloadTime: Date.now() - downloadStartTime,
  });
});

autoUpdater.on('error', (error) => {
  analytics.track('Update Error', {
    error: error.message,
    version: app.getVersion(),
    platform: process.platform,
  });
});
```

#### Step 6.2: Error Logging and Reporting

```typescript
// Enhanced error handling
autoUpdater.on('error', (error) => {
  log.error('Update error:', error);
  
  // Send to error tracking service (e.g., Sentry)
  if (typeof window !== 'undefined' && window.Sentry) {
    window.Sentry.captureException(error, {
      tags: {
        version: app.getVersion(),
        platform: process.platform,
        updatePhase: 'auto-update',
      },
    });
  }
  
  // Notify user with actionable message
  if (mainWindow) {
    mainWindow.webContents.send('update-error', {
      message: getUserFriendlyErrorMessage(error),
      canRetry: isRetryableError(error),
    });
  }
});

function getUserFriendlyErrorMessage(error: Error): string {
  const errorMessages: Record<string, string> = {
    'ENOTFOUND': 'Unable to connect to update server. Please check your internet connection.',
    'ETIMEDOUT': 'Update check timed out. Please try again later.',
    'ERR_UPDATER_INVALID_RELEASE_FEED': 'Update service temporarily unavailable.',
  };
  
  return errorMessages[error.message] || 'An error occurred while checking for updates.';
}

function isRetryableError(error: Error): boolean {
  const retryableErrors = ['ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED'];
  return retryableErrors.some(err => error.message.includes(err));
}
```

---

## Update Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     AUTO-UPDATE FLOW                             │
└─────────────────────────────────────────────────────────────────┘

    ┌──────────────┐
    │  App Starts  │
    └──────┬───────┘
           │
           ▼
    ┌──────────────────┐
    │  Is Packaged?    │◄─── Skip in development
    └──────┬───────────┘
           │ Yes
           ▼
    ┌──────────────────────────┐
    │ Initialize AutoUpdater   │
    │ - Set update interval    │
    │ - Configure logging      │
    └──────┬───────────────────┘
           │
           ▼
    ┌──────────────────────────┐
    │ Check for Updates        │
    │ (update.electronjs.org)  │
    └──────┬───────────────────┘
           │
           ▼
    ┌──────────────────────────┐
    │ Compare Versions         │
    └──────┬───────────────────┘
           │
           ├─────────────┬──────────────┐
           │             │              │
           ▼             ▼              ▼
    ┌────────────┐  ┌──────────┐  ┌─────────┐
    │ Up to Date │  │  Error   │  │ Update  │
    │            │  │          │  │Available│
    └────────────┘  └──────────┘  └────┬────┘
                                       │
                                       ▼
                            ┌───────────────────┐
                            │ Show Notification │
                            │ to User           │
                            └────────┬──────────┘
                                     │
                          ┌──────────┴──────────┐
                          │                     │
                          ▼                     ▼
                    ┌──────────┐          ┌─────────┐
                    │ Download │          │  Later  │
                    │   Now    │          │         │
                    └────┬─────┘          └─────────┘
                         │
                         ▼
                ┌──────────────────┐
                │ Download Update  │
                │ (in background)  │
                └────────┬─────────┘
                         │
                         ▼
                ┌──────────────────┐
                │ Show Progress    │
                │ 0% ... 100%      │
                └────────┬─────────┘
                         │
                         ▼
                ┌──────────────────┐
                │ Update Complete  │
                └────────┬─────────┘
                         │
                         ▼
                ┌──────────────────┐
                │ Notify User      │
                │ "Ready to        │
                │  Install"        │
                └────────┬─────────┘
                         │
                  ┌──────┴──────┐
                  │             │
                  ▼             ▼
            ┌──────────┐   ┌────────┐
            │ Restart  │   │ Later  │
            │   Now    │   │        │
            └────┬─────┘   └────────┘
                 │
                 ▼
        ┌─────────────────┐
        │ Quit and Install│
        │ (NSIS)          │
        └────────┬────────┘
                 │
                 ▼
        ┌─────────────────┐
        │ App Restarts    │
        │ with New Version│
        └─────────────────┘
```

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DOWNLODR APPLICATION                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     RENDERER PROCESS                          │  │
│  │  ┌────────────────────────────────────────────────────────┐  │  │
│  │  │  React Components                                       │  │  │
│  │  │  ┌──────────────────┐  ┌──────────────────┐           │  │  │
│  │  │  │ UpdateNotification│  │  Settings Page   │           │  │  │
│  │  │  └────────┬──────────┘  └────────┬─────────┘           │  │  │
│  │  │           │                      │                      │  │  │
│  │  │           └──────────┬───────────┘                      │  │  │
│  │  │                      │                                  │  │  │
│  │  │           ┌──────────▼──────────┐                      │  │  │
│  │  │           │   Zustand Store     │                      │  │  │
│  │  │           │  (Update State)     │                      │  │  │
│  │  │           └──────────┬──────────┘                      │  │  │
│  │  └──────────────────────┼──────────────────────────────── │  │  │
│  │                         │                                  │  │  │
│  │                         │ IPC Events                       │  │  │
│  │                         │                                  │  │  │
│  └─────────────────────────┼──────────────────────────────────┘  │
│                            │                                      │
│                            │ Context Bridge                       │
│                            │                                      │
│  ┌─────────────────────────▼──────────────────────────────────┐  │
│  │                     PRELOAD SCRIPT                          │  │
│  │  - exposeInMainWorld('electron', ...)                       │  │
│  │  - IPC message validation                                   │  │
│  └─────────────────────────┬──────────────────────────────────┘  │
│                            │                                      │
│                            │ IPC                                  │
│                            │                                      │
│  ┌─────────────────────────▼──────────────────────────────────┐  │
│  │                      MAIN PROCESS                           │  │
│  │  ┌────────────────────────────────────────────────────────┐│  │
│  │  │  index.ts (Main Entry Point)                           ││  │
│  │  │  - Create BrowserWindow                                ││  │
│  │  │  - Initialize app                                      ││  │
│  │  └────────────────────────┬───────────────────────────────┘│  │
│  │                           │                                 │  │
│  │  ┌────────────────────────▼───────────────────────────────┐│  │
│  │  │  autoUpdater.ts                                         ││  │
│  │  │  ┌──────────────────────────────────────────────────┐  ││  │
│  │  │  │  setupAutoUpdater()                              │  ││  │
│  │  │  │  - Initialize update-electron-app                │  ││  │
│  │  │  │  - Or electron-updater for advanced features     │  ││  │
│  │  │  └──────────────────────────────────────────────────┘  ││  │
│  │  │  ┌──────────────────────────────────────────────────┐  ││  │
│  │  │  │  Event Handlers                                  │  ││  │
│  │  │  │  - update-available                              │  ││  │
│  │  │  │  - download-progress                             │  ││  │
│  │  │  │  - update-downloaded                             │  ││  │
│  │  │  │  - error                                         │  ││  │
│  │  │  └──────────────────────────────────────────────────┘  ││  │
│  │  │  ┌──────────────────────────────────────────────────┐  ││  │
│  │  │  │  IPC Handlers                                    │  ││  │
│  │  │  │  - check-for-updates                             │  ││  │
│  │  │  │  - download-update                               │  ││  │
│  │  │  │  - install-update                                │  ││  │
│  │  │  └──────────────────────────────────────────────────┘  ││  │
│  │  └────────────────────────┬───────────────────────────────┘│  │
│  └───────────────────────────┼──────────────────────────────────┘  │
└────────────────────────────────┼───────────────────────────────────┘
                                 │
                                 │ HTTPS
                                 │
                ┌────────────────▼────────────────┐
                │  update.electronjs.org          │
                │  (Electron Update Service)      │
                └────────────────┬────────────────┘
                                 │
                                 │ Proxies to
                                 │
                ┌────────────────▼────────────────┐
                │  GitHub Releases API            │
                │  github.com/Talisik/Downlodr    │
                │  /releases                      │
                └────────────────┬────────────────┘
                                 │
                          ┌──────┴──────┐
                          │             │
                          ▼             ▼
                  ┌──────────────┐  ┌──────────────┐
                  │   RELEASES   │  │  Update      │
                  │   (Windows)  │  │  Artifacts   │
                  │              │  │  - .exe      │
                  │  - .nupkg    │  │  - .zip      │
                  │  - RELEASES  │  │  - .dmg      │
                  └──────────────┘  └──────────────┘
```

---

## Windows-Specific Configuration

Since Downlodr currently targets Windows, here are Windows-specific considerations:

### NSIS Setup

NSIS (Nullsoft Scriptable Install System) is the recommended installer for Windows Electron apps with auto-update support.

```typescript
// forge.config.ts
new MakerNSIS({
  oneClick: false, // Allow users to choose install directory
  perMachine: false, // Install per-user (recommended for auto-updates)
  allowToChangeInstallationDirectory: true,
  deleteAppDataOnUninstall: false, // Keep user data on uninstall
}),
```

### Windows Installer Configuration

```typescript
// forge.config.ts
new MakerNSIS({
  name: 'Downlodr',
  authors: 'Talisik',
  exe: 'Downlodr.exe',
  
  // Installation options
  oneClick: false,
  perMachine: false,
  allowToChangeInstallationDirectory: true,
  allowElevation: true,
  
  // Uninstall options
  deleteAppDataOnUninstall: false,
  
  // Certificate for code signing (production)
  certificateFile: process.env.WINDOWS_CERTIFICATE_FILE,
  certificatePassword: process.env.WINDOWS_CERTIFICATE_PASSWORD,
  
  // Installer appearance
  installerIcon: './assets/icon.ico',
  uninstallerIcon: './assets/icon.ico',
  installerHeader: './assets/installer-header.bmp',
  installerSidebar: './assets/installer-sidebar.bmp',
}),
```

### Important NSIS Notes

1. **Per-User Installation**: Set `perMachine: false` for better auto-update support
2. **App Data**: Keep `deleteAppDataOnUninstall: false` to preserve user settings
3. **Code Signing**: Highly recommended for production (prevents security warnings)
4. **No Admin Required**: Per-user installs don't require administrator rights

### Testing on Windows

```bash
# Build the installer
yarn make

# Output location
out/make/nsis/x64/Downlodr Setup 1.0.0.exe
```

The NSIS installer will:
- Install to `%LOCALAPPDATA%\Programs\Downlodr`
- Create Start Menu shortcuts
- Support silent updates via auto-updater
- Allow clean uninstallation

---

## Troubleshooting Guide

### Common Issues and Solutions

#### Issue 1: Updates Not Detected

**Symptoms:**
- App shows "Up to date" but newer version exists

**Solutions:**
1. Check GitHub release is published (not draft)
2. Verify release has correct assets (RELEASES, .nupkg for Windows)
3. Wait 1-2 minutes for update.electronjs.org to sync
4. Test URL: `https://update.electronjs.org/Talisik/Downlodr/win32/x64/1.0.0`
5. Check electron-log for error messages

#### Issue 2: Download Fails

**Symptoms:**
- Update detected but download fails
- Error: "Cannot download update"

**Solutions:**
1. Check internet connection
2. Verify GitHub Release assets are publicly accessible
3. Check antivirus/firewall isn't blocking download
4. Look for CORS or SSL issues in logs
5. Try manual download from GitHub to verify file integrity

#### Issue 3: Update Installs But Doesn't Apply

**Symptoms:**
- Update downloads and installs but app version doesn't change

**Solutions:**
1. Ensure app is fully closed before update (no background processes)
2. Wait 30 seconds after quit before reopening
3. Check if antivirus is blocking the update process
4. Verify write permissions in installation directory
5. Check logs for update installation errors

#### Issue 4: Code Signing Warnings (Windows)

**Symptoms:**
- Updates fail on macOS
- "App is damaged" error

**Solutions:**
1. Sign your app with Apple Developer certificate
2. Notarize the app
3. Update forge.config.ts with signing configuration
4. Use environment variables for credentials

### Debug Checklist

```typescript
// Add debug logging
import log from 'electron-log';

log.transports.file.level = 'debug';
log.transports.console.level = 'debug';

// Log everything
autoUpdater.logger = log;
autoUpdater.on('checking-for-update', () => {
  log.info('Checking for update...');
});
autoUpdater.on('update-available', (info) => {
  log.info('Update available:', JSON.stringify(info, null, 2));
});
autoUpdater.on('update-not-available', (info) => {
  log.info('Update not available:', JSON.stringify(info, null, 2));
});
autoUpdater.on('error', (err) => {
  log.error('Update error:', err);
});
autoUpdater.on('download-progress', (progressObj) => {
  log.info('Download progress:', JSON.stringify(progressObj, null, 2));
});
autoUpdater.on('update-downloaded', (info) => {
  log.info('Update downloaded:', JSON.stringify(info, null, 2));
});
```

### Testing Update URL Manually

Test if your update service is working:

```bash
# Windows
curl https://update.electronjs.org/Talisik/Downlodr/win32/x64/1.0.0

# macOS
curl https://update.electronjs.org/Talisik/Downlodr/darwin/x64/1.0.0

# Expected response:
# {
#   "name": "v1.0.1",
#   "notes": "Release notes...",
#   "pub_date": "2024-01-01T00:00:00Z",
#   "url": "https://github.com/Talisik/Downlodr/releases/download/v1.0.1/..."
# }
```

---

## Best Practices

### 1. Version Numbering
- Use semantic versioning (MAJOR.MINOR.PATCH)
- Increment PATCH for bug fixes
- Increment MINOR for new features
- Increment MAJOR for breaking changes

### 2. Release Notes
- Always include clear, user-friendly release notes
- Categorize changes: Features, Fixes, Breaking Changes
- Keep it concise but informative
- Example format:
```markdown
## What's New in v1.5.0

### ✨ New Features
- Added support for 4K video downloads
- New dark mode theme
- Batch download improvements

### 🐛 Bug Fixes
- Fixed crash when downloading large playlists
- Resolved memory leak in progress tracking
- Fixed UI freeze during downloads

### ⚠️ Breaking Changes
- Minimum Windows version is now Windows 10
```

### 3. Staged Rollouts
For large user bases, consider staged rollouts:

```typescript
// Advanced: Percentage-based rollout
autoUpdater.on('update-available', (info) => {
  const userId = getUserId(); // Get unique user ID
  const rolloutPercentage = 10; // Start with 10%
  
  const userHash = hashCode(userId);
  const userPercentile = Math.abs(userHash % 100);
  
  if (userPercentile < rolloutPercentage) {
    // This user gets the update
    autoUpdater.downloadUpdate();
  } else {
    log.info('Update available but not in rollout group yet');
  }
});
```

### 4. Update Timing
- Check for updates at app startup
- Check periodically (every 1-4 hours)
- Allow manual update checks in settings
- Don't interrupt active downloads/processing

### 5. User Experience
- Make updates optional, not forced
- Show clear progress during download
- Provide option to postpone
- Save user state before restart
- Resume ongoing tasks after update

### 6. Error Handling
- Provide user-friendly error messages
- Log detailed errors for debugging
- Implement retry logic
- Gracefully degrade if updates fail

### 7. Testing
- Test on clean installs
- Test upgrades from multiple previous versions
- Test with slow/unstable internet
- Test on different Windows versions
- Test with antivirus software active

---

## Security Considerations

### 1. Code Signing
```bash
# Windows: Sign your executable
signtool sign /f certificate.pfx /p password /tr http://timestamp.digicert.com /td sha256 /fd sha256 Downlodr.exe

# macOS: Sign and notarize
codesign --force --deep --sign "Developer ID Application" Downlodr.app
xcrun notarytool submit Downlodr.dmg --apple-id "$APPLE_ID" --password "$APPLE_PASSWORD"
```

### 2. HTTPS Only
- Always use HTTPS for update servers
- Verify SSL certificates
- Don't allow insecure connections

### 3. Integrity Checks
- electron-updater verifies checksums automatically
- GitHub releases provide SHA checksums
- Implement additional verification if needed

### 4. Secure Credentials
```bash
# Use environment variables, never commit secrets
export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
export WINDOWS_CERTIFICATE_PASSWORD=xxxxxxxxxxxx
export APPLE_ID=developer@example.com
export APPLE_PASSWORD=xxxxxxxxxxxx
```

---

## Monitoring Dashboard (Optional)

Create a simple dashboard to monitor updates:

```typescript
// Track update metrics
interface UpdateMetrics {
  version: string;
  platform: string;
  totalChecks: number;
  updateAvailable: number;
  downloadsStarted: number;
  downloadsCompleted: number;
  installsCompleted: number;
  errors: Array<{
    message: string;
    count: number;
    lastOccurred: Date;
  }>;
}

// Send metrics to your analytics service
function trackUpdateMetrics(event: string, data: any) {
  // Example: Send to your backend
  fetch('https://api.downlodr.com/analytics/updates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event,
      data,
      timestamp: new Date().toISOString(),
      appVersion: app.getVersion(),
      platform: process.platform,
    }),
  }).catch(err => log.error('Failed to send metrics:', err));
}
```

---

## Migration Guide (For Existing Users)

If Downlodr already has users without auto-update:

### Phase 1: Add Update Capability (v1.5.0)
1. Ship version with auto-updater built in
2. Notify users via website/social media
3. Provide manual download link

### Phase 2: First Auto-Update (v1.5.1)
1. Release minor update to test the system
2. Monitor adoption rate
3. Gather feedback

### Phase 3: Regular Updates
1. Establish regular release cadence
2. Implement staged rollouts
3. Monitor metrics and user feedback

---

## Success Metrics

Track these metrics to measure success:

1. **Update Adoption Rate**
   - % of users on latest version after 7/14/30 days
   - Target: >80% after 30 days

2. **Update Success Rate**
   - % of update attempts that succeed
   - Target: >95%

3. **Time to Update**
   - Average time from notification to installation
   - Target: <24 hours

4. **Error Rate**
   - % of updates that encounter errors
   - Target: <5%

5. **User Satisfaction**
   - Survey users about update experience
   - NPS score for update process
   - Target: NPS >50

---

## Conclusion

This implementation guide provides a complete solution for adding auto-update functionality to Downlodr. The recommended approach using **update.electronjs.org** offers:

✅ **Zero cost** for open-source projects
✅ **Simple setup** (~1 hour implementation)
✅ **Reliable service** maintained by Electron team
✅ **Seamless experience** for users
✅ **Professional update flow** like major software companies

### Next Steps

1. ✅ Review this document thoroughly
2. ✅ Install required dependencies
3. ✅ Implement auto-updater code
4. ✅ Create React UI components
5. ✅ Test locally with version bumps
6. ✅ Set up GitHub Actions workflow
7. ✅ Release first version with auto-update
8. ✅ Monitor and iterate

### Estimated Timeline

- **Setup & Implementation:** 4-6 hours
- **Testing:** 2-3 hours
- **Documentation:** 1 hour
- **First Release:** 1 hour
- **Total:** ~1-2 days of focused work

### Support Resources

- [Electron Forge Auto-Update Docs](https://www.electronforge.io/advanced/auto-update)
- [update-electron-app Package](https://github.com/electron/update-electron-app)
- [Electron Auto-Updater API](https://www.electronjs.org/docs/latest/api/auto-updater)
- [update.electronjs.org Service](https://github.com/electron/update.electronjs.org)

---

**Questions or Issues?**

Feel free to reach out or create an issue in the Downlodr repository. Good luck with the implementation! 🚀
