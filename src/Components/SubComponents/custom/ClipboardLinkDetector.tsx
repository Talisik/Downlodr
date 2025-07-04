import { useCallback, useEffect, useRef, useState } from 'react';
import { extractUrlFromText } from '../../../DataFunctions/urlValidation';
import useDownloadStore from '../../../Store/downloadStore';
import { useMainStore } from '../../../Store/mainStore';
import { useToast } from '../shadcn/hooks/use-toast';

/**
 * ClipboardLinkDetector component
 *
 * Detects URLs copied to clipboard and triggers download notifications.
 * Uses hybrid approach: main process polling + copy event backup detection.
 */
const ClipboardLinkDetector: React.FC = () => {
  const { toast } = useToast();
  const { setDownload } = useDownloadStore();
  const { settings, isDownloadModalOpen } = useMainStore();
  const [downloadFolder, setDownloadFolder] = useState<string>(
    settings.defaultLocation,
  );
  const maxDownload =
    settings.defaultDownloadSpeed === 0
      ? ''
      : `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`;

  // Processing state management
  const isProcessing = useRef<boolean>(false);
  const lastProcessedTime = useRef<number>(0);
  const RATE_LIMIT_MS = 1000;
  const MAX_CLIPBOARD_LENGTH = 10000;

  // Window focus state tracking
  const [isWindowFocused, setIsWindowFocused] = useState<boolean>(true);

  // Initial focus check only - no polling needed since we have events
  const initializeWindowFocus = useCallback(async () => {
    if (window.appControl?.isWindowFocused) {
      try {
        const focused = await window.appControl.isWindowFocused();
        setIsWindowFocused(focused);
        console.log('Initial window focus state:', focused);
      } catch (error) {
        console.debug('Error checking initial window focus:', error);
        setIsWindowFocused(true); // Default to focused to be safe
      }
    }
  }, []);

  // Unified clipboard processing function
  const processClipboard = useCallback(
    async (clipboardText: string, source: string) => {
      // Basic validation
      if (
        !settings.enableClipboardMonitoring ||
        !clipboardText ||
        clipboardText.length > MAX_CLIPBOARD_LENGTH ||
        isProcessing.current ||
        isDownloadModalOpen // Don't process when download modal is open
      ) {
        return;
      }

      // Check if window is focused (for backup methods only - main process already handles this)
      // Use cached state instead of IPC call for efficiency
      if (source !== 'polling' && isWindowFocused) {
        console.log(
          `Skipping clipboard processing from ${source} - window is focused`,
        );
        return;
      }

      // Rate limiting
      const now = Date.now();
      if (now - lastProcessedTime.current < RATE_LIMIT_MS) {
        return;
      }

      isProcessing.current = true;
      lastProcessedTime.current = now;

      try {
        const url = extractUrlFromText(clipboardText);
        if (url) {
          // Ignore URLs that start with https://go.downlodr.com/
          if (url.startsWith('https://go.downlodr.com/')) {
            console.log(`Ignoring internal downlodr link: ${url}`);
            return;
          }

          console.log(`Link detected from ${source}:`, url);

          // Trigger download
          setDownload(url, downloadFolder, maxDownload, {
            getTranscript: false,
            getThumbnail: false,
          });

          // Show toast notification
          toast({
            title: 'Copied Link Detected',
            description: (
              <div className="max-w-xs">
                <div className="truncate text-sm">{url}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Link will be added to the download queue
                </div>
              </div>
            ),
            duration: 4000,
            variant: 'default',
          });
        }
      } catch (error) {
        console.debug(`Error processing clipboard from ${source}:`, error);
      } finally {
        isProcessing.current = false;
      }
    },
    [
      settings.enableClipboardMonitoring,
      isDownloadModalOpen,
      setDownload,
      downloadFolder,
      maxDownload,
      toast,
      isWindowFocused, // Use cached state instead of function
    ],
  );

  // Handle clipboard changes from main process polling (primary method)
  const handleClipboardChange = useCallback(
    (clipboardText: string) => {
      processClipboard(clipboardText, 'polling');
    },
    [processClipboard],
  );

  // Handle copy events (backup method for immediate detection when app has focus)
  const handleCopyEvent = useCallback(async () => {
    if (!window.appControl?.getClipboardText) return;

    try {
      const clipboardText = await window.appControl.getClipboardText();
      // Small delay to ensure clipboard is updated
      setTimeout(() => processClipboard(clipboardText, 'copy event'), 50);
    } catch (error) {
      console.debug('Copy event clipboard access failed:', error);
    }
  }, [processClipboard]);

  // Handle keyboard shortcuts (backup method)
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
        handleCopyEvent();
      }
    },
    [handleCopyEvent],
  );

  // Utility function to clear clipboard with fallback
  const clearClipboardSafely = useCallback(async (context: string) => {
    if (!window.appControl?.clearClipboard) return;

    try {
      const success = await window.appControl.clearClipboard();
      if (success) {
        console.log(`Clipboard cleared (${context})`);
      } else {
        console.log(`Clipboard clear failed (${context}), using fallback`);
        await window.appControl.clearLastClipboardText?.();
      }
    } catch (error) {
      console.debug(`Error clearing clipboard (${context}):`, error);
    }
  }, []);

  // Main effect: Set up clipboard monitoring
  useEffect(() => {
    if (settings.enableClipboardMonitoring) {
      console.log('Setting up clipboard monitoring...');

      // Start main process polling
      window.appControl?.startClipboardMonitoring?.();

      // Set up event listeners
      window.appControl?.onClipboardChange?.(handleClipboardChange);
      document.addEventListener('copy', handleCopyEvent);
      document.addEventListener('keydown', handleKeyDown);

      // Add focus/blur event listeners to track window focus state
      const handleFocus = () => {
        setIsWindowFocused(true);
        console.log('Window focused - backup clipboard methods paused');
      };

      const handleBlur = () => {
        setIsWindowFocused(false);
        console.log('Window blurred - backup clipboard methods resumed');
      };

      window.addEventListener('focus', handleFocus);
      window.addEventListener('blur', handleBlur);

      // Initial focus check only (no polling needed with events)
      initializeWindowFocus();

      console.log(
        'Clipboard monitoring active (paused when window is focused)',
      );

      // Cleanup function
      return () => {
        window.appControl?.offClipboardChange?.();
        document.removeEventListener('copy', handleCopyEvent);
        document.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('focus', handleFocus);
        window.removeEventListener('blur', handleBlur);
        // Only clear on unmount if not in modal state
        if (!isDownloadModalOpen) {
          clearClipboardSafely('unmount');
        }
      };
    } else {
      console.log('Disabling clipboard monitoring...');

      // Stop polling and clean up
      window.appControl?.stopClipboardMonitoring?.();
      window.appControl?.offClipboardChange?.();
      document.removeEventListener('copy', handleCopyEvent);
      document.removeEventListener('keydown', handleKeyDown);

      // Reset state but DON'T clear clipboard when just pausing for modal
      isProcessing.current = false;
      lastProcessedTime.current = 0;

      // Only clear clipboard when completely disabling, not when modal is open
      if (!isDownloadModalOpen) {
        clearClipboardSafely('disable');
      }

      console.log('Clipboard monitoring disabled');
    }

    // Cleanup on unmount
    return () => {
      window.appControl?.offClipboardChange?.();
      document.removeEventListener('copy', handleCopyEvent);
      document.removeEventListener('keydown', handleKeyDown);
      // Only clear on unmount if not in modal state
      if (!isDownloadModalOpen) {
        clearClipboardSafely('unmount');
      }
    };
  }, [
    settings.enableClipboardMonitoring,
    isDownloadModalOpen,
    handleClipboardChange,
    handleCopyEvent,
    handleKeyDown,
    clearClipboardSafely,
  ]);

  return null;
};

export default ClipboardLinkDetector;
