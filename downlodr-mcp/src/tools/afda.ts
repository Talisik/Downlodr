import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { bridgeGet, bridgePost } from '../client.js';

export async function handleListArticles({ page = 1, limit = 20 }: { page?: number; limit?: number }) {
  const result = await bridgeGet<{ items: unknown[]; total: number; page: number; limit: number }>(
    '/afda/articles', { page, limit: Math.min(limit, 100) },
  );
  return { total: result.total, page: result.page, limit: result.limit, pages: Math.ceil(result.total / result.limit), items: result.items };
}

export async function handleSearchArticles({ query, page = 1, limit = 20 }: { query?: string; page?: number; limit?: number }) {
  const params: Record<string, string | number> = { page, limit };
  if (query) params.q = query;
  return bridgeGet<unknown>('/afda/articles/search', params);
}

export async function handleGetArticle({ articleId }: { articleId: number }) {
  return bridgeGet<unknown>(`/afda/articles/${articleId}`);
}

export async function handleParseUrl({ url }: { url: string }) {
  return bridgePost<unknown>('/afda/articles/parse', { url });
}

export async function handleListWebsites() {
  return bridgeGet<unknown[]>('/afda/websites');
}

export async function handleTriggerScrape({ websiteId, sectionId }: { websiteId: number; sectionId?: number }) {
  return bridgePost<{ started: boolean; sections: number }>('/afda/scrape', { websiteId, sectionId });
}

export async function handleListScrapeJobs({ limit = 20, sectionId }: { limit?: number; sectionId?: number }) {
  const params: Record<string, string | number> = { limit };
  if (sectionId !== undefined) params.sectionId = sectionId;
  return bridgeGet<unknown[]>('/afda/jobs', params);
}

export async function handleRunMapper(payload: { website_url: string; fqdn: string; website_name: string; website_category?: string }) {
  return bridgePost<unknown>('/afda/mapper/run', payload);
}

export async function handleGetWebsiteAnalytics({ websiteId, days = 30 }: { websiteId: number; days?: number }) {
  return bridgeGet<unknown>('/afda/analytics', { websiteId, days });
}

export async function handleExportArticles(payload: {
  output_dir: string;
  formats: Array<'csv' | 'xlsx' | 'json'>;
  search?: string;
  website_ids?: number[];
  section_ids?: number[];
  date_from?: string;
  date_to?: string;
}) {
  const { output_dir, formats, ...filters } = payload;
  return bridgePost<unknown>('/afda/articles/export', { output_dir, formats, filters });
}

export async function handleGetAfdaSetting({ key }: { key: string }) {
  return bridgeGet<{ key: string; value: string | null }>('/afda/settings', { key });
}

export async function handleSetAfdaSetting({ key, value }: { key: string; value: string }) {
  return bridgePost<unknown>('/afda/settings', { key, value });
}

export async function handleSetAfdaConcurrency({ max }: { max: number }) {
  return bridgePost<unknown>('/afda/settings/load-control', { max });
}

export async function handleFilterArticles(params: {
  search?: string;
  website_ids?: number[];
  section_ids?: number[];
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
  sort_key?: string;
  sort_dir?: 'asc' | 'desc';
}) {
  const qp: Record<string, string | number> = { limit: params.limit ?? 20, offset: params.offset ?? 0 };
  if (params.search) qp.search = params.search;
  if (params.website_ids?.length) qp.website_ids = params.website_ids.join(',');
  if (params.section_ids?.length) qp.section_ids = params.section_ids.join(',');
  if (params.date_from) qp.date_from = params.date_from;
  if (params.date_to) qp.date_to = params.date_to;
  if (params.sort_key) qp.sort_key = params.sort_key;
  if (params.sort_dir) qp.sort_dir = params.sort_dir;
  return bridgeGet<unknown>('/afda/articles/filtered', qp);
}

export async function handleCountArticles(params: {
  search?: string;
  website_ids?: number[];
  section_ids?: number[];
  date_from?: string;
  date_to?: string;
}) {
  const qp: Record<string, string> = {};
  if (params.search) qp.search = params.search;
  if (params.website_ids?.length) qp.website_ids = params.website_ids.join(',');
  if (params.section_ids?.length) qp.section_ids = params.section_ids.join(',');
  if (params.date_from) qp.date_from = params.date_from;
  if (params.date_to) qp.date_to = params.date_to;
  return bridgeGet<unknown>('/afda/articles/count', qp);
}

export async function handleGetArticleFqdns() {
  return bridgeGet<unknown>('/afda/articles/fqdns');
}

export async function handleGetArticleSectionPaths() {
  return bridgeGet<unknown>('/afda/articles/section-paths');
}

