# ModeToggle GSAP Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace CSS transitions on the ModeToggle Sun/Moon icon swap with GSAP scale-pop animations, and add GSAP open/close animation to the dropdown panel.

**Architecture:** Create a new `useIconToggleAnimation` hook (mirrors `useDropdownAnimation` structure) that owns all Sun/Moon transform state via GSAP. `ModeToggle.tsx` composes both hooks — one for the icons, one for the dropdown — and strips all CSS transition classes from the icons.

**Tech Stack:** GSAP 3, React 18, TypeScript, Lucide React (SVG icon refs via `forwardRef`)

## Global Constraints

- No new dependencies — GSAP is already installed
- Follow the existing animation hook pattern in `src/core-app/hooks/animation/`
- No unit tests for animation hooks — visual verification via running the app is the test method used in this project
- Keep all existing click-outside and window-blur behavior intact

---

### Task 1: Create `useIconToggleAnimation` hook

**Files:**
- Create: `src/core-app/hooks/animation/useIconToggleAnimation.ts`

**Interfaces:**
- Consumes: `theme: string` (value from `useTheme()` — one of `'light' | 'dark' | 'system'`)
- Produces:
  ```ts
  function useIconToggleAnimation(theme: string): {
    sunRef: RefObject<SVGSVGElement>;
    moonRef: RefObject<SVGSVGElement>;
  }
  ```

- [ ] **Step 1: Create the hook file**

Create `src/core-app/hooks/animation/useIconToggleAnimation.ts` with the following content:

```ts
import gsap from 'gsap';
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

export function useIconToggleAnimation(theme: string): {
  sunRef: RefObject<SVGSVGElement>;
  moonRef: RefObject<SVGSVGElement>;
} {
  const sunRef = useRef<SVGSVGElement>(null);
  const moonRef = useRef<SVGSVGElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    const sun = sunRef.current;
    const moon = moonRef.current;
    if (!sun || !moon) return;

    const isDark =
      theme === 'dark' ||
      (theme === 'system' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (!initialized.current) {
      initialized.current = true;
      if (isDark) {
        gsap.set(sun, { scale: 0, opacity: 0 });
        gsap.set(moon, { scale: 1, opacity: 1 });
      } else {
        gsap.set(sun, { scale: 1, opacity: 1 });
        gsap.set(moon, { scale: 0, opacity: 0 });
      }
      return;
    }

    gsap.killTweensOf([sun, moon]);

    const outgoing = isDark ? sun : moon;
    const incoming = isDark ? moon : sun;

    gsap.to(outgoing, { scale: 0, opacity: 0, duration: 0.12, ease: 'power2.in' });
    gsap.fromTo(
      incoming,
      { scale: 0, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.2, ease: 'back.out(1.8)', delay: 0.1 },
    );
  }, [theme]);

  return { sunRef, moonRef };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors on the new file

- [ ] **Step 3: Commit**

```bash
git add src/core-app/hooks/animation/useIconToggleAnimation.ts
git commit -m "feat: add useIconToggleAnimation hook for GSAP icon swap"
```

---

### Task 2: Update `ModeToggle.tsx` to use both animation hooks

**Files:**
- Modify: `src/downlodr/components/base/ModeToggle.tsx`

**Interfaces:**
- Consumes from Task 1:
  ```ts
  import { useIconToggleAnimation } from '../../../core-app/hooks/animation/useIconToggleAnimation';
  // returns { sunRef: RefObject<SVGSVGElement>, moonRef: RefObject<SVGSVGElement> }
  ```
- Consumes existing:
  ```ts
  import { useDropdownAnimation } from '../../../core-app/hooks/animation/useDropdownAnimation';
  // returns { ref: RefObject<HTMLDivElement>, mounted: boolean }
  ```

- [ ] **Step 1: Replace the full file content**

Overwrite `src/downlodr/components/base/ModeToggle.tsx` with:

```tsx
/**
 * A custom React component
 * A React component that toggles between light and dark themes.
 * It displays a button with icons for light and dark modes.
 *
 * @returns JSX.Element - The rendered mode toggle component.
 */

import { Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../core-app/components/shadcn/components/ui/button';
import { useTheme } from '../../../core-app/components/ThemeProvider';
import { useDropdownAnimation } from '../../../core-app/hooks/animation/useDropdownAnimation';
import { useIconToggleAnimation } from '../../../core-app/hooks/animation/useIconToggleAnimation';

export function ModeToggle() {
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { sunRef, moonRef } = useIconToggleAnimation(theme);
  const { ref: animRef, mounted } = useDropdownAnimation(isOpen);

  useEffect(() => {
    const handleWindowBlur = () => setIsOpen(false);
    window.addEventListener('blur', handleWindowBlur);
    return () => window.removeEventListener('blur', handleWindowBlur);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        className="hover:bg-gray-100 dark:bg-transparent dark:hover:bg-darkModeCompliment hover:opacity-100 active:bg-transparent focus-none p-1 my-4"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="relative flex items-center justify-center">
          <Sun
            ref={sunRef}
            className="absolute h-[1rem] w-[1rem] text-text-paragraph"
          />
          <Moon
            ref={moonRef}
            className="absolute h-[1rem] w-[1rem] text-text-paragraph"
          />
        </span>
        <span className="sr-only">Toggle theme</span>
      </Button>

      {mounted && (
        <div
          ref={animRef}
          className="fixed right-[inherit] w-[85px] rounded-md bg-white dark:bg-darkModeCompliment shadow-lg ring-1 ring-black ring-opacity-5 z-[100]"
        >
          <div className="py-1 gap-1" role="menu">
            <button
              className="font-semibold rounded-md w-[80%] mx-2 block px-2 py-1.5 text-[12px] text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-darkModeHover"
              onClick={() => {
                setTheme('light');
                setIsOpen(false);
              }}
            >
              Light
            </button>
            <button
              className="font-semibold rounded-md mx-2 block w-[80%] px-2 py-1.5 text-[12px] text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-darkModeHover"
              onClick={() => {
                setTheme('dark');
                setIsOpen(false);
              }}
            >
              Dark
            </button>
            <button
              className="font-semibold rounded-md mx-2 block w-[80%] px-2 py-1.5 text-[12px] text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-darkModeHover"
              onClick={() => {
                setTheme('system');
                setIsOpen(false);
              }}
            >
              System
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Run the app and verify visually**

Start the app and open the TitleBar. Check:
1. On load — correct icon is visible (Sun in light mode, Moon in dark mode), no flash
2. Open dropdown — panel slides in (opacity + scale + y) smoothly
3. Close dropdown — panel slides out before unmounting
4. Switch Light → Dark — Sun scales + fades out, Moon pops in with slight overshoot
5. Switch Dark → Light — Moon scales + fades out, Sun pops in with slight overshoot
6. Rapid theme switching — no stuck states (GSAP killTweensOf prevents stacking)

- [ ] **Step 4: Commit**

```bash
git add src/downlodr/components/base/ModeToggle.tsx
git commit -m "feat: add GSAP animations to ModeToggle icon swap and dropdown"
```
