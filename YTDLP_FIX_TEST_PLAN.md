# YT-DLP Binary Name Fix - Test Plan

## 🎯 Issue Fixed
**Problem**: Exit code -13 errors due to hardcoded `ytdlpBinaryName: 'yt-dlp_macos'` not matching the actual binary found by `getYtdlpBinaryPath()`.

**Solution**: Dynamic binary name detection that extracts the correct name from the found binary path.

## 🔧 Changes Made

### 1. Added Helper Function
```typescript
function getYtdlpBinaryName(fullPath: string): string {
  const binaryName = path.basename(fullPath);
  console.log(`🔧 Extracted binary name: ${binaryName} from path: ${fullPath}`);
  
  // Validate the binary name
  if (!binaryName || binaryName === '.' || binaryName === '..') {
    console.warn(`⚠️ Invalid binary name extracted: ${binaryName}, falling back to 'yt-dlp'`);
    return 'yt-dlp';
  }
  
  return binaryName;
}
```

### 2. Updated YTDLP.invoke() Calls
- **Main info handler**: Uses dynamic binary name
- **Alternative path fallback**: Uses dynamic binary name  
- **Download handler**: Uses dynamic binary name

### 3. Enhanced Configuration
```typescript
// Before (hardcoded):
ytdlpBinaryName: 'yt-dlp_macos'

// After (dynamic):
const binaryName = getYtdlpBinaryName(ytdlpPath);
...(binaryName !== 'yt-dlp' && { ytdlpBinaryName: binaryName })
```

## 🧪 Test Plan

### Pre-Test Verification
✅ **Binary Detection Test**: Confirmed both `yt-dlp` and `yt-dlp_macos` exist and are executable
✅ **Logic Test**: Verified binary name extraction works correctly
✅ **App Status**: Downlodr app is running with latest changes

### Manual Testing Required

#### 📹 Single Video Test
1. **Test URL**: `https://www.youtube.com/watch?v=T5NEsBVqY28`
2. **Steps**:
   - Open Downlodr app
   - Add the single video URL
   - Check console output for binary detection logs
   - Verify video info is fetched successfully
   - Attempt to download the video

#### 📚 Playlist Test  
1. **Test URL**: `https://www.youtube.com/playlist?list=PLrAXtmRdnEQy8FksXiE_1OUl2AvQYhvA0`
2. **Steps**:
   - Add the playlist URL
   - Check console for binary detection logs
   - Verify playlist info is fetched successfully
   - Test downloading individual items from the playlist

## 🔍 Expected Console Output

### ✅ Success Indicators
```
🔧 Extracted binary name: [yt-dlp|yt-dlp_macos] from path: [path]
🔧 YTDLP Configuration:
  ytdlpPath: [path]
  ytdlpDownloadDestination: [path]  
  ytdlpBinaryName: [detected_name]
  ffmpegPath: [path]
✅ YTDLP.invoke() completed: { ok: true }
```

### ❌ Errors to Watch For
```
❌ Process '[id]' exited with code: -13
❌ YTDLP result not ok: { ok: false }
❌ Error fetching video info: yt-dlp execution failed: Unknown error
```

## 🎯 Test Results Template

### Single Video Test
- [ ] Video URL accepted
- [ ] Binary name detected correctly: `____`
- [ ] Video info fetched: `Pass/Fail`
- [ ] No exit code -13 errors: `Pass/Fail`
- [ ] Download works: `Pass/Fail`

### Playlist Test  
- [ ] Playlist URL accepted
- [ ] Binary name detected correctly: `____`
- [ ] Playlist info fetched: `Pass/Fail`
- [ ] No exit code -13 errors: `Pass/Fail`
- [ ] Individual downloads work: `Pass/Fail`

## 🔧 Troubleshooting

### If Tests Fail
1. Check console for binary path detection logs
2. Verify which binary is being found by `getYtdlpBinaryPath()`
3. Confirm the extracted binary name matches the actual file
4. Check if binary has execute permissions

### Common Issues
- **Binary not found**: Check if yt-dlp binaries exist in project
- **Permission errors**: Ensure binaries have execute permissions (`chmod +x`)
- **Path issues**: Verify binary path resolution is working correctly

## 📊 Current System Info
- **Project Root**: `/Users/erickluna/Cloud_Repo/Downlodr`
- **Available Binaries**: 
  - ✅ `/Users/erickluna/Cloud_Repo/Downlodr/yt-dlp` (executable)
  - ✅ `/Users/erickluna/Cloud_Repo/Downlodr/yt-dlp_macos` (executable)
  - ✅ `/Users/erickluna/Cloud_Repo/Downlodr/scripts/yt-dlp` (executable)
- **Platform**: macOS (Apple Silicon/Intel compatible)
- **App Status**: Running and ready for testing

---

**Next Steps**: Please test both single video and playlist functionality manually in the running Downlodr app and report the results!
