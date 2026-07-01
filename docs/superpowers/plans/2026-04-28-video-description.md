# Video Description in VideoPlayerPanel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display the video description in VideoPlayerPanel by capturing it from the existing `getInfo` call in `setDownload` — zero extra yt-dlp invocations.

**Architecture:** Add `description?: string` to `BaseDownload` and `VideoInfo.data`, extract it during the already-running `getInfo` call in `setDownload`, store it on the download entry, then thread it through `StatusPage.tsx` state into `VideoPlayerPanel` as a new optional prop.

**Tech Stack:** TypeScript, React, Zustand, Electron IPC (yt-dlp-helper), Tailwind CSS

---

## File Map

| File | Change |
|---|---|
| `src/downlodr/schema/metadataSchema.ts` | Add `description?: string` to `VideoInfo.data` |
| `src/downlodr/store/download/types.ts` | Add `description?: string` to `BaseDownload` |
| `src/downlodr/store/download/actions/downloadActions.ts` | Extract description from `info.data`, include in `set()` update |
| `src/downlodr/components/panel/VideoPlayerPanel.tsx` | Add `description?: string` prop, replace placeholder with rendered value |
| `src/downlodr/pages/StatusPage.tsx` | Add `description` to `videoPlayerState` type, pass from download entry, pass to panel |

---

### Task 1: Extend the type definitions

**Files:**
- Modify: `src/downlodr/schema/metadataSchema.ts`
- Modify: `src/downlodr/store/download/types.ts`

> Note: This project has no test commands configured. Skip test steps throughout this plan.

- [ ] **Step 1: Add `description` to the yt-dlp response type**

In `src/downlodr/schema/metadataSchema.ts`, add `description?: string` inside `VideoInfo.data`:

```ts
export interface VideoInfo {
  data: {
    formats: VideoFormat[];
    extractor_key: string;
    format_id: string;
    ext: string;
    channel?: string;
    uploader?: string;
    title?: string;
    description?: string;       // ← add this line
    thumbnail?: string;
    thumbnails?: VideoInfoThumbnail[];
    subtitles?: Record<string, unknown>;
    automatic_captions?: Record<string, unknown>;
    is_live?: boolean;
    elapsed?: number | null;
    duration?: number | null;
  };
}
```

- [ ] **Step 2: Add `description` to `BaseDownload`**

In `src/downlodr/store/download/types.ts`, add `description?: string` after the `transcriptLocation` field (line ~41):

