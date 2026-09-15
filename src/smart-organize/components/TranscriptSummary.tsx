import React, { useEffect, useState } from 'react';
import { cleanTranscriptContent } from '@/Utils/Data/removeTimestamp';

interface TranscriptSummaryProps {
  transcriptLocation?: string;
}

const TranscriptSummary: React.FC<TranscriptSummaryProps> = ({
  transcriptLocation,
}) => {
  const [summary, setSummary] = useState<string>('');
  const [expanded, setExpanded] = useState<boolean>(false);

  useEffect(() => {
    if (!transcriptLocation) {
      setSummary('No transcript available');
      return;
    }

    const loadTranscript = async () => {
      try {
        const result = await window.plugins.readFile(transcriptLocation);
        if (result.success && result.data) {
          const cleanedResult = cleanTranscriptContent(result.data);
          setSummary(cleanedResult);
        } else {
          setSummary(result.error || 'No content available');
        }
      } catch {
        setSummary('Failed to load transcript');
      }
    };

    loadTranscript();
  }, [transcriptLocation]);

  return (
    <div className="relative max-w-full">
      <p
        className={`whitespace-pre-wrap break-words transition-all duration-200 max-h-40 ${
          expanded
            ? 'overflow-y-auto' // scrollable when expanded
            : 'line-clamp-8 overflow-hidden' // only 3 lines visible
        }`}
      >
        {summary}
      </p>

      {summary.length > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-primary mt-2 hover:underline text-xs"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
};

export default TranscriptSummary;
