# `max_articles_per_run` — Frontend Integration Guide

> Branch: `downlodr-ipc` | Added in commit `a32fbad`

## What it does

Each section can have an optional cap on how many articles are fetched and parsed per scrape run. When `max_articles_per_run` is set to a number, `ScrapeEngine` truncates the pending URL list to that count before Phase 2 begins. A `null` value means unlimited.

---

## Current status

The DB column and engine logic are in place, but **three backend gaps must be closed** before you can use this from the renderer. File a ticket or coordinate with the backend dev for each:

| # | File | What's missing |
|---|------|----------------|
| 1 | `src/storage.ts:917` | `'max_articles_per_run'` not in `ALLOWED_COLUMNS` — writes are silently dropped |
| 2 | `src/ipc-handlers.ts` | No IPC channel to set the value |
| 3 | `src/hydrate.ts` + `src/types.ts` | Field not mapped into the frontend `WebsiteSection` type |

---

## Backend changes needed

### 1. `src/storage.ts` — add to allowlist

```ts
const ALLOWED_COLUMNS = new Set([
  // ... existing columns ...
  'max_articles_per_run',   // ← add this
]);
```

### 2. `src/ipc-handlers.ts` — add a handler

```ts
register(
  'sections:set_max_articles',
  async (_event, payload: { section_id: number; max_articles_per_run: number | null }) => {
    storage.updateSection(payload.section_id, { max_articles_per_run: payload.max_articles_per_run });
    return { ok: true };
  },
);
```

### 3. `src/types.ts` — add to `WebsiteSection`

```ts
export interface WebsiteSection {
  // ... existing fields ...
  max_articles_per_run?: number | null;
}
```

### 4. `src/hydrate.ts` — map the column

Wherever `SectionRow` is mapped to `WebsiteSection`, add:

```ts
max_articles_per_run: row.max_articles_per_run ?? null,
```

---

## Renderer usage (after backend is wired)

### Set a cap

```ts
await window.electron.ipcRenderer.invoke('sections:set_max_articles', {
  section_id: 12,
  max_articles_per_run: 50,
});
```

### Remove the cap (unlimited)

```ts
await window.electron.ipcRenderer.invoke('sections:set_max_articles', {
  section_id: 12,
  max_articles_per_run: null,
});
```

### Read the current value

Once `hydrate.ts` is updated, the value is available on the `WebsiteSection` object pushed via `store:hydrate` / `store:hydrate:one`:

```ts
// Listen for hydration pushes
window.electron.ipcRenderer.on('store:hydrate', (_event, { websites }) => {
  for (const site of websites) {
    for (const section of site.sections) {
      console.log(section.id, section.max_articles_per_run); // number | null
    }
  }
});
```

---

## Notes

- `max_articles_per_run` lives on **sections**, not websites. You need a `section_id`.
- Passing `null` explicitly removes the cap — omitting the field does nothing.
- The cap applies to **new articles discovered in the current run** (the pending URL list), not to the total stored article count.
