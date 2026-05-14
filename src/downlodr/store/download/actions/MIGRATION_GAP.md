# Download Store → Actions Migration – What’s Missing

## 1. Store not wired to actions (critical)

**`downloadStore.ts` does not import or use any of the action creators.** All logic is still inline (roughly lines 291–1916). The action modules exist but are never called.

**To finish the migration:**

- In `downloadStore.ts`, inside `create<DownloadStore>()(persist((set, get) => { return { ... }; }))`:
  - Import the action creators from `./actions/*`.
  - Build the store by spreading the initial state and the return values of each `create*Actions(set, get)` (and resolve duplicates – see below).
- Remove the duplicated inline implementations of those methods from the store.

---

## 2. Naming bug in tags/categories actions

**File:** `actions/tagsCategoriesActions.ts`  
**Issue:** It exports `createLifecycleActions`, which collides with `lifecycleActions.ts` (which also exports `createLifecycleActions`).

**Fix:** Rename to `createTagsCategoriesActions` in `tagsCategoriesActions.ts` and update any imports.

---

## 3. Methods that exist only in the store (no action module yet)

These are still implemented only in `downloadStore.ts` and are used elsewhere:

| Method | Used in | Suggested action module |
|--------|--------|--------------------------|
| `updateDownloadTranscript` | `statusPageHandler.ts` | `lifecycleActions` or a small transcript helper |
| `updateDownloadStatus` | `CategoryTagPage.tsx`, `pluginAPI.ts`, `statusPageHandler.ts` | `lifecycleActions` or `crudActions` |
| `renameDownload` | `StatusPage.tsx` | `crudActions` |
| `testLocalStorage` | (debug) | Keep in store or add `debugActions.ts` |

So the migration is missing: **implementing these in the right action modules** and then wiring the store to use them from there.

---

## 4. Duplicate actions across modules

- **`removeFromQueue`** and **`clearQueue`** are implemented in both:
  - `crudActions.ts`
  - `queueActions.ts`

**Recommendation:** Keep queue behavior in one place (e.g. only in `queueActions`) and remove from `crudActions`, then have the store use the queue actions for these. Alternatively, keep them only in `crudActions` and remove from `queueActions`; decide one “owner” to avoid confusion.

- **`removeFailedDownload`** and **`clearFailedDownloads`** are in `crudActions`; the store also has them inline. Once the store is wired to `createCrudActions`, the inline versions can be removed.

---

## 5. Duplicate `handleCheckForUpdates`

- **`utils.ts`** exports `handleCheckForUpdates` (and `downloadActions.ts` already imports it from there).
- **`downloadStore.ts`** still defines its own local `handleCheckForUpdates` (around line 239).

**Fix:** In the store, remove the local implementation and import `handleCheckForUpdates` from `./utils` if the store still needs to call it directly. If the store only exposes it via `setDownload` (or other actions that already use the one from utils), the store’s local copy can be removed and no store import is needed.

---

## 6. Store interface vs payload types

The **`DownloadStore` interface** still uses long parameter lists for `addDownload` and `retryDownload` (and `addQueue`), while:

- `downloadPayloads.ts` already defines **`AddDownloadPayload`** and **`RetryDownloadPayload`**.
- `downloadActions.ts` already uses **`AddDownloadPayload`** and **RetryDownloadPayload** for `addDownload` and `retryDownload`.
- `queueActions.ts` uses a **`QueuedDownload`**-like payload for `addQueue`.

So the **store’s public interface** still doesn’t reflect the payload-based API. After wiring the store to the actions, you can:

- Change the store’s type so `addDownload`, `retryDownload`, and `addQueue` take the payload types, **or**
- Keep the current long signatures and have the store’s methods adapt (e.g. build a payload from the long args and call the action). Prefer the first option for consistency with the actions.

---

## 7. Actions not re-exported from the module

**`download/index.ts`** does not export anything from `./actions`. If you want to use or test the action creators from outside the store, add something like:

```ts
export {
  createCrudActions,
  createLifecycleActions,
  createDownloadActions,
  createQueueActions,
  createTagsCategoriesActions,  // after renaming
} from './actions';
```

You can also add an `actions/index.ts` that re-exports these and then export from `download/index.ts` via `./actions`.

---

## Summary checklist

- [ ] Wire `downloadStore.ts` to use `create*Actions(set, get)` and remove inline implementations for those methods.
- [ ] Rename `createLifecycleActions` → `createTagsCategoriesActions` in `tagsCategoriesActions.ts`.
- [ ] Add to action modules: `updateDownloadTranscript`, `updateDownloadStatus`, `renameDownload` (and optionally `testLocalStorage` in store or `debugActions`).
- [ ] Resolve duplicate `removeFromQueue` / `clearQueue` (single owner: either `queueActions` or `crudActions`).
- [ ] Remove duplicate `handleCheckForUpdates` from the store; use the one from `./utils`.
- [ ] Align store interface with payload types for `addDownload`, `retryDownload`, `addQueue`.
- [ ] Optionally export action creators from `download/index.ts` (or `actions/index.ts`).
