/**
 * A custom React component
 * Shows the Settings modal for Downlodr, provides options for user to customize downlodr via: Download Speed, Default download location, amount of concurrent downloads
 *
 * @param isOpen - If modal is open, keeps it open
 * @param onClose - If modal has been closed, closes modal
 * @returns JSX.Element - The rendered component displaying a SettingsModal
 *
 */
import { Slider } from '@/core-app/components/shadcn/components/ui/slider';
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import i18n from '@/core-app/i18n';
import { useMainStore } from '@/core-app/store/mainStore';
import { useSettingStore } from '@/core-app/store/settingsStore';
import { useTelemetryStore } from '@/core-app/store/telemetryStore';
import { useTaskbarDownloadStore } from '@/downlodr/store/taskbarDownloadStore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '../BaseModal';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const {
    settings,
    updateDefaultLocation,
    updateDefaultDownloadSpeed,
    updatePermitConnectionLimit,
    updateMaxDownloadNum,
    updateDefaultDownloadSpeedBit,
    updateRunInBackground,
    updateEnableClipboardMonitoring,
    updateDontShowAppUpdates,
    updateDontShowPluginUpdates,
    updateLanguage,
  } = useSettingStore();

  const { visibleColumns, setVisibleColumns } = useMainStore();

  const { settings: telemetrySettings, updateTelemetryEnabled } =
    useTelemetryStore();

  // Get taskbar store to keep download folder in sync
  const { setDownloadFolder } = useTaskbarDownloadStore();

  const { t } = useTranslation('settings');
  const [selectedLanguage, setSelectedLanguage] = useState(
    settings.language ?? 'en',
  );

  // Form submission
  const [biteUnit, setBiteUnit] = useState('');
  const [biteUnitVal, setBiteUnitVal] = useState(
    settings.defaultDownloadSpeedBit,
  );
  const [downloadLocation, setDownloadLocation] = useState(
    settings.defaultLocation,
  );
  const [biteVal, setbiteVal] = useState(settings.defaultDownloadSpeed);
  const [maxDownload, setMaxDownload] = useState(settings.maxDownloadNum);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [maxUpload, setmaxUpload] = useState(settings.maxUploadNum);
  const [isConnectionLimitEnabled, setIsConnectionLimitEnabled] = useState(
    settings.permitConnectionLimit,
  );

  // Update the state declaration for local visible columns
  const [localVisibleColumns, setLocalVisibleColumns] = useState<string[]>([]);

  // background running setting
  const [runInBackground, setRunInBackground] = useState(
    settings.runInBackground,
  ); // Default to true for backward compatibility

  // clipboard monitoring setting
  const [enableClipboardMonitoring, setEnableClipboardMonitoring] = useState(
    settings.enableClipboardMonitoring,
  );

  // update notification settings
  const [dontShowAppUpdates, setDontShowAppUpdates] = useState(
    settings.dontShowAppUpdates,
  );
  const [dontShowPluginUpdates, setDontShowPluginUpdates] = useState(
    settings.dontShowPluginUpdates,
  );

  // sync with the mainStore's visibleColumns
  useEffect(() => {
    if (isOpen) {
      // Reset the local state when the modal opens to match the store
      setLocalVisibleColumns([...visibleColumns]);
    }
  }, [isOpen, visibleColumns]);

  const resetSettingsModal = () => {
    // Reset all state values to their original store values
    const initialBiteOption = getInitialBiteOption();
    setBiteUnit(initialBiteOption);
    setBiteUnitVal(settings.defaultDownloadSpeedBit);
    setDownloadLocation(settings.defaultLocation);
    setbiteVal(settings.defaultDownloadSpeed);
    setMaxDownload(settings.maxDownloadNum);
    setmaxUpload(settings.maxUploadNum);
    setIsConnectionLimitEnabled(settings.permitConnectionLimit);
    // reset column visibility
    setLocalVisibleColumns([...visibleColumns]);
    // reset the background running setting
    setRunInBackground(settings.runInBackground ?? true);
    // reset the clipboard monitoring setting
    setEnableClipboardMonitoring(settings.enableClipboardMonitoring ?? false);
    // reset the telemetry setting
    // setTelemetryEnabled(settings.telemetryEnabled ?? false); // Removed as per edit hint
    // reset the update notification settings
    setDontShowAppUpdates(settings.dontShowAppUpdates ?? false);
    setDontShowPluginUpdates(settings.dontShowPluginUpdates ?? false);
    setSelectedLanguage(settings.language ?? 'en');
  };
  // New state to track if directory selection is in progress
  const [isSelectingDirectory, setIsSelectingDirectory] =
    useState<boolean>(false);
  const handleDirectory = async () => {
    // Prevent multiple dialogs from being opened
    if (isSelectingDirectory) return;

    try {
      setIsSelectingDirectory(true);
      const path = await window.ytdlp.selectDownloadDirectory();
      if (path) {
        setDownloadLocation(path);
      }
    } finally {
      setIsSelectingDirectory(false);
    }
  };
  // Close Modal
  const handleClose = () => {
    resetSettingsModal();
    onClose();
  };

  const biteOptions = [
    { biteDisplayName: t('speedUnits.kb'), biteUnitVal: 'K' },
    { biteDisplayName: t('speedUnits.mb'), biteUnitVal: 'M' },
    { biteDisplayName: t('speedUnits.gb'), biteUnitVal: 'G' },
  ];

  const languageOptions = [
    { label: 'English', value: 'en' },
    { label: 'Español', value: 'es' },
    // { label: 'Portugese', value: 'pt' },
    { label: '한국인', value: 'ko' },
    { label: '日本語', value: 'ja' },
    { label: 'Deutsch', value: 'de' },
    { label: '繁體中文', value: 'zh-TW' },
    { label: '简体中文', value: 'zh-CN' },
  ];

  // Find the initial bite option based on the stored unit value
  const getInitialBiteOption = () => {
    const option = biteOptions.find(
      (bite) => bite.biteUnitVal === settings.defaultDownloadSpeedBit,
    );
    return option ? option.biteDisplayName : 'Kilo byte (KB)';
  };

  useEffect(() => {
    // Update the biteUnit whenever the store value changes
    setBiteUnit(getInitialBiteOption());
    setBiteUnitVal(settings.defaultDownloadSpeedBit);
  }, [settings.defaultDownloadSpeedBit]);

  // Single useEffect for settings that can change from other modals
  useEffect(() => {
    // Only sync settings that can actually be changed elsewhere
    setRunInBackground(settings.runInBackground ?? false);
    setEnableClipboardMonitoring(settings.enableClipboardMonitoring ?? false);
    setDontShowAppUpdates(settings.dontShowAppUpdates ?? false);
    setDontShowPluginUpdates(settings.dontShowPluginUpdates ?? false);
    // Sync downloadLocation when it gets populated by store rehydration
    setDownloadLocation(settings.defaultLocation);
  }, [
    settings.runInBackground,
    settings.enableClipboardMonitoring,
    settings.dontShowAppUpdates,
    settings.dontShowPluginUpdates,
    settings.defaultLocation,
  ]);

  // Column options with required flag
  const columnOptions = [
    { id: 'format', label: t('columns.format'), required: true },
    { id: 'size', label: t('columns.size'), required: false },
    { id: 'speed', label: t('columns.speed'), required: false },
    { id: 'source', label: t('columns.source'), required: false },
    { id: 'name', label: t('columns.name'), required: true },
    { id: 'dateAdded', label: t('columns.dateAdded'), required: false },
    { id: 'transcript', label: t('columns.transcript'), required: false },
    { id: 'status', label: t('columns.status'), required: true },
    { id: 'action', label: t('columns.action'), required: true },
  ];

  // Column toggle handler
  const handleToggleColumn = (columnId: string) => {
    if (localVisibleColumns.includes(columnId)) {
      setLocalVisibleColumns(
        localVisibleColumns.filter((id) => id !== columnId),
      );
    } else {
      setLocalVisibleColumns([...localVisibleColumns, columnId]);
    }
  };

  // Modify handleSubmit to consider the checkbox
  const handleSubmit = () => {
    updateDefaultLocation(downloadLocation);
    // Also update the taskbar download store to keep them in sync
    setDownloadFolder(downloadLocation);

    updateDefaultDownloadSpeed(biteVal);
    updateDefaultDownloadSpeedBit(biteUnitVal);
    updatePermitConnectionLimit(isConnectionLimitEnabled);
    // Only update connection limits if enabled, otherwise set to default of 5
    updateMaxDownloadNum(isConnectionLimitEnabled ? maxDownload : 5);
    // Update visible columns
    setVisibleColumns(localVisibleColumns);

    updateRunInBackground(runInBackground);
    // Also update the main process directly
    if (window.backgroundSettings?.setRunInBackground) {
      window.backgroundSettings.setRunInBackground(runInBackground);
    }

    updateEnableClipboardMonitoring(enableClipboardMonitoring);

    updateTelemetryEnabled(telemetrySettings.telemetryEnabled);

    updateDontShowAppUpdates(dontShowAppUpdates);
    updateDontShowPluginUpdates(dontShowPluginUpdates);

    if (selectedLanguage !== settings.language) {
      updateLanguage(selectedLanguage);
      i18n.changeLanguage(selectedLanguage);
    }

    onClose();
  };

  return (
    <>
      {/* Directory selection overlay - blocks all app interaction */}
      {isSelectingDirectory && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[9999] cursor-not-allowed flex items-center justify-center">
          <div className="p-6 bg-white dark:bg-darkModeDropdown rounded-lg shadow-lg max-w-md text-center">
            <h3 className="text-lg font-medium mb-2 dark:text-gray-200">
              {t('directoryInProgress')}
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              {t('directoryInProgressDesc')}
            </p>
          </div>
        </div>
      )}
      <BaseModal
        isOpen={isOpen}
        onClose={handleClose}
        title={t('title')}
        width="max-w-3xl"
        contentClassName="p-6 max-h-[75vh] overflow-y-auto"
        footer={
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              className="h-7.5 bg-primary text-white text-sm px-2 py-1 rounded-md hover:bg-orange-600 dark:hover:text-black dark:hover:bg-white"
            >
              {t('common:buttons.okay')}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="h-8 px-2 py-1 text-sm border rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-darkModeHover dark:text-gray-200"
            >
              {t('common:buttons.cancel')}
            </button>
          </div>
        }
      >
        <form onSubmit={(e) => e.preventDefault()}>
          {/* Schedule Name */}
          <div className="space-y-2">
            <div className="flex-1">
              <label className="text-[13px] -mt-6 block mb-1 dark:text-gray-200">
                {t('downloadLocation')}
              </label>
              <input
                type="text"
                placeholder={t('downloadLocation')}
                value={downloadLocation}
                onClick={handleDirectory}
                className="w-full border rounded-md px-3 py-2 dark:bg-darkMode dark:text-gray-200 dark:border-inputDarkModeBorder outline-none"
                readOnly
              />
            </div>
            {/* End of Upload Button */}
            {/* URL Name */}
            <div>
              <label className="text-[13px] block dark:text-gray-200 mt-4 mb-[-2]">
                {`${t('speedLimit')}:`}
                {biteVal === 0
                  ? ` ${t('noLimit')}`
                  : ` (${biteVal} ${biteUnitVal})`}
              </label>
              <div className="flex gap-4 items-center">
                <div className="flex-1">
                  <Slider
                    defaultValue={[biteVal]}
                    value={[biteVal]}
                    onValueChange={(value) => setbiteVal(value[0])}
                    max={200}
                    step={1}
                  />
                </div>

                <div className="w-48">
                  <select
                    value={biteUnit}
                    onChange={(e) => {
                      setBiteUnit(e.target.value);
                      const selectedBite = biteOptions.find(
                        (bite) => bite.biteDisplayName === e.target.value,
                      );
                      if (selectedBite) {
                        setBiteUnitVal(selectedBite.biteUnitVal);
                      }
                    }}
                    className="w-full border rounded-md px-3 py-2 dark:bg-darkMode dark:text-gray-200 dark:border-inputDarkModeBorder outline-none [&>option]:dark:bg-darkMode"
                  >
                    {biteOptions.map((bite) => (
                      <option
                        key={bite.biteUnitVal}
                        value={bite.biteDisplayName}
                        className="dark:bg-darkMode dark:text-gray-200"
                      >
                        {bite.biteDisplayName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            {/* End of Schedule Name */}
            {/* Download Location Name */}
            <div className="flex gap-4 pt-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="connection-limits"
                    checked={isConnectionLimitEnabled}
                    onChange={(e) =>
                      setIsConnectionLimitEnabled(e.target.checked)
                    }
                    className="w-4 h-4 text-primary rounded focus:ring-primary"
                  />
                  <label
                    htmlFor="connection-limits"
                    className="text-[13px] block dark:text-gray-200 text-nowrap font-bold cursor-pointer"
                  >
                    {t('connectionLimits')}
                  </label>
                  <hr className="flex-grow border-t-1 border-divider dark:border-gray-700 ml-2" />
                </div>
                <div
                  className={
                    isConnectionLimitEnabled
                      ? ''
                      : 'opacity-50 pointer-events-none'
                  }
                >
                  <div className="flex flex-row items-center gap-4 ml-2">
                    <label className="flex-1 dark:text-gray-200">
                      {t('maxActiveDownloads')}
                    </label>
                    <select
                      value={maxDownload}
                      onChange={(e) => setMaxDownload(Number(e.target.value))}
                      className="w-24 border rounded-md px-3 py-2 dark:bg-darkMode dark:text-gray-200 dark:border-inputDarkModeBorder outline-none [&>option]:dark:bg-darkMode"
                      disabled={!isConnectionLimitEnabled}
                    >
                      {[...Array(10)].map((_, index) => (
                        <option key={index} value={index + 1}>
                          {index + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            {/* End of Download Location Name */}
          </div>

          {/* background running toggle */}
          <div className="pt-3">
            <div className="flex items-center gap-2 mb-2">
              <label className="block dark:text-gray-200 text-nowrap font-bold">
                {t('appBehavior')}
              </label>
              <hr className="flex-grow border-t-1 border-divider dark:border-gray-700 ml-2" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6 gap-y-3 mt-3 ml-2">
              {/* Run in background toggle */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="run-in-background"
                    checked={runInBackground}
                    onChange={(e) => {
                      setRunInBackground(e.target.checked);
                    }}
                    className="w-4 h-4 text-primary rounded focus:ring-primary"
                  />
                  <label
                    htmlFor="run-in-background"
                    className="dark:text-gray-200 cursor-pointer"
                  >
                    {t('runInBackground')}
                  </label>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 ml-6 hidden sm:block h-sm1:hidden">
                  {t('runInBackgroundDesc')}
                </div>
              </div>

              {/* Clipboard monitoring toggle */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="clipboard-monitoring"
                    checked={enableClipboardMonitoring}
                    onChange={(e) => {
                      setEnableClipboardMonitoring(e.target.checked);
                      toast({
                        title: e.target.checked
                          ? t('toast.clipboardEnabled')
                          : t('toast.clipboardDisabled'),
                        description: t('toast.clipboardDesc'),
                        duration: 5000,
                      });
                    }}
                    className="w-4 h-4 text-primary rounded focus:ring-primary"
                  />
                  <label
                    htmlFor="clipboard-monitoring"
                    className="dark:text-gray-200 cursor-pointer"
                  >
                    {t('clipboardMonitoring')}
                  </label>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 ml-6 hidden sm:block h-sm1:hidden">
                  {t('clipboardMonitoringDesc')}
                </div>
              </div>

              {/* Telemetry setting */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="telemetry-enabled"
                    checked={telemetrySettings.telemetryEnabled}
                    onChange={(e) => {
                      updateTelemetryEnabled(e.target.checked);
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
                    className="w-4 h-4 text-primary rounded focus:ring-primary"
                  />
                  <label
                    htmlFor="telemetry-enabled"
                    className="dark:text-gray-200 cursor-pointer"
                  >
                    {t('telemetry')}
                  </label>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 ml-6 hidden lg:block h-sm1:hidden">
                  {t('telemetryDesc')}
                </div>
              </div>

              {/* Update notification settings */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
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
                    className="w-4 h-4 text-primary rounded focus:ring-primary"
                  />
                  <label
                    htmlFor="enable-app-updates"
                    className="dark:text-gray-200 cursor-pointer"
                  >
                    {t('appUpdates')}
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* column visibility section */}
          <div className="pt-3">
            <div className="flex items-center gap-2 mb-2">
              <label className="block dark:text-gray-200 text-nowrap font-bold">
                {t('visibleColumns')}
              </label>
              <hr className="flex-grow border-t-1 border-divider dark:border-gray-700 ml-2" />
            </div>

            <div className="grid grid-cols-5 gap-1 mt-2 ml-2">
              {columnOptions.map((column) => (
                <div key={column.id} className="flex items-start mr-2">
                  <input
                    type="checkbox"
                    id={`column-${column.id}`}
                    checked={
                      localVisibleColumns.includes(column.id) || column.required
                    }
                    onChange={() =>
                      column.required ? null : handleToggleColumn(column.id)
                    }
                    disabled={column.required}
                    style={{
                      width: '13.5px',
                      height: '13.5px',
                      marginTop: '1px',
                      marginLeft: '0.5px',
                      flexShrink: 0,
                      accentColor: column.required ? '#ef4444' : '#3b82f6',
                      transform: 'scale(0.9)',
                      transformOrigin: 'center',
                    }}
                    className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-blue-500 mr-2"
                  />
                  <label
                    htmlFor={`column-${column.id}`}
                    className={`dark:text-gray-200 mr-2 text-xs cursor-pointer ${
                      column.required ? 'font-semibold' : ''
                    }`}
                  >
                    {column.label}
                    {column.required && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                        {t('required')}
                      </span>
                    )}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Language section */}
          <div className="pt-3">
            <div className="flex items-center gap-2 mb-2">
              <label className="block dark:text-gray-200 text-nowrap font-bold">
                {t('language')}
              </label>
              <hr className="flex-grow border-t-1 border-divider dark:border-gray-700 ml-2" />
            </div>
            <div className="ml-2">
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className="w-48 border rounded-md px-3 py-2 dark:bg-darkMode dark:text-gray-200 dark:border-inputDarkModeBorder outline-none [&>option]:dark:bg-darkMode"
              >
                {languageOptions.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>
      </BaseModal>
    </>
  );
};

export default SettingsModal;
