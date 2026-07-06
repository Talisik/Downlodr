# Onboarding Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an auto-starting react-joyride guided tour to the onboarding page that walks users through the Video Download demo in 7 steps.

**Architecture:** A new `OnboardingTour` component wraps react-joyride in controlled mode (we manage `stepIndex` in React state). It receives `active: OnboardingFeature` and `demoStarted: boolean` from `OnboardingLayout`, starts automatically when active is `VideoDownload`, and auto-advances past the "click download" step when `demoStarted` flips to true. Steps live in `useOnboardingTour.ts` keyed by `OnboardingFeature` — adding future feature tours is just adding a new key.

**Tech Stack:** react-joyride, React 18, TypeScript, Tailwind CSS, Framer Motion (already installed).

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/onboarding/hooks/useOnboardingTour.ts` | **Create** | Tour steps per feature |
| `src/onboarding/components/OnboardingTour.tsx` | **Create** | Joyride wrapper + custom TourTooltip |
| `src/onboarding/components/shared/DemoToolbar.tsx` | Modify | Add `id="demo-toolbar-controls"` |
| `src/onboarding/components/shared/DemoInputField.tsx` | Modify | Add `id="demo-download-btn"` to download icon wrapper |
| `src/onboarding/components/shared/DemoStatusTable.tsx` | Modify | Add `rowId` + `playBtnId` props to `VideoRow`; pass them for VideoDownload |
| `src/onboarding/components/OnboardingPill.tsx` | Modify | Add `id="onboarding-pill"` to outer `motion.div` |
| `src/onboarding/components/OnboardingLayout.tsx` | Modify | Render `<OnboardingTour>` |

---

## Tour Steps Reference

| # | Index | Target | Content | Notes |
|---|-------|--------|---------|-------|
| 1 | 0 | `body` (center) | Welcome to Downlodr! | placement: center, no beacon |
| 2 | 1 | `#demo-toolbar-controls` | Start/stop controls | |
| 3 | 2 | `#taskbar-input-field` | URL input + settings/folder icons | |
| 4 | 3 | `#demo-download-btn` | Click to queue a download | `requiresInteraction: true`; Next disabled until `demoStarted` |
| 5 | 4 | `#demo-download-row` | Row appeared, click ● to start | auto-advance from index 3 when `demoStarted` flips |
| 6 | 5 | `#demo-play-btn` | Play video when done | |
| 7 | 6 | `#onboarding-pill` | Explore other features | "Done" label on button |

`DOWNLOAD_STEP_INDEX = 3` (0-indexed step that blocks until `demoStarted`).

---

## Task 1: Install react-joyride

**Files:**
- Modify: `package.json` (via npm)

- [ ] **Step 1: Install**

```bash
npm install react-joyride
```

- [ ] **Step 2: Verify install**

```bash
grep "react-joyride" package.json
```

