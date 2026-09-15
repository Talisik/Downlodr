/**
 * A custom React component
 * Shows the Advanced Settings modal for Downlodr — the lower-level options
 * that don't belong in the main Settings modal: cookie authentication and
 * app data usage (telemetry).
 *
 * Reached from the "Advanced Settings" button in the SettingsModal footer,
 * which closes the Settings modal before opening this one.
 *
 * @param isOpen - If modal is open, keeps it open
 * @param onClose - If modal has been closed, closes modal
 * @returns JSX.Element - The rendered component displaying an AdvancedSettingsModal
 *
 */
import { BROWSER_LOGOS } from '@/assets/browsers/logos';
import { Badge } from '@/core-app/components/shadcn/components/ui/badge';
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { useSettingStore } from '@/core-app/store/settingsStore';
import { useTelemetryStore } from '@/core-app/store/telemetryStore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '../BaseModal';
import {
  AUTH_DESC,
  AUTH_LABEL,
  BTN,
  BTN_PRIMARY,
  BTN_SMALL,
  CHECKBOX,
  chipClass,
  INPUT_SM,
  OPTION_HELP,
  OPTION_LABEL,
  RADIO,
  RULE_LINE,
  SectionRule,
} from './settingsUi';

interface AdvancedSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type CookieAuthMode = 'live' | 'import' | 'file' | 'none';

interface BrowserDetection {
  name: string;
  exists: boolean;
  kind: 'live' | 'import';
  recommended: boolean;
}

interface SiteLogin {
  domain: string;
  jarPath: string;
  loginUrl: string;
  lastLoginAt: number;
}

const LIVE_BROWSER_LABELS: Record<string, string> = {
  firefox: 'Firefox',
  brave: 'Brave',
};

const IMPORT_BROWSER_LABELS: Record<string, string> = {
  chrome: 'Chrome',
  edge: 'Edge',
  opera: 'Opera',
  vivaldi: 'Vivaldi',
  chromium: 'Chromium',
};

