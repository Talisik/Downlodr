/**
 *
 * This component displays the PluginDetail of downloads, allowing users to view and manage their past downloads.
 * It includes functionalities to delete entries from PluginDetail and provides visual feedback for actions taken.
 *
 * @returns JSX.Element - The rendered component displaying download PluginDetail.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { FaExternalLinkAlt } from 'react-icons/fa';
import { IoIosArrowForward, IoMdArrowBack } from 'react-icons/io';
import { useLocation, useNavigate } from 'react-router-dom';

interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  icon: string;
}

const PluginDetails = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const plugin = location.state?.plugin as PluginInfo | undefined;
  const [, setPlugins] = useState<PluginInfo[]>([]);
  const [, setLoading] = useState(true);
  const [enabledPlugins, setEnabledPlugins] = useState<Record<string, boolean>>(
    {},
  );
  const [pluginLocation, setPluginLocation] = useState<string>('');

  useEffect(() => {
    const loadPluginData = async () => {
      if (plugin) {
        // Load enabled state
        try {
          const enabledState = await window.plugins.getEnabledPlugins();
          setEnabledPlugins(enabledState || {});

          // Load plugin location
          const location = await window.plugins.getPluginLocation(plugin.id);
          if (location) {
            setPluginLocation(location);
          }
        } catch (error) {
          console.error('Failed to load plugin data:', error);
        }
      }
    };

    loadPluginData();
  }, [plugin]);

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

  const handleUninstall = async (pluginId: string) => {
    try {
      const success = await window.plugins.uninstall(pluginId);
      if (success) {
        // First reload the plugins in the main process
        await window.plugins.reload();
        // Then update the UI list
        await loadPlugins();
        handleGoBack();
      }
    } catch (error) {
      console.error('Failed to uninstall plugin:', error);
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

  const handleGoBack = () => {
    navigate(-1);
  };

  // Helper function to check if string is SVG
  const isSvgString = (str: string): boolean => {
    if (typeof str !== 'string') return false;
    const trimmed = str.trim();
    return trimmed.startsWith('<svg') && trimmed.endsWith('</svg>');
  };

  // Render icon helper function
  const renderIcon = (icon: any, size: 'sm' | 'md' = 'sm') => {
    const sizeClass = size === 'md' ? 'w-6 h-6' : 'w-5 h-5';

    if (typeof icon === 'string' && isSvgString(icon)) {
      return (
        <div
          dangerouslySetInnerHTML={{ __html: icon }}
          className={`${sizeClass} flex items-center justify-center rounded-sm [&>svg]:w-full [&>svg]:h-full`}
        />
      );
    } else if (icon) {
      return <span>{icon}</span>;
    } else {
      return (
        <div
          className={`${sizeClass} bg-gray-300 dark:bg-gray-600 rounded-sm flex items-center justify-center`}
        >
          <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
            P
          </span>
        </div>
      );
    }
  };

  // If no plugin data was passed, show a message
  if (!plugin) {
    return (
      <div className="w-full p-4">
        <h2 className="text-xl font-semibold mb-4">Plugin Details</h2>
        <p>No plugin information available.</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen flex justify-center">
      <div className="min-h-screen space-y-4 w-3/4 max-w-3xl border-x-2 border-gray-200 px-6 pt-8 shadow-md overflow-y-auto">
        <div className="flex gap-2 flex-wrap items-center">
          <button
            onClick={handleGoBack}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <IoMdArrowBack size={18} />
          </button>
          <span className="inline-flex items-center justify-center w-6 h-6 flex-shrink-0">
            {renderIcon(plugin.icon)}
          </span>
          <h3 className="text-lg font-medium">{plugin.name}</h3>
        </div>
        <div className="flex gap-2 flex-wrap justify-between">
          <span className="text-sm font-medium">
            {enabledPlugins[plugin.id] ? 'On' : 'Off'}
          </span>
          {/*checkbox */}
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
          {/* end of checkbox */}
        </div>
        <div>
          <div>
            <p className="text-sm font-medium">Description</p>
            <div>
              {plugin.description.split('\n').map((paragraph, index) => (
                <p key={index} className="mb-2">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </div>
        <hr className="solid my-4 w-full border-t border-divider dark:border-gray-700" />

        <div>
          <p className="text-sm font-medium">Version</p>
          <p>{plugin.version}</p>
        </div>
        <hr className="solid my-4 w-full border-t border-divider dark:border-gray-700" />

        <div>
          <p className="text-sm font-medium">Size</p>
          <p>1mb</p>
        </div>
        <hr className="solid my-4 w-full border-t border-divider dark:border-gray-700" />
        <div className="flex justify-between flex-wrap">
          <p>View Plugin Folder</p>
          <FaExternalLinkAlt
            className="cursor-pointer"
            onClick={async (e) => {
              e.stopPropagation();
              await window.downlodrFunctions.openVideo(pluginLocation);
            }}
          />
        </div>
        <hr className="solid my-4 w-full border-t border-divider dark:border-gray-700" />
        <div className="flex justify-between flex-wrap">
          <p>View in Downloadr Web Store</p>
          <FaExternalLinkAlt
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              window.downlodrFunctions.openExternalLink(
                'https://downlodr.com/plugin/',
              );
            }}
          />
        </div>
        <hr className="solid my-4 w-full border-t border-divider dark:border-gray-700 mb-4" />
        <div className="flex justify-between flex-wrap">
          <p>Remove Extension</p>
          <IoIosArrowForward
            className="cursor-pointer"
            onClick={() => handleUninstall(plugin.id)}
          />
        </div>
      </div>
    </div>
  );
};

export default PluginDetails;
