# yt-dlp Update to Version 2025.10.22

## 🎯 Objective
Update yt-dlp binaries to the latest version (2025.10.22) to restore download functionality and address YouTube's recent API changes.

## 📋 Context
- **Previous Version**: 2025.10.14
- **New Version**: 2025.10.22
- **Issue**: Downloads were failing due to outdated yt-dlp binary
- **Branch**: feature/macos-build-exp
- **Date**: October 23, 2025

## ✅ Changes Completed

### 1. Binary Updates
- ✅ Updated `yt-dlp_macos` from 2025.10.14 to 2025.10.22
- ✅ Updated `yt-dlp_linux` to 2025.10.22
- ✅ Updated `yt-dlp.exe` to 2025.10.22
- ✅ Maintained symlink `yt-dlp` → `yt-dlp_macos`

### 2. Download Sources
All binaries downloaded from official yt-dlp GitHub releases:
```bash
https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos
https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux
https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe
```

### 3. Binary Verification
```bash
# macOS binary
$ ./yt-dlp_macos --version
2025.10.22

# Tested format listing
$ ./yt-dlp_macos -F "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
✅ Successfully fetches available formats
⚠️  Note: YouTube signature extraction warning is present (known issue)
```

## 🔍 Technical Details

### Binary Configuration
The application uses platform-specific binaries:
- **macOS**: `yt-dlp_macos` (35.7 MB)
- **Linux**: `yt-dlp_linux` (37.6 MB)  
- **Windows**: `yt-dlp.exe` (18.3 MB)

### Binary Initialization Flow
1. `setupYTDLPBinary()` in `src/main.ts` (line 138-218)
   - Detects platform and selects appropriate binary
   - Copies binary to user data directory in production
   - Sets `YTDLP_PATH` environment variable
   - Makes binary executable on Unix systems

2. `initializeYTDLP()` in `src/Utils/ytdlpWrapper.ts` (line 15-185)
   - Handles lazy initialization
   - Prevents multiple initialization
   - Manages emergency binary copying if needed

3. Download Handler in `src/main.ts` (line 1487-1674)
   - Ensures YTDLP is initialized
   - Configures FFmpeg for video/audio merging
   - Uses format string with fallbacks
   - Handles download progress and errors

### Git Tracking
Binaries are tracked in git (added with `-f` flag) despite .gitignore patterns:
- Line 134-136 in .gitignore lists these binaries
- Previously added with `git add -f` to ensure version control
- Commit: `6bfb431` - "Update yt-dlp binaries to version 2025.10.22"

## ⚠️ Known Issues & Warnings

### YouTube Signature Extraction
**Warning Message:**
```
WARNING: [youtube] Signature extraction failed
player = https://www.youtube.com/s/player/27422632/player_ias.vflset/en_US/base.js
```

**Status**: This is a known upstream issue (yt-dlp/yt-dlp#12482)
- YouTube is forcing SABR streaming for certain clients
- Some formats may be missing URL
- Download still works with available formats
- Fix expected in future yt-dlp updates

### Platform Notes
- **macOS**: Binary runs natively on both Intel (x64) and Apple Silicon (arm64)
- **Linux**: Binary is ELF 64-bit format (won't run on macOS, as expected)
- **Windows**: Portable .exe binary

## 🧪 Testing Results

### ✅ Verified Working
1. Binary version check: `2025.10.22` ✓
2. Format listing (`-F`): Successfully retrieves available formats ✓
3. Binary execution: No permission or path errors ✓
4. Help command: Displays full usage information ✓

### 🔄 Requires App Testing
1. Full download workflow through app UI
2. Video metadata extraction in `setDownload()` function
3. Progress tracking and error handling
4. Format conversion with FFmpeg integration
5. Multi-format downloads (video+audio merging)

## 📚 Code References

### Key Files Modified
- `yt-dlp_macos` - macOS binary
- `yt-dlp_linux` - Linux binary
- `yt-dlp.exe` - Windows binary

### Related Code Files (No Changes Required)
- `src/main.ts` - Binary setup and download handlers
- `src/Utils/ytdlpWrapper.ts` - YTDLP initialization wrapper
- `src/Store/downloadStore.tsx` - Download state management
- `src/DataFunctions/ErrorCodeHelper.ts` - Error handling
- `.gitignore` - Binary tracking configuration

## 🚀 Next Steps

### Immediate Actions
1. ✅ Binaries updated to latest version
2. ✅ Changes committed to git
3. ⏳ Test download functionality in app
4. ⏳ Verify metadata extraction works
5. ⏳ Test error handling for various scenarios

### If Download Issues Persist
1. Check console logs for YTDLP_PATH configuration
2. Verify binary permissions (should be 0755 on Unix)
3. Test with simple video URL (e.g., YouTube short video)
4. Check if signature extraction warning causes actual failures
5. Consider implementing retry logic with different extractors

### Future Maintenance
1. Monitor yt-dlp releases for signature extraction fix
2. Consider automated binary update mechanism
3. Add binary version check in app settings
4. Implement telemetry for download success rates

## 🔗 Resources
- [yt-dlp Releases](https://github.com/yt-dlp/yt-dlp/releases)
- [yt-dlp Issue #12482](https://github.com/yt-dlp/yt-dlp/issues/12482) - SABR streaming issue
- [yt-dlp Documentation](https://github.com/yt-dlp/yt-dlp#readme)
- [App Documentation](docs/PLUGIN_DEVELOPMENT.MD)

## 📊 Summary

### What Was Fixed
- Outdated yt-dlp binaries preventing downloads
- Restored compatibility with current YouTube API
- Ensured cross-platform binary availability

### What Still Needs Testing
- Complete download workflow in app
- Error handling with new binary version
- Performance and success rate metrics
- Format conversion and merging

### Success Criteria
- ✅ Binaries updated to latest version (2025.10.22)
- ✅ Binary verification successful
- ✅ Format listing works
- ⏳ Full app downloads work end-to-end
- ⏳ Error messages are clear and actionable
- ⏳ Download success rate restored

---

**Status**: Binary update complete, app testing required
**Commit**: 6bfb431 - "Update yt-dlp binaries to version 2025.10.22"
**Branch**: feature/macos-build-exp

