import {
  FetchResult,
  GitHubAsset,
  GitHubRelease,
  ParsedPluginSection,
  PluginData,
} from '../plugins/types';

const sampleSvgIcon =
  '<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" fill="red" /></svg>';

// GitHub release configuration for your specific release
const PLUGIN_RELEASE_CONFIG = {
  owner: 'Talisik',
  repo: 'Downlodr',
  tag: 'plugin-release', // Change to 'plugin-release-v2' if you create a new release
};

// Static fallback data - used if GitHub API fails
const fallbackPluginsData = [
  {
    id: 'cc-to-markdown-downlodr',
    name: 'CC to Markdown',
    version: '1.0.1',
    description: 'Convert video captions into markdown documents.',
    author: 'Downlodr',
    icon: sampleSvgIcon, // Store raw SVG string like installed plugins
    downloads: '12.1k',
    size: '8.4 MB',
    repoLink: 'https://github.com/Talisik/downlodr-cc-markdown-plugin',
    downlodrLink: 'https://downlodr.com/plugin/cc-to-markdown/',
  },
  {
    id: 'format-converter-downlodr',
    name: 'Format Converter',
    version: '1.0.1',
    description:
      'Converts videos to different formats using customizable quality and settings.',
    author: 'Downlodr',
    icon: sampleSvgIcon, // Store raw SVG string like installed plugins
    downloads: '12.1k',
    size: '120.7 KB',
    repoLink: 'https://github.com/Talisik/downlodr-converter-plugin',
    downlodrLink: 'https://downlodr.com/plugin/related-content-finder/',
  },
  {
    id: 'metadata-exporter-downlodr',
    name: 'Metadata Exporter',
    version: '1.0.1',
    description:
      'View and edit video metadata with powerful batch processing tools.',
    author: 'Downlodr',
    icon: sampleSvgIcon, // Store raw SVG string like installed plugins
    downloads: '12.1k',
    size: '280.7 KB',
    repoLink: 'https://github.com/Talisik/downlodr-metadata-plugin',
    downlodrLink: 'https://downlodr.com/plugin/topic-research/',
  },
  {
    id: 'fall-back-plugin',
    name: 'Fall Back Plugin',
    version: '1.0.1',
    description:
      'View and edit video metadata with powerful batch processing tools.',
    author: 'Downlodr',
    icon: sampleSvgIcon, // Store raw SVG string like installed plugins
    downloads: '12.1k',
    size: '280.7 KB',
    repoLink: 'https://github.com/Talisik/downlodr-metadata-plugin',
    downlodrLink: 'https://downlodr.com/plugin/topic-research/',
  },
];

// Cache management
const CACHE_KEY = 'downlodr-plugins-cache';
const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

interface CacheData {
  data: PluginData[];
  timestamp: number;
  source: 'github' | 'fallback';
}

/**
 * Get cached plugin data if it's still valid
 */
