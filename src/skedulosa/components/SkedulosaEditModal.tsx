import { ToggleGroup } from '@/core-app/components/shadcn/components/ui/toggle-group';
import BaseModal from '@/downlodr/components/modal/BaseModal';
import type {
  ScheduleDay,
  Subscription,
} from '@/skedulosa/store/skedulosaStore';
import { useSkedulosaStore } from '@/skedulosa/store/skedulosaStore';
import { Folder } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

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

interface EditModalSnapshot {
  channelName: string;
  channelUrl: string;
  status: string;
  recurring: boolean;
  selectedDays: string[];
  quality: string;
  saveLocation: string;
  lookbackPeriod: string;
}

interface SkedulosaEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriptionId: string;
}

const SkedulosaEditModal = ({
  isOpen,
  onClose,
  subscriptionId,
}: SkedulosaEditModalProps) => {
  const { t } = useTranslation('skedulosa');

  const DAYS_OPTIONS = [
    { label: t('editModal.days.mon'), value: 'mon' },
    { label: t('editModal.days.tue'), value: 'tue' },
    { label: t('editModal.days.wed'), value: 'wed' },
    { label: t('editModal.days.thu'), value: 'thu' },
    { label: t('editModal.days.fri'), value: 'fri' },
    { label: t('editModal.days.sat'), value: 'sat' },
    { label: t('editModal.days.sun'), value: 'sun' },
  ];

  const QUALITY_OPTIONS = [
    { value: 'Lowest Quality', label: t('editModal.quality.lowest') },
    { value: 'Low Quality', label: t('editModal.quality.low') },
    { value: 'Best Quality', label: t('editModal.quality.best') },
  ];

  const STATUS_OPTIONS = [
    { value: 'Active', label: t('editModal.status.active') },
    { value: 'Paused', label: t('editModal.status.paused') },
    { value: 'Error', label: t('editModal.status.error') },
    { value: 'Needs Attention', label: t('editModal.status.needsAttention') },
  ];

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
  const [isSelectingDir, setIsSelectingDir] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState<EditModalSnapshot | null>(null);

  // Seed form from store whenever the modal opens
  useEffect(() => {
    if (!isOpen) return;
    const sub = getSubscription(subscriptionId);
    if (!sub) return;
    const days = sub.schedule_time.map((t) => DAY_FULL_TO_ABBREV[t.day] ?? 'sun');
    const settings = sub.settings[0];
    const quality = settings?.download_quality ?? 'Best Quality';
    const saveLocation = settings?.save_location ?? '';
    const lookbackPeriod = settings?.lookback_period ?? '';

    setChannelName(sub.source);
    setChannelUrl(sub.sourceUrl);
    setStatus(sub.status);
    setRecurring(sub.recurring);
    setSelectedDays(days);
    setQuality(quality);
    setSaveLocation(saveLocation);
    setLookbackPeriod(lookbackPeriod);

    setSavedSnapshot({
      channelName: sub.source,
      channelUrl: sub.sourceUrl,
      status: sub.status,
      recurring: sub.recurring,
      selectedDays: days,
      quality,
      saveLocation,
      lookbackPeriod,
    });
  }, [isOpen, subscriptionId, getSubscription]);

  const hasChanges = savedSnapshot !== null && (
    channelName !== savedSnapshot.channelName ||
    channelUrl !== savedSnapshot.channelUrl ||
    status !== savedSnapshot.status ||
    recurring !== savedSnapshot.recurring ||
    quality !== savedSnapshot.quality ||
    saveLocation !== savedSnapshot.saveLocation ||
    lookbackPeriod !== savedSnapshot.lookbackPeriod ||
    [...selectedDays].sort().join(',') !== [...savedSnapshot.selectedDays].sort().join(',')
  );

  const handleSave = async () => {
    const sub = getSubscription(subscriptionId);
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
      })),
      settings: updatedSettings,
    };

    // Update Zustand store (also resyncs scheduledChannels)
    updateSubscription(subscriptionId, updatedSub);

    // Update toolkit SQLite in parallel if IDs exist
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
        await Promise.all(toolkitCalls).catch((err) =>
          console.error('[SkedulosaEditModal] Toolkit update failed:', err),
        );
      }
    }

    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('editModal.title')}
      width="max-w-xl"
      footer={
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs rounded-md border border-gray-300 dark:border-darkModeCompliment text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-darkModeCompliment/50"
          >
            {t('editModal.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges || channelName.trim() === ''}
            className="px-4 py-1.5 text-xs rounded-md bg-primary text-white hover:opacity-90 dark:hover:opacity-75 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('editModal.save')}
          </button>
        </div>
      }
    >
      <div className="py-4 space-y-4 text-[12.5px]">
        {/* Channel Name */}
        <div className="space-y-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">
            {t('editModal.channelName')}
          </label>
          <input
            type="text"
            value={channelName}
            onChange={(e) => setChannelName(e.target.value)}
            required
            className="w-full bg-[#0000000D] dark:bg-darkModeCompliment border border-[#E8E8E8] dark:border-darkModeCompliment text-black dark:text-gray-100 px-2.5 py-1.5 rounded-md text-xs h-8"
          />
          {channelName.trim() === '' && (
            <span className="text-red-500 text-[10px]">{t('editModal.channelNameRequired')}</span>
          )}
        </div>

        {/* Channel URL */}
        <div className="space-y-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">
            {t('editModal.channelUrl')}
          </label>
          <input
            type="text"
            value={channelUrl}
            readOnly
            className="w-full bg-[#0000000D] dark:bg-darkModeCompliment border border-[#E8E8E8] dark:border-darkModeCompliment text-black dark:text-gray-100 px-2.5 py-1.5 rounded-md text-xs h-8 cursor-default select-all opacity-70"
          />
        </div>

        {/* Status + Recurring row */}
        <div className="flex gap-4">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-gray-500 dark:text-gray-400">
              {t('editModal.statusLabel')}
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-[#0000000D] dark:bg-darkModeCompliment border border-[#E8E8E8] dark:border-darkModeCompliment text-black dark:text-gray-100 px-2.5 py-1.5 rounded-md text-xs h-8"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2 pb-1">
            <input
              id="edit-recurring"
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
              className="accent-primary"
            />
            <label
              htmlFor="edit-recurring"
              className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer"
            >
              {t('editModal.recurring')}
            </label>
          </div>
        </div>

        {/* Schedule Days */}
        <div className="space-y-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">
            {t('editModal.scheduleDays')}
          </label>
          <ToggleGroup
            type="multiple"
            options={DAYS_OPTIONS}
            value={selectedDays}
            onChange={(v) => setSelectedDays(v as string[])}
          />
        </div>

        {/* Download Quality */}
        <div className="space-y-1">
          <label className="text-xs text-gray-500 dark:text-gray-400">
            {t('editModal.downloadQuality')}
          </label>
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            className="w-full bg-[#0000000D] dark:bg-darkModeCompliment border border-[#E8E8E8] dark:border-darkModeCompliment text-black dark:text-gray-100 px-2.5 py-1.5 rounded-md text-xs h-8"
          >
            {QUALITY_OPTIONS.map((q) => (
              <option key={q.value} value={q.value}>
                {q.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </BaseModal>
  );
};

export default SkedulosaEditModal;
