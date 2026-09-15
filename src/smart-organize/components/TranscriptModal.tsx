import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/core-app/components/shadcn/components/ui/dialog';
import {
  parseTranscriptContent,
  TranscriptSegment,
  formatTimestamp,
} from '@/Utils/Data/removeTimestamp';

interface TranscriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transcriptLocation?: string;
  videoTitle?: string;
}

const TranscriptModal: React.FC<TranscriptModalProps> = ({
  isOpen,
  onClose,
  transcriptLocation,
  videoTitle,
}) => {
  const [transcriptSegments, setTranscriptSegments] = useState<
    TranscriptSegment[]
  >([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !transcriptLocation) {
      setTranscriptSegments([]);
      setError('');
      return;
    }

    const loadTranscript = async () => {
      setLoading(true);
      setError('');
      try {
        const result = await window.plugins.readFile(transcriptLocation);
        if (result.success && result.data) {
          const segments = parseTranscriptContent(result.data);
          setTranscriptSegments(segments);
        } else {
          setError(result.error || 'No content available');
          setTranscriptSegments([]);
        }
      } catch {
        setError('Failed to load transcript');
        setTranscriptSegments([]);
      } finally {
        setLoading(false);
      }
    };

    loadTranscript();
  }, [isOpen, transcriptLocation]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] w-full">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold mx-2 mt-2">
            {videoTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 border-b-2 border-primary animate-spin rounded-full"></div>
              <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                Loading transcript...
              </span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {error}
              </span>
            </div>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto p-4 ">
              {transcriptSegments.length > 0 ? (
                <div className="space-y-6">
                  {transcriptSegments.map((segment, index) => (
                    <div key={index} className="flex gap-4 items-start">
                      <div className="rounded font-bold text-[13px] bg-[#F2F2F2] dark:bg-[#333333] min-w-[60px] flex-shrink-0 py-1 px-2 items-center justify-center">
                        {formatTimestamp(segment.timestamp)}
                      </div>
                      <div className="text-sm leading-relaxed text-gray-800 dark:text-gray-200 break-words flex-1">
                        {segment.text}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  No transcript segments available
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TranscriptModal;
