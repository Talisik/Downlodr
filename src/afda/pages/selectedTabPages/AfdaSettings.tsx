import { useAfdaSubscriptionsStore } from '@/afda/store/afdaSubscriptionsStore';
import { useAfdaWebsitesStore } from '@/afda/store/afdaWebsitesStore';
import { config } from '@/core-app/client/config';
import { useToast } from '@/core-app/components/shadcn/hooks/use-toast';
import { TelemetryService } from '@/core-app/telemetry/utils/telemetryService';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { TbClock } from 'react-icons/tb';
import {
  LuDownload,
  LuStar,
  LuCopy,
  LuFileText,
  LuFolderOpen,
  LuChevronDown,
} from 'react-icons/lu';

type FrequencyInterval = '15 min' | '1 hour' | '6 hours' | 'Daily';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const FREQUENCY_OPTIONS = [
  'Every 15 minutes',
  'Every 1 hour',
  'Every 6 hours',
  'Daily',
] as const;

const FREQUENCY_TO_INTERVAL: Record<string, FrequencyInterval> = {
  'Every 15 minutes': '15 min',
  'Every 1 hour': '1 hour',
  'Every 6 hours': '6 hours',
  'Daily': 'Daily',
};

function toScheduleConfig(interval: FrequencyInterval) {
  return {
    type: 'interval_window' as const,
    days: ALL_DAYS,
    intervals: [{ from: 0, to: 23, interval, timezone: 'UTC' }],
  };
}

const SELECT_CLASS =
  'appearance-none bg-[#0000000D] dark:bg-darkModeCompliment border border-[#E8E8E8] dark:border-darkModeCompliment text-black dark:text-gray-100 px-2.5 pr-7 rounded-md text-xs h-7 min-w-[180px]';

const SelectWrapper = ({ children }: { children: ReactNode }) => (
  <div className="relative inline-flex items-center">
    {children}
    <LuChevronDown
      size={13}
      strokeWidth={1.5}
      color="#818181"
      className="absolute right-2 pointer-events-none"
    />
  </div>
);

const INPUT_CLASS =
  'bg-[#0000000D] dark:bg-darkModeCompliment border border-[#E8E8E8] dark:border-darkModeCompliment text-black dark:text-gray-100 px-2.5 rounded-md text-xs h-7 w-[260px]';

interface SettingsSnapshot {
  saveLocation: string;
  checkFrequency: string;
  downloadQuality: string;
  downloadPriority: string;
  lookbackPeriod: string;
  fileNamingFormat: string;
}

interface AfdaSettingsProps {
  channelId: string | undefined;
}

const SettingRow = ({
  icon,
  label,
  extra,
  control,
}: {
  icon: ReactNode;
  label: string;
  extra?: ReactNode;
  control: ReactNode;
}) => (
  <div className="flex items-center justify-between py-2">
    <div className="flex items-center gap-3">
      <span className="text-primary">{icon}</span>
      <span className="text-[13px] text-gray-700 dark:text-gray-300">
        {label}
      </span>
    </div>
    <div className="flex items-center gap-3">
      {extra}
      {control}
    </div>
  </div>
);

