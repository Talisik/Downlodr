import React, { useEffect, useState } from 'react';
import {
  parseTranscriptContent,
  TranscriptSegment,
  formatTimestamp,
} from '@/Utils/Data/removeTimestamp';

interface TranscriptContentProps {
  transcriptLocation?: string;
}

const TranscriptContent: React.FC<TranscriptContentProps> = ({
  transcriptLocation,
}) => {
  const [transcriptSegments, setTranscriptSegments] = useState<
    TranscriptSegment[]
  >([]);
  const [expanded] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!transcriptLocation) {
      setError('No transcript available');
      setTranscriptSegments([]);
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
  }, [transcriptLocation]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4 h-full">
        <div className="h-6 w-6 border-b-2"></div>
        <span className="ml-2 text-xs text-gray-500">
          Loading transcript...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-4 h-full">
        <span className="text-xs text-gray-500">{error}</span>
      </div>
    );
  }

  return (
    <div className="relative max-w-full px-2 h-full flex flex-col bg-[#F2F2F2] dark:bg-[#333333] rounded-md">
      <div
        className={`transition-all duration-200 flex-1 overflow-x-hidden ${
          expanded
            ? 'overflow-y-auto' // scrollable when expanded, respecting parent height
            : 'line-clamp-8 overflow-hidden' // limited height when collapsed
        }`}
      >
        {transcriptSegments.length > 0 ? (
          <div className="space-y-2 py-2">
            {transcriptSegments.map((segment, index) => (
              <div key={index} className="flex items-start text-[12px]">
                <div className="min-w-[50px] flex-shrink-0 pt-0.5">
                  {formatTimestamp(segment.timestamp)}
                </div>
                <div className="text-gray-800 dark:text-gray-200 break-words flex-1">
                  {segment.text}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-gray-500">
            No transcript segments available
          </div>
        )}
      </div>
    </div>
  );
};

export default TranscriptContent;
