// utils/mcpClient.ts
// import { POST } from '../../Hooks/useAxios';

interface videoInfo {
  title: string;
  id: string;
  description: string;
  transcription: string;
}

// Define the org details type
export interface OrgDetails {
  course_name: string;
  goals: string;
  videos: videoInfo[];
  [key: string]: unknown;
}

// Define streaming event types for organization generation
export type OrganizeRequest = OrgDetails;

export interface VideoItem {
  id: string;
  title: string;
  description?: string;
  transcription?: string;
}

export interface OrganizeVideoResult {
  title: string;
  categories: string[];
}

export interface NewOrganizeApiResponse {
  data: Record<string, OrganizeVideoResult>;
  category_relevance_scores?: Record<string, number>; // Add new field for V3 API

  category_contexts: Record<string, string>;
  selected_category?: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    model: string;
  };
}

// Enhanced interface for transformed response that includes category contexts
export interface TransformedOrganizeResponse {
  groups: Record<string, { video_id: string; video_title: string }[]>;
  category_contexts: Record<string, string>;
}

// Transformation function to convert new API format to expected format with category contexts
export function transformOrganizeResponse(
  apiResponse: NewOrganizeApiResponse,
): TransformedOrganizeResponse {
  if (apiResponse && typeof apiResponse === 'object') {
    const transformedGroups: Record<
      string,
      {
        video_id: string;
        video_title: string;
      }[]
    > = {};

    Object.entries(apiResponse.data).forEach(([videoId, videoData]) => {
      if (!videoData || !Array.isArray(videoData.categories)) {
        return;
      }

      videoData.categories.forEach((categoryName) => {
        if (!categoryName) {
          return;
        }

        if (!transformedGroups[categoryName]) {
          transformedGroups[categoryName] = [];
        }

        transformedGroups[categoryName].push({
          video_id: videoId,
          video_title: videoData.title,
        });
      });
    });

    return {
      groups: transformedGroups,
      category_contexts: apiResponse.category_contexts || {},
    };
  }

  // Fallback to empty object with empty contexts
  console.warn('Unable to transform organize response:', apiResponse);
  return {
    groups: {},
    category_contexts: {},
  };
}

export interface StreamProgressEvent {
  progress: number;
  message: string;
}

export interface StreamResultEvent {
  progress: number;
  message: string;
  result: NewOrganizeApiResponse;
}

export interface StreamErrorEvent {
  error: string;
}

export type StreamEvent =
  | StreamProgressEvent
  | StreamResultEvent
  | StreamErrorEvent;

// Progress callback type for streaming updates
export type ProgressCallback = (progress: number, message: string) => void;
export type ResultCallback = (result: NewOrganizeApiResponse) => void;
export type ErrorCallback = (error: string) => void;

// React hook for streaming organization generation (similar to useSmartOrganizeStream)
export interface UseOrganizeStreamReturn {
  progress: number;
  message: string;
  result: NewOrganizeApiResponse | null;
  error: string | null;
  isLoading: boolean;
  startStream: (requestData: OrganizeRequest) => Promise<void>;
  reset: () => void;
}

/**
 * Usage Examples:
 *
 * // Example 1: Using the streaming function with callbacks
 * const orgDetails: OrganizeRequest = {
 *   course_name: "Advanced React Development",
 *   goals: "Learn advanced React patterns and best practices",
 *   videos: [
 *     {
 *       title: "React Hooks Deep Dive",
 *       description: "Understanding useEffect and custom hooks",
 *       transcription: "In this video we'll explore..."
 *     }
 *   ]
 * };
 *
 * try {
 *   const result = await generateOrgWithProgress(
 *     orgDetails,
 *     (progress, message) => {
 *       console.log(`Progress: ${progress}% - ${message}`);
 *       // Update UI progress bar here
 *     },
 *     (result) => {
 *       console.log('Organization generated successfully:', result);
 *       // Handle final result
 *     },
 *     (error) => {
 *       console.error('Error occurred:', error);
 *       // Handle error
 *     }
 *   );
 * } catch (error) {
 *   console.error('Failed to generate organization:', error);
 * }
 *
 * // Example 2: Using the non-streaming version (backward compatibility)
 * try {
 *   const result = await generateOrg(orgDetails);
 *   console.log('Organization generated:', result);
 * } catch (error) {
 *   console.error('Error:', error);
 * }
 */

// Streaming version of generateOrg with progress callbacks
export async function generateOrgWithProgress(
  orgDetails: OrganizeRequest,
  onProgress?: ProgressCallback,
  onResult?: ResultCallback,
  onError?: ErrorCallback,
): Promise<NewOrganizeApiResponse> {
  const baseUrl =
    '';

  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orgDetails),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No reader available for streaming response');
    }

    let finalResult: NewOrganizeApiResponse | null = null;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6); // Remove 'data: ' prefix
          try {
            const event: StreamEvent = JSON.parse(jsonStr);

            if ('error' in event) {
              const errorMsg = event.error;
              onError?.(errorMsg);
              throw new Error(errorMsg);
            } else if ('result' in event) {
              // Final result received
              onProgress?.(event.progress, event.message);
              finalResult = event.result;
              onResult?.(event.result as NewOrganizeApiResponse);
            } else {
              // Progress update
              onProgress?.(event.progress, event.message);
            }
          } catch (parseError) {
            console.error('Failed to parse SSE data:', parseError);
            const errorMsg = 'Failed to parse server response';
            onError?.(errorMsg);
            throw new Error(errorMsg);
          }
        }
      }
    }

    if (!finalResult) {
      throw new Error('No final result received from streaming response');
    }

    return finalResult;
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error generating organization:', errorMsg);
    onError?.(errorMsg);
    throw error;
  }
}

// Non-streaming version (backward compatibility)
export async function generateOrg(orgDetails: OrgDetails): Promise<unknown> {
  const baseUrl = '';
  try {
    const response = await POST(baseUrl, orgDetails);

    return response.data;
  } catch (error) {
    console.error('Error generating organization:', error);
    throw error;
  }
}
