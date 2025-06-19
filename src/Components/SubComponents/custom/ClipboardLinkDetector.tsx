import { useCallback, useEffect, useRef, useState } from 'react';
import { extractUrlFromText } from '../../../DataFunctions/urlValidation';
import useDownloadStore from '../../../Store/downloadStore';
import { useMainStore } from '../../../Store/mainStore';
import { useToast } from '../shadcn/hooks/use-toast';

/**
 * ClipboardLinkDetector component
 *
 * This component monitors clipboard changes and shows toast notifications
 * when valid URLs are copied to the clipboard using Electron's clipboard API.
 * Optimized for performance and safety.
 */
const ClipboardLinkDetector: React.FC = () => {
  const { toast } = useToast();
  const lastCopiedUrl = useRef<string>('');
  const lastNotificationTime = useRef<number>(0);
  const isProcessing = useRef<boolean>(false);
  const { setDownload } = useDownloadStore();
  const { settings } = useMainStore();
  const [downloadFolder, setDownloadFolder] = useState<string>(
    settings.defaultLocation,
  );
  const maxDownload =
    settings.defaultDownloadSpeed === 0
      ? ''
      : `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`;

  // Debug: Log settings on component mount
  useEffect(() => {
    console.log('ClipboardLinkDetector mounted, settings:', {
      enableClipboardMonitoring: settings.enableClipboardMonitoring,
      allSettings: settings,
    });
  }, [settings]);

  // Rate limiting: Only show notifications every 2 seconds
  const RATE_LIMIT_MS = 2000;

  // Maximum clipboard text length to process (prevent processing huge content)
  const MAX_CLIPBOARD_LENGTH = 10000;

  // Debounced clipboard check to prevent excessive processing
  const debouncedCheck = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout | null = null;
      return (checkFunction: () => void, delay = 100) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(checkFunction, delay);
      };
    })(),
    [],
  );

  // Handle clipboard changes from Electron main process
  const handleClipboardChange = useCallback(
    (clipboardText: string) => {
      // Check if clipboard monitoring is enabled
      if (!settings.enableClipboardMonitoring) {
        console.log('Clipboard monitoring disabled, ignoring change');
        return;
      }

      // Prevent processing if already handling a change
      if (isProcessing.current) {
        return;
      }

      // Validate clipboard content
      if (!clipboardText || clipboardText.length > MAX_CLIPBOARD_LENGTH) {
        return;
      }

      // Rate limiting check
      const now = Date.now();
      if (now - lastNotificationTime.current < RATE_LIMIT_MS) {
        return;
      }

      isProcessing.current = true;

      try {
        // Extract URL from clipboard text
        const url = extractUrlFromText(clipboardText);

        if (url && url !== lastCopiedUrl.current) {
          // Update last copied URL to prevent duplicate notifications
          lastCopiedUrl.current = url;
          lastNotificationTime.current = now;

          console.log('Link detected in clipboard:', url);

          setDownload(url, downloadFolder, maxDownload, {
            getTranscript: false,
            getThumbnail: false,
          });
          // Show toast notification
          toast({
            title: 'Link Detected',
            description: (
              <div className="max-w-xs">
                <div className="truncate text-sm">{url}</div>
                <div className="text-xs text-gray-500 mt-1">
                  You can paste this link in the download modal
                </div>
              </div>
            ),
            duration: 4000,
            variant: 'default',
          });
        }
      } catch (error) {
        console.debug('Error processing clipboard content:', error);
      } finally {
        isProcessing.current = false;
      }
    },
    [
      toast,
      settings.enableClipboardMonitoring,
      setDownload,
      downloadFolder,
      maxDownload,
    ],
  );

  // Fallback clipboard check using browser API (with debouncing)
  const checkClipboard = useCallback(async () => {
    // Check if clipboard monitoring is enabled
    if (!settings.enableClipboardMonitoring) {
      return;
    }

    if (isProcessing.current) {
      return;
    }

    try {
      // Check if clipboard API is available
      if (!navigator.clipboard || !navigator.clipboard.readText) {
        return;
      }

      const clipboardText = await navigator.clipboard.readText();

      if (!clipboardText || clipboardText.length > MAX_CLIPBOARD_LENGTH) {
        return;
      }

      // Rate limiting check
      const now = Date.now();
      if (now - lastNotificationTime.current < RATE_LIMIT_MS) {
        return;
      }

      isProcessing.current = true;

      // Extract URL from clipboard text
      const url = extractUrlFromText(clipboardText);

      if (url && url !== lastCopiedUrl.current) {
        // Update last copied URL to prevent duplicate notifications
        lastCopiedUrl.current = url;
        lastNotificationTime.current = now;

        console.log('Link detected in clipboard (fallback):', url);

        // Show toast notification
        toast({
          title: 'Link Detected',
          description: (
            <div className="max-w-xs">
              <div className="truncate text-sm">{url}</div>
              <div className="text-xs text-gray-500 mt-1">
                You can paste this link in the download modal
              </div>
            </div>
          ),
          duration: 4000,
          variant: 'default',
        });
      }
    } catch (error) {
      // Handle clipboard permission errors silently
      console.debug('Clipboard check error:', error);
    } finally {
      isProcessing.current = false;
    }
  }, [toast, settings.enableClipboardMonitoring]);

  // Handle copy events (immediate detection with debouncing)
  const handleCopy = useCallback(() => {
    debouncedCheck(checkClipboard, 100);
  }, [checkClipboard, debouncedCheck]);

  // Handle keyboard shortcuts (Ctrl+C, Cmd+C) with debouncing
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
        debouncedCheck(checkClipboard, 100);
      }
    },
    [checkClipboard, debouncedCheck],
  );

  // Initialize clipboard monitoring on component mount if enabled
  useEffect(() => {
    if (settings.enableClipboardMonitoring) {
      console.log('Initializing clipboard monitoring on mount...');

      // Start main process clipboard monitoring
      if (window.appControl && window.appControl.startClipboardMonitoring) {
        window.appControl.startClipboardMonitoring().then(() => {
          console.log('Main process clipboard monitoring started on mount');
        });
      }

      // Set up Electron clipboard monitoring
      if (window.appControl && window.appControl.onClipboardChange) {
        console.log('Setting up Electron clipboard monitoring on mount');
        window.appControl.onClipboardChange(handleClipboardChange);
      }

      // Add event listeners for immediate detection (fallback)
      document.addEventListener('copy', handleCopy);
      document.addEventListener('keydown', handleKeyDown);
    }
  }, []); // Only run on mount

  // Separate effect for setting up/tearing down monitoring based on settings
  useEffect(() => {
    console.log(
      'Clipboard monitoring setting changed:',
      settings.enableClipboardMonitoring,
    );

    if (settings.enableClipboardMonitoring) {
      console.log('Setting up clipboard monitoring...');

      // Start main process clipboard monitoring
      if (window.appControl && window.appControl.startClipboardMonitoring) {
        window.appControl.startClipboardMonitoring().then(() => {
          console.log('Main process clipboard monitoring started');
        });
      }

      // Set up Electron clipboard monitoring
      if (window.appControl && window.appControl.onClipboardChange) {
        console.log('Setting up Electron clipboard monitoring');
        window.appControl.onClipboardChange(handleClipboardChange);
      } else {
        console.log('Electron clipboard monitoring not available');
      }

      // Add event listeners for immediate detection (fallback)
      document.addEventListener('copy', handleCopy);
      document.addEventListener('keydown', handleKeyDown);

      console.log('Clipboard monitoring setup complete');
    } else {
      console.log('Tearing down clipboard monitoring...');

      // Stop main process clipboard monitoring
      if (window.appControl && window.appControl.stopClipboardMonitoring) {
        window.appControl.stopClipboardMonitoring().then(() => {
          console.log('Main process clipboard monitoring stopped');
        });
      }

      // Clean up Electron clipboard monitoring
      if (window.appControl && window.appControl.offClipboardChange) {
        window.appControl.offClipboardChange();
      }

      // Remove event listeners
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('keydown', handleKeyDown);

      console.log('Clipboard monitoring teardown complete');
    }

    // Cleanup function for component unmount
    return () => {
      console.log('Component unmounting, cleaning up clipboard monitoring...');
      if (window.appControl && window.appControl.offClipboardChange) {
        window.appControl.offClipboardChange();
      }
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    settings.enableClipboardMonitoring,
    handleClipboardChange,
    handleCopy,
    handleKeyDown,
  ]);

  // This component doesn't render anything
  return null;
};

export default ClipboardLinkDetector;
