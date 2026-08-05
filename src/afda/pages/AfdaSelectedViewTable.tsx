import AfdaActivityLog from './selectedTabPages/AfdaActivityLog';
import AfdaDownloads from './selectedTabPages/AfdaDownloads';
import AfdaSocialPosts from './selectedTabPages/AfdaSocialPosts';
import AfdaSettings from './selectedTabPages/AfdaSettings';
import AfdaEditWebsiteModal from '@/afda/components/AfdaEditWebsiteModal';
import { useArticleDownloadStore } from '@/afda/store/articleDownloadStore';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaCircle } from 'react-icons/fa';
import { FaArrowLeft } from 'react-icons/fa6';
import { FiTrash, FiPlay, FiPause } from 'react-icons/fi';
import { HiOutlinePencilAlt } from 'react-icons/hi';
import { TbCalendarTime, TbRefresh } from 'react-icons/tb';
import { LuCalendarCheck2, LuNewspaper } from 'react-icons/lu';
import { useAfdaWebsitesStore } from '@/afda/store/afdaWebsitesStore';
import { getFaviconUrl } from '@/afda/utils/faviconUrl';
import { formatRelativeTime } from '@/downlodr/pages/status/statusPageUtils';
import ConfirmModal from '@/core-app/components/modal/custom/ConfirmModal';
import { RiBookShelfLine } from 'react-icons/ri';
import { formatWordDate, formatNumericDate } from './utils/afdaUtils';
import StatCard from '@/afda/components/StatCard';
import { IoDocumentTextOutline } from 'react-icons/io5';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';

const STATUS_MAP: Record<string, string> = {
  active: 'Active',
  paused: 'Paused',
  error: 'Error',
  idle: 'Active',
};

const TABS = [
  { id: 'downloads', label: 'Downloads' },
  { id: 'activity-log', label: 'Activity Log' },
  { id: 'settings', label: 'Settings' },
];

const statusColor = (status: string) => {
  switch (status) {
    case 'Active':
      return 'text-green-500';
    case 'Paused':
      return 'text-yellow-500';
    case 'Error':
      return 'text-red-500';
    default:
      return 'text-gray-500';
  }
};

