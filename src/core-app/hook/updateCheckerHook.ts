/**
 * Update service
 * Handles application update checking logic
 */

import { app } from 'electron';
import semver from 'semver';
import { fetchReleases, type GitHubRelease } from '../../github/githubService';

// Rate limiting for GitHub API calls
const GITHUB_API_COOLDOWN = 5 * 60 * 1000; // 5 minutes between API calls
let lastGitHubApiCall = 0;
let cachedUpdateInfo: { updateInfo: UpdateInfo; timestamp: number } | null =
  null;
const UPDATE_CACHE_DURATION = 30 * 60 * 1000; // Cache for 30 minutes

export interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion?: string;
  currentVersion: string;
  currentChannel: string | null;
  releaseUrl?: string;
  releaseNotes?: string;
  downloadUrl?: string;
  publishedAt?: Date;
  message?: string;
  error?: string;
  fromCache?: boolean;
}

/**
 * Helper function to check if we can make a GitHub API call
 */
function canMakeGitHubApiCall(): boolean {
  const now = Date.now();
  return now - lastGitHubApiCall >= GITHUB_API_COOLDOWN;
}

/**
 * Helper function to get cached update info if still valid
 */
function getCachedUpdateInfo(): UpdateInfo | null {
  if (!cachedUpdateInfo) return null;

  const now = Date.now();
  const isExpired = now - cachedUpdateInfo.timestamp > UPDATE_CACHE_DURATION;

  return isExpired ? null : cachedUpdateInfo.updateInfo;
}

/**
 * Helper function to extract version channel (exp, stable, etc.)
 */
function getVersionChannel(version: string): string | null {
  const cleanVersion = version.replace(/^v/, '');
  const match = cleanVersion.match(/-(.+)$/);
  return match ? match[1] : null;
}

/**
 * Helper function to filter releases by channel
 */
function filterReleasesByChannel(
  releases: GitHubRelease[],
  targetChannel: string | null,
): GitHubRelease[] {
  return releases.filter((release) => {
    const releaseChannel = getVersionChannel(release.tag_name);

    // If target channel is null (no channel), only include releases without channels
    if (targetChannel === null) {
      return releaseChannel === null;
    }

    // Match the specific channel
    return releaseChannel === targetChannel;
  });
}

/**
 * Checks for application updates from GitHub
 */
export async function checkForUpdates(): Promise<UpdateInfo> {
  try {
    // Check if we have cached update info first
    const cachedInfo = getCachedUpdateInfo();
    if (cachedInfo) {
      console.log('Using cached update info');
      return { ...cachedInfo, fromCache: true };
    }

    // Check rate limiting
    if (!canMakeGitHubApiCall()) {
      const remainingTime = Math.ceil(
        (GITHUB_API_COOLDOWN - (Date.now() - lastGitHubApiCall)) / 1000,
      );
      return {
        hasUpdate: false,
        currentVersion: app.getVersion(),
        currentChannel: getVersionChannel(app.getVersion()),
        error: `Rate limited. Please wait ${remainingTime} seconds before checking again.`,
      };
    }

    // Get current app version (from package.json)
    const currentVersion = app.getVersion();
    const currentChannel = getVersionChannel(currentVersion);

    // Make the API call
    lastGitHubApiCall = Date.now();

    // Fetch releases from GitHub API
    const releases = await fetchReleases('Talisik', 'Downlodr');

    // Filter releases by current version channel
    const channelReleases = filterReleasesByChannel(releases, currentChannel);

    // Get the latest release from the filtered channel releases
    const latestRelease = channelReleases[0];

    if (!latestRelease) {
      const updateInfo: UpdateInfo = {
        hasUpdate: false,
        currentVersion,
        currentChannel,
        message: `No releases found for channel: ${currentChannel || 'stable'}`,
      };

      // Cache the result
      cachedUpdateInfo = {
        updateInfo,
        timestamp: Date.now(),
      };

      return updateInfo;
    }

    // Clean the version string (remove 'v' prefix if it exists)
    const latestVersion = latestRelease.tag_name.replace(/^v/, '');

    // Compare versions using semver
    const hasUpdate = semver.gt(latestVersion, currentVersion);

    const updateInfo: UpdateInfo = {
      hasUpdate,
      latestVersion,
      currentVersion,
      currentChannel,
      releaseUrl: latestRelease.html_url,
      releaseNotes: latestRelease.body,
      downloadUrl:
        latestRelease.assets[0]?.browser_download_url || latestRelease.html_url,
      publishedAt: new Date(latestRelease.published_at),
    };

    // Cache the result
    cachedUpdateInfo = {
      updateInfo,
      timestamp: Date.now(),
    };

    return updateInfo;
  } catch (error: any) {
    console.error('Error checking for updates:', error);

    // Check if it's a rate limit error
    if (error.response && error.response.status === 403) {
      return {
        hasUpdate: false,
        currentVersion: app.getVersion(),
        currentChannel: getVersionChannel(app.getVersion()),
        error:
          'GitHub API rate limit exceeded. Please wait an hour before trying again.',
      };
    }

    // Check for network-related errors
    if (
      error.code === 'ENOTFOUND' ||
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNRESET' ||
      error.message?.includes('timeout') ||
      error.message?.includes('Network Error')
    ) {
      return {
        hasUpdate: false,
        currentVersion: app.getVersion(),
        currentChannel: getVersionChannel(app.getVersion()),
        error:
          'Unable to connect to update server. Please check your internet connection.',
      };
    }

    // Generic error
    return {
      hasUpdate: false,
      currentVersion: app.getVersion(),
      currentChannel: getVersionChannel(app.getVersion()),
      error: 'Failed to check for updates. Please try again later.',
    };
  }
}
