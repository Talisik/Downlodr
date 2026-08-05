/**
 * Demo page that simulates all subscription-based and download-based utils
 * with dummy data. Grouped by: Schedule manager, Storage & counts, Per-subscription stats, Heat map.
 */
import type {
  ScheduleEntry,
  Subscription,
} from '@/skedulosa/store/skedulosaStore';
import { generateDummySubscription } from '@/skedulosa/utils/generateDummySubscription';
import {
  formatNextRun,
  formatProgress,
  formatSchedule,
  formatStatus,
  getScheduledDownloadsCountToday,
} from '@/skedulosa/utils/scheduleManagerUtils';
import {
  buildHeatMapFromSubscriptionDownloads,
  formatBytesToHuman,
  getAverageSizeBytesPerSubscription,
  getDownloadCountPerSubscription,
  getFinishedDownloadPercentPerSubscription,
  getLastDownloadedTimeAgoPerSubscription,
  getTotalStoragePerSubscription,
  getTotalStorageUsedBytes,
} from '@/skedulosa/utils/subscriptionDownloadUtils';
import { useCallback, useMemo, useState } from 'react';
import { FiRefreshCw } from 'react-icons/fi';

const DAY_TO_ABBREV: Record<string, string> = {
  Sunday: 'sun',
  Monday: 'mon',
  Tuesday: 'tue',
  Wednesday: 'wed',
  Thursday: 'thu',
  Friday: 'fri',
  Saturday: 'sat',
};

function subscriptionToScheduleEntries(sub: Subscription): ScheduleEntry[] {
  return sub.schedule_time.map((st) => ({
    scheduleId: `${sub.id}-${st.day}`,
    timezone: 'UTC',
    daysTocheck: [DAY_TO_ABBREV[st.day] ?? 'mon'],
    timeToCheck: '6',
    qualityPreset: sub.settings[0]?.download_quality ?? 'Best',
    lookbackPeriod: sub.settings[0]?.lookback_period ?? '7 days',
    saveLocation: sub.settings[0]?.save_location ?? '',
  }));
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-200 dark:border-darkModeCompliment bg-gray-50/50 dark:bg-darkModeCompliment/20 p-4 mb-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
        {title}
      </h2>
      {description && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {description}
        </p>
      )}
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Card({
  label,
  value,
  subLabel,
}: {
  label: string;
  value: React.ReactNode;
  subLabel?: string;
}) {
  return (
    <div className="rounded-md bg-white dark:bg-darkMode border border-gray-200 dark:border-darkModeCompliment p-3">
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {label}
      </div>
      <div className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-1">
        {value}
      </div>
      {subLabel && (
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          {subLabel}
        </div>
      )}
    </div>
  );
}

const DEMO_SUB_COUNT = 4;

