import { cn } from '@/core-app/components/shadcn/lib/utils';

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-skeleton dark:bg-slate-800',
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };

