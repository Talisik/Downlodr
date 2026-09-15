import { getBrowserDetectionDebugInfo } from 'yt-dlp-helper';

export type BrowserAuthKind = 'live' | 'import';

export interface BrowserDetection {
  name: string;
  exists: boolean;
  kind: BrowserAuthKind;
  recommended: boolean;
}

const LIVE_BROWSERS = new Set(['firefox', 'brave']);

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
