import { useEffect, useState } from 'react';

/**
 * Name of the window event `renderer.tsx` fires at the moment it hides the
 * boot splash, and the flag it sets alongside it for listeners that attach
 * afterwards (the splash can be hidden before React mounts, e.g. when the
 * preload bridge is unavailable).
 */
export const APP_READY_EVENT = 'downlodr:app-ready';

export type AppReadyWindow = Window & { __appReady?: boolean };

/**
 * The splash fade-out is a 350ms opacity transition (see #splash in
 * index.html). Waiting slightly longer than that keeps boot-time modals from
 * popping in mid-fade.
 */
const POST_SPLASH_DELAY_MS = 400;

/**
 * True once the boot splash has been hidden and its fade-out has finished.
 *
 * Use this to gate anything that must not appear over the splash — the
 * telemetry consent modal and the onboarding tour picker both do. Readiness is
 * decided in exactly one place (`hideSplashOnce` in `renderer.tsx`) and
 * broadcast from there, so this hook cannot disagree with the splash about
 * whether boot is over.
 */
export function useAppReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const armDelay = () => {
      timer = setTimeout(() => setReady(true), POST_SPLASH_DELAY_MS);
    };

    // Already hidden before this listener attached — no event is coming.
    if ((window as AppReadyWindow).__appReady) {
      armDelay();
    } else {
      window.addEventListener(APP_READY_EVENT, armDelay, { once: true });
    }

    return () => {
      window.removeEventListener(APP_READY_EVENT, armDelay);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return ready;
}
