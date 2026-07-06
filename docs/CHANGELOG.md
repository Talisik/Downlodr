# Changelog

All notable changes made by Claude are documented here in reverse chronological order.

---

## [Unreleased] — 2026-04-21 — branch: fix/add-skedulosa-queue

### Added — `src/skedulosa/context/SubscriptionQueueContext.tsx` *(new file)*
- Introduced a global **subscription queue** that processes new Skedulosa subscriptions one at a time. Previously, submitting the subscribe form immediately triggered blocking IPC calls that could race when the user opened the modal multiple times quickly.
- Exposes `enqueue`, `pendingCount`, and `processingCount` to consumers via `useSubscriptionQueue()` hook.
- Each queued item runs the full creation pipeline (channel analysis, scrape-once, schedule creation) sequentially, then calls back `onSubscriptionCreated`.

### Added — `src/skedulosa/types/subscriptionQueue.ts` *(new file)*
- `QueuedSubscriptionData` type that carries all fields needed to process a subscription from the queue, including `analysisVideos`, `intelligentPrediction`, `channelDetails`, and the `onSubscriptionCreated` callback.

### Added — `src/skedulosa/components/GlobalScanningModal.tsx` *(new file)*
- **Global scanning modal** mounted at the app root (`src/App.tsx`) so it persists across page navigation. Previously the modal lived inside `SkedulosaLayout` and was unmounted whenever the user navigated away, which cancelled the animation and broke state restoration.
- When the user dismisses to background, shows a persistent orange `progress` toast with a spinner and a **"View Progress"** button that restores the modal.
- On analysis completion, automatically navigates the user back to `/skedulosa/subscription` with the scanned URL pre-filled if they navigated away.

### Added — `src/skedulosa/components/SubscriptionQueueBanner.tsx` *(new file)*
- Thin status bar rendered inside the Skedulosa layout while the subscription queue is draining. Stays visible for 5 seconds after the queue empties so it doesn't flash away immediately.

### Added — `src/downlodr/components/base/InputField/CategorySearchBar.tsx` *(new file)*
- Multi-field search bar for `CategoryTagPage`. Supports filtering by **Title**, **Tags**, **Categories**, **Status**, and **Source** via a field-selector dropdown. Debounced 300 ms. At least one field must remain selected at all times.

### Added — `src/core-app/ipc/main/ytdlpHandler.ts` + `src/core-app/ipc/renderer/downlodrHandler.ts`
- New `ytdlp:getDirectUrl` IPC handler that invokes `yt-dlp -g <url>` via `child_process.spawn` and resolves the raw direct stream URL. Exposed on `window.ytdlp.getDirectUrl`.

### Fixed — `src/skedulosa/components/SkedulosaSubscribeModal.tsx`
- **Duplicate subscription detection:** URL input now checks against all existing `sourceUrl` values in the Skedulosa store (case-insensitive) before triggering analysis. If a match is found, an inline error is shown and the Subscribe button stays disabled — prevents users from accidentally creating two subscriptions for the same channel.
- **Sequential analysis pipeline:** `fetchChannelDetails` and `analyzeChannelSchedule` bridge calls are now awaited in sequence instead of concurrently. Analysis now waits for channel details so avatar/subscriber data is available when the schedule result arrives.
- Modal now calls `enqueue()` from `SubscriptionQueueContext` instead of running the subscription pipeline inline, decoupling form submission from the async creation work.
- Added a `queued` toast confirmation on subscribe so users know their subscription was accepted even if processing takes a moment.

### Fixed — `src/skedulosa/pages/SkedulosaHistoryPage.tsx` / `SkedulosaSubscriptionPage.tsx` / `SkedulosaSchedulePage.tsx`
- **Sticky header z-index:** All three table pages had `sticky top-0` on the header `<tr>` without a `z-index`. Scrolling body rows (including `SpeedGraph` canvas elements and custom checkboxes) rendered on top of the stuck header. Added `z-10` to all three sticky rows.

### Fixed — `src/skedulosa/components/ScanningModal.tsx` + layout
- **Run in background:** Users can now dismiss the scanning modal and continue navigating the app while the channel analysis runs. The `GlobalScanningModal` re-surfaces results when scanning finishes.
- **Activity tracker:** Scanning modal now shows a live activity log during the analysis so users can see progress instead of a static spinner.

### Fixed — `src/core-app/ipc/main/trayHandler.ts`
- Tray icons resized to 16×16 on creation via `.resize({ width: 16, height: 16 })` to strip transparent padding that was making the icon appear larger than the system tray row.

### Fixed — `src/core-app/components/shadcn/hooks/use-toast.ts`
- `TOAST_LIMIT` raised from 1 to 10 so multiple simultaneous toasts can coexist.
- Added `VARIANT_PRIORITY` map (`destructive → success → default → progress`) so higher-priority toasts sort to the top.
- Incoming toasts of the same variant now replace the previous one of that variant instead of stacking identical messages.

