import { useMemo, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  filterChannelsByStatusAndCategory,
  ScheduledChannel,
  useSkedulosaStore,
} from '../store/skedulosaStore';
import {
  formatBytesToHuman,
  getTotalStorageForDownloads,
} from '../utils/subscriptionDownloadUtils';
import { formatRelativeTime } from '@/downlodr/pages/status/statusPageUtils';
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from '@/core-app/components/shadcn/components/ui/avatar';
import ActivityLogTab from './selectedTabPages/SkedulosaActivityLog';
import AnalyticsTab from './selectedTabPages/SkedulosaAnalytics';
import DownloadTab from './selectedTabPages/SkedulosaDownloads';
import SettingsTab from './selectedTabPages/SkedulosaSettings';
import { getExtractorIcon } from '@/downlodr/utils/icons/iconMapper';
import { FaCircle } from 'react-icons/fa';
import SkedulosaContextMenu, {
  type ContextMenuPosition,
} from '@/skedulosa/components/SkedulosaContextMenu';
import SkedulosaEditModal from '@/skedulosa/components/SkedulosaEditModal';
import ConfirmModal from '@/core-app/components/modal/custom/ConfirmModal';

// ── Tab ids (labels are translated at render time) ─────────────────────────
const TAB_IDS = ['downloads', 'analytics', 'activity-log', 'settings'] as const;

