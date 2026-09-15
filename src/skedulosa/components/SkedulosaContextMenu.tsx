import { showSkedulosaError } from '@/skedulosa/error-mapping/skedulosaErrors';
import { useSkedulosaStore } from '@/skedulosa/store/skedulosaStore';
import { useAfdaWebsitesStore } from '@/afda/store/afdaWebsitesStore';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { FiEdit2, FiPause, FiPlay, FiTrash2 } from 'react-icons/fi';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface SkedulosaContextMenuProps {
  position: ContextMenuPosition;
  subscriptionId: string;
  category?: string;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

const SkedulosaContextMenu = ({
  position,
  subscriptionId,
  category,
  onEdit,
  onDelete,
  onClose,
}: SkedulosaContextMenuProps) => {
  const { t } = useTranslation('skedulosa');
  const menuRef = useRef<HTMLDivElement>(null);
  const getSubscription = useSkedulosaStore((s) => s.getSubscription);
  const updateSubscription = useSkedulosaStore((s) => s.updateSubscription);

  const afdaWebsite = useAfdaWebsitesStore((s) =>
    s.websites.find((w) => w.id === subscriptionId),
  );
  const updateWebsite = useAfdaWebsitesStore((s) => s.updateWebsite);

  const isAfda = category === 'afda-website' || category === 'afda';

  // ── Skedulosa pause/resume ─────────────────────────────────────────────────
  const subscription = isAfda ? null : getSubscription(subscriptionId);
  const isPaused = isAfda
    ? afdaWebsite?.status === 'paused'
    : subscription?.status === 'Paused';

  const handlePauseResume = async () => {
    if (isAfda) {
      const bridge = typeof window !== 'undefined' ? (window as any).afdaBridge : undefined;
      if (!bridge || !afdaWebsite) return;
      const isActive = afdaWebsite.status === 'active' || afdaWebsite.status === 'idle';
      try {
        await Promise.allSettled(
          afdaWebsite.sections.map((s) =>
            isActive
              ? bridge.schedule.pause({ section_id: parseInt(s.id) })
              : bridge.schedule.resume({ section_id: parseInt(s.id) }),
          ),
        );
        const result = await bridge.websites.update({
          id: parseInt(afdaWebsite.id),
          patch: { status: isActive ? 'paused' : 'active' },
        });
        if (result?.website) updateWebsite(result.website);
      } catch (err) {
        console.error('[SkedulosaContextMenu] afda pause/resume failed:', err);
      }
      onClose();
      return;
    }

    if (!subscription) return;
    const nextStatus = isPaused ? 'Active' : 'Paused';
    const isActive = nextStatus === 'Active';

    if (subscription.toolkit_channel_id != null) {
      try {
        await window.skedulosaBridge?.setChannelActive(
          subscription.toolkit_channel_id,
          isActive,
        );
      } catch (err) {
        console.error('[SkedulosaContextMenu] setChannelActive failed:', err);
        showSkedulosaError(
          err instanceof Error ? err.message : 'pause-resume-failed',
        );
        onClose();
        return;
      }
    }

    updateSubscription(subscriptionId, { ...subscription, status: nextStatus });
    onClose();
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  // Clamp to viewport so menu doesn't go off-screen
  const menuWidth = 120;
  const menuHeight = 112;
  const x = Math.min(position.x, window.innerWidth - menuWidth - 8);
  const y = Math.min(position.y, window.innerHeight - menuHeight - 8);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white dark:bg-darkMode border border-gray-200 dark:border-darkModeCompliment rounded-md shadow-lg py-1 text-[12.5px]"
      style={{ left: x, top: y, width: menuWidth }}
    >
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-darkModeCompliment/50"
        onClick={() => {
          onEdit();
          onClose();
        }}
      >
        <FiEdit2 size={13} />
        {t('contextMenu.edit')}
      </button>
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-darkModeCompliment/50"
        onClick={handlePauseResume}
      >
        {isPaused ? <FiPlay size={13} /> : <FiPause size={13} />}
        {isPaused ? t('contextMenu.resume') : t('contextMenu.pause')}
      </button>
      <button
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-red-500 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-darkModeCompliment/50"
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        <FiTrash2 size={13} />
        {t('contextMenu.delete')}
      </button>
    </div>
  );
};

export default SkedulosaContextMenu;
