import type { AfdaWorkerOutbound } from './protocol';

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
