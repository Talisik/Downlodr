/**
 * Store Rehydration Loader Component
 *
 * Displays a loading overlay while Zustand stores are rehydrating from
 * IndexedDB. This prevents users from interacting with the app before
 * the stores are ready, solving the first URL registration issue.
 */

import { useStoreRehydration } from '@/core-app/hooks/useStoreRehydration';
import { Loader2 } from 'lucide-react';
import React from 'react';

interface StoreRehydrationLoaderProps {
  children: React.ReactNode;
  showDetailedStatus?: boolean;
}

const StoreRehydrationLoader: React.FC<StoreRehydrationLoaderProps> = ({
  children,
  showDetailedStatus = false,
}) => {
  const { isRehydrated, rehydrationStatus } = useStoreRehydration();

  // Show loading overlay while stores are rehydrating
  if (!isRehydrated) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-card border rounded-lg p-6 shadow-lg max-w-md w-full mx-4">
          <div className="flex items-center justify-center mb-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>

          <div className="text-center">
            <h2 className="text-lg font-semibold mb-2">Loading Downlodr</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Initializing application data...
            </p>

            {showDetailedStatus && (
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span>Download Store</span>
                  <span
                    className={
                      rehydrationStatus.downloadStore
                        ? 'text-green-500'
                        : 'text-yellow-500'
                    }
                  >
                    {rehydrationStatus.downloadStore ? '✓' : '⏳'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Settings Store</span>
                  <span
                    className={
                      rehydrationStatus.mainStore
                        ? 'text-green-500'
                        : 'text-yellow-500'
                    }
                  >
                    {rehydrationStatus.mainStore ? '✓' : '⏳'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Telemetry Store</span>
                  <span
                    className={
                      rehydrationStatus.telemetryStore
                        ? 'text-green-500'
                        : 'text-yellow-500'
                    }
                  >
                    {rehydrationStatus.telemetryStore ? '✓' : '⏳'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Stores are ready, render the app
  return <>{children}</>;
};

export default StoreRehydrationLoader;
