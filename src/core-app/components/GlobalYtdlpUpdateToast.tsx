import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { useEffect, useRef } from 'react';

type ToastCtrl = ReturnType<typeof toast>;

/**
 * Shows the startup yt-dlp self-update: a persistent "Updating yt-dlp…" toast
 * while the new binary downloads (downloads wait for it — see
 * ytdlpUpdateGate), replaced by a short result when it finishes. Silent when
 * yt-dlp is already up to date, since no update event is sent then.
 */
const GlobalYtdlpUpdateToast = (): null => {
  const progressRef = useRef<ToastCtrl | null>(null);

  useEffect(() => {
    const unsubscribe = window.ytdlp?.onUpdateStatus?.((status) => {
      const versionText = status.version ? ` ${status.version}` : '';
      if (status.state === 'updating') {
        progressRef.current?.dismiss();
        progressRef.current = toast({
          variant: 'progress',
          title: 'Updating yt-dlp…',
          description: `Installing yt-dlp${versionText}. Downloads will start once it's done.`,
          duration: Infinity,
          className: '[&_[toast-close]]:hidden',
        });
        return;
      }
      progressRef.current?.dismiss();
      progressRef.current = null;
      if (status.state === 'updated') {
        toast({
          variant: 'success',
          title: 'yt-dlp updated',
          description: `Now using yt-dlp${versionText}.`,
          duration: 5000,
        });
      } else {
        toast({
          variant: 'destructive',
          title: "Couldn't update yt-dlp",
          description:
            'Downloads will use the current version. It will try again next time Downlodr starts.',
          duration: 5000,
        });
      }
    });
    return () => {
      unsubscribe?.();
      progressRef.current?.dismiss();
    };
  }, []);

  return null;
};

export default GlobalYtdlpUpdateToast;
