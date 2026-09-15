import { Button } from '@/core-app/components/shadcn/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/core-app/components/shadcn/components/ui/dialog';
import { useToast } from '@/core-app/components/shadcn/hooks/use-toast';
import { cn } from '@/core-app/components/shadcn/lib/utils';
import { isShareAllowed, promptLogin } from '@/auth/store/authStore';
import { getTelemetryId } from '@/core-app/store/telemetryStore';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import { recordShare } from '@/downlodr/utils/share/shareApi';
import { Loader2 } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaFacebookF } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { GoShareAndroid } from 'react-icons/go';
import { IoIosInformationCircleOutline } from 'react-icons/io';
import { IoLinkOutline } from 'react-icons/io5';
import { MdOutlineMailOutline } from 'react-icons/md';

/** Which share option is currently waiting on a response, if any. */
type ShareAction = 'copy' | 'email' | 'facebook' | 'twitter';

interface ShareButtonProps {
  /** Single-video mode. Ignored — and not required — when `category` is set. */
  videoUrl?: string;
  name?: string;
  status?: string;
  thumbnailLocation?: string;
  format?: string;
  size?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * When set, the dialog shares the whole category instead of the single
   * video, and `videoUrl`/`name`/`status`/`format`/`size` are ignored.
   */
  category?: { name: string; videoUrls: string[] };
}

interface ShareOptionProps {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  className?: string;
  bgColor?: string;
  /** Swaps the icon for a spinner and ignores clicks while true. */
  loading?: boolean;
  /** Ignores clicks without changing appearance — used for the other
   * options while a different one is in flight, so only one request runs
   * at a time. */
  disabled?: boolean;
}

const ShareOption = ({
  onClick,
  className,
  icon,
  label,
  bgColor,
  loading,
  disabled,
}: ShareOptionProps) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center group',
        loading || disabled
          ? 'cursor-not-allowed opacity-60'
          : 'cursor-pointer',
      )}
      onClick={(e) => {
        e.stopPropagation();
        if (loading || disabled) return;
        onClick();
      }}
    >
      <div
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center mb-2',
          className,
        )}
        style={{ backgroundColor: bgColor }}
      >
        {loading ? (
          <Loader2
            className={cn(
              'size-4 animate-spin',
              bgColor ? 'text-white' : 'text-black dark:text-white',
            )}
          />
        ) : (
          icon
        )}
      </div>
      <span className="text-xs group-hover:underline">{label}</span>
    </div>
  );
};