const AfdaSettings = ({ channelId }: AfdaSettingsProps) => {
  const { t } = useTranslation('skedulosa');
  const { toast } = useToast();
  const getAfdaSubscription = useAfdaSubscriptionsStore(
    (s) => s.getAfdaSubscription,
  );
  const updateAfdaSubscription = useAfdaSubscriptionsStore(
    (s) => s.updateAfdaSubscription,
  );
  const websites = useAfdaWebsitesStore((s) => s.websites);

  const [saveLocation, setSaveLocation] = useState('');
  const [checkFrequency, setCheckFrequency] = useState('Every 1 hour');
  const [downloadQuality, setDownloadQuality] = useState('Best Available');
  const [downloadPriority, setDownloadPriority] = useState('Normal');
  const [lookbackPeriod, setLookbackPeriod] = useState('Keep All Downloads');
  const [fileNamingFormat, setFileNamingFormat] = useState(
    '{channel}_{title}_{date}',
  );
  const [savedSnapshot, setSavedSnapshot] = useState<SettingsSnapshot | null>(
    null,
  );

  useEffect(() => {
    if (!channelId) return;
    const sub = getAfdaSubscription(channelId);
    if (!sub) return;
    const s = sub.settings[0];

    const snap: SettingsSnapshot = {
      saveLocation: s?.save_location ?? '',
      checkFrequency: FREQUENCY_OPTIONS.includes(s?.frequency as any)
        ? s!.frequency
        : 'Every 1 hour',
      downloadQuality: s?.download_quality ?? 'Best Available',
      downloadPriority: s?.download_priority ?? 'Normal',
      lookbackPeriod: s?.lookback_period ?? 'Keep All Downloads',
      fileNamingFormat: s?.file_naming_format ?? '{channel}_{title}_{date}',
    };

    setSaveLocation(snap.saveLocation);
    setCheckFrequency(snap.checkFrequency);
    setDownloadQuality(snap.downloadQuality);
    setDownloadPriority(snap.downloadPriority);
    setLookbackPeriod(snap.lookbackPeriod);
    setFileNamingFormat(snap.fileNamingFormat);
    setSavedSnapshot(snap);
  }, [channelId, getAfdaSubscription]);

  const hasChanges =
    savedSnapshot !== null &&
    (saveLocation !== savedSnapshot.saveLocation ||
      checkFrequency !== savedSnapshot.checkFrequency ||
      downloadQuality !== savedSnapshot.downloadQuality ||
      downloadPriority !== savedSnapshot.downloadPriority ||
      lookbackPeriod !== savedSnapshot.lookbackPeriod ||
      fileNamingFormat !== savedSnapshot.fileNamingFormat);

  const handleSave = async () => {
    if (!channelId) return;
    const sub = getAfdaSubscription(channelId);
    if (!sub) return;

    const updatedSettings =
      sub.settings.length > 0
        ? sub.settings.map((s, i) =>
            i === 0
              ? {
                  ...s,
                  save_location: saveLocation,
                  frequency: checkFrequency,
                  download_quality: downloadQuality,
                  download_priority: downloadPriority,
                  lookback_period: lookbackPeriod,
                  file_naming_format: fileNamingFormat,
                }
              : s,
          )
        : [
            {
              frequency: checkFrequency,
              download_quality: downloadQuality,
              save_location: saveLocation,
              download_priority: downloadPriority,
              lookback_period: lookbackPeriod,
              file_naming_format: fileNamingFormat,
            },
          ];

    updateAfdaSubscription(channelId, { ...sub, settings: updatedSettings });

    const snap = {
      saveLocation,
      checkFrequency,
      downloadQuality,
      downloadPriority,
      lookbackPeriod,
      fileNamingFormat,
    };
    setSavedSnapshot(snap);

    // Sync the new schedule to the backend for all sections of this website
    const bridge =
      typeof window !== 'undefined' ? (window as any).afdaBridge : undefined;
    const interval = FREQUENCY_TO_INTERVAL[checkFrequency];
    if (bridge && interval) {
      const website = websites.find((w) => w.id === channelId);
      if (website?.sections?.length) {
        const scheduleConfig = toScheduleConfig(interval);
        const results: PromiseSettledResult<unknown>[] =
          await Promise.allSettled(
            website.sections.map((s: { id: string }) =>
              bridge.schedule.assign({
                section_id: parseInt(s.id),
                config: scheduleConfig,
              }),
            ),
          );

        const failures = results.filter(
          (r): r is PromiseRejectedResult => r.status === 'rejected',
        );
        if (failures.length > 0) {
          console.error(
            `[afda] Schedule sync failed for ${failures.length}/${results.length} section(s):`,
            failures.map((f) => f.reason),
          );
          // Non-blocking telemetry report — mirrors the pattern in lifecycleActions.ts
          setTimeout(async () => {
            try {
              const telemetryService = new TelemetryService({
                apiEndpoint: config.telemetry.endpoint,
              });
              await telemetryService.init();
              const message = failures
                .map((f) =>
                  f.reason instanceof Error
                    ? f.reason.message
                    : String(f.reason),
                )
                .join('; ');
              await telemetryService.sendDownloadError({
                error: new Error(message),
                logMessage: `AFDA schedule sync failed for ${failures.length}/${results.length} section(s) of channel ${channelId}: ${message}`,
                downloadContext: {
                  downloadName: `[afda] schedule sync (${channelId})`,
                  location: 'afda',
                },
              });
            } catch (telemetryError) {
              console.error('Failed to send AFDA telemetry:', telemetryError);
            }
          }, 0);
        }
      }
    }

    toast({
      title: t('settingsTab.toast.saved'),
      description: t('settingsTab.toast.savedDesc'),
      duration: 5000,
    });
  };

  if (!channelId) {
    return (
      <div className="p-4 text-xs text-gray-500">
        {t('settingsTab.noChannelSelected')}
      </div>
    );
  }

  return (
    <div className="py-4 pl-6 pr-10 space-y-2">
      {/* Download Behavior */}
      <p className="text-[13px] text-gray-400 dark:text-gray-500">
        Download Behavior
      </p>
      <div className="ml-4">
        <SettingRow
          icon={<TbClock size={18} />}
          label="Check frequency"
          extra={
            <button
              type="button"
              className="text-[11px] text-primary underline underline-offset-2 hover:opacity-75"
            >
              Set manually
            </button>
          }
          control={
            <SelectWrapper>
              <select
                value={checkFrequency}
                onChange={(e) => setCheckFrequency(e.target.value)}
                className={SELECT_CLASS}
              >
                {FREQUENCY_OPTIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </SelectWrapper>
          }
        />
        <SettingRow
          icon={<LuDownload size={17} />}
          label="Download Quality"
          control={
            <SelectWrapper>
              <select
                value={downloadQuality}
                onChange={(e) => setDownloadQuality(e.target.value)}
                className={SELECT_CLASS}
              >
                {[
                  'Best Available',
                  'High Quality',
                  'Medium Quality',
                  'Low Quality',
                ].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </SelectWrapper>
          }
        />
        <SettingRow
          icon={<LuFolderOpen size={17} />}
          label="Save Location"
          control={
            <input
              type="text"
              value={saveLocation}
              onChange={(e) => setSaveLocation(e.target.value)}
              placeholder="~/Downloads/Articles"
              className={INPUT_CLASS}
            />
          }
        />
      </div>

      {/* Storage and Retention */}
      <p className="text-[13px] text-gray-400 dark:text-gray-500 mt-5">
        Storage and Retention
      </p>
      <div className="ml-4">
        <SettingRow
          icon={<LuStar size={17} />}
          label="Download Priority"
          control={
            <SelectWrapper>
              <select
                value={downloadPriority}
                onChange={(e) => setDownloadPriority(e.target.value)}
                className={SELECT_CLASS}
              >
                {['Low', 'Normal', 'High'].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </SelectWrapper>
          }
        />
        <SettingRow
          icon={<LuCopy size={16} />}
          label="Lookback Period"
          control={
            <SelectWrapper>
              <select
                value={lookbackPeriod}
                onChange={(e) => setLookbackPeriod(e.target.value)}
                className={SELECT_CLASS}
              >
                {[
                  'Keep All Downloads',
                  'Last 7 days',
                  'Last 30 days',
                  'Last 90 days',
                  'Last 1 year',
                ].map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </SelectWrapper>
          }
        />
        <SettingRow
          icon={<LuFileText size={17} />}
          label="File Naming Format"
          control={
            <input
              type="text"
              value={fileNamingFormat}
              onChange={(e) => setFileNamingFormat(e.target.value)}
              className={INPUT_CLASS}
            />
          }
        />
      </div>

      <div className="sticky bottom-0 flex justify-end py-3 mt-4 bg-white dark:bg-darkMode">
        <button
          onClick={handleSave}
          disabled={!hasChanges}
          className="px-4 py-1.5 text-xs rounded-md bg-primary text-white hover:opacity-90 dark:hover:opacity-75 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('editModal.save')}
        </button>
      </div>
    </div>
  );
};

export default AfdaSettings;
