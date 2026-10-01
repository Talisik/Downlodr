import { Skeleton } from '@/core-app/components/shadcn/components/ui/skeleton';
import { cn } from '@/core-app/components/shadcn/lib/utils';

// Placeholders for a website we have neither a live entry nor a cached one
// for — i.e. the AFDA worker hasn't loaded yet and this id was never cached.
// Better than flashing the raw id and a default icon at the user.

const DOT_DELAYS = ['0ms', '150ms', '300ms'];

/** "Loading..." with staggered bouncing dots, in place of a website name. */
export function AfdaWebsiteLoadingName({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-flex items-baseline text-gray-400 dark:text-gray-500 motion-safe:animate-pulse',
        className,
      )}
    >
      Loading
      {DOT_DELAYS.map((delay) => (
        <span
          key={delay}
          aria-hidden
          className="inline-block motion-safe:animate-bounce"
          style={{ animationDelay: delay }}
        >
          .
        </span>
      ))}
    </span>
  );
}

/** Pulsing circle in place of a website favicon. */
export function AfdaWebsiteLoadingIcon({ className }: { className?: string }) {
  return (
    <Skeleton
      aria-hidden
      className={cn('rounded-full flex-shrink-0', className)}
    />
  );
}
