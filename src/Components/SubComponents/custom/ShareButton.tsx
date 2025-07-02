import React, { useState } from 'react';
import { FaFacebookF } from 'react-icons/fa';
import { FaXTwitter } from 'react-icons/fa6';
import { GoShareAndroid } from 'react-icons/go';
import { IoIosInformationCircleOutline } from 'react-icons/io';
import { IoLinkOutline } from 'react-icons/io5';
import { MdOutlineMailOutline } from 'react-icons/md';
import { TalisikClient } from 'talisik-shortener';
import { Button } from '../shadcn/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../shadcn/components/ui/dialog';
import { useToast } from '../shadcn/hooks/use-toast';
import { cn } from '../shadcn/lib/utils';

interface ShareButtonProps {
  videoUrl: string;
  name: string;
  status: string;
  thumbnailLocation?: string;
  format?: string;
  size?: number;
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
      onClick={onClick}
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
}: ShareButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
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
      title: 'Error',
      description: 'Could not generate shareable link',
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
        title: 'Error',
        description: 'Could not generate shareable link',
        variant: 'destructive',
      });
      return;
    }

    navigator.clipboard
      .writeText(shareableLink)
      .then(() => {
        toast({
          title: 'Link Copied',
          description: 'Link has been copied to clipboard.',
        });
      })
      .catch((error) => {
        console.error('Failed to copy to clipboard:', error);
        toast({
          title: 'Copy Failed',
          description: 'Could not copy link to clipboard. Please try again.',
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
        `Check out this video: ${name}`,
      )}&body=${encodeURIComponent(
        `I thought you might enjoy this video: ${shareableLink}`,
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
        `Check out this video: ${name}`,
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
        <GoShareAndroid />
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share video</DialogTitle>
          </DialogHeader>

          {/* Video Info Section */}
          <div className="flex mb-5 p-4 bg-gray-100 dark:bg-[#09090B] rounded-lg">
            <div className="flex-1 pr-4">
              <h3 className="text-sm font-medium mb-2 text-black dark:text-white">
                {name || 'Video'}
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
          <div className="grid grid-cols-4 gap-4 mb-5">
            <ShareOption
              onClick={handleCopyLink}
              className="bg-gray-100 dark:bg-darkMode"
              icon={
                <IoLinkOutline className="text-black dark:text-white size-4" />
              }
              label="Copy Link"
            />
            <ShareOption
              onClick={handleEmailShare}
              className="bg-gray-100 dark:bg-darkMode"
              icon={
                <MdOutlineMailOutline className="text-black dark:text-white size-4" />
              }
              label="Email Link"
            />
            <ShareOption
              onClick={handleFacebookShare}
              icon={<FaFacebookF className="text-white size-4" />}
              label="Facebook"
              bgColor="#1877F2"
            />
            <ShareOption
              onClick={handleTwitterShare}
              icon={<FaXTwitter className="text-white size-4" />}
              label="X (Twitter)"
              bgColor="#000000"
            />
          </div>

          {/* Disclaimer */}
          <div className="flex items-center text-gray-600 dark:text-gray-400">
            <div className="mr-2">
              <IoIosInformationCircleOutline />
            </div>
            <p className="text-xs italic">
              Kindly be aware that if you choose to share this video, it will
              become visible to the public, and others might be able to access
              its contents.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ShareButton;
