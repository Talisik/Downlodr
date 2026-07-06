import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LuDownload,
  LuRefreshCw,
  LuLoaderCircle,
  LuCircle,
} from 'react-icons/lu';
import { useSkedulosaStore } from '@/skedulosa/store/skedulosaStore';
import type {
  ActivityLogEntry,
  ActivityLogType,
} from '@/skedulosa/store/skedulosaStore';
import { formatRelativeTime } from '@/downlodr/pages/status/statusPageUtils';

interface ActivityLogTabProps {
  channelId: string | undefined;
}

// ── Filter config ────────────────────────────────────────────────────────────

type FilterSlug = 'all' | 'checks' | 'downloads' | 'errors';

const FILTER_SLUGS: FilterSlug[] = ['all', 'downloads', 'checks', 'errors'];

function matchesFilter(entry: ActivityLogEntry, filter: FilterSlug): boolean {
  if (filter === 'all') return true;
  if (filter === 'checks') return entry.type === 'check';
  if (filter === 'downloads')
    return (
      entry.type === 'download' ||
      entry.type === 'retry' ||
      entry.type === 'subscribe'
    );
  if (filter === 'errors') return entry.type === 'error';
  return true;
}

// ── Icon + color per type ────────────────────────────────────────────────────

function EntryIcon({ type }: { type: ActivityLogType }) {
  const base = 'flex-shrink-0 rounded-full p-1';
  switch (type) {
    case 'check':
      return (
        <span
          className={`${base} bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400`}
        >
          <LuCircle size={14} />
        </span>
      );
    case 'download':
      return (
        <span
          className={`${base} bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400`}
        >
          <LuDownload size={14} />
        </span>
      );
    case 'retry':
      return (
        <span
          className={`${base} bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400`}
        >
          <LuRefreshCw size={14} />
        </span>
      );
    case 'error':
      return (
        <span
          className={`${base} bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400`}
        >
          <LuLoaderCircle size={14} />
        </span>
      );
    case 'subscribe':
      return (
        <span className={`${base} bg-primary/10 text-primary`}>
          <LuCircle size={14} />
        </span>
      );
  }
}

// ── Main component ───────────────────────────────────────────────────────────

const ActivityLogTab = ({ channelId }: ActivityLogTabProps) => {
  const { t } = useTranslation('skedulosa');
  const subscription = useSkedulosaStore((s) =>
    s.subscriptions.find((sub) => sub.id === channelId),
  );

  const [filter, setFilter] = useState<FilterSlug>('all');

  const entries = useMemo(() => {
    const log = subscription?.activity_log ?? [];
    const filtered = log.filter((e) => matchesFilter(e, filter));
    // Newest first
    return [...filtered].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }, [subscription, filter]);

  return (
    <div className="py-4 pl-6 pr-10 space-y-3">
      {/* ── Header + filters ── */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {t('activityLog.showingResults')}
        </span>
        <div className="flex items-center gap-1">
          {FILTER_SLUGS.map((slug) => (
            <button
              key={slug}
              type="button"
              onClick={() => setFilter(slug)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                filter === slug
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {t(`activityLog.filters.${slug}`)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Log list ── */}
      {entries.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500 text-sm">
          {t('activityLog.noActivity')}
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 py-2.5 hover:bg-gray-50 dark:hover:bg-darkModeCompliment/20 px-1 rounded"
            >
              <EntryIcon type={entry.type} />
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                  {entry.action}
                </span>
                {entry.detail && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                    · {entry.detail}
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap flex-shrink-0">
                {formatRelativeTime(entry.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActivityLogTab;
