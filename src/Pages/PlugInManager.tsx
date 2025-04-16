// src/Components/Pages/PluginManager.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../Components/SubComponents/shadcn/components/ui/button';
import useDownloadStore, { HistoryDownloads } from '../Store/downloadStore';
import { FiSearch } from 'react-icons/fi';
import { FaPlus } from 'react-icons/fa6';

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

  //Store
  const { historyDownloads } = useDownloadStore();

  // Search
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<HistoryDownloads[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  // Filter search results when search term changes
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setSearchResults([]);
      return;
    }
    console.log(searchTerm);
    console.log(historyDownloads);
    const results = historyDownloads.filter((download) =>
      download.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );

    setSearchResults(results);
  }, [searchTerm, historyDownloads]);
  useEffect(() => {
    loadPlugins();
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
    try {
      const pluginPath = await window.ytdlp.selectDownloadDirectory();
      if (pluginPath) {
        const success = await window.plugins.install(pluginPath);
        if (success) {
          // First reload the plugins in the main process
          await window.plugins.reload();
          // Then update the UI list
          await loadPlugins();
        }
      }
    } catch (error) {
      console.error('Failed to install plugin:', error);
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

  // Dummy function to handle toggle state
  const handleToggle = (pluginId: string) => {
    setEnabledPlugins((prev) => ({
      ...prev,
      [pluginId]: !prev[pluginId],
    }));
    console.log(
      `Plugin ${pluginId} is now ${
        !enabledPlugins[pluginId] ? 'enabled' : 'disabled'
      }`,
    );
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-[20px] font-medium">Plugins</h1>
          {/* Search Bar with increased width */}
          <div ref={searchRef} className="relative">
            <div className="flex items-center dark:bg-[#30303C] rounded-md border border-[#D1D5DB] dark:border-none px-2">
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
                {searchResults.map((download) => (
                  <div
                    key={download.id}
                    className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm truncate"
                    title={download.name}
                  >
                    {download.name}
                  </div>
                ))}
              </div>
            )}

            {/* No Results Message */}
            {showResults &&
              searchTerm.trim() !== '' &&
              searchResults.length === 0 && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10">
                  <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                    No downloads found
                  </div>
                </div>
              )}
          </div>
        </div>
        <div className="flex items-center">
          <Button
            onClick={handleInstall}
            className="bg-[#F45513] px-4 py-1 h-8 ml-4"
          >
            <FaPlus />
            <span>Add Extension</span>
          </Button>
        </div>
      </div>

      {loading ? (
        <div>Loading plugins...</div>
      ) : plugins.length === 0 ? (
        <div className="text-center text-gray-500 p-8">lol walang lumabas</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plugins.map((plugin) => (
            <div
              key={plugin.id}
              className="border-2 p-4 dark:border-gray-700 rounded-lg shadow-sm border-t-4 border-t-[#F45513] dark:border-t-[#F45513]"
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
                  <hr className="solid my-4 w-full border-t border-divider dark:border-gray-700" />
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        className="border-2 px-4 h-8"
                        onClick={() => handleUninstall(plugin.id)}
                      >
                        Details
                      </Button>
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
  );
};

export default PluginManager;
