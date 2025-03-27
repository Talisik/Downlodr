import { app } from 'electron';
import axios from 'axios';
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

export async function checkForUpdates() {
  try {
    // Get current app version (from package.json)
    const currentVersion = app.getVersion();

    // Fetch releases from GitHub API (update with your actual repo)
    const response = await axios.get<GitHubRelease[]>(
      'https://api.github.com/repos/Talisik/Downlodr/releases',
    );

    // Get the latest release
    const latestRelease = response.data[0];

    if (!latestRelease) {
      return { hasUpdate: false, currentVersion };
    }

    // Clean the version string (remove 'v' prefix if it exists)
    const latestVersion = latestRelease.tag_name.replace(/^v/, '');

    // Compare versions using semver
    const hasUpdate = semver.gt(latestVersion, currentVersion);

    return {
      hasUpdate,
      latestVersion,
      currentVersion,
      releaseUrl: latestRelease.html_url,
      releaseNotes: latestRelease.body,
      downloadUrl:
        latestRelease.assets[0]?.browser_download_url || latestRelease.html_url,
      publishedAt: new Date(latestRelease.published_at),
    };
  } catch (error) {
    console.error('Error checking for updates:', error);
    return { hasUpdate: false, currentVersion: app.getVersion(), error };
  }
}
