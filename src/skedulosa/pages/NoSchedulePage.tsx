/**
 * A custom React Sub Page
 * This component acts as the no schedule page in case the user has no schedule
 *
 * @returns JSX.Element - The rendered component displaying no schedule page.
 */

import empty from '@/assets/skedulosa/images/empty.svg';
import { Button } from '@/core-app/components/shadcn/components/ui/button';
import { useState } from 'react';
import { HiPlus } from 'react-icons/hi';
import SkedulosaSubscribeModal from '../components/SkedulosaSubscribeModal';
import { useTheme } from '@/core-app/components/ThemeProvider';
import NoSubscriptionDark from '@/assets/skedulosa/images/NoSubscriptionDark.svg';

type NoSchedulePageProps = {
  onSubscriptionCreated?: (channelName: string, subscriptionId: string) => void;
};

const NoSchedulePage = ({ onSubscriptionCreated }: NoSchedulePageProps) => {
  const { theme } = useTheme();
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [isSkedulosaSubscribeModalOpen, setIsSkedulosaSubscribeModalOpen] =
    useState(false);

  const handleCloseSkedulosaSubscribeModal = () => {
    setIsSkedulosaSubscribeModalOpen(false);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <img
        src={isDark ? NoSubscriptionDark : empty}
        alt="No Schedule"
        className="w-2/6"
      />
      <div className="text-center w-2/6 mt-4">
        <h1 className="text-sm font-bold">No Subscriptions Yet</h1>
        <p className="text-gray-500 text-[12.5px] mt-2">
          Subscribe to YouTube channels, playlists, or RSS feeds and Skedulosa
          will automatically download new content on your schedule — even when
          Downlodr is closed.
        </p>
        <Button
          className="mt-4 py-2 pb-7 bg-primary text-white text-[12.5px] gap-1 hover:opacity-90 dark:hover:opacity-75"
          onClick={() => setIsSkedulosaSubscribeModalOpen(true)}
        >
          <span className="flex items-center gap-2">
            <HiPlus
              size={16}
              className="text-white dark:text-black font-bold"
            />
            Add your first subscription
          </span>
        </Button>
      </div>
      <SkedulosaSubscribeModal
        isOpen={isSkedulosaSubscribeModalOpen}
        onClose={handleCloseSkedulosaSubscribeModal}
        onSubscriptionCreated={onSubscriptionCreated}
      />
    </div>
  );
};

export default NoSchedulePage;
