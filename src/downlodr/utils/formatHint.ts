import i18n from '@/core-app/i18n';
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { useSettingStore } from '@/core-app/store/settingsStore';

/**
 * One-time educational hint shown the very first time a user ever clicks
 * a Download button, telling them they can pick a specific format instead
 * of the automatic "best quality" default.
 *
 * Call this as a guard at the top of a download-button click handler:
 *
 *   if (maybeShowFormatHint()) return;
 *
 * Returns true the first time ever it's called (and consumes the flag so
 * it never fires again) — the caller must NOT start the download on that
 * call. Returns false every time after that — the caller proceeds as normal.
 */
export function maybeShowFormatHint(): boolean {
  const { settings, setHasSeenFormatHint } = useSettingStore.getState();

  if (settings.hasSeenFormatHint) {
    return false;
  }

  toast({
    title: i18n.t('formatHint.toastTitle', { ns: 'downlodr' }),
    description: i18n.t('formatHint.toastDesc', { ns: 'downlodr' }),
    duration: 6000,
  });
  setHasSeenFormatHint(true);
  return true;
}
