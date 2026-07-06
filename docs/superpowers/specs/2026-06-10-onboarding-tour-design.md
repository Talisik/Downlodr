# Onboarding Tour — Design Spec
**Date:** 2026-06-10
**Feature:** Step-by-step guided tour on the onboarding page (react-joyride)
**Scope:** Video Download feature only (other features added later)

---

## Overview

Add a react-joyride guided tour that auto-starts when the onboarding page loads. The tour highlights key UI elements in the Video Download demo one at a time, with a custom-styled tooltip card. It is controlled (stepIndex managed in React state) so we can auto-advance when the user interacts with the demo.

---

## Architecture

The tour lives entirely inside the onboarding page. No changes to the main app.

```
OnboardingLayout
  ├── <OnboardingTour />         ← new: wraps react-joyride
  ├── <DemoToolbar />            ← modified: IDs added to elements
  ├── <DemoStatusTable />
  │     └── <VideoDownloadDemo />
  │           └── <FakeDownloadRow />   ← modified: optional id prop
  └── <OnboardingPill />         ← modified: id added
```

### State flow

- `OnboardingLayout` passes `active` and `demoStarted` into `<OnboardingTour>` as props.
- `OnboardingTour` owns `stepIndex` (number) and `run` (boolean) — react-joyride controlled mode.
- When `active` changes → reset `stepIndex` to 0, set `run = true` only if steps exist for that feature.
- When `demoStarted` flips to `true` and `stepIndex === 6` → auto-advance to step 7.

---

## New Files

### `src/onboarding/hooks/useOnboardingTour.ts`

Exports a `TOUR_STEPS` map keyed by `OnboardingFeature`. Each value is a `Step[]` array (react-joyride's Step type). Adding a future feature tour = adding a new key.

```ts
export const TOUR_STEPS: Partial<Record<OnboardingFeature, Step[]>> = {
  [OnboardingFeature.VideoDownload]: [ /* 9 steps */ ],
  // [OnboardingFeature.Playlist]: [],   ← future
};
```

### `src/onboarding/components/OnboardingTour.tsx`

Props: `active: OnboardingFeature`, `demoStarted: boolean`

Renders `<Joyride>` in controlled mode with a custom `tooltipComponent={TourTooltip}`. `TourTooltip` is a small co-located component that renders the card with Tailwind classes matching the app's existing dark/light theme (`bg-white dark:bg-darkModeTable`, `border-divider`, primary color `#F45513`).

---

## Modified Files

| File | Change |
|------|--------|
| `OnboardingLayout.tsx` | Import and render `<OnboardingTour active={active} demoStarted={demoStarted} />` |
| `DemoToolbar.tsx` | Add `id="demo-toolbar-controls"` to start/stop/stopall container div |
| `DemoInputField.tsx` | Add `id="demo-input-settings"` to settings icon wrapper, `id="demo-input-folder"` to folder icon wrapper, `id="demo-download-btn"` to download action icon wrapper |
| `FakeDownloadRow.tsx` | Add optional `id?: string` prop forwarded to outer div |
| `VideoDownloadDemo.tsx` | Pass `id="demo-download-row"` to `<FakeDownloadRow>`; add a play button (▶) when `status === 'complete'` with `id="demo-play-btn"` |
| `OnboardingPill.tsx` | Add `id="onboarding-pill"` to outer container div |

---

## Tour Steps — Video Download

9 steps. Steps 1–6 advance on "Next". Step 6→7 auto-advances when `demoStarted` becomes true. Steps 7–9 advance on "Next".

| # | Target | Content | Placement | Notes |
|---|--------|---------|-----------|-------|
| 1 | *(none — centered)* | "Welcome to Downlodr! Let's walk you through downloading your first video." | center | No beacon |
| 2 | `#demo-toolbar-controls` | "These buttons let you start, pause, or stop all downloads in your queue at once." | bottom | |
| 3 | `#taskbar-input-field` | "Paste any video URL here. We've pre-filled one so you can try it right now." | bottom | |
| 4 | `#demo-input-settings` | "Tap the settings icon to choose your download format, quality, and output options." | bottom | |
| 5 | `#demo-input-folder` | "Open your default save folder directly from here." | bottom | |
| 6 | `#demo-download-btn` | "Click the download icon to add this video to the queue. Go ahead and try it!" | bottom | "Next" → "Try it →", disabled until `demoStarted` |
| 7 | `#demo-download-row` | "Your download is now queued. Watch the progress bar fill up in real time." | top | Auto-advances from step 6 when `demoStarted` flips |
| 8 | `#demo-play-btn` | "Once it's done, hit play to watch the video right inside the app." | top | Shown after sim completes |
| 9 | `#onboarding-pill` | "Use these dots to explore other features — playlist, article extraction, and more. Exit when you're ready!" | top | "Next" → "Done" |

### Step 6 → 7 transition logic

```ts
useEffect(() => {
  if (demoStarted && stepIndex === 6) {
    setStepIndex(7);
  }
}, [demoStarted]);
```

---

## Styling

- Tooltip card: `bg-white dark:bg-darkModeTable border border-divider dark:border-darkModeCompliment rounded-lg shadow-lg p-4`
- Primary accent (buttons, progress dots): `#F45513`
- Back button: ghost style, gray text
- Next/Done button: `bg-primary text-white rounded-md px-3 py-1.5 text-xs font-semibold`
- Step counter: `text-xs text-gray-400` bottom-left of card
- Close ×: top-right corner, calls `setRun(false)`
- Overlay: react-joyride default semi-transparent black (`rgba(0,0,0,0.5)`)
- Spotlight: react-joyride default cutout around target element

---

## Extensibility

To add a tour for another feature (e.g. Playlist):
1. Add IDs to the relevant elements in that feature's demo components.
2. Add a `[OnboardingFeature.Playlist]: [ ...steps ]` entry to `TOUR_STEPS` in `useOnboardingTour.ts`.
3. No changes needed to `OnboardingTour.tsx` or `OnboardingLayout.tsx`.

---

## Dependencies

- Install: `react-joyride` + `@types/react-joyride` (if not bundled)
- Already available: `framer-motion`, `@radix-ui/react-tooltip`, Tailwind, Zustand

---

## Out of Scope

- Tour for Playlist, AFDA, YtChannel, VideoPlayer features (added later)
- Persisting "tour seen" state (user can re-see it each time they visit onboarding)
- Tour controls in the main app outside onboarding
