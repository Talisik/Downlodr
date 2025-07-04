/**
 * A custom React component for Advanced Settings in Downlodr
 * This modal provides advanced configuration options including:
 * - YTDLP binary management (download, version selection, platform targeting)
 * - Advanced download configurations
 * - System optimization settings
 *
 * @param isOpen - If modal is open, keeps it open
 * @param onClose - If modal has been closed, closes modal
 * @returns JSX.Element - The rendered component displaying an AdvancedSettingsModal
 */

import React, { useEffect, useRef, useState } from 'react';
import { FiCheck, FiDownload } from 'react-icons/fi';
import { IoMdClose } from 'react-icons/io';
import { useToast } from '../../SubComponents/shadcn/hooks/use-toast';

interface AdvancedSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdvancedSettingsModal: React.FC<AdvancedSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { toast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);

  // YTDLP Download Options
  const [filePath, setFilePath] = useState('');
  const [version, setVersion] = useState('');
  const [platform, setPlatform] = useState('auto');
  const [forceDownload, setForceDownload] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // YT-DLP Version Management
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [latestVersion, setLatestVersion] = useState<string>('');
  // const [isCheckingVersion, setIsCheckingVersion] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);

  // Available platforms
  const platforms = [
    { value: 'auto', label: 'Auto-detect' },
    { value: 'win32', label: 'Windows (32-bit)' },
    { value: 'win64', label: 'Windows (64-bit)' },
    { value: 'linux', label: 'Linux' },
    { value: 'darwin', label: 'macOS' },
  ];

  // Popular versions (you can expand this list)
  const popularVersions = [
    '2024.01.07',
    '2023.12.30',
    '2023.11.16',
    '2023.10.13',
    '2023.09.24',
  ];

  // Load current version on modal open
  useEffect(() => {
    if (isOpen) {
      loadCurrentVersion();
    }
  }, [isOpen]);

  const loadCurrentVersion = async () => {
    try {
      const result = await window.ytdlp.getCurrentVersion();
      if (result.success && result.version) {
        setCurrentVersion(result.version);
      } else {
        setCurrentVersion('Not installed');
      }
    } catch (error) {
      console.error('Error getting current version:', error);
      setCurrentVersion('Error');
    }
  };

  /*const checkLatestVersion = async () => {
    if (isCheckingVersion) return;

    setIsCheckingVersion(true);

    try {
      const result = await window.ytdlp.getLatestVersion();
      if (result.success && result.version) {
        setLatestVersion(result.version);
        setIsRateLimited(false);
        toast({
          title: 'Version Check Complete',
          description: `Latest version: ${result.version}`,
          duration: 3000,
        });
      } else {
        // Check if it's a rate limit error
        if (result.error && result.error.includes('Rate limited')) {
          setIsRateLimited(true);
          toast({
            variant: 'destructive',
            title: 'Rate Limited',
            description: result.error,
            duration: 8000,
          });
        } else if (
          result.error &&
          result.error.includes('rate limit exceeded')
        ) {
          setIsRateLimited(true);
          toast({
            variant: 'destructive',
            title: 'GitHub API Rate Limited',
            description:
              'Too many requests. Please wait an hour before trying again.',
            duration: 8000,
          });
        } else {
          throw new Error(
            result.message || result.error || 'Failed to get latest version',
          );
        }
      }
    } catch (error) {
      console.error('Error checking latest version:', error);
      toast({
        variant: 'destructive',
        title: 'Version Check Failed',
        description: error?.message || 'Failed to check latest version',
        duration: 5000,
      });
    } finally {
      setIsCheckingVersion(false);
    }
  };
  */

  const handleCheckAndUpdate = async () => {
    if (isUpdating) return;

    setIsUpdating(true);

    try {
      const result = await window.ytdlp.checkAndUpdate();

      if (result.success) {
        // Update current version if it changed
        if (result.latestVersion) {
          setCurrentVersion(result.latestVersion);
          setLatestVersion(result.latestVersion);
        }

        setIsRateLimited(false);

        toast({
          title:
            result.action === 'up-to-date'
              ? 'Already Up to Date'
              : 'Update Successful',
          description: result.message,
          duration: 5000,
        });
      } else {
        // Check if it's a rate limit error
        if (result.error && result.error.includes('Rate limited')) {
          setIsRateLimited(true);
          toast({
            variant: 'destructive',
            title: 'Rate Limited',
            description: result.error,
            duration: 8000,
          });
        } else if (
          result.error &&
          result.error.includes('rate limit exceeded')
        ) {
          setIsRateLimited(true);
          toast({
            variant: 'destructive',
            title: 'GitHub API Rate Limited',
            description:
              'Too many requests. Please wait an hour before trying again.',
            duration: 8000,
          });
        } else {
          throw new Error(result.error || 'Update failed');
        }
      }
    } catch (error) {
      console.error('Error updating YT-DLP:', error);
      // Check if error message contains rate limit info
      const errorMessage = error?.message || 'Failed to update YT-DLP';
      if (errorMessage.includes('rate limit')) {
        toast({
          variant: 'destructive',
          title: 'GitHub API Rate Limited',
          description:
            'Too many requests. Please wait an hour before trying again.',
          duration: 8000,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Update Failed',
          description: errorMessage,
          duration: 5000,
        });
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleManualUpdate = async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    try {
      const options: {
        version?: string;
        forceDownload?: boolean;
      } = {
        forceDownload: true,
      };

      if (latestVersion) {
        options.version = latestVersion;
      }

      const result = await window.ytdlp.downloadYTDLP(options);

      if (result.success) {
        toast({
          title: 'Success',
          description: 'YT-DLP has been downloaded/updated successfully',
          duration: 5000,
        });

        // Reload current version
        await loadCurrentVersion();
      } else {
        throw new Error(result.error || 'Download failed');
      }
    } catch (error) {
      console.error('YT-DLP update error:', error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error?.message || 'Failed to download/update YT-DLP',
        duration: 5000,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle custom file path selection
  const handleSelectPath = async () => {
    try {
      const selectedPath = await window.ytdlp.selectDownloadDirectory();
      if (selectedPath) {
        setFilePath(selectedPath);
      }
    } catch (error) {
      console.error('Error selecting path:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to select directory',
        duration: 3000,
      });
    }
  };

  // Handle YTDLP download
  const handleDownloadYTDLP = async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    try {
      const options: {
        filePath?: string;
        version?: string;
        platform?: string;
        forceDownload?: boolean;
      } = {};

      if (filePath.trim()) options.filePath = filePath.trim();
      if (version.trim()) options.version = version.trim();
      if (platform !== 'auto') options.platform = platform;
      options.forceDownload = forceDownload;

      const result = await window.ytdlp.downloadYTDLP(options);

      if (result.success) {
        toast({
          title: 'Success',
          description: 'YTDLP binary downloaded successfully',
          duration: 5000,
        });

        // Reset form after successful download
        setTimeout(() => {
          setFilePath('');
          setVersion('');
          setPlatform('auto');
          setForceDownload(false);
        }, 2000);
      } else {
        throw new Error(result.error || 'Download failed');
      }
    } catch (error) {
      console.error('YTDLP download error:', error);
      toast({
        variant: 'destructive',
        title: 'Download Failed',
        description: error?.message || 'Failed to download YTDLP binary',
        duration: 5000,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // Close modal on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFilePath('');
      setVersion('');
      setPlatform('auto');
      setForceDownload(false);
      setIsDownloading(false);
      setIsRateLimited(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-20 dark:bg-opacity-50 flex items-center justify-center h-full z-[8999]"
      onClick={(e) => {
        // Only close if clicking the overlay background
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white border border-darkModeCompliment dark:bg-darkModeDropdown rounded-lg pt-4 pr-6 pl-6 pb-4 max-w-2xl w-full mx-4 max-h-[100vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold dark:text-gray-200">
            Advanced Settings
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            disabled={isDownloading || isUpdating}
          >
            <IoMdClose size={16} />
          </button>
        </div>

        <form onSubmit={(e) => e.preventDefault()}>
          {/* YT-DLP Version Management Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <label className="block dark:text-gray-200 text-nowrap font-bold">
                YT-DLP Version Management
              </label>
              <hr className="flex-grow border-t-1 border-divider dark:border-gray-700 ml-2" />
            </div>

            <div className="space-y-3 ml-2">
              {/* Current and Latest Version Display */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium dark:text-gray-200 mb-1">
                    Current Version
                  </label>
                  <div className="text-sm text-gray-600 dark:text-gray-400 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    {currentVersion || 'Loading...'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium dark:text-gray-200 mb-1">
                    Latest Version
                  </label>
                  <div className="text-sm text-gray-600 dark:text-gray-400 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    {latestVersion || 'Check for updates'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* YTDLP Binary Management Section */}
          <div className="space-y-2 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <label className="block dark:text-gray-200 text-nowrap font-bold">
                YTDLP Binary Management
              </label>
              <hr className="flex-grow border-t-1 border-divider dark:border-gray-700 ml-2" />
            </div>
            <div className="space-y-3 ml-2">
              {/* Custom File Path */}
              <div>
                <label className="block text-sm font-medium dark:text-gray-200 mb-1">
                  Download Location (Optional)
                </label>
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  Select a directory or specify a full path including filename.
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={filePath}
                    onChange={(e) => setFilePath(e.target.value)}
                    placeholder="Leave empty for default location"
                    className="flex-1 border rounded-md px-3 py-2 text-sm dark:bg-inputDarkMode dark:text-gray-200 outline-none dark:border-gray-600"
                    disabled={isDownloading}
                  />
                  <button
                    onClick={handleSelectPath}
                    className="px-3 py-2 text-sm border rounded-md hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-darkModeHover dark:text-gray-200"
                    disabled={isDownloading}
                  >
                    Browse
                  </button>
                </div>
                {filePath && (
                  <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs">
                    <span className="text-gray-600 dark:text-gray-400">
                      Will download to:{' '}
                    </span>
                    <span className="font-mono dark:text-gray-200">
                      {(() => {
                        const isWindows =
                          filePath.includes('\\') || filePath.includes('C:');
                        const separator = isWindows ? '\\' : '/';
                        const executableName = isWindows
                          ? 'yt-dlp.exe'
                          : 'yt-dlp';

                        if (
                          filePath.includes('.exe') ||
                          (!isWindows &&
                            filePath.split('/').pop()?.includes('yt-dlp'))
                        ) {
                          return filePath;
                        }

                        const hasTrailingSeparator =
                          filePath.endsWith('\\') || filePath.endsWith('/');
                        return `${filePath}${
                          hasTrailingSeparator ? '' : separator
                        }${executableName}`;
                      })()}
                    </span>
                  </div>
                )}
              </div>

              {/* Version and Platform Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium dark:text-gray-200 mb-1">
                    Version (Optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      placeholder="Latest"
                      className="flex-1 border rounded-md px-3 py-2 text-sm dark:bg-inputDarkMode dark:text-gray-200 outline-none dark:border-gray-600"
                      disabled={isDownloading}
                    />
                    <select
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      className="border rounded-md px-3 py-2 text-sm dark:bg-inputDarkMode dark:text-gray-200 outline-none dark:border-gray-600"
                      disabled={isDownloading}
                    >
                      <option value="">Latest</option>
                      {popularVersions.map((ver) => (
                        <option key={ver} value={ver}>
                          {ver}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium dark:text-gray-200 mb-1">
                    Target Platform
                  </label>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 text-sm dark:bg-inputDarkMode dark:text-gray-200 outline-none dark:border-gray-600"
                    disabled={isDownloading}
                  >
                    {platforms.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Force Download Option */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="force-download"
                  checked={forceDownload}
                  onChange={(e) => setForceDownload(e.target.checked)}
                  className="w-4 h-4 text-primary rounded focus:ring-primary"
                  disabled={isDownloading}
                />
                <label
                  htmlFor="force-download"
                  className="text-sm dark:text-gray-200 cursor-pointer"
                >
                  Force download even if binary already exists
                </label>
              </div>

              {/* Download Button */}
              <button
                onClick={handleDownloadYTDLP}
                disabled={isDownloading}
                className={`w-full py-2 px-4 rounded-md text-white text-sm font-medium transition-colors ${
                  isDownloading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-primary hover:bg-orange-600'
                }`}
              >
                {isDownloading ? (
                  <div className="flex items-center justify-center gap-2 px-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Downloading...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <FiDownload size={16} />
                    Download YTDLP Binary
                  </div>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Button commands */}
        <hr className="solid mt-4 mb-2 -mx-6 w-[calc(100%+47px)] border-t-2 border-divider dark:border-darkModeCompliment" />

        <div className="flex gap-3 p-0">
          <div className="ml-auto flex gap-3">
            <button
              onClick={handleCheckAndUpdate}
              disabled={isUpdating || isRateLimited}
              className={`px-2 py-1 text-sm border rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-darkModeHover text-white dark:text-gray-200 transition-colors ${
                isUpdating || isRateLimited
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-primary hover:bg-orange-600'
              }`}
            >
              {isUpdating ? (
                <div className="flex items-center justify-center gap-2 px-2">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                  Checking...
                </div>
              ) : isRateLimited ? (
                <div className="flex items-center justify-center gap-2">
                  <span>⏳</span>
                  Rate Limited
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <FiCheck size={14} />
                  Check & Update
                </div>
              )}
            </button>

            <button
              onClick={handleManualUpdate}
              disabled={isDownloading || isRateLimited}
              className={`px-2 text-white py-1 text-sm border rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-darkModeHover dark:text-gray-200 transition-colors ${
                isDownloading || isRateLimited
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-primary hover:bg-orange-600'
              }`}
            >
              {isDownloading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                  Downloading...
                </div>
              ) : isRateLimited ? (
                <div className="flex items-center justify-center gap-2">
                  <span>⏳</span>
                  Rate Limited
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <FiDownload size={14} />
                  Manual Update
                </div>
              )}
            </button>
            <button
              onClick={onClose}
              className="px-2 py-1 text-sm border rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-darkModeHover dark:text-gray-200"
              disabled={isDownloading || isUpdating}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedSettingsModal;
