import { ToggleGroup } from '@/core-app/components/shadcn/components/ui/toggle-group';
import { useToast } from '@/core-app/components/shadcn/hooks/use-toast';
import type {
  ScheduleDay,
  Subscription,
} from '@/skedulosa/store/skedulosaStore';
import { useSkedulosaStore } from '@/skedulosa/store/skedulosaStore';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

const QUALITY_KEYS = ['lowest', 'low', 'best'] as const;
type QualityKey = (typeof QUALITY_KEYS)[number];

const QUALITY_VALUES: Record<QualityKey, string> = {
  lowest: 'Lowest Quality',
  low: 'Low Quality',
  best: 'Best Quality',
};

const STATUS_KEYS = ['active', 'paused', 'error', 'needsAttention'] as const;
type StatusKey = (typeof STATUS_KEYS)[number];

const STATUS_VALUES: Record<StatusKey, string> = {
  active: 'Active',
  paused: 'Paused',
  error: 'Error',
  needsAttention: 'Needs Attention',
};

const TIMEZONE_OPTIONS = [
  { label: 'UTC', value: 'UTC' },
  { label: 'America/New_York', value: 'America/New_York' },
  { label: 'America/Los_Angeles', value: 'America/Los_Angeles' },
  { label: 'Europe/London', value: 'Europe/London' },
  { label: 'Europe/Paris', value: 'Europe/Paris' },
  { label: 'Asia/Tokyo', value: 'Asia/Tokyo' },
];

const DAY_ABBREV_TO_FULL: Record<string, ScheduleDay> = {
  sun: 'Sunday',
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
};

const DAY_FULL_TO_ABBREV: Record<ScheduleDay, string> = {
  Sunday: 'sun',
  Monday: 'mon',
  Tuesday: 'tue',
  Wednesday: 'wed',
  Thursday: 'thu',
  Friday: 'fri',
  Saturday: 'sat',
};

interface SettingsSnapshot {
  channelName: string;
  channelUrl: string;
  status: string;
  recurring: boolean;
  selectedDays: string[];
  quality: string;
  saveLocation: string;
  lookbackPeriod: string;
  checkAtHour: string;
  timezone: string;
}

interface SettingsTabProps {
  channelId: string | undefined;
}

