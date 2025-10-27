# yt-dlp Auto-Update Implementation Analysis - macOS Build

## 🎯 Executive Summary

**Status**: ⚠️ **POTENTIALLY UNRELIABLE IN PRODUCTION**  
**Current Implementation**: Using `yt-dlp-helper` library  
**Major Issues**: File permissions, sandboxing, and overwri ting bundled binaries

---

## 🔍 How It Currently Works

### 1. **Binary Initialization** (`setupYTDLPBinary()`)

**Location**: `src/main.ts` lines 138-218

```typescript
function setupYTDLPBinary() {
  const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp_macos';
  
  // In production: app.getPath('userData')
  // Example: ~/Library/Application Support/Downlodr/
  const targetDir = app.isPackaged 
    ? app.getPath('userData')  
    : process.cwd();
    
  const expectedPath = path.join(targetDir, binaryName);
  
  if (app.isPackaged) {
    // Copy from Resources to user data directory
    const sourcePath = path.join(process.resourcesPath, binaryName);
    
    // Copy and set permissions
    fs.copyFileSync(sourcePath, expectedPath);
    fs.chmodSync(expectedPath, 0o755);
    
    process.env.YTDLP_PATH = expectedPath;
  }
}
```

**What This Does**:
1. ✅ Finds bundled binary in Resources (read-only)
2. ✅ Copies to user data directory (writable)
3. ✅ Sets executable permissions
4. ✅ Points app to writable copy

**Result**: `/Users/username/Library/Application Support/Downlodr/yt-dlp_macos`

### 2. **Auto-Update Mechanism**

**Location**: `src/main.ts` lines 2014-2092

```typescript
setTimeout(async () => {
  // 1. Get current version
  const currentVersion = await YTDLP.getYTDLPVersion();
  
  // 2. Check latest version from GitHub (with rate limiting)
  const latestVersion = await YTDLP.getLatestYTDLPVersionFromGitHub();
  
  // 3. Compare versions
  if (currentVersion !== latestVersion) {
    // 4. Download new version
    await YTDLP.downloadYTDLP({
      version: latestVersion,
      forceDownload: true
    });
    
    // 5. Notify user
    win.webContents.send('ytdlp-auto-updated', {...});
  }
}, 7000); // 7 seconds after startup
```

**Key Details**:
- ⏰ Runs 7 seconds after app launch
- 🔒 Rate limiting: 1-hour cooldown, 4-hour cache
- 📦 Uses `yt-dlp-helper` library's `downloadYTDLP()` method
- 🔔 Notifies UI via IPC

---

## ⚠️ Critical Issues in macOS Production

### Issue #1: **Where Does `downloadYTDLP()` Save the Binary?**

**The Problem**:
```typescript
await YTDLP.downloadYTDLP({
  version: latestVersion,
  forceDownload: true
});
```

**Questions**:
1. ❓ Does it save to `process.env.YTDLP_PATH`?
2. ❓ Does it save to user data directory?
3. ❓ Does it respect our `setupYTDLPBinary()` configuration?
4. ❓ Does it try to overwrite the Resources binary (read-only)?

**Potential Failure**:
```
YTDLP.downloadYTDLP() downloads to default location
→ Doesn't respect our YTDLP_PATH
→ Saves to wrong directory
→ App still uses old binary from user data
→ Update appears to succeed but doesn't actually update
```

### Issue #2: **macOS Sandbox Restrictions**

**macOS App Sandboxing** (if enabled):
- ❌ Can't write to `/Applications/`
- ❌ Can't write to `process.resourcesPath`
- ✅ Can write to `app.getPath('userData')`
- ✅ Can write to `app.getPath('temp')`

**Our Entitlements** (`entitlements.plist`):
```xml
<key>com.apple.security.app-sandbox</key>
<false/>
```

**Status**: ✅ Sandbox is DISABLED - We have full file system access

**However**: Future macOS versions may enforce sandboxing more strictly.

### Issue #3: **Binary Replacement During Execution**

**The Problem**:
```
App is running → Using yt-dlp_macos from user data
Auto-update downloads new version
Tries to replace the CURRENTLY EXECUTING binary
```

