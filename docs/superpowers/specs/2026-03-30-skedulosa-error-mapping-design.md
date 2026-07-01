# Skedulosa Error Mapping — Design Spec

**Date:** 2026-03-30
**Status:** Approved

---

## Goal

Centralize all user-facing error messages in Skedulosa into a single mapping file. Components call one helper (`showSkedulosaError`) instead of writing `toast()` calls inline. No new packages. No runtime cost beyond what already exists.

---

## Architecture

### New file: `src/skedulosa/error-mapping/skedulosaErrors.ts`

A static module with two exports:

1. `SKEDULOSA_ERROR_MAP` — a frozen array of `{ pattern, title, description }` entries.
   - `pattern` is a `string` (substring) or `RegExp` matched against the incoming error key.
   - Entries cover all 38 errors from `ERRORS.md` (ERR-001 → ERR-038) plus four UI-level sentinel entries.
   - Defined once at module load. Never recomputed.

2. `showSkedulosaError(key: string)` — looks up the first matching entry and calls `toast()`.
   - Uses `String.includes()` for string patterns and `RegExp.test()` for regex patterns.
   - Falls back to a generic destructive toast that surfaces the raw key as the description if nothing matches.
   - Always uses `variant: 'destructive'` and `duration: 4000`.

**Performance:** Linear scan of ≤42 entries. Runs in microseconds. No state, no subscriptions, no re-renders. Zero additional cost over the existing direct `toast()` calls.

---

## UI-Level Sentinel Keys

These four short strings are used by components for errors that have no raw backend message:

| Sentinel | Replaces |
|---|---|
| `'missing-fields'` | `toast({ title: 'Missing fields', ... })` in `handleSubscribe` |
| `'paste-failed'` | `toast({ title: 'Paste failed', ... })` in clipboard handler |
| `'directory-failed'` | `toast({ title: 'Error', description: 'Failed to select directory' })` |
| `'pause-resume-failed'` | `toast({ title: 'Failed to ... subscription', ... })` in context menu |

---

## Components to Migrate

### `src/skedulosa/components/SkedulosaContextMenu.tsx`
- Remove `toast` import
- Replace the `toast({ ... })` in `handlePauseResume` catch block with `showSkedulosaError('pause-resume-failed')`

### `src/skedulosa/components/SkedulosaSubscribeModal.tsx`
- Remove `toast` import (if no other uses remain)
- Replace `toast(...)` in `handleSubscribe` with `showSkedulosaError('missing-fields')`
- Replace `toast(...)` in `handleSelectDirectory` catch with `showSkedulosaError('directory-failed')`
- Replace `toast(...)` in clipboard paste catch with `showSkedulosaError('paste-failed')`

---

## What Is Not Changed

- `SkedulosaLayout.tsx` — layout stays layout-only; the ErrorBoundary there handles uncaught crashes, not caught errors
- Inline `urlError` state in `SkedulosaSubscribeModal` — that drives inline field validation UI, not toasts; left alone
- Any `console.error` calls — those stay for developer debugging

---

## File Structure

```
src/skedulosa/error-mapping/
  ERRORS.md               (existing — reference document)
  skedulosaErrors.ts      (new — the map + helper)
```
