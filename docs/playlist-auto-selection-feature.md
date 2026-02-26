# Playlist Auto-Selection Feature

## Overview

This feature automatically selects downloads in StatusSpecificDownloads when they originate from a playlist download in TaskbarInputField.

## Implementation Details

### 1. Download Store Changes (`src/Store/downloadStore.tsx`)

Added playlist tracking fields to `BaseDownload` interface:
```typescript
// Playlist tracking
isFromPlaylist?: boolean; // Whether this download came from a playlist
playlistBatchId?: string; // Batch ID to group playlist downloads together
```

Updated `setDownload` function to accept playlist tracking options:
```typescript
setDownload: (
  videoUrl: string,
  location: string,
  limitRate: string,
  options?: {
    getTranscript: boolean;
    getThumbnail: boolean;
    isFromPlaylist?: boolean;
    playlistBatchId?: string;
  },
) => Promise<string | undefined>;
```

### 2. TaskbarInputField Changes (`src/Components/SubComponents/custom/TaskbarDownloads/TaskbarInputField.tsx`)

Modified playlist download logic to:
1. Generate a unique batch ID for each playlist download session
2. Pass `isFromPlaylist: true` and the batch ID to each video in the playlist

```typescript
// Generate a unique batch ID for this playlist download
const playlistBatchId = `playlist_${Date.now()}_${Math.random()
  .toString(36)
  .substr(2, 9)}`;

// Download each selected video with user preferences and playlist tracking
for (const video of selectedVideosList) {
  setDownload(video.url, downloadFolder, maxDownload, {
    getTranscript,
    getThumbnail,
    isFromPlaylist: true,
    playlistBatchId,
  });
}
```

### 3. StatusSpecificDownloads Changes (`src/Pages/StatusSpecificDownload.tsx`)

Added auto-selection logic that:
1. Monitors `forDownloads` for new playlist downloads
2. Automatically selects downloads with `isFromPlaylist: true` and status "to download"
3. Shows a toast notification when auto-selection occurs

```typescript
// Auto-select playlist downloads when they appear in forDownloads
useEffect(() => {
  // Find downloads that are from playlists and have status "to download"
  const playlistDownloads = forDownloads.filter(
    (download) => 
      download.isFromPlaylist && 
      download.status === 'to download' &&
      !selectedRowIds.includes(download.id)
  );

  if (playlistDownloads.length > 0) {
    // Auto-select them and show notification
    // ...
  }
}, [forDownloads, selectedRowIds, allDownloads, setSelectedRowIds, setSelectedDownloads]);
```

## User Experience

1. User enters a playlist URL in TaskbarInputField
2. User selects videos from the playlist and clicks Download
3. Videos are added to forDownloads with playlist tracking metadata
4. When user navigates to StatusSpecificDownloads (or if already there), playlist downloads are automatically selected
5. User sees a toast notification: "Playlist Downloads Auto-Selected: X download(s) from your playlist have been automatically selected."
6. User can immediately use the "Play Selected" button in the taskbar to start downloading

## Benefits

- **Improved UX**: No need to manually select playlist downloads
- **Batch Operations**: Easy to start all playlist downloads at once
- **Clear Feedback**: Toast notification confirms auto-selection
- **Non-Intrusive**: Only affects playlist downloads, single downloads work as before
- **Grouping**: Batch ID allows for future features like "select all from this playlist"

## Future Enhancements

- Add UI indicator to show which downloads are from the same playlist batch
- Add "Select all from playlist" context menu option
- Add playlist name/title to download metadata
- Add option to disable auto-selection in settings
