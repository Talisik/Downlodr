# AFDA Website Subscription — Modal Flow Design

**Date:** 2026-05-05  
**Files touched:**
- Create: `src/afda/backend/schema/afdaWebsiteSchema.ts`
- Create: `src/afda/backend/dummy/afdaWebsiteMock.ts`
- Create: `src/afda/backend/afdaWebsiteService.ts`
- Modify: `src/afda/types/afdaTypes.ts` — align `section_details` type with new schema
- Modify: `src/skedulosa/utils/generateDummySubscription.ts` — update `section_details` shape in `generateDummyAfdaSubscription`
- Modify: `src/skedulosa/components/SkedulosaSubscribeModal.tsx`

**Scope:** Add URL-based AFDA website detection to the subscribe modal, mirroring the YouTube channel subscription flow. Hardcoded mock data for `afda-test-news.com` is isolated in a dedicated adapter layer for easy swap when the real package arrives.

---

## Context

Users have two AFDA entry points:
- **Single article download** → `TaskbarInputField.tsx` (not touched here)
- **Website subscription** → `SkedulosaSubscribeModal.tsx` (this spec)

The modal currently only supports YouTube channel URLs. This spec adds `afda-test-news.com` as the first recognized AFDA website domain.

---

## Architecture — Three-Layer Adapter

```
SkedulosaSubscribeModal (UI)
  └─ afdaWebsiteService.ts     ← single swap point for real package
       └─ afdaWebsiteMock.ts   ← hardcoded dummy data, isolated
            afdaWebsiteSchema.ts ← shared types
```

**Why this structure:** When the real AFDA package lands, only `afdaWebsiteService.ts` needs to change — the modal and mock file are untouched. The mock file is never imported by the modal directly, only through the service.

---

## New Files

### `src/afda/backend/schema/afdaWebsiteSchema.ts`

```ts
export interface AfdaWebsiteInfo {
  websiteName: string;
  websiteUrl: string;
  articleCount: number;
  sectionCount: number;
  site: string;          // hostname, e.g. "afda-test-news.com"
}
```

### `src/afda/backend/dummy/afdaWebsiteMock.ts`

Contains a single hardcoded mock response keyed by hostname. No logic — pure data.

```ts
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

### `src/afda/backend/afdaWebsiteService.ts`

Single exported function. Currently resolves mock data. Replace body when real package is ready — signature stays the same.

```ts
import type { AfdaWebsiteInfo } from './schema/afdaWebsiteSchema';
import { AFDA_WEBSITE_MOCKS } from './dummy/afdaWebsiteMock';

const SIMULATED_DELAY_MS = 600;

export async function fetchAfdaWebsiteInfo(url: string): Promise<AfdaWebsiteInfo | null> {
  await new Promise((r) => setTimeout(r, SIMULATED_DELAY_MS));
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return AFDA_WEBSITE_MOCKS[hostname] ?? null;
  } catch {
    return null;
  }
}

// Re-export type so callers don't need a second import
export type { AfdaWebsiteInfo };
```

Returns `null` if the hostname isn't in the mock registry (graceful fallback).

---

## Modified File: `src/afda/types/afdaTypes.ts`

Replace the `AfdaSectionDetails` interface and the `section_details` field on `AfdaSubscription` to use `AfdaWebsiteInfo` directly. This makes the service schema the single source of truth for website-level data across the store, the modal, and both display pages.

**Remove:**
```ts
export interface AfdaSectionDetails {
  sectionName: string;
  sectionUrl: string;
  articleCount?: number;
  site?: string;
}
```

**Replace `section_details` on `AfdaSubscription`:**
```ts
// before
section_details?: AfdaSectionDetails;

// after
section_details?: AfdaWebsiteInfo;  // imported from @/afda/backend/schema/afdaWebsiteSchema
```

**Impact on consumers:**
- `AfdaSelectedViewTable` reads `section_details.articleCount` and `section_details.site` — both fields exist on `AfdaWebsiteInfo` with the same names, so no JSX changes needed.
- `afdaSubscriptionToScheduledChannel` does not read `section_details` — not affected.
- `generateDummyAfdaSubscription` populates `section_details` with `sectionName`/`sectionUrl`/`articleCount`/`site` — update to use `websiteName`/`websiteUrl`/`articleCount`/`sectionCount`/`site` to match the new shape.

---

## Modified File: `SkedulosaSubscribeModal.tsx`

### 1. AFDA host detection helper

Add alongside `isYouTubeUrl`:

```ts
const AFDA_HOSTS = ['afda-test-news.com'];

