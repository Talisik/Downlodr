# Conversion Pause Race Condition Fix

## Problem
When pausing a conversion from the navbar, the conversion was being removed from the list instead of being paused. The item would disappear completely rather than staying in the list with a paused status.

## Root Cause - Race Condition
A critical race condition was occurring:

1. User clicks pause button
2. `pauseConversion()` is called, which sends request to main process
3. Main process kills the FFmpeg process with SIGTERM
4. FFmpeg process terminates with non-zero exit code
5. The conversion's error/close handler detects the termination
6. Before the pause status update completes, the conversion is marked as "failed"
7. `checkFinishedDownloads()` runs and removes failed conversions
8. The conversion disappears from the list

### The Timeline:
```
[User clicks pause] → [pauseConversion called] → [FFmpeg killed] → [Error detected] → [Status: failed] → [Item removed]
                                                     ↓
                                          [Status: paused] (too late!)
```

## The Fix
Update the status to 'paused' BEFORE calling `pauseConversion()` to prevent the race condition:

### Before (Race Condition):
```typescript
const result = await pauseConversion(downloadId);
if (result.success) {
  updateDownload(downloadId, { status: 'paused' }); // Too late!
}
```

### After (Fixed):
```typescript
// Update status FIRST to prevent race condition
updateDownload(downloadId, { status: 'paused' });

// Now safely pause the conversion
const result = await pauseConversion(downloadId);
if (result.success) {
  // Confirm pause completed
  updateDownload(downloadId, { status: 'paused', log: 'Paused' });
} else {
  // Revert if pause failed
  updateDownload(downloadId, { status: 'converting' });
}
```

## Why This Works

1. **Immediate Status Update**: By setting status to 'paused' immediately, we prevent the conversion from being marked as failed
2. **Protected from Cleanup**: The `checkFinishedDownloads()` function explicitly skips paused items (line 900)
3. **Graceful Failure Handling**: If pause fails, we revert the status back to 'converting'
4. **No Lost Items**: Conversions stay in the list with correct status

## Implementation Details

### Files Modified:
- `src/plugins/components/PluginTaskBarExtension.tsx`
  - `handleConversionPauseResume()` - Single pause/resume
  - `pauseAll()` - Pause all conversions
  
### Key Protection in Store:
```typescript
// In checkFinishedDownloads() - line 900
if (downloading.status === 'paused') {
  return false; // Never remove paused downloads
}
```

### Main Process Handler:
```typescript
// In pause-conversion handler - line 2465
conversion.status = 'paused'; // Mark as paused BEFORE killing process
```

## Testing

1. **Start a conversion**
2. **Click pause button**
3. **Verify**:
   - Item stays in list
   - Status shows as paused
   - Can be resumed
   - No "failed" status flash

## Console Output (Fixed)
```
🎯 [handleConversionPauseResume] Called with downloadId=abc-123, isPaused=false
⏸️ Pausing conversion from navbar: abc-123
[Status updated to paused BEFORE FFmpeg termination]
🛑 FFmpeg process terminated for pause: abc-123
⏸️ Conversion paused for download abc-123
✅ Conversion stays in list with paused status
```

## Additional Safeguards

1. **Store's pauseConversion**: Also updates status immediately (line 1129)
2. **Main process**: Marks status as 'paused' before killing FFmpeg (line 2465)  
3. **Error handlers**: Check for 'paused' status before treating as failure
4. **Completion handlers**: Don't override 'paused' status

## Summary

The fix eliminates the race condition by:
✅ Updating status to 'paused' BEFORE terminating FFmpeg
✅ Protecting paused items from cleanup
✅ Reverting status if pause fails
✅ Ensuring conversions stay in the list

The navbar pause/resume/stop controls now work correctly without removing conversions from the list when paused.
