// Balanced throttling utility - optimized for both performance and UX
export class BalancedDownloadThrottler {
  private static instance: BalancedDownloadThrottler;
  private pendingUpdates = new Map<string, any>();
  private throttleTimers = new Map<string, NodeJS.Timeout>();

  // Balanced intervals - responsive but not overwhelming
  // Can be adjusted based on system performance needs
  private PROGRESS_UPDATE_DELAY = 150; // 150ms = ~7 FPS (smooth but efficient)
  private LOG_UPDATE_DELAY = 500; // 500ms for logs (less critical)

  static getInstance(): BalancedDownloadThrottler {
    if (!BalancedDownloadThrottler.instance) {
      BalancedDownloadThrottler.instance = new BalancedDownloadThrottler();
    }
    return BalancedDownloadThrottler.instance;
  }

  // Allow runtime adjustment of throttling based on performance needs
  configure(options: { progressDelay?: number; logDelay?: number }) {
    if (options.progressDelay !== undefined) {
      this.PROGRESS_UPDATE_DELAY = Math.max(50, options.progressDelay); // Min 50ms
    }
    if (options.logDelay !== undefined) {
      this.LOG_UPDATE_DELAY = Math.max(100, options.logDelay); // Min 100ms
    }
  }

  throttleUpdate(
    downloadId: string,
    update: any,
    callback: (update: any) => void,
  ) {
    // Critical updates go through immediately
    if (this.isCriticalUpdate(update)) {
      this.forceUpdate(downloadId, update, callback);
      return;
    }

    // Store the latest update
    this.pendingUpdates.set(downloadId, update);

    // Clear existing timer
    const existingTimer = this.throttleTimers.get(downloadId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set appropriate delay based on update type
    const delay = this.isLogOnlyUpdate(update)
      ? this.LOG_UPDATE_DELAY
      : this.PROGRESS_UPDATE_DELAY;

    // Schedule update
    const timer = setTimeout(() => {
      const latestUpdate = this.pendingUpdates.get(downloadId);
      if (latestUpdate) {
        callback(latestUpdate);
        this.pendingUpdates.delete(downloadId);
        this.throttleTimers.delete(downloadId);
      }
    }, delay);

    this.throttleTimers.set(downloadId, timer);
  }

  private isCriticalUpdate(update: any): boolean {
    return (
      update.type === 'controller' ||
      update.data?.value?.status === 'finished' ||
      update.data?.value?.status === 'failed' ||
      update.data?.value?.status === 'cancelled' ||
      update.data?.value?.status === 'error'
    );
  }

  private isLogOnlyUpdate(update: any): boolean {
    // True if it's only a log update without progress data
    return update.data?.log && !update.data?.value;
  }

  forceUpdate(
    downloadId: string,
    update: any,
    callback: (update: any) => void,
  ) {
    // Clear any pending update
    const existingTimer = this.throttleTimers.get(downloadId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.throttleTimers.delete(downloadId);
    }

    this.pendingUpdates.delete(downloadId);
    callback(update);
  }

  cleanup(downloadId: string) {
    const timer = this.throttleTimers.get(downloadId);
    if (timer) {
      clearTimeout(timer);
      this.throttleTimers.delete(downloadId);
    }
    this.pendingUpdates.delete(downloadId);
  }

  cleanupAll() {
    this.throttleTimers.forEach((timer) => clearTimeout(timer));
    this.throttleTimers.clear();
    this.pendingUpdates.clear();
  }
}