const isAfdaUrl = (url: string): boolean => {
  try {
    return AFDA_HOSTS.includes(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
};
```

### 2. `validateUrlFormat` update

Current logic rejects all non-YouTube URLs with "unsupported platform". Add an AFDA pass-through before that check:

```ts
if (isAfdaUrl(raw.trim())) return null; // valid — AFDA website
```

### 3. New state

```ts
const [urlType, setUrlType] = useState<'youtube' | 'afda' | null>(null);
const [afdaWebsiteInfo, setAfdaWebsiteInfo] = useState<AfdaWebsiteInfo | null>(null);
```

### 4. Analysis `useEffect` branching

In the existing 800ms debounce `useEffect`, after format validation passes, branch on URL type:

- **AFDA path:** call `fetchAfdaWebsiteInfo(url)`, set `afdaWebsiteInfo`, set `urlType = 'afda'`, set `isValidUrl = true`. No bridge calls.
- **YouTube path:** existing logic unchanged. Set `urlType = 'youtube'`.
- On clear/error: reset `urlType = null`, `afdaWebsiteInfo = null`.

### 5. `ChannelInfo` reuse for AFDA

When `urlType === 'afda'` and `afdaWebsiteInfo !== null`, render `ChannelInfo` with:
- `name` = `afdaWebsiteInfo.websiteName`
- `videoCount` = `afdaWebsiteInfo.articleCount`
- `details` = `null` (no avatar/subscriber row)
- `url` = `sourceURL`

No new component needed — `ChannelInfo` already handles `details = null` gracefully.

### 6. Schedule config — AFDA always manual

When `urlType === 'afda'`, hide the auto/manual frequency toggle and always render `ManualFrequencyContent`. Auto-detect is YouTube-only (requires bridge analysis).

### 7. `handleSubscribe` branch

`selectedDays` holds abbreviated values (`'mon'`, `'tue'`, etc.). A reverse lookup is needed to convert to `ScheduleDay` full names before building the subscription:

```ts
const ABBREV_TO_DAY: Record<string, ScheduleDay> = {
  sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday',
  thu: 'Thursday', fri: 'Friday', sat: 'Saturday',
};
```

```ts
if (urlType === 'afda' && afdaWebsiteInfo) {
  const sub: AfdaSubscription = {
    id: `afda-${Date.now()}`,
    source_type: 'afda',
    downloads: [],
    schedule_time: selectedDays
      .map((d) => ABBREV_TO_DAY[d])
      .filter(Boolean)
      .map((day) => ({ day, time_minutes: parseInt(checkAtHour) * 60 })),
    last_checked_time: new Date().toISOString(),
    source: afdaWebsiteInfo.websiteName,
    sourceUrl: sourceURL.trim(),
    recurring: true,
    status: 'Active',
    date_created: new Date().toISOString(),
    upload_cadence: 'Daily',
    settings: [{ frequency: 'Daily', download_quality: qualityPreset, save_location: saveToPath, download_priority: 'normal', lookback_period: '7 days', file_naming_format: '%(title)s.%(ext)s' }],
    section_details: {
      websiteName: afdaWebsiteInfo.websiteName,
      websiteUrl: sourceURL.trim(),
      articleCount: afdaWebsiteInfo.articleCount,
      sectionCount: afdaWebsiteInfo.sectionCount,
      site: afdaWebsiteInfo.site,
    },
    activity_log: [],
  };
  addAfdaSubscription(sub);
  resetForm();
  onClose();
  navigate('/skedulosa/subscription');
  return;
}
// else: existing YouTube enqueue path
```

### 8. Remove "Dummy Article" button

The `handleAddDummyAfda` handler and "+ Dummy Article" footer button are removed. The real AFDA URL flow replaces this.

### 9. `resetForm` update

Add resets for new state:
```ts
setUrlType(null);
setAfdaWebsiteInfo(null);
```

---

## Downstream Compatibility — No Changes Required

The following files are **not touched** by this spec; they already handle AFDA subscriptions correctly:

| File | Why it works |
|------|-------------|
| `SkedulosaSubscriptionPage.tsx` | Already merges `afdaSubscriptions` via `afdaSubscriptionToScheduledChannel`, shows "Article" badge, navigates to `/skedulosa/selected-article/:id` |
| `App.tsx` | Already routes `/skedulosa/selected-article/:channelId` → `AfdaSelectedViewTable` |
| `AfdaSelectedViewTable.tsx` | Reads from `useAfdaSubscriptionsStore` directly — needs only a valid `AfdaSubscription` in the store |

As long as `addAfdaSubscription` is called with a correctly shaped `AfdaSubscription` (all required fields present), the subscription will appear in the list with the "Article" badge and open `AfdaSelectedViewTable` on click.

**Required fields verified against consumers:**
- `afdaSubscriptionToScheduledChannel` needs: `id`, `source`, `sourceUrl`, `schedule_time`, `status`, `settings[0]`, `downloads`, `last_checked_time`, `date_created` — all populated by `handleSubscribe`
- `AfdaSelectedViewTable` needs: `source`, `sourceUrl`, `status`, `downloads`, `section_details.articleCount`, `section_details.site`, `date_created`, `last_checked_time` — all populated from `afdaWebsiteInfo`

---

## Out of Scope

- Connecting to a real AFDA package bridge — mock only for now.
- Supporting additional AFDA domains beyond `afda-test-news.com`.
- Single article download flow (`TaskbarInputField`) — not touched.
- Auto-detect schedule analysis for AFDA — deferred until bridge exists.
