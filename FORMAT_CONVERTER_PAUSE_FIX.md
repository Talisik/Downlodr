# Format Converter Plugin Pause/Resume Fix

## Issue Description
When using the Format Converter plugin (accessed through PluginTaskBarExtension), pausing a conversion causes the item to be removed from the downloads list instead of being paused for later resumption.

## Root Cause
When the FFmpeg process handling the conversion is killed with `SIGTERM` (during pause), it triggers the `close` event with a non-zero exit code. The original implementation treated this as a failure and removed the item from the active conversions list.

## Files Modified

### 1. `/src/main.ts` (Lines 2035-2168)

#### Changes Made:
1. **Race Condition Prevention**: Set conversion status to 'paused' BEFORE killing the FFmpeg process
2. **Early Return on Pause**: Added checks in `close` and `error` event handlers to return early if conversion was intentionally paused
3. **Duplicate Resolution Prevention**: Added `isResolved` flag to prevent multiple promise resolutions
4. **Status Update Broadcasting**: Added IPC event emission to notify renderer of pause status

#### Key Code Changes:

```typescript
// In pause-conversion handler (line 2143-2146):
// Mark as paused BEFORE killing the process to prevent race conditions
conversion.status = 'paused';

// Kill the FFmpeg process but keep the conversion state
try {
  if (conversion.process) {
    conversion.process.kill('SIGTERM');
    console.log(`🛑 FFmpeg process terminated for pause: ${downloadId}`);
  }
} catch (killError) {
  console.warn(`⚠️ Could not kill FFmpeg process: ${killError.message}`);
}
```

```typescript
// In FFmpeg close event handler (line 2037-2045):
// Check if this was an intentional pause
if (conversion && conversion.status === 'paused') {
  console.log(`⏸️ FFmpeg process closed due to pause for download ${downloadId}`);
  // Don't delete from activeConversions, don't resolve promise
  // The pause handler already returned success
  return;
}
```

### 2. `/src/preload.ts` (Lines 158-164)

#### Changes Made:
Added listener for conversion status updates from main process to relay to renderer

```typescript
// Listen for conversion status updates from main process
ipcRenderer.on('conversion-status-update', (_event, data) => {
  // Dispatch a custom event that the renderer can listen to
  window.dispatchEvent(new CustomEvent('conversion-status-update', { detail: data }));
});
```

### 3. `/src/Store/downloadStore.tsx` (Lines 1113-1121)

#### Changes Made:
Updated `pauseConversion` to immediately update local state to prevent UI lag

```typescript
if (result.success) {
  // Update the status locally immediately to prevent race conditions
  get().updateDownload(downloadId, {
    type: 'conversion',
    data: {
      status: 'paused',
      log: 'Conversion paused',
    },
  });
  console.log(`⏸️ Conversion paused for download ${downloadId}`);
  return { success: true };
}
```

## How the Fix Works

1. **When pause is triggered**:
   - Conversion status is set to 'paused' BEFORE killing FFmpeg
   - FFmpeg process is terminated with SIGTERM
   - Process reference is cleared but conversion state is preserved

2. **When FFmpeg process closes**:
   - Event handler checks if status is 'paused'
   - If paused, returns early without resolving promise or removing from list
   - Conversion remains in activeConversions map for later resumption

3. **When resume is triggered**:
   - Conversion is found in activeConversions map
   - New FFmpeg process is spawned with same parameters
   - Conversion continues from the beginning (partial file is deleted)

## Testing the Fix

To verify the fix works correctly:

1. Start the application in development mode
2. Download a video file
3. Use the Format Converter plugin from the taskbar to start a conversion
4. Click the pause button while conversion is in progress
5. **Expected**: Item remains in list with "paused" status
6. Click resume button
7. **Expected**: Conversion resumes and completes successfully

## Benefits

- ✅ Conversions can be paused and resumed without losing track
- ✅ No data loss or unexpected item removal
- ✅ Better user experience with proper pause/resume functionality
- ✅ Works for both plugin-initiated and manual conversions
- ✅ No regression in error handling for actual failures

## Notes

- The conversion restarts from the beginning when resumed (FFmpeg limitation)
- Partial output files are cleaned up before resuming to prevent corruption
- The fix applies to all conversion types (video, audio, text formats)