export async function handleReparseArticle({ article_id }: { article_id: number }) {
  return bridgePost<unknown>('/afda/articles/reparse', { article_id });
}

export async function handleListManualArticles({ search, limit = 50, offset = 0 }: { search?: string; limit?: number; offset?: number }) {
  const params: Record<string, string | number> = { limit, offset };
  if (search) params.search = search;
  return bridgeGet<unknown>('/afda/manual-articles', params);
}

export async function handleCountManualArticles({ search }: { search?: string }) {
  const params: Record<string, string> = {};
  if (search) params.search = search;
  return bridgeGet<unknown>('/afda/manual-articles/count', params);
}

export async function handleGetManualArticle({ id }: { id: number }) {
  return bridgeGet<unknown>(`/afda/manual-articles/${id}`);
}

export async function handleReparseManualArticle({ id }: { id: number }) {
  return bridgePost<unknown>(`/afda/manual-articles/${id}/reparse`, {});
}

export async function handleDeleteManualArticle({ id }: { id: number }) {
  return bridgePost<unknown>(`/afda/manual-articles/${id}/delete`, {});
}

export async function handleUpdateWebsite(id: number, patch: Record<string, unknown>) {
  return bridgePost<unknown>(`/afda/websites/${id}/update`, patch);
}

export async function handleDeleteWebsite({ id }: { id: number }) {
  return bridgePost<unknown>(`/afda/websites/${id}/delete`, {});
}

export async function handleAddSection(payload: { website_id: number; path: string; name: string }) {
  return bridgePost<unknown>('/afda/sections', payload);
}

export async function handleDeleteSections({ section_ids }: { section_ids: number[] }) {
  return bridgePost<unknown>('/afda/sections/delete', { section_ids });
}

export async function handleUpdateSectionSchedule({ section_id, config, follow_manual = false }: { section_id: number; config: Record<string, unknown>; follow_manual?: boolean }) {
  return bridgePost<unknown>(`/afda/sections/${section_id}/schedule/update`, { config, follow_manual });
}

export async function handleSetSectionMaxArticles({ section_id, max_articles_per_run }: { section_id: number; max_articles_per_run: number | null }) {
  return bridgePost<unknown>(`/afda/sections/${section_id}/max-articles/update`, { max_articles_per_run });
}

export async function handleGetAfdaSchedules({ website_id }: { website_id?: number }) {
  const params: Record<string, string | number> = {};
  if (website_id !== undefined) params.website_id = website_id;
  return bridgeGet<unknown>('/afda/schedule', params);
}

export async function handlePauseSectionSchedule({ section_id }: { section_id: number }) {
  return bridgePost<unknown>('/afda/schedule/pause', { section_id });
}

export async function handleResumeSectionSchedule({ section_id, config }: { section_id: number; config?: Record<string, unknown> }) {
  return bridgePost<unknown>('/afda/schedule/resume', { section_id, config });
}

export async function handleRunSectionScrape({ section_id }: { section_id: number }) {
  return bridgePost<unknown>('/afda/scrape/run-now', { section_id });
}

export async function handleGetScrapeJobStatus({ job_id }: { job_id: number }) {
  return bridgeGet<unknown>('/afda/scrape/job-status', { job_id });
}

export async function handleGetScrapeJobSize({ job_id }: { job_id: number }) {
  return bridgeGet<unknown>('/afda/scrape/job-size', { job_id });
}

export async function handleGetScrapeJobArticles({ job_id }: { job_id: number }) {
  return bridgeGet<unknown>('/afda/scrape/job-articles', { job_id });
}

export async function handleRunMapperBatch(payload: { batchId: string; items: Array<{ website_url: string; fqdn: string; website_name: string; website_category?: string }> }) {
  return bridgePost<unknown>('/afda/mapper/batch', payload);
}

export async function handleCancelMapperBatch({ batchId }: { batchId: string }) {
  return bridgePost<unknown>('/afda/mapper/batch/cancel', { batchId });
}

export async function handleGetMapperBatchStatus({ batchId }: { batchId: string }) {
  return bridgeGet<unknown>('/afda/mapper/batch/status', { batchId });
}

export async function handleRunTemporalAnalysis({ section_id }: { section_id: number }) {
  return bridgePost<unknown>('/afda/temporal/run', { section_id });
}

export async function handleOpenWebsiteLogin({ websiteId, loginUrl }: { websiteId: number; loginUrl: string }) {
  return bridgePost<unknown>('/afda/auth/login', { websiteId, loginUrl });
}

export async function handleGetWebsiteAuthStatus({ websiteId }: { websiteId: number }) {
  return bridgeGet<unknown>('/afda/auth/status', { websiteId });
}

export async function handleClearWebsiteAuth({ websiteId }: { websiteId: number }) {
  return bridgePost<unknown>('/afda/auth/clear', { websiteId });
}

