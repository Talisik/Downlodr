/**
 * Event Manager Utility
 * Prevents memory leaks by managing event listeners centrally
 */

interface EventListenerRegistry {
  [eventName: string]: {
    listeners: Array<{ id: string; callback: (...args: any[]) => void }>;
    cleanup?: () => void;
  };
}

class EventManager {
  private registry: EventListenerRegistry = {};
  private listenerCounter = 0;

  /**
   * Register an event listener with automatic cleanup tracking
   */
  registerListener(
    eventName: string,
    callback: (...args: any[]) => void,
    context?: string,
  ): string {
    const listenerId = `${context || 'default'}_${this.listenerCounter++}`;

    if (!this.registry[eventName]) {
      this.registry[eventName] = {
        listeners: [],
      };
    }

    // Add the listener to our registry
    this.registry[eventName].listeners.push({
      id: listenerId,
      callback,
    });

    // Set up the actual IPC listener if this is the first listener for this event
    if (this.registry[eventName].listeners.length === 1) {
      this.setupEventListener(eventName);
    }

    console.log(
      `📝 Registered listener ${listenerId} for ${eventName}. Total: ${this.registry[eventName].listeners.length}`,
    );

    // Return cleanup function
    return listenerId;
  }

  /**
   * Remove a specific listener
   */
  removeListener(eventName: string, listenerId: string): void {
    if (!this.registry[eventName]) return;

    const initialCount = this.registry[eventName].listeners.length;
    this.registry[eventName].listeners = this.registry[
      eventName
    ].listeners.filter((listener) => listener.id !== listenerId);

    const finalCount = this.registry[eventName].listeners.length;

    if (finalCount === 0) {
      // Remove the IPC listener if no more listeners exist
      this.cleanupEventListener(eventName);
    }

    console.log(
      `🗑️ Removed listener ${listenerId} for ${eventName}. Remaining: ${finalCount}`,
    );
  }

  /**
   * Get listener count for debugging
   */
  getListenerCount(eventName: string): number {
    return this.registry[eventName]?.listeners.length || 0;
  }

  /**
   * Set up the actual IPC event listener
   */
  private setupEventListener(eventName: string): void {
    if (
      eventName === 'update-available' &&
      window.updateAPI?.onUpdateAvailable
    ) {
      const cleanup = window.updateAPI.onUpdateAvailable((updateInfo) => {
        // Notify all registered listeners
        this.registry[eventName]?.listeners.forEach(({ callback }) => {
          try {
            callback(updateInfo);
          } catch (error) {
            console.error(`Error in listener for ${eventName}:`, error);
          }
        });
      });

      this.registry[eventName].cleanup = cleanup;
      console.log(`🔧 Set up IPC listener for ${eventName}`);
    }
  }

  /**
   * Clean up the IPC event listener
   */
  private cleanupEventListener(eventName: string): void {
    const registry = this.registry[eventName];
    if (registry?.cleanup) {
      registry.cleanup();
      delete registry.cleanup;
      console.log(`🧹 Cleaned up IPC listener for ${eventName}`);
    }
  }

  /**
   * Clean up all listeners (for app shutdown)
   */
  cleanup(): void {
    Object.keys(this.registry).forEach((eventName) => {
      this.cleanupEventListener(eventName);
    });
    this.registry = {};
    console.log('🧹 Event manager cleaned up all listeners');
  }
}

// Export singleton instance
export const eventManager = new EventManager();

// Helper function for easier usage
export function useUpdateListener(
  callback: (updateInfo: any) => void,
  context = 'component',
): () => void {
  const listenerId = eventManager.registerListener(
    'update-available',
    callback,
    context,
  );

  // Return cleanup function
  return () => {
    eventManager.removeListener('update-available', listenerId);
  };
}
