# ModeToggle GSAP Animation Design

**Date:** 2026-06-24
**Status:** Approved

## Summary

Replace CSS transitions on the Sun/Moon icon toggle with GSAP animations, and add GSAP-controlled open/close animation to the ModeToggle dropdown. Consistent with the project's existing animation hook pattern.

## Scope

- `src/core-app/hooks/animation/useIconToggleAnimation.ts` — new hook
- `src/downlodr/components/base/ModeToggle.tsx` — consume both hooks, strip CSS transition classes

## Architecture

### New hook: `useIconToggleAnimation`

**Location:** `src/core-app/hooks/animation/useIconToggleAnimation.ts`

**Signature:**
```ts
function useIconToggleAnimation(theme: string): {
  sunRef: RefObject<SVGSVGElement>;
  moonRef: RefObject<SVGSVGElement>;
}
```

**Behavior:**

- On mount: sets initial icon visibility without animation (sun visible in light/system-light, moon visible in dark/system-dark). Uses `gsap.set` to establish the starting state.
- On theme change: sequences two tweens:
  1. **Outgoing icon** — `gsap.to`: `{ scale: 0, opacity: 0, duration: 0.12, ease: 'power2.in' }`
  2. **Incoming icon** — `gsap.fromTo`: from `{ scale: 0, opacity: 0 }` to `{ scale: 1, opacity: 1, duration: 0.2, ease: 'back.out(1.8)' }`, delayed to start after the outgoing tween completes
- `system` theme resolves OS preference via `window.matchMedia('(prefers-color-scheme: dark)').matches`
- Kills any in-flight tweens on the icon elements before starting a new sequence (`gsap.killTweensOf`)

### ModeToggle changes

**Composing both hooks:**
```tsx
const { sunRef, moonRef } = useIconToggleAnimation(theme);
const { ref: animRef, mounted } = useDropdownAnimation(isOpen);
```

**Icon markup — CSS classes removed:**
- Remove: `transition-transform duration-300`, `dark:rotate-90 dark:scale-0`, `scale-0 dark:rotate-0 dark:scale-100`
- GSAP owns all transform/opacity state on these elements

**Dropdown markup:**
- Replace `{isOpen && <div>...</div>}` with `{mounted && <div ref={animRef}>...</div>}`
- The outer `<div ref={dropdownRef}>` (click-outside handler) is unchanged

**Theme read:**
- Destructure `theme` alongside `setTheme` from `useTheme()` so `useIconToggleAnimation` can watch it

## Animation Specs

| Surface | Trigger | Out | In |
|---|---|---|---|
| Sun/Moon icon | theme change | scale→0, opacity→0, 0.12s, power2.in | scale 0→1 (overshoot via back.out(1.8)), opacity 0→1, 0.2s |
| Dropdown panel | isOpen toggle | opacity→0, scale→0.97, y→-4, 0.1s, power2.in | opacity 0→1, scale 0.97→1, y -4→0, 0.15s, power2.out |

## What is NOT changing

- Click-outside and window-blur handlers in ModeToggle
- Theme options (Light / Dark / System)
- Button markup and styling
- `useDropdownAnimation` hook internals
