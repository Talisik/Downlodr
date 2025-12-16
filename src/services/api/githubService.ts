/**
 * GitHub API service
 * Handles all interactions with the GitHub API
 */

import { GET } from './httpClient';

// Interface for GitHub release response
export interface GitHubRelease {
  tag_name: string;
  name: string;
  html_url: string;
  body: string;
  assets: {
    browser_download_url: string;
    name: string;
  }[];
  published_at: string;
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
