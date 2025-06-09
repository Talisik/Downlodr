import axios from 'axios';
import { app } from 'electron';
import semver from 'semver';

// Interface for GitHub release response
interface GitHubRelease {
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

// Helper function to extract version channel (exp, stable, etc.)
function getVersionChannel(version: string): string | null {
  const cleanVersion = version.replace(/^v/, '');
  const match = cleanVersion.match(/-(.+)$/);
  return match ? match[1] : null;
}

// Helper function to filter releases by channel
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

export async function checkForUpdates() {
  try {
    // Get current app version (from package.json)
    const currentVersion = app.getVersion();
    const currentChannel = getVersionChannel(currentVersion);

    // Fetch releases from GitHub API (update with your actual repo)
    const response = await axios.get<GitHubRelease[]>(
      'https://api.github.com/repos/Talisik/Downlodr/releases',
    );

    // Filter releases by current version channel
    const channelReleases = filterReleasesByChannel(
      response.data,
      currentChannel,
    );

    // Get the latest release from the filtered channel releases
    const latestRelease = channelReleases[0];

    if (!latestRelease) {
      return {
        hasUpdate: false,
        currentVersion,
        currentChannel,
        message: `No releases found for channel: ${currentChannel || 'stable'}`,
      };
    }

    // Clean the version string (remove 'v' prefix if it exists)
    const latestVersion = latestRelease.tag_name.replace(/^v/, '');

    // Compare versions using semver
    const hasUpdate = semver.gt(latestVersion, currentVersion);

    return {
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
  } catch (error) {
    console.error('Error checking for updates:', error);
    return {
      hasUpdate: false,
      currentVersion: app.getVersion(),
      currentChannel: getVersionChannel(app.getVersion()),
      error,
    };
  }
}