Expected output includes `"react-joyride": "^x.x.x"` in dependencies.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install react-joyride"
```

---

## Task 2: Add `id="demo-toolbar-controls"` to DemoToolbar

**Files:**
- Modify: `src/onboarding/components/shared/DemoToolbar.tsx:31`

The start/stop/stopall buttons are in a `<div className="flex items-center gap-3 pl-4">` at line 31. Add `id="demo-toolbar-controls"` to it.

- [ ] **Step 1: Edit DemoToolbar.tsx**

Find this block (line 31):
```tsx
<div className="flex items-center gap-3 pl-4">
```

Replace with:
```tsx
<div id="demo-toolbar-controls" className="flex items-center gap-3 pl-4">
```

- [ ] **Step 2: Commit**

```bash
git add src/onboarding/components/shared/DemoToolbar.tsx
git commit -m "feat(onboarding): add id to toolbar controls for tour targeting"
```

---

## Task 3: Add `id="demo-download-btn"` to DemoInputField

**Files:**
- Modify: `src/onboarding/components/shared/DemoInputField.tsx`

The download action icon is passed as `actionIcon` to `<Input>`. The `Input` component renders action icons inside an `<button>` wrapper. We need to wrap the entire `DemoInputField` root differently to target the download icon.

The cleanest approach: wrap the download action `icon` element with a `<span id="demo-download-btn">` so joyride can find it in the DOM. However, since `actionIcon.icon` is just a React element passed to a child component, we instead add a `<span id="demo-download-btn">` around the download `<Download>` icon itself:

- [ ] **Step 1: Edit DemoInputField.tsx**

Find this block (around line 127–133):
```tsx
actionIcon={
  isSubscription
    ? undefined
    : {
        icon: (
          <Download
            className={cn('text-darkModeHover', actionEnabled && 'text-primary')}
          />
        ),
```

Replace with:
```tsx
actionIcon={
  isSubscription
    ? undefined
    : {
        icon: (
          <span id="demo-download-btn">
            <Download
              className={cn('text-darkModeHover', actionEnabled && 'text-primary')}
            />
          </span>
        ),
```

- [ ] **Step 2: Commit**

```bash
git add src/onboarding/components/shared/DemoInputField.tsx
git commit -m "feat(onboarding): add id to download button for tour targeting"
```

---

## Task 4: Add `rowId` + `playBtnId` props to VideoRow in DemoStatusTable

**Files:**
- Modify: `src/onboarding/components/shared/DemoStatusTable.tsx:46-207`

`VideoRow` is a sub-component defined at line 46. We need to add two optional props: `rowId` (forwarded to the `<tr>`) and `playBtnId` (forwarded to the `VscPlayCircle` elements).

- [ ] **Step 1: Update VideoRowProps interface (line 46)**

Find:
```tsx
interface VideoRowProps {
  video: DummyVideo;
  status: DemoStatus;
  progress: number;
  onStartDownload?: () => void;
  onPlay?: () => void;
}
```

Replace with:
```tsx
interface VideoRowProps {
  video: DummyVideo;
  status: DemoStatus;
  progress: number;
  onStartDownload?: () => void;
  onPlay?: () => void;
  rowId?: string;
  playBtnId?: string;
}
```

- [ ] **Step 2: Forward rowId to `<tr>` (line 60)**

Find:
```tsx
const VideoRow: React.FC<VideoRowProps> = ({ video, status, progress, onStartDownload, onPlay }) => {
```

Replace with:
```tsx
const VideoRow: React.FC<VideoRowProps> = ({ video, status, progress, onStartDownload, onPlay, rowId, playBtnId }) => {
```

Then find:
```tsx
  return (
    <tr className="border-b hover:bg-gray-50 dark:border-darkModeTableBorder dark:hover:bg-darkModeHover cursor-pointer bg-white dark:bg-darkModeTable">
```

Replace with:
```tsx
  return (
    <tr id={rowId} className="border-b hover:bg-gray-50 dark:border-darkModeTableBorder dark:hover:bg-darkModeHover cursor-pointer bg-white dark:bg-darkModeTable">
```

- [ ] **Step 3: Forward playBtnId to idle-state VscPlayCircle (line ~94)**

Find this block inside `{isIdle && ...}`:
```tsx
              <VscPlayCircle
                size={20}
                className="text-green-600 hover:text-green-400 transition-colors duration-200 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlay?.();
                }}
              />
```

Replace with:
```tsx
              <VscPlayCircle
                id={playBtnId}
                size={20}
                className="text-green-600 hover:text-green-400 transition-colors duration-200 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlay?.();
                }}
              />
```

- [ ] **Step 4: Forward playBtnId to done-state VscPlayCircle (line ~132)**

Find this block inside `{isDone && ...}`:
```tsx
            <VscPlayCircle
              size={20}
              className="text-green-600 hover:text-green-400 transition-colors duration-200 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onPlay?.();
              }}
            />
```

Replace with:
```tsx
            <VscPlayCircle
              id={playBtnId}
              size={20}
              className="text-green-600 hover:text-green-400 transition-colors duration-200 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onPlay?.();
              }}
            />
```

- [ ] **Step 5: Pass IDs when rendering VideoRow for VideoDownload (line ~486)**

Find:
```tsx
      case OnboardingFeature.VideoDownload:
        return (
          <VideoRow
            video={DUMMY_SINGLE_VIDEO}
            status={videoSim.status}
            progress={videoSim.progress}
            onStartDownload={videoSim.start}
            onPlay={() => onPlay?.(DUMMY_SINGLE_VIDEO)}
          />
        );
```

Replace with:
```tsx
      case OnboardingFeature.VideoDownload:
        return (
          <VideoRow
            video={DUMMY_SINGLE_VIDEO}
            status={videoSim.status}
            progress={videoSim.progress}
            onStartDownload={videoSim.start}
            onPlay={() => onPlay?.(DUMMY_SINGLE_VIDEO)}
            rowId="demo-download-row"
            playBtnId="demo-play-btn"
          />
        );
```

- [ ] **Step 6: Commit**

```bash
git add src/onboarding/components/shared/DemoStatusTable.tsx
git commit -m "feat(onboarding): add tour target ids to VideoRow"
```

---

## Task 5: Add `id="onboarding-pill"` to OnboardingPill

**Files:**
- Modify: `src/onboarding/components/OnboardingPill.tsx:37`

The outer element is a `<motion.div>` at line 37.

- [ ] **Step 1: Edit OnboardingPill.tsx**

Find (line 37):
```tsx
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
      ref={ref}
