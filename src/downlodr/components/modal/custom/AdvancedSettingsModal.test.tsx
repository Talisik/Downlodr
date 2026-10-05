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

describe('AdvancedSettingsModal — Brave keychain note', () => {
  const NOTE = 'advanced.cookieAuth.braveKeychainNote';

  // IS_MAC is read once at module load, so each case re-imports the modal
  // (and the store it reads) under the user agent it needs.
  const renderOn = async (
    userAgent: string,
    mode: 'live' | 'none',
    browser: string | null,
  ) => {
    vi.resetModules();
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);
    const { default: Modal } = await import(
      '@/downlodr/components/modal/custom/AdvancedSettingsModal'
    );
    const { useSettingStore: store } = await import(
      '@/core-app/store/settingsStore'
    );
    store.setState((s) => ({
      settings: { ...s.settings, cookieAuthMode: mode, cookieAuthBrowser: browser },
    }));
    render(<Modal isOpen onClose={() => undefined} />);
  };

  const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
  const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

  beforeEach(() => {
    (window as unknown as { cookieAuthBridge: unknown }).cookieAuthBridge = {
      getState: vi.fn().mockResolvedValue({ detected: [] }),
      setMode: vi.fn().mockResolvedValue(undefined),
      siteLogin: { list: vi.fn().mockResolvedValue([]) },
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows on macOS when Brave is the selected browser', async () => {
    await renderOn(MAC, 'live', 'brave');
    expect(screen.getByText(NOTE)).toBeTruthy();
  });

  it.each([
    ['Firefox on macOS', MAC, 'live', 'firefox'],
    ['Brave on Windows', WINDOWS, 'live', 'brave'],
    ['browser cookies off', MAC, 'none', null],
  ] as const)('stays hidden for %s', async (_case, ua, mode, browser) => {
    await renderOn(ua, mode, browser);
    expect(screen.queryByText(NOTE)).toBeNull();
  });
});
