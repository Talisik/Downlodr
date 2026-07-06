import type { AfdaWebsiteInfo } from './schema/afdaWebsiteSchema';
import { AFDA_WEBSITE_MOCKS } from './dummy/afdaWebsiteMock';

const SIMULATED_DELAY_MS = 600;

/**
 * Fetch website-level info for an AFDA URL.
 * Returns null if the hostname is not in the recognized registry.
 *
 * SWAP THIS FUNCTION BODY when the real AFDA package is available.
 * Keep the signature: (url: string) => Promise<AfdaWebsiteInfo | null>
 */
/** Returns true if the URL's hostname is in the recognized AFDA registry. */
export function isKnownAfdaUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname in AFDA_WEBSITE_MOCKS;
  } catch {
    return false;
  }
}

export async function fetchAfdaWebsiteInfo(
  url: string,
): Promise<AfdaWebsiteInfo | null> {
  await new Promise((r) => setTimeout(r, SIMULATED_DELAY_MS));
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return AFDA_WEBSITE_MOCKS[hostname] ?? null;
  } catch {
    return null;
  }
}

export type { AfdaWebsiteInfo };
