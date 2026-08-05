import empty from '@/assets/skedulosa/images/empty.svg';
import { Button } from '@/core-app/components/shadcn/components/ui/button';
import { HiPlus } from 'react-icons/hi';
import { useTheme } from '@/core-app/components/ThemeProvider';
import NoSubscriptionDark from '@/assets/skedulosa/images/NoSubscriptionDark.svg';

type NoSchedulePageProps = {
  onOpenSubscribe?: (url?: string) => void;
};

const NoSchedulePage = ({ onOpenSubscribe }: NoSchedulePageProps) => {
  const { theme } = useTheme();
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <img
        src={isDark ? NoSubscriptionDark : empty}
        alt="No Schedule"
        className="w-2/6"
      />
      <div className="text-center w-2/6 mt-4">
        <h1 className="text-sm font-bold">No Subscriptions Yet</h1>
        <p className="text-gray-500 dark:text-gray-400 text-[12.5px] mt-2">
          Subscribe to YouTube channels, playlists, or RSS feeds and
          Subscriptions will automatically download new content on your schedule
          — even when Downlodr is closed.
        </p>
        <Button
          className="mt-4 py-2 pb-7 bg-primary text-white text-[12.5px] gap-1 hover:opacity-90 dark:hover:opacity-75"
          onClick={() => onOpenSubscribe?.()}
        >
          <span className="flex items-center gap-2">
            <HiPlus size={16} className="text-white dark:text-black font-bold" />
            Add your first subscription
          </span>
        </Button>
      </div>
    </div>
  );
};

export default NoSchedulePage;
