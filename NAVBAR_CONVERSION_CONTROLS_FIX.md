# Navbar Conversion Controls Fix

## Issue Description
The conversion control buttons in the navbar (showing "Converting 1 files" with pause/stop buttons) are not working properly for format converter plugin conversions. However, the right-click context menu pause/resume/stop functions work correctly.

## Problem Analysis

### Working (Right-Click Context Menu)
The right-click context menu in `DownloadList.tsx` correctly:
1. Detects if a download is a conversion: `const isConversion = currentDownload && (currentDownload as any).type === 'conversion'`
2. Calls the appropriate functions: `pauseConversion()` and `resumeConversion()`
3. Updates the status properly using `updateDownload()` with conversion type

### Not Working (Navbar Controls)
The navbar controls showing "Converting 1 files" are:
1. Likely not detecting that the item is a conversion
2. Not calling the conversion-specific pause/resume functions
3. Attempting to handle it as a regular download

## The Fix Required

The navbar conversion controls need to be updated to:

1. **Detect Conversion Type**
```typescript
const isConversion = (download as any).type === 'conversion';
```

2. **Call Correct Functions for Conversions**
```typescript
if (isConversion) {
  if (download.status === 'paused') {
    // Resume conversion
    const result = await resumeConversion(downloadId);
    if (result.success) {
      updateDownload(downloadId, {
        type: 'conversion',
        data: {
          status: 'converting',
          log: 'Conversion resumed',
        },
      });
    }
  } else {
    // Pause conversion
    const result = await pauseConversion(downloadId);
    if (result.success) {
      updateDownload(downloadId, {
        type: 'conversion',
        data: {
          status: 'paused',
          log: 'Conversion paused',
        },
      });
    }
  }
}
```

3. **Stop Conversion Properly**
```typescript
if (isConversion) {
  const result = await stopConversion(downloadId);
  // Handle result
}
```

## Key Differences Between Conversions and Downloads

| Aspect | Regular Downloads | Conversions |
|--------|------------------|-------------|
| Type Field | undefined or 'download' | 'conversion' |
| Pause Function | Kill controller & re-add | `pauseConversion()` |
| Resume Function | Add new download | `resumeConversion()` |
| Stop Function | Kill controller | `stopConversion()` |
| Status Update | `updateDownloadStatus()` | `updateDownload()` with type: 'conversion' |

## Files That Need Updates

The navbar conversion controls component (likely in a status bar or progress component) needs to:
1. Import conversion functions from the download store
2. Check if the item is a conversion using the type field
3. Use the conversion-specific functions instead of regular download functions

## Testing the Fix

1. Start a conversion using the Format Converter plugin
2. The navbar should show "Converting 1 files" with control buttons
3. Click pause button → Conversion should pause (item stays in list)
4. Click resume button → Conversion should resume
5. Click stop button → Conversion should stop and be removed

## Note
The fix in `main.ts` for handling pause/resume without removing items from the list is already applied and working correctly. The issue is specifically with the navbar UI controls not calling the right functions.
