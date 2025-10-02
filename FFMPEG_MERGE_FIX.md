# FFmpeg Merge/Remux Fix - Summary

## Problem
Downloaded files were showing as "Missing File" because:
1. yt-dlp downloads **video stream** (.webm) and **audio stream** (.m4a) **separately**
2. **Merge step was FAILING** because yt-dlp couldn't find FFmpeg
3. Result: Two separate files instead of one merged video file

## Files in Download Directory
```
Claude_Sonnet_4_5.en.srt       # Subtitles
Claude_Sonnet_4_5.f140-drc.m4a # Audio stream (separate)
Claude_Sonnet_4_5.f303.webm    # Video stream (separate)
thumb1.jpg                      # Thumbnail
```

**Missing:** `Claude_Sonnet_4_5.mp4` (the merged final file)

## Root Cause
The `yt-dlp-helper` library wasn't configured with FFmpeg location, so:
- Phase 1: Video download ✅ (creates .webm)
- Phase 2: Audio download ✅ (creates .m4a)  
- **Phase 3: Merge FAILED ❌** (FFmpeg not found)

## Solution Applied

### Updated `src/main.ts`
Added FFmpeg path configuration to the download function:

```typescript
ipcMain.handle('ytdlp:download', async (e, id, args) => {
  // Determine FFmpeg location based on environment
  let ffmpegPath: string;
  if (app.isPackaged) {
    // Production: Use bundled binaries from resources/bin
    const resourcesPath = process.resourcesPath;
    ffmpegPath = path.join(resourcesPath, 'bin', 'ffmpeg');
  } else {
    // Development: Use binaries from project directory
    ffmpegPath = path.join(process.cwd(), 'binaries', 'linux', 'ffmpeg');
  }

  console.log(`Using FFmpeg from: ${ffmpegPath}`);

  const controller = await YTDLP.download({
    // Specify FFmpeg location for merging streams  
    ffmpegDownloadDestination: path.dirname(ffmpegPath),
    args: {
      url: args.url,
      output: args.outputFilepath,
      videoFormat: args.videoFormat,
      remuxVideo: args.remuxVideo,
      audioFormat: args.audioExt,
      audioQuality: args.audioFormatId,
      limitRate: args.limitRate,
    },
  });
});
```

## How It Works Now

1. **Development Mode:** Uses `./binaries/linux/ffmpeg`
2. **Production Mode:** Uses `resources/bin/ffmpeg` (bundled in package)
3. yt-dlp-helper automatically adds `--ffmpeg-location` to yt-dlp command
4. yt-dlp can now merge streams properly

## Expected Behavior After Fix

### Download Process:
```
Phase 1: Download video stream → file.f303.webm ✅
Phase 2: Download audio stream → file.f140-drc.m4a ✅
Phase 3: Merge with FFmpeg → file.mp4 ✅
Phase 4: Cleanup temp files → Deletes .webm and .m4a ✅
```

### Final Result:
```
Claude_Sonnet_4_5.mp4   # ✅ Merged final file
Claude_Sonnet_4_5.en.srt # Subtitles
thumb1.jpg              # Thumbnail
```

## Console Output to Expect

```
Using FFmpeg from: /home/user/Downlodr/binaries/linux/ffmpeg
[Merger] Merging formats into (mp4)
[VideoRemuxer] Remuxing video from webm to mp4
Download completed successfully
```

## Testing

1. **Clean up previous incomplete downloads:**
   ```bash
   # Remove the incomplete download files
   rm ~/.../Claude_Sonnet_4_5.f303.webm
   rm ~/.../Claude_Sonnet_4_5.f140-drc.m4a
   ```

2. **Restart the app:**
   ```bash
   ELECTRON_DISABLE_SANDBOX=1 yarn start
   ```

3. **Download a new video**
4. **Check console for:**
   - "Using FFmpeg from: ..."
   - "[Merger] Merging formats into ..."
   - "[VideoRemuxer] ..."

5. **Verify final file:**
   - Should be a single `.mp4` file
   - Temp `.webm` and `.m4a` files should be deleted
   - File should play correctly

## Files Modified
- ✅ `src/main.ts` - Added FFmpeg path configuration

## Dependencies
- FFmpeg binary must be present in `binaries/linux/` (already downloaded)
- yt-dlp-helper library (already installed)

---

**Status:** ✅ READY TO TEST
**Date:** 2025-09-30
**Issue:** Merge/remux failing due to missing FFmpeg configuration
**Fix:** Configured FFmpeg path for yt-dlp-helper library