const AfdaSelectedViewTable = () => {
  const { channelId } = useParams();
  const navigate = useNavigate();

  const websites = useAfdaWebsitesStore((s) => s.websites);
  const removeWebsite = useAfdaWebsitesStore((s) => s.removeWebsite);
  const updateWebsite = useAfdaWebsitesStore((s) => s.updateWebsite);

  const [deleteConfirm, setDeleteConfirm] = useState<{
    channelId: string;
    channelName: string;
  } | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('downloads');
  const [actionLoading, setActionLoading] = useState<
    'pause' | 'resume' | 'run' | null
  >(null);

  const website = useMemo(
    () => websites.find((w) => w.id === channelId),
    [websites, channelId],
  );

  const faviconUrl = getFaviconUrl(website?.url ?? '');

  const articleDownloads = useArticleDownloadStore((s) => s.articleDownloads);
  const downloadedCount = useMemo(() => {
    if (!website) return 0;
    const items = articleDownloads.filter(
      (a) => a.subscriptionId === website.id,
    );
    // Social posts are keyed by DB row id, so duplicate rows for the same
    // underlying post (e.g. Facebook share-link vs canonical permalink url)
    // count twice unless we collapse them by title here too — mirrors the
    // dedup applied in AfdaSocialPosts.tsx.
    const seen = new Set<string>();
    let count = 0;
    for (const item of items) {
      const key = item.id.startsWith('social-post-')
        ? `title|${item.title.trim()}`
        : item.id;
      if (seen.has(key)) continue;
      seen.add(key);
      count++;
    }
    return count;
  }, [articleDownloads, website]);

  const bridge =
    typeof window !== 'undefined' ? (window as any).afdaBridge : undefined;

  const isSocial = website?.kind === 'social';

  // ── Delete ────────────────────────────────────────────────────────────────
  const confirmDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    const id = deleteConfirm.channelId;
    setDeleteConfirm(null);

    if (bridge) {
      try {
        if (isSocial && website?.socialId != null) {
          await bridge.social.sources.delete({ id: website.socialId });
        } else {
          await bridge.websites.delete({ id: parseInt(id) });
        }
      } catch {
        // proceed with local removal even if bridge call fails
      }
    }

    removeWebsite(id);
    navigate('/skedulosa/subscription');
  }, [deleteConfirm, removeWebsite, navigate, bridge, isSocial, website]);

  // ── Pause / Resume (all sections) ─────────────────────────────────────────
  const handlePauseResume = useCallback(async () => {
    if (!website || !bridge || actionLoading) return;

    const isActive = STATUS_MAP[website.status] === 'Active';
    setActionLoading(isActive ? 'pause' : 'resume');

    try {
      if (isSocial && website.socialId != null) {
        // Social schedule is per-source, not per-section.
        if (isActive) {
          await bridge.social.schedule.pause({ id: website.socialId });
        } else {
          await bridge.social.schedule.resume({ id: website.socialId });
        }
        // Reflect the new status locally (no hydrated Website to fetch).
        updateWebsite({
          ...website,
          status: isActive ? 'paused' : 'active',
        });
      } else {
        await Promise.all(
          website.sections.map((s) =>
            isActive
              ? bridge.schedule.pause({ section_id: parseInt(s.id) })
              : bridge.schedule.resume({ section_id: parseInt(s.id) }),
          ),
        );

        // Fetch a fresh hydrated website to sync the store
        const result = await bridge.websites.update({
          id: parseInt(website.id),
          patch: { status: isActive ? 'paused' : 'active' },
        });
        if (result?.website) updateWebsite(result.website);
      }
    } catch (err) {
      console.error('[afda] pause/resume failed:', err);
    } finally {
      setActionLoading(null);
    }
  }, [website, bridge, actionLoading, updateWebsite, isSocial]);

  // ── Run Now (all enabled sections, or the social source) ──────────────────
  const handleRunNow = useCallback(async () => {
    if (!website || !bridge || actionLoading) return;

    setActionLoading('run');
    try {
      if (isSocial && website.socialId != null) {
        await bridge.social.sources.scrapeNow({ id: website.socialId });
      } else {
        await Promise.all(
          website.sections
            .filter((s) => s.enabled)
            .map((s) => bridge.scrape.runNow({ section_id: parseInt(s.id) })),
        );
      }
    } catch (err) {
      console.error('[afda] run now failed:', err);
    } finally {
      setActionLoading(null);
    }
  }, [website, bridge, actionLoading, isSocial]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const sectionCount = website?.sections.length;
  const displayStatus = website ? STATUS_MAP[website.status] ?? 'Active' : '';
  const isActive = displayStatus === 'Active';

  const createdStr = (() => {
    try {
      return website ? new Date(website.createdAt) : '—';
    } catch {
      return '—';
    }
  })();

  const lastCheckedDate = (() => {
    const lct = website?.lastScrapedAt;
    const dc = website?.createdAt;
    if (lct && dc && new Date(lct) >= new Date(dc)) {
      return new Date(lct);
    }
    return dc ? new Date(dc) : null;
  })();

  // ── Action buttons (shared between mobile + desktop) ──────────────────────
  const btnClass =
    'rounded-md h-7 flex items-center justify-center p-2 bg-[#f9f9f9] dark:bg-zinc-800 hover:bg-[#EDEDED] dark:hover:bg-darkModeHover disabled:opacity-40 disabled:cursor-not-allowed';

  const actionButtons = website ? (
    <>
      <TooltipWrapper
        content={isActive ? 'Pause all sections' : 'Resume all sections'}
        side="bottom"
      >
        <button
          type="button"
          disabled={!!actionLoading}
          onClick={handlePauseResume}
          className={btnClass}
        >
          {actionLoading === 'pause' || actionLoading === 'resume' ? (
            <div className="w-[15px] h-[15px] border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : isActive ? (
            <FiPause size={15} color="gray" />
          ) : (
            <FiPlay size={15} className="text-green-500" />
          )}
        </button>
      </TooltipWrapper>
      <TooltipWrapper content="Run all enabled sections now" side="bottom">
        <button
          type="button"
          disabled={!!actionLoading || !isActive}
          onClick={handleRunNow}
          className={btnClass}
        >
          {actionLoading === 'run' ? (
            <div className="w-[15px] h-[15px] border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <TbRefresh size={15} color="gray" />
          )}
        </button>
      </TooltipWrapper>
      <TooltipWrapper content="Edit website details" side="bottom">
        <button
          type="button"
          onClick={() => setEditModalOpen(true)}
          className={btnClass}
        >
          <HiOutlinePencilAlt size={15} color="gray" />
        </button>
      </TooltipWrapper>
      <TooltipWrapper content="Delete website" side="bottom">
        <button
          type="button"
          onClick={() =>
            setDeleteConfirm({
              channelId: website.id,
              channelName: website.name,
            })
          }
          className={btnClass}
        >
          <FiTrash size={15} color="red" />
        </button>
      </TooltipWrapper>
    </>
  ) : null;

  return (
    <div className="flex h-full w-[calc(100%+2rem)] flex-col gap-2 -mx-4 overflow-hidden pt-3">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex flex-row gap-2 px-4 justify-between items-center rounded-lg">
        <div className="flex flex-col flex-shrink-0">
          <div className="flex flex-row items-start gap-4 p-2 pr-[3%]">
            <button
              type="button"
              onClick={() => navigate('/skedulosa/subscription')}
              className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 mt-4"
            >
              <FaArrowLeft />
            </button>
            {website ? (
              <div className="flex items-center gap-3">
                {faviconUrl ? (
                  <img
                    src={faviconUrl}
                    className="w-12 h-12 rounded object-contain flex-shrink-0"
                  />
                ) : (
                  <div className="h-14 w-14 flex-shrink-0 rounded-md bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <LuNewspaper
                      size={24}
                      className="text-blue-500 dark:text-blue-400"
                    />
                  </div>
                )}
                <div>
                  <div className="gap-2 flex flex-row items-center">
                    <span className="text-[13.5px] font-bold text-gray-900 dark:text-gray-100">
                      {website.name}
                    </span>
                    <div
                      className={`flex gap-1 items-center ${statusColor(
                        displayStatus,
                      )}`}
                    >
                      <FaCircle size={6} />
                      <span className="text-[11px]">{displayStatus}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 items-center mt-0.5">
                    <span
                      title={website.url}
                      className="text-xs text-gray-500 dark:text-gray-400"
                    >
                      <span className="1xl:hidden">
                        {website.url.length > 20
                          ? `${website.url.slice(0, 20)}…`
                          : website.url}
                      </span>
                      <span className="hidden 1xl:inline">
                        {website.url.length > 38
                          ? `${website.url.slice(0, 38)}…`
                          : website.url}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Select a website from the list.
              </p>
            )}
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div className="flex flex-1 flex-row items-center w-full rounded-lg px-4 py-2">
          <div className="flex flex-1 justify-center gap-2">
            {!isSocial && sectionCount !== undefined && (
              <StatCard
                value={String(sectionCount)}
                label="Sections"
                icon={<RiBookShelfLine size={25} className="text-primary" />}
              />
            )}
            <StatCard
              value={String(downloadedCount)}
              label="Downloaded"
              icon={
                <IoDocumentTextOutline size={25} className="text-primary" />
              }
            />
            <StatCard
              value={formatWordDate(createdStr)}
              smallValue={formatNumericDate(createdStr)}
              label="Created"
              icon={<LuCalendarCheck2 size={22} className="text-primary" />}
            />
            <StatCard
              value={
                lastCheckedDate
                  ? formatRelativeTime(lastCheckedDate.toISOString())
                  : '—'
              }
              smallValue={
                lastCheckedDate ? formatNumericDate(lastCheckedDate) : undefined
              }
              label="Last checked"
              icon={<TbCalendarTime size={24} className="text-primary" />}
            />
          </div>
          {website && (
            <div className="grid grid-cols-2 gap-1 1xl:flex 1xl:flex-row 1xl:gap-2 items-center flex-shrink-0 pl-6">
              {actionButtons}
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-h-0">
        <div className="gap-4 flex flex-row border-b border-gray-200 dark:border-gray-700">
          {(isSocial
            ? [{ id: 'downloads', label: 'Posts' }]
            : TABS
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 pt-2.5 text-md font-medium transition-colors focus-visible:outline-none whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-b-2 border-primary text-gray-900 dark:text-gray-100 text-primary font-semibold'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden hover-scrollbar">
          {activeTab === 'downloads' &&
            (isSocial && website ? (
              <AfdaSocialPosts website={website} />
            ) : (
              <AfdaDownloads website={website} />
            ))}
          {activeTab === 'activity-log' && (
            <AfdaActivityLog channelId={channelId} />
          )}
          {activeTab === 'settings' && <AfdaSettings channelId={channelId} />}
        </div>
      </div>

      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title={`Delete ${deleteConfirm?.channelName}?`}
        confirmLabel="Delete"
        message="This will remove the website and all its sections. This cannot be undone."
      />

      {website && editModalOpen && (
        <AfdaEditWebsiteModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          website={website}
        />
      )}
    </div>
  );
};

export default AfdaSelectedViewTable;
