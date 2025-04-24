/* eslint-disable @typescript-eslint/no-explicit-any */
// src/Components/Pages/PluginManager.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../Components/SubComponents/shadcn/components/ui/button';
import { FiSearch } from 'react-icons/fi';
import { FaPlus } from 'react-icons/fa6';
import NoPlugin from '../Assets/Images/extension_light_nobg 1.svg';
import { NavLink } from 'react-router-dom';
import { toast } from '../Components/SubComponents/shadcn/hooks/use-toast';

interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  icon?: any;
}

const PluginManager: React.FC = () => {
  //Plugins
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [enabledPlugins, setEnabledPlugins] = useState<Record<string, boolean>>(
    {},
  );
  // New state to track if directory selection is in progress
  const [isSelectingDirectory, setIsSelectingDirectory] =
    useState<boolean>(false);
  //Store

  // Search
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<PluginInfo[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  // Filter search results when search term changes
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
    loadPlugins();
  }, []);

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

  const loadPlugins = async () => {
    try {
      setLoading(true);
      const installedPlugins = await window.plugins.list();
      setPlugins(installedPlugins);
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
        const success = await window.plugins.install(pluginPath);
        if (success) {
          // First reload the plugins in the main process
          await window.plugins.reload();
          // Then update the UI list
          await loadPlugins();
          toast({
            title: 'Success',
            description: 'Plugin was installed successfully',
            variant: 'success',
          });
        } else {
          toast({
            title: 'Invalid Plugin Directory',
            description:
              'The selected directory does not contain a valid plugin structure',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      console.error('Failed to install plugin:', error);
      toast({
        title: 'Installation Failed',
        description:
          error.message ||
          'An unexpected error occurred while installing the plugin',
        variant: 'destructive',
      });
    } finally {
      setIsSelectingDirectory(false);
    }
  };

  const handleUninstall = async (pluginId: string) => {
    try {
      const success = await window.plugins.uninstall(pluginId);
      if (success) {
        // First reload the plugins in the main process
        await window.plugins.reload();
        // Then update the UI list
        await loadPlugins();
      }
    } catch (error) {
      console.error('Failed to uninstall plugin:', error);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleLoadUnzipped = async () => {
    try {
      const pluginDirPath = await window.ytdlp.selectDownloadDirectory();
      if (pluginDirPath) {
        const success = await window.plugins.loadUnzipped(pluginDirPath);
        if (success) {
          // First reload the plugins in the main process
          await window.plugins.reload();
          // Then update the UI list
          await loadPlugins();
        }
      }
    } catch (error) {
      console.error('Failed to load unzipped plugin:', error);
    }
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

  return (
    <div className="h-full w-full bg-[#FBFBFB] dark:bg-darkMode">
      <div className="p-4">
        <div className="flex justify-between items-center mb-6">
          {/* Directory selection overlay - blocks all app interaction */}
          {isSelectingDirectory && (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-[9999] cursor-not-allowed flex items-center justify-center">
              <div className="bg-white dark:bg-darkMode p-4 rounded-lg shadow-lg max-w-md text-center">
                <h3 className="text-lg font-medium mb-2 dark:text-gray-200">
                  Directory Selection In Progress
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Please complete the directory selection dialog before
                  continuing.
                </p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-medium">Plugins</h1>
            {/* Search Bar with increased width */}
            <div ref={searchRef} className="relative">
              <div className="flex items-center bg-[#FFFFFF] dark:bg-[#30303C] rounded-md border border-[#D1D5DB] dark:border-none px-2">
                <FiSearch className="text-gray-500 dark:text-gray-400 h-4 w-4 mr-1" />
                <input
                  type="text"
                  placeholder="Search"
                  className="py-1 px-2 bg-transparent focus:outline-none text-sm w-full"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    if (e.target.value.trim() !== '') {
                      setShowResults(true);
                    } else {
                      setShowResults(false);
                    }
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
                <div className="absolute top-full left-0 mt-1 w-full max-h-60 overflow-y-auto bg-white dark:bg-gray-800 rounded-md shadow-lg z-10">
                  {searchResults.map((plugin) => (
                    <NavLink
                      key={plugin.id}
                      to="/plugin-details"
                      state={{ plugin }}
                      className="block px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm"
                      onClick={() => setShowResults(false)}
                    >
                      <div className="font-medium truncate" title={plugin.name}>
                        {plugin.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {plugin.description}
                      </div>
                    </NavLink>
                  ))}
                </div>
              )}

              {/* No Results Message */}
              {showResults &&
                searchTerm.trim() !== '' &&
                searchResults.length === 0 && (
                  <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10">
                    <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                      No plugins found
                    </div>
                  </div>
                )}
            </div>
          </div>
          {plugins.length > 0 && (
            <div className="flex items-center">
              <Button
                onClick={handleInstall}
                className="bg-[#F45513] px-4 py-1 h-8 ml-4"
              >
                <FaPlus />
                <span>Add Plugin</span>
              </Button>
            </div>
          )}
        </div>

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
              onClick={handleInstall}
              className="bg-[#F45513] px-4 py-1 h-8 mt-2"
            >
              <FaPlus />
              <span>Add Plugin</span>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plugins.map((plugin) => (
              <div
                key={plugin.id}
                className="border-2 p-4 dark:border-componentBorder rounded-lg shadow-sm border-t-4 border-t-[#F45513] dark:border-t-[#F45513]"
              >
                <div className="flex">
                  <div className="w-full">
                    <span>{plugin.icon}</span>
                    <h3 className="text-lg text-[14px] font-bold truncate">
                      {plugin.name}
                    </h3>
                    <p className="mt-2 text-sm line-clamp-2">
                      {plugin.description}
                    </p>
                    <hr className="solid my-4 w-full border-t border-divider dark:border-componentBorder" />
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div className="flex gap-2 flex-wrap">
                        <NavLink to="/plugin-details" state={{ plugin }}>
                          <Button
                            variant="outline"
                            className="border-2 px-4 h-8"
                          >
                            Details
                          </Button>
                        </NavLink>
                        <Button
                          variant="outline"
                          className="border-2 px-4 h-8"
                          onClick={() => handleUninstall(plugin.id)}
                        >
                          Remove
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={enabledPlugins[plugin.id] || false}
                            onChange={() => handleToggle(plugin.id)}
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-500"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PluginManager;
