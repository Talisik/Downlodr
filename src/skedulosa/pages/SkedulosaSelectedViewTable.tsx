import ActivityLogTab from './selectedTabPages/SkedulosaActivityLog';
import AnalyticsTab from './selectedTabPages/SkedulosaAnalytics';
import DownloadTab from './selectedTabPages/SkedulosaDownloads';
import SettingsTab from './selectedTabPages/SkedulosaSettings';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SkedulosaContextMenu, {
  type ContextMenuPosition,
} from '@/skedulosa/components/SkedulosaContextMenu';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getExtractorIcon } from '@/downlodr/utils/icons/iconMapper';
import { formatRelativeTime } from '@/downlodr/pages/status/statusPageUtils';
import { Avatar, AvatarImage, AvatarFallback } from '@radix-ui/react-avatar';
import { FaCircle } from 'react-icons/fa';
import { ScheduledChannel, useSkedulosaStore } from '../store/skedulosaStore';
import {
  formatBytesToHuman,
  getTotalStorageForDownloads,
} from '../utils/subscriptionDownloadUtils';
import ConfirmModal from '@/core-app/components/modal/custom/ConfirmModal';
import { showScrapeErrors } from '@/skedulosa/error-mapping/skedulosaErrors';
import SkedulosaEditModal from '../components/SkedulosaEditModal';
import { HiOutlinePencilAlt } from 'react-icons/hi';
import { FiPause, FiPlay, FiTrash } from 'react-icons/fi';
import { TbRefresh, TbCalendarTime } from 'react-icons/tb';
import { FaArrowLeft } from 'react-icons/fa6';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import StatCard from '@/afda/components/StatCard';
import { MdOutlineFileDownload } from 'react-icons/md';
import { LuCalendarCheck2, LuHardDrive, LuTv } from 'react-icons/lu';
import { formatWordDate, formatNumericDate } from '@/afda/pages/utils/afdaUtils';

const TABS = [
  { id: 'downloads', label: 'Downloads' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'activity-log', label: 'Activity Log' },
  { id: 'settings', label: 'Settings' },
];

const getPlatformName = (url: string): string => {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const domain = hostname.split('.')[0];
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  } catch {
    return url;
  }
};

