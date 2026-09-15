import { useEffect, useRef } from 'react';
import { ToastAction } from '@/core-app/components/shadcn/components/ui/toast';
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import {
  useAddonStore,
  type PackName,
  type AddonPackState,
} from '@/core-app/store/addonStore';

type ToastCtrl = ReturnType<typeof toast>;

function usePackDownloadToast(
  packName: PackName,
  label: string,
  state: AddonPackState,
  isAddonManagerOpen: boolean,
  cancelDownload: (pack: PackName) => void,
): void {
  const toastCtrlRef = useRef<ToastCtrl | null>(null);

  useEffect(() => {
    const shouldShow = state.status === 'downloading' && !isAddonManagerOpen;
    const progress = state.progress ?? 0;

    if (shouldShow) {
      const titleEl = (
        <span className="flex items-center gap-2 mr-3 mt-1 text-white font-normal">
          Downloading {label} ({progress}%)…
        </span>
      );
      const action = (
        <ToastAction
          altText="Cancel"
          onClick={() => cancelDownload(packName)}
          className="shrink-0 rounded-md px-3 py-4 text-sm font-medium text-white bg-white/20 hover:bg-white/30 border-0 ring-0 focus:ring-0"
        >
          Cancel
        </ToastAction>
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const titleProp = titleEl as any;
      if (!toastCtrlRef.current) {
        toastCtrlRef.current = toast({
          variant: 'progress',
          title: titleProp,
          action,
          duration: Infinity,
          className: '[&>button]:text-white [&_[toast-close]]:hidden w-[395px]',
        });
      } else {
        toastCtrlRef.current.update({
          id: toastCtrlRef.current.id,
          variant: 'progress',
          title: titleProp,
          action,
          duration: Infinity,
          className: '[&>button]:text-white [&_[toast-close]]:hidden w-[395px]',
        });
      }
    } else {
      toastCtrlRef.current?.dismiss();
      toastCtrlRef.current = null;
    }
  }, [state.status, state.progress, isAddonManagerOpen]);
}

const GlobalAddonDownloadToast = (): null => {
  const afdaState = useAddonStore((s) => s.afda);
  const skedulosaState = useAddonStore((s) => s.skedulosa);
  const isAddonManagerOpen = useAddonStore((s) => s.isAddonManagerOpen);
  const cancelDownload = useAddonStore((s) => s.cancelDownload);

  usePackDownloadToast(
    'afda-backend',
    'Article Fetcher',
    afdaState,
    isAddonManagerOpen,
    cancelDownload,
  );
  usePackDownloadToast(
    'video-nemesis-toolkit',
    'Subscriptions',
    skedulosaState,
    isAddonManagerOpen,
    cancelDownload,
  );

  return null;
};

export default GlobalAddonDownloadToast;
