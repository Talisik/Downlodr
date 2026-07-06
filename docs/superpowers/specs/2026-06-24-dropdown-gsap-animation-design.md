# Dropdown GSAP Animation Design

**Date:** 2026-06-24
**Branch:** fix/context-menu

## Overview

Add GSAP open/close animations to the three dropdown surfaces in the app:
- File / Help menus in `DropDownbar.tsx`
- AdditionalOptions panel in `TaskbarInputField.tsx`
- FolderDirectory panel in `TaskbarInputField.tsx`

All three currently mount/unmount instantly with no transition. This adds a subtle pop-in on open and a matching fade-out on close before unmount.

## New Hook

**File:** `src/core-app/hooks/animation/useDropdownAnimation.ts`

Mirrors the shape of `useModalAnimation` but tuned for small menus:

```ts
useDropdownAnimation(visible: boolean): { ref: RefObject<HTMLDivElement>, mounted: boolean }
```

- **Open** (when `visible` flips true): `opacity 0→1`, `scale 0.97→1`, `y -4→0`, duration 0.15s, ease `power2.out`
- **Close** (when `visible` flips false): reverse (`opacity→0`, `scale→0.97`, `y→-4`), duration 0.1s, ease `power2.in` → `setMounted(false)` in `onComplete`
- Uses `useLayoutEffect` for the first-render snap (no flash) and `useEffect` for subsequent visibility changes
- `mounted` starts as `visible`; set to `true` when `visible` goes true, set to `false` only after the close animation completes

## Changes

### `DropDownbar.tsx`

Two `useDropdownAnimation` call sites:

```tsx
const { ref: fileRef, mounted: fileMounted } = useDropdownAnimation(activeMenu === 'file');
const { ref: helpRef, mounted: helpMounted } = useDropdownAnimation(activeMenu === 'help');
```

Replace:
- `{activeMenu === 'file' && <div className="absolute ...">}` → `{fileMounted && <div ref={fileRef} className="absolute ...">}`
- `{activeMenu === 'help' && <div className="absolute ...">}` → `{helpMounted && <div ref={helpRef} className="absolute ...">}`

No other logic changes.

### `TaskbarInputField.tsx`

Two `useDropdownAnimation` call sites:

```tsx
const { ref: additionalOptionsRef, mounted: additionalOptionsMounted } =
  useDropdownAnimation(activeButton === 'settings' && isAdditionalOptionsOpen);

const { ref: folderRef, mounted: folderMounted } =
  useDropdownAnimation(activeButton === 'folder');
```

Replace:
- `{activeButton === 'settings' && isAdditionalOptionsOpen && <AdditionalOptions .../>}` →
  `{additionalOptionsMounted && <div ref={additionalOptionsRef}><AdditionalOptions .../></div>}`
- `{activeButton === 'folder' && <FolderDirectory />}` →
  `{folderMounted && <div ref={folderRef}><FolderDirectory /></div>}`

### `AdditionalOptions.tsx` / `FolderDirectory.tsx`

No changes. The ref wrapper div in TaskbarInputField targets the hook ref, so these components stay untouched.

## Consistency

This aligns with the existing animation hooks in `src/core-app/hooks/animation/`:
- `useContextMenuAnimation` — open-only pop-in (nearest precedent)
- `useModalAnimation` — open/close with mounted lifecycle gate (structural template)
- `useSlidePanel` — open/close with mounted gate (second structural reference)

The new hook follows the same file location, naming convention, and lifecycle pattern.