export async function handleGetAfdaStore() {
  return bridgeGet<unknown>('/afda/store');
}

export async function handleAddWebsite(payload: {
  fqdn: string;
  website_url: string;
  website_name: string;
  website_category?: string;
  mapper_raw?: string;
  pagination?: Record<string, unknown>;
  selected_sections?: Array<Record<string, unknown>>;
  lookback_mode?: string;
  lookback_value?: number;
}) {
  return bridgePost<unknown>('/afda/websites', payload);
}

export async function handleAddWebsiteSections(payload: { website_id: number; fqdn: string; sections: Array<{ section_url: string; section_path: string }> }) {
  return bridgePost<unknown>('/afda/websites/add-sections', payload);
}

export async function handleResetWebsiteInitialScrape({ website_id }: { website_id: number }) {
  return bridgePost<unknown>('/afda/websites/reset-initial-scrape', { website_id });
}

export async function handleAssignSectionSchedule(payload: { section_id: number; config: Record<string, unknown>; follow_manual?: boolean }) {
  return bridgePost<unknown>('/afda/schedule/assign', payload);
}

// ── Social sources ──────────────────────────────────────────────────────────

export async function handleScrapeSocialProfile(payload: { url: string; platform?: string; account?: string; useNitter?: boolean }) {
  return bridgePost<unknown>('/afda/social/scrape', payload);
}

export async function handleListSocialSources() {
  return bridgeGet<unknown>('/afda/social/sources');
}

export async function handleGetSocialSource({ id }: { id: number }) {
  return bridgeGet<unknown>(`/afda/social/sources/${id}`);
}

export async function handleGetSocialPosts({ id, limit = 20, offset = 0 }: { id: number; limit?: number; offset?: number }) {
  return bridgeGet<unknown>(`/afda/social/sources/${id}/posts`, { limit, offset });
}

export async function handleAddSocialSource(payload: { url: string; label?: string; account?: string; platform?: string }) {
  return bridgePost<unknown>('/afda/social/sources', payload);
}

export async function handleUpdateSocialSource({ id, ...patch }: { id: number; label?: string; account?: string }) {
  return bridgePost<unknown>(`/afda/social/sources/${id}/update`, patch);
}

export async function handleDeleteSocialSource({ id }: { id: number }) {
  return bridgePost<unknown>(`/afda/social/sources/${id}/delete`, {});
}

export async function handleScrapeSocialSourceNow({ id }: { id: number }) {
  return bridgePost<unknown>(`/afda/social/sources/${id}/scrape-now`, {});
}

export async function handleAssignSocialSchedule({ id, config }: { id: number; config: Record<string, unknown> }) {
  return bridgePost<unknown>(`/afda/social/sources/${id}/schedule/assign`, { config });
}

export async function handlePauseSocialSchedule({ id }: { id: number }) {
  return bridgePost<unknown>(`/afda/social/sources/${id}/schedule/pause`, {});
}

export async function handleResumeSocialSchedule({ id }: { id: number }) {
  return bridgePost<unknown>(`/afda/social/sources/${id}/schedule/resume`, {});
}

