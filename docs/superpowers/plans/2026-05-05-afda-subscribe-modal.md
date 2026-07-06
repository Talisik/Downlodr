# AFDA Website Subscription Modal Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add URL-based AFDA website detection to `SkedulosaSubscribeModal` so that entering `https://afda-test-news.com` triggers an AFDA subscription flow (mirroring the YouTube channel flow) instead of showing an "unsupported platform" error.

**Architecture:** Three-layer adapter isolates mock data from the modal — `afdaWebsiteMock.ts` holds hardcoded data, `afdaWebsiteService.ts` exposes a single async function, and the modal calls that function. A `urlType` state flag drives branching at analysis and subscribe time. `AfdaSubscription.section_details` is re-typed to use `AfdaWebsiteInfo` directly, making the service schema the single source of truth across the store and both display pages.

**Tech Stack:** React, TypeScript, Zustand, Tailwind CSS, React Router v6. No new packages.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/afda/backend/schema/afdaWebsiteSchema.ts` | `AfdaWebsiteInfo` type definition |
| Create | `src/afda/backend/dummy/afdaWebsiteMock.ts` | Hardcoded mock data keyed by hostname |
| Create | `src/afda/backend/afdaWebsiteService.ts` | `fetchAfdaWebsiteInfo(url)` adapter — swap body for real package |
| Modify | `src/afda/types/afdaTypes.ts` | Replace `AfdaSectionDetails` with `AfdaWebsiteInfo` on `AfdaSubscription` |
| Modify | `src/skedulosa/utils/generateDummySubscription.ts` | Update `section_details` in `generateDummyAfdaSubscription` to new shape |
| Modify | `src/skedulosa/components/SkedulosaSubscribeModal.tsx` | AFDA URL detection, branching, info card, subscribe handler |

---

### Task 1: Create the AFDA website adapter layer

**Files:**
- Create: `src/afda/backend/schema/afdaWebsiteSchema.ts`
- Create: `src/afda/backend/dummy/afdaWebsiteMock.ts`
- Create: `src/afda/backend/afdaWebsiteService.ts`

- [ ] **Step 1: Create `afdaWebsiteSchema.ts`**

```ts
// src/afda/backend/schema/afdaWebsiteSchema.ts

export interface AfdaWebsiteInfo {
  websiteName: string;
  websiteUrl: string;
  articleCount: number;
  sectionCount: number;
  site: string;
}
```

- [ ] **Step 2: Create `afdaWebsiteMock.ts`**

```ts
// src/afda/backend/dummy/afdaWebsiteMock.ts
import type { AfdaWebsiteInfo } from '../schema/afdaWebsiteSchema';

export const AFDA_WEBSITE_MOCKS: Record<string, AfdaWebsiteInfo> = {
  'afda-test-news.com': {
    websiteName: 'AFDA Test News',
    websiteUrl: 'https://afda-test-news.com',
    articleCount: 142,
    sectionCount: 5,
    site: 'afda-test-news.com',
  },
};
```

- [ ] **Step 3: Create `afdaWebsiteService.ts`**

```ts
// src/afda/backend/afdaWebsiteService.ts
import type { AfdaWebsiteInfo } from './schema/afdaWebsiteSchema';
import { AFDA_WEBSITE_MOCKS } from './dummy/afdaWebsiteMock';

const SIMULATED_DELAY_MS = 600;

/**
 * Fetch website-level info for an AFDA URL.
 * Returns null if the hostname is not in the recognized registry.
 *
 * SWAP THIS FUNCTION BODY when the real AFDA package is available.
 * Keep the signature: (url: string) => Promise<AfdaWebsiteInfo | null>
 */
export async function fetchAfdaWebsiteInfo(
  url: string,
): Promise<AfdaWebsiteInfo | null> {
  await new Promise((r) => setTimeout(r, SIMULATED_DELAY_MS));
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return AFDA_WEBSITE_MOCKS[hostname] ?? null;
  } catch {
    return null;
  }
}