```

Replace with:
```tsx
      id="onboarding-pill"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
      ref={ref}
```

- [ ] **Step 2: Commit**

```bash
git add src/onboarding/components/OnboardingPill.tsx
git commit -m "feat(onboarding): add id to onboarding pill for tour targeting"
```

---

## Task 6: Create `useOnboardingTour.ts`

**Files:**
- Create: `src/onboarding/hooks/useOnboardingTour.ts`

- [ ] **Step 1: Create the file**

```ts
import { Step } from 'react-joyride';
import { OnboardingFeature } from '../types/onboardingTypes';

export const DOWNLOAD_STEP_INDEX = 3;

export const TOUR_STEPS: Partial<Record<OnboardingFeature, Step[]>> = {
  [OnboardingFeature.VideoDownload]: [
    {
      target: 'body',
      content: "Welcome to Downlodr! Let's walk you through downloading your first video.",
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '#demo-toolbar-controls',
      content: 'These buttons let you start, pause, or stop all downloads in your queue at once.',
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '#taskbar-input-field',
      content:
        "Paste any video URL here. We've pre-filled one so you can try it now. The gear icon sets format and quality; the folder icon opens your save location.",
      placement: 'bottom',
      disableBeacon: true,
    },
    {
      target: '#demo-download-btn',
      content: 'Click the download icon to add this video to your queue. Go ahead and try it!',
      placement: 'bottom',
      disableBeacon: true,
      data: { requiresInteraction: true },
    },
    {
      target: '#demo-download-row',
      content:
        'Your video is now queued here. Click the download circle ● to start it and watch the progress fill up.',
      placement: 'top',
      disableBeacon: true,
    },
    {
      target: '#demo-play-btn',
      content: 'Once the download is done, click play to watch the video right inside the app.',
      placement: 'top',
      disableBeacon: true,
    },
    {
      target: '#onboarding-pill',
      content:
        'Use these dots to explore other features — playlists, article extraction, and more. Exit when you\'re ready to start downloading!',
      placement: 'top',
      disableBeacon: true,
    },
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add src/onboarding/hooks/useOnboardingTour.ts
git commit -m "feat(onboarding): add tour steps data for VideoDownload feature"
```

---

## Task 7: Create `OnboardingTour.tsx`

**Files:**
- Create: `src/onboarding/components/OnboardingTour.tsx`

- [ ] **Step 1: Create the file**

```tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Joyride, {
  ACTIONS,
  CallBackProps,
  EVENTS,
  STATUS,
  TooltipRenderProps,
} from 'react-joyride';
import { OnboardingFeature } from '../types/onboardingTypes';
import { DOWNLOAD_STEP_INDEX, TOUR_STEPS } from '../hooks/useOnboardingTour';

interface OnboardingTourProps {
  active: OnboardingFeature;
  demoStarted: boolean;
}

const OnboardingTour: React.FC<OnboardingTourProps> = ({ active, demoStarted }) => {
  const steps = TOUR_STEPS[active] ?? [];
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Reset and start tour when the active feature changes
  useEffect(() => {
    setStepIndex(0);
    setRun(steps.length > 0);
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance past the download-button step when the user clicks download
  useEffect(() => {
    if (demoStarted && stepIndex === DOWNLOAD_STEP_INDEX) {
      setStepIndex(DOWNLOAD_STEP_INDEX + 1);
    }
  }, [demoStarted]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCallback = useCallback((data: CallBackProps) => {
    const { action, index, status, type } = data;

    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status)) {
      setRun(false);
      return;
    }

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      setStepIndex(index + (action === ACTIONS.PREV ? -1 : 1));
    }
  }, []);

  const tooltipComponent = useMemo(
    () =>
      (props: TooltipRenderProps) =>
        (
          <TourTooltip
            {...props}
            demoStarted={demoStarted}
            totalSteps={steps.length}
          />
        ),
    [demoStarted, steps.length],
  );

  if (steps.length === 0) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      continuous
      showSkipButton
      disableScrolling
      disableOverlayClose
      tooltipComponent={tooltipComponent}
      callback={handleCallback}
      styles={{
        options: {
          arrowColor: 'transparent',
          overlayColor: 'rgba(0, 0, 0, 0.45)',
          spotlightShadow: '0 0 0 2px #F45513',
          zIndex: 1000,
        },
      }}
    />
  );
};

// ─── Custom Tooltip ──────────────────────────────────────────────────────────

interface TourTooltipProps extends TooltipRenderProps {
  demoStarted: boolean;
  totalSteps: number;
}

const TourTooltip: React.FC<TourTooltipProps> = ({
  backProps,
  closeProps,
  continuous,
  index,
  isLastStep,
  primaryProps,
  skipProps,
  step,
  tooltipProps,
  demoStarted,
  totalSteps,
}) => {
  const requiresInteraction = (step as { data?: { requiresInteraction?: boolean } }).data
    ?.requiresInteraction;
  const isNextDisabled = requiresInteraction && !demoStarted;

  return (
    <div
      {...tooltipProps}
      className="bg-white dark:bg-darkModeTable border border-divider dark:border-darkModeCompliment rounded-lg shadow-xl p-4 w-72 max-w-xs"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        {step.title && (
          <p className="text-sm font-semibold dark:text-darkModeLight">{step.title as string}</p>
        )}
        <button
          {...closeProps}
          className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-base leading-none"
        >
          ×
        </button>
      </div>

      {/* Content */}
      <p className="text-xs text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
        {step.content as string}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {index + 1} / {totalSteps}
        </span>
        <div className="flex items-center gap-2">
          {index > 0 && (
            <button
              {...backProps}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-2 py-1 transition-colors"
            >
              Back
            </button>
          )}
          {!isLastStep && (
            <button
              {...skipProps}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-2 py-1 transition-colors"
            >
              Skip
            </button>
          )}
          {continuous && (
            <button
              {...primaryProps}
              disabled={isNextDisabled}
              onClick={isNextDisabled ? (e) => e.preventDefault() : (primaryProps as React.HTMLAttributes<HTMLButtonElement>).onClick as React.MouseEventHandler<HTMLButtonElement>}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                isNextDisabled
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-darkModeHover dark:text-gray-500'
                  : 'bg-[#F45513] text-white hover:bg-[#d94410] cursor-pointer'
              }`}
            >
              {isLastStep ? 'Done' : isNextDisabled ? 'Try it →' : 'Next'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;
```

- [ ] **Step 2: Commit**

```bash
git add src/onboarding/components/OnboardingTour.tsx
git commit -m "feat(onboarding): add OnboardingTour component with custom tooltip"
```

---

## Task 8: Wire `OnboardingTour` into `OnboardingLayout`

**Files:**
- Modify: `src/onboarding/components/OnboardingLayout.tsx`

- [ ] **Step 1: Add import**

At the top of `OnboardingLayout.tsx`, after the existing imports, add:

```tsx
import OnboardingTour from './OnboardingTour';
```

- [ ] **Step 2: Render `<OnboardingTour>` inside the layout**

Find the closing `</div>` just before `<OnboardingPill .../>` (around line 99):

```tsx
      <OnboardingPill
        active={active}
        visited={visited}
        onSelect={handleSelect}
        onExit={onExit}
      />
    </div>
```

Replace with:

```tsx
      <OnboardingTour active={active} demoStarted={demoStarted} />
      <OnboardingPill
        active={active}
        visited={visited}
        onSelect={handleSelect}
        onExit={onExit}
      />
    </div>
```

- [ ] **Step 3: Commit**

```bash
git add src/onboarding/components/OnboardingLayout.tsx
git commit -m "feat(onboarding): wire OnboardingTour into OnboardingLayout"
```

---

## Task 9: Verify tour in the running app

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Open the app and navigate to onboarding**

The onboarding page auto-opens on first launch (or navigate to `/onboarding`). Verify:

- [ ] Tour tooltip appears automatically over the center of the screen (step 1 — Welcome)
- [ ] Clicking "Next" advances to step 2 — spotlight on `#demo-toolbar-controls` (Start/Stop/StopAll buttons)
- [ ] Next → step 3 — spotlight on URL input field
- [ ] Next → step 4 — spotlight on download icon button; "Next" button shows "Try it →" and is disabled (grayed out)
- [ ] Clicking the download icon in the toolbar → "Try it →" becomes enabled and tour auto-advances to step 5 — spotlight on the download row
- [ ] Next → step 6 — spotlight on play icon in the row
- [ ] Next → step 7 — spotlight on `#onboarding-pill` (bottom pill); button shows "Done"
- [ ] Clicking "Done" closes the tour

- [ ] **Step 3: Verify skip behavior**

- [ ] Clicking "Skip" on any step closes the tour immediately
- [ ] Clicking "×" closes the tour immediately
- [ ] Switching feature (e.g. to Playlist) in the pill dropdown and back to VideoDownload restarts the tour from step 1

- [ ] **Step 4: Verify dark mode**

Toggle dark mode. Confirm tooltip card uses `bg-darkModeTable`, border matches `darkModeCompliment`, text is readable.
