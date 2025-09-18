# Production Build FFmpeg Fix - Complete Solution

## Problem
The app was showing "Missing File" errors in production builds because FFmpeg wasn't properly configured for merging video and audio streams after download.

## Root Causes
1. **No FFmpeg in Production**: The production build didn't include or configure FFmpeg
2. **yt-dlp-helper Configuration**: The library wasn't being told where to find FFmpeg
3. **Path Issues**: FFmpeg path wasn't being passed to child processes

## Implemented Solutions

### 1. FFmpeg Setup Function (`src/main.ts`)
- Created `setupFFmpegBinary()` function that:
  - Checks for FFmpeg in multiple locations
  - Copies system FFmpeg to app directory if available
  - Sets `FFMPEG_PATH` environment variable
  - Falls back to system FFmpeg if no local copy exists

### 2. FFmpeg Downloader Utility (`src/Utils/ffmpegDownloader.ts`)
- Helper functions to:
  - Check for system FFmpeg in common locations
  - Copy system FFmpeg to app directory
  - Provide download URLs for FFmpeg (future implementation)

### 3. Enhanced yt-dlp Configuration (`src/Utils/ytdlpWrapper.ts`)
- Improved FFmpeg path detection:
  - Checks multiple possible locations
  - Sets both `ffmpegPath` and `ffmpegLocation` properties
  - Adds FFmpeg directory to PATH
  - Verifies FFmpeg exists before configuring

### 4. Command Builder (`src/Utils/ytdlpCommandBuilder.ts`)
- Ensures proper yt-dlp arguments:
  - Uses `--merge-output-format` flag
  - Adds `--prefer-ffmpeg` flag
  - Proper format selection for video+audio

### 5. Enhanced Logging (`src/Store/downloadStore.tsx`)
- Added detailed logging for:
  - Merge/remux detection
  - FFmpeg errors
  - Download phase tracking

## Testing Tools

### Test FFmpeg in Production
```bash
node test-ffmpeg-prod.js
```
This script checks:
- FFmpeg availability in multiple locations
- Executable permissions
- yt-dlp merge capability

### Fix Unmerged Downloads
```bash
node fix-unmerged-downloads.js [directory]
```
This script:
- Finds unmerged video/audio pairs
- Merges them using FFmpeg
- Cleans up temporary files

### Debug FFmpeg Merge
```bash
node debug-ffmpeg-merge.js video.f137.mp4 audio.f140.m4a output.mp4
```
Tests FFmpeg merging with specific files.

## How It Works Now

1. **App Startup**:
   - `setupFFmpegBinary()` runs first
   - Finds or copies FFmpeg to app directory
   - Sets environment variables

2. **Download Process**:
   - yt-dlp downloads video and audio separately
   - Uses configured FFmpeg path for merging
   - Cleans up temporary files after merge

3. **Fallback Chain**:
   - Local app FFmpeg → System FFmpeg → PATH FFmpeg

## Verification

After building the app, verify FFmpeg is working:

1. **Check Console Logs**:
   ```
   FFmpeg configured at: /path/to/ffmpeg
   FFmpeg exists: true
   ```

2. **Download a Video**:
   - Select high quality (separate video/audio)
   - Check for merge messages in console
   - Verify final file has both video and audio

3. **Run Test Script**:
   ```bash
   node test-ffmpeg-prod.js
   ```
   Should show FFmpeg available in at least one location.

## User Requirements

For the app to work properly in production:

1. **FFmpeg Must Be Installed**:
   - macOS: `brew install ffmpeg`
   - Windows: Download from ffmpeg.org
   - Linux: `apt install ffmpeg` or equivalent

2. **First Run**:
   - App will copy system FFmpeg to its directory
   - Subsequent runs use the local copy

## Future Improvements

1. **Bundle FFmpeg**: Include FFmpeg binary in app resources
2. **Auto-Download**: Download FFmpeg on first run if not available
3. **User Notification**: Show UI alert if FFmpeg is missing
4. **Progress Tracking**: Show merge progress in UI

## Troubleshooting

### "Missing File" Still Appears
1. Check FFmpeg is installed: `which ffmpeg`
2. Run test script: `node test-ffmpeg-prod.js`
3. Check app logs for FFmpeg configuration
4. Manually copy FFmpeg: `cp $(which ffmpeg) ~/Library/Application\ Support/Downlodr/`

### Downloads Have No Audio
1. FFmpeg merge failed
2. Check console for errors
3. Run `fix-unmerged-downloads.js` to recover

### App Can't Find FFmpeg
1. Install FFmpeg: `brew install ffmpeg`
2. Restart the app
3. Check logs for "FFmpeg configured at" message
