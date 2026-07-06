# Scraping Progress Indicators Feature

## Overview
This feature provides real-time feedback to users during the 1-2 minute processing delay after subscribing to a new channel. It displays loading states in the Downloads tab and a toast notification showing progress.

## Problem Statement
Previously, when users subscribed to a channel, the modal would close immediately, but the scraping process would continue in the background for 1-2 minutes. Users had no indication that:
- Videos were being fetched
- The app was processing the channel
- When to check the Downloads tab

This made the feature feel broken and left users uncertain about what was happening.

## Solution
Implemented a multi-layered progress indicator system:
1. **Downloads Tab Loading Rows** — Shows active scraping channels with friendly status messages
2. **Toast Notifications** — Aggregated toast showing progress count
3. **Real-time Status Updates** — Phases update as scraping progresses

## User Experience Flow

### Subscribe to Channel
```
User clicks "Subscribe"
    ↓
Modal closes
    ↓
"Subscription created" toast appears
    ↓
User navigates to Downloads tab
    ↓
[See loading row with spinner]
⟳ TechDaily
  Analyzing channel...
```

### Scraping Progresses
```
As scraper runs:
⟳ TechDaily
  Fetching videos...
    ↓
⟳ TechDaily
  Processing downloads...
    ↓
Row disappears
Videos appear in table
"Scraping complete" toast shows
```

## Technical Implementation

### 1. Store State (`useSkedulosaStore`)
Added non-persisted Map for tracking active scrapes:

```typescript
scrapingChannels: Map<number, {
  name: string;
  status: string;
  error?: string;
}>

// Methods:
setChannelScraping(channelId, name)
updateChannelScrapingStatus(channelId, status)
removeChannelScraping(channelId)
```

**Key Decision:** Not persisted in IndexedDB because it's ephemeral state tied to the current app session.

### 2. Status Display
Shows a simple, non-blocking loading message:

**Loading Row Status:**
```
⟳ TechDaily
  Scraping in progress...
```

No intermediate status updates are shown to avoid interfering with the bridge's internal event flow. The row automatically disappears 2 seconds after the scrape completes, giving the download queue time to process.

### 3. Cleanup Strategy (`SkedulosaSubscribeModal.tsx`)
After `runScraperOnce()` Promise resolves:
- Wait 2 seconds to allow `useSkedulosaDownloadBridge` to process queue events
- Then remove channel from `scrapingChannels` Map
- On error: Remove immediately (won't reach successful queue state)

**Important:** Does NOT attach additional bridge listeners to avoid blocking the download queue flow.

```typescript
.then((result) => {
  showScrapeErrors(result);
  // Give 2s for onDownloadQueuePushed to fire and process tasks
  setTimeout(() => {
    removeChannelScraping(toolkitChannelId);
  }, 2000);
})
```

### 4. Modal Integration (`SkedulosaSubscribeModal.tsx`)
When user subscribes:
- Calls `setChannelScraping(toolkitChannelId, channelName)` before runScraperOnce
- On success: `removeChannelScraping(toolkitChannelId)`
- On error: Shows error toast + removes from tracking

### 5. UI Components

#### Loading Rows (`StatusPageTable.tsx`)
Renders before normal subscription groups:
```
┌────┬──────────────────────────┬───────┬─────┐
│ □  │ ⟳ TechDaily              │ ...   │ ... │
│    │   Fetching videos...     │       │     │
├────┼──────────────────────────┼───────┼─────┤
│    │ [Normal subscription     │       │     │
│    │  groups appear below]    │       │     │
```

Features:
- Blue-tinted background (`bg-blue-50 dark:bg-blue-900/10`)
- Spinner animation (`animate-spin text-blue-500`)
- Friendly status text in smaller font
- Removes automatically when downloads queued

#### Toast Notifications (`useScrapingProgressToast.ts`)
Two scenarios:

**Starting:**
```
Title: Scraping in progress
Description: Scraping 1 channel. Videos will appear in the Downloads tab.
Duration: 0 (stays until scraping done)
```

**Completed:**
```
Title: Scraping complete
Description: 1 channel processed. Check the Downloads tab for new videos.
Duration: 5000ms (auto-dismiss)
```

Key features:
- Only fires on **transition** (0→N and N→0), not every status change
- Aggregates all scrapes into one toast
- Shows completed count vs total
- Auto-dismisses after 5 seconds when done

## Architectural Decisions

### Why No Global `bridge.onScraperStatus()` Listener?
Initially tried attaching a global listener at App.tsx to track status phase updates. **This blocked the download queue flow** because:
- The bridge manages its own internal event chain (`onScraperStatus` → `onDownloadQueuePushed`)
- Additional listeners created timing/blocking issues
- Downloads wouldn't queue until app restart

**Solution:** Keep tracking isolated to the modal, use simple 2-second cleanup delay instead of trying to track phases.

**Lesson:** Avoid adding extra listeners to the bridge — it manages a complex async flow that can be disrupted by external listeners.

## Performance Considerations

✅ **Non-Blocking:**
- No global listeners interfering with bridge flow
- Modal tracking is minimal (just store updates)
- Cleanup happens after Promise resolves + 2s delay

✅ **Memory:**
- Non-persisted state (cleared on app restart)
- Only stores currently active scrapes (removed after completion)
- Toast state tracked at module level (minimal overhead)

✅ **Rendering:**
- Map size determines if loading rows render
- Zustand selector isolates component updates
- No unnecessary re-renders of table rows

## Testing Checklist

- [ ] Subscribe to a new channel → "Subscription created" toast shows
- [ ] Modal closes immediately
- [ ] Navigate to Downloads tab → Loading row appears with spinner
- [ ] Loading row shows "Scraping in progress..." message
- [ ] Videos are added to queue without delay ✅ (This was the critical fix)
- [ ] After 2 seconds → Loading row disappears
- [ ] Videos appear in Downloads table
- [ ] "Scraping complete" toast shows and auto-dismisses after 5 seconds
- [ ] Toast doesn't spam (only shows on start/end transitions)
- [ ] Multiple subscriptions → Loading rows stack, toast shows aggregated count
- [ ] Error during scrape → Error toast shows, loading row removed immediately
- [ ] App restart → No orphaned loading state

## Files Modified/Created

### New Files:
- `src/skedulosa/hooks/useScrapingProgressToast.ts` — Toast notification hook

### Modified Files:
- `src/skedulosa/store/skedulosaStore.tsx` — Added scrapingChannels Map + 3 methods
- `src/App.tsx` — Added useScrapingProgressToast hook
- `src/skedulosa/components/SkedulosaSubscribeModal.tsx` — Track scraping start/completion
- `src/downlodr/pages/status/StatusPageTable.tsx` — Added loading rows UI

## Future Improvements

- [ ] Track error state in loading row (show error message briefly)
- [ ] Add estimated time remaining based on channel size
- [ ] Per-channel error details in loading row
- [ ] Activity history panel showing past scrapes
- [ ] Toast with action button to navigate to Downloads tab
- [ ] Keyboard shortcut to dismiss toast

## Related Features

- Error Toast Handling (`SkedulosaSubscribeModal.tsx` — error handling updates)
- Success Toast (`SkedulosaSubscribeModal.tsx` — subscription created notification)
- Error Mapping (`src/skedulosa/error-mapping/skedulosaErrors.ts`)

## Notes

- The global listener is attached once at app startup and never removed (safe pattern for long-lived listeners)
- Status mapper uses direct object lookup (O(1)) for performance
- Toast counting uses module-level variables to survive across hook rerenders
- Loading rows render at top of table, before normal groups, for visibility
