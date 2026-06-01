import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { ToastAction } from '@/core-app/components/shadcn/components/ui/toast';
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { useSkedulosaStore } from '@/skedulosa/store/skedulosaStore';
import ScanningModal from '@/skedulosa/components/ScanningModal';

const GlobalScanningModal = () => {
  const { t } = useTranslation('skedulosa');
  const {
    analyzingChannel,
    analyzingStatus,
    isAnalyzingDismissed,
    clearChannelAnalysis,
    setAnalyzingDismissed,
    setPendingSubscribeUrl,
  } = useSkedulosaStore();
  const navigate = useNavigate();
  const location = useLocation();
  const backgroundToastRef = useRef<{ dismiss: () => void } | null>(null);

  // When analysis finishes: re-surface if dismissed, otherwise play checkmark then navigate back
  useEffect(() => {
    if (analyzingStatus !== 'done') return;
    if (isAnalyzingDismissed) {
      setAnalyzingDismissed(false);
      return;
    }
    const t = setTimeout(() => {
      // If user navigated away from /skedulosa, take them back with URL pre-filled
      if (analyzingChannel && !location.pathname.startsWith('/skedulosa')) {
        setPendingSubscribeUrl(analyzingChannel.url);
        navigate('/skedulosa/subscription');
      }
      clearChannelAnalysis();
    }, 900);
    return () => clearTimeout(t);
  }, [analyzingStatus, isAnalyzingDismissed]);

  // Show/dismiss a persistent orange toast while analysis runs in the background
  useEffect(() => {
    if (isAnalyzingDismissed && analyzingStatus === 'analyzing') {
      const { dismiss } = toast({
        variant: 'progress',
        title: (
          <span className="flex items-center gap-2 mr-3 mt-1 text-white font-normal">
            <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin shrink-0" />
            {t('scanningModal.scanningChannelToast')}
          </span>
        ),
        action: (
          <ToastAction
            altText="View Progress"
            onClick={() => setAnalyzingDismissed(false)}
            className="shrink-0 rounded-md px-3 py-4 text-sm font-medium text-white bg-white/20 hover:bg-white/30 border-0 ring-0 focus:ring-0"
          >
            {t('scanningModal.viewProgress')}
          </ToastAction>
        ),
        duration: Infinity,
        className: '[&>button]:text-white [&_[toast-close]]:hidden w-[377px]',
      });
      backgroundToastRef.current = { dismiss };
    } else {
      backgroundToastRef.current?.dismiss();
      backgroundToastRef.current = null;
    }
  }, [isAnalyzingDismissed, analyzingStatus]);

  return (
    <ScanningModal
      isOpen={
        analyzingStatus !== 'idle' &&
        !isAnalyzingDismissed &&
        analyzingChannel !== null
      }
      isDone={analyzingStatus === 'done'}
      isYouTube={analyzingChannel?.isYouTube ?? false}
      onCancel={clearChannelAnalysis}
      onRunInBackground={() => setAnalyzingDismissed(true)}
    />
  );
};

export default GlobalScanningModal;
