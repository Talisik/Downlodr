import React from 'react';
import { DemoStatus } from '../../hooks/useDemoSimulator';
import FakeProgressBar from './FakeProgressBar';

interface FakeDownloadRowProps {
  title: string;
  channel: string;
  size: string;
  progress: number;
  status: DemoStatus;
  speed?: string;
}

const FakeDownloadRow: React.FC<FakeDownloadRowProps> = ({
  title,
  channel,
  size,
  progress,
  status,
  speed = '2.4 MB/s',
}) => {
  const statusDotClass =
    status === 'complete'
      ? 'bg-green-500'
      : status === 'running'
      ? 'bg-primary animate-pulse'
      : 'bg-gray-400 dark:bg-darkModeDarkGray';

  return (
    <div className="w-full rounded-md border border-divider dark:border-darkModeCompliment bg-white dark:bg-darkModeTable shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2">
        <div className="w-16 h-10 rounded bg-gray-200 dark:bg-darkModeDarkGray flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium dark:text-darkModeLight truncate">
            {title}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
            {channel}
          </p>
          <div className="mt-1.5">
            <FakeProgressBar progress={progress} />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${statusDotClass}`} />
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {status === 'complete'
                ? 'Finished'
                : status === 'running'
                ? speed
                : 'Queued'}
            </span>
          </div>
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            {size}
          </span>
        </div>
      </div>
    </div>
  );
};

export default FakeDownloadRow;
