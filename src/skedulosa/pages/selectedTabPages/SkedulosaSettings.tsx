import { ToggleGroup } from '@/core-app/components/shadcn/components/ui/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/core-app/components/shadcn/components/ui/tooltip';
import { useToast } from '@/core-app/components/shadcn/hooks/use-toast';
import type {
  ScheduleDay,
  Subscription,
} from '@/skedulosa/store/skedulosaStore';
import { useSkedulosaStore } from '@/skedulosa/store/skedulosaStore';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { TbCalendarTime } from 'react-icons/tb';
import { LuDownload, LuCopy, LuFolderOpen, LuLink, LuChevronDown, LuClock } from 'react-icons/lu';
import { HiOutlinePencilAlt } from 'react-icons/hi';
import { FaCircle } from 'react-icons/fa';

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

const DAY_ABBREV_TO_DOW: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

function formatHour(h: number): string {
  if (h === 0) return '12:00 AM';
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return '12:00 PM';
  return `${h - 12}:00 PM`;
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: formatHour(i),
}));

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
  const [isIntelligentSchedule, setIsIntelligentSchedule] = useState(false);
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
    const q = settings?.download_quality ?? 'Best Quality';
    const save = settings?.save_location ?? '';
    const lookback = settings?.lookback_period ?? '';
    const firstTime = sub.schedule_time[0]?.time_minutes;
    const hour =
      firstTime != null ? String(Math.floor(firstTime / 60) % 24) : '6';

    setChannelName(sub.source);
    setChannelUrl(sub.sourceUrl);
    setStatus(sub.status);
    setRecurring(sub.recurring);
    setSelectedDays(days);
    setQuality(q);
    setSaveLocation(save);
    setLookbackPeriod(lookback);
    setCheckAtHour(hour);
    setIsIntelligentSchedule(false);

    setSavedSnapshot({
      channelName: sub.source,
      channelUrl: sub.sourceUrl,
      status: sub.status,
      recurring: sub.recurring,
      selectedDays: days,
      quality: q,
      saveLocation: save,
      lookbackPeriod: lookback,
      checkAtHour: hour,
      timezone: 'UTC',
    });
  }, [channelId, getSubscription]);

  useEffect(() => {
    if (!channelId) return;
    const sub = getSubscription(channelId);
    if (!sub?.toolkit_channel_id) return;

    let cancelled = false;
    const bridge = window.skedulosaBridge;
    if (!bridge) return;

    bridge.getIntelligentSchedule(sub.toolkit_channel_id).then((schedule) => {
      if (!cancelled) setIsIntelligentSchedule(schedule != null);
    }).catch(() => {});

    return () => { cancelled = true; };
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
        if (sub.toolkit_channel_id != null)
          toolkitCalls.push(
            bridge.updateChannel(sub.toolkit_channel_id, {
              url: channelUrl,
              name: channelName,
            }),
          );
        if (sub.toolkit_schedule_id != null)
          toolkitCalls.push(
            bridge.updateSchedule(sub.toolkit_schedule_id, {
              name: channelName,
            }),
          );
        if (sub.toolkit_channel_id != null && !isIntelligentSchedule) {
          const timeMinutes = parseInt(checkAtHour, 10) * 60;
          const slots = selectedDays.map((abbrev) => ({
            day_of_week: DAY_ABBREV_TO_DOW[abbrev] ?? 0,
            time_minutes: timeMinutes,
          }));
          toolkitCalls.push(
            bridge.replaceChannelSlots(sub.toolkit_channel_id, slots),
          );
        }
        if (toolkitCalls.length > 0) await Promise.all(toolkitCalls);
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
    <div className="py-4 pl-6 pr-10 space-y-2">
      {/* Channel Info */}
      <p className="text-[13px] text-gray-400 dark:text-gray-500">
        {t('settingsTab.channelInfo')}
      </p>
      <div className="ml-4">
        <SettingRow
          icon={<HiOutlinePencilAlt size={17} />}
          label={t('editModal.channelName')}
          extra={
            channelName.trim() === '' ? (
              <span className="text-red-500 text-[10px]">
                {t('settingsTab.channelNameRequired')}
              </span>
            ) : undefined
          }
          control={
            <input
              type="text"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              required
              className={`${INPUT_CLASS}${
                channelName.trim() === '' ? ' border-red-400' : ''
              }`}
            />
          }
        />
        <SettingRow
          icon={<LuLink size={16} />}
          label={t('editModal.channelUrl')}
          control={
            <input
              type="text"
              value={channelUrl}
              readOnly
              className={`${INPUT_CLASS} cursor-default opacity-70`}
            />
          }
        />
      </div>

      {/* Download Behavior */}
      <p className="text-[13px] text-gray-400 dark:text-gray-500 mt-5">
        {t('settingsTab.downloadBehavior')}
      </p>
      <div className="ml-4">
        <SettingRow
          icon={<FaCircle size={10} />}
          label={t('editModal.statusLabel')}
          control={
            <SelectWrapper>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={SELECT_CLASS}
              >
                {statusOptions.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </SelectWrapper>
          }
        />
        <SettingRow
          icon={<TbCalendarTime size={17} />}
          label={t('settingsTab.daysToCheck')}
          control={
            <ToggleGroup
              type="multiple"
              options={daysOptions}
              value={selectedDays}
              onChange={(v) => setSelectedDays(v as string[])}
            />
          }
        />
        <SettingRow
          icon={<LuClock size={16} />}
          label={t('settingsTab.checkAtHour') ?? 'Check At Hour'}
          control={
            isIntelligentSchedule ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <SelectWrapper>
                      <select
                        value={checkAtHour}
                        disabled
                        className={`${SELECT_CLASS} opacity-40 cursor-not-allowed`}
                      >
                        {HOUR_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </SelectWrapper>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Only for manual schedules
                </TooltipContent>
              </Tooltip>
            ) : (
              <SelectWrapper>
                <select
                  value={checkAtHour}
                  onChange={(e) => setCheckAtHour(e.target.value)}
                  className={SELECT_CLASS}
                >
                  {HOUR_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </SelectWrapper>
            )
          }
        />
        <SettingRow
          icon={<LuDownload size={17} />}
          label={t('editModal.downloadQuality')}
          control={
            <SelectWrapper>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className={SELECT_CLASS}
              >
                {qualityOptions.map((q) => (
                  <option key={q.value} value={q.value}>
                    {q.label}
                  </option>
                ))}
              </select>
            </SelectWrapper>
          }
        />
        <SettingRow
          icon={<LuFolderOpen size={17} />}
          label={t('editModal.saveLocation') ?? 'Save Location'}
          control={
            <input
              type="text"
              value={saveLocation}
              onChange={(e) => setSaveLocation(e.target.value)}
              placeholder="~/Downloads"
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
          icon={<LuCopy size={16} />}
          label={t('editModal.lookbackPeriod') ?? 'Lookback Period'}
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
      </div>

      <div className="sticky bottom-0 flex justify-end py-3 mt-4 bg-white dark:bg-darkMode">
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
