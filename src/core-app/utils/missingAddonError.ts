import { useAddonStore } from '@/core-app/store/addonStore';

/** True if an IPC error message indicates the target add-on's handler isn't registered. */
export function isMissingHandlerError(message?: string | null): boolean {
  return !!message && message.includes('No handler registered');
}

const MISSING_ADDON_MESSAGES = {
  afda: 'Article Fetcher package not available, please install.',
  skedulosa: 'Subscriptions package not available, please install.',
} as const;

export type MissingAddonPack = keyof typeof MISSING_ADDON_MESSAGES;

/** User-facing message for a missing add-on package. */
export function getMissingAddonMessage(pack: MissingAddonPack): string {
  return MISSING_ADDON_MESSAGES[pack];
}

/** Opens the Add-ons manager modal so the user can install the missing package. */
export function openAddonManager(pack: MissingAddonPack): void {
  useAddonStore
    .getState()
    .setAddonManagerOpen(true, pack === 'afda' ? 'afda-required' : null);
}
