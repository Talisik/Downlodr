/**
 * Schema for website-level metadata returned by the AFDA adapter.
 * Used by afdaWebsiteService.ts and stored on AfdaSubscription.section_details.
 */
export interface AfdaWebsiteInfo {
  websiteName: string;
  websiteUrl: string;
  articleCount: number;
  sectionCount: number;
  site: string;
}