// ── Stat card ──────────────────────────────────────────────────────────────
function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1">
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
        {value}
      </span>
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
const SelectedSubscriptionView = () => {
  const { t } = useTranslation('skedulosa');
  const [activeTab, setActiveTab] = useState<string>('downloads');

  const [contextMenu, setContextMenu] = useState<{
    position: ContextMenuPosition;
    channelId: string;
  } | null>(null);
  const [editModalId, setEditModalId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    channelId: string;
    channelName: string;
  } | null>(null);

  const { channelId } = useParams();
  const navigate = useNavigate();
  const scheduledChannels = useSkedulosaStore((s) => s.scheduledChannels);
  const subscriptions = useSkedulosaStore((s) => s.subscriptions);
  const statusFilter = useSkedulosaStore((s) => s.statusFilter);
  const categoryFilter = useSkedulosaStore((s) => s.categoryFilter);
  const removeSubscription = useSkedulosaStore((s) => s.removeSubscription);
  const getSubscription = useSkedulosaStore((s) => s.getSubscription);

  const handleNavContextMenu = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      setContextMenu({
        position: { x: e.clientX, y: e.clientY },
        channelId: id,
      });
    },
    [],
  );

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

  const selectedChannelId = channelId ?? null;

  const filteredChannels = useMemo(
    () =>
      filterChannelsByStatusAndCategory(
        scheduledChannels,
        statusFilter,
        categoryFilter,
      ),
    [scheduledChannels, statusFilter, categoryFilter],
  );

  const selectedSubscription = useMemo(
    () => subscriptions.find((s) => s.id === selectedChannelId),
    [subscriptions, selectedChannelId],
  );

  const channelsForNav = useMemo(() => filteredChannels, [filteredChannels]);

  const handleTabChange = (tabValue: string) => {
    setActiveTab(tabValue);
  };

  // ── Stat card values ────────────────────────────────────────────────────
  const downloadCount = selectedSubscription?.downloads.length ?? 0;
  const storageStr = formatBytesToHuman(
    getTotalStorageForDownloads(selectedSubscription?.downloads ?? []),
  );
  const createdStr = (() => {
    try {
      return selectedSubscription
        ? new Date(selectedSubscription.date_created).toLocaleDateString()
        : '—';
    } catch {
      return '—';
    }
  })();
  const lastCheckedStr = (() => {
    const lct = selectedSubscription?.last_checked_time;
    const dc = selectedSubscription?.date_created;
    if (lct && dc && new Date(lct) >= new Date(dc)) {
      return formatRelativeTime(lct);
    }
    return dc ? new Date(dc).toLocaleDateString() : '—';
  })();

  // ── Empty state ─────────────────────────────────────────────────────────
  if (filteredChannels.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {t('selectedSubscriptionView.emptyState.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t('selectedSubscriptionView.emptyState.description')}
        </p>
      </div>
    );
  }

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
    <div className="flex flex-row h-full min-h-0">
      {/* ── Left channel nav ─────────────────────────────────────────── */}
      <nav
        aria-label="Channel list"
        className="w-1/6 flex flex-col overflow-y-auto flex-shrink-0 hover-scrollbar"
      >
        <div className="px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {t('selectedSubscriptionView.channelNav.header')}
        </div>
        <ul className="list-none p-0 m-0 px-2 space-y-0.5">
          {channelsForNav.map((channel) => {
            const isSelected = channel.channelId === selectedChannelId;
            const avatarUrl = subscriptions.find(
              (s) => s.id === channel.channelId,
            )?.channel_details?.avatarUrl;
            const fallbackChar = channel.channelName.charAt(0).toUpperCase();
            return (
              <li
                key={channel.channelId}
                onContextMenu={(e) =>
                  handleNavContextMenu(e, channel.channelId)
                }
              >
                <Link
                  to={`/skedulosa/selected-subscription/${channel.channelId}`}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 no-underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 ${
                    isSelected
                      ? 'bg-gray-200 dark:bg-darkModeCompliment font-semibold text-gray-900 dark:text-gray-100'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-darkModeCompliment/50'
                  }`}
                  aria-current={isSelected ? 'page' : undefined}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={avatarUrl} alt={channel.channelName} />
                    <AvatarFallback className="text-xs">
                      {fallbackChar}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-xxs">
                    {channel.channelName}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Right content ────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden bg-[#FCFDFD] dark:bg-darkMode">
        {/* ── Info header ─────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          {selectedSubscription ? (
            <>
              <div className="flex items-center justify-between mb-3">
                {/* Avatar + name */}
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 flex-shrink-0">
                    <AvatarImage
                      src={selectedSubscription.channel_details?.avatarUrl}
                      alt={selectedSubscription.source}
                    />
                    <AvatarFallback className="text-xs">
                      {selectedSubscription.source.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="gap-2 flex flex-row items-center">
                      <span className="text-[14px] font-bold text-gray-900 dark:text-gray-100">
                        {selectedSubscription.source}
                      </span>
                      <div
                        className={`flex gap-1 items-center ${statusMapping(
                          selectedSubscription.status,
                        )}`}
                      >
                        <FaCircle
                          className={statusMapping(selectedSubscription.status)}
                          size={10}
                        />

                        <span>{selectedSubscription.status}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 items-center mt-1">
                      <span className="text-[8px] h-4 w-4 flex items-center justify-center">
                        {getExtractorIcon('youtube')}
                      </span>
                      <span>Youtube</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stat cards */}
              <div className="flex flex-row gap-6 justify-around itenms-center mt-6">
                <StatCard
                  value={String(downloadCount)}
                  label={t('selectedSubscriptionView.stats.downloads')}
                />
                <StatCard
                  value={storageStr}
                  label={t('selectedSubscriptionView.stats.storage')}
                />
                <StatCard
                  value={createdStr}
                  label={t('selectedSubscriptionView.stats.created')}
                />
                <StatCard
                  value={lastCheckedStr}
                  label={t('selectedSubscriptionView.stats.lastChecked')}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('selectedSubscriptionView.selectChannel')}
            </p>
          )}
        </div>

        {/* ── Tab bar ─────────────────────────────────────────────────── */}
        <div className="gap-4 flex flex-row border-b border-gray-200 dark:border-gray-700 px-6">
          {TAB_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => handleTabChange(id)}
              className={`px-3 py-2 pt-2.5 text-md font-medium transition-colors focus-visible:outline-none whitespace-nowrap ${
                activeTab === id
                  ? 'border-b-2 border-primary text-gray-900 dark:text-gray-100 text-primary font-semibold'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              {t(`selectedSubscriptionView.tabs.${id}`)}
            </button>
          ))}
        </div>

        {/* ── Tab panel ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto p-2 hover-scrollbar">
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
        title={t('subscriptionPage.confirmDelete.title', {
          name: deleteConfirm?.channelName,
        })}
        confirmLabel={t('subscriptionPage.confirmDelete.confirmLabel')}
        message={t('subscriptionPage.confirmDelete.message')}
      />
    </div>
  );
};

export default SelectedSubscriptionView;
