import { Play, Stop, StopAll } from '@/assets/icon';
import { Button } from '@/core-app/components/shadcn/components/ui/button';
import { cn } from '@/core-app/components/shadcn/lib/utils';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import React from 'react';
import DemoInputField from './DemoInputField';

interface DemoToolbarProps {
  url: string;
  onDownload: () => void;
  disabled?: boolean;
  isPlaylist?: boolean;
  isSubscription?: boolean;
  subscriptionVariant?: 'youtube' | 'website';
  className?: string;
}

const DemoToolbar: React.FC<DemoToolbarProps> = ({
  url,
  onDownload,
  disabled,
  isPlaylist,
  isSubscription,
  subscriptionVariant,
  className,
}) => {
  return (
    <div className="Toolbar-container">
      <div className={cn('flex items-center justify-between', className)}>
        <div className="flex items-center h-full px-2 space-x-0 md:space-x-2">
          <div id="demo-toolbar-controls" className="flex items-center gap-3 pl-4">
            <TooltipWrapper content="Start" side="bottom">
              <div>
                <Button
                  variant="transparent"
                  size="icon"
                  className="rounded-md h-7 flex items-center justify-center p-[2px] dark:bg-transparent cursor-not-allowed text-gray-800 dark:text-gray-400"
                  disabled
                  icon={<Play />}
                />
              </div>
            </TooltipWrapper>
            <TooltipWrapper content="Stop" side="bottom">
              <div>
                <Button
                  variant="transparent"
                  size="icon"
                  className="rounded-md h-7 flex items-center justify-center p-[2px] bg-[#f9f9f9] dark:bg-transparent cursor-not-allowed text-gray-800 dark:text-gray-400"
                  disabled
                  icon={<Stop />}
                />
              </div>
            </TooltipWrapper>
            <TooltipWrapper content="Stop All" side="bottom">
              <div>
                <Button
                  variant="transparent"
                  size="icon"
                  className="rounded-md h-7 flex items-center justify-center p-[2px] bg-[#f9f9f9] dark:bg-transparent cursor-not-allowed text-gray-800 dark:text-gray-400"
                  disabled
                  icon={<StopAll className="w-[16px] h-[16px]" />}
                />
              </div>
            </TooltipWrapper>
          </div>
        </div>

        <div className="pl-4 flex items-center w-full">
          <div className="w-full flex items-center justify-end">
            <DemoInputField
              url={url}
              onDownload={onDownload}
              disabled={disabled}
              isPlaylist={isPlaylist}
              isSubscription={isSubscription}
              subscriptionVariant={subscriptionVariant}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoToolbar;
