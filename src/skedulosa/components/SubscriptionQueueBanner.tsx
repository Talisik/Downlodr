// src/skedulosa/components/SubscriptionQueueBanner.tsx

import { useEffect, useState } from 'react';
import { useSubscriptionQueue } from '@/skedulosa/context/SubscriptionQueueContext';

const LINGER_MS = 5000;

/**
 * Renders a thin status bar at the top of the Skedulosa main content area
 * while subscriptions are being processed from the queue.
 * Stays visible for LINGER_MS after the queue drains so it doesn't flash away.
 * Returns null when the queue is idle and the linger period has elapsed.
 */
export function SubscriptionQueueBanner() {
  const { pendingCount, processingCount } = useSubscriptionQueue();
  const isActive = processingCount > 0 || pendingCount > 0;
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isActive) {
      setIsVisible(true);
    } else {
      const timer = setTimeout(() => setIsVisible(false), LINGER_MS);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  if (!isVisible) return null;

  if (!isActive) {
    return (
      <div className="flex items-center gap-2 bg-primary/10 dark:bg-primary/20 border-b border-primary/20 px-4 py-2 text-xs text-primary font-medium">
        <span className="inline-block w-2 h-2 rounded-full bg-primary shrink-0" />
        <span>Subscriptions set up successfully</span>
      </div>
    );
  }

  const parts: string[] = [];
  if (processingCount > 0)
    parts.push(
      `${processingCount} subscription${processingCount > 1 ? 's' : ''} processing`,
    );
  if (pendingCount > 0)
    parts.push(`${pendingCount} pending`);

  return (
    <div className="flex items-center gap-2 bg-primary/10 dark:bg-primary/20 border-b border-primary/20 px-4 py-2 text-xs text-primary font-medium">
      <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
      <span>Setting up subscriptions — {parts.join(', ')}</span>
    </div>
  );
}
