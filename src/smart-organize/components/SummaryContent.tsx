import React, { useEffect, useState } from 'react';
import { cleanTranscriptContent } from '@/Utils/Data/removeTimestamp';
import {
  useSummarizeVideo,
  createSummarizeRequest,
  validateTranscriptForSummary,
} from '@/smart-organize/hooks/useSummarizeVideo';

interface SummaryContentProps {
  transcriptLocation?: string;
  videoId?: string;
  videoTitle?: string;
  existingSummary?: string; // Pre-existing summary from the download store
}

const SummaryContent: React.FC<SummaryContentProps> = ({
  transcriptLocation,
  videoId,
  videoTitle,
  existingSummary,
}) => {
  const [expanded, setExpanded] = useState<boolean>(true);
  const { progress, message, result, error, isLoading, summarize } =
    useSummarizeVideo();
  console.log('existingSummary', existingSummary);
  // Show existing summary if available
  if (existingSummary && existingSummary.trim()) {
    const summaryText = existingSummary.trim();
    const shouldShowToggle = summaryText.length > 300;

    return (
      <div className="relative max-w-full px-2">
        <div
          className={`whitespace-pre-wrap break-words transition-all duration-200 ${
            expanded
              ? 'max-h-full overflow-y-auto' // scrollable when expanded
              : 'line-clamp-8 overflow-hidden' // limited height when collapsed
          }`}
        >
          {summaryText}
        </div>

        {shouldShowToggle && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-blue-600 hover:text-blue-800 mt-2 hover:underline text-xs font-medium transition-colors"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
    );
  }

  const loadAndSummarize = async () => {
    try {
      // Read transcript file
      const fileResult = await window.plugins.readFile(transcriptLocation);
      if (!fileResult.success || !fileResult.data) {
        console.error('Failed to load transcript:', fileResult.error);
        return;
      }

      // Clean and validate transcript
      const cleanedTranscript = cleanTranscriptContent(fileResult.data);
      const validation = validateTranscriptForSummary(cleanedTranscript);

      if (!validation.isValid) {
        console.error('Transcript validation failed:', validation.error);
        return;
      }

      // Create summarization request
      const request = createSummarizeRequest(
        videoId || `video_${Date.now()}`,
        videoTitle || 'Video Summary',
        cleanedTranscript,
        'gpt-4',
      );

      // Start summarization
      await summarize(request);
    } catch (err) {
      console.error('Error in loadAndSummarize:', err);
    }
  };

  useEffect(() => {
    // If we already have a summary, don't generate a new one
    if (existingSummary && existingSummary.trim()) {
      return;
    }

    if (!transcriptLocation) {
      return;
    }

    loadAndSummarize();
  }, [transcriptLocation, videoId, videoTitle, existingSummary]);

  // Loading state with progress
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-4 space-y-2 bg-[#F2F2F2] dark:bg-[#333333] rounded-md h-full">
        <div className="flex items-center space-x-2">
          <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-gray-600">
            {message || 'Generating summary...'}
          </span>
        </div>
        {progress > 0 && (
          <div className="w-full max-w-xs">
            <div className="bg-gray-200 rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <span className="text-xs text-gray-500 mt-1">{progress}%</span>
          </div>
        )}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="relative max-w-full px-2 h-full flex flex-col bg-[#F2F2F2] dark:bg-[#333333] rounded-md">
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-start space-x-2">
            <div className="text-red-500 mt-0.5">⚠️</div>
            <div>
              <p className="text-sm text-red-700 font-medium">
                Failed to generate summary
              </p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success state with newly generated summary
  if (result?.summary) {
    const summaryText = result.summary;
    const shouldShowToggle = summaryText.length > 300;

    return (
      <div className="relative max-w-full px-2 h-full flex flex-col bg-[#F2F2F2] dark:bg-[#333333] rounded-md">
        <div
          className={`whitespace-pre-wrap break-words transition-all duration-200 ${
            expanded
              ? 'max-h-full overflow-y-auto' // scrollable when expanded
              : 'line-clamp-8 overflow-hidden' // limited height when collapsed
          }`}
        >
          {existingSummary}
        </div>

        {shouldShowToggle && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-blue-600 hover:text-blue-800 mt-2 hover:underline text-xs font-medium transition-colors"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>
    );
  }

  // Default state (no transcript)
  return (
    <div className="relative max-w-full px-2 h-full flex flex-col bg-[#F2F2F2] dark:bg-[#333333] rounded-md">
      <div className="text-gray-500 text-sm italic py-4 text-center">
        No transcript available to summarize
      </div>
    </div>
  );
};

export default SummaryContent;
