import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdvancedSettingsModal from '@/downlodr/components/modal/custom/AdvancedSettingsModal';
import { useSettingStore } from '@/core-app/store/settingsStore';

// Translation keys render as-is, so assertions don't depend on English copy.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const RECOMMENDED = 'advanced.cookieAuth.recommended';

/** The flex row holding an option's title (and any inline label). */
const titleRow = (titleKey: string): HTMLElement =>
  screen.getByText(titleKey).parentElement as HTMLElement;

const renderWithMode = (mode: 'live' | 'import' | 'file' | 'none') => {
  useSettingStore.setState((s) => ({
    settings: { ...s.settings, cookieAuthMode: mode, cookieAuthBrowser: null },
  }));
  render(<AdvancedSettingsModal isOpen onClose={() => undefined} />);
};

describe('AdvancedSettingsModal — Recommended label on browser cookies', () => {
  beforeEach(() => {
    (window as unknown as { cookieAuthBridge: unknown }).cookieAuthBridge = {
      getState: vi.fn().mockResolvedValue({ detected: [] }),
      setMode: vi.fn().mockResolvedValue(undefined),
      siteLogin: { list: vi.fn().mockResolvedValue([]) },
    };
  });

  afterEach(() => cleanup());

  it.each(['none', 'live'] as const)(
    'shows the label next to the Firefox / Brave title (mode: %s)',
    (mode) => {
      renderWithMode(mode);

      expect(
        titleRow('advanced.cookieAuth.liveTitle').textContent,
      ).toContain(RECOMMENDED);
    },
  );

  it('does not label the other options', () => {
    renderWithMode('none');

    for (const key of [
      'advanced.cookieAuth.loginTitle',
      'advanced.cookieAuth.fileTitle',
    ]) {
      expect(titleRow(key).textContent).not.toContain(RECOMMENDED);
    }
    // No browsers are detected here, so the title badge is the only one.
    expect(screen.getAllByText(RECOMMENDED)).toHaveLength(1);
  });

  it('leaves the saved selection unchanged', () => {
    renderWithMode('file');

    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    const checked = radios.filter((r) => r.checked);
    expect(checked).toHaveLength(1);
    expect(
      checked[0].closest('label')?.textContent,
    ).toContain('advanced.cookieAuth.fileTitle');
  });
});
