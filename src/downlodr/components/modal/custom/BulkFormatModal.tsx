/**
 * Format picker for the toolbar's bulk Start. Offers quality tiers rather than
 * concrete formats (those differ per video) and previews which videos can't
 * match the chosen tier exactly — see resolveBulkFormat.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '../BaseModal';
import type { FormatOption } from '@/downlodr/schema/metadataSchema';
import {
  BULK_FORMAT_TIERS,
  resolveBulkFormat,
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
  onConfirm: (tier: BulkFormatTier) => void;
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
  const [showAdjusted, setShowAdjusted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTier('best');
      setShowAdjusted(false);
    }
  }, [isOpen]);

  const adjusted = useMemo(
    () =>
      videos
        .map((v) => ({
          video: v,
          resolved: resolveBulkFormat(tier, v.formats, v.stored),
        }))
        .filter((x) => x.resolved.adjusted !== null),
    [videos, tier],
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
              onConfirm(tier);
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

        {adjusted.length > 0 && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            <button
              onClick={() => setShowAdjusted((s) => !s)}
              className="w-full text-left font-medium"
            >
              {t('bulkFormat.adjustedCount', { count: adjusted.length })}{' '}
              <span className="underline">
                {showAdjusted ? t('bulkFormat.hide') : t('bulkFormat.show')}
              </span>
            </button>
            {showAdjusted && (
              <ul className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                {adjusted.map(({ video, resolved }) => (
                  <li key={video.id} className="flex justify-between gap-3">
                    <span className="truncate" title={video.title}>
                      {video.title}
                    </span>
                    <span className="flex-shrink-0 text-amber-700 dark:text-amber-400">
                      {resolved.label}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </BaseModal>
  );
};

export default BulkFormatModal;
