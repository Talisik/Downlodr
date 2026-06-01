import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuDownload, LuRepeat, LuHardDrive } from 'react-icons/lu';
import { useSkedulosaStore } from '@/skedulosa/store/skedulosaStore';

interface AnalyticsTabProps {
  channelId: string | undefined;
}

// ── Static key arrays (no translated strings at module level) ────────────────

const DAY_KEYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

const BAND_KEYS = ['earlyMorning', 'morning', 'afternoon', 'evening'] as const;

const TIME_RANGE_OPTIONS = [
  { key: 'last30', days: 30 },
  { key: 'last60', days: 60 },
  { key: 'last90', days: 90 },
] as const;

type TimeRangeKey = (typeof TIME_RANGE_OPTIONS)[number]['key'];

const EMPTY_GRID = (): number[][] =>
  Array.from({ length: 4 }, () => Array(7).fill(0));

const EMPTY_TIMES = (): string[][] =>
  Array.from({ length: 4 }, () => Array(7).fill('—'));

// ── Heatmap computation ──────────────────────────────────────────────────────

interface HeatmapData {
  intensity: number[][];
  avgTimes: string[][];
  avgUploads: number[][];
  peakBest: { bi: number; di: number } | null;
  peakSecond: { bi: number; di: number } | null;
  peakStatus: 'ok' | 'noData' | 'failedToLoad';
}

function computeHeatmap(dates: string[], daysBack: number): HeatmapData {
  const totalWeeks = Math.max(1, daysBack / 7);
  const counts = EMPTY_GRID();
  const timeSum = EMPTY_GRID();

  for (const dateStr of dates) {
    const spaceIdx = dateStr.indexOf(' ');
    if (spaceIdx === -1) continue;
    const datePart = dateStr.slice(0, spaceIdx);
    const timePart = dateStr.slice(spaceIdx + 1);
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes] = timePart.split(':').map(Number);
    if (isNaN(year) || isNaN(hours)) continue;

    const d = new Date(Date.UTC(year, month - 1, day, hours, minutes));
    const jsDay = d.getUTCDay();
    const dayIdx = jsDay === 0 ? 6 : jsDay - 1;

    const h = d.getUTCHours();
    const bandIdx = h < 6 ? 0 : h < 12 ? 1 : h < 18 ? 2 : 3;

    counts[bandIdx][dayIdx]++;
    timeSum[bandIdx][dayIdx] += hours * 60 + minutes;
  }

  const maxCount = Math.max(1, ...counts.flat());
  const intensity = counts.map((row) =>
    row.map((c) => {
      if (c === 0) return 0;
      const r = c / maxCount;
      return r < 0.33 ? 1 : r < 0.67 ? 2 : 3;
    }),
  );

  const avgTimes = counts.map((row, bi) =>
    row.map((c, di) => {
      if (c === 0) return '—';
      const avg = timeSum[bi][di] / c;
      const h = Math.floor(avg / 60);
      const m = Math.floor(avg % 60);
      const period = h < 12 ? 'AM' : 'PM';
      const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return `${displayH}:${String(m).padStart(2, '0')} ${period}`;
    }),
  );

  const avgUploads = counts.map((row) =>
    row.map((c) => parseFloat((c / totalWeeks).toFixed(1))),
  );

  let best: { count: number; bi: number; di: number } | null = null;
  let second: { count: number; bi: number; di: number } | null = null;
  for (let bi = 0; bi < 4; bi++) {
    for (let di = 0; di < 7; di++) {
      const c = counts[bi][di];
      if (!best || c > best.count) {
        second = best;
        best = { count: c, bi, di };
      } else if (!second || c > second.count) {
        second = { count: c, bi, di };
      }
    }
  }

  const hasBest = best && best.count > 0;
  return {
    intensity,
    avgTimes,
    avgUploads,
    peakBest: hasBest && best ? { bi: best.bi, di: best.di } : null,
    peakSecond:
      hasBest && second && second.count > 0
        ? { bi: second.bi, di: second.di }
        : null,
    peakStatus: 'ok',
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function intensityToBg(val: number): string {
  if (val === 0) return 'bg-gray-100 dark:bg-gray-800';
  if (val === 1) return 'bg-[#FDDCCC]';
  if (val === 2) return 'bg-[#F4A07A]';
  return 'bg-primary';
}

function parseSizeToBytes(sizeStr: string): number {
  if (!sizeStr) return 0;
  if (/^\d+$/.test(sizeStr)) return parseInt(sizeStr, 10);
  const m = sizeStr.match(/([\d.]+)\s*(K|M|G)i?B/i);
  if (!m) return 0;
  const val = parseFloat(m[1]);
  const unit = m[2].toUpperCase();
  if (unit === 'K') return val * 1024;
  if (unit === 'M') return val * 1024 * 1024;
  if (unit === 'G') return val * 1024 * 1024 * 1024;
  return 0;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sublabel,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel: string;
}) {
  return (
    <div className="flex-1 px-5 py-4">
      <div className="text-md flex items-center gap-1.5 text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">
        {icon}
        {label}
      </div>
      <div className="text-lg font-extrabold text-[#474747] dark:text-gray-100 leading-tight">
        {value}
      </div>
      <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
        {sublabel}
      </div>
    </div>
  );
}

