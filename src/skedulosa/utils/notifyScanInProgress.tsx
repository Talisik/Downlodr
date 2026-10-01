import { ToastAction } from '@/core-app/components/shadcn/components/ui/toast';
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import i18n from '@/core-app/i18n';
import { useSkedulosaStore } from '@/skedulosa/store/skedulosaStore';

/**
 * Explains why a subscribe modal didn't open. Every subscribe modal (YouTube
 * channel and AFDA website) is gated on analyzingStatus === 'idle', because
 * only one scan can run at a time — without this, clicking Subscribe during a
 * background scan silently did nothing. Offers a way back to the running scan.
 */
export function notifyScanInProgress(): void {
  const t = (key: string) => i18n.t(key, { ns: 'skedulosa' });
  toast({
    title: t('scanningModal.busyTitle'),
    description: t('scanningModal.busyDesc'),
    duration: 5000,
    action: (
      <ToastAction
        altText={t('scanningModal.viewProgress')}
        onClick={() =>
          useSkedulosaStore.getState().setAnalyzingDismissed(false)
        }
      >
        {t('scanningModal.viewProgress')}
      </ToastAction>
    ),
  });
}