export type { AfdaWebsiteInfo };
```

- [ ] **Step 4: Run lint to verify no errors in the three new files**

Run: `yarn lint`
Expected: zero errors for `afdaWebsiteSchema.ts`, `afdaWebsiteMock.ts`, `afdaWebsiteService.ts`. Pre-existing errors in other files are fine.

- [ ] **Step 5: Commit**

```
git add src/afda/backend/schema/afdaWebsiteSchema.ts src/afda/backend/dummy/afdaWebsiteMock.ts src/afda/backend/afdaWebsiteService.ts
git commit -m "feat: add AFDA website adapter layer (schema, mock, service)"
```

---

### Task 2: Align types and dummy data with new schema

**Files:**
- Modify: `src/afda/types/afdaTypes.ts`
- Modify: `src/skedulosa/utils/generateDummySubscription.ts`

- [ ] **Step 1: Update `afdaTypes.ts` — replace `AfdaSectionDetails` with `AfdaWebsiteInfo`**

Replace the entire file content with:

```ts
// src/afda/types/afdaTypes.ts
import type {
  ActivityLogEntry,
  Download,
  ScheduleTime,
  SubscriptionSettings,
} from '@/skedulosa/store/skedulosaStore';
import type { AfdaWebsiteInfo } from '@/afda/backend/schema/afdaWebsiteSchema';

export type { AfdaWebsiteInfo };

export interface AfdaSubscription {
  id: string;
  source_type: 'afda';
  downloads: Download[];
  schedule_time: ScheduleTime[];
  last_checked_time: string;
  /** Display name of the section or publication. */
  source: string;
  /** Section URL used for fetching articles. */
  sourceUrl: string;
  recurring: boolean;
  status: string;
  date_created: string;
  upload_cadence: string;
  settings: SubscriptionSettings[];
  /** Website metadata fetched at subscribe time. */
  section_details?: AfdaWebsiteInfo;
  /** Chronological log of events for this subscription. */
  activity_log?: ActivityLogEntry[];
}
```

- [ ] **Step 2: Update `generateDummySubscription.ts` — fix `section_details` shape**

In `generateDummyAfdaSubscription`, find the `section_details` block and replace it:

```ts
// OLD — remove this:
section_details: {
  sectionName,
  sectionUrl: `https://${site}/sections/${sectionName.toLowerCase().replace(/\s+/g, '-')}`,
  articleCount: Math.floor(Math.random() * 200) + 10,
  site,
},

// NEW — replace with:
section_details: {
  websiteName: sectionName,
  websiteUrl: `https://${site}/sections/${sectionName.toLowerCase().replace(/\s+/g, '-')}`,
  articleCount: Math.floor(Math.random() * 200) + 10,
  sectionCount: Math.floor(Math.random() * 8) + 2,
  site,
},
```

Also update the `sourceUrl` line above it to match (it already uses `site` and `sectionName`, no change needed there).

- [ ] **Step 3: Run lint to verify no type errors**

Run: `yarn lint`
Expected: zero errors in `afdaTypes.ts` and `generateDummySubscription.ts`.

- [ ] **Step 4: Commit**

```
git add src/afda/types/afdaTypes.ts src/skedulosa/utils/generateDummySubscription.ts
git commit -m "feat: align AfdaSubscription.section_details with AfdaWebsiteInfo schema"
```

---

### Task 3: Implement AFDA modal flow in `SkedulosaSubscribeModal.tsx`

This is the largest task. Make changes in the order listed — each step builds on the previous.

**Files:**
- Modify: `src/skedulosa/components/SkedulosaSubscribeModal.tsx`

#### Step 1: Add new imports

- [ ] At the top of the file, add these two imports after the existing import block:

```tsx
import {
  fetchAfdaWebsiteInfo,
  type AfdaWebsiteInfo,
} from '@/afda/backend/afdaWebsiteService';
import type { AfdaSubscription } from '@/afda/types/afdaTypes';
```

- [ ] Also add `ScheduleDay` to the existing skedulosaStore import. Find the line:

```tsx
import { useSkedulosaStore } from '@/skedulosa/store/skedulosaStore';
```

Replace with (the store already exports `ScheduleDay`):

```tsx
import {
  useSkedulosaStore,
  type ScheduleDay,
} from '@/skedulosa/store/skedulosaStore';
```

- [ ] Remove `generateDummyAfdaSubscription` from the `generateDummySubscription` import. Find:

```tsx
import {
  generateDummyAfdaSubscription,
  generateDummySubscription,
} from '@/skedulosa/utils/generateDummySubscription';
```

Replace with:

```tsx
import { generateDummySubscription } from '@/skedulosa/utils/generateDummySubscription';
```

#### Step 2: Add `isAfdaUrl` helper and `ABBREV_TO_DAY` constant

- [ ] After the existing `isYouTubeUrl` function, add:

```tsx
const AFDA_HOSTS = ['afda-test-news.com'];