**Potential Issues**:
- ⚠️ File in use (can't replace while running)
- ⚠️ Incomplete write if download fails
- ⚠️ Corrupted binary if process interrupted
- ⚠️ No rollback if new version is broken

### Issue #4: **Gatekeeper and Code Signing**

**macOS Gatekeeper** checks:
1. ❓ Is the new binary signed?
2. ❓ Does signature match the app's?
3. ❓ Will macOS allow execution?

**Likely Issue**:
```
Downloaded yt-dlp_macos is NOT signed by your Apple Developer ID
→ macOS Gatekeeper blocks execution
→ User sees "Cannot verify developer" error
→ Binary update fails silently
```

### Issue #5: **No Verification After Update**

**Current Flow**:
```
downloadYTDLP() completes
→ Assume success
→ Notify user "Updated!"
→ No verification that new binary actually works
```

**Should Have**:
```
downloadYTDLP() completes
→ Test new binary: ./yt-dlp_macos --version
→ Verify output matches expected version
→ If fails → rollback to previous binary
→ Then notify user
```

---

## 🧪 Testing the Current Implementation

### Test 1: **Where Does Update Save?**

```bash
# Start the app
yarn start

# Wait for auto-update (7 seconds)

# Check logs for:
# "Auto-updating YT-DLP from X to Y..."
# "YT-DLP auto-update completed!"

# Verify binary location:
ls -lh ~/Library/Application\ Support/Downlodr/yt-dlp_macos

# Check if it's the new version:
~/Library/Application\ Support/Downlodr/yt-dlp_macos --version
```

### Test 2: **Does It Actually Update?**

```bash
# Downgrade binary manually
cp yt-dlp_macos_old ~/Library/Application\ Support/Downlodr/yt-dlp_macos

# Start app and wait for auto-update

# Check if version changed:
~/Library/Application\ Support/Downlodr/yt-dlp_macos --version

# Should be latest version if update worked
```

### Test 3: **Gatekeeper Check**

```bash
# After auto-update, check if binary is signed:
codesign -dv ~/Library/Application\ Support/Downlodr/yt-dlp_macos

# Should see error if unsigned:
# "code object is not signed at all"
```

### Test 4: **Sandboxed App Check**

```bash
# Build production app with sandboxing
# Modify entitlements.plist:
# <key>com.apple.security.app-sandbox</key>
# <true/>

# Run app and check if auto-update works
# It will likely fail due to file access restrictions
```

---

## 📊 Reliability Assessment

### ✅ What Works Well:

1. **Initial Setup** - Binary copying to user data works
2. **Version Checking** - GitHub API integration works
3. **Rate Limiting** - Prevents API abuse
4. **User Notification** - IPC events work

### ⚠️ What's Uncertain:

1. **Update Download Location** - Not clear where `yt-dlp-helper` saves
2. **Binary Replacement** - May fail if binary is in use
3. **Gatekeeper Compatibility** - Downloaded binary may not be executable
4. **Error Recovery** - No rollback mechanism

### ❌ What's Missing:

1. **Update Verification** - No post-update testing
2. **Rollback Capability** - Can't revert if update breaks
3. **User Control** - Can't disable auto-update
4. **Detailed Logging** - Hard to debug failures

---

## 🛠️ Recommended Improvements

### Priority 1: **Fix Update Download Path** (Critical)

```typescript
// Ensure yt-dlp-helper respects our path
async function updateYTDLP(version: string): Promise<void> {
  const targetPath = process.env.YTDLP_PATH || 
    path.join(app.getPath('userData'), 'yt-dlp_macos');
  
  // Backup current binary
  const backupPath = `${targetPath}.backup`;
  fs.copyFileSync(targetPath, backupPath);
  
  try {
    // Download to temp location first
    const tempPath = path.join(app.getPath('temp'), 'yt-dlp_update');
    
    await YTDLP.downloadYTDLP({
      version,
      forceDownload: true,
      filePath: tempPath // Specify download location
    });
    
    // Verify downloaded binary works
    const { stdout } = await execPromise(`${tempPath} --version`);
    if (!stdout.includes(version)) {
      throw new Error('Version verification failed');
    }
    
    // Replace binary atomically
    fs.renameSync(tempPath, targetPath);
    fs.chmodSync(targetPath, 0o755);
    
    // Remove backup
    fs.unlinkSync(backupPath);
    
    console.log(`Successfully updated to ${version}`);
  } catch (error) {
    console.error('Update failed, rolling back:', error);
    
    // Rollback to backup
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, targetPath);
    }
    
    throw error;
  }
}
```

### Priority 2: **Add Update Verification**

```typescript
async function verifyBinaryUpdate(binaryPath: string, expectedVersion: string): Promise<boolean> {
  try {
    // Test version
    const { stdout } = await execPromise(`${binaryPath} --version`);
    if (!stdout.trim().startsWith(expectedVersion)) {
      return false;
    }
    
    // Test basic functionality
    const { stdout: testOutput } = await execPromise(
      `${binaryPath} --help`
    );
    if (!testOutput.includes('Usage:')) {
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Binary verification failed:', error);
    return false;
  }
}
```

### Priority 3: **Add User Settings**

```typescript
interface UpdateSettings {
  autoUpdateEnabled: boolean;
  checkInterval: number; // hours
  notifyBeforeUpdate: boolean;
  downloadBetaVersions: boolean;
}

// In settings modal
<Switch 
  checked={settings.autoUpdateEnabled}
  onCheckedChange={async (enabled) => {
    await window.electronAPI.setUpdateSettings({
      autoUpdateEnabled: enabled
    });
  }}
/>
```

### Priority 4: **Better Logging**

```typescript
interface UpdateLog {
  timestamp: Date;
  action: 'check' | 'download' | 'install' | 'verify' | 'rollback';
  fromVersion?: string;
  toVersion?: string;
  success: boolean;
  error?: string;
  duration: number;
}

// Save to: app.getPath('userData')/update-logs.json
```

---

## 🔧 Quick Fix for Immediate Reliability

### Option A: **Manual Binary Updates** (Most Reliable)

**Disable auto-update, update manually**:

```typescript
// Comment out auto-update in main.ts
// setTimeout(async () => { ... }, 7000);

// Update process:
// 1. Download new yt-dlp_macos
// 2. Test it works: ./yt-dlp_macos --version
// 3. Replace in repo: cp yt-dlp_macos ./yt-dlp_macos
// 4. Rebuild app: yarn make
// 5. Distribute new build
```

**Pros**:
- ✅ Most reliable - you control the process
- ✅ Test before distributing
- ✅ No Gatekeeper issues (binary included in signed app)
- ✅ No file permission issues

**Cons**:
- ❌ Requires rebuild for updates
- ❌ Users don't get instant updates
- ❌ More work for you

### Option B: **Fix Current Auto-Update** (More Complex)

**Implement proper update mechanism**:

```typescript
// Use manual download instead of yt-dlp-helper
async function downloadBinaryFromGitHub(version: string, targetPath: string): Promise<void> {
  const url = `https://github.com/yt-dlp/yt-dlp/releases/download/${version}/yt-dlp_macos`;
  
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(targetPath, Buffer.from(buffer));
  fs.chmodSync(targetPath, 0o755);
}
```

**Pros**:
- ✅ Users get instant updates
- ✅ Full control over process
- ✅ Can add verification

**Cons**:
- ❌ More code to maintain
- ❌ Need to handle failures
- ❌ Gatekeeper may still block

---

## 📋 Testing Checklist

Before trusting auto-update in production:

- [ ] Test in development: Does update download?
- [ ] Check download location: Is it in user data directory?
- [ ] Verify version: Does `--version` show new version?
- [ ] Test functionality: Can it download videos after update?
- [ ] Check permissions: Is binary executable after update?
- [ ] Test Gatekeeper: Does macOS allow execution?
- [ ] Test failure: What happens if download fails?
- [ ] Test rollback: Can it recover from bad update?
- [ ] Monitor logs: Any errors during update?
- [ ] Test user notification: Does UI show update success?

---

## 💡 Recommendation

### For Current Feature Branch:

**Disable Auto-Update for Now**:

```typescript
// In src/main.ts, comment out lines 2014-2092
/*
setTimeout(async () => {
  // Check for YT-DLP updates when app starts
  ...
}, 7000);
*/
```

**Why?**:
1. ⚠️ Unclear if `yt-dlp-helper` respects our file paths
2. ⚠️ No verification after update
3. ⚠️ No rollback if update fails
4. ⚠️ Gatekeeper may block downloaded binaries

### For Stable Build:

**Use Manual Binary Updates**:
1. You update binaries in repo
2. Test thoroughly
3. Rebuild and redistribute
4. Users get updates through app updates (not binary updates)

### For Future:

**Implement Proper Auto-Update**:
1. Direct GitHub download (no external library)
2. Download to temp, verify, then replace
3. Implement rollback mechanism
4. Add user settings to control updates
5. Sign downloaded binaries (advanced)

---

## 🎯 Conclusion

**Current Status**: The auto-update is **implemented but potentially unreliable** in production macOS builds because:

1. ❓ **Unknown behavior** - `yt-dlp-helper` download location unclear
2. ⚠️ **No verification** - Doesn't test if update actually works
3. ⚠️ **No rollback** - Can't recover from failed update
4. ⚠️ **Gatekeeper risk** - Downloaded binaries may be blocked
5. ⚠️ **File conflicts** - May fail if binary in use

**Recommendation**: 
- **Short term**: Disable auto-update, use manual binary updates
- **Long term**: Implement proper auto-update with verification and rollback

**Safety**: It won't break your app, but updates may fail silently, leaving users on old version.

---

**Need help implementing improvements?** Let me know which approach you'd like to take!