const ShareButton = ({
  videoUrl,
  name,
  status,
  thumbnailLocation,
  format,
  size,
  open,
  onOpenChange,
  category,
}: ShareButtonProps) => {
  const { t } = useTranslation('downlodr');
  const [internalOpen, setInternalOpen] = useState(false);
  /** Which share option is mid-flight (link build + record round trip). */
  const [loadingAction, setLoadingAction] = useState<ShareAction | null>(null);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? onOpenChange ?? (() => {}) : setInternalOpen;
  const { toast } = useToast();

  const displayToastError = () => {
    toast({
      title: t('shareButton.toast.errorTitle'),
      description: t('shareButton.toast.errorDesc'),
      variant: 'destructive',
    });
  };

  /** What the link is *about* — the category, or the single video. */
  const shareName = category ? category.name : name;

  /**
   * Builds the link. `shareLink.ts` mints a fresh opaque share id per call,
   * so the URL stays short whatever the category's size — and so re-sharing
   * the same category yields a new link each time.
   *
   * Also starts (but does not wait on) a best-effort record of the share to
   * the backend. `recordPromise` is handed back alongside the link so a
   * caller that cares about the outcome — currently only `handleCopyLink`,
   * to decide whether its success toast counts as a full "success" — can
   * await it; callers that don't care (email/Facebook/Twitter, which open an
   * external app immediately) can just ignore it. Either way the record call
   * itself never blocks returning the link, and never affects it: if the
   * record fails, the link the user already has keeps working.
   */
  const generateShareableLink = async (): Promise<{
    link: string | null;
    recordPromise: Promise<boolean>;
  }> => {
    // The gate for every share option — all four handlers funnel through
    // here, so one check covers them. Opens the login modal rather than just
    // refusing, since being signed out is a fixable state.
    if (!isShareAllowed()) {
      promptLogin();
      toast({
        title: 'Log in to share',
        description: 'Sharing needs an account while the login gate is on.',
      });
      return { link: null, recordPromise: Promise.resolve(false) };
    }

    try {
      const link = category;

      // Record the list locally BEFORE the backend call, and independently of
      // whether it succeeds: the local store is the source of truth here, so
      // a share whose record call fails still belongs in the sidebar. Only
      // category shares become lists — a single
      // video isn't a list, and adding one entry per video share would bury
      // the real lists in the sidebar

      const recordPromise = link
        ? recordShare({
            senderUserId: getTelemetryId() ?? '',
            longUrl: link,
            title: shareName,
            listId,
          })
        : Promise.resolve(false);

      return { link, recordPromise };
    } catch (error) {
      console.error('Failed to build share link:', error);
      return { link: null, recordPromise: Promise.resolve(false) };
    }
  };

  // Share handlers. Each sets loadingAction for its own duration so its
  // button can swap to a spinner — see ShareOption's `loading` prop. Cleared
  // in `finally` so it always resets, success or failure.
  const handleCopyLink = async () => {
    setLoadingAction('copy');
    try {
      const { link, recordPromise } = await generateShareableLink();

      if (!link) {
        toast({
          title: t('shareButton.toast.errorTitle'),
          description: t('shareButton.toast.errorDesc'),
          variant: 'destructive',
        });
        return;
      }

      try {
        await navigator.clipboard.writeText(link);
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        toast({
          title: t('shareButton.toast.copyFailedTitle'),
          description: t('shareButton.toast.copyFailedDesc'),
          variant: 'destructive',
        });
        return;
      }

      // "Success" (the green variant) requires BOTH the link existing
      // (already true here) AND the backend confirming the record — not
      // just the copy. If the record failed, the copy still worked, so we
      // still tell the user that much; it just doesn't get the success
      // styling. This is also why the spinner has to cover this whole
      // function, not just the copy: the toast — and the button — are
      // waiting on this network round trip.
      const recorded = await recordPromise;
      toast({
        title: t('shareButton.toast.copiedTitle'),
        description: t('shareButton.toast.copiedDesc'),
        variant: recorded ? 'success' : 'default',
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleEmailShare = async () => {
    setLoadingAction('email');
    try {
      const { link: shareableLink } = await generateShareableLink();

      if (!shareableLink) {
        displayToastError();
        return;
      }

      window.downlodrFunctions.openExternalLink(
        `mailto:?subject=${encodeURIComponent(
          t('shareButton.emailSubject', { name: shareName }),
        )}&body=${encodeURIComponent(
          t('shareButton.emailBody', { link: shareableLink }),
        )}`,
      );
    } finally {
      setLoadingAction(null);
    }
  };

  const handleFacebookShare = async () => {
    setLoadingAction('facebook');
    try {
      const { link: shareableLink } = await generateShareableLink();

      if (!shareableLink) {
        displayToastError();
        return;
      }

      window.downlodrFunctions.openExternalLink(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
          shareableLink,
        )}`,
      );
    } finally {
      setLoadingAction(null);
    }
  };

  const handleTwitterShare = async () => {
    setLoadingAction('twitter');
    try {
      const { link: shareableLink } = await generateShareableLink();

      if (!shareableLink) {
        displayToastError();
        return;
      }

      window.downlodrFunctions.openExternalLink(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(
          t('shareButton.twitterText', { name: shareName }),
        )}&url=${encodeURIComponent(shareableLink)}`,
      );
    } finally {
      setLoadingAction(null);
    }
  };

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

  return (
    <>
      {!isControlled && (
        <TooltipWrapper content={t('shareButton.tooltip')} side="bottom">
          <Button
            variant="outline"
            size="icon"
            className="text-black dark:text-white bg-transparent dark:bg-transparent hover:bg-gray-50 dark:hover:bg-darkModeHover border-none"
            onClick={(e) => {
              e.stopPropagation();
              setIsOpen(true);
            }}
            disabled={!category && status !== 'finished'}
          >
            <GoShareAndroid size={20} />
          </Button>
        </TooltipWrapper>
      )}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>
              {category
                ? t('shareButton.categoryTitle')
                : t('shareButton.title')}
            </DialogTitle>
          </DialogHeader>

          {/* Video Info Section */}
          <div
            className="flex mb-5 p-4 bg-gray-100 dark:bg-[#09090B] rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-1 pr-4">
              <h3 className="text-sm font-medium mb-2 text-black dark:text-white">
                {shareName || t('shareButton.videoFallback')}
              </h3>
              <p className="text-sm text-black dark:text-white">
                {category
                  ? t('shareButton.videoCount', {
                      count: Math.min(
                        category.videoUrls.length,
                        MAX_SHARED_VIDEOS,
                      ),
                    })
                  : `${format || 'mp4'} • ${formatFileSize(size)}`}
              </p>
            </div>
            <div className="w-[90px] h-[68px] rounded-[10px] overflow-hidden bg-gray-200 dark:bg-darkModeCompliment">
              {thumbnailLocation && (
                <img
                  src={thumbnailLocation}
                  alt={shareName}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          </div>

          {/* Share Options */}
          <div
            className="grid grid-cols-4 gap-4 mb-5"
            onClick={(e) => e.stopPropagation()}
          >
            <ShareOption
              onClick={handleCopyLink}
              className="bg-gray-100 dark:bg-darkMode"
              icon={
                <IoLinkOutline className="text-black dark:text-white size-4" />
              }
              label={t('shareButton.copyLink')}
              loading={loadingAction === 'copy'}
              disabled={loadingAction !== null && loadingAction !== 'copy'}
            />
            <ShareOption
              onClick={handleEmailShare}
              className="bg-gray-100 dark:bg-darkMode"
              icon={
                <MdOutlineMailOutline className="text-black dark:text-white size-4" />
              }
              label={t('shareButton.emailLink')}
              loading={loadingAction === 'email'}
              disabled={loadingAction !== null && loadingAction !== 'email'}
            />
            <ShareOption
              onClick={handleFacebookShare}
              icon={<FaFacebookF className="text-white size-4" />}
              label={t('shareButton.facebook')}
              bgColor="#1877F2"
              loading={loadingAction === 'facebook'}
              disabled={loadingAction !== null && loadingAction !== 'facebook'}
            />
            <ShareOption
              onClick={handleTwitterShare}
              icon={<FaXTwitter className="text-white size-4" />}
              label={t('shareButton.twitter')}
              bgColor="#000000"
              loading={loadingAction === 'twitter'}
              disabled={loadingAction !== null && loadingAction !== 'twitter'}
            />
          </div>

          {/* Disclaimer */}
          <div
            className="flex items-center text-gray-600 dark:text-gray-400"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mr-2">
              <IoIosInformationCircleOutline />
            </div>
            <p className="text-xs italic">{t('shareButton.disclaimer')}</p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ShareButton;