```ts
  autoCaptionLocation?: string;
  thumnailsLocation?: string;
  transcriptLocation?: string;
  description?: string;         // ← add this line
  getTranscript: boolean;
```

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
yarn tsc --noEmit
```
Expected: no new errors related to `description`.

---

### Task 2: Capture description during the `getInfo` call

**Files:**
- Modify: `src/downlodr/store/download/actions/downloadActions.ts`

- [ ] **Step 1: Extract description from `info.data`**

In `downloadActions.ts`, inside `setDownload`, find the block that extracts `channelName` (around line 172):

```ts
const channelName = info.data?.channel || info.data?.uploader || '';
```

Add the description extraction immediately after:

```ts
const channelName = info.data?.channel || info.data?.uploader || '';
const description = info.data?.description ?? '';
```

- [ ] **Step 2: Include `description` in the `set()` update**

In the same function, find the `set()` call that updates the `ForDownload` entry with fetched metadata (the one setting `name`, `status: 'to download'`, `channelName`, etc. — around line 221). Add `description` to the spread object:

```ts
set((state) => ({
  ...state,
  forDownloads: state.forDownloads.map((download) =>
    download.id === downloadId
      ? {
          ...download,
          name: truncateTitle(info.data?.title || 'Untitled'),
          downloadName: truncateTitle(info.data?.title || 'Untitled'),
          displayName: info.data?.title || 'Untitled',
          description,               // ← add this line
          status: 'to download',
          ext: defaultExt,
          formatId: defaultFormatId,
          extractorKey: info.data?.extractor_key || '',
          audioExt: '',
          audioFormatId: '',
          channelName: channelName,
          downloadStart: false,
          formats: formatOptions,
          isLive: info.data?.is_live || false,
          elapsed: info.data?.elapsed || null,
          location: location,
          automaticCaption: caption,
          thumbnails: thumbnail,
          getTranscript: options.getTranscript,
          getThumbnail: options.getThumbnail,
          duration: info.data?.duration,
          downloadPhase: 'video',
          completionCount: 0,
          rawProgress: 0,
          speedHistory: [] as SpeedDataPoint[],
          isFromPlaylist: download.isFromPlaylist,
          playlistBatchId: download.playlistBatchId,
        }
      : download,
  ),
}));
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
yarn tsc --noEmit
```
Expected: no errors.

---

### Task 3: Add `description` prop to VideoPlayerPanel and render it

**Files:**
- Modify: `src/downlodr/components/panel/VideoPlayerPanel.tsx`

- [ ] **Step 1: Add `description` to the props interface**

In `VideoPlayerPanel.tsx`, find `VideoPlayerPanelProps` (around line 9) and add `description?: string` after `category`:

```ts
interface VideoPlayerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  title: string;
  autoCaptionLocation?: string;
  transcriptLocation?: string;
  width: number;
  onWidthChange: (w: number) => void;
  status?: string;
  downloadName?: string;
  displayName?: string;
  dateAdded?: string;
  location?: string;
  tags?: string[];
  category?: string[];
  description?: string;         // ← add this line
}
```

- [ ] **Step 2: Destructure the prop**

In the component function signature (around line 27), add `description` to the destructured props:

```ts
const VideoPlayerPanel: React.FC<VideoPlayerPanelProps> = ({
  isOpen,
  onClose,
  videoUrl,
  title,
  autoCaptionLocation,
  transcriptLocation,
  width,
  onWidthChange,
  status,
  downloadName,
  displayName,
  dateAdded,
  location,
  tags,
  category,
  description,                  // ← add this line
}) => {
```

- [ ] **Step 3: Replace the Description placeholder**

Find the placeholder block (around line 381–385):

```tsx
<div>
  <div className="flex items-baseline gap-2 items-center">
    <div>Description</div>
  </div>
</div>
```

Replace it with:

```tsx
{description && (
  <div className="flex flex-col gap-1">
    <span className="text-[12px] text-gray-500 dark:text-gray-400">
      Description
    </span>
    <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
      {description}
    </p>
  </div>
)}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
yarn tsc --noEmit
```
Expected: no errors.

---

### Task 4: Thread `description` through StatusPage

**Files:**
- Modify: `src/downlodr/pages/StatusPage.tsx`

- [ ] **Step 1: Add `description` to the `videoPlayerState` type**

In `StatusPage.tsx`, find the `useState` declaration for `videoPlayerState` (around line 66):

```ts
const [videoPlayerState, setVideoPlayerState] = useState<{
  isOpen: boolean;
  videoUrl: string;
  title: string;
  autoCaptionLocation?: string;
  transcriptLocation?: string;
  displayName?: string;
  dateAdded?: string;
  location?: string;
  tags?: string[];
  category?: string[];
  status?: string;
  downloadName?: string;
}>({ isOpen: false, videoUrl: '', title: '' });
```

Add `description?: string` to the type:

```ts
const [videoPlayerState, setVideoPlayerState] = useState<{
  isOpen: boolean;
  videoUrl: string;
  title: string;
  autoCaptionLocation?: string;
  transcriptLocation?: string;
  displayName?: string;
  dateAdded?: string;
  location?: string;
  tags?: string[];
  category?: string[];
  status?: string;
  downloadName?: string;
  description?: string;         // ← add this line
}>({ isOpen: false, videoUrl: '', title: '' });
```

- [ ] **Step 2: Pass `description` when opening the panel from the table row**

Find the `onViewEmbed` handler on the StatusPageTable component (around line 674):

```ts
onViewEmbed={(download) => {
  setVideoPlayerState({
    isOpen: true,
    videoUrl: download.videoUrl ?? '',
    title: download.displayName ?? download.name ?? '',
    autoCaptionLocation: download.autoCaptionLocation,
    transcriptLocation: download.transcriptLocation,
    displayName: download.displayName,
    dateAdded: download.DateAdded,
    location: download.location,
    tags: download.tags,
    category: download.category,
    status: download.status,
    downloadName: download.name,
  });
}}
```

Add `description`:

```ts
onViewEmbed={(download) => {
  setVideoPlayerState({
    isOpen: true,
    videoUrl: download.videoUrl ?? '',
    title: download.displayName ?? download.name ?? '',
    autoCaptionLocation: download.autoCaptionLocation,
    transcriptLocation: download.transcriptLocation,
    displayName: download.displayName,
    dateAdded: download.DateAdded,
    location: download.location,
    tags: download.tags,
    category: download.category,
    status: download.status,
    downloadName: download.name,
    description: download.description,   // ← add this line
  });
}}
```

- [ ] **Step 3: Pass `description` to the VideoPlayerPanel JSX**

Find the `<VideoPlayerPanel ... />` JSX (around line 691). Add the `description` prop after `downloadName`:

```tsx
<VideoPlayerPanel
  isOpen={videoPlayerState.isOpen}
  onClose={() =>
    setVideoPlayerState({
      isOpen: false,
      videoUrl: '',
      title: '',
      autoCaptionLocation: undefined,
      transcriptLocation: undefined,
      displayName: undefined,
      dateAdded: undefined,
      location: undefined,
      tags: undefined,
      category: undefined,
    })
  }
  videoUrl={videoPlayerState.videoUrl}
  title={videoPlayerState.title}
  autoCaptionLocation={videoPlayerState.autoCaptionLocation}
  transcriptLocation={videoPlayerState.transcriptLocation}
  displayName={videoPlayerState.displayName}
  dateAdded={videoPlayerState.dateAdded}
  location={videoPlayerState.location}
  tags={videoPlayerState.tags}
  category={videoPlayerState.category}
  status={videoPlayerState.status}
  downloadName={videoPlayerState.downloadName}
  description={videoPlayerState.description}   // ← add this line
  width={panelWidth}
  onWidthChange={setPanelWidth}
/>
```

- [ ] **Step 4: Final TypeScript check**

```bash
yarn tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Manual smoke test**

Run the app:
```bash
yarn start
```

1. Add a YouTube video URL to initiate a download.
2. Once it appears in the status table (status "to download"), right-click or click the preview button to open the VideoPlayerPanel.
3. Verify the Description section shows the video's description text.
4. Verify the description is scrollable if it is long.
5. Add a second video that has no description — verify the Description section is hidden (not showing an empty box).