### Fixed — `src/core-app/components/shadcn/components/ui/toast.tsx`
- Added `gap-2` to `ToastViewport` so stacked toasts no longer collapse onto each other.
- Added `progress` toast variant (orange `#F45513` background) used by the background-scan indicator.

### Changed — `src/App.tsx`
- Re-enabled `window.skedulosaBridge.startScraper()` at app startup (was commented out). Skedulosa's recurring check loop now starts automatically.
- `GlobalScanningModal` mounted once at the router root so its lifecycle is independent of active route.

### Changed — `src/skedulosa/components/SubscriptionQueueBanner.tsx`
- Subscription processing banner lingers for **5 seconds** after the queue drains instead of disappearing immediately.

### Changed — `src/skedulosa/components/SkedulosaSubscribeModal.tsx`
- First-scrape video limit dropdown capped at **1–5** videos (previously went higher). Warning shown when limit exceeds 3.

### Changed — `src/downlodr/components/base/Toolbar.tsx`
- Added `handleGetLink` handler stub for retrieving direct stream URLs via the new `window.ytdlp.getDirectUrl` bridge.
- Minor: string class literals normalised from single to double quotes.

---

## [Unreleased] — 2026-04-16

### Fixed — `src/downlodr/store/download/downloadStore.ts`
- Downloads stuck in `fetching metadata` status now cleaned up on app startup. Added a filter in `onRehydrateStorage` that removes any `forDownloads` entries with `status === 'fetching metadata'` after rehydration. These entries cannot be resumed because the metadata fetch process dies with the app.

### Fixed — `src/core-app/ipc/main/ytdlpHandler.ts`
- **IPC throttling:** Progress chunks from the yt-dlp stream are now throttled to at most one send per 150ms. Status-change and completion chunks always bypass the throttle. Prevents excessive IPC round-trips causing UI lag during active downloads.
- **Unbounded log buffer:** `completeLog` is now capped at 50KB — oldest content is trimmed when the limit is exceeded. Previously the buffer grew for the entire duration of a download with no upper bound.
- **Log not sent on every chunk:** `completeLog` is no longer attached to every progress chunk sent to the renderer. It is only included in the final completion event where it is actually needed.
- **Fallback timer leak:** The 2-second fallback `setTimeout` is now stored in a variable and cancelled via `clearTimeout` when the process exits normally. Previously the timer always ran and held a closure over `e`, `controller`, and `completeLog` for 2 seconds per download.
- **Process listener cleanup:** Changed `controller.process.on('exit')` and `on('close')` to `once()`. Listeners now auto-remove themselves after firing instead of remaining attached permanently.
- **Global config mutation:** `YTDLP.Config.log = true` moved to the top of `ytdlpHandler()` so it is set once at initialisation. Previously it was set on every `ytdlp:info` call.

### Fixed — `src/downlodr/pages/status/statusPageHandler.ts`
- **Pause broken silently:** `killController` returns a plain `boolean` but `handlePause` was treating the `.then()` callback value as `{ success: boolean }`. Since `.success` on a boolean is always `undefined`, the success branch never executed. Replaced fire-and-forget `.then()` with `await` and a direct boolean check.
- **No rollback on failed pause:** If `killController` returned `false`, the download status was left as `paused` even though the process kept running. Added rollback: `updateDownloadStatus(downloadId, 'downloading')` is now called on failure so the UI stays accurate.
- **Empty `controllerId` guard:** The pause condition only checked `controllerId !== '---'` but not whether `controllerId` was truthy. During `initializing` status, no controller is assigned yet, so `killController('')` was being called. Added a truthy check so downloads that aren't ready yet show a "Cannot Pause Yet" toast instead.
- **Duplicate `updateDownloadStatus` calls:** Three redundant calls to `updateDownloadStatus(downloadId, 'paused')` were consolidated into one.
- **Resume loses thumbnail and transcript paths:** When resuming a paused download, `addDownload` was called with `isCreateFolder: false` but without `autoCaptionLocation` or `thumnailsLocation`. Both fields defaulted to empty/placeholder values, wiping the stored paths. The resume call now forwards both fields from `currentDownload`.
- **Type error on `handleStop` `.then()` callback:** `killController` is typed as `Promise<unknown>` but the callback parameter was typed as `boolean`. Changed parameter to `unknown` and used truthy check.

### Fixed — `src/downlodr/components/navigation/PageNavigation.tsx`
- TypeScript error `'error' is of type 'unknown' (ts18046)` in the plugin install catch block. Cast `error` to `Error` via `const err = error as Error` and replaced all `error.message` references with `err.message`.

### Changed — `src/downlodr/components/base/InputField/TaskbarInputField.tsx`
- Disabled Skedulosa channel link reroute for UX improvement build. The block that called `setPendingSubscribeUrl` and navigated to `/skedulosa/subscription` or `/skedulosa/no-schedule` is commented out with a `[SKEDULOSA]` marker. Replaced with a destructive toast ("Channel links not supported") and input clear so users still get feedback without being sent anywhere.
