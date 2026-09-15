/* Handler for github operations of base app such as getting latest version, checking and updating, downloading, etc. */
/* Handler for window behavior of base app such as closing, minimizing, maximizing, etc. */

/**
 * Handles the behavior of the base app such as closing, minimizing, maximizing, etc.
 * @param mainWindow - The main window of the base app
 * @returns void
 */
const GITHUB_API_COOLDOWN = 5 * 60 * 1000; // 5 minutes between API calls
let lastGitHubApiCall = 0;
let cachedLatestVersion: { version: string; timestamp: number } | null = null;
const VERSION_CACHE_DURATION = 30 * 60 * 1000; // Cache for 30 minutes
export function canMakeGitHubApiCall(): boolean {
  const now = Date.now();
  return now - lastGitHubApiCall >= GITHUB_API_COOLDOWN;
}

export function markGitHubApiCall(): void {
  lastGitHubApiCall = Date.now();
}

export function getGitHubApiCooldownRemainingSeconds(): number {
  if (canMakeGitHubApiCall()) {
    return 0;
  }
  return Math.ceil(
    (GITHUB_API_COOLDOWN - (Date.now() - lastGitHubApiCall)) / 1000,
  );
}

// Helper function to get cached version if still valid
export function getCachedVersion(): string | null {
  if (!cachedLatestVersion) return null;

  const now = Date.now();
  const isExpired =
    now - cachedLatestVersion.timestamp > VERSION_CACHE_DURATION;

  return isExpired ? null : cachedLatestVersion.version;
}

export function setCachedVersion(version: string): void {
  cachedLatestVersion = {
    version,
    timestamp: Date.now(),
  };
}

export const githubHandler = () => {
  // hello
};
