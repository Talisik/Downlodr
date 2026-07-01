# Article Site Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route CNN and Manila Bulletin URLs through the article flow in `TaskbarInputField`, replacing the old keyword-based detection and the standalone article input in `Taskbar.tsx`.

**Architecture:** A new pure util `articleSiteDetection.ts` exports `isArticleSiteUrl` and a domain allowlist. `TaskbarInputField.tsx` swaps its import from the old `isArticleKeyword` to `isArticleSiteUrl`, inserting the check inside the existing `http/https` validation branch. The article input UI in `Taskbar.tsx` is commented out.

**Tech Stack:** TypeScript, React, Zustand (`useAfdaStore`), Vite (no root-level test runner for renderer code — use `npx tsc --noEmit` for type-checking)

---

## File Map

| File | Action |
|------|--------|
| `src/afda/utils/articleSiteDetection.ts` | **Create** |
| `src/afda/utils/articleDetection.ts` | Leave on disk (becomes unused) |
| `src/downlodr/components/base/InputField/TaskbarInputField.tsx` | **Modify** — swap import + update `validateUrl` |
| `src/downlodr/components/base/Taskbar.tsx` | **Modify** — comment out article input UI |

---

### Task 1: Create `articleSiteDetection.ts`

**Files:**
- Create: `src/afda/utils/articleSiteDetection.ts`

- [ ] **Step 1: Create the file with domain allowlist and detection function**

```ts
export const ARTICLE_SITE_DOMAINS: string[] = [
  'cnn.com',
  'manilabulletin.com',
];

export const isArticleSiteUrl = (url: string): boolean => {
  if (!url.startsWith('http://') && !url.startsWith('https://')) return false;
  try {
    const { hostname } = new URL(url);
    return ARTICLE_SITE_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
};
```

- [ ] **Step 2: Verify TypeScript compiles cleanly**

Run from the repo root:
```
npx tsc --noEmit
```
Expected: no errors referencing `articleSiteDetection.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/afda/utils/articleSiteDetection.ts
git commit -m "feat(afda): add article site detection util for CNN and Manila Bulletin"
```

---

### Task 2: Update `TaskbarInputField.tsx`

**Files:**
- Modify: `src/downlodr/components/base/InputField/TaskbarInputField.tsx`

- [ ] **Step 1: Replace the import**

Find this line near the top of the file (~line 3):
```ts
import { isArticleKeyword } from '@/afda/utils/articleDetection';
```

Replace with:
```ts
import { isArticleSiteUrl } from '@/afda/utils/articleSiteDetection';
```

- [ ] **Step 2: Update `validateUrl` — move article check inside the `http/https` branch**

Current code in `validateUrl` (~line 227):
```ts
const validateUrl = (url: string) => {
  // Article keyword/URL detected — light up the download icon, don't open panel yet
  if (isArticleKeyword(url)) {
    setIsArticle(true);
    clearSearch();
    return;
  }

  // Check if the URL starts with http or https to determine if it's a valid URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    if (!urlPattern.test(url)) {
```

Replace with:
```ts
const validateUrl = (url: string) => {
  // Check if the URL starts with http or https to determine if it's a valid URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // Article site URL detected — light up the download icon, don't open panel yet
    if (isArticleSiteUrl(url)) {
      setIsArticle(true);
      clearSearch();
      return;
    }

    if (!urlPattern.test(url)) {
```

- [ ] **Step 3: Verify TypeScript compiles cleanly**

```
npx tsc --noEmit
```
Expected: no errors. Confirm no remaining references to `isArticleKeyword` in this file.

- [ ] **Step 4: Smoke-test manually**

Start the dev server (`npm start`), paste `https://www.cnn.com/2024/01/01/politics/some-article` into the taskbar input. Confirm:
- The download button highlights (article mode active)
- Clicking it opens the AFDA side panel (calls `fetchAndOpen`)
- A YouTube URL (`https://www.youtube.com/watch?v=dQw4w9WgXcQ`) does NOT trigger article mode

- [ ] **Step 5: Commit**

```bash
git add src/downlodr/components/base/InputField/TaskbarInputField.tsx
git commit -m "feat(taskbar): route CNN and Manila Bulletin URLs through article flow"
```

---

### Task 3: Comment out article input in `Taskbar.tsx`

**Files:**
- Modify: `src/downlodr/components/base/Taskbar.tsx`

- [ ] **Step 1: Comment out the article input container**

Locate the block starting around line 711 that looks like:
```tsx
<div className="flex-1 flex items-center justify-center mx-4">
  <div className="flex items-center bg-gray-100 dark:bg-darkModeCompliment rounded-lg px-3 py-1 max-w-md w-full">
    <input
      type="text"
      placeholder="Paste article URL to analyze..."
      ...
    />
    <button
      className="ml-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
      onClick={() => { ... }}
    >
      📄
    </button>
  </div>
</div>
```

Wrap the entire outer `<div>` (from `<div className="flex-1 flex items-center...">` through its closing `</div>`) in a JSX comment:
```tsx
{/* ARTICLE INPUT MOVED TO TaskbarInputField — kept for reference
<div className="flex-1 flex items-center justify-center mx-4">
  <div className="flex items-center bg-gray-100 dark:bg-darkModeCompliment rounded-lg px-3 py-1 max-w-md w-full">
    <input
      type="text"
      placeholder="Paste article URL to analyze..."
      className="flex-1 bg-transparent outline-none text-sm placeholder-gray-500 dark:placeholder-gray-400"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.currentTarget.value.trim()) {
          const url = e.currentTarget.value.trim();
          useAfdaStore.getState().fetchAndOpen(url);
          e.currentTarget.value = '';
        }
      }}
    />
    <button
      className="ml-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
      onClick={() => {
        const input = document.querySelector('input[placeholder="Paste article URL to analyze..."]') as HTMLInputElement;
        if (input?.value.trim()) {
          const url = input.value.trim();
          useAfdaStore.getState().fetchAndOpen(url);
          input.value = '';
        }
      }}
    >
      📄
    </button>
  </div>
</div>
*/}
```

- [ ] **Step 2: Verify TypeScript compiles cleanly and UI renders**

```
npx tsc --noEmit
```
Expected: no errors. Start `npm start` and confirm the taskbar no longer shows the "Paste article URL to analyze..." input.

- [ ] **Step 3: Commit**

```bash
git add src/downlodr/components/base/Taskbar.tsx
git commit -m "ui(taskbar): comment out standalone article input (moved to TaskbarInputField)"
```
