# FFmpeg Merge Issue - Investigation and Solutions

## Problem Description
When downloading high-quality videos, yt-dlp often downloads video and audio streams separately (e.g., best video format and best audio format) and needs to merge them using FFmpeg. Users reported that downloads were completing but the final merged file was missing or corrupted.

## Root Cause Analysis
1. **Separate Stream Downloads**: When downloading high-quality content, yt-dlp downloads:
   - Video stream (e.g., `video.f137.mp4` - video only, no audio)
   - Audio stream (e.g., `video.f140.m4a` - audio only)

2. **Missing FFmpeg Configuration**: The yt-dlp-helper library wasn't properly configured with the FFmpeg binary path, causing the merge step to fail silently.

3. **Incomplete Process Handling**: The download process wasn't properly waiting for or detecting FFmpeg merge completion.

## Implemented Solutions

### 1. Enhanced FFmpeg Configuration
**File**: `src/Utils/ytdlpWrapper.ts`
- Added explicit FFmpeg path configuration for yt-dlp
- Properly sets `YTDLP.Config.ffmpegPath` based on platform and package state

### 2. Improved Merge Detection Logging
**File**: `src/Store/downloadStore.tsx`
- Added enhanced logging for merge/remux detection
- Added FFmpeg error detection in download logs
- Better tracking of download phases (video → audio → merge)

### 3. Manual Merge Handler
**File**: `src/main.ts`
- Added IPC handler `merge-video-audio` for manual merging
- Provides fallback mechanism if automatic merge fails

### 4. Merge Helper Utilities
**File**: `src/Utils/ytdlpMergeHelper.ts`
- Comprehensive utilities for managing video/audio merging
- Functions to find and merge orphaned file pairs
- Proper FFmpeg path detection across platforms

### 5. Recovery Scripts
**Files**: 
- `debug-ffmpeg-merge.js` - Test FFmpeg merging manually
- `fix-unmerged-downloads.js` - Find and merge all unmerged downloads

## How to Use Recovery Scripts

### Debug FFmpeg Merge
Test if FFmpeg can merge specific files:
```bash
node debug-ffmpeg-merge.js video.f137.mp4 video.f140.m4a output.mp4
```

### Fix All Unmerged Downloads
Automatically find and merge all unmerged file pairs in a directory:
```bash
# Scan default Downloads folder
node fix-unmerged-downloads.js

# Scan specific folder
node fix-unmerged-downloads.js /path/to/downloads
```

## Prevention Measures

1. **Ensure FFmpeg is Installed**:
   - macOS: `brew install ffmpeg`
   - Windows: Download from https://ffmpeg.org/download.html
   - Linux: `sudo apt install ffmpeg` or equivalent

2. **Check FFmpeg Path**:
   The app now logs the FFmpeg path on startup. Check console logs for:
   ```
   FFmpeg configured at: /path/to/ffmpeg
   ```

3. **Monitor Download Logs**:
   Look for these indicators in the console:
   - `🔄 Merge/Remux detected` - Merge process started
   - `📦 Video remuxing` - Remuxing in progress
   - `⚠️ FFmpeg error detected` - Merge failed

## Testing the Fix

1. **Download a High-Quality Video**:
   - Choose a video with separate video/audio streams
   - Select high quality formats (e.g., 1080p or higher)

2. **Monitor Console Output**:
   - Open Developer Tools (View → Toggle Developer Tools)
   - Watch for merge-related messages

3. **Verify Output**:
   - Check that final file has both video and audio
   - Temporary `.f<id>` files should be cleaned up

## Troubleshooting

### Issue: "FFmpeg not found"
**Solution**: Install FFmpeg and restart the app

### Issue: Temporary files remain after download
**Solution**: Run `fix-unmerged-downloads.js` to merge and clean up

### Issue: Merged file has no audio/video
**Solution**: 
1. Check format compatibility
2. Try manual merge with debug script
3. Report issue with format IDs

## Technical Details

### Download Phases
1. **Video Phase** (0-50% progress): Download video stream
2. **Audio Phase** (51-100% progress): Download audio stream  
3. **Merge Phase** (status: 'initializing'): FFmpeg merges streams
4. **Completion**: Final file ready, temporary files removed

### File Naming Convention
- Video: `<name>.f<format_id>.<video_ext>`
- Audio: `<name>.f<format_id>.<audio_ext>`
- Final: `<name>.<output_ext>`

## Future Improvements
1. Add retry mechanism for failed merges
2. Implement progress tracking for merge phase
3. Add UI indicator for merge status
4. Support for alternative merge tools (e.g., mkvmerge)