const isAfdaUrl = (url: string): boolean => {
  try {
    return AFDA_HOSTS.includes(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
};

const ABBREV_TO_DAY: Record<string, ScheduleDay> = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
};
```

#### Step 3: Update `validateUrlFormat` to pass AFDA URLs

- [ ] Find the `validateUrlFormat` function. Inside it, find the `SUPPORTED_HOSTS` block:

```tsx
const SUPPORTED_HOSTS = [
  'youtube.com',
  'www.youtube.com',
  'youtu.be',
  'm.youtube.com',
];
const host = parsed.hostname.toLowerCase();
if (!SUPPORTED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
  return t('subscribeModal.errors.unsupportedPlatform');
}
```

Insert a pass-through **before** that block:

```tsx
// AFDA website — recognized, skip the YouTube-only host check
if (isAfdaUrl(raw.trim())) return null;
```

#### Step 4: Add new state variables and store hook

- [ ] Inside `SkedulosaSubscribeModal`, find the existing `useState` declarations block. Add after `const [urlError, setUrlError] = useState<string | null>(null);`:

```tsx
const [urlType, setUrlType] = useState<'youtube' | 'afda' | null>(null);
const [afdaWebsiteInfo, setAfdaWebsiteInfo] = useState<AfdaWebsiteInfo | null>(null);
```

- [ ] Find the existing `addAfdaSubscription` store hook:

```tsx
const addAfdaSubscription = useAfdaSubscriptionsStore(
  (s) => s.addAfdaSubscription,
);
```

Add `getNextAfdaId` after it:

```tsx
const getNextAfdaId = useAfdaSubscriptionsStore((s) => s.getNextId);
```

#### Step 5: Update the analysis `useEffect` to branch on URL type

- [ ] Inside the 800ms debounce `useEffect`, find the empty-URL early return block:

```tsx
if (!url) {
  setChannelAnalysis(null);
  setChannelDetails(null);
  setIsValidUrl(false);
  setUrlError(null);
  return;
}
```

Add `urlType` and `afdaWebsiteInfo` resets to it:

```tsx
if (!url) {
  setChannelAnalysis(null);
  setChannelDetails(null);
  setIsValidUrl(false);
  setUrlError(null);
  setUrlType(null);
  setAfdaWebsiteInfo(null);
  return;
}
```

- [ ] Find the format-error early return:

```tsx
if (formatError) {
  setUrlError(formatError);
  setChannelAnalysis(null);
  setChannelDetails(null);
  setIsValidUrl(false);
  return;
}
```

Add resets:

```tsx
if (formatError) {
  setUrlError(formatError);
  setChannelAnalysis(null);
  setChannelDetails(null);
  setIsValidUrl(false);
  setUrlType(null);
  setAfdaWebsiteInfo(null);
  return;
}
```

- [ ] Find the start of the `setTimeout` callback — the line that reads:

```tsx
const timer = setTimeout(async () => {
  const bridge =
    typeof window !== 'undefined' ? window.skedulosaBridge : undefined;
  if (!bridge) {
```

Insert the AFDA branch **before** the bridge check, so the full start of the callback becomes:

```tsx
const timer = setTimeout(async () => {
  // ── AFDA path — no bridge required ──────────────────────────────
  if (isAfdaUrl(url)) {
    setUrlType('afda');
    const gen = ++analysisGeneration.current;
    analysisStarted.current = true;
    startChannelAnalysis(url, false);
    try {
      const info = await fetchAfdaWebsiteInfo(url);
      if (analysisGeneration.current !== gen) return;
      if (!info) {
        setUrlError(t('subscribeModal.errors.unsupportedPlatform'));
        setIsValidUrl(false);
        setAfdaWebsiteInfo(null);
      } else {
        setAfdaWebsiteInfo(info);
        setChannelName(info.websiteName);
        setIsValidUrl(true);
        setUrlError(null);
      }
    } catch {
      if (analysisGeneration.current !== gen) return;
      setUrlError(t('subscribeModal.errors.analyzeFailedGeneric'));
      setIsValidUrl(false);
      setAfdaWebsiteInfo(null);
    } finally {
      if (analysisGeneration.current === gen) finishChannelAnalysis();
    }
    return;
  }

  // ── YouTube path (unchanged below) ───────────────────────────────
  setUrlType('youtube');
  const bridge =
    typeof window !== 'undefined' ? window.skedulosaBridge : undefined;
  if (!bridge) {
```

> **Note:** The YouTube path continues exactly as before after `setUrlType('youtube');`. Only add that one line — do not change anything else in the YouTube block.

#### Step 6: Update `resetForm` to clear new state

- [ ] Find `resetForm`. Add two resets before `clearChannelAnalysis()`:

```tsx
setUrlType(null);
setAfdaWebsiteInfo(null);
```

#### Step 7: Remove `handleAddDummyAfda`

- [ ] Delete the entire `handleAddDummyAfda` callback:

```tsx
// DELETE THIS ENTIRE BLOCK:
const handleAddDummyAfda = useCallback(() => {
  const dummy = generateDummyAfdaSubscription();
  addAfdaSubscription(dummy);
  onSubscriptionCreated?.('Dummy article subscription', dummy.id);
  onClose();
  if (!onSubscriptionCreated) {
    navigate('/skedulosa/subscription');
  }
}, [addAfdaSubscription, onSubscriptionCreated, onClose, navigate]);
```

#### Step 8: Update `handleSubscribe` to branch on `urlType`

- [ ] Find `handleSubscribe`. At the very start of the callback body, after the `name`/`url` const declarations, add the AFDA branch **before** the existing `QueuedSubscriptionData` block:

```tsx
// ── AFDA subscription ─────────────────────────────────────────────
if (urlType === 'afda' && afdaWebsiteInfo) {
  const sub: AfdaSubscription = {
    id: getNextAfdaId(),
    source_type: 'afda',
    downloads: [],
    schedule_time: selectedDays
      .map((d) => ABBREV_TO_DAY[d])
      .filter((d): d is ScheduleDay => Boolean(d))
      .map((day) => ({ day, time_minutes: parseInt(checkAtHour) * 60 })),
    last_checked_time: new Date().toISOString(),
    source: name || afdaWebsiteInfo.websiteName,
    sourceUrl: url,
    recurring: true,
    status: 'Active',
    date_created: new Date().toISOString(),
    upload_cadence: 'Daily',
    settings: [
      {
        frequency: 'Daily',
        download_quality: qualityPreset,
        save_location: saveToPath,
        download_priority: 'normal',
        lookback_period: '7 days',
        file_naming_format: '%(title)s.%(ext)s',
      },
    ],
    section_details: {
      websiteName: afdaWebsiteInfo.websiteName,
      websiteUrl: url,
      articleCount: afdaWebsiteInfo.articleCount,
      sectionCount: afdaWebsiteInfo.sectionCount,
      site: afdaWebsiteInfo.site,
    },
    activity_log: [],
  };
  addAfdaSubscription(sub);
  onSubscriptionCreated?.(sub.source, sub.id);
  resetForm();
  onClose();
  toast({
    title: t('subscribeModal.toast.queued'),
    description: t('subscribeModal.toast.queuedDesc'),
    variant: 'default',
    duration: 3000,
  });
  if (!onSubscriptionCreated) {
    navigate('/skedulosa/subscription');
  }
  return;
}
// ── YouTube subscription (existing enqueue path below) ────────────
```

Also add `urlType`, `afdaWebsiteInfo`, and `getNextAfdaId` to the `useCallback` dependency array of `handleSubscribe`:

```tsx
], [
  channelName,
  sourceURL,
  selectedFrequency,
  selectedDays,
  saveToPath,
  defaultLocation,
  qualityPreset,
  checkAtHour,
  channelAnalysis,
  channelDetails,
  firstScrapeLimit,
  urlType,           // ← add
  afdaWebsiteInfo,   // ← add
  getNextAfdaId,     // ← add
  enqueue,
  onSubscriptionCreated,
  resetForm,
  onClose,
  navigate,
  t,
]);
```

#### Step 9: Update JSX — channel name input gate

- [ ] Find the conditional that shows the channel name input vs. URL input:

```tsx
{isValidUrl && channelAnalysis && analyzingStatus === 'idle' ? (
```

Replace with:

```tsx
{isValidUrl && (channelAnalysis || afdaWebsiteInfo) && analyzingStatus === 'idle' ? (
```

#### Step 10: Update JSX — add AFDA info card and schedule section

- [ ] Find the existing YouTube `ChannelInfo` block:

```tsx
{isValidUrl && channelAnalysis && (
  <div>
    <div className="mt-5">
      <ChannelInfo
        name={channelName}
        url={sourceURL}
        videoCount={channelAnalysis.videoCount}
        details={channelDetails}
        firstScrapeLimit={firstScrapeLimit}
        onFirstScrapeLimitChange={setFirstScrapeLimit}
      />
    </div>
    <div></div>
  </div>
)}
```

Add the AFDA info card **directly after** that block:

```tsx
{isValidUrl && afdaWebsiteInfo && urlType === 'afda' && (
  <div className="mt-5">
    <ChannelInfo
      name={channelName}
      url={sourceURL}
      videoCount={afdaWebsiteInfo.articleCount}
      details={null}
      firstScrapeLimit={firstScrapeLimit}
      onFirstScrapeLimitChange={setFirstScrapeLimit}
    />
  </div>
)}
```

- [ ] Find the YouTube schedule config section:

```tsx
{isValidUrl && channelAnalysis && analyzingStatus === 'idle' && (
  <div>
    <div className="mt-4 py-3 px-1 border-t-2 border-slate-200 dark:border-slate-700">
      <h1 className="text-gray-500 dark:text-gray-400 text-xs">
        {t('subscribeModal.basicConfig')}
      </h1>
      <div className="mt-5 flex items-center justify-between gap-2">
        ...auto/manual toggle...
      </div>
    </div>
    <div>
      {selectedFrequency === 'auto-detect' ? (
        <AutoDetect ... />
      ) : (
        <ManualFrequencyContent ... />
      )}
    </div>
  </div>
)}
```

Add the AFDA schedule section **directly after** that entire block (no auto/manual toggle — always manual):

```tsx
{isValidUrl && afdaWebsiteInfo && urlType === 'afda' && analyzingStatus === 'idle' && (
  <div>
    <div className="mt-4 py-3 px-1 border-t-2 border-slate-200 dark:border-slate-700">
      <h1 className="text-gray-500 dark:text-gray-400 text-xs">
        {t('subscribeModal.basicConfig')}
      </h1>
    </div>
    <div className="mt-2">
      <ManualFrequencyContent
        selectedDays={selectedDays}
        onSelectedDaysChange={setSelectedDays}
        saveToPath={saveToPath}
        onSelectDirectory={handleSelectDirectory}
        isSelectingDirectory={isSelectingDirectory}
        checkAtHour={checkAtHour}
        onCheckAtHourChange={setCheckAtHour}
        timezone={timezone}
        onTimezoneChange={setTimezone}
        qualityPreset={qualityPreset}
        onQualityPresetChange={setQualityPreset}
      />
    </div>
  </div>
)}
```

#### Step 11: Remove "+ Dummy Article" button from footer

- [ ] Find the footer's second row of buttons and delete the "+ Dummy Article" button:

```tsx
// DELETE THIS BUTTON:
<button
  type="button"
  onClick={handleAddDummyAfda}
  className="flex-1 max-w-[234px] text-xs bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 py-1 rounded-md opacity-60 hover:opacity-100"
>
  + Dummy Article
</button>
```

The second row in the footer will now contain only the "+ Dummy Channel" button. Adjust its `max-w` to fill the space:

```tsx
<button
  type="button"
  onClick={handleAddDummy}
  className="flex-1 max-w-[468px] text-xs bg-buttonBg dark:bg-darkModeCompliment border border-buttonBorder dark:border-darkModeCompliment text-black dark:text-gray-200 py-1 rounded-md opacity-60 hover:opacity-100"
>
  + Dummy Channel
</button>
```

#### Step 12: Run lint and verify

- [ ] Run: `yarn lint`

Expected: zero errors in `SkedulosaSubscribeModal.tsx`. The only acceptable warning is any pre-existing ones unrelated to this file.

#### Step 13: Smoke test manually

- [ ] Run `yarn start`, navigate to the Subscriptions page, open the Subscribe modal.
- [ ] Type `https://afda-test-news.com` — after ~800ms the spinner should appear, then:
  - Channel name field shows "AFDA Test News" (editable)
  - Info card shows article count (142), no avatar
  - Schedule config shows `ManualFrequencyContent` (days, time, quality, save path) — no auto/manual toggle
  - Subscribe button becomes active
- [ ] Click Subscribe — the modal closes, a toast appears, and the subscription list shows "AFDA Test News" with the "Article" badge.
- [ ] Click the new subscription row — `AfdaSelectedViewTable` opens with correct stats (142 articles in the stat card).
- [ ] Type a YouTube channel URL — confirm the existing YouTube flow still works end-to-end.
- [ ] Type `https://example.com` — confirm "unsupported platform" error still appears.

#### Step 14: Commit

```
git add src/skedulosa/components/SkedulosaSubscribeModal.tsx
git commit -m "feat: add AFDA URL-based website subscription flow to subscribe modal"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Adapter layer (3 files) ✓, `afdaTypes.ts` alignment ✓, `generateDummySubscription` fix ✓, `isAfdaUrl` helper ✓, `validateUrlFormat` pass-through ✓, `urlType` state ✓, `afdaWebsiteInfo` state ✓, AFDA analysis branch in useEffect ✓, `ChannelInfo` reuse ✓, always-manual schedule for AFDA ✓, `handleSubscribe` AFDA branch with `ABBREV_TO_DAY` ✓, remove Dummy Article button ✓, `resetForm` update ✓, downstream pages unaffected ✓
- [x] **Placeholders:** None — all code blocks are complete with exact field names.
- [x] **Type consistency:** `AfdaWebsiteInfo` defined in Task 1, re-exported from `afdaTypes.ts` in Task 2, imported in modal in Task 3. `section_details` shape uses `websiteName`/`websiteUrl`/`articleCount`/`sectionCount`/`site` consistently across `afdaTypes.ts`, `generateDummySubscription.ts`, and `handleSubscribe`. `ScheduleDay` imported from `skedulosaStore` and used in `ABBREV_TO_DAY` type annotation and `filter` type guard.
