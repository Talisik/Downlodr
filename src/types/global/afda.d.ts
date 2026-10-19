/* eslint-disable prettier/prettier */
/** AFDA (Article Fetcher & Detail Analyzer) bridge. */
import type { ScheduleConfig, Website } from '@/afda/backend/afda-backend/src/types';
import type { FrequencyAnalysisResult } from '@/afda/types/mapperTypes';

// --- AFDA section-management results (docs/afda-section-management-bridge.md) ---
// Failures come back as values, not thrown errors. This repo compiles without
// strictNullChecks, so narrow with `res.ok === false`, not `!res.ok`.
type AfdaError<Code extends string> = { ok: false; error: Code };
/** Another section (maybe on another website) already covers this URL. */
type AfdaDuplicate = { ok: false; error: 'duplicate'; section_id: number; website_id: number };
/** `message` says which part of the schedule config is wrong. */
type AfdaInvalidSchedule = { ok: false; error: 'invalid_schedule'; message: string };

declare global {
  interface Window {
    // ─── AFDA (Article Fetcher & Detail Analyzer) bridge ─────────────────
    afdaBridge: {
      // Legacy compatibility
      parseArticle: (url: string) => Promise<unknown>;

      // Push-event listeners. Each returns an unsubscribe function.
      on: {
        mapperProgress: (cb: (data: any) => void) => () => void;
        mapperComplete: (cb: (data: any) => void) => () => void;
        mapperError: (cb: (data: { fqdn: string; message: string }) => void) => () => void;
        mapperAuthRequired: (cb: (data: any) => void) => () => void;
        scrapeArticleSaved: (
          cb: (data: { job_id: number; article_id: number; section_id: number; url: string }) => void,
        ) => () => void;
        manualArticleSaved: (cb: (data: any) => void) => () => void;
        storeHydrate: (cb: (data: { websites: any[] }) => void) => () => void;
        websiteRemapComplete: (
          cb: (data: {
            website_id: number;
            /** Only sections no website tracks yet. Nothing is saved until addSections. */
            new_sections: Array<{ section_url: string; section_path: string; analysis: FrequencyAnalysisResult | null }>;
          }) => void,
        ) => () => void;
        websiteRemapError: (
          cb: (data: { website_id: number; code: 'auth_required' | 'mapper_failed'; message: string }) => void,
        ) => () => void;
        /** Fires once the AFDA worker has finished loading its database. */
        ready: (cb: () => void) => () => void;
      };

      // Mapper
      mapper: {
        run: (payload: unknown) => Promise<unknown>;
      };

      // Batch
      batch: {
        start: (payload: unknown) => Promise<unknown>;
        cancel: () => Promise<unknown>;
        getStatus: () => Promise<unknown>;
      };

      // Websites
      websites: {
        save: (payload: unknown) => Promise<unknown>;
        delete: (id: number) => Promise<unknown>;
        update: (payload: unknown) => Promise<unknown>;
        /**
         * Existing URLs are skipped (reported in `skipped`), never disabled or moved.
         * So are URLs that aren't absolute http(s) on the website's domain or a
         * subdomain (`invalid_url`) and items whose name isn't a string (`invalid_name`).
         */
        addSections: (payload: {
          website_id: number;
          sections: Array<{ section_url: string; section_path: string; name?: string | null }>;
        }) => Promise<
          | {
              ok: true;
              website: Website;
              added: number[];
              skipped: Array<
                | {
                    section_url: string;
                    reason: 'already_exists' | 'belongs_to_other_website';
                    section_id: number;
                    website_id: number;
                  }
                | { section_url: string; reason: 'invalid_url' | 'invalid_name' }
              >;
            }
          | AfdaError<'website_not_found'>
        >;
        resetInitialScrape: (id: number) => Promise<unknown>;
        /** Same schedule for every section of the website, in one update. Times are host-local. */
        setSchedule: (payload: { website_id: number; config: ScheduleConfig; follow_manual?: boolean }) => Promise<
          | { ok: true; updated: number; website: Website }
          | AfdaError<'website_not_found'>
          | AfdaInvalidSchedule
        >;
        /** Starts a background re-map; the result arrives via on.websiteRemapComplete / on.websiteRemapError. */
        remap: (payload: { website_id: number }) => Promise<
          | { ok: true; status: 'started'; website_id: number }
          | AfdaError<'website_not_found' | 'already_running'>
        >;
      };

      // Schedule
      schedule: {
        assign: (payload: unknown) => Promise<unknown>;
        pause: (id: number) => Promise<unknown>;
        resume: (id: number) => Promise<unknown>;
        get: (id: number) => Promise<unknown>;
      };

      // Scrape
      scrape: {
        runNow: (payload: unknown) => Promise<unknown>;
        jobStatus: (id: number) => Promise<unknown>;
        listJobs: (payload?: unknown) => Promise<unknown>;
        jobSize: (id: number) => Promise<unknown>;
        jobArticles: (payload: unknown) => Promise<unknown>;
      };

      // Articles
      articles: {
        list: (payload?: unknown) => Promise<unknown>;
        get: (id: number) => Promise<unknown>;
        reparse: (id: number) => Promise<unknown>;
        distinctFqdns: () => Promise<unknown>;
        distinctSectionPaths: (fqdn: string) => Promise<unknown>;
        listFiltered: (payload: unknown) => Promise<unknown>;
        countFiltered: (payload: unknown) => Promise<unknown>;
        export: (payload: unknown) => Promise<unknown>;
      };

      // Manual Articles
      manualArticles: {
        parse: (payload: unknown) => Promise<unknown>;
        list: (payload?: unknown) => Promise<unknown>;
        count: (payload?: unknown) => Promise<unknown>;
        get: (id: number) => Promise<unknown>;
        delete: (id: number) => Promise<unknown>;
        reparse: (id: number) => Promise<unknown>;
      };

      // Analytics
      analytics: {
        getWebsite: (payload: unknown) => Promise<unknown>;
        runSection: (payload: unknown) => Promise<unknown>;
      };

      // Sections
      sections: {
        /** `deleted` counts the ids sent, not rows actually removed. Cascades to articles. */
        delete: (payload: { section_ids: number[] }) => Promise<{ ok: boolean; deleted: number }>;
        add: (payload: { website_id: number; path: string; name?: string | null }) => Promise<
          | { ok: true; section_id: number; website: Website }
          | AfdaError<'website_not_found' | 'invalid_path' | 'invalid_name'>
          | AfdaDuplicate
        >;
        /**
         * `name` is required ('' resets to the path-derived name); `path` is optional.
         * A path change is refused with `scrape_running` while that section is being scraped.
         */
        update: (payload: { section_id: number; name: string; path?: string }) => Promise<
          | { ok: true; website: Website }
          | AfdaError<'section_not_found' | 'invalid_name' | 'invalid_path' | 'scrape_running'>
          | AfdaDuplicate
        >;
        setMaxArticles: (payload: { section_id: number; max_articles_per_run: number | null }) => Promise<{ ok: boolean }>;
        /**
         * One section's schedule. `custom` times are "HH:MM" in the host's local time.
         * `preset` configs are rejected (invalid_schedule); `manual` never runs on its own.
         */
        updateSchedule: (payload: { section_id: number; config: ScheduleConfig; follow_manual: boolean }) => Promise<
          | { ok: true; next_run_at: string }
          | AfdaError<'section_not_found'>
          | AfdaInvalidSchedule
        >;
      };

      // Store
      store: {
        getAll: () => Promise<unknown>;
      };

      // Settings
      settings: {
        get: () => Promise<unknown>;
        set: (payload: unknown) => Promise<unknown>;
        updateLoadControl: (payload: unknown) => Promise<unknown>;
      };

      // Shell
      shell: {
        openPath: (path: string) => Promise<unknown>;
      };

      // Memory Monitor
      memory: {
        start: () => Promise<unknown>;
        stop: () => Promise<unknown>;
        export: () => Promise<unknown>;
      };

      // Auth
      auth: {
        openLogin: () => Promise<unknown>;
        getStatus: () => Promise<unknown>;
        clear: () => Promise<unknown>;
      };

      // Social sources (X / Reddit / Facebook / YouTube) — v1.3.0+
      social: {
        detectPlatform: (payload: { url: string }) => Promise<{ platform: string }>;
        scrape: (payload: { url: string; platform?: string; account?: string; useNitter?: boolean }) => Promise<unknown>;
        sources: {
          list: () => Promise<unknown>;
          get: (payload: { id: number }) => Promise<unknown>;
          add: (payload: { url: string; label?: string; account?: string | null; platform?: string }) => Promise<unknown>;
          update: (payload: { id: number; label?: string; account?: string | null }) => Promise<unknown>;
          delete: (payload: { id: number }) => Promise<unknown>;
          scrapeNow: (payload: { id: number }) => Promise<unknown>;
        };
        posts: {
          list: (payload: { id: number; limit?: number; offset?: number }) => Promise<unknown>;
        };
        schedule: {
          assign: (payload: { id: number; config: unknown }) => Promise<unknown>;
          pause: (payload: { id: number }) => Promise<unknown>;
          resume: (payload: { id: number }) => Promise<unknown>;
        };
      };
    };
  }
}
