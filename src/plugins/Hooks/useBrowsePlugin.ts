import { toast } from '@/Components/SubComponents/shadcn/hooks/use-toast';
import { useCallback, useState } from 'react';
import { PluginInfo } from '../types';

interface GitHubRelease {
  tag_name: string;
  assets: Array<{
    name: string;
    browser_download_url: string;
    content_type: string;
    size: number;
  }>;
  published_at: string;
  body: string;
}

interface InstallationProgress {
  pluginId: string;
  status: 'downloading' | 'extracting' | 'installing' | 'complete' | 'error';
  progress: number;
  message: string;
}

export const useBrowsePlugin = () => {
  const [installations, setInstallations] = useState<
    Map<string, InstallationProgress>
  >(new Map());

  /**
   * Extract GitHub repo info from URL
   */
  const parseGitHubUrl = (repoUrl: string) => {
    const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) throw new Error('Invalid GitHub URL');
    return { owner: match[1], repo: match[2] };
  };

  /**
   * Fetch latest release from GitHub
   */
  const fetchLatestRelease = useCallback(
    async (repoUrl: string): Promise<GitHubRelease> => {
      const { owner, repo } = parseGitHubUrl(repoUrl);

      try {
        const response = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/releases/latest`,
        );

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('No releases found for this repository');
          }
          throw new Error(`GitHub API error: ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        console.error('Failed to fetch release:', error);
        throw error;
      }
    },
    [],
  );

  /**
   * Download plugin zip file
   */
  const downloadPluginZip = useCallback(
    async (
      downloadUrl: string,
      pluginId: string,
      onProgress?: (progress: number) => void,
    ): Promise<string> => {
      try {
        console.log(`Downloading plugin zip from: ${downloadUrl}`);

        // Get download folder as temporary location
        const downloadFolder =
          await window.downlodrFunctions.getDownloadFolder();
        const zipPath = await window.downlodrFunctions.joinDownloadPath(
          downloadFolder,
          `${pluginId}-${Date.now()}.zip`,
        );

        console.log(`Downloading to path: ${zipPath}`);

        // Download the file using Electron's download functionality (now with redirect support)
        const result = await window.downlodrFunctions.downloadFile(
          downloadUrl,
          zipPath,
        );

        if (!result.success) {
          throw new Error(result.error || 'Download failed');
        }

        console.log(`Download completed successfully: ${result.path}`);

        // Verify the file exists and has content
        const fileExists = await window.downlodrFunctions.fileExists(zipPath);
        if (!fileExists) {
          throw new Error('Downloaded file does not exist');
        }

        const fileSize = await window.downlodrFunctions.getFileSize(zipPath);
        console.log(`Downloaded file size: ${fileSize} bytes`);

        if (!fileSize || fileSize < 100) {
          throw new Error(
            `Downloaded file is too small (${fileSize} bytes) - likely not a valid zip file`,
          );
        }

        // Simulate progress (since downloadFile doesn't provide progress)
        if (onProgress) {
          onProgress(100);
        }

        return zipPath;
      } catch (error) {
        console.error('Download failed:', error);
        throw error;
      }
    },
    [],
  );

  /**
   * Extract and install plugin
   */
  const extractAndInstall = useCallback(
    async (
      zipPath: string,
      pluginId: string,
      onProgress?: (status: string) => void,
    ): Promise<boolean> => {
      try {
        onProgress?.('Extracting plugin files...');

        // Get the downloads folder as temporary extraction location
        const downloadFolder =
          await window.downlodrFunctions.getDownloadFolder();
        const tempExtractPath = await window.downlodrFunctions.joinDownloadPath(
          downloadFolder,
          'temp-plugin-extraction',
        );

        // Import extractPlugin function and extract the zip
        // Note: We'll need to expose this via IPC since it runs in main process
        const extractedPluginPath = await window.plugins.extractPlugin(
          zipPath,
          tempExtractPath,
        );

        if (!extractedPluginPath) {
          throw new Error(
            'Failed to extract plugin - no valid plugin structure found',
          );
        }

        onProgress?.('Installing plugin...');

        // Install the extracted plugin using the existing install method
        const installResult = await window.plugins.install(extractedPluginPath);

        if (installResult === true) {
          onProgress?.('Plugin installed successfully!');

          // Clean up: remove the temporary extracted files
          try {
            await window.downlodrFunctions.deleteFile(tempExtractPath);
          } catch (cleanupError) {
            console.warn(
              'Failed to clean up temporary extraction folder:',
              cleanupError,
            );
          }

          // Clean up: remove the downloaded zip file
          try {
            await window.downlodrFunctions.deleteFile(zipPath);
          } catch (cleanupError) {
            console.warn(
              'Failed to clean up downloaded zip file:',
              cleanupError,
            );
          }

          return true;
        } else if (installResult === 'already-installed') {
          // Clean up temporary files
          try {
            await window.downlodrFunctions.deleteFile(tempExtractPath);
            await window.downlodrFunctions.deleteFile(zipPath);
          } catch (cleanupError) {
            console.warn('Failed to clean up temporary files:', cleanupError);
          }

          throw new Error('Plugin is already installed');
        } else {
          throw new Error(
            'Plugin installation failed - invalid plugin structure',
          );
        }
      } catch (error) {
        console.error('Installation failed:', error);
        throw error;
      }
    },
    [],
  );

  /**
   * Install plugin from GitHub release
   */
  const installPlugin = useCallback(
    async (plugin: PluginInfo): Promise<boolean> => {
      const pluginId = plugin.id;

      try {
        // Update installation status
        setInstallations(
          (prev) =>
            new Map(
              prev.set(pluginId, {
                pluginId,
                status: 'downloading',
                progress: 0,
                message: 'Fetching latest release info...',
              }),
            ),
        );

        // Get latest release
        const release = await fetchLatestRelease(plugin.repoLink);
        console.log(release);
        // Find zip asset - be more flexible with content type detection
        const zipAsset = release.assets.find((asset) => {
          const isZipByName = asset.name.endsWith('.zip');
          const isZipByContentType =
            asset.content_type?.includes('zip') ||
            asset.content_type === 'application/octet-stream' ||
            asset.content_type === 'application/x-zip-compressed';

          // Log asset details for debugging
          console.log('Asset details:', {
            name: asset.name,
            content_type: asset.content_type,
            size: asset.size,
            isZipByName,
            isZipByContentType,
          });

          return isZipByName; // Primarily rely on file extension
        });

        if (!zipAsset) {
          // Enhanced error message with more details
          const availableAssets = release.assets.map((asset) => ({
            name: asset.name,
            content_type: asset.content_type,
            size: asset.size,
          }));

          console.error('Available assets:', availableAssets);
          throw new Error(
            `No zip file found in release assets. Available files: ${release.assets
              .map((a) => a.name)
              .join(', ')}`,
          );
        }

        // Update progress
        setInstallations(
          (prev) =>
            new Map(
              prev.set(pluginId, {
                pluginId,
                status: 'downloading',
                progress: 5,
                message: `Downloading ${zipAsset.name} (${(
                  zipAsset.size /
                  1024 /
                  1024
                ).toFixed(2)} MB)...`,
              }),
            ),
        );

        // Download the zip file
        const zipPath = await downloadPluginZip(
          zipAsset.browser_download_url,
          pluginId,
          (progress) => {
            setInstallations(
              (prev) =>
                new Map(
                  prev.set(pluginId, {
                    pluginId,
                    status: 'downloading',
                    progress: Math.min(50, Math.round(progress * 0.5)), // First 50% for download
                    message: `Downloading ${
                      zipAsset.name
                    }... ${progress.toFixed(1)}%`,
                  }),
                ),
            );
          },
        );

        // Update status to extracting
        setInstallations(
          (prev) =>
            new Map(
              prev.set(pluginId, {
                pluginId,
                status: 'extracting',
                progress: 50,
                message: 'Download complete. Extracting plugin files...',
              }),
            ),
        );

        // Extract and install
        const success = await extractAndInstall(
          zipPath,
          pluginId,
          (message) => {
            setInstallations(
              (prev) =>
                new Map(
                  prev.set(pluginId, {
                    pluginId,
                    status: 'installing',
                    progress: 75,
                    message,
                  }),
                ),
            );
          },
        );

        if (success) {
          setInstallations(
            (prev) =>
              new Map(
                prev.set(pluginId, {
                  pluginId,
                  status: 'complete',
                  progress: 100,
                  message: `${plugin.name} installed successfully! Plugin is ready to use.`,
                }),
              ),
          );

          toast({
            title: 'Installation Complete',
            description: `${plugin.name} has been installed and is ready to use`,
            variant: 'success',
            duration: 4000,
          });

          // Clean up after a delay
          setTimeout(() => {
            setInstallations((prev) => {
              const newMap = new Map(prev);
              newMap.delete(pluginId);
              return newMap;
            });
          }, 4000);

          return true;
        }

        // If not successful, show downloaded location
        toast({
          title: 'Installation Incomplete',
          description: `Plugin download completed but requires manual installation. Check your downloads folder.`,
          variant: 'default',
          duration: 6000,
        });

        setInstallations(
          (prev) =>
            new Map(
              prev.set(pluginId, {
                pluginId,
                status: 'complete',
                progress: 100,
                message: 'Download complete - manual installation required',
              }),
            ),
        );

        // Clean up after a delay
        setTimeout(() => {
          setInstallations((prev) => {
            const newMap = new Map(prev);
            newMap.delete(pluginId);
            return newMap;
          });
        }, 5000);

        return false;
      } catch (error) {
        console.error(`Installation failed for ${plugin.name}:`, error);

        setInstallations(
          (prev) =>
            new Map(
              prev.set(pluginId, {
                pluginId,
                status: 'error',
                progress: 0,
                message:
                  error instanceof Error
                    ? error.message
                    : 'Installation failed',
              }),
            ),
        );

        toast({
          title: 'Installation Failed',
          description:
            error instanceof Error ? error.message : 'Unknown error occurred',
          variant: 'destructive',
          duration: 5000,
        });

        // Clean up error state after delay
        setTimeout(() => {
          setInstallations((prev) => {
            const newMap = new Map(prev);
            newMap.delete(pluginId);
            return newMap;
          });
        }, 5000);

        return false;
      }
    },
    [fetchLatestRelease, downloadPluginZip, extractAndInstall],
  );

  /**
   * Check for plugin updates
   */
  const checkForUpdates = useCallback(
    async (
      plugin: PluginInfo,
    ): Promise<{
      hasUpdate: boolean;
      currentVersion?: string;
      latestVersion?: string;
      releaseNotes?: string;
    }> => {
      try {
        // Get current installed version
        const installedPlugins = await window.plugins.list();
        const installedPlugin = installedPlugins.find(
          (p) => p.name === plugin.name,
        );

        if (!installedPlugin) {
          return { hasUpdate: false };
        }

        // Get latest release
        const release = await fetchLatestRelease(plugin.repoLink);

        const currentVersion = installedPlugin.version;
        const latestVersion = release.tag_name.replace(/^v/, ''); // Remove 'v' prefix if present

        const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

        return {
          hasUpdate,
          currentVersion,
          latestVersion,
          releaseNotes: release.body,
        };
      } catch (error) {
        console.error('Failed to check for updates:', error);
        throw error;
      }
    },
    [fetchLatestRelease],
  );

  /**
   * Update plugin to latest version
   */
  const updatePlugin = useCallback(
    async (plugin: PluginInfo): Promise<boolean> => {
      try {
        // First check for updates to show user what will be updated
        const updateInfo = await checkForUpdates(plugin);

        if (!updateInfo.hasUpdate) {
          toast({
            title: 'No Updates Available',
            description: `${plugin.name} is already up to date (v${updateInfo.currentVersion})`,
            variant: 'default',
            duration: 3000,
          });
          return false;
        }

        // Show update information
        toast({
          title: 'Update Available',
          description: `Updating ${plugin.name} from v${updateInfo.currentVersion} to v${updateInfo.latestVersion}`,
          variant: 'default',
          duration: 5000,
        });

        // First uninstall the current version
        const installedPlugins = await window.plugins.list();
        const installedPlugin = installedPlugins.find(
          (p) => p.name === plugin.name,
        );

        if (installedPlugin) {
          const uninstallSuccess = await window.plugins.uninstall(
            installedPlugin.id,
          );
          if (!uninstallSuccess) {
            throw new Error('Failed to uninstall current version');
          }
        }

        // Then install the latest version
        return await installPlugin(plugin);
      } catch (error) {
        console.error('Update failed:', error);
        toast({
          title: 'Update Failed',
          description:
            error instanceof Error ? error.message : 'Unknown error occurred',
          variant: 'destructive',
          duration: 5000,
        });
        return false;
      }
    },
    [installPlugin, checkForUpdates],
  );

  /**
   * Compare two version strings
   * Returns: 1 if a > b, -1 if a < b, 0 if equal
   */
  const compareVersions = (a: string, b: string): number => {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);

    const maxLength = Math.max(aParts.length, bParts.length);

    for (let i = 0; i < maxLength; i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;

      if (aPart > bPart) return 1;
      if (aPart < bPart) return -1;
    }

    return 0;
  };

  /**
   * Get installation progress for a plugin
   */
  const getInstallationProgress = useCallback(
    (pluginId: string): InstallationProgress | undefined => {
      return installations.get(pluginId);
    },
    [installations],
  );

  /**
   * Check if a plugin is currently being installed
   */
  const isInstalling = useCallback(
    (pluginId: string): boolean => {
      const progress = installations.get(pluginId);
      return (
        progress !== undefined &&
        progress.status !== 'complete' &&
        progress.status !== 'error'
      );
    },
    [installations],
  );

  return {
    installPlugin,
    checkForUpdates,
    updatePlugin,
    fetchLatestRelease,
    getInstallationProgress,
    isInstalling,
    installations: Array.from(installations.values()),
  };
};
