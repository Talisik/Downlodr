import React, { useState } from 'react';
import BaseModal from '../BaseModal';
import {
  useAddonStore,
  type AddonPackState,
  type PackName,
} from '@/core-app/store/addonStore';
import { Trash2, RefreshCw, FolderOpen, Loader2 } from 'lucide-react';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';

interface AddonManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddonManagerModal: React.FC<AddonManagerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const afdaState = useAddonStore((s) => s.afda);
  const skedulosaState = useAddonStore((s) => s.skedulosa);
  const needsRestart = useAddonStore((s) => s.needsRestart);

  const handleRestart = () => {
    window.addonBridge?.restart();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Add-ons"
      width="max-w-md"
    >
      <div className="flex flex-col gap-3 p-1 pb-8 -mt-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Manage optional add-ons to unlock additional features.
        </p>
        <AddonCard
          packName="video-nemesis-toolkit"
          label="Subscriptions"
          description="YouTube channel scheduling and automated downloads."
          size="~78.6 MB"
          state={skedulosaState}
          onRunInBackground={onClose}
        />
        <AddonCard
          packName="afda-backend"
          label="Article Fetcher"
          description="Article scraping and automated downloads for websites."
          size="~120 MB"
          state={afdaState}
          onRunInBackground={onClose}
        />
        {needsRestart && (
          <div className="flex items-center justify-between rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 gap-3">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Restart required to activate installed add-ons.
            </p>
            <button
              type="button"
              onClick={handleRestart}
              className="flex-shrink-0 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition-colors"
            >
              Restart
            </button>
          </div>
        )}
      </div>
    </BaseModal>
  );
};

function AddonCard({
  packName,
  label,
  description,
  size,
  state,
  onRunInBackground,
}: {
  packName: PackName;
  label: string;
  description: string;
  size: string;
  state: AddonPackState;
  onRunInBackground: () => void;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDownload = () => {
    window.addonBridge?.download(packName);
    useAddonStore
      .getState()
      .setPackState(packName, { status: 'downloading', progress: 0 });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await window.addonBridge?.delete(packName);
      if (result?.success) {
        useAddonStore
          .getState()
          .setPackState(packName, { status: 'not-installed' });
      } else {
        console.error('[AddonCard] delete returned non-success:', result);
      }
    } catch (err) {
      console.error('[AddonCard] delete failed:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenFolder = async () => {
    try {
      await window.addonBridge?.openFolder(packName);
    } catch (err) {
      console.error('[AddonCard] openFolder failed:', err);
    }
  };

  const isReady = state.status === 'ready';
  const isDownloading = state.status === 'downloading';
  const isOutdated = state.status === 'outdated';

  return (
    <div
      className={`rounded-lg border p-4 flex flex-col gap-3 ${
        isReady
          ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-zinc-900'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {label}
            </span>
            {isReady && (
              <span className="text-xs font-medium text-green-600 dark:text-green-400">
                ✓ Installed
              </span>
            )}
            {isOutdated && (
              <span className="text-xs font-medium text-amber-500">
                Update available
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {description}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {size}
          </p>
        </div>
        {!isReady && !isDownloading && (
          <button
            type="button"
            onClick={handleDownload}
            className="flex-shrink-0 px-3 py-1.5 rounded-md bg-primary hover:opacity-90 text-white text-xs font-semibold transition-opacity"
          >
            {isOutdated ? 'Update' : 'Download'}
          </button>
        )}
      </div>
      {(isReady || isOutdated) && (
        <div className="flex gap-1">
          <TooltipWrapper content="Delete add-on" side="top">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
            </button>
          </TooltipWrapper>
          <TooltipWrapper content="Re-download add-on" side="top">
            <button
              type="button"
              onClick={handleDownload}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <RefreshCw size={14} />
            </button>
          </TooltipWrapper>
          <TooltipWrapper content="Open folder" side="top">
            <button
              type="button"
              onClick={handleOpenFolder}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <FolderOpen size={14} />
            </button>
          </TooltipWrapper>
        </div>
      )}
      {isDownloading && (
        <div className="flex flex-col gap-1">
          <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-150"
              style={{ width: `${state.progress ?? 0}%` }}
            />
          </div>
          <span className="text-[11px] text-gray-400">
            {(state.progress ?? 0) >= 100
              ? 'Unzipping package…'
              : `${state.progress ?? 0}% — Downloading ${label}…`}
          </span>
          <div className="flex items-center gap-2 mt-1">
            <button
              type="button"
              onClick={() =>
                useAddonStore.getState().cancelDownload(packName)
              }
              className="flex-1 px-2 py-1 rounded text-xs text-red-500 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onRunInBackground}
              className="flex-1 px-2 py-1 rounded text-xs text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              Run in background →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AddonManagerModal;
