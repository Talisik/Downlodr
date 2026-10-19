// src/core-app/ipc/main/cookieAuth/browserDetection.ts
import { getBrowserDetectionDebugInfo } from 'yt-dlp-helper';

export type BrowserAuthKind = 'live' | 'import';

export interface BrowserDetection {
  name: string;
  exists: boolean;
  kind: BrowserAuthKind;
  recommended: boolean;
}

// Firefox and Brave keep cookies in a SQLite file yt-dlp can copy while the
// browser is running. Chrome/Edge/Opera/Vivaldi/Chromium lock that file
// while open (yt-dlp issue #7271), and newer Chrome's App-Bound Encryption
// can block it even when closed — those need the one-shot import flow
// instead of live reads. This list, not yt-dlp-helper's own
// detectFirstInstalledBrowser() (which is chrome-first), decides both the
// kind and the sort order the UI shows.
const LIVE_BROWSERS = new Set(['firefox', 'brave']);

// Our own preference order: live-capable browsers first, since they're
// strictly better (always fresh, no import step). Within each group, keep
// yt-dlp-helper's own ordering.
const PREFERENCE_ORDER = [
  'firefox',
  'brave',
  'chrome',
  'edge',
  'opera',
  'vivaldi',
  'chromium',
];

export function detectBrowsers(): BrowserDetection[] {
  const info = getBrowserDetectionDebugInfo();
  const byName = new Map(info.browserPaths.map((b) => [b.name, b.exists]));

  return PREFERENCE_ORDER.map((name) => {
    const exists = byName.get(name) ?? false;
    const kind: BrowserAuthKind = LIVE_BROWSERS.has(name) ? 'live' : 'import';
    return {
      name,
      exists,
      kind,
      recommended: exists && kind === 'live',
    };
  });
}
