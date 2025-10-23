# Auto-Update System for Binaries

## 🎯 Overview

Downlodr already has a sophisticated auto-update system for **yt-dlp**, but not for **FFmpeg**. This document explains the existing system and proposes enhancements.

## ✅ Current Implementation: yt-dlp Auto-Update

### 📍 Location
`src/main.ts` lines 1942-2020

### 🔄 How It Works

#### 1. **Startup Check** (7 seconds after launch)
```typescript
setTimeout(async () => {
  // 1. Initialize YTDLP wrapper
  // 2. Setup binary paths
  // 3. Get current version
  // 4. Check latest version from GitHub API (with rate limiting)
  // 5. Auto-download if newer version available
  // 6. Notify user via IPC
}, 7000);
```

#### 2. **Rate Limiting Strategy**
```typescript
// Prevent GitHub API abuse
const GITHUB_API_COOLDOWN = 1000 * 60 * 60; // 1 hour
const CACHE_DURATION = 1000 * 60 * 60 * 4; // 4 hours

function canMakeGitHubApiCall(): boolean {
  return Date.now() - lastGitHubApiCall > GITHUB_API_COOLDOWN;
}

function getCachedVersion(): string | null {
  if (cachedLatestVersion && 
      Date.now() - cachedLatestVersion.timestamp < CACHE_DURATION) {
    return cachedLatestVersion.version;
  }
  return null;
}
```

#### 3. **Version Comparison**
- Gets current version: `await YTDLP.getYTDLPVersion()`
- Gets latest version: `await YTDLP.getLatestYTDLPVersionFromGitHub()`
- Compares: If different → auto-update

#### 4. **Update Process**
```typescript
await YTDLP.downloadYTDLP({
  version: latestVersion,
  forceDownload: true
});
```

#### 5. **User Notification**
- IPC event: `ytdlp-auto-updated`
- IPC event: `ytdlp-auto-installed`
- Includes version information

### ⏰ Update Schedule
- **On Startup**: 7 seconds after app launch
- **Periodic**: Commented out (could enable every 12 hours)

