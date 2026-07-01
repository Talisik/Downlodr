import NoPlugin from '@/assets/plugin/extension_light_nobg 1.svg';
import ConfirmModal from '@/core-app/components/modal/custom/ConfirmModal';
import { Button } from '@/core-app/components/shadcn/components/ui/button';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/core-app/components/shadcn/components/ui/tabs';
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import UpdateNotification from '@/core-app/components/updateNotification/UpdateNotifications';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import { getFirstParagraph } from '@/core-app/utils/stringHelper';
import { useTaskbarDownloadStore } from '@/downlodr/store/taskbarDownloadStore';
import PluginCard from '@/plugins/components/PluginCard';
import browsePluginsLang, {
  getBrowsePluginsData,
  PluginData,
  refreshPluginData,
} from '@/plugins/hook/githubPluginHook';
import { useBrowsePlugin } from '@/plugins/hook/useBrowsePlugin';
import { PluginInfo, UpdateInfo } from '@/plugins/schema/types';
import { usePluginStore } from '@/plugins/store/pluginStore';
import { renderIcon } from '@/plugins/utils/pluginIconHelper';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaArrowsRotate, FaPlus } from 'react-icons/fa6';
import { FiSearch } from 'react-icons/fi';
import { NavLink } from 'react-router-dom';

// Extended interface for browse plugins with formatted size
interface BrowsePluginInfo extends PluginInfo {
  formattedSize: string;
}

const PluginManager = () => {
  const { t } = useTranslation('plugins');
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
  const [activeTab, setActiveTab] = useState('browse');

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
        title: t('page.toast.loadFailed'),
        description: t('page.toast.loadFailedDesc'),
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
        title: t('page.toast.refreshed'),
        description:
          result.source === 'github'
            ? t('page.toast.refreshedGithub')
            : t('page.toast.refreshedFallback'),
        variant: result.source === 'github' ? 'success' : 'default',
        duration: 3000,
      });
    } catch (error) {
      console.error('Failed to refresh browse plugins:', error);
      toast({
        title: t('page.toast.refreshFailed'),
        description: t('page.toast.refreshFailedDesc'),
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
            title: t('page.toast.installSuccess'),
            description: t('page.toast.installSuccessDesc'),
            variant: 'success',
            duration: 3000,
          });
        } else if (
          typeof result === 'string' &&
          result === 'already-installed'
        ) {
          toast({
            title: t('page.toast.alreadyInstalled'),
            description: t('page.toast.alreadyInstalledDesc'),
            variant: 'default',
            duration: 3000,
          });
        } else {
          toast({
            title: t('page.toast.invalidDir'),
            description: t('page.toast.invalidDirDesc'),
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
          title: t('page.toast.installFailed'),
          description: error.message || t('page.toast.installFailedDefault'),
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
          title: t('page.toast.removed'),
          description: t('page.toast.removedDesc', { name: pluginName }),
          variant: 'success',
          duration: 3000,
        });
      } else {
        toast({
          title: t('page.toast.removeFailed'),
          description: t('page.toast.removeFailedDesc', { name: pluginName }),
          variant: 'destructive',
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Failed to uninstall plugin:', error);
      toast({
        title: t('page.toast.removeError'),
        description: t('page.toast.removeErrorDesc', { name: pluginName }),
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
          title: t('page.toast.noUpdates'),
          description: t('page.toast.noUpdatesDesc', {
            name: plugin.name,
            version: updateInfoResult.currentVersion,
          }),
          variant: 'default',
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
      toast({
        title: t('page.toast.updateCheckFailed'),
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
          title: t('page.toast.updateSuccess'),
          description: t('page.toast.updateSuccessDesc', {
            name: currentUpdatingPlugin.name,
          }),
          variant: 'success',
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Plugin update failed:', error);
      toast({
        title: t('page.toast.updateFailed'),
        description: t('page.toast.updateFailedDesc', {
          name: currentUpdatingPlugin.name,
        }),
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
    <div className="min-h-screen w-full bg-white rounded-md dark:bg-darkModeDropdown">
      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={cancelUninstall}
        onConfirm={confirmUninstall}
        title={t('page.confirmUninstall.title')}
        message={t('page.confirmUninstall.message', {
          name:
            plugins.find((p) => p.id === pluginToRemove)?.name ??
            t('page.thisPlugin'),
        })}
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
              defaultValue="browse"
              className="w-full"
              onValueChange={setActiveTab}
            >
              <TabsList className="flex justify-between items-center w-full">
                <div className="bg-[#F4F4F4] dark:bg-darkModeCompliment rounded-md -ml-1 p-1">
                  <div>
                    <TabsTrigger
                      value="browse"
                      className="text-sm font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-[#412E26] dark:data-[state=active]:text-primary data-[state=active]:text-primary"
                    >
                      {t('page.tabs.browse')}
                    </TabsTrigger>
                    <TabsTrigger
                      value="installed"
                      className="text-sm font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-[#412E26] dark:data-[state=active]:text-primary data-[state=active]:text-primary"
                    >
                      {t('page.tabs.installed')}
                    </TabsTrigger>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Refresh button - only show when browse tab is active */}
                  {activeTab === 'browse' && (
                    <TooltipWrapper
                      content={t('page.tooltip.refresh')}
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
                    <div className="flex items-center bg-[#FFFFFF] dark:bg-darkModeTable rounded-md border dark:border-2 border-[#D1D5DB] dark:border-darkModeCompliment px-2">
                      <FiSearch className="text-gray-500 dark:text-gray-400 h-4 w-4 mr-1" />
                      <input
                        type="text"
                        placeholder={t('page.search.placeholder')}
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
                            {t('page.search.noResults')}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </TabsList>
              {activeTab === 'installed' && plugins.length > 0 && (
                <div className="flex justify-start mt-2">
                  <Button
                    variant="default"
                    onClick={handleInstall}
                    className="text-md bg-[#F45513] dark:bg-[#F45513] dark:text-white dark:hover:text-black dark:hover:bg-white font-normal px-4 py-1 h-7"
                    icon={<FaPlus size={11} />}
                  >
                    Add Plugin
                  </Button>
                </div>
              )}
              <TabsContent value="installed" className="my-6">
                {loading ? (
                  <div>{t('page.installed.loading')}</div>
                ) : plugins.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center text-gray-500 p-8 min-h-[60vh]">
                    <img
                      src={NoPlugin}
                      alt={t('page.noPluginsAlt')}
                      className="mx-auto"
                    />
                    <span className="mx-auto mt-8 dark:text-gray-200">
                      {t('page.installed.emptyTitle')}
                    </span>
                    <Button
                      variant="default"
                      onClick={handleInstall}
                      className="text-md bg-[#F45513] dark:bg-[#F45513] dark:text-white dark:hover:text-black dark:hover:bg-white font-normal px-4 py-1 h-8 mt-4"
                      icon={<FaPlus />}
                    >
                      {t('page.installed.addPlugin')}
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
                      {t('page.browse.loading')}
                    </span>
                  </div>
                ) : browsePlugins.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center text-gray-500 p-8 min-h-[60vh]">
                    <img
                      src={NoPlugin}
                      alt={t('page.noPluginsAlt')}
                      className="mx-auto"
                    />
                    <span className="mx-auto mt-8 dark:text-gray-200">
                      {t('page.browse.emptyTitle')}
                    </span>
                    <Button
                      variant="outline"
                      onClick={handleRefreshBrowsePlugins}
                      className="mt-4"
                    >
                      {t('page.browse.refreshButton')}
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
