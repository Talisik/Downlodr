// src/Components/Pages/PluginManager.tsx
import NoPlugin from '@/Assets/Images/extension_light_nobg 1.svg';
import ConfirmModal from '@/Components/Main/Modal/ConfirmModal';
import TooltipWrapper from '@/Components/SubComponents/custom/TooltipWrapper';
import UpdateNotification from '@/Components/SubComponents/custom/UpdateNotifications';
import { Button } from '@/Components/SubComponents/shadcn/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/Components/SubComponents/shadcn/components/ui/tabs';
import { toast } from '@/Components/SubComponents/shadcn/hooks/use-toast';
import browsePluginsLang, {
  getBrowsePluginsData,
  PluginData,
  refreshPluginData,
} from '@/Lang/githubPluginHook';
import PluginCard from '@/plugins/components/PluginCard';
import { useBrowsePlugin } from '@/plugins/Hooks/useBrowsePlugin';
import { PluginInfo, UpdateInfo } from '@/plugins/types';
import { usePluginStore } from '@/Store/pluginStore';
import { useTaskbarDownloadStore } from '@/Store/taskbarDownloadStore';
import { renderIcon } from '@/Utils/iconHelpers';
import { getFirstParagraph } from '@/Utils/stringHelpers';
import { useEffect, useRef, useState } from 'react';
import { FaArrowsRotate, FaPlus } from 'react-icons/fa6';
import { FiSearch } from 'react-icons/fi';
import { NavLink } from 'react-router-dom';

// Extended interface for browse plugins with formatted size
interface BrowsePluginInfo extends PluginInfo {
  formattedSize: string;
}

