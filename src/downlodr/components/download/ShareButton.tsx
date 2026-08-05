import { Button } from '@/core-app/components/shadcn/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/core-app/components/shadcn/components/ui/dialog';
import { useToast } from '@/core-app/components/shadcn/hooks/use-toast';
import { cn } from '@/core-app/components/shadcn/lib/utils';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaFacebookF } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { GoShareAndroid } from 'react-icons/go';
import { IoIosInformationCircleOutline } from 'react-icons/io';
import { IoLinkOutline } from 'react-icons/io5';
import { MdOutlineMailOutline } from 'react-icons/md';
import { TalisikClient } from 'talisik-shortener';

interface ShareButtonProps {
  videoUrl: string;
  name: string;
  status: string;
  thumbnailLocation?: string;
  format?: string;
  size?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface ShareOptionProps {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  className?: string;
  bgColor?: string;
}

const ShareOption = ({
  onClick,
  className,
  icon,
  label,
  bgColor,
}: ShareOptionProps) => {
  return (
    <div
      className="flex flex-col items-center cursor-pointer group"
      onClick={(e) => {
        e.stopPropagation();
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
        {icon}
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
}: ShareButtonProps) => {
  const { t } = useTranslation('downlodr');
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setIsOpen = isControlled ? (onOpenChange ?? (() => {})) : setInternalOpen;
  const { toast } = useToast();

  // Base64 encoding function
  const encodeVideoUrl = (url: string, fallback = false) => {
    try {
      const payload = fallback
        ? {
            url,
            expiresAt: new Date(
              new Date().getTime() + 15778476000,
            ).toISOString(), // Current date + 6 months
          }
        : {
            url,
            createdAt: new Date().toISOString(),
          };

      return btoa(JSON.stringify(payload));
    } catch (error) {
      console.error('Error encoding URL:', error);
      return null;
    }
  };

  const displayToastError = () => {
    toast({
      title: t('shareButton.toast.errorTitle'),
      description: t('shareButton.toast.errorDesc'),
      variant: 'destructive',
    });
  };

  // Generate shareable link with shareId
  const generateShareableLink = async (url: string) => {
    if (!url) return null;

    const encodedUrl = encodeVideoUrl(url);
    if (!encodedUrl) return null;

    try {
      if (!TalisikClient) {
        throw new Error('TalisikClient is not available');
      }

      // Initialize the TalisikClient and set the base URL and timeout
      const client = new TalisikClient({
        baseUrl: 'https://go.downlodr.com',
        timeout: 10000,
      });

      // Shorten the URL using the TalisikClient and set the expiration time to 6 months
      const result = await client.shorten({
        url: `https://downlodr.com/share-video/?shareId=${encodedUrl}`,
        expiresHours: 15778476000, // 6 months in milliseconds
      });

      return result.shortUrl;
    } catch (error) {
      console.error(
        `Failed to shorten URL: ${error}. Falling back to original URL.`,
      );

      // Fallback to the original URL if the shortening fails
      const encodedUrl = encodeVideoUrl(url, true);
      if (!encodedUrl) return null;

      return `https://downlodr.com/share-video/?shareId=${encodedUrl}`;
    }
  };

  // Share handlers
  const handleCopyLink = async () => {
    const shareableLink = await generateShareableLink(videoUrl);

    if (!shareableLink) {
      toast({
        title: t('shareButton.toast.errorTitle'),
        description: t('shareButton.toast.errorDesc'),
        variant: 'destructive',
      });
      return;
    }

    navigator.clipboard
      .writeText(shareableLink)
      .then(() => {
        toast({
          title: t('shareButton.toast.copiedTitle'),
          description: t('shareButton.toast.copiedDesc'),
        });
      })
      .catch((error) => {
        console.error('Failed to copy to clipboard:', error);
        toast({
          title: t('shareButton.toast.copyFailedTitle'),
          description: t('shareButton.toast.copyFailedDesc'),
          variant: 'destructive',
        });
      });
  };

  const handleEmailShare = async () => {
    const shareableLink = await generateShareableLink(videoUrl);

    if (!shareableLink) {
      displayToastError();
      return;
    }

    window.downlodrFunctions.openExternalLink(
      `mailto:?subject=${encodeURIComponent(
        t('shareButton.emailSubject', { name }),
      )}&body=${encodeURIComponent(
        t('shareButton.emailBody', { link: shareableLink }),
      )}`,
    );
  };

  const handleFacebookShare = async () => {
    const shareableLink = await generateShareableLink(videoUrl);

    if (!shareableLink) {
      displayToastError();
      return;
    }

    window.downlodrFunctions.openExternalLink(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
        shareableLink,
      )}`,
    );
  };

  const handleTwitterShare = async () => {
    const shareableLink = await generateShareableLink(videoUrl);

    if (!shareableLink) {
      displayToastError();
      return;
    }

    window.downlodrFunctions.openExternalLink(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        t('shareButton.twitterText', { name }),
      )}&url=${encodeURIComponent(shareableLink)}`,
    );
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
            disabled={status !== 'finished'}
          >
            <GoShareAndroid size={20} />
          </Button>
        </TooltipWrapper>
      )}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{t('shareButton.title')}</DialogTitle>
          </DialogHeader>

          {/* Video Info Section */}
          <div
            className="flex mb-5 p-4 bg-gray-100 dark:bg-[#09090B] rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex-1 pr-4">
              <h3 className="text-sm font-medium mb-2 text-black dark:text-white">
                {name || t('shareButton.videoFallback')}
              </h3>
              <p className="text-sm text-black dark:text-white">
                {format || 'mp4'} • {formatFileSize(size)}
              </p>
            </div>
            <div className="w-[90px] h-[68px] rounded-[10px] overflow-hidden bg-gray-200 dark:bg-darkModeCompliment">
              {thumbnailLocation && (
                <img
                  src={thumbnailLocation}
                  alt={name}
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
            />
            <ShareOption
              onClick={handleEmailShare}
              className="bg-gray-100 dark:bg-darkMode"
              icon={
                <MdOutlineMailOutline className="text-black dark:text-white size-4" />
              }
              label={t('shareButton.emailLink')}
            />
            <ShareOption
              onClick={handleFacebookShare}
              icon={<FaFacebookF className="text-white size-4" />}
              label={t('shareButton.facebook')}
              bgColor="#1877F2"
            />
            <ShareOption
              onClick={handleTwitterShare}
              icon={<FaXTwitter className="text-white size-4" />}
              label={t('shareButton.twitter')}
              bgColor="#000000"
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