export function registerAfdaTools(server: McpServer): void {

  // ═══════════════════════════════════════════════════════════════════════════
  // ARTICLES — read
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    'downlodr_list_articles',
    'List scraped articles from the AFDA (Article Fetcher & Detail Analyzer) module. Paginated.',
    {
      page: z.number().optional().describe('Page number (default 1)'),
      limit: z.number().optional().describe('Items per page (default 20, max 100)'),
    },
    async ({ page = 1, limit = 20 }) => {
      const result = await bridgeGet<{ items: unknown[]; total: number; page: number; limit: number }>(
        '/afda/articles',
        { page, limit: Math.min(limit, 100) },
      );
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            total: result.total,
            page: result.page,
            limit: result.limit,
            pages: Math.ceil(result.total / result.limit),
            items: result.items,
          }, null, 2),
        }],
      };
    },
  );

  server.tool(
    'downlodr_search_articles',
    'Search scraped articles by keyword, domain, or language.',
    {
      query: z.string().optional().describe('Keyword to search in title and body'),
      page: z.number().optional().describe('Page number (default 1)'),
      limit: z.number().optional().describe('Items per page (default 20)'),
    },
    async ({ query, page = 1, limit = 20 }) => {
      const params: Record<string, string | number> = { page, limit };
      if (query) params.q = query;
      const result = await bridgeGet<unknown>('/afda/articles/search', params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_filter_articles',
    'Advanced article filtering by website, section, date range, search term with sorting.',
    {
      search: z.string().optional().describe('Keyword search'),
      website_ids: z.array(z.number()).optional().describe('Filter to specific website IDs'),
      section_ids: z.array(z.number()).optional().describe('Filter to specific section IDs'),
      date_from: z.string().optional().describe('Start date ISO string'),
      date_to: z.string().optional().describe('End date ISO string'),
      limit: z.number().optional().describe('Max results (default 20)'),
      offset: z.number().optional().describe('Pagination offset (default 0)'),
      sort_key: z.string().optional().describe('Sort field (e.g. "published_at", "title")'),
      sort_dir: z.enum(['asc', 'desc']).optional().describe('Sort direction'),
    },
    async (params) => {
      const qp: Record<string, string | number> = {
        limit: params.limit ?? 20,
        offset: params.offset ?? 0,
      };
      if (params.search) qp.search = params.search;
      if (params.website_ids?.length) qp.website_ids = params.website_ids.join(',');
      if (params.section_ids?.length) qp.section_ids = params.section_ids.join(',');
      if (params.date_from) qp.date_from = params.date_from;
      if (params.date_to) qp.date_to = params.date_to;
      if (params.sort_key) qp.sort_key = params.sort_key;
      if (params.sort_dir) qp.sort_dir = params.sort_dir;
      const result = await bridgeGet<unknown>('/afda/articles/filtered', qp);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_count_articles',
    'Count articles matching filters (website, section, date range, search).',
    {
      search: z.string().optional().describe('Keyword search'),
      website_ids: z.array(z.number()).optional().describe('Filter to website IDs'),
      section_ids: z.array(z.number()).optional().describe('Filter to section IDs'),
      date_from: z.string().optional().describe('Start date ISO string'),
      date_to: z.string().optional().describe('End date ISO string'),
    },
    async (params) => {
      const qp: Record<string, string> = {};
      if (params.search) qp.search = params.search;
      if (params.website_ids?.length) qp.website_ids = params.website_ids.join(',');
      if (params.section_ids?.length) qp.section_ids = params.section_ids.join(',');
      if (params.date_from) qp.date_from = params.date_from;
      if (params.date_to) qp.date_to = params.date_to;
      const result = await bridgeGet<unknown>('/afda/articles/count', qp);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_get_article',
    'Get the full content of a specific article by its ID.',
    { articleId: z.number().describe('Article ID from downlodr_list_articles or downlodr_search_articles') },
    async ({ articleId }) => {
      const article = await bridgeGet<unknown>(`/afda/articles/${articleId}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(article, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_get_article_fqdns',
    'Get all unique domain names (FQDNs) present in scraped articles.',
    {},
    async () => {
      const result = await bridgeGet<unknown>('/afda/articles/fqdns');
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_get_article_section_paths',
    'Get all unique section paths present in scraped articles.',
    {},
    async () => {
      const result = await bridgeGet<unknown>('/afda/articles/section-paths');
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ARTICLES — write
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    'downlodr_reparse_article',
    'Re-fetch and re-parse a scraped article by ID (refreshes its content from the source URL).',
    { article_id: z.number().describe('Article ID to reparse') },
    async ({ article_id }) => {
      const result = await bridgePost<unknown>('/afda/articles/reparse', { article_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_export_articles',
    'Export articles to CSV, XLSX, or JSON files with deduplication.',
    {
      output_dir: z.string().describe('Directory path to write exported files'),
      formats: z.array(z.enum(['csv', 'xlsx', 'json'])).describe('Export formats to generate'),
      search: z.string().optional().describe('Keyword filter'),
      website_ids: z.array(z.number()).optional().describe('Filter to website IDs'),
      section_ids: z.array(z.number()).optional().describe('Filter to section IDs'),
      date_from: z.string().optional().describe('Start date ISO string'),
      date_to: z.string().optional().describe('End date ISO string'),
    },
    async ({ output_dir, formats, ...filters }) => {
      const result = await bridgePost<unknown>('/afda/articles/export', {
        output_dir,
        formats,
        filters,
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // MANUAL ARTICLES
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    'downlodr_list_manual_articles',
    'List manually parsed articles (URLs submitted by the user for on-demand parsing).',
    {
      search: z.string().optional().describe('Keyword search'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Pagination offset'),
    },
    async ({ search, limit = 50, offset = 0 }) => {
      const params: Record<string, string | number> = { limit, offset };
      if (search) params.search = search;
      const result = await bridgeGet<unknown>('/afda/manual-articles', params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_count_manual_articles',
    'Count manually parsed articles.',
    {
      search: z.string().optional().describe('Keyword search filter'),
    },
    async ({ search }) => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      const result = await bridgeGet<unknown>('/afda/manual-articles/count', params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_get_manual_article',
    'Get a single manually parsed article by ID.',
    { id: z.number().describe('Manual article ID') },
    async ({ id }) => {
      const result = await bridgeGet<unknown>(`/afda/manual-articles/${id}`);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_parse_url',
    'Fetch and parse a URL on-demand (manual article). Stores the result in AFDA.',
    { url: z.string().describe('URL to fetch and parse') },
    async ({ url }) => {
      const result = await bridgePost<unknown>('/afda/articles/parse', { url });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_reparse_manual_article',
    'Re-fetch and re-parse a manually submitted article, updating it in place.',
    { id: z.number().describe('Manual article ID to reparse') },
    async ({ id }) => {
      const result = await bridgePost<unknown>(`/afda/manual-articles/${id}/reparse`, {});
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_delete_manual_article',
    'Delete a manually parsed article.',
    { id: z.number().describe('Manual article ID to delete') },
    async ({ id }) => {
      const result = await bridgePost<unknown>(`/afda/manual-articles/${id}/delete`, {});
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // WEBSITES
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    'downlodr_list_websites',
    'List all tracked websites in AFDA, including their sections.',
    {},
    async () => {
      const result = await bridgeGet<unknown[]>('/afda/websites');
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_add_website',
    [
      'Add a new website for article scraping. Before calling this you MUST:',
      '1. Run downlodr_run_mapper first to discover sections',
      '2. ASK which sections to include (default: all)',
      '3. ASK articles per run: 5 / 10 (default) / 25 / 50 / 100',
      '4. ASK schedule: auto (default) or manual intervals per section',
      '5. ASK lookback: 24h / 7 days (default) / 30 days / all',
      '6. Show confirmation summary and get yes/no',
      'confirmed must be true — only set after user says yes.',
    ].join('\n'),
    {
      fqdn: z.string().describe('Domain name (e.g. "example.com")'),
      website_url: z.string().describe('Full website URL'),
      website_name: z.string().describe('Display name for the website'),
      confirmed: z.boolean().describe('Set true only after showing the user sections, article limit, schedule, lookback and they said yes.'),
      website_category: z.string().optional().describe('Category label (e.g. "news", "blog")'),
      mapper_raw: z.string().optional().describe('JSON string of mapper config (from downlodr_run_mapper)'),
      pagination: z.record(z.string(), z.unknown()).optional().describe('Pagination config object'),
      selected_sections: z.array(z.record(z.string(), z.unknown())).optional().describe('Sections to activate'),
      lookback_mode: z.string().optional().describe('Lookback mode: "days", "count", etc.'),
      lookback_value: z.number().optional().describe('Lookback value'),
    },
    async ({ confirmed, ...payload }) => {
      if (!confirmed) {
        return { content: [{ type: 'text' as const, text: 'Cannot add website: confirmed is false. Run the mapper, collect section/schedule/lookback preferences, show a summary, and ask "Confirm? (yes/no)" before calling this.' }] };
      }
      const result = await bridgePost<unknown>('/afda/websites', payload);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_update_website',
    'Update metadata for an existing tracked website (patch — only provided fields are changed).',
    {
      id: z.number().describe('Website ID from downlodr_list_websites'),
      website_name: z.string().optional().describe('New display name'),
      website_category: z.string().optional().describe('New category'),
      lookback_mode: z.string().optional().describe('New lookback mode'),
      lookback_value: z.number().optional().describe('New lookback value'),
    },
    async ({ id, ...patch }) => {
      const result = await bridgePost<unknown>(`/afda/websites/${id}/update`, patch);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_delete_website',
    'Delete a tracked website. IMPORTANT: Call downlodr_get_workflows first — always confirm with the user before deleting.',
    { id: z.number().describe('Website ID to delete') },
    async ({ id }) => {
      const result = await bridgePost<unknown>(`/afda/websites/${id}/delete`, {});
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_add_website_sections',
    'Append new sections (URLs/paths to scrape) to an existing website.',
    {
      website_id: z.number().describe('Website ID'),
      fqdn: z.string().describe('Domain of the website'),
      sections: z.array(z.object({
        section_url: z.string().describe('Full URL of the section'),
        section_path: z.string().describe('Path component of the section URL'),
      })).describe('Sections to add'),
    },
    async (payload) => {
      const result = await bridgePost<unknown>('/afda/websites/add-sections', payload);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_reset_website_initial_scrape',
    'Clear the initial_scrape_done flag for all sections of a website, allowing a fresh full scrape.',
    { website_id: z.number().describe('Website ID to reset') },
    async ({ website_id }) => {
      const result = await bridgePost<unknown>('/afda/websites/reset-initial-scrape', { website_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    'downlodr_add_section',
    'Add a new section (scrape target URL) to an existing website.',
    {
      website_id: z.number().describe('Website ID to add the section to'),
      path: z.string().describe('URL path of the section (e.g. "/news/tech")'),
      name: z.string().describe('Display name for the section'),
    },
    async (payload) => {
      const result = await bridgePost<unknown>('/afda/sections', payload);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_delete_sections',
    'Delete one or more sections and all their dependent articles and scrape jobs.',
    { section_ids: z.array(z.number()).describe('Array of section IDs to delete') },
    async ({ section_ids }) => {
      const result = await bridgePost<unknown>('/afda/sections/delete', { section_ids });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_update_section_schedule',
    'Update the cron schedule for a section.',
    {
      section_id: z.number().describe('Section ID'),
      config: z.record(z.string(), z.unknown()).describe('Schedule config object (cron expression, etc.)'),
      follow_manual: z.boolean().optional().describe('Whether to follow manual schedule (default false)'),
    },
    async ({ section_id, config, follow_manual = false }) => {
      const result = await bridgePost<unknown>(`/afda/sections/${section_id}/schedule/update`, {
        config,
        follow_manual,
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_set_section_max_articles',
    'Cap the number of articles downloaded per scrape run for a section.',
    {
      section_id: z.number().describe('Section ID'),
      max_articles_per_run: z.number().nullable().describe('Max articles per run, or null for unlimited'),
    },
    async ({ section_id, max_articles_per_run }) => {
      const result = await bridgePost<unknown>(`/afda/sections/${section_id}/max-articles/update`, {
        max_articles_per_run,
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SCHEDULE MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    'downlodr_get_afda_schedules',
    'Get all AFDA scrape schedules, optionally filtered by website.',
    {
      website_id: z.number().optional().describe('Filter by website ID'),
    },
    async ({ website_id }) => {
      const params: Record<string, string | number> = {};
      if (website_id !== undefined) params.website_id = website_id;
      const result = await bridgeGet<unknown>('/afda/schedule', params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_assign_section_schedule',
    'Register a cron schedule for a section (starts automatic scraping).',
    {
      section_id: z.number().describe('Section ID'),
      config: z.record(z.string(), z.unknown()).describe('Schedule config (e.g. { cron: "0 */6 * * *" })'),
      follow_manual: z.boolean().optional().describe('Follow manual schedule pattern'),
    },
    async (payload) => {
      const result = await bridgePost<unknown>('/afda/schedule/assign', payload);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_pause_section_schedule',
    'Pause automatic scraping for a section (disables its cron job).',
    { section_id: z.number().describe('Section ID to pause') },
    async ({ section_id }) => {
      const result = await bridgePost<unknown>('/afda/schedule/pause', { section_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_resume_section_schedule',
    'Resume automatic scraping for a paused section.',
    {
      section_id: z.number().describe('Section ID to resume'),
      config: z.record(z.string(), z.unknown()).optional().describe('Updated schedule config (optional)'),
    },
    async (payload) => {
      const result = await bridgePost<unknown>('/afda/schedule/resume', payload);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SCRAPING
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    'downlodr_trigger_scrape',
    'Trigger an immediate article scrape. IMPORTANT: Call downlodr_get_workflows first — only trigger if the user explicitly asked to scrape now.',
    {
      websiteId: z.number().describe('Website ID from downlodr_list_websites'),
      sectionId: z.number().optional().describe('Section ID to scrape (scrapes all sections if omitted)'),
    },
    async ({ websiteId, sectionId }) => {
      const result = await bridgePost<{ started: boolean; sections: number }>('/afda/scrape', {
        websiteId,
        sectionId,
      });
      return {
        content: [{
          type: 'text' as const,
          text: result.started
            ? `Scrape started for ${result.sections} section(s) of website ${websiteId}.`
            : `Failed to start scrape for website ${websiteId}.`,
        }],
      };
    },
  );

  server.tool(
    'downlodr_run_section_scrape',
    'Start an immediate manual scrape for a specific section.',
    { section_id: z.number().describe('Section ID to scrape now') },
    async ({ section_id }) => {
      const result = await bridgePost<unknown>('/afda/scrape/run-now', { section_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_list_scrape_jobs',
    'List recent scrape jobs from AFDA.',
    {
      limit: z.number().optional().describe('Number of jobs to return (default 20)'),
      sectionId: z.number().optional().describe('Filter by section ID'),
    },
    async ({ limit = 20, sectionId }) => {
      const params: Record<string, string | number> = { limit };
      if (sectionId !== undefined) params.sectionId = sectionId;
      const rows = await bridgeGet<unknown[]>('/afda/jobs', params);
      return { content: [{ type: 'text' as const, text: JSON.stringify(rows, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_get_scrape_job_status',
    'Get the status of a specific scrape job.',
    { job_id: z.number().describe('Scrape job ID') },
    async ({ job_id }) => {
      const result = await bridgeGet<unknown>('/afda/scrape/job-status', { job_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_get_scrape_job_size',
    'Get the total article byte size for a scrape job.',
    { job_id: z.number().describe('Scrape job ID') },
    async ({ job_id }) => {
      const result = await bridgeGet<unknown>('/afda/scrape/job-size', { job_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_get_scrape_job_articles',
    'Get all article URLs collected in a specific scrape job.',
    { job_id: z.number().describe('Scrape job ID') },
    async ({ job_id }) => {
      const result = await bridgeGet<unknown>('/afda/scrape/job-articles', { job_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // MAPPER (website template discovery)
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    'downlodr_run_mapper',
    'Infer scraping selectors from a website URL. Fire-and-forget — emits mapper:complete when done. Use this before downlodr_add_website to auto-detect the site structure.',
    {
      website_url: z.string().describe('URL of the website to analyze'),
      fqdn: z.string().describe('Domain name (e.g. "example.com")'),
      website_name: z.string().describe('Display name for the website'),
      website_category: z.string().optional().describe('Category label (e.g. "news", "blog")'),
    },
    async (payload) => {
      const result = await bridgePost<unknown>('/afda/mapper/run', payload);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_run_mapper_batch',
    'Run the mapper on multiple websites in parallel. Fire-and-forget.',
    {
      batchId: z.string().describe('Unique ID for this batch run'),
      items: z.array(z.object({
        website_url: z.string(),
        fqdn: z.string(),
        website_name: z.string(),
        website_category: z.string().optional(),
      })).describe('Websites to analyze'),
    },
    async (payload) => {
      const result = await bridgePost<unknown>('/afda/mapper/batch', payload);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_cancel_mapper_batch',
    'Cancel an active mapper batch run.',
    { batchId: z.string().describe('Batch ID to cancel') },
    async ({ batchId }) => {
      const result = await bridgePost<unknown>('/afda/mapper/batch/cancel', { batchId });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_get_mapper_batch_status',
    'Get the current status of a mapper batch run.',
    { batchId: z.string().describe('Batch ID to check') },
    async ({ batchId }) => {
      const result = await bridgeGet<unknown>('/afda/mapper/batch/status', { batchId });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ANALYTICS & TEMPORAL ANALYSIS
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    'downlodr_get_website_analytics',
    'Get analytics for a tracked website: article download rate, upload cadence, average size, activity heatmap.',
    {
      websiteId: z.number().describe('Website ID from downlodr_list_websites'),
      days: z.number().optional().describe('Time window in days (default 30)'),
    },
    async ({ websiteId, days = 30 }) => {
      const analytics = await bridgeGet<unknown>('/afda/analytics', { websiteId, days });
      return { content: [{ type: 'text' as const, text: JSON.stringify(analytics, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_run_temporal_analysis',
    'Run temporal analysis on a section to infer its upload frequency and best scrape schedule.',
    { section_id: z.number().describe('Section ID to analyze') },
    async ({ section_id }) => {
      const result = await bridgePost<unknown>('/afda/temporal/run', { section_id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    'downlodr_get_afda_setting',
    'Get an AFDA app setting by key (e.g. "concurrency", "lookback_mode", "lookback_value").',
    { key: z.string().describe('Setting key name') },
    async ({ key }) => {
      const result = await bridgeGet<{ key: string; value: string | null }>('/afda/settings', { key });
      return {
        content: [{
          type: 'text' as const,
          text: result.value !== null
            ? `${result.key} = ${result.value}`
            : `Setting "${result.key}" is not set.`,
        }],
      };
    },
  );

  server.tool(
    'downlodr_set_afda_setting',
    'Set an AFDA app setting (e.g. adjust concurrency, lookback window).',
    {
      key: z.string().describe('Setting key name'),
      value: z.string().describe('New value'),
    },
    async ({ key, value }) => {
      const result = await bridgePost<unknown>('/afda/settings', { key, value });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_set_afda_concurrency',
    'Set the maximum number of concurrent scrape jobs (1–20).',
    { max: z.number().min(1).max(20).describe('Max concurrent scrapes') },
    async ({ max }) => {
      const result = await bridgePost<unknown>('/afda/settings/load-control', { max });
      return {
        content: [{
          type: 'text' as const,
          text: `Max concurrent scrapes set to ${max}.`,
        }],
      };
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    'downlodr_open_website_login',
    'Open the login flow for a website that requires authentication to scrape.',
    {
      websiteId: z.number().describe('Website ID'),
      loginUrl: z.string().describe('Login page URL'),
    },
    async ({ websiteId, loginUrl }) => {
      const result = await bridgePost<unknown>('/afda/auth/login', { websiteId, loginUrl });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_get_website_auth_status',
    'Check whether a website has active stored authentication credentials.',
    { websiteId: z.number().describe('Website ID') },
    async ({ websiteId }) => {
      const result = await bridgeGet<unknown>('/afda/auth/status', { websiteId });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_clear_website_auth',
    'Clear stored authentication credentials for a website.',
    { websiteId: z.number().describe('Website ID') },
    async ({ websiteId }) => {
      const result = await bridgePost<unknown>('/afda/auth/clear', { websiteId });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // STORE HYDRATION
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    'downlodr_get_afda_store',
    'Get the full AFDA data store: all websites, sections, and schedules in one call.',
    {},
    async () => {
      const result = await bridgeGet<unknown>('/afda/store');
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SOCIAL SOURCES (X / Reddit / Facebook / YouTube)
  // ═══════════════════════════════════════════════════════════════════════════

  server.tool(
    'downlodr_scrape_social_profile',
    'Scrape a social media profile/feed (X/Twitter, Reddit, Facebook, YouTube) on-demand and return its recent posts. Platform is auto-detected from the URL. Does NOT persist anything — use downlodr_add_social_source to track a profile over time.',
    {
      url: z.string().describe('Profile/feed URL to scrape'),
      platform: z.string().optional().describe('Platform override: x, reddit, fb, youtube (auto-detected if omitted)'),
      account: z.string().optional().describe('accounts.json username for an authenticated FB/X session'),
      useNitter: z.boolean().optional().describe('For X only — use the Nitter path instead of the X API'),
    },
    async (payload) => {
      const result = await handleScrapeSocialProfile(payload);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_list_social_sources',
    'List all tracked social sources (profiles followed for scheduled scraping).',
    {},
    async () => {
      const result = await handleListSocialSources();
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_get_social_source',
    'Get one tracked social source by its ID.',
    { id: z.number().describe('Social source ID') },
    async ({ id }) => {
      const result = await handleGetSocialSource({ id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_get_social_posts',
    'List stored posts for a tracked social source. Paginated.',
    {
      id: z.number().describe('Social source ID'),
      limit: z.number().optional().describe('Max posts (default 20)'),
      offset: z.number().optional().describe('Pagination offset (default 0)'),
    },
    async ({ id, limit = 20, offset = 0 }) => {
      const result = await handleGetSocialPosts({ id, limit, offset });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_add_social_source',
    'Track a social profile for scheduled scraping. Platform is auto-detected from the URL. Confirm with the user before calling — this writes a new tracked source.',
    {
      url: z.string().describe('Profile/feed URL to track'),
      label: z.string().optional().describe('Display label (defaults to the URL handle)'),
      account: z.string().optional().describe('Auth account username for FB/X sessions'),
      platform: z.string().optional().describe('Platform override: x, reddit, fb, youtube'),
    },
    async (payload) => {
      const result = await handleAddSocialSource(payload);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_update_social_source',
    'Update a tracked social source\'s label or auth account.',
    {
      id: z.number().describe('Social source ID'),
      label: z.string().optional().describe('New display label'),
      account: z.string().optional().describe('New auth account username'),
    },
    async ({ id, ...patch }) => {
      const result = await handleUpdateSocialSource({ id, ...patch });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_delete_social_source',
    'Delete a tracked social source and all its stored posts. Destructive — confirm with the user first.',
    { id: z.number().describe('Social source ID to delete') },
    async ({ id }) => {
      const result = await handleDeleteSocialSource({ id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_scrape_social_source_now',
    'Immediately scrape a tracked social source and store any new posts. Returns the number inserted.',
    { id: z.number().describe('Social source ID to scrape now') },
    async ({ id }) => {
      const result = await handleScrapeSocialSourceNow({ id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_assign_social_schedule',
    'Set a recurring scrape schedule for a tracked social source. config uses the shared ScheduleConfig shape (e.g. { type: "preset", preset: "every_1h" }; presets: every_15m, every_30m, every_1h, every_2h, every_3h, every_4h, every_6h, daily).',
    {
      id: z.number().describe('Social source ID'),
      config: z.record(z.string(), z.unknown()).describe('ScheduleConfig object'),
    },
    async ({ id, config }) => {
      const result = await handleAssignSocialSchedule({ id, config });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_pause_social_schedule',
    'Pause scheduled scraping for a tracked social source.',
    { id: z.number().describe('Social source ID to pause') },
    async ({ id }) => {
      const result = await handlePauseSocialSchedule({ id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );

  server.tool(
    'downlodr_resume_social_schedule',
    'Resume scheduled scraping for a paused social source.',
    { id: z.number().describe('Social source ID to resume') },
    async ({ id }) => {
      const result = await handleResumeSocialSchedule({ id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    },
  );
}