### ⚠️ Current Limitations
1. **No user control** - Always auto-updates (can't disable)
2. **No manual trigger** - Can't force update check
3. **No update history** - Doesn't track update history
4. **No rollback** - Can't revert to previous version
5. **No FFmpeg support** - Only yt-dlp is auto-updated

---

## 🚀 Proposed Enhancements

### 1. **Unified Binary Update Service**

Create a new service: `src/Services/BinaryUpdateService.ts`

```typescript
/**
 * Unified service for managing yt-dlp and FFmpeg updates
 */
interface BinaryInfo {
  name: 'yt-dlp' | 'ffmpeg';
  currentVersion: string | null;
  latestVersion: string | null;
  lastChecked: number;
  updateAvailable: boolean;
  downloadProgress?: number;
  status: 'checking' | 'available' | 'downloading' | 'installing' | 'up-to-date' | 'error';
  error?: string;
}

interface UpdateSettings {
  autoUpdate: boolean;
  checkInterval: number; // milliseconds
  notifyOnUpdate: boolean;
  downloadInBackground: boolean;
  betaVersions: boolean;
}

class BinaryUpdateService {
  private ytdlpInfo: BinaryInfo;
  private ffmpegInfo: BinaryInfo;
  private settings: UpdateSettings;
  
  // Check for updates
  async checkForUpdates(binary: 'yt-dlp' | 'ffmpeg' | 'all'): Promise<void>;
  
  // Download and install update
  async updateBinary(binary: 'yt-dlp' | 'ffmpeg'): Promise<void>;
  
  // Get current status
  getUpdateStatus(): { ytdlp: BinaryInfo; ffmpeg: BinaryInfo };
  
  // User settings
  setUpdateSettings(settings: Partial<UpdateSettings>): void;
  getUpdateSettings(): UpdateSettings;
  
  // Manual version management
  async installSpecificVersion(binary: 'yt-dlp' | 'ffmpeg', version: string): Promise<void>;
  async rollback(binary: 'yt-dlp' | 'ffmpeg'): Promise<void>;
  
  // History
  getUpdateHistory(): UpdateHistoryEntry[];
}
```

### 2. **FFmpeg Update Implementation**

#### Challenge: FFmpeg Doesn't Have Built-in Update
Unlike yt-dlp, FFmpeg doesn't have a self-update mechanism. We need to:

1. **Check GitHub Releases**
   ```typescript
   // Check https://github.com/FFmpeg/FFmpeg/releases
   // Or use static builds: https://github.com/BtbN/FFmpeg-Builds/releases
   ```

2. **Download Platform-Specific Binaries**
   ```typescript
   const ffmpegUrls = {
     darwin: {
       arm64: 'https://evermeet.cx/ffmpeg/ffmpeg-<version>-arm64.zip',
       x64: 'https://evermeet.cx/ffmpeg/ffmpeg-<version>-x64.zip'
     },
     linux: 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz',
     win32: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip'
   };
   ```

3. **Extract and Replace Binary**
   ```typescript
   async function updateFFmpeg(version: string): Promise<void> {
     const tempPath = path.join(app.getPath('temp'), 'ffmpeg-update');
     const url = getFFmpegDownloadUrl(process.platform, process.arch, version);
     
     // Download
     await downloadBinary(url, tempPath);
     
     // Extract
     await extractArchive(tempPath);
     
     // Verify
     const valid = await verifyBinary(tempPath);
     if (!valid) throw new Error('Binary verification failed');
     
     // Replace
     await replaceBinary(tempPath, getBinaryPath('ffmpeg'));
     
     // Cleanup
     await fs.promises.rm(tempPath, { recursive: true });
   }
   ```

#### FFmpeg Version Detection
```typescript
async function getFFmpegVersion(): Promise<string> {
  const { stdout } = await execPromise('ffmpeg -version');
  const match = stdout.match(/ffmpeg version (\S+)/);
  return match ? match[1] : null;
}
```

### 3. **User Settings Integration**

Add to `src/schema/settings.ts`:

```typescript
interface DownloadSettings {
  // ... existing settings
  
  // Binary Update Settings
  binaryUpdates: {
    autoUpdateYtdlp: boolean;
    autoUpdateFFmpeg: boolean;
    checkInterval: number; // hours
    notifyBeforeUpdate: boolean;
    downloadBetaVersions: boolean;
    lastUpdateCheck: number;
  };
}
```

### 4. **UI Components**

#### Settings Modal Enhancement
```tsx
// In SettingsModal.tsx
<div className="space-y-4">
  <h3 className="text-lg font-semibold">Binary Updates</h3>
  
  <div className="space-y-2">
    <label className="flex items-center justify-between">
      <span>Auto-update yt-dlp</span>
      <Switch 
        checked={settings.binaryUpdates.autoUpdateYtdlp}
        onCheckedChange={(checked) => updateSettings({
          binaryUpdates: { ...settings.binaryUpdates, autoUpdateYtdlp: checked }
        })}
      />
    </label>
    
    <label className="flex items-center justify-between">
      <span>Auto-update FFmpeg</span>
      <Switch 
        checked={settings.binaryUpdates.autoUpdateFFmpeg}
        onCheckedChange={(checked) => updateSettings({
          binaryUpdates: { ...settings.binaryUpdates, autoUpdateFFmpeg: checked }
        })}
      />
    </label>
    
    <div className="flex items-center justify-between">
      <span>Check interval</span>
      <Select value={settings.binaryUpdates.checkInterval.toString()}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="4">4 hours</SelectItem>
          <SelectItem value="12">12 hours</SelectItem>
          <SelectItem value="24">24 hours</SelectItem>
          <SelectItem value="168">Weekly</SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>
  
  <Separator />
  
  <div className="space-y-2">
    <h4 className="font-medium">Current Versions</h4>
    <div className="text-sm space-y-1">
      <div className="flex justify-between">
        <span>yt-dlp:</span>
        <span className="font-mono">{ytdlpVersion}</span>
      </div>
      <div className="flex justify-between">
        <span>FFmpeg:</span>
        <span className="font-mono">{ffmpegVersion}</span>
      </div>
    </div>
    
    <Button 
      variant="outline" 
      className="w-full"
      onClick={handleCheckForUpdates}
    >
      <RefreshCw className="w-4 h-4 mr-2" />
      Check for Updates
    </Button>
  </div>
</div>
```

#### Update Notification Component
```tsx
// New component: UpdateNotificationToast.tsx
export const UpdateNotificationToast: React.FC<{
  binary: 'yt-dlp' | 'ffmpeg';
  fromVersion: string;
  toVersion: string;
  onUpdate: () => void;
  onDismiss: () => void;
}> = ({ binary, fromVersion, toVersion, onUpdate, onDismiss }) => {
  return (
    <Toast>
      <ToastTitle>Update Available</ToastTitle>
      <ToastDescription>
        {binary} {toVersion} is available (currently: {fromVersion})
      </ToastDescription>
      <ToastAction onClick={onUpdate}>Update Now</ToastAction>
      <ToastClose onClick={onDismiss} />
    </Toast>
  );
};
```

### 5. **IPC Handlers**

Add to `src/main.ts`:

```typescript
// Check for binary updates
ipcMain.handle('binary:check-updates', async (_event, binary: 'yt-dlp' | 'ffmpeg' | 'all') => {
  try {
    const service = BinaryUpdateService.getInstance();
    await service.checkForUpdates(binary);
    return { success: true, status: service.getUpdateStatus() };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Update binary
ipcMain.handle('binary:update', async (_event, binary: 'yt-dlp' | 'ffmpeg') => {
  try {
    const service = BinaryUpdateService.getInstance();
    await service.updateBinary(binary);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get update status
ipcMain.handle('binary:get-status', async () => {
  const service = BinaryUpdateService.getInstance();
  return service.getUpdateStatus();
});

// Update settings
ipcMain.handle('binary:set-settings', async (_event, settings: Partial<UpdateSettings>) => {
  const service = BinaryUpdateService.getInstance();
  service.setUpdateSettings(settings);
  return { success: true };
});

// Get update history
ipcMain.handle('binary:get-history', async () => {
  const service = BinaryUpdateService.getInstance();
  return service.getUpdateHistory();
});

// Rollback to previous version
ipcMain.handle('binary:rollback', async (_event, binary: 'yt-dlp' | 'ffmpeg') => {
  try {
    const service = BinaryUpdateService.getInstance();
    await service.rollback(binary);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
```

### 6. **Testing Strategy (TDD)**

#### Unit Tests
```typescript
// tests/BinaryUpdateService.test.ts
describe('BinaryUpdateService', () => {
  describe('checkForUpdates', () => {
    it('should detect when yt-dlp update is available', async () => {
      // Arrange
      mockYTDLPVersion('2025.10.14');
      mockLatestYTDLPVersion('2025.10.22');
      
      // Act
      await service.checkForUpdates('yt-dlp');
      
      // Assert
      const status = service.getUpdateStatus();
      expect(status.ytdlp.updateAvailable).toBe(true);
      expect(status.ytdlp.latestVersion).toBe('2025.10.22');
    });
    
    it('should respect rate limiting', async () => {
      // Arrange
      await service.checkForUpdates('yt-dlp');
      
      // Act
      await service.checkForUpdates('yt-dlp'); // Immediate second call
      
      // Assert
      expect(mockGitHubAPI).toHaveBeenCalledTimes(1); // Should use cache
    });
    
    it('should handle network errors gracefully', async () => {
      // Arrange
      mockGitHubAPIError(new Error('Network timeout'));
      
      // Act
      const result = await service.checkForUpdates('yt-dlp');
      
      // Assert
      expect(result.status).toBe('error');
      expect(result.error).toContain('Network timeout');
    });
  });
  
  describe('updateBinary', () => {
    it('should download and install yt-dlp update', async () => {
      // Test implementation
    });
    
    it('should verify binary integrity before installation', async () => {
      // Test implementation
    });
    
    it('should rollback on installation failure', async () => {
      // Test implementation
    });
  });
});
```

#### Integration Tests
```typescript
// tests/integration/binary-updates.test.ts
describe('Binary Update Integration', () => {
  it('should complete full update workflow', async () => {
    // 1. Check for updates
    // 2. Download binary
    // 3. Verify integrity
    // 4. Install binary
    // 5. Verify installation
    // 6. Notify user
  });
});
```

---

## 📊 Implementation Plan

### Phase 1: Enhance yt-dlp Updates ✅ (Already Working)
- [x] Auto-check on startup
- [x] Rate limiting
- [x] Version caching
- [x] IPC notifications
- [ ] User settings control
- [ ] Manual trigger UI
- [ ] Update history
- [ ] Rollback capability

### Phase 2: FFmpeg Auto-Update 🚧 (To Implement)
- [ ] Version detection
- [ ] GitHub release checking
- [ ] Platform-specific downloads
- [ ] Binary verification
- [ ] Safe installation
- [ ] Rollback support

### Phase 3: Unified Update Service 📅 (Future)
- [ ] Single service for both binaries
- [ ] Unified UI in settings
- [ ] Update history tracking
- [ ] Notification system
- [ ] Progress indicators
- [ ] Retry mechanisms

### Phase 4: Advanced Features 💡 (Optional)
- [ ] Beta version support
- [ ] Custom update channels
- [ ] Scheduled updates
- [ ] Bandwidth throttling
- [ ] Update verification (checksums)
- [ ] Telemetry for update success

---

## 🔒 Security Considerations

### 1. **Binary Verification**
```typescript
// Verify downloaded binaries
async function verifyBinary(binaryPath: string, expectedHash?: string): Promise<boolean> {
  if (expectedHash) {
    const actualHash = await calculateSHA256(binaryPath);
    return actualHash === expectedHash;
  }
  
  // Fallback: Basic checks
  const stats = await fs.promises.stat(binaryPath);
  return stats.size > 1000000 && stats.isFile(); // At least 1MB
}
```

### 2. **HTTPS Only**
- Only download from official sources via HTTPS
- Verify SSL certificates

### 3. **Atomic Updates**
```typescript
// Download to temp, verify, then replace
async function atomicUpdate(binary: string): Promise<void> {
  const tempPath = await downloadToTemp(binary);
  await verifyBinary(tempPath);
  await backupCurrent(binary); // Keep backup
  await replaceAtomic(tempPath, getBinaryPath(binary));
}
```

### 4. **Rollback Protection**
- Always keep previous version as backup
- Test new binary before deleting old one
- Automatic rollback if new binary fails

---

## 💾 Storage Schema

```typescript
// Update history storage
interface UpdateHistoryEntry {
  binary: 'yt-dlp' | 'ffmpeg';
  fromVersion: string;
  toVersion: string;
  timestamp: number;
  success: boolean;
  duration: number; // ms
  error?: string;
}

// Store in: app.getPath('userData')/update-history.json
```

---

## 📈 Monitoring & Telemetry

```typescript
interface UpdateMetrics {
  updateChecks: number;
  updatesAvailable: number;
  updatesInstalled: number;
  updateFailures: number;
  averageDownloadTime: number;
  lastCheckTime: number;
}

// Track and send to telemetry service (if user opted in)
```

---

## 🎯 Summary

### ✅ What's Already Working
1. **yt-dlp auto-update** - Fully functional on startup
2. **Rate limiting** - Prevents API abuse
3. **IPC notifications** - Informs UI of updates
4. **Version caching** - Reduces API calls

### 🚀 What Can Be Added
1. **User control** - Settings to enable/disable auto-updates
2. **FFmpeg updates** - Currently not auto-updated
3. **Manual triggers** - UI button to check for updates
4. **Update history** - Track update history
5. **Rollback** - Revert to previous version if needed
6. **Progress UI** - Show download/install progress

### 💡 Recommendation
Start with Phase 2 (FFmpeg auto-update) since yt-dlp already works well. Then add user controls (Phase 1 enhancements) and finally unify everything (Phase 3).

---

**Next Steps**: Would you like me to implement:
1. FFmpeg auto-update system?
2. User settings/controls for existing yt-dlp updates?
3. Both?

