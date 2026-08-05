import type { AfdaWorkerOutbound } from './protocol';

/**
 * Stand-in for the real BrowserWindow, used only inside the AFDA worker.
 * AFDA's services (mapperService, paginationService, temporalService,
 * scrapeEngine, memoryMonitor, notificationService) are all `any`-typed at
 * their call sites in the current afdaHandler.ts, so nothing here needs to
 * be a *real* BrowserWindow — only shaped enough that whatever methods they
 * call on it behave sensibly.
 *
 * Getter methods (isDestroyed/isMinimized/webContents.isLoading) return
 * locally cached booleans — mirrored from main via 'window-state' messages —
 * because a true cross-process synchronous call is not possible. Action
 * methods (show/focus/restore/webContents.send) are fire-and-forget: they
 * post a 'window-call' message to main and do not wait for a reply, which
 * matches the void return type these methods have on a real BrowserWindow.
 */
export class FakeWindow {
  private isDestroyedState: boolean;
  private isMinimizedState: boolean;
  private isLoadingState: boolean;
  private isVisibleState: boolean;
  private loadListeners: Array<() => void> = [];

  constructor(
    initial: { isDestroyed: boolean; isMinimized: boolean; isLoading: boolean; isVisible: boolean },
    private readonly postToMain: (msg: AfdaWorkerOutbound) => void,
  ) {
    this.isDestroyedState = initial.isDestroyed;
    this.isMinimizedState = initial.isMinimized;
    this.isLoadingState = initial.isLoading;
    this.isVisibleState = initial.isVisible;

    this.webContents = {
      send: (channel: string, payload: unknown) => {
        this.postToMain({ type: 'push', channel, payload });
      },
      isLoading: () => this.isLoadingState,
      on: (event: string, cb: () => void) => {
        if (event === 'did-finish-load') this.loadListeners.push(cb);
      },
    };
  }

  webContents: {
    send: (channel: string, payload: unknown) => void;
    isLoading: () => boolean;
    on: (event: string, cb: () => void) => void;
  };

  isDestroyed(): boolean {
    return this.isDestroyedState;
  }

  isMinimized(): boolean {
    return this.isMinimizedState;
  }

  // Added after live runtime testing (Task 4) surfaced
  // "TypeError: this.win?.isVisible is not a function" from afda-backend's
  // SchedulerService, which gates some job runs on window visibility —
  // a real BrowserWindow has this method; the original FakeWindow didn't.
  isVisible(): boolean {
    return this.isVisibleState;
  }

  show(): void {
    this.postToMain({ type: 'window-call', callId: '', method: 'show', args: [] });
  }

  focus(): void {
    this.postToMain({ type: 'window-call', callId: '', method: 'focus', args: [] });
  }

  restore(): void {
    this.postToMain({ type: 'window-call', callId: '', method: 'restore', args: [] });
  }

  /** Called by entry.ts when a 'window-state' message arrives from main. */
  updateState(state: { isDestroyed: boolean; isMinimized: boolean; isLoading: boolean; isVisible: boolean }): void {
    const wasLoading = this.isLoadingState;
    this.isDestroyedState = state.isDestroyed;
    this.isMinimizedState = state.isMinimized;
    this.isLoadingState = state.isLoading;
    this.isVisibleState = state.isVisible;
    if (wasLoading && !state.isLoading) {
      for (const cb of this.loadListeners) cb();
    }
  }
}
