import {
  // DownloadPulse,
  // DownloadBounce,
  // DownloadProgress,
  // DownloadStream,
  DownloadComplete,
} from '@/skedulosa/components/downlodr-animations';
import spaceshipGif from '@/assets/skedulosa/images/spaceship.gif';
import BaseModal from '@/downlodr/components/modal/BaseModal';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// const LOADERS = [
//   DownloadPulse,
//   DownloadBounce,
//   DownloadProgress,
//   DownloadStream,
// ];

interface ScanningModalProps {
  isOpen: boolean;
  /** When true, the loader exits and DownloadComplete plays. */
  isDone: boolean;
  isYouTube?: boolean;
  onCancel: () => void;
  onRunInBackground: () => void;
}

const ScanningModal = ({
  isOpen,
  isDone,
  isYouTube = false,
  onCancel,
  onRunInBackground,
}: ScanningModalProps) => {
  const { t } = useTranslation('skedulosa');

  const YOUTUBE_MESSAGES = [
    t('scanningModal.youtubeMsg0'),
    t('scanningModal.youtubeMsg1'),
    t('scanningModal.youtubeMsg2'),
    t('scanningModal.youtubeMsg3'),
  ];

  const prevOpen = useRef(false);
  const [ytMsgIndex, setYtMsgIndex] = useState(0);

  useEffect(() => {
    prevOpen.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || isDone || !isYouTube) return;
    const id = setInterval(() => {
      setYtMsgIndex((i) => (i + 1) % YOUTUBE_MESSAGES.length);
    }, 2000);
    return () => clearInterval(id);
  }, [isOpen, isDone, isYouTube]);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onCancel}
      title={t('scanningModal.title')}
      width="max-w-[530px]"
      closeOnOverlay={false}
      footer={
        <div className="flex items-center justify-center gap-2 py-2 w-full">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 max-w-[180px] py-1.5 rounded-md text-sm border border-[#E8E8E8] dark:border-darkModeCompliment text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-darkModeCompliment"
          >
            {t('scanningModal.cancel')}
          </button>
          <button
            type="button"
            onClick={onRunInBackground}
            className="flex-1 max-w-[296px] py-1.5 rounded-md text-sm text-white"
            style={{ backgroundColor: '#F45513' }}
          >
            {t('scanningModal.runInBackground')}
          </button>
        </div>
      }
    >
      <div className="flex flex-col items-center justify-center py-4 gap-2">
        <div className="flex items-center justify-center w-full">
          <AnimatePresence mode="wait">
            {!isDone ? (
              <motion.div
                key="loader"
                className="w-full"
                initial={{ opacity: 1 }}
                exit={{ scale: 0.3, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeIn' }}
              >
                <img
                  src={spaceshipGif}
                  alt=""
                  style={{ width: 290, objectFit: 'contain' }}
                  className="mx-auto"
                />
              </motion.div>
            ) : (
              <motion.div
                key="complete"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <DownloadComplete size="md" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex flex-col items-center justify-center gap-1 mt-4">
          <p className="text-[15px] font-semibold text-gray-900 dark:text-gray-100">
            {isDone
              ? t('scanningModal.channelScanned')
              : isYouTube
              ? t('scanningModal.scanningChannel')
              : t('scanningModal.analyzingArticle')}
          </p>
          <div className="h-5 overflow-hidden flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={isDone ? 'done' : isYouTube ? ytMsgIndex : 'static'}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="text-[13px] text-gray-500 dark:text-gray-400 whitespace-nowrap"
              >
                {isDone
                  ? t('scanningModal.readyToSubscribe')
                  : isYouTube
                  ? YOUTUBE_MESSAGES[ytMsgIndex]
                  : t('scanningModal.discoveringSections')}
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </BaseModal>
  );
};

export default ScanningModal;