export default function SkedulosaUtilsDemoPage() {
  const [dummySubs, setDummySubs] = useState<Subscription[]>([]);
  const [now] = useState(() => new Date());

  const seedDummy = useCallback(() => {
    setDummySubs(
      Array.from({ length: DEMO_SUB_COUNT }, () => generateDummySubscription()),
    );
  }, []);

  const clearDummy = useCallback(() => setDummySubs([]), []);

  const scheduleCountToday = useMemo(
    () => getScheduledDownloadsCountToday(dummySubs),
    [dummySubs],
  );

  const totalStorageBytes = useMemo(
    () => getTotalStorageUsedBytes(dummySubs),
    [dummySubs],
  );

  const storagePerSub = useMemo(
    () => getTotalStoragePerSubscription(dummySubs),
    [dummySubs],
  );

  const countPerSub = useMemo(
    () => getDownloadCountPerSubscription(dummySubs),
    [dummySubs],
  );

  const lastAgoPerSub = useMemo(
    () => getLastDownloadedTimeAgoPerSubscription(dummySubs, now),
    [dummySubs, now],
  );

  const percentFinishedPerSub = useMemo(
    () => getFinishedDownloadPercentPerSubscription(dummySubs),
    [dummySubs],
  );

  const avgSizePerSub = useMemo(
    () => getAverageSizeBytesPerSubscription(dummySubs),
    [dummySubs],
  );

  const heatMap = useMemo(
    () => buildHeatMapFromSubscriptionDownloads(dummySubs),
    [dummySubs],
  );

  const maxHeat = useMemo(() => {
    let m = 0;
    for (const row of heatMap.grid) for (const c of row) if (c > m) m = c;
    return m;
  }, [heatMap.grid]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Utils Demo
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Subscription &amp; download utility functions with dummy data.
            Generate data then inspect each group below.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={seedDummy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
          >
            <FiRefreshCw size={14} />
            Generate {DEMO_SUB_COUNT} dummy subscriptions
          </button>
          <button
            type="button"
            onClick={clearDummy}
            className="px-4 py-2 rounded-md border border-gray-300 dark:border-darkModeCompliment hover:bg-gray-100 dark:hover:bg-darkModeCompliment text-gray-700 dark:text-gray-300 text-sm font-medium"
          >
            Clear
          </button>
        </div>
      </div>

      {dummySubs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-darkModeCompliment bg-gray-50 dark:bg-darkModeCompliment/10 p-12 text-center text-gray-600 dark:text-gray-400">
          Click &quot;Generate {DEMO_SUB_COUNT} dummy subscriptions&quot; to
          load data and see all utils in action.
        </div>
      ) : (
        <div className="space-y-8">
          {/* ─── Schedule manager ─── */}
          <Section
            title="Schedule manager"
            description="formatSchedule, formatNextRun, formatProgress, formatStatus, getScheduledDownloadsCountToday"
          >
            <Card
              label="Scheduled downloads today"
              value={scheduleCountToday}
              subLabel="getScheduledDownloadsCountToday(subscriptions)"
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {dummySubs.map((sub) => {
                const entries = subscriptionToScheduleEntries(sub);
                return (
                  <div
                    key={sub.id}
                    className="rounded-md bg-white dark:bg-darkMode border border-gray-200 dark:border-darkModeCompliment p-4 space-y-3"
                  >
                    <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                      {sub.source}
                    </div>
                    <div className="text-xs space-y-2">
                      {entries.slice(0, 2).map((entry) => (
                        <div
                          key={entry.scheduleId}
                          className="flex flex-wrap gap-x-4 gap-y-1"
                        >
                          <span>
                            <strong>formatSchedule:</strong>{' '}
                            {formatSchedule(entry)}
                          </span>
                          <span>
                            <strong>formatNextRun:</strong>{' '}
                            {formatNextRun(entry, now)}
                          </span>
                        </div>
                      ))}
                      <div>
                        <strong>formatProgress:</strong>{' '}
                        {formatProgress(sub.downloads).text} (
                        {formatProgress(sub.downloads).percentage}%)
                      </div>
                      <div>
                        <strong>formatStatus:</strong>{' '}
                        {formatStatus(sub.status)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          {/* ─── Storage & counts (aggregate + per sub) ─── */}
          <Section
            title="Storage &amp; counts"
            description="getTotalStorageUsedBytes, getTotalStoragePerSubscription, getDownloadCountPerSubscription, formatBytesToHuman"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card
                label="Total storage (all subscriptions)"
                value={formatBytesToHuman(totalStorageBytes)}
                subLabel="getTotalStorageUsedBytes() → formatBytesToHuman()"
              />
              {dummySubs.map((sub) => (
                <Card
                  key={sub.id}
                  label={`Storage: ${sub.source}`}
                  value={formatBytesToHuman(storagePerSub[sub.id] ?? 0)}
                  subLabel={`${countPerSub[sub.id] ?? 0} downloads`}
                />
              ))}
            </div>
          </Section>

          {/* ─── Per-subscription stats ─── */}
          <Section
            title="Per-subscription stats"
            description="getLastDownloadedTimeAgoPerSubscription, getFinishedDownloadPercentPerSubscription, getAverageSizeBytesPerSubscription"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-darkModeCompliment">
                    <th className="py-2 pr-4 font-semibold text-gray-900 dark:text-gray-100">
                      Subscription
                    </th>
                    <th className="py-2 pr-4 font-semibold text-gray-900 dark:text-gray-100">
                      Last downloaded
                    </th>
                    <th className="py-2 pr-4 font-semibold text-gray-900 dark:text-gray-100">
                      % finished
                    </th>
                    <th className="py-2 font-semibold text-gray-900 dark:text-gray-100">
                      Avg size
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dummySubs.map((sub) => (
                    <tr
                      key={sub.id}
                      className="border-b border-gray-100 dark:border-darkModeCompliment/50"
                    >
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">
                        {sub.source}
                      </td>
                      <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">
                        {lastAgoPerSub[sub.id] ?? '—'}
                      </td>
                      <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">
                        {percentFinishedPerSub[sub.id] ?? 0}%
                      </td>
                      <td className="py-2 text-gray-600 dark:text-gray-400">
                        {formatBytesToHuman(avgSizePerSub[sub.id] ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* ─── Heat map ─── */}
          <Section
            title="Heat map"
            description="buildHeatMapFromSubscriptionDownloads — rows: morning / afternoon / night, columns: Mon–Sun"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="w-24 py-2 pr-2 text-left font-semibold text-gray-700 dark:text-gray-300">
                      Time
                    </th>
                    {heatMap.columns.map((col) => (
                      <th
                        key={col}
                        className="w-12 py-2 text-center font-semibold text-gray-700 dark:text-gray-300"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatMap.rows.map((rowName, r) => (
                    <tr key={rowName}>
                      <td className="py-1 pr-2 text-gray-600 dark:text-gray-400 capitalize">
                        {rowName}
                      </td>
                      {heatMap.grid[r].map((count, c) => {
                        const intensity = maxHeat > 0 ? count / maxHeat : 0;
                        const bg =
                          intensity === 0
                            ? 'bg-gray-100 dark:bg-darkModeCompliment/30'
                            : intensity < 0.34
                            ? 'bg-emerald-200 dark:bg-emerald-900/50'
                            : intensity < 0.67
                            ? 'bg-emerald-400 dark:bg-emerald-700/60'
                            : 'bg-emerald-600 dark:bg-emerald-600/80 text-white';
                        return (
                          <td
                            key={c}
                            className={`w-12 py-1 text-center rounded ${bg}`}
                            title={`${heatMap.columns[c]} ${rowName}: ${count}`}
                          >
                            {count}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Cell value = number of downloads (by date_added) in that
              day-of-week and time-of-day bucket.
            </p>
          </Section>
        </div>
      )}
    </div>
  );
}
