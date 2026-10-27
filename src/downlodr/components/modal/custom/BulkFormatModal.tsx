/**
 * Format picker for the toolbar's bulk Start. Offers quality tiers rather than
 * concrete formats (those differ per video), plus an optional file type, and
 * warns how many videos can't match the choice exactly — see resolveBulkFormat.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '../BaseModal';
import type { FormatOption } from '@/downlodr/schema/metadataSchema';
import {
  BULK_FORMAT_TIERS,
  resolveBulkFormat,
  videoContainersOf,
  type BulkFormatTier,
  type StoredFormat,
} from '@/downlodr/utils/download/bulkFormat';

export interface BulkFormatVideo {
  id: string;
  title: string;
  formats?: FormatOption[];
  stored: StoredFormat;
}

interface BulkFormatModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** `container` is a lowercase file type ('mp4'), or undefined for any. */
  onConfirm: (tier: BulkFormatTier, container?: string) => void;
  videos: BulkFormatVideo[];
  subscriptionCount: number;
  articleCount: number;
}

const BulkFormatModal: React.FC<BulkFormatModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  videos,
  subscriptionCount,
  articleCount,
}) => {
  const { t } = useTranslation('downlodr');
  const [tier, setTier] = useState<BulkFormatTier>('best');
  const [container, setContainer] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (isOpen) {
      setTier('best');
      setContainer(undefined);
    }
  }, [isOpen]);

  // Only offer file types at least one selected video actually has.
  const containers = useMemo(
    () => videoContainersOf(videos.map((v) => v.formats)),
    [videos],
  );
  const isAudioTier = tier === 'audio' || tier === 'mp3';
  const activeContainer = isAudioTier ? undefined : container;

  // A tier only names a range, so count the videos whose concrete pick
  // misses it (or the file type) and warn before they download.
  const adjustedCount = useMemo(
    () =>
      videos.filter(
        (v) =>
          resolveBulkFormat(tier, v.formats, v.stored, activeContainer)
            .adjusted !== null,
      ).length,
    [videos, tier, activeContainer],
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('bulkFormat.title')}
      width="max-w-lg"
      footer={
        <div className="flex justify-end space-x-3 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-1 text-gray-600 bg-white dark:bg-[#18181B] dark:text-white border dark:border-[#27272A] hover:bg-gray-50 dark:hover:bg-darkModeHover rounded-md font-medium"
          >
            {t('bulkFormat.cancel')}
          </button>
          <button
            onClick={() => {
              onConfirm(tier, activeContainer);
              onClose();
            }}
            className="px-4 py-1 bg-[#F45513] text-white rounded-md hover:bg-black hover:text-white font-medium"
          >
            {t('bulkFormat.download')}
          </button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex text-[13px] text-gray-700 dark:text-gray-300 space-x-1">
          <p>
            {t('bulkFormat.videoCount', { count: videos.length })}
            {subscriptionCount > 0 && (
              <span className="text-gray-500 dark:text-gray-400">
                {' · '}
                {t('bulkFormat.subscriptionsAsUsual', {
                  count: subscriptionCount,
                })}
              </span>
            )}
            {/* eslint-disable-next-line prettier/prettier*/}
          </p>
          {articleCount > 0 && (
            <p>
              <span>and </span>
              <span className="text-gray-700 dark:text-gray-300 ">
                {t('bulkFormat.articlesAsUsual', { count: articleCount })}
              </span>
            </p>
          )}
          <span> selected</span>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {t('bulkFormat.selectQuality')}
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {BULK_FORMAT_TIERS.map((value) => (
              <button
                key={value}
                onClick={() => setTier(value)}
                className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors text-center truncate ${
                  tier === value
                    ? 'bg-green-100 text-green-700 border-green-100'
                    : 'bg-white dark:bg-darkModeDropdown border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-green-500 hover:text-green-500'
                }`}
              >
                {t(`bulkFormat.tier.${value}`)}
              </button>
            ))}
          </div>
        </div>

        {containers.length > 1 && (
          <div>
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {t('bulkFormat.fileType')}
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {[undefined, ...containers].map((value) => (
                <button
                  key={value ?? 'any'}
                  disabled={isAudioTier}
                  onClick={() => setContainer(value)}
                  className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-colors text-center truncate disabled:opacity-40 disabled:cursor-not-allowed ${
                    activeContainer === value && !isAudioTier
                      ? 'bg-green-100 text-green-700 border-green-100'
                      : 'bg-white dark:bg-darkModeDropdown border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 enabled:hover:border-green-500 enabled:hover:text-green-500'
                  }`}
                >
                  {value ? value.toUpperCase() : t('bulkFormat.anyFileType')}
                </button>
              ))}
            </div>
          </div>
        )}

        {adjustedCount > 0 && (
          <p className="rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            {t('bulkFormat.adjustedCount', { count: adjustedCount })}
          </p>
        )}
      </div>
    </BaseModal>
  );
};

export default BulkFormatModal;
