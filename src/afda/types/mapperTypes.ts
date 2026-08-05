// Shapes pushed by the afda-backend mapper over IPC (mapper:complete /
// mapper:error). Shared by AfdaAddWebsiteModal and GlobalAfdaMapperListener.

export type FrequencyInterval = '15 min' | '1 hour' | '6 hours' | 'Daily';

export interface FrequencyAnalysisResult {
  status: 'complete' | 'skipped';
  suggested_interval: FrequencyInterval;
  suggested_value_minutes: number;
  suggested_days: number[];
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface MapperResult {
  fqdn: string;
  website_url: string;
  website_name: string;
  website_category: string;
  mapper_raw: Record<string, unknown>;
  section_links: string[];
  has_paywall: boolean;
  pagination: unknown;
  section_analyses: Record<string, FrequencyAnalysisResult> | null;
}