const SkedulosaSelectedViewTable = () => {
  // ── Static tab config (hoisted to avoid re-allocation on every render) ─────

  const { channelId } = useParams();

  const selectedChannelId = channelId ?? null;

  const subscriptions = useSkedulosaStore((s) => s.subscriptions);

  const scheduledChannels = useSkedulosaStore((s) => s.scheduledChannels);

  const removeSubscription = useSkedulosaStore((s) => s.removeSubscription);
  const getSubscription = useSkedulosaStore((s) => s.getSubscription);
  const updateSubscription = useSkedulosaStore((s) => s.updateSubscription);
  const navigate = useNavigate();

  const [editModalId, setEditModalId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    channelId: string;
    channelName: string;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    position: ContextMenuPosition;
    channelId: string;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<string>('downloads');
  const [scrapeStatus, setScrapeStatus] = useState<
    'idle' | 'running' | 'done' | 'error'
  >('idle');
  const scrapeResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pauseResumeLoading, setPauseResumeLoading] = useState<
    'pause' | 'resume' | null
  >(null);

  const handleTabChange = (tabValue: string) => {
    setActiveTab(tabValue);
  };

  const SkedulosaSelectedViewTable = useMemo(
    () => subscriptions.find((s) => s.id === selectedChannelId),
    [subscriptions, selectedChannelId],
  );
  const canRunScrapeNow =
    SkedulosaSelectedViewTable?.toolkit_channel_id !== undefined &&
    scrapeStatus !== 'running';

  const isSubActive = SkedulosaSelectedViewTable?.status === 'Active';

  const handlePauseResume = useCallback(async () => {
    if (!SkedulosaSelectedViewTable || pauseResumeLoading) return;
    const bridge =
      typeof window !== 'undefined' ? window.skedulosaBridge : undefined;
    if (!bridge) return;

    const shouldPause = isSubActive;
    setPauseResumeLoading(shouldPause ? 'pause' : 'resume');
    try {
      if (SkedulosaSelectedViewTable.toolkit_channel_id != null) {
        await bridge.setChannelActive(
          SkedulosaSelectedViewTable.toolkit_channel_id,
          !shouldPause,
        );
      }
      const fresh = getSubscription(SkedulosaSelectedViewTable.id);
      if (fresh) {
        updateSubscription(fresh.id, {
          ...fresh,
          status: shouldPause ? 'Paused' : 'Active',
        });
      }
    } catch (err) {
      console.error('[skedulosa] pause/resume failed:', err);
    } finally {
      setPauseResumeLoading(null);
    }
  }, [
    SkedulosaSelectedViewTable,
    pauseResumeLoading,
    isSubActive,
    getSubscription,
    updateSubscription,
  ]);

  const handleScrapeNow = useCallback(async () => {
    if (!SkedulosaSelectedViewTable) return;
    if (SkedulosaSelectedViewTable.toolkit_channel_id === undefined) return;
    const bridge =
      typeof window !== 'undefined' ? window.skedulosaBridge : undefined;
    if (!bridge) return;
    if (scrapeResetTimer.current) {
      clearTimeout(scrapeResetTimer.current);
      scrapeResetTimer.current = null;
    }
    setScrapeStatus('running');
    try {
      const scrapeResult = await (bridge.runScraperOnce(
        SkedulosaSelectedViewTable.toolkit_channel_id,
      ) as Promise<unknown>);
      showScrapeErrors(scrapeResult);
      const resultObj =
        scrapeResult && typeof scrapeResult === 'object'
          ? (scrapeResult as {
              message?: string;
              scrapedCount?: number;
              errors?: unknown[];
            })
          : null;
      const message = resultObj?.message ?? '';
      const blockedByConcurrency = message === 'Already running';
      const scraperUnavailable = message.includes('Scraper not initialized');
      const blockedByCooldown = message.startsWith('Cooldown:');
      const canMarkChecked = !blockedByConcurrency && !scraperUnavailable;

      if (blockedByConcurrency) {
        toast({
          title: 'Scraper already running',
          description: 'Please wait for the current scrape to finish.',
          duration: 5000,
        });
      }
      if (blockedByCooldown) {
        toast({
          title: 'Fetch now is on cooldown',
          description: 'Please wait a few minutes, then try again.',
          duration: 5000,
        });
      }

      if (canMarkChecked) {
        const fresh = getSubscription(SkedulosaSelectedViewTable.id);
        if (fresh) {
          updateSubscription(fresh.id, {
            ...fresh,
            last_checked_time: new Date().toISOString(),
          });
        }
      }
      setScrapeStatus('done');
      scrapeResetTimer.current = setTimeout(
        () => setScrapeStatus('idle'),
        3000,
      );
    } catch (err) {
      console.error('[skedulosa] scrapeNow failed', err);
      setScrapeStatus('error');
      scrapeResetTimer.current = setTimeout(
        () => setScrapeStatus('idle'),
        4000,
      );
    }
  }, [SkedulosaSelectedViewTable]);

  useEffect(() => {
    setScrapeStatus('idle');
    if (scrapeResetTimer.current) {
      clearTimeout(scrapeResetTimer.current);
      scrapeResetTimer.current = null;
    }
  }, [selectedChannelId]);

  const handleDelete = useCallback(
    (id: string) => {
      const channel = scheduledChannels.find((ch) => ch.channelId === id);
      setDeleteConfirm({
        channelId: id,
        channelName: channel?.channelName ?? id,
      });
      setContextMenu(null);
    },
    [scheduledChannels],
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    const id = deleteConfirm.channelId;
    setDeleteConfirm(null);
    const sub = getSubscription(id);
    removeSubscription(id);
    const bridge = window.skedulosaBridge;
    if (bridge && sub) {
      const calls: Promise<unknown>[] = [];
      if (sub.toolkit_channel_id != null)
        calls.push(bridge.deleteChannel(sub.toolkit_channel_id));
      if (sub.toolkit_schedule_id != null)
        calls.push(bridge.deleteSchedule(sub.toolkit_schedule_id));
      if (calls.length > 0) {
        await Promise.all(calls).catch((err) =>
          console.error(
            '[SelectedSubscriptionView] Toolkit delete failed:',
            err,
          ),
        );
      }
    }
    // If deleted channel was selected, navigate to first remaining
    if (id === channelId) {
      const next = scheduledChannels.find((ch) => ch.channelId !== id);
      if (next) {
        navigate(`/skedulosa/selected-subscription/${next.channelId}`);
      } else {
        navigate('/skedulosa');
      }
    }
  }, [
    deleteConfirm,
    getSubscription,
    removeSubscription,
    channelId,
    scheduledChannels,
    navigate,
  ]);

  // ── Stat card values ────────────────────────────────────────────────────
  const downloadCount = SkedulosaSelectedViewTable?.downloads.length ?? 0;
  const storageStr = formatBytesToHuman(
    getTotalStorageForDownloads(SkedulosaSelectedViewTable?.downloads ?? []),
  );
  const createdDate = SkedulosaSelectedViewTable
    ? new Date(SkedulosaSelectedViewTable.date_created)
    : null;
  const createdStr = createdDate ? formatWordDate(createdDate) : '—';
  const createdSmallStr = createdDate ? formatNumericDate(createdDate) : undefined;

  const lastCheckedDate = (() => {
    const lct = SkedulosaSelectedViewTable?.last_checked_time;
    const dc = SkedulosaSelectedViewTable?.date_created;
    if (lct && dc && new Date(lct) >= new Date(dc)) return new Date(lct);
    return dc ? new Date(dc) : null;
  })();
  const lastCheckedStr = lastCheckedDate
    ? formatRelativeTime(lastCheckedDate.toISOString())
    : '—';
  const lastCheckedSmallStr = lastCheckedDate
    ? formatNumericDate(lastCheckedDate)
    : undefined;

  const statusMapping = (status: ScheduledChannel['status']) => {
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
            {SkedulosaSelectedViewTable ? (
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12">
                  <AvatarImage
                    src={SkedulosaSelectedViewTable.channel_details?.avatarUrl}
                    alt={SkedulosaSelectedViewTable.source}
                    className="w-12 h-12 rounded object-contain flex-shrink-0"
                  />
                  <AvatarFallback className="w-12 h-12 rounded bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                    <LuTv size={22} className="text-violet-500 dark:text-violet-400" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="gap-2 flex flex-row items-center">
                    <span className="text-[13.5px] font-bold text-gray-900 dark:text-gray-100">
                      {SkedulosaSelectedViewTable.source}
                    </span>
                    <div
                      className={`flex gap-1 items-center ${statusMapping(
                        SkedulosaSelectedViewTable.status,
                      )}`}
                    >
                      <FaCircle size={6} />
                      <span className="text-[11px]">
                        {SkedulosaSelectedViewTable.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 items-center mt-0.5">
                    <span
                      title={SkedulosaSelectedViewTable.sourceUrl}
                      className="text-xs text-gray-500 dark:text-gray-400"
                    >
                      <span className="1xl:hidden">
                        {SkedulosaSelectedViewTable.sourceUrl.length > 20
                          ? `${SkedulosaSelectedViewTable.sourceUrl.slice(
                              0,
                              20,
                            )}…`
                          : SkedulosaSelectedViewTable.sourceUrl}
                      </span>
                      <span className="hidden 1xl:inline">
                        {SkedulosaSelectedViewTable.sourceUrl.length > 40
                          ? `${SkedulosaSelectedViewTable.sourceUrl.slice(
                              0,
                              40,
                            )}…`
                          : SkedulosaSelectedViewTable.sourceUrl}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Select a channel from the list.
              </p>
            )}
          </div>
        </div>
        {/* Stat cards */}
        <div className="flex flex-1 flex-row items-center w-full rounded-lg px-4 py-2">
          <div className="flex flex-1 justify-center gap-2">
            <StatCard
              value={String(downloadCount)}
              label="Downloads"
              icon={
                <MdOutlineFileDownload size={25} className="text-primary" />
              }
            />
            <StatCard
              value={storageStr}
              label="Storage"
              icon={<LuHardDrive size={22} className="text-primary" />}
            />
            <StatCard
              value={createdStr}
              smallValue={createdSmallStr}
              label="Created"
              icon={<LuCalendarCheck2 size={22} className="text-primary" />}
            />
            <StatCard
              value={lastCheckedStr}
              smallValue={lastCheckedSmallStr}
              label="Last checked"
              icon={<TbCalendarTime size={24} className="text-primary" />}
            />
          </div>
          {/* Action buttons */}
          {SkedulosaSelectedViewTable && (
            <div className="grid grid-cols-2 gap-2 1xl:flex 1xl:flex-row 1xl:gap-2 items-center flex-shrink-0 pl-6">
              <TooltipWrapper
                content={
                  isSubActive ? 'Pause subscription' : 'Resume subscription'
                }
              >
                <button
                  type="button"
                  title={isSubActive ? 'Pause' : 'Resume'}
                  disabled={!!pauseResumeLoading}
                  onClick={handlePauseResume}
                  className="rounded-md h-7 flex items-center justify-center p-2 bg-[#f9f9f9] dark:bg-transparent hover:bg-[#EDEDED] dark:hover:bg-darkModeHover disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pauseResumeLoading ? (
                    <div className="w-[15px] h-[15px] border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  ) : isSubActive ? (
                    <FiPause size={15} color="gray" />
                  ) : (
                    <FiPlay size={15} className="text-green-500" />
                  )}
                </button>
              </TooltipWrapper>
              <TooltipWrapper
                content={
                  scrapeStatus === 'running'
                    ? 'Fetching...'
                    : scrapeStatus === 'done'
                    ? 'Done!'
                    : scrapeStatus === 'error'
                    ? 'Failed'
                    : 'Fetch Now'
                }
              >
                <button
                  type="button"
                  title="Fetch now"
                  onClick={handleScrapeNow}
                  disabled={!canRunScrapeNow}
                  className="rounded-md h-7 flex items-center justify-center p-2 bg-[#f9f9f9] dark:bg-transparent hover:bg-[#EDEDED] dark:hover:bg-darkModeHover disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <TbRefresh
                    size={15}
                    color={
                      scrapeStatus === 'done'
                        ? 'green'
                        : scrapeStatus === 'error'
                        ? 'red'
                        : 'gray'
                    }
                  />
                </button>
              </TooltipWrapper>
              <TooltipWrapper content="Edit Subscription">
                <button
                  type="button"
                  title="Edit"
                  onClick={() => setEditModalId(selectedChannelId)}
                  className="rounded-md h-7 flex items-center justify-center p-2 bg-[#f9f9f9] dark:bg-transparent hover:bg-[#EDEDED] dark:hover:bg-darkModeHover"
                >
                  <HiOutlinePencilAlt size={15} color="gray" />
                </button>
              </TooltipWrapper>
              <TooltipWrapper content="Delete Subscription">
                <button
                  type="button"
                  title="Delete"
                  onClick={() =>
                    selectedChannelId && handleDelete(selectedChannelId)
                  }
                  className="rounded-md h-7 flex items-center justify-center p-2 bg-[#f9f9f9] dark:bg-transparent hover:bg-[#EDEDED] dark:hover:bg-darkModeHover"
                >
                  <FiTrash size={15} color="red" />
                </button>
              </TooltipWrapper>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-col flex-1 min-h-0">
        {/* ── Tab bar ─────────────────────────────────────────────────── */}
        <div className="gap-4 flex flex-row border-b border-gray-200 dark:border-gray-700">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
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

        {/* ── Tab panel ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden hover-scrollbar">
          {activeTab === 'downloads' && <DownloadTab channelId={channelId} />}
          {activeTab === 'analytics' && <AnalyticsTab channelId={channelId} />}
          {activeTab === 'activity-log' && (
            <ActivityLogTab channelId={channelId} />
          )}
          {activeTab === 'settings' && <SettingsTab channelId={channelId} />}
        </div>
      </div>
      {contextMenu && (
        <SkedulosaContextMenu
          position={contextMenu.position}
          subscriptionId={contextMenu.channelId}
          onEdit={() => setEditModalId(contextMenu.channelId)}
          onDelete={() => handleDelete(contextMenu.channelId)}
          onClose={() => setContextMenu(null)}
        />
      )}
      {editModalId && (
        <SkedulosaEditModal
          isOpen={true}
          subscriptionId={editModalId}
          onClose={() => setEditModalId(null)}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={confirmDelete}
        title={`Delete ${deleteConfirm?.channelName} subscription ?`}
        confirmLabel="Delete"
        message={`This will remove the entire subscription and their schedule information. This cannot be undone.`}
      />
    </div>
  );
};

export default SkedulosaSelectedViewTable;
