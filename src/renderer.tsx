/**
 * Entry point for the UI and App.tsx.
 * This file is responsible for rendering the main App component
 * into the DOM.
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { initComposedWindowApi } from './core-app/ipc/composeWindowApi';
import App from './App';
import './index.css';
import '@/core-app/i18n';

// Compose window.downlodrFunctions, window.ytdlp, window.updateAPI, etc. from IPC bridges
initComposedWindowApi();

// Create root element
const container = document.createElement('div');
document.body.appendChild(container);

// Create root and render
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Remove the HTML splash screen once React has mounted AND the main process
// has finished its deferred add-on initialization (addons:services-ready).
// The add-on init blocks the main process for a few seconds, so hiding the
// splash on mount alone exposed a frozen-looking app; keeping the splash up
// covers the whole boot. The timeout is a failsafe so a missed event (e.g.
// services became ready before this listener attached) never strands the
// splash forever.
const hideSplash = () => {
  (window as typeof window & { __hideSplash?: () => void }).__hideSplash?.();
};

let splashHidden = false;
let unsubReady: (() => void) | undefined = undefined;
const hideSplashOnce = (reason: string) => {
  if (splashHidden) return;
  splashHidden = true;
  unsubReady?.();
  console.log(`[boot] hiding splash (${reason})`);
  requestAnimationFrame(hideSplash);
};

unsubReady = window.addonBridge?.on?.servicesReady?.(() =>
  hideSplashOnce('services-ready'),
);
if (!unsubReady) {
  // Bridge unavailable (e.g. preload failed) — fall back to hiding on mount.
  hideSplashOnce('no addonBridge');
} else {
  setTimeout(() => hideSplashOnce('15s failsafe'), 15000);
}
