# Article Site Detection — Design Spec

**Date:** 2026-05-11
**Branch:** feat/afda-ui

## Goal

Move the "paste article URL to analyze" functionality from the dedicated input in `Taskbar.tsx` into the existing main `TaskbarInputField`. Trigger the article flow automatically when the pasted URL belongs to a known article site (CNN, Manila Bulletin), using a new dedicated util file for detection.

## Approach

Option C: new util file replaces old keyword-based detection, old Taskbar input commented out.

---

## Section 1 — New Util: `articleSiteDetection.ts`

**File:** `src/afda/utils/articleSiteDetection.ts`

Exports:
- `ARTICLE_SITE_DOMAINS: string[]` — allowlist of known article domains (`cnn.com`, `manilabulletin.com`)
- `isArticleSiteUrl(url: string): boolean` — returns `true` if the URL's hostname ends with any entry in the allowlist

Behavior:
- Only processes `http://` or `https://` URLs — anything else returns `false` immediately
- Uses `new URL(url).hostname` for parsing; wraps in try/catch, returns `false` on parse failure
- Matches subdomains: `www.cnn.com`, `edition.cnn.com` all match `cnn.com`

`articleDetection.ts` is left on disk but unused (no imports removed from it, its import in `TaskbarInputField` is replaced).

---

## Section 2 — `TaskbarInputField.tsx` changes

**File:** `src/downlodr/components/base/InputField/TaskbarInputField.tsx`

- Remove import of `isArticleKeyword` from `@/afda/utils/articleDetection`
- Add import of `isArticleSiteUrl` from `@/afda/utils/articleSiteDetection`
- In `validateUrl`, inside the `url.startsWith('http')` branch, after the URL format check passes and before YouTube/video routing: call `isArticleSiteUrl(url)`. If `true`, set `isArticle = true`, call `clearSearch()`, and return early
- All downstream article behavior (`isArticle` state, `handleDownload` article branch, button tooltip/disabled state) is unchanged

Data flow preserved:
1. User pastes CNN/Manila Bulletin URL → `isArticleSiteUrl` returns `true` → `isArticle = true`
2. User clicks download button or presses Enter → `handleDownload` → `fetchAndOpenArticle(videoUrl)` → AFDA side panel opens with fetched article

---

## Section 3 — `Taskbar.tsx` cleanup

**File:** `src/downlodr/components/base/Taskbar.tsx`

- Comment out the "paste article URL to analyze" `<input>` element and its accompanying `📄` `<button>` and their wrapping container `<div>` (approx lines 711–740)
- No other changes to `Taskbar.tsx`

---

## Files Touched

| File | Change |
|------|--------|
| `src/afda/utils/articleSiteDetection.ts` | **Create** — new domain detection util |
| `src/afda/utils/articleDetection.ts` | No change (left on disk, becomes unused) |
| `src/downlodr/components/base/InputField/TaskbarInputField.tsx` | Update import + `validateUrl` logic |
| `src/downlodr/components/base/Taskbar.tsx` | Comment out article input UI |

---

## Out of Scope

- Adding more article sites (the allowlist constant makes this trivial later)
- Any changes to `afdaStore`, `fetchAndOpen`, or the AFDA side panel
- Removing `articleDetection.ts` from disk