function getCachedData(): PluginData[] | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    const parsedCache: CacheData = JSON.parse(cached);
    const isExpired = Date.now() - parsedCache.timestamp > CACHE_DURATION;

    if (isExpired) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return parsedCache.data;
  } catch (error) {
    console.warn('Failed to read plugin cache:', error);
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

/**
 * Cache plugin data
 */
function setCachedData(
  data: PluginData[],
  source: 'github' | 'fallback',
): void {
  try {
    const cacheData: CacheData = {
      data,
      timestamp: Date.now(),
      source,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Failed to cache plugin data:', error);
  }
}

/**
 * Parse plugin data directly from GitHub release
 */
function parsePluginDataFromRelease(releaseData: GitHubRelease): PluginData[] {
  const plugins: PluginData[] = [];

  // Extract basic info from release
  const releaseName = releaseData.name || releaseData.tag_name || 'Unknown';
  const releaseBody = releaseData.body || '';
  const releaseVersion = releaseData.tag_name || '1.0.0';
  const releaseAuthor = releaseData.author?.login || 'Downlodr';
  const publishedAt = releaseData.published_at;

  // Parse release body for plugin information
  // Look for plugin entries in the release description
  const pluginSections = parseReleaseBodyForPlugins(releaseBody);

  if (pluginSections.length > 0) {
    // If we found structured plugin data in the release body
    pluginSections.forEach((section, index) => {
      const plugin: PluginData = {
        id: section.id || `plugin-${index + 1}`,
        name: section.name || `Plugin ${index + 1}`,
        version: section.version || releaseVersion,
        description: section.description || 'No description available',
        author: section.author || releaseAuthor,
        icon: sampleSvgIcon, // Store raw SVG string like installed plugins
        downloads: section.downloads || calculateDownloads(releaseData.assets),
        size: section.size || calculateTotalSize(releaseData.assets),
        repoLink:
          section.repoLink ||
          `https://github.com/${PLUGIN_RELEASE_CONFIG.owner}/${PLUGIN_RELEASE_CONFIG.repo}`,
        downlodrLink:
          section.downlodrLink ||
          `https://downlodr.com/plugin/${section.id || `plugin-${index + 1}`}/`,
        lastUpdated: publishedAt,
      };
      plugins.push(plugin);
    });
  } else {
    // Fallback: Create plugins based on release assets
    releaseData.assets?.forEach((asset: GitHubAsset, index: number) => {
      const assetName = formatAssetName(asset.name);
      const plugin: PluginData = {
        id: asset.name.replace(/\.[^/.]+$/, '') || `plugin-${index + 1}`, // Remove file extension
        name: assetName,
        version: releaseVersion,
        description: `Plugin from ${releaseName}`,
        author: releaseAuthor,
        icon: sampleSvgIcon, // Store raw SVG string like installed plugins
        downloads: asset.download_count?.toString() || '0',
        size: formatFileSize(asset.size || 0),
        repoLink: `https://github.com/${PLUGIN_RELEASE_CONFIG.owner}/${PLUGIN_RELEASE_CONFIG.repo}`,
        downlodrLink: asset.browser_download_url,
        lastUpdated: publishedAt,
      };
      plugins.push(plugin);
    });
  }

  return plugins.length > 0 ? plugins : fallbackPluginsData;
}

/**
 * Parse release body for structured plugin information
 */
function parseReleaseBodyForPlugins(body: string): ParsedPluginSection[] {
  const plugins: ParsedPluginSection[] = [];

  // Look for plugin sections marked with specific patterns
  // Example formats:
  // ## Plugin Name
  // **Description**: Plugin description here
  // **Version**: 1.0.0
  // **Size**: 8MB

  const pluginRegex = /##\s+([^\n]+)\n(.*?)(?=##|\n$)/gs;
  let match;

  console.log('=== Parsing Release Body ===');
  console.log('Body to parse:', body);
  console.log('Using regex:', pluginRegex);

  while ((match = pluginRegex.exec(body)) !== null) {
    const [, name, content] = match;
    console.log('Found plugin match:', {
      name: name.trim(),
      content: content.trim(),
    });

    const plugin: ParsedPluginSection = {
      name: name.trim(),
      id: name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, ''),
    };

    // Extract details from content
    const extractDetail = (key: string) => {
      const regex = new RegExp(`\\*\\*${key}\\*\\*:?\\s*([^\n]+)`, 'i');
      const match = content.match(regex);
      return match ? match[1].trim() : null;
    };

    plugin.description = extractDetail('Description') || extractDetail('Desc');
    plugin.version = extractDetail('Version') || extractDetail('Ver');
    plugin.size = extractDetail('Size');
    plugin.downloads = extractDetail('Downloads');
    plugin.author = extractDetail('Author');
    plugin.repoLink = extractDetail('Repository') || extractDetail('Repo');
    plugin.downlodrLink = extractDetail('Download') || extractDetail('Link');

    plugins.push(plugin);
  }

  return plugins;
}

/**
 * Format asset name for display
 */
function formatAssetName(fileName: string): string {
  return fileName
    .replace(/\.[^/.]+$/, '') // Remove extension
    .replace(/[-_]/g, ' ') // Replace dashes and underscores with spaces
    .replace(/\b\w/g, (l) => l.toUpperCase()); // Capitalize first letter of each word
}

/**
 * Calculate total downloads from assets
 */
function calculateDownloads(assets: GitHubAsset[]): string {
  if (!assets || assets.length === 0) return '0';

  const totalDownloads = assets.reduce(
    (total, asset) => total + (asset.download_count || 0),
    0,
  );

  if (totalDownloads >= 1000000) {
    return `${(totalDownloads / 1000000).toFixed(1)}M`;
  } else if (totalDownloads >= 1000) {
    return `${(totalDownloads / 1000).toFixed(1)}k`;
  }

  return totalDownloads.toString();
}

/**
 * Calculate total size of assets
 */
function calculateTotalSize(assets: GitHubAsset[]): string {
  if (!assets || assets.length === 0) return '0 B';

  const totalBytes = assets.reduce(
    (total, asset) => total + (asset.size || 0),
    0,
  );
  return formatFileSize(totalBytes);
}

/**
 * Format file size in human readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Fetch plugin data from GitHub release
 */
async function fetchFromGitHubRelease(): Promise<PluginData[]> {
  const { owner, repo, tag } = PLUGIN_RELEASE_CONFIG;
  const url = `https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `GitHub API error: ${response.status} ${response.statusText}`,
      );
    }

    const releaseData: GitHubRelease = await response.json();

    // Parse plugin data directly from the release
    const pluginsData = parsePluginDataFromRelease(releaseData);

    console.log('Parsed plugins from GitHub release:', pluginsData);
    return pluginsData;
  } catch (error) {
    console.error('Failed to fetch plugins from GitHub release:', error);
    throw error;
  }
}

/**
 * Main function to get plugin data with fallback logic
 */
export async function getBrowsePluginsData(): Promise<FetchResult> {
  // First, try to get cached data
  const cachedData = getCachedData();
  if (cachedData) {
    return {
      success: true,
      data: cachedData,
      source: 'github',
      lastFetched: new Date(),
    };
  }

  // Try to fetch from GitHub release
  try {
    const githubData = await fetchFromGitHubRelease();
    setCachedData(githubData, 'github');

    return {
      success: true,
      data: githubData,
      source: 'github',
      lastFetched: new Date(),
    };
  } catch (githubError) {
    console.warn('GitHub fetch failed, using fallback data:', githubError);

    // Use fallback data and cache it
    setCachedData(fallbackPluginsData, 'fallback');

    return {
      success: true,
      data: fallbackPluginsData,
      source: 'fallback',
      error:
        githubError instanceof Error ? githubError.message : 'Unknown error',
      lastFetched: new Date(),
    };
  }
}

/**
 * Force refresh from GitHub (bypasses cache)
 */
export async function refreshPluginData(): Promise<FetchResult> {
  // Clear cache first
  localStorage.removeItem(CACHE_KEY);

  // Fetch fresh data
  return getBrowsePluginsData();
}

/**
 * Synchronous function for immediate access (uses cache or fallback)
 * This maintains compatibility with existing code
 */
function getBrowsePluginsSync(): PluginData[] {
  const cachedData = getCachedData();
  if (cachedData) {
    return cachedData;
  }

  // Return fallback data that stores raw SVG strings
  return fallbackPluginsData.map((plugin) => ({
    ...plugin,
    icon: sampleSvgIcon, // Ensure it's a raw SVG string, not JSX
  }));
}

// Default export for backward compatibility
const browsePluginsLang = getBrowsePluginsSync();

export default browsePluginsLang;

// Export types and functions
export type { FetchResult, PluginData };
// eslint-disable-next-line prettier/prettier

