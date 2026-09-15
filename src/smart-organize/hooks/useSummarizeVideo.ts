import { useState, useCallback } from 'react';
import type {
  SummarizeRequest,
  SummarizeResult,
  ProgressUpdate,
  UseSummarizeVideoReturn,
} from '@/smart-organize/schema/summarizationTypes';

/**
 * Custom hook for video summarization with SSE streaming support
 * Provides real-time progress updates during summarization process
 */
export function useSummarizeVideo(baseUrl?: string): UseSummarizeVideoReturn {
  const [progress, setProgress] = useState<number>(0);
  const [message, setMessage] = useState<string>('');
  const [result, setResult] = useState<SummarizeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Use provided baseUrl or the build-time VITE_SUMMARY_API_ENDPOINT
  const apiUrl =
    baseUrl ||
    (typeof __SUMMARY_API_ENDPOINT__ !== 'undefined'
      ? __SUMMARY_API_ENDPOINT__
      : '');

  const summarize = useCallback(
    async (videoData: SummarizeRequest): Promise<void> => {
      // Reset state for new request
      setIsLoading(true);
      setError(null);
      setProgress(0);
      setMessage('');
      setResult(null);

      try {
        // Validate required fields
        if (!videoData.id || !videoData.title || !videoData.transcript) {
          throw new Error(
            'Missing required fields: id, title, and transcript are required',
          );
        }

        if (!apiUrl) {
          throw new Error(
            'Summarization service is not configured (set VITE_SUMMARY_API_ENDPOINT)',
          );
        }

        if (videoData.transcript.length < 10) {
          throw new Error(
            'Transcript is too short to generate a meaningful summary',
          );
        }

        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(videoData),
        });

        if (!response.ok) {
          throw new Error(
            `HTTP error! status: ${response.status} - ${response.statusText}`,
          );
        }

        if (!response.body) {
          throw new Error('Response body is null - streaming not supported');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // Process SSE stream
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data: ProgressUpdate = JSON.parse(line.slice(6));

                if (data.error) {
                  setError(data.error);
                  setIsLoading(false);
                  return;
                } else if (data.result) {
                  setResult(data.result);
                  setProgress(100);
                  setMessage('Complete!');
                  setIsLoading(false);
                  return;
                } else {
                  setProgress(data.progress);
                  setMessage(data.message);
                }
              } catch (parseError) {
                console.warn('Failed to parse SSE data:', line, parseError);
                // Continue processing other lines
              }
            }
          }
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Unknown error occurred during summarization';
        setError(errorMessage);
        setIsLoading(false);
        console.error('Summarization error:', err);
      }
    },
    [apiUrl],
  );

  return {
    progress,
    message,
    result,
    error,
    isLoading,
    summarize,
  };
}

/**
 * Utility function to create a SummarizeRequest from basic video data
 */
export function createSummarizeRequest(
  id: string,
  title: string,
  transcript: string,
  model?: string,
): SummarizeRequest {
  return {
    id: id.trim(),
    title: title.trim(),
    transcript: transcript.trim(),
    model: model || 'gpt-4',
  };
}

/**
 * Utility function to validate transcript content before summarization
 */
export function validateTranscriptForSummary(transcript: string): {
  isValid: boolean;
  error?: string;
} {
  if (!transcript || typeof transcript !== 'string') {
    return { isValid: false, error: 'Transcript must be a non-empty string' };
  }

  const trimmedTranscript = transcript.trim();

  if (trimmedTranscript.length < 10) {
    return {
      isValid: false,
      error: 'Transcript is too short (minimum 10 characters)',
    };
  }

  if (trimmedTranscript.length > 100000) {
    return {
      isValid: false,
      error: 'Transcript is too long (maximum 100,000 characters)',
    };
  }

  return { isValid: true };
}