function TrendCard({
  label,
  value,
  badge,
  badgeColor,
}: {
  label: string;
  value: string;
  badge: string;
  badgeColor: string;
}) {
  return (
    <div className="rounded-lg px-4 py-3">
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        {label}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {value}
        </span>
        <span
          className={`text-xs px-1.5 py-0.5 rounded font-medium ${badgeColor}`}
        >
          {badge}
        </span>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface TooltipState {
  day: string;
  band: string;
  avgTime: string;
  avgUploads: number;
  clientX: number;
  clientY: number;
}

const EMPTY_HEATMAP: HeatmapData = {
  intensity: EMPTY_GRID(),
  avgTimes: EMPTY_TIMES(),
  avgUploads: EMPTY_GRID(),
  peakBest: null,
  peakSecond: null,
  peakStatus: 'noData',
};

const AnalyticsTab = ({ channelId }: AnalyticsTabProps) => {
  const { t } = useTranslation('skedulosa');
  const subscription = useSkedulosaStore((s) =>
    s.subscriptions.find((sub) => sub.id === channelId),
  );

  const [timeRangeKey, setTimeRangeKey] = useState<TimeRangeKey>('last90');
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapData>({
    ...EMPTY_HEATMAP,
    peakStatus: 'noData',
  });
  const [heatmapLoading, setHeatmapLoading] = useState(false);

  // ── Translated label arrays ───────────────────────────────────────────────
  const days = DAY_KEYS.map((k) => t(`analytics.days.${k}`));
  const timeBands = BAND_KEYS.map((k) => ({
    label: t(`analytics.timeBands.${k}`),
    sub: t(`analytics.timeBands.${k}Sub`),
  }));

  // ── Peak label derived from indices ──────────────────────────────────────
  const peakLabel = useMemo(() => {
    if (heatmapLoading) return t('analytics.heatmap.loading');
    if (heatmap.peakStatus === 'failedToLoad')
      return t('analytics.heatmap.failedToLoad');
    if (!heatmap.peakBest) return t('analytics.heatmap.noData');
    const p1 = `${days[heatmap.peakBest.di]} ${
      timeBands[heatmap.peakBest.bi].label
    }`;
    if (heatmap.peakSecond) {
      const p2 = `${days[heatmap.peakSecond.di]} ${
        timeBands[heatmap.peakSecond.bi].label
      }`;
      return `${p1} & ${p2}`;
    }
    return p1;
  }, [heatmap, heatmapLoading, days, timeBands, t]);

  // ── Fetch real upload dates and compute heatmap ───────────────────────────
  useEffect(() => {
    const bridge =
      typeof window !== 'undefined' ? window.skedulosaBridge : undefined;
    const channelUrl = subscription?.sourceUrl;
    if (!bridge || !channelUrl) return;

    const daysBack =
      TIME_RANGE_OPTIONS.find((o) => o.key === timeRangeKey)?.days ?? 90;
    let cancelled = false;

    setHeatmapLoading(true);
    bridge
      .fetchUploadDates(channelUrl, daysBack)
      .then(({ dates, error }) => {
        if (cancelled) return;
        if (error || !dates.length) {
          setHeatmap({
            ...EMPTY_HEATMAP,
            peakStatus: error ? 'failedToLoad' : 'noData',
          });
        } else {
          setHeatmap(computeHeatmap(dates, daysBack));
        }
      })
      .catch(() => {
        if (!cancelled)
          setHeatmap({ ...EMPTY_HEATMAP, peakStatus: 'failedToLoad' });
      })
      .finally(() => {
        if (!cancelled) setHeatmapLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [subscription?.sourceUrl, timeRangeKey]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const { downloadRate, avgFileSizeStr, failedPct, hasDownloads } =
    useMemo(() => {
      const downloads = subscription?.downloads ?? [];
      const total = downloads.length;
      const completed = downloads.filter(
        (d) => d.status.toLowerCase() === 'completed',
      ).length;
      const failed = downloads.filter(
        (d) =>
          d.status.toLowerCase() === 'error' ||
          d.status.toLowerCase() === 'failed',
      ).length;

      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
      const pctFailed = total > 0 ? Math.round((failed / total) * 100) : 0;

      const withSize = downloads.filter(
        (d) => d.size && parseSizeToBytes(d.size) > 0,
      );
      let avgStr = '0 MB';
      if (withSize.length > 0) {
        const totalBytes = withSize.reduce(
          (sum, d) => sum + parseSizeToBytes(d.size),
          0,
        );
        avgStr = formatBytes(totalBytes / withSize.length);
      }

      return {
        downloadRate: rate,
        avgFileSizeStr: avgStr,
        failedPct: pctFailed,
        hasDownloads: total > 0,
      };
    }, [subscription]);

  const uploadCadence = subscription?.upload_cadence || '0';
  const successRate = hasDownloads ? 100 - failedPct : 0;
  const noDownloadsLabel = t('analytics.stats.noDownloads');

  return (
    <div className="space-y-5 relative">
      {/* ── Stat cards ────────────────────────────────────────────────────── */}
      <div className="flex flex-row divide-x divide-gray-200 dark:divide-gray-700 rounded-lg overflow-hidden">
        <StatCard
          icon={<LuDownload size={11} />}
          label={t('analytics.stats.downloadRate')}
          value={`${downloadRate}%`}
          sublabel={
            hasDownloads
              ? t('analytics.stats.successOver30d')
              : noDownloadsLabel
          }
        />
        <StatCard
          icon={<LuRepeat size={11} />}
          label={t('analytics.stats.uploadCadence')}
          value={uploadCadence}
          sublabel={
            hasDownloads ? t('analytics.stats.videosPerWeek') : noDownloadsLabel
          }
        />
        <StatCard
          icon={<LuHardDrive size={11} />}
          label={t('analytics.stats.avgFileSize')}
          value={avgFileSizeStr}
          sublabel={
            hasDownloads ? t('analytics.stats.perVideo') : noDownloadsLabel
          }
        />
      </div>

      {/* ── Best Upload Day + Hour heatmap ────────────────────────────────── */}
      <div className="rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
            {t('analytics.heatmap.title')}
          </span>
          <select
            value={timeRangeKey}
            onChange={(e) => setTimeRangeKey(e.target.value as TimeRangeKey)}
            className="text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-0.5 bg-gray-100 dark:bg-darkMode text-gray-600 dark:text-gray-300 cursor-pointer"
          >
            {TIME_RANGE_OPTIONS.map(({ key }) => (
              <option key={key} value={key}>
                {t(`analytics.timeRange.${key}`)}
              </option>
            ))}
          </select>
        </div>

        {/* Day header row */}
        <div className="flex">
          <div className="w-36 shrink-0" />
          {days.map((day) => (
            <div
              key={day}
              className="flex-1 text-center text-[12px] font-medium text-gray-400 dark:text-gray-500 pb-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Time band rows */}
        {timeBands.map((band, bandIdx) => (
          <div key={band.label} className="flex items-center mb-1.5">
            <div className="w-36 shrink-0 pr-3">
              <div className="text-xs font-semibold text-[#949494] dark:text-gray-300 leading-tight">
                {band.label}
              </div>
              <div className="text-[10px] text-gray-400 dark:text-gray-500">
                {band.sub}
              </div>
            </div>
            {days.map((day, dayIdx) => {
              const intensity = heatmap.intensity[bandIdx][dayIdx];
              return (
                <div key={day} className="flex-1 px-0.5">
                  <div
                    className={`rounded h-9 w-full transition-opacity ${intensityToBg(
                      intensity,
                    )} ${
                      intensity > 0
                        ? 'cursor-pointer hover:opacity-75'
                        : 'cursor-default'
                    } ${heatmapLoading ? 'animate-pulse' : ''}`}
                    onMouseEnter={(e) => {
                      if (intensity === 0) return;
                      const rect = (
                        e.currentTarget as HTMLElement
                      ).getBoundingClientRect();
                      setTooltip({
                        day,
                        band: band.label,
                        avgTime: heatmap.avgTimes[bandIdx][dayIdx],
                        avgUploads: heatmap.avgUploads[bandIdx][dayIdx],
                        clientX: rect.left + rect.width / 2,
                        clientY: rect.top,
                      });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                </div>
              );
            })}
          </div>
        ))}

        {/* Legend + peak label */}
        <div className="flex items-center justify-between mt-3 pt-2">
          <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
            <span>{t('analytics.heatmap.less')}</span>
            <div className="w-4 h-3 rounded-sm bg-[#FDDCCC]" />
            <div className="w-4 h-3 rounded-sm bg-[#F4A07A]" />
            <div className="w-4 h-3 rounded-sm bg-primary" />
            <span>{t('analytics.heatmap.more')}</span>
          </div>
          <div className="text-xs text-primary font-medium">
            ● {t('analytics.heatmap.peak')}: {peakLabel}
          </div>
        </div>
      </div>

      {/* ── Trends Over 30 Days ───────────────────────────────────────────── */}
      <div>
        <div className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
          {t('analytics.trends.title')}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <TrendCard
            label={t('analytics.trends.successRate')}
            value={`${successRate}%`}
            badge={t('analytics.trends.failedBadge', { pct: failedPct })}
            badgeColor="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
          />
          <TrendCard
            label={t('analytics.trends.storageGrowth')}
            value="0%"
            badge="0%"
            badgeColor="bg-orange-100 text-primary dark:bg-orange-900/30"
          />
          <TrendCard
            label={t('analytics.trends.failedDownloads')}
            value={`${failedPct}%`}
            badge={t('analytics.trends.failedBadge', {
              pct: hasDownloads ? failedPct : 0,
            })}
            badgeColor="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
          />
        </div>
      </div>

      {/* ── Hover tooltip ─────────────────────────────────────────────────── */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-md px-3 py-2 shadow-lg"
          style={{
            left: tooltip.clientX,
            top: tooltip.clientY - 72,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="font-semibold mb-0.5">
            {tooltip.day} - {tooltip.band}
          </div>
          <div className="text-gray-300">
            {t('analytics.tooltip.avgUploadTime')}{' '}
            <span className="text-orange-300 font-medium">
              {tooltip.avgTime}
            </span>
          </div>
          <div className="text-gray-300">
            {t('analytics.tooltip.avgUploads')} {tooltip.avgUploads}{' '}
            {t('analytics.tooltip.videosPerWeek')}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsTab;
