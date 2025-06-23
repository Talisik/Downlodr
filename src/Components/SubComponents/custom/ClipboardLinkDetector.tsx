import { useCallback, useEffect, useRef, useState } from 'react';
import { extractUrlFromText } from '../../../DataFunctions/urlValidation';
import useDownloadStore from '../../../Store/downloadStore';
import { useMainStore } from '../../../Store/mainStore';
import { useToast } from '../shadcn/hooks/use-toast';

/**
 * ClipboardLinkDetector component
 *
 * This component detects when users copy URLs to the clipboard and shows
 * toast notifications. It focuses on detecting the copy ACTION rather than
 * comparing clipboard content to avoid false positives.
 */
const ClipboardLinkDetector: React.FC = () => {
  const { toast } = useToast();
  const { setDownload } = useDownloadStore();
  const { settings } = useMainStore();
  const [downloadFolder, setDownloadFolder] = useState<string>(
    settings.defaultLocation,
  );
  const maxDownload =
    settings.defaultDownloadSpeed === 0
      ? ''
      : `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`;

  // Track if we're currently processing a copy action
  const isProcessing = useRef<boolean>(false);

  // Rate limiting: Only process copy actions every 1 second
  const RATE_LIMIT_MS = 1000;
  const lastProcessedTime = useRef<number>(0);

  // Maximum clipboard text length to process
  const MAX_CLIPBOARD_LENGTH = 10000;

  // Debug: Log settings on component mount
  useEffect(() => {
    console.log('ClipboardLinkDetector mounted, settings:', {
      enableClipboardMonitoring: settings.enableClipboardMonitoring,
      allSettings: settings,
    });
  }, [settings]);

  // Process clipboard content when a copy action is detected
  const processClipboardContent = useCallback(async () => {
    // Check if clipboard monitoring is enabled
    if (!settings.enableClipboardMonitoring) {
      return;
    }

    // Prevent concurrent processing
    if (isProcessing.current) {
      return;
    }

    // Rate limiting check
    const now = Date.now();
    if (now - lastProcessedTime.current < RATE_LIMIT_MS) {
      return;
    }

    isProcessing.current = true;
    lastProcessedTime.current = now;

    try {
      let clipboardText = '';

      // Try to get clipboard content from Electron first (more reliable)
      if (window.appControl && window.appControl.getClipboardText) {
        try {
          clipboardText = await window.appControl.getClipboardText();
        } catch (error) {
          console.debug('Electron clipboard access failed, trying browser API');
        }
      }

      // Fallback to browser clipboard API
      if (
        !clipboardText &&
        navigator.clipboard &&
        navigator.clipboard.readText
      ) {
        try {
          clipboardText = await navigator.clipboard.readText();
        } catch (error) {
          console.debug('Browser clipboard access failed:', error);
        }
      }

      // Validate clipboard content
      if (!clipboardText || clipboardText.length > MAX_CLIPBOARD_LENGTH) {
        return;
      }

      // Extract URL from clipboard text
      const url = extractUrlFromText(clipboardText);

      if (url) {
        console.log('Link detected from copy action:', url);

        // Trigger download
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
  }, [
    settings.enableClipboardMonitoring,
    setDownload,
    downloadFolder,
    maxDownload,
    toast,
  ]);

  // Handle copy events (immediate detection)
  const handleCopy = useCallback(() => {
    // Small delay to ensure clipboard content is updated
    setTimeout(processClipboardContent, 50);
  }, [processClipboardContent]);

  // Handle keyboard shortcuts (Ctrl+C, Cmd+C)
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
        // Small delay to ensure clipboard content is updated
        setTimeout(processClipboardContent, 50);
      }
    },
    [processClipboardContent],
  );

  // Handle clipboard changes from Electron main process (if available)
  const handleClipboardChange = useCallback(
    (clipboardText: string) => {
      // Check if clipboard monitoring is enabled
      if (!settings.enableClipboardMonitoring) {
        return;
      }

      // Prevent concurrent processing
      if (isProcessing.current) {
        return;
      }

      // Rate limiting check
      const now = Date.now();
      if (now - lastProcessedTime.current < RATE_LIMIT_MS) {
        return;
      }

      // Validate clipboard content
      if (!clipboardText || clipboardText.length > MAX_CLIPBOARD_LENGTH) {
        return;
      }

      isProcessing.current = true;
      lastProcessedTime.current = now;

      try {
        // Extract URL from clipboard text
        const url = extractUrlFromText(clipboardText);

        if (url) {
          console.log('Link detected from Electron clipboard change:', url);

          // Trigger download
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
      settings.enableClipboardMonitoring,
      setDownload,
      downloadFolder,
      maxDownload,
      toast,
    ],
  );

  // Set up clipboard monitoring based on settings
  useEffect(() => {
    console.log(
      'Clipboard monitoring setting changed:',
      settings.enableClipboardMonitoring,
    );

    if (settings.enableClipboardMonitoring) {
      console.log('Setting up clipboard monitoring...');

      // Start main process clipboard monitoring (if available)
      if (window.appControl && window.appControl.startClipboardMonitoring) {
        window.appControl.startClipboardMonitoring().then(() => {
          console.log('Main process clipboard monitoring started');
        });
      }

      // Set up Electron clipboard monitoring (if available)
      if (window.appControl && window.appControl.onClipboardChange) {
        console.log('Setting up Electron clipboard monitoring');
        window.appControl.onClipboardChange(handleClipboardChange);
      }

      // Add event listeners for copy actions
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

      // Reset processing state
      isProcessing.current = false;
      lastProcessedTime.current = 0;

      // Set last clipboard text to BLANK_STATE to prevent issues when re-enabling
      if (window.appControl && window.appControl.clearLastClipboardText) {
        window.appControl.clearLastClipboardText().then(() => {
          console.log('Last clipboard text set to BLANK_STATE');
        });
      }

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

      // Clear the last clipboard text when component unmounts
      if (window.appControl && window.appControl.clearLastClipboardText) {
        window.appControl.clearLastClipboardText().then(() => {
          console.log(
            'Last clipboard text set to BLANK_STATE on component unmount',
          );
        });
      }
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
