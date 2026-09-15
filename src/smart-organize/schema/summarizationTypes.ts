export interface SummarizeRequest {
  id: string;
  title: string;
  transcript: string;
  model?: string;
}

export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  model: string;
}

export interface SummarizeResult {
  summary: string;
  usage: Usage;
}

export interface ProgressUpdate {
  progress: number;
  message: string;
  result?: SummarizeResult;
  error?: string;
}

export interface UseSummarizeVideoReturn {
  progress: number;
  message: string;
  result: SummarizeResult | null;
  error: string | null;
  isLoading: boolean;
  summarize: (videoData: SummarizeRequest) => Promise<void>;
}
