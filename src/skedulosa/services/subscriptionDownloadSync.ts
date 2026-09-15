/**
 * Subscription Download Synchronization Service
 *
 * Handles the coordination between download store and skedulosa store
 * to ensure subscription downloads are properly tracked with correct IDs
 * and real-time status updates.
 *
 * Performance: Uses a downloadId -> subscriptionId map for O(1) lookup
 * and throttles progress/speed sync to avoid store thrashing on every engine tick.
 */

import type { QueuedDownload } from '@/downlodr/store/download/types';
import { useSkedulosaStore } from '@/skedulosa/store/skedulosaStore';
import { createSubscriptionDownloadInput } from '@/skedulosa/utils/scheduleManagerUtils';

/** Throttle interval for progress/speed sync (ms). Completion is never throttled. */
const SYNC_THROTTLE_MS = 1000;

export interface SubscriptionDownloadData {
  subscriptionId: string;
  queueId: string;
  actualDownloadId?: string;
  name: string;
  displayName?: string;
  thumbnails?: string;
  size?: string | number;
  speed?: string;
}

/**
 * Subscription Download Sync Service
 * Manages the lifecycle of subscription downloads and keeps both stores in sync
 */
export class SubscriptionDownloadSyncService {
  private static instance: SubscriptionDownloadSyncService;

  private pendingSubscriptionDownloads = new Map<
    string,
    SubscriptionDownloadData
  >();

  /** O(1) lookup: which subscription owns this download (by actual download ID). */
  private downloadIdToSubscriptionId = new Map<string, string>();

  /** Last time we synced status for a given download (for throttling). */
  private lastSyncByDownloadId = new Map<string, number>();

  static getInstance(): SubscriptionDownloadSyncService {
    if (!SubscriptionDownloadSyncService.instance) {
      SubscriptionDownloadSyncService.instance =
        new SubscriptionDownloadSyncService();
    }
    return SubscriptionDownloadSyncService.instance;
  }

  /**
   * Register a queued download that was initiated by a subscription
   * This is called when the download is added to the queue
   */
  registerQueuedSubscriptionDownload(
    queueId: string,
    subscriptionId: string,
    downloadData: {
      name: string;
      displayName?: string;
      thumbnails?: string;
      size?: string | number;
      speed?: string;
    },
  ): void {
    // Log subscription download registration for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[SubscriptionSync] Registering queued download: ${queueId} for subscription: ${subscriptionId}`,
      );
    }

    this.pendingSubscriptionDownloads.set(queueId, {
      subscriptionId,
      queueId,
      ...downloadData,
    });
  }

  /**
   * Called when a download actually starts (moves from queue to downloading)
   * This is where we record the download in the skedulosa store with the actual download ID
   */
  onDownloadStarted(
    actualDownloadId: string,
    queuedDownload: QueuedDownload,
  ): void {
    if (!queuedDownload.subscriptionId) {
      return; // Not a subscription download
    }

    const pendingData = this.pendingSubscriptionDownloads.get(
      queuedDownload.id,
    );
    if (!pendingData) {
      console.warn(
        `[SubscriptionSync] No pending data found for queue ID: ${queuedDownload.id}`,
      );
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[SubscriptionSync] Download started: ${actualDownloadId} (was queue: ${queuedDownload.id})`,
      );
    }

    // Update our tracking with the actual download ID
    pendingData.actualDownloadId = actualDownloadId;

    // Now record this download in the skedulosa store with the correct ID
    const input = createSubscriptionDownloadInput({
      id: actualDownloadId, // Use the ACTUAL download ID, not the queue ID
      name: queuedDownload.name,
      displayName: queuedDownload.displayName,
      size: queuedDownload.size,
      speed: queuedDownload.speed,
      thumbnails: queuedDownload.thumbnails,
      status: 'downloading', // It's now actually downloading
    });

    useSkedulosaStore
      .getState()
      .addDownloadToSubscription(queuedDownload.subscriptionId, input);

    // O(1) lookup for future syncs (avoids scanning all subscriptions)
    this.downloadIdToSubscriptionId.set(
      actualDownloadId,
      queuedDownload.subscriptionId,
    );

    // Clean up the queue ID reference since we now have the actual ID
    this.pendingSubscriptionDownloads.delete(queuedDownload.id);

    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[SubscriptionSync] Recorded download ${actualDownloadId} in subscription ${queuedDownload.subscriptionId}`,
      );
    }
  }

  /**
   * Update subscription download status based on download store changes.
   * Uses O(1) lookup and throttles progress/speed updates to avoid store thrashing.
   */
  syncDownloadStatus(
    downloadId: string,
    updates: {
      status?: string;
      progress?: number;
      speed?: string;
      size?: string;
      thumbnail_location?: string;
      video_location?: string;
    },
  ): void {
    const subscriptionId = this.downloadIdToSubscriptionId.get(downloadId);
    if (!subscriptionId) return; // Not a subscription download, nothing to sync

    const isTerminalStatus =
      updates.status === 'completed' ||
      updates.status === 'failed' ||
      updates.status === 'finished';
    if (!isTerminalStatus) {
      const now = Date.now();
      const last = this.lastSyncByDownloadId.get(downloadId) ?? 0;
      if (now - last < SYNC_THROTTLE_MS) return; // Throttle progress/speed updates
      this.lastSyncByDownloadId.set(downloadId, now);
    }

    const sub = useSkedulosaStore.getState().getSubscription(subscriptionId);
    if (!sub) return;
    const download = sub.downloads.find((d) => d.id === downloadId);
    if (!download) return;

    const patch: Partial<import('@/skedulosa/store/skedulosaStore').Download> = {
      status: updates.status ?? download.status,
      speed: updates.speed ?? download.speed,
      size: updates.size ?? download.size,
    };
    if (updates.thumbnail_location) patch.thumbnail_location = updates.thumbnail_location;
    if (updates.video_location) patch.video_location = updates.video_location;

    useSkedulosaStore
      .getState()
      .updateSubscriptionDownload(subscriptionId, downloadId, patch);

    const newStatus = updates.status ?? download.status;
    if (
      newStatus === 'completed' ||
      newStatus === 'failed' ||
      newStatus === 'cancelled'
    ) {
      this.downloadIdToSubscriptionId.delete(downloadId);
      this.lastSyncByDownloadId.delete(downloadId);
    }
  }

  /**
   * Handle download completion (success or failure)
   */
  onDownloadCompleted(downloadId: string, status: 'finished' | 'failed'): void {
    this.syncDownloadStatus(downloadId, {
      status: status === 'finished' ? 'completed' : 'failed',
    });
    this.downloadIdToSubscriptionId.delete(downloadId);
    this.lastSyncByDownloadId.delete(downloadId);

    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[SubscriptionSync] Download ${downloadId} completed with status: ${status}`,
      );
    }
  }

  /**
   * Clean up any orphaned pending downloads and lookup maps
   */
  cleanup(): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[SubscriptionSync] Cleaning up ${this.pendingSubscriptionDownloads.size} pending downloads`,
      );
    }
    this.pendingSubscriptionDownloads.clear();
    this.downloadIdToSubscriptionId.clear();
    this.lastSyncByDownloadId.clear();
  }
}

// Export singleton instance
export const subscriptionDownloadSync =
  SubscriptionDownloadSyncService.getInstance();