const PluginManager = () => {
  const { plugins, loadPlugins } = usePluginStore();
  const { isSelectingDirectory, setIsSelectingDirectory } =
    useTaskbarDownloadStore();
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [currentUpdatingPlugin, setCurrentUpdatingPlugin] =
    useState<PluginInfo | null>(null);
  const {
    installPlugin: installFromGitHub,
    checkForUpdates,
    updatePlugin,
    isInstalling,
    // getInstallationProgress,
  } = useBrowsePlugin();

  // Plugins
  const [loading, setLoading] = useState(true);
  const [enabledPlugins, setEnabledPlugins] = useState<Record<string, boolean>>(
    {},
  );

  // Browse plugins state
  const [browsePlugins, setBrowsePlugins] =
    useState<PluginData[]>(browsePluginsLang);
  const [browsePluginsLoading, setBrowsePluginsLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [browsePluginsSource, setBrowsePluginsSource] = useState<
    'github' | 'fallback'
  >('fallback');

  // Confirmation modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pluginToRemove, setPluginToRemove] = useState<string | null>(null);

  // Search
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<PluginInfo[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  // track active tab
  const [activeTab, setActiveTab] = useState('installed');

  // filter search results
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setSearchResults([]);
      return;
    }

    const results = plugins.filter(
      (plugin) =>
        plugin.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        plugin.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        plugin.author.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    setSearchResults(results);
  }, [searchTerm, plugins]);

  useEffect(() => {
    handleLoadPlugins();
  }, []);

  // Load browse plugins data from GitHub release
  const loadBrowsePlugins = async () => {
    setBrowsePluginsLoading(true);
    try {
      const result = await getBrowsePluginsData();
      setBrowsePlugins(result.data);
      setBrowsePluginsSource(result.source);
      /*
      if (result.source === 'github') {
        toast({
          title: 'Browse Plugins Updated',
          description: 'Plugin data loaded from GitHub release',
          variant: 'success',
          duration: 3000,
        });  
      } else if (result.error) {
        toast({
          title: 'GitHub Fetch Failed',
          description: `Using fallback data: ${result.error}`,
          variant: 'default',
          duration: 5000,
        });
      } */
    } catch (error) {
      console.error('Failed to load browse plugins:', error);
      toast({
        title: 'Failed to Load Plugins',
        description: 'Using fallback plugin data',
        variant: 'destructive',
        duration: 5000,
      });
    } finally {
      setBrowsePluginsLoading(false);
    }
  };

  // Load browse plugins when component mounts
  useEffect(() => {
    // Clear any cached data that might contain JSX objects
    localStorage.removeItem('downlodr-plugins-cache');
    loadBrowsePlugins();
  }, []);

  // Manual refresh function
  const handleRefreshBrowsePlugins = async () => {
    setBrowsePluginsLoading(true);
    try {
      const result = await refreshPluginData();
      setBrowsePlugins(result.data);
      setBrowsePluginsSource(result.source);

      toast({
        title: 'Plugins Refreshed',
        description:
          result.source === 'github'
            ? 'Plugin data updated from GitHub release'
            : 'Using fallback data due to GitHub API issues',
        variant: result.source === 'github' ? 'success' : 'default',
        duration: 3000,
      });
    } catch (error) {
      console.error('Failed to refresh browse plugins:', error);
      toast({
        title: 'Refresh Failed',
        description: 'Could not refresh plugin data',
        variant: 'destructive',
        duration: 5000,
      });
    } finally {
      setBrowsePluginsLoading(false);
    }
  };

  // Load enabled plugins state
  useEffect(() => {
    const loadEnabledState = async () => {
      try {
        const enabledState = await window.plugins.getEnabledPlugins();
        setEnabledPlugins(enabledState || {});
      } catch (error) {
        console.error('Failed to load plugin enabled states:', error);
      }
    };

    loadEnabledState();
  }, []);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLoadPlugins = async () => {
    try {
      setLoading(true);
      await loadPlugins();
    } catch (error) {
      console.error('Failed to load plugins:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async () => {
    if (isSelectingDirectory) return;

    try {
      setIsSelectingDirectory(true);
      const pluginPath = await window.ytdlp.selectDownloadDirectory();
      if (pluginPath) {
        const result = await window.plugins.install(pluginPath);

        if (result === true) {
          // First reload the plugins in the main process
          await window.plugins.reload();
          // Then update the UI list
          await handleLoadPlugins();
          toast({
            title: 'Success',
            description: 'Plugin was installed successfully',
            variant: 'success',
            duration: 3000,
          });
        } else if (
          typeof result === 'string' &&
          result === 'already-installed'
        ) {
          toast({
            title: 'Plugin Already Installed',
            description: 'This plugin is already installed',
            variant: 'default',
            duration: 3000,
          });
        } else {
          toast({
            title: 'Invalid Plugin Directory',
            description:
              'The selected directory does not contain a valid plugin structure',
            variant: 'destructive',
            duration: 3000,
          });
        }
      }
    } catch (error) {
      console.error('Failed to install plugin:', error);
      if (
        !error.message?.includes('Cannot read properties') &&
        !error.message?.includes('dialog:openDirectory')
      ) {
        toast({
          title: 'Installation Failed',
          description:
            error.message ||
            'An unexpected error occurred while installing the plugin',
          variant: 'destructive',
          duration: 3000,
        });
      }
    } finally {
      setIsSelectingDirectory(false);
    }
  };

  const handleUninstall = async (pluginId: string) => {
    setPluginToRemove(pluginId);
    setShowConfirmModal(true);
  };

  const confirmUninstall = async () => {
    if (!pluginToRemove) return;

    const plugin = plugins.find((p) => p.id === pluginToRemove);
    const pluginName = plugin ? plugin.name : 'this plugin';

    try {
      const success = await window.plugins.uninstall(pluginToRemove);
      if (success) {
        // First reload the plugins in the main process
        await window.plugins.reload();
        // Then update the UI list
        await handleLoadPlugins();
        toast({
          title: 'Plugin Removed',
          description: `${pluginName} has been successfully removed`,
          variant: 'success',
          duration: 3000,
        });
      } else {
        toast({
          title: 'Failed to Remove Plugin',
          description: `Could not remove ${pluginName}. Please try again.`,
          variant: 'destructive',
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Failed to uninstall plugin:', error);
      toast({
        title: 'Error',
        description: `An error occurred while removing ${pluginName}`,
        variant: 'destructive',
        duration: 3000,
      });
    } finally {
      setShowConfirmModal(false);
      setPluginToRemove(null);
    }
  };

  const cancelUninstall = () => {
    setShowConfirmModal(false);
    setPluginToRemove(null);
  };

  // enable and disable toggle functionality
  const handleToggle = async (pluginId: string) => {
    try {
      const newState = !enabledPlugins[pluginId];

      // Update UI state immediately for responsive UX
      setEnabledPlugins((prev) => ({
        ...prev,
        [pluginId]: newState,
      }));

      // Save the state persistently
      const success = await window.plugins.setPluginEnabled(pluginId, newState);

      if (success) {
        console.log(`Plugin ${pluginId} ${newState ? 'enabled' : 'disabled'}`);
      } else {
        // Revert UI state if the operation failed
        setEnabledPlugins((prev) => ({
          ...prev,
          [pluginId]: !newState,
        }));
        console.error(`Failed to update plugin state for ${pluginId}`);
      }
    } catch (error) {
      console.error(`Error toggling plugin ${pluginId}:`, error);
    }
  };

  // Handle plugin installation from GitHub
  const handleInstallFromGitHub = async (plugin: PluginInfo) => {
    try {
      const success = await installFromGitHub(plugin);
      if (success) {
        // First reload the plugins in the main process
        await window.plugins.reload();
        // Then update the UI list
        await handleLoadPlugins();
      }
    } catch (error) {
      console.error('Installation failed:', error);
    }
  };

  // Handle checking for updates
  const handleCheckForUpdates = async (plugin: PluginInfo) => {
    try {
      const updateInfoResult = await checkForUpdates(plugin);

      if (updateInfoResult.hasUpdate) {
        setUpdateInfo(updateInfoResult);
        setIsUpdateAvailable(true);
        setCurrentUpdatingPlugin(plugin);
      } else {
        toast({
          title: 'No Updates Available',
          description: `${plugin.name} is already up to date (v${updateInfoResult.currentVersion})`,
          variant: 'default',
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
      toast({
        title: 'Update Check Failed',
        description:
          error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
        duration: 5000,
      });
    }
  };

  // Handle plugin update when user confirms
  const handlePluginUpdate = async () => {
    if (!currentUpdatingPlugin) return;

    try {
      const success = await updatePlugin(currentUpdatingPlugin);
      if (success) {
        // Reload plugins if update was successful
        await handleLoadPlugins();
        toast({
          title: 'Update Successful',
          description: `${currentUpdatingPlugin.name} has been updated successfully`,
          variant: 'success',
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Plugin update failed:', error);
      toast({
        title: 'Update Failed',
        description: `Failed to update ${currentUpdatingPlugin.name}`,
        variant: 'destructive',
        duration: 5000,
      });
    } finally {
      handleCloseUpdateNotification();
    }
  };

  // Handle closing the update notification
  const handleCloseUpdateNotification = () => {
    setIsUpdateAvailable(false);
    setUpdateInfo(null);
    setCurrentUpdatingPlugin(null);
  };
  // dark:bg-darkModeCompliment bg-[#fcf0e3] text-gray-950 shadow-sm dark:text-gray-50
  return (
    <div className="min-h-screen w-full bg-[#FBFBFB] dark:bg-darkModeDropdown">
      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={cancelUninstall}
        onConfirm={confirmUninstall}
        message={`Are you sure you want to remove "${
          pluginToRemove
            ? plugins.find((p) => p.id === pluginToRemove)?.name ||
              'this plugin'
            : 'this plugin'
        }"? This action cannot be undone.`}
      />
      <UpdateNotification
        updateInfo={updateInfo}
        isOpen={isUpdateAvailable}
        onClose={handleCloseUpdateNotification}
        onUpdate={handlePluginUpdate}
        updateType="plugin"
        pluginName={currentUpdatingPlugin?.name}
      />
      <div className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex justify-between items-center w-full">
            <Tabs
              defaultValue="installed"
              className="w-full"
              onValueChange={setActiveTab}
            >
              <TabsList className="flex justify-between items-center w-full">
                <div className="bg-[#F4F4F4] dark:bg-darkModeCompliment rounded-md -ml-1 p-1">
                  <div>
                    <TabsTrigger
                      value="installed"
                      className="text-sm font-medium data-[state=active]:bg-white data-[state=active]:border data-[state=active]:border-divider dark:data-[state=active]:bg-darkMode dark:data-[state=active]:border-darkModeBorderColor dark:data-[state=active]:text-white"
                    >
                      Installed Plugins
                    </TabsTrigger>
                    <TabsTrigger
                      value="browse"
                      className="text-sm font-medium data-[state=active]:bg-white data-[state=active]:border data-[state=active]:border-divider dark:data-[state=active]:bg-darkMode dark:data-[state=active]:border-darkModeBorderColor dark:data-[state=active]:text-white"
                    >
                      Browse Plugins
                    </TabsTrigger>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Refresh button - only show when browse tab is active */}
                  {activeTab === 'browse' && (
                    <TooltipWrapper
                      content="Refresh Featured Plugins"
                      side="bottom"
                      contentClassname="text-start justify-start"
                    >
                      <Button
                        variant="outline"
                        onClick={handleRefreshBrowsePlugins}
                        disabled={browsePluginsLoading}
                        className="text-sm flex items-center gap-2 dark:bg-darkMode dark:border-darkModeCompliment dark:hover:bg-darkModeHover dark:hover:border-darkModeHover"
                      >
                        <FaArrowsRotate
                          className={browsePluginsLoading ? 'animate-spin' : ''}
                        />
                      </Button>
                    </TooltipWrapper>
                  )}

                  {/* Search Bar with increased width */}
                  <div ref={searchRef} className="relative">
                    <div className="flex items-center bg-[#FFFFFF] dark:bg-darkModeDropdown rounded-md border dark:border-2 border-[#D1D5DB] dark:border-darkModeCompliment px-2">
                      <FiSearch className="text-gray-500 dark:text-gray-400 h-4 w-4 mr-1" />
                      <input
                        type="text"
                        placeholder="Search"
                        className="py-1 px-2 bg-transparent focus:outline-none text-sm w-full"
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setShowResults(e.target.value.trim() !== '');
                        }}
                        onFocus={() => {
                          if (searchTerm.trim() !== '') {
                            setShowResults(true);
                          }
                        }}
                      />
                    </div>

                    {/* Search Results Dropdown */}
                    {showResults && searchResults.length > 0 && (
                      <div className="absolute top-full left-0 mt-1 w-full max-h-60 overflow-y-auto bg-white dark:bg-darkModeCompliment rounded-md shadow-lg z-10">
                        {searchResults.map((plugin) => (
                          <NavLink
                            key={plugin.id}
                            to="/plugins/details"
                            state={{ plugin }}
                            className="block px-3 py-2 hover:bg-gray-100 dark:hover:bg-darkModeHover cursor-pointer text-sm"
                            onClick={() => setShowResults(false)}
                          >
                            <div className="flex items-center">
                              <span className="inline-flex items-center justify-center w-5 h-5 mr-2 flex-shrink-0">
                                {renderIcon(plugin.icon)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div
                                  className="font-medium truncate"
                                  title={plugin.name}
                                >
                                  {plugin.name}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                  {getFirstParagraph(plugin.description)}
                                </div>
                              </div>
                            </div>
                          </NavLink>
                        ))}
                      </div>
                    )}

                    {/* No Results Message */}
                    {showResults &&
                      searchTerm.trim() !== '' &&
                      searchResults.length === 0 && (
                        <div className="absolute top-full left-0 mt-1 w-60 bg-white dark:bg-darkModeCompliment rounded-md shadow-lg z-10">
                          <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                            No plugins found
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </TabsList>
              <TabsContent value="installed" className="my-6">
                {loading ? (
                  <div>Loading plugins...</div>
                ) : plugins.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center text-gray-500 p-8 min-h-[60vh]">
                    <img
                      src={NoPlugin}
                      alt="No plugins available"
                      className="mx-auto"
                    />
                    <span className="mx-auto mt-8 dark:text-gray-200">
                      You haven't installed any plugins
                    </span>
                    <Button
                      variant="default"
                      onClick={handleInstall}
                      className="text-md bg-[#F45513] dark:bg-[#F45513] dark:text-white dark:hover:text-black dark:hover:bg-white font-normal px-4 py-1 h-8 mt-4"
                      icon={<FaPlus />}
                    >
                      Add Plugin
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                    {plugins.map((plugin) => (
                      <PluginCard
                        key={plugin.id}
                        plugin={plugin}
                        pluginType="installed"
                        onClickButton={() => handleUninstall(plugin.id)}
                        enabledPlugins={enabledPlugins}
                        onClickToggle={() => handleToggle(plugin.id)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="browse" className="my-6 w-full">
                {browsePluginsLoading ? (
                  <div className="flex justify-center items-center py-10">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900 dark:border-white"></div>
                    <span className="ml-2 text-gray-500 dark:text-gray-400">
                      Loading plugins from GitHub...
                    </span>
                  </div>
                ) : browsePlugins.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center text-gray-500 p-8 min-h-[60vh]">
                    <img
                      src={NoPlugin}
                      alt="No plugins available"
                      className="mx-auto"
                    />
                    <span className="mx-auto mt-8 dark:text-gray-200">
                      No plugins found. Try refreshing the list.
                    </span>
                    <Button
                      variant="outline"
                      onClick={handleRefreshBrowsePlugins}
                      className="mt-4"
                    >
                      Refresh Plugins
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
                    {browsePlugins.map((plugin) => {
                      // Convert PluginData to PluginInfo format
                      const pluginInfo: BrowsePluginInfo = {
                        id: plugin.id,
                        name: plugin.name,
                        version: plugin.version,
                        description: plugin.description,
                        author: plugin.author,
                        icon: plugin.icon, // Raw SVG string
                        enabled: plugin.enabled || false,
                        location: plugin.location || '',
                        repoLink: plugin.repoLink,
                        downlodrLink: plugin.downlodrLink,
                        size: 0, // For browse plugins, size is handled as a string in the component
                        formattedSize: plugin.size,
                      };

                      return (
                        <PluginCard
                          key={plugin.id}
                          plugin={pluginInfo}
                          pluginType="browse"
                          onInstall={() => handleInstallFromGitHub(pluginInfo)}
                          onCheckUpdates={() =>
                            handleCheckForUpdates(pluginInfo)
                          }
                          isInstalling={isInstalling(plugin.id)}
                        />
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PluginManager;
