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
import { useTaskbarDownloadStore } from '@/downlodr/store/taskbarDownloadStore';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '../BaseModal';
import AdvancedSettingsModal from './AdvancedSettingsModal';
import {
  BTN,
  BTN_PRIMARY,
  CHECKBOX,
  FIELD_LABEL,
  INPUT,
  OPTION_HELP,
  OPTION_LABEL,
  RULE_LINE,
  SECTION_HEADING,
  SectionRule,
  SELECT,
} from './settingsUi';

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
    updateLanguage,
  } = useSettingStore();

  const { visibleColumns, setVisibleColumns } = useMainStore();

  // Advanced settings live in their own modal, opened from the footer. It is
  // rendered alongside this modal rather than inside it, so it survives this
  // modal closing on the way there.
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

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

  // Advanced settings replaces this modal rather than stacking on top of it.
  const handleOpenAdvanced = () => {
    handleClose();
    setIsAdvancedOpen(true);
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
    // Sync downloadLocation when it gets populated by store rehydration
    setDownloadLocation(settings.defaultLocation);
  }, [
    settings.runInBackground,
    settings.enableClipboardMonitoring,
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

  const requiredColumns = columnOptions.filter((column) => column.required);
  const optionalColumns = columnOptions.filter((column) => !column.required);

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
    // Update visible columns — the required ones have no checkbox to keep
    // them in the local list, so they're merged back in here.
    setVisibleColumns([
      ...new Set([
        ...localVisibleColumns,
        ...requiredColumns.map((column) => column.id),
      ]),
    ]);

    updateRunInBackground(runInBackground);
    // Also update the main process directly
    if (window.backgroundSettings?.setRunInBackground) {
      window.backgroundSettings.setRunInBackground(runInBackground);
    }

    updateEnableClipboardMonitoring(enableClipboardMonitoring);

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
        width="max-w-2xl"
        contentClassName="p-6 max-h-[65vh] overflow-y-none"
        footer={
          <div className="flex items-center justify-between gap-3 p-2">
            <button
              type="button"
              onClick={handleOpenAdvanced}
              className={BTN_PRIMARY}
            >
              {t('advanced.button')}
            </button>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleSubmit}
                className={BTN_PRIMARY}
              >
                {t('common:buttons.save')}
              </button>
              <button type="button" onClick={handleClose} className={BTN}>
                {t('common:buttons.cancel')}
              </button>
            </div>
          </div>
        }
      >
        <form onSubmit={(e) => e.preventDefault()}>
          <div className="space-y-2">
            {/* Download location — label sits beside the picker, which takes
                the rest of the row so long paths stay readable. */}
            <div className="flex items-center gap-4 -mt-6">
              <label className={`${FIELD_LABEL} text-nowrap`}>
                {t('downloadLocation')}
              </label>
              <input
                type="text"
                placeholder={t('downloadLocation')}
                value={downloadLocation}
                onClick={handleDirectory}
                className={`${INPUT} cursor-pointer`}
                readOnly
              />
            </div>

            {/* Speed limit */}
            <div>
              <label className={`${FIELD_LABEL} block mt-4 mb-[-2]`}>
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
                    className={SELECT}
                  >
                    {biteOptions.map((bite) => (
                      <option
                        key={bite.biteUnitVal}
                        value={bite.biteDisplayName}
                      >
                        {bite.biteDisplayName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Connection limits — the checkbox doubles as this section's heading */}
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
                    className={CHECKBOX}
                  />
                  <label
                    htmlFor="connection-limits"
                    className={SECTION_HEADING}
                  >
                    {t('connectionLimits')}
                  </label>
                  <hr className={RULE_LINE} />
                </div>
                <div
                  className={
                    isConnectionLimitEnabled
                      ? ''
                      : 'opacity-50 pointer-events-none'
                  }
                >
                  <div className="flex flex-row items-center gap-4 ml-2">
                    <label className={`flex-1 ${FIELD_LABEL}`}>
                      {t('maxActiveDownloads')}
                    </label>
                    {/* SELECT carries w-full, so the width lives on this
                        wrapper — the label keeps the rest of the row. */}
                    <div className="w-48 shrink-0">
                      <select
                        value={maxDownload}
                        onChange={(e) => setMaxDownload(Number(e.target.value))}
                        disabled={!isConnectionLimitEnabled}
                        className={`${SELECT} ${
                          !isConnectionLimitEnabled
                            ? 'opacity-50 pointer-events-none'
                            : ''
                        }`}
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
            </div>
          </div>

          {/* Application behavior */}
          <SectionRule label={t('appBehavior')} />

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
                  className={CHECKBOX}
                />
                <label htmlFor="run-in-background" className={OPTION_LABEL}>
                  {t('runInBackground')}
                </label>
              </div>
              <div
                className={`${OPTION_HELP} ml-6 hidden sm:block h-sm1:hidden`}
              >
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
                  className={CHECKBOX}
                />
                <label htmlFor="clipboard-monitoring" className={OPTION_LABEL}>
                  {t('clipboardMonitoring')}
                </label>
              </div>
              <div
                className={`${OPTION_HELP} ml-6 hidden sm:block h-sm1:hidden`}
              >
                {t('clipboardMonitoringDesc')}
              </div>
            </div>
          </div>

          {/* Column visibility */}
          <SectionRule label={t('visibleColumns')} />

          {/* The required columns aren't toggles at all, so they're listed as
              plain copy instead of disabled checkboxes — the grid below then
              holds only the columns that can actually be switched. 
          <div className={`${OPTION_HELP} mt-2 ml-2`}>
            {`${t('required')}: ${requiredColumns
              .map((column) => column.label)
              .join(' · ')}`}
          </div>
*/}
          {/* Three even tracks, not five: a fifth-width track was too narrow
              for "Closed Captions" and broke it over two lines, while sizing
              each item to its own label left the checkboxes ragged. */}
          <div className="grid grid-cols-3 gap-x-4 gap-y-2 mt-2 ml-2">
            {optionalColumns.map((column) => (
              <div key={column.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`column-${column.id}`}
                  checked={localVisibleColumns.includes(column.id)}
                  onChange={() => handleToggleColumn(column.id)}
                  className={`${CHECKBOX} shrink-0`}
                />
                <label
                  htmlFor={`column-${column.id}`}
                  className="dark:text-gray-200 text-xs cursor-pointer whitespace-nowrap"
                >
                  {column.label}
                </label>
              </div>
            ))}
          </div>

          {/* Language — the heading doubles as this row's label, with the
              dropdown pushed out to the far end of the row. */}
          <div className="flex items-center gap-2 mt-4 mb-2">
            <label className="block dark:text-gray-200 text-nowrap font-bold">
              {t('language')}
            </label>
            <div className="w-48 shrink-0 ml-auto">
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
                className={SELECT}
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

      <AdvancedSettingsModal
        isOpen={isAdvancedOpen}
        onClose={() => setIsAdvancedOpen(false)}
      />
    </>
  );
};

export default SettingsModal;
