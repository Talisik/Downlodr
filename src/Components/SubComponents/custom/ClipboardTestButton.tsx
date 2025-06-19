import { useState } from 'react';
import { extractUrlFromText } from '../../../DataFunctions/urlValidation';
import { useToast } from '../shadcn/hooks/use-toast';

/**
 * Test component for clipboard functionality
 * This component provides a way to test URL detection manually
 */
const ClipboardTestButton: React.FC = () => {
  const { toast } = useToast();
  const [testUrl, setTestUrl] = useState(
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  );

  const testUrlDetection = () => {
    const url = extractUrlFromText(testUrl);

    if (url) {
      toast({
        title: 'Test: Link Detected',
        description: (
          <div className="max-w-xs">
            <div className="truncate text-sm">{url}</div>
            <div className="text-xs text-gray-500 mt-1">
              URL detection is working correctly
            </div>
          </div>
        ),
        duration: 4000,
        variant: 'default',
      });
    } else {
      toast({
        title: 'Test: No Link Detected',
        description: 'The test URL was not recognized as valid',
        duration: 4000,
        variant: 'destructive',
      });
    }
  };

  const testClipboardAccess = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();

      if (clipboardText) {
        const url = extractUrlFromText(clipboardText);

        if (url) {
          toast({
            title: 'Clipboard Test: Link Found',
            description: (
              <div className="max-w-xs">
                <div className="truncate text-sm">{url}</div>
                <div className="text-xs text-gray-500 mt-1">
                  Clipboard access is working
                </div>
              </div>
            ),
            duration: 4000,
            variant: 'success',
          });
        } else {
          toast({
            title: 'Clipboard Test: No Link',
            description: `Clipboard contains: "${clipboardText.substring(
              0,
              50,
            )}..."`,
            duration: 4000,
            variant: 'default',
          });
        }
      } else {
        toast({
          title: 'Clipboard Test: Empty',
          description: 'Clipboard is empty',
          duration: 4000,
          variant: 'default',
        });
      }
    } catch (error) {
      toast({
        title: 'Clipboard Test: Error',
        description: `Error: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        duration: 4000,
        variant: 'destructive',
      });
    }
  };

  // Only show in development mode
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border dark:border-gray-700 z-50">
      <h3 className="text-sm font-medium mb-2 dark:text-white">
        Clipboard Test
      </h3>
      <div className="space-y-2">
        <input
          type="text"
          value={testUrl}
          onChange={(e) => setTestUrl(e.target.value)}
          className="w-full text-xs p-1 border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600"
          placeholder="Enter test URL"
        />
        <button
          onClick={testUrlDetection}
          className="w-full text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
        >
          Test URL Detection
        </button>
        <button
          onClick={testClipboardAccess}
          className="w-full text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
        >
          Test Clipboard Access
        </button>
      </div>
    </div>
  );
};

export default ClipboardTestButton;
