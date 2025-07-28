import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/Components/SubComponents/shadcn/components/ui/tooltip';
import { cn } from '@/Components/SubComponents/shadcn/lib/utils';
import React, { PropsWithChildren } from 'react';

interface TooltipWrapperProps extends PropsWithChildren {
  children: React.ReactNode;
  content: string | null;
  contentClassname?: string;
  side?: 'left' | 'right' | 'top' | 'bottom';
  hidden?: boolean;
  disableTooltip?: boolean;
}

const TooltipWrapper = ({
  children,
  content,
  contentClassname,
  side,
  hidden,
  disableTooltip,
}: TooltipWrapperProps) => {
  // If content is null or empty, just return the children without tooltip wrapper
  if (!content) {
    return <>{children}</>;
  }

  return (
    <TooltipProvider delayDuration={500}>
      <Tooltip>
        <TooltipTrigger className={cn('', hidden && 'hidden')} asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className={cn('max-w-[250px]', disableTooltip && 'hidden')}
        >
          <p className={cn('', contentClassname)}>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default TooltipWrapper;
