import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LuDownload,
  LuRefreshCw,
  LuLoaderCircle,
  LuCircle,
} from 'react-icons/lu';
import { useAfdaWebsitesStore } from '@/afda/store/afdaWebsitesStore';
import { useArticleDownloadStore } from '@/afda/store/articleDownloadStore';
import { formatRelativeTime } from '@/downlodr/pages/status/statusPageUtils';

interface AfdaActivityLogProps {
  channelId: string | undefined;
}

interface ScrapeJobRow {
  id: number;
  section_id: number;
  status: string;
  triggered_by: string | null;
  discovered_urls: number;
  scraped_count: number;
  parsed_count: number;
  failed_count: number;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

type FilterSlug = 'all' | 'checks' | 'downloads' | 'errors';
const FILTER_SLUGS: FilterSlug[] = ['all', 'downloads', 'checks', 'errors'];

type EntryType = 'check' | 'download' | 'retry' | 'error' | 'subscribe';

function jobToEntryType(status: string): EntryType {
  if (status === 'completed') return 'download';
  if (status === 'failed') return 'error';
  if (status === 'running') return 'retry';
  return 'check';
}

function matchesFilter(job: ScrapeJobRow, filter: FilterSlug): boolean {
  if (filter === 'all') return true;
  if (filter === 'downloads') return job.status === 'completed';
  if (filter === 'errors') return job.status === 'failed';
  if (filter === 'checks') return job.status === 'running' || job.status === 'pending';
  return true;
}

function EntryIcon({ type }: { type: EntryType }) {
  const base = 'flex-shrink-0 rounded-full p-1';
  switch (type) {
    case 'check':
      return (
        <span className={`${base} bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400`}>
          <LuCircle size={14} />
        </span>
      );
    case 'download':
      return (
        <span className={`${base} bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400`}>
          <LuDownload size={14} />
        </span>
      );
    case 'retry':
      return (
        <span className={`${base} bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400`}>
          <LuRefreshCw size={14} />
        </span>
      );
    case 'error':
      return (
        <span className={`${base} bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400`}>
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

const AfdaActivityLog = ({ channelId }: AfdaActivityLogProps) => {
  const { t } = useTranslation('skedulosa');

  const website = useAfdaWebsitesStore((s) =>
    s.websites.find((w) => w.id === channelId),
  );

  const sectionMap = useMemo(() => {
    const map: Record<number, string> = {};
    for (const s of website?.sections ?? []) {
      map[parseInt(s.id)] = s.name || s.path;
    }
    return map;
  }, [website]);

  // Watch article count for this website — increments when useAfdaArticleSync
  // writes a new article, which means a scrape job just completed.
  const articleCount = useArticleDownloadStore((s) =>
    s.articleDownloads.filter((a) => a.subscriptionId === channelId).length,
  );

  const [jobs, setJobs] = useState<ScrapeJobRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<FilterSlug>('all');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchJobs = useCallback(async () => {
    if (!website?.sections.length) return;
    const bridge =
      typeof window !== 'undefined' ? (window as any).afdaBridge : undefined;
    if (!bridge) return;

    setLoading(true);
    try {
      const results = await Promise.all(
        website.sections.map((s) =>
          bridge.scrape
            .listJobs({ section_id: parseInt(s.id), limit: 50 })
            .catch(() => [] as ScrapeJobRow[]),
        ),
      );
      const flat: ScrapeJobRow[] = results.flat();
      flat.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setJobs(flat);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, [website]);

  // Fetch on mount and whenever the store article count increases (debounced so
  // a batch of new articles only triggers one fetch, not one per article).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(fetchJobs, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchJobs, articleCount]);

  const filteredJobs = useMemo(
    () => jobs.filter((j) => matchesFilter(j, filter)),
    [jobs, filter],
  );

  return (
    <div className="py-4 pl-6 pr-10 space-y-3">
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

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500 text-sm">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin mr-2" />
          Loading…
        </div>
      ) : filteredJobs.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500 text-sm">
          {t('activityLog.noActivity')}
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {filteredJobs.map((job) => {
            const type = jobToEntryType(job.status);
            const sectionName = sectionMap[job.section_id] ?? `Section ${job.section_id}`;
            const timestamp = job.finished_at ?? job.started_at ?? job.created_at;

            let action = '';
            let detail = sectionName;

            if (job.status === 'completed') {
              action = 'Scrape completed';
              if (job.discovered_urls > job.scraped_count) {
                detail = `${sectionName} · ${job.discovered_urls} discovered`;
              }
            } else if (job.status === 'failed') {
              action = job.error_message ?? 'Scrape failed';
            } else if (job.status === 'running') {
              action = 'Scrape in progress';
            } else {
              action = `Scrape ${job.status}`;
            }

            const showCount = job.scraped_count > 0 || job.status === 'completed';

            return (
              <div
                key={job.id}
                className="flex items-center gap-3 py-2.5 hover:bg-gray-50 dark:hover:bg-darkModeCompliment/20 px-1 rounded"
              >
                <EntryIcon type={type} />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                    {action}
                  </span>
                  {detail && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                      · {detail}
                    </span>
                  )}
                </div>
                {showCount && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex-shrink-0">
                    {job.scraped_count} art{job.scraped_count !== 1 ? 's' : ''}
                  </span>
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap flex-shrink-0">
                  {formatRelativeTime(timestamp)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AfdaActivityLog;