const AdvancedSettingsModal: React.FC<AdvancedSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { settings, updateCookieAuth, updateDontShowAppUpdates } =
    useSettingStore();

  const { settings: telemetrySettings, updateTelemetryEnabled } =
    useTelemetryStore();

  const { t } = useTranslation('settings');

  // Local (unsaved) copies — only written to the stores on "Okay".
  const [cookieAuthMode, setCookieAuthModeLocal] = useState<CookieAuthMode>(
    settings.cookieAuthMode ?? 'none',
  );
  const [cookieAuthBrowser, setCookieAuthBrowserLocal] = useState<
    string | null
  >(settings.cookieAuthBrowser ?? null);
  const [telemetryEnabled, setTelemetryEnabled] = useState(
    telemetrySettings.telemetryEnabled,
  );
  const [dontShowAppUpdates, setDontShowAppUpdates] = useState(
    settings.dontShowAppUpdates ?? false,
  );

  const [detected, setDetected] = useState<BrowserDetection[]>([]);
  const [lastImportedAt, setLastImportedAt] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [lastFileImportedAt, setLastFileImportedAt] = useState<number | null>(
    null,
  );
  const [importingFile, setImportingFile] = useState(false);
  const [siteLogins, setSiteLogins] = useState<SiteLogin[]>([]);
  const [siteLoginUrl, setSiteLoginUrl] = useState('');
  const [siteLoginBusy, setSiteLoginBusy] = useState(false);

  // Re-seed the form from the stores every time the modal opens, so a
  // cancelled edit doesn't linger into the next visit. Also refresh browser
  // detection each time, since the user could install/uninstall a browser
  // between visits.
  useEffect(() => {
    if (isOpen) {
      setCookieAuthModeLocal(settings.cookieAuthMode ?? 'none');
      setCookieAuthBrowserLocal(settings.cookieAuthBrowser ?? null);
      setTelemetryEnabled(telemetrySettings.telemetryEnabled);
      setDontShowAppUpdates(settings.dontShowAppUpdates ?? false);
      window.cookieAuthBridge
        .getState()
        .then((state) => setDetected(state.detected))
        .catch(() => setDetected([]));
      window.cookieAuthBridge.siteLogin
        .list()
        .then(setSiteLogins)
        .catch(() => setSiteLogins([]));
    }
  }, [
    isOpen,
    settings.cookieAuthMode,
    settings.cookieAuthBrowser,
    settings.dontShowAppUpdates,
    telemetrySettings.telemetryEnabled,
  ]);

  const liveBrowsers = detected.filter((b) => b.kind === 'live');
  const importBrowsers = detected.filter((b) => b.kind === 'import');

  const badgeFor = (browser: BrowserDetection) => {
    if (browser.recommended) {
      return (
        <Badge variant="success">{t('advanced.cookieAuth.recommended')}</Badge>
      );
    }
    if (browser.exists) {
      return (
        <Badge variant="secondary">{t('advanced.cookieAuth.installed')}</Badge>
      );
    }
    return (
      <Badge variant="outline">{t('advanced.cookieAuth.notDetected')}</Badge>
    );
  };

  const handleImport = async () => {
    if (!cookieAuthBrowser) return;
    setImporting(true);
    try {
      const result = await window.cookieAuthBridge.import(cookieAuthBrowser);
      if (result.ok) {
        setLastImportedAt(Date.now());
        toast({
          title: `Imported ${
            result.count ?? 0
          } cookies from ${cookieAuthBrowser}`,
          duration: 5000,
        });
      } else {
        toast({
          title: 'Import failed',
          description: result.error,
          duration: 8000,
        });
      }
    } catch (err) {
      toast({
        title: 'Import failed',
        description: err instanceof Error ? err.message : String(err),
        duration: 8000,
      });
    } finally {
      setImporting(false);
    }
  };

  const handleImportFile = async () => {
    setImportingFile(true);
    try {
      const result = await window.cookieAuthBridge.importFile();
      if (result.ok) {
        setLastFileImportedAt(Date.now());
        toast({
          title: `Imported ${result.count ?? 0} cookies from file`,
          duration: 5000,
        });
      } else if (result.error !== 'No file selected.') {
        // A cancelled file dialog isn't a failure worth a toast — every
        // other rejection (bad format, unreadable file) is.
        toast({
          title: 'Import failed',
          description: result.error,
          duration: 8000,
        });
      }
    } catch (err) {
      toast({
        title: 'Import failed',
        description: err instanceof Error ? err.message : String(err),
        duration: 8000,
      });
    } finally {
      setImportingFile(false);
    }
  };

  const refreshSiteLogins = () => {
    window.cookieAuthBridge.siteLogin
      .list()
      .then(setSiteLogins)
      .catch(() => undefined);
  };

  const handleSiteLogin = async (url: string) => {
    if (!url.trim()) return;
    setSiteLoginBusy(true);
    try {
      const result = await window.cookieAuthBridge.siteLogin.open(url.trim());
      if (result.ok) {
        setSiteLoginUrl('');
        toast({
          title: t('advanced.cookieAuth.siteLoginSavedTitle', {
            domain: result.domain,
          }),
          duration: 5000,
        });
      } else if (result.error) {
        toast({
          title: t('advanced.cookieAuth.siteLoginFailedTitle'),
          description: result.error,
          duration: 8000,
        });
      }
    } catch (err) {
      toast({
        title: t('advanced.cookieAuth.siteLoginFailedTitle'),
        description: err instanceof Error ? err.message : String(err),
        duration: 8000,
      });
    } finally {
      refreshSiteLogins();
      setSiteLoginBusy(false);
    }
  };

  const handleSiteRemove = async (domain: string) => {
    await window.cookieAuthBridge.siteLogin
      .remove(domain)
      .catch(() => undefined);
    refreshSiteLogins();
  };

  const formatRelativeTime = (ms: number): string => {
    const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    if (seconds < 60) return t('advanced.cookieAuth.justNow');
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60)
      return t('advanced.cookieAuth.minutesAgo', { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('advanced.cookieAuth.hoursAgo', { count: hours });
    const days = Math.floor(hours / 24);
    return t('advanced.cookieAuth.daysAgo', { count: days });
  };

  const handleClose = () => {
    // Discard unsaved edits.
    setCookieAuthModeLocal(settings.cookieAuthMode ?? 'none');
    setCookieAuthBrowserLocal(settings.cookieAuthBrowser ?? null);
    setTelemetryEnabled(telemetrySettings.telemetryEnabled);
    setDontShowAppUpdates(settings.dontShowAppUpdates ?? false);
    onClose();
  };

  const handleSubmit = () => {
    updateCookieAuth(cookieAuthMode, cookieAuthBrowser);
    updateTelemetryEnabled(telemetryEnabled);
    updateDontShowAppUpdates(dontShowAppUpdates);
    // Main process holds its own copy for yt-dlp calls (it can't read the
    // renderer's IndexedDB-backed store) — push the saved value there too.
    window.cookieAuthBridge
      .setMode(cookieAuthMode, cookieAuthBrowser)
      .catch(() => undefined);
    if (cookieAuthMode === 'file') {
      if (lastFileImportedAt) {
        toast({
          title: t('advanced.cookieAuth.savedTitle'),
          description: t('advanced.cookieAuth.savedFile'),
          duration: 5000,
        });
      } else {
        toast({
          variant: 'destructive',
          title: t('advanced.cookieAuth.savedTitle'),
          description: t('advanced.cookieAuth.fileNotImportedWarning'),
          duration: 8000,
        });
      }
    } else if (cookieAuthMode !== 'none' && cookieAuthBrowser) {
      toast({
        title: t('advanced.cookieAuth.savedTitle'),
        description: t('advanced.cookieAuth.savedWithBrowser', {
          browser:
            LIVE_BROWSER_LABELS[cookieAuthBrowser] ??
            IMPORT_BROWSER_LABELS[cookieAuthBrowser] ??
            cookieAuthBrowser,
        }),
        duration: 5000,
      });
    } else {
      toast({
        title: t('advanced.cookieAuth.savedTitle'),
        description: t('advanced.cookieAuth.savedNone'),
        duration: 5000,
      });
    }
    onClose();
  };

  // Main starts every launch at mode 'none' regardless of what was saved
  // last session — sync the persisted choice to it once the modal (and
  // therefore the renderer) is up, not only when the user re-saves.
  useEffect(() => {
    window.cookieAuthBridge
      .setMode(
        settings.cookieAuthMode ?? 'none',
        settings.cookieAuthBrowser ?? null,
      )
      .catch(() => undefined);
    // Runs once per app session's first modal mount is unnecessary to
    // enforce precisely — re-running on settings changes is harmless and
    // keeps main in sync if it's ever reset without a restart.
  }, []);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('advanced.title')}
      width="max-w-2xl"
      contentClassName="px-6 pb-4 max-h-[65vh] overflow-y-auto"
      footer={
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={handleSubmit} className={BTN_PRIMARY}>
            {t('common:buttons.save')}
          </button>
          <button type="button" onClick={handleClose} className={BTN}>
            {t('common:buttons.cancel')}
          </button>
        </div>
      }
    >
      <form onSubmit={(e) => e.preventDefault()}>
        {/* Cookie authentication section */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="block dark:text-gray-200 text-nowrap font-bold">
              {t('advanced.authentication')}
            </label>
            <hr className={RULE_LINE} />
          </div>

          <div className="text-xs text-amber-700 dark:text-amber-400 mb-3 ml-2">
            {t('advanced.cookieAuth.warning')}
          </div>

          <div className="ml-2 space-y-4">
            {/* Option 1: live browser cookies */}
            <label className="block">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="cookie-auth-mode"
                  checked={cookieAuthMode === 'live'}
                  onChange={() => {
                    setCookieAuthModeLocal('live');
                    setCookieAuthBrowserLocal(
                      liveBrowsers.find((b) => b.recommended)?.name ??
                        liveBrowsers[0]?.name ??
                        'firefox',
                    );
                  }}
                  className={RADIO}
                />
                <span className={AUTH_LABEL}>
                  {t('advanced.cookieAuth.liveTitle')}
                </span>
              </div>
              <div className={AUTH_DESC}>
                {t('advanced.cookieAuth.liveDesc')}
              </div>
              {cookieAuthMode === 'live' && (
                <div className="ml-6 mt-2 flex flex-wrap gap-2">
                  {liveBrowsers.map((b) => (
                    <button
                      key={b.name}
                      type="button"
                      onClick={() => setCookieAuthBrowserLocal(b.name)}
                      className={chipClass(cookieAuthBrowser === b.name)}
                    >
                      {BROWSER_LOGOS[b.name] && (
                        <img
                          src={BROWSER_LOGOS[b.name]}
                          alt=""
                          className="h-4 w-4 shrink-0 object-contain"
                        />
                      )}
                      {LIVE_BROWSER_LABELS[b.name] ?? b.name}
                      {badgeFor(b)}
                    </button>
                  ))}
                </div>
              )}
            </label>

            {/* Option 3: in-app per-site login */}
            <div className="block">
              <div className="flex items-center gap-2">
                <span className={AUTH_LABEL}>
                  {t('advanced.cookieAuth.loginTitle')}
                </span>
              </div>
              <div className={AUTH_DESC}>
                {t('advanced.cookieAuth.loginDesc')}
              </div>
              <div className="ml-6 mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={siteLoginUrl}
                    onChange={(e) => setSiteLoginUrl(e.target.value)}
                    placeholder={t(
                      'advanced.cookieAuth.siteLoginUrlPlaceholder',
                    )}
                    className={`${INPUT_SM} h-7 flex-1`}
                  />
                  <button
                    type="button"
                    disabled={!siteLoginUrl.trim() || siteLoginBusy}
                    onClick={() => handleSiteLogin(siteLoginUrl)}
                    className={`${BTN_SMALL} h-7 px-3`}
                  >
                    {siteLoginBusy
                      ? t('advanced.cookieAuth.siteLoginOpening')
                      : t('advanced.cookieAuth.siteLoginButton')}
                  </button>
                </div>
                {siteLogins.length > 0 && (
                  <div className="space-y-1">
                    {siteLogins.map((login) => (
                      <div
                        key={login.domain}
                        className="flex items-center justify-between gap-2 text-xs px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700"
                      >
                        <span className="dark:text-gray-200 font-medium">
                          {login.domain}
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          {formatRelativeTime(login.lastLoginAt)}
                        </span>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={siteLoginBusy}
                            onClick={() => handleSiteLogin(login.loginUrl)}
                            className={BTN_SMALL}
                          >
                            {t('advanced.cookieAuth.siteLoginRelogin')}
                          </button>
                          <button
                            type="button"
                            disabled={siteLoginBusy}
                            onClick={() => handleSiteRemove(login.domain)}
                            className={BTN_SMALL}
                          >
                            {t('advanced.cookieAuth.siteLoginRemove')}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Option 4: user-supplied cookies file */}
            <label className="block">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  name="cookie-auth-mode"
                  checked={cookieAuthMode === 'file'}
                  onChange={() => {
                    setCookieAuthModeLocal('file');
                    setCookieAuthBrowserLocal(null);
                  }}
                  className={RADIO}
                />
                <span className={AUTH_LABEL}>
                  {t('advanced.cookieAuth.fileTitle')}
                </span>
              </div>
              <div className={AUTH_DESC}>
                {t('advanced.cookieAuth.fileDesc')}
              </div>
              {cookieAuthMode === 'file' && (
                <div className="ml-6 mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={importingFile}
                    onClick={handleImportFile}
                    className={`${BTN_SMALL} h-7 px-3`}
                  >
                    {importingFile
                      ? t('advanced.cookieAuth.importing')
                      : t('advanced.cookieAuth.chooseFileButton')}
                  </button>
                  {lastFileImportedAt && (
                    <span className={OPTION_HELP}>
                      {t('advanced.cookieAuth.lastImported', {
                        time: new Date(lastFileImportedAt).toLocaleString(),
                      })}
                    </span>
                  )}
                </div>
              )}
            </label>

            {/* None */}
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="cookie-auth-mode"
                checked={cookieAuthMode === 'none'}
                onChange={() => {
                  setCookieAuthModeLocal('none');
                  setCookieAuthBrowserLocal(null);
                }}
                className={RADIO}
              />
              <span className="text-sm dark:text-gray-200">
                {t('advanced.cookieAuth.none')}
              </span>
            </label>
          </div>
        </div>

        {/* Notifications section */}
        <SectionRule label={t('advanced.notifications')} />

        <div className="ml-2 flex items-center gap-2">
          <input
            type="checkbox"
            id="enable-app-updates"
            checked={!dontShowAppUpdates}
            onChange={(e) => {
              setDontShowAppUpdates(!e.target.checked);
              toast({
                title: e.target.checked
                  ? t('toast.appUpdatesEnabled')
                  : t('toast.appUpdatesDisabled'),
                description: e.target.checked
                  ? t('toast.appUpdatesEnabledDesc')
                  : t('toast.appUpdatesDisabledDesc'),
                duration: 5000,
              });
            }}
            className={CHECKBOX}
          />
          <label htmlFor="enable-app-updates" className={OPTION_LABEL}>
            {t('appUpdates')}
          </label>
        </div>

        {/* Privacy section */}
        <SectionRule label={t('advanced.privacy')} />

        <div className="ml-2 space-y-1">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="telemetry-enabled"
              checked={telemetryEnabled}
              onChange={(e) => {
                setTelemetryEnabled(e.target.checked);
                toast({
                  title: e.target.checked
                    ? t('toast.telemetryEnabled')
                    : t('toast.telemetryDisabled'),
                  description: e.target.checked
                    ? t('toast.telemetryEnabledDesc')
                    : t('toast.telemetryDisabledDesc'),
                  duration: 5000,
                });
              }}
              className={CHECKBOX}
            />
            <label htmlFor="telemetry-enabled" className={OPTION_LABEL}>
              {t('telemetry')}
            </label>
          </div>
          <div className={`${OPTION_HELP} ml-6`}>{t('telemetryDesc')}</div>
        </div>
      </form>
    </BaseModal>
  );
};

export default AdvancedSettingsModal;
