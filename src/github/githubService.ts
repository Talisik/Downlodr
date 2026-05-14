/**
 * GitHub API service
 * Handles all interactions with the GitHub API
 */

import { GET } from '../core-app/client/httpClient';

// Interface for GitHub release response
export interface GitHubRelease {
  html_url?: string;
  tag_name?: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    content_type: string;
    size: number;
  }>;
  published_at: string;
  body: string;
}
/**
 * Fetches releases from a GitHub repository
 */
export async function fetchReleases(
  owner: string,
  repo: string,
): Promise<GitHubRelease[]> {
  const response = await GET<GitHubRelease[]>(
    `https://api.github.com/repos/${owner}/${repo}/releases`,
    {
      timeout: 10000, // 10 second timeout
    },
  );
  return response.data;
}

/**
 * Fetches the latest release from a GitHub repository
 */
export async function fetchLatestRelease(
  owner: string,
  repo: string,
): Promise<GitHubRelease> {
  const response = await GET<GitHubRelease>(
    `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
    {
      timeout: 10000,
    },
  );
  return response.data;
}