const SettingsTab = ({ channelId }: SettingsTabProps) => {
  const { t } = useTranslation('skedulosa');
  const { toast } = useToast();
  const getSubscription = useSkedulosaStore((s) => s.getSubscription);
  const updateSubscription = useSkedulosaStore((s) => s.updateSubscription);

  const [channelName, setChannelName] = useState('');
  const [channelUrl, setChannelUrl] = useState('');
  const [status, setStatus] = useState('Active');
  const [recurring, setRecurring] = useState(true);
  const [selectedDays, setSelectedDays] = useState<string[]>(['sun']);
  const [quality, setQuality] = useState('Best Quality');
  const [saveLocation, setSaveLocation] = useState('');
  const [lookbackPeriod, setLookbackPeriod] = useState('');
  const [checkAtHour, setCheckAtHour] = useState('6');
  const [timezone, setTimezone] = useState('UTC');
  const [savedSnapshot, setSavedSnapshot] = useState<SettingsSnapshot | null>(
    null,
  );

  const daysOptions = DAY_KEYS.map((key) => ({
    label: t(`editModal.days.${key}`),
    value: key,
  }));

  const qualityOptions = QUALITY_KEYS.map((key) => ({
    value: QUALITY_VALUES[key],
    label: t(`editModal.quality.${key}`),
  }));

  const statusOptions = STATUS_KEYS.map((key) => ({
    value: STATUS_VALUES[key],
    label: t(`editModal.status.${key}`),
  }));

  useEffect(() => {
    if (!channelId) return;
    const sub = getSubscription(channelId);
    if (!sub) return;
    const days = sub.schedule_time.map(
      (t) => DAY_FULL_TO_ABBREV[t.day] ?? 'sun',
    );
    const settings = sub.settings[0];
    const quality = settings?.download_quality ?? 'Best Quality';
    const saveLocation = settings?.save_location ?? '';
    const lookbackPeriod = settings?.lookback_period ?? '';
    const firstTime = sub.schedule_time[0]?.time_minutes;
    const checkAtHour =
      firstTime != null ? String(Math.floor(firstTime / 60) % 24) : '6';

    setChannelName(sub.source);
    setChannelUrl(sub.sourceUrl);
    setStatus(sub.status);
    setRecurring(sub.recurring);
    setSelectedDays(days);
    setQuality(quality);
    setSaveLocation(saveLocation);
    setLookbackPeriod(lookbackPeriod);
    setCheckAtHour(checkAtHour);

    setSavedSnapshot({
      channelName: sub.source,
      channelUrl: sub.sourceUrl,
      status: sub.status,
      recurring: sub.recurring,
      selectedDays: days,
      quality,
      saveLocation,
      lookbackPeriod,
      checkAtHour,
      timezone: 'UTC',
    });
  }, [channelId, getSubscription]);

  const hasChanges =
    savedSnapshot !== null &&
    (channelName !== savedSnapshot.channelName ||
      channelUrl !== savedSnapshot.channelUrl ||
      status !== savedSnapshot.status ||
      recurring !== savedSnapshot.recurring ||
      quality !== savedSnapshot.quality ||
      saveLocation !== savedSnapshot.saveLocation ||
      lookbackPeriod !== savedSnapshot.lookbackPeriod ||
      checkAtHour !== savedSnapshot.checkAtHour ||
      timezone !== savedSnapshot.timezone ||
      [...selectedDays].sort().join(',') !==
        [...savedSnapshot.selectedDays].sort().join(','));

  const handleSave = async () => {
    if (!channelId) return;
    const sub = getSubscription(channelId);
    if (!sub) return;

    const updatedSettings =
      sub.settings.length > 0
        ? sub.settings.map((s, i) =>
            i === 0
              ? {
                  ...s,
                  download_quality: quality,
                  save_location: saveLocation,
                  lookback_period: lookbackPeriod,
                }
              : s,
          )
        : [
            {
              frequency: '',
              download_quality: quality,
              save_location: saveLocation,
              download_priority: '',
              lookback_period: lookbackPeriod,
              file_naming_format: '',
            },
          ];

    const updatedSub: Subscription = {
      ...sub,
      source: channelName,
      sourceUrl: channelUrl,
      status,
      recurring,
      schedule_time: selectedDays.map((abbrev) => ({
        day: DAY_ABBREV_TO_FULL[abbrev] ?? 'Sunday',
        time_minutes: parseInt(checkAtHour, 10) * 60,
      })),
      settings: updatedSettings,
    };

    try {
      updateSubscription(channelId, updatedSub);

      const bridge = window.skedulosaBridge;
      if (bridge) {
        const toolkitCalls: Promise<unknown>[] = [];

        if (sub.toolkit_channel_id != null) {
          toolkitCalls.push(
            bridge.updateChannel(sub.toolkit_channel_id, {
              url: channelUrl,
              name: channelName,
            }),
          );
        }

        if (sub.toolkit_schedule_id != null) {
          toolkitCalls.push(
            bridge.updateSchedule(sub.toolkit_schedule_id, {
              name: channelName,
            }),
          );
        }

        if (toolkitCalls.length > 0) {
          await Promise.all(toolkitCalls);
        }
      }

      setSavedSnapshot({
        channelName,
        channelUrl,
        status,
        recurring,
        selectedDays,
        quality,
        saveLocation,
        lookbackPeriod,
        checkAtHour,
        timezone,
      });

      toast({
        title: t('settingsTab.toast.saved'),
        description: t('settingsTab.toast.savedDesc'),
        duration: 5000,
      });
    } catch (err) {
      console.error('[SkedulosaSettings] Save failed:', err);
      toast({
        variant: 'destructive',
        title: t('settingsTab.toast.failed'),
        description: t('settingsTab.toast.failedDesc'),
        duration: 5000,
      });
    }
  };

  if (!channelId) {
    return (
      <div className="p-4 text-xs text-gray-500">
        {t('settingsTab.noChannelSelected')}
      </div>
    );
  }

  return (
    <div className="py-4 space-y-4 text-[12.5px]">
      <h1 className="text-[13px]">{t('settingsTab.channelInfo')}</h1>

      {/* Channel Name */}
      <div className="flex flex-row justify-between items-center space-x-2">
        <div className="flex flex-col items-start gap-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">
            {t('editModal.channelName')}
          </label>
          {channelName.trim() === '' && (
            <span className="text-red-500 text-[10px]">
              {t('settingsTab.channelNameRequired')}
            </span>
          )}
        </div>
        <input
          type="text"
          value={channelName}
          onChange={(e) => setChannelName(e.target.value)}
          required
          className="w-1/5 bg-[#0000000D] dark:bg-darkModeCompliment border border-[#E8E8E8] dark:border-darkModeCompliment text-black dark:text-gray-100 px-2.5 py-1.5 rounded-md text-xs h-8"
        />
      </div>

      {/* Channel URL */}
      <div className="flex flex-row justify-between items-center space-x-2">
        <label className="text-xs text-gray-500 dark:text-gray-400">
          {t('editModal.channelUrl')}
        </label>
        <input
          type="text"
          value={channelUrl}
          readOnly
          className="w-1/5 bg-[#0000000D] dark:bg-darkModeCompliment border border-[#E8E8E8] dark:border-darkModeCompliment text-black dark:text-gray-100 px-2.5 py-1.5 rounded-md text-xs h-8 cursor-default select-all opacity-70"
        />
      </div>

      <h1 className="text-[13px]">{t('settingsTab.downloadBehavior')}</h1>

      {/* Status */}
      <div className="flex flex-row justify-between items-center space-x-2">
        <label className="text-xs text-gray-500 dark:text-gray-400">
          {t('editModal.statusLabel')}
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-1/5 bg-[#0000000D] dark:bg-darkModeCompliment border border-[#E8E8E8] dark:border-darkModeCompliment text-black dark:text-gray-100 px-2.5 py-1.5 rounded-md text-xs h-8"
        >
          {statusOptions.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Schedule Days + Time */}
      <div className="space-y-1 flex flex-row justify-between items-center border border-[#E8E8E8] dark:border-darkModeCompliment rounded-md px-3 py-2">
        <div className="flex flex-col items-start gap-1">
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {t('settingsTab.daysToCheck')}
          </label>
          <ToggleGroup
            type="multiple"
            options={daysOptions}
            value={selectedDays}
            onChange={(v) => setSelectedDays(v as string[])}
          />
        </div>
        {/* Time to check
        <div className="flex flex-col items-start gap-1">
          <label className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            Check at:
          </label>
          <select
            value={checkAtHour}
            onChange={(e) => setCheckAtHour(e.target.value)}
            className="bg-[#0000000D] dark:bg-darkModeCompliment border border-[#E8E8E8] dark:border-darkModeCompliment text-black dark:text-gray-100 px-2.5 py-1.5 rounded-md text-xs h-8"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={String(i)}>
                {String(i).padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </div>
        */}
      </div>
      {/*
      <div className="flex flex-row justify-between items-center space-x-2">
        <label className="text-xs text-gray-500 dark:text-gray-400">
          Timezone
        </label>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-1/5 bg-[#0000000D] dark:bg-darkModeCompliment border border-[#E8E8E8] dark:border-darkModeCompliment text-black dark:text-gray-100 px-2.5 py-1.5 rounded-md text-xs h-8"
        >
          {TIMEZONE_OPTIONS.map((tz) => (
            <option key={tz.value} value={tz.value}>
              {tz.label}
            </option>
          ))}
        </select>
      </div>
      */}

      {/* Download Quality */}
      <div className="flex flex-row justify-between items-center space-x-2">
        <label className="text-xs text-gray-500 dark:text-gray-400">
          {t('editModal.downloadQuality')}
        </label>
        <select
          value={quality}
          onChange={(e) => setQuality(e.target.value)}
          className="w-1/5 bg-[#0000000D] dark:bg-darkModeCompliment border border-[#E8E8E8] dark:border-darkModeCompliment text-black dark:text-gray-100 px-2.5 py-1.5 rounded-md text-xs h-8"
        >
          {qualityOptions.map((q) => (
            <option key={q.value} value={q.value}>
              {q.label}
            </option>
          ))}
        </select>
      </div>

      {/* Save button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={!hasChanges || channelName.trim() === ''}
          className="px-4 py-1.5 text-xs rounded-md bg-primary text-white hover:opacity-90 dark:hover:opacity-75 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {t('editModal.save')}
        </button>
      </div>
    </div>
  );
};

export default SettingsTab;
