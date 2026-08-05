import { Button } from '@/core-app/components/shadcn/components/ui/button';
import { getFirstParagraph } from '@/core-app/utils/stringHelper';
import { PluginInfo } from '@/plugins/schema/types';
import { usePluginStore } from '@/plugins/store/pluginStore';
import { renderIcon } from '@/plugins/utils/pluginIconHelper';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuDownload, LuFiles, LuUsers } from 'react-icons/lu';
import { RxUpdate } from 'react-icons/rx';
import { NavLink } from 'react-router-dom';

interface PluginCardProps {
  plugin: PluginInfo;
  pluginType: 'installed' | 'browse';
  onClickButton?: () => void;
  enabledPlugins?: Record<string, boolean>;
  onClickToggle?: () => void;
  onInstall?: () => void;
  onCheckUpdates?: () => void;
  isInstalling?: boolean;
}
const PluginCard = ({
  plugin,
  pluginType,
  onClickButton,
  enabledPlugins,
  onClickToggle,
  onInstall,
  onCheckUpdates,
  isInstalling,
}: PluginCardProps) => {
  const { t } = useTranslation('plugins');
  const { plugins } = usePluginStore();
  const [fileSize, setFileSize] = useState<string>('...');

  const isPluginInstalled = plugins.some((p) => p.name === plugin.name);

  useEffect(() => {
    const getFileSize = async () => {
      // Convert bytes to human readable format
      const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return plugin.size ? String(plugin.size) : '5 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
      };
      try {
        if (plugin.id) {
          if (plugin.location) {
            const sizeInBytes = await window.downlodrFunctions.getDirectorySize(
              plugin.location,
            );
            setFileSize(formatFileSize(sizeInBytes));
          } else {
            // For browse plugins, check if we have a formatted size string
            const formattedSize = (
              plugin as PluginInfo & { formattedSize?: string }
            ).formattedSize;
            setFileSize(
              formattedSize || (plugin.size ? String(plugin.size) : '5 B'),
            );
          }
        }
      } catch (error) {
        console.error('Failed to get file size:', error);
        setFileSize(t('pluginButtons.unknownSize'));
      }
    };

    getFileSize();
  }, [plugin.id]);

  return (
    <div className="w-sm bg-titleBar dark:bg-darkModeTable rounded-md p-4 shadow-md h-50 flex flex-col drop-shadow-sm hover:drop-shadow-lg transition-all duration-300">
      {/* Header section */}
      <div className="flex items-center mb-3">
        <div className="inline-flex items-center justify-center mr-3 flex-shrink-0 w-12 h-12 rounded-xl bg-gray-100 dark:bg-darkModeCompliment border border-gray-200 dark:border-darkModeHover overflow-hidden shadow-sm">
          {renderIcon(plugin.icon, 'lg', plugin.name)}
        </div>
        <div className="flex flex-col">
          <h3 className="text-lg text-[14px] font-semibold truncate">
            {plugin.name}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center">
            <span className="mr-1">
              <LuUsers />
            </span>
            {plugin.author}
          </p>
        </div>
      </div>

      {/* Description section - takes remaining space */}
      <div className="flex-1 flex flex-col justify-start min-h-0 mt-2">
        <p className="text-xs line-clamp-4 overflow-hidden h-12 leading-4">
          {getFirstParagraph(plugin.description, plugin.name)}
        </p>
      </div>

      {/* Button section - always at bottom */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center">
          <span className="mr-1">
            <LuDownload />
          </span>
          {fileSize}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center">
          {t('pluginButtons.version', { version: plugin.version })}
        </p>
      </div>

      {/* Button section - always at bottom */}
      <div className="flex-shrink-0">
        {pluginType === 'installed' && (
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex gap-2 flex-wrap">
              <NavLink to="/plugins/details" state={{ plugin }}>
                <Button
                  variant="outline"
                  className="text-xs font-semibold dark:border-darkModeCompliment border-2 px-2 py-0 dark:hover:bg-darkModeDropdown dark:bg-darkModeDropdown hover:text-primary dark:hover:text-primary"
                >
                  {t('pluginButtons.details')}
                </Button>
              </NavLink>
              <Button
                variant="outline"
                className="text-xs font-semibold border-2 px-2 py-0 dark:hover:bg-darkModeDropdown dark:bg-darkModeDropdown dark:border-darkModeCompliment hover:text-primary dark:hover:text-primary"
                onClick={onClickButton}
              >
                {t('pluginButtons.remove')}
              </Button>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={enabledPlugins?.[plugin.id] || false}
                  onChange={onClickToggle}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-500"></div>
              </label>
            </div>
          </div>
        )}

        {pluginType === 'browse' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
            <Button
              variant="outline"
              className="text-xs w-full border-2 px-2 py-0 dark:hover:bg-darkModeDropdown dark:bg-darkModeDropdown dark:border-darkModeCompliment hover:text-primary dark:hover:text-primary"
              icon={<LuFiles />}
              onClick={() => {
                window.downlodrFunctions.openExternalLink(plugin.downlodrLink ?? '');
              }}
            >
              {t('pluginButtons.moreDetails')}
            </Button>

            {isPluginInstalled ? (
              <Button
                variant="default"
                className="text-xs w-full pl-1 pr-2 py-0 bg-[#F45513] dark:bg-[#F45513] text-white dark:text-white dark:hover:text-black dark:hover:bg-white dark:border-darkModeCompliment"
                icon={<RxUpdate />}
                onClick={onCheckUpdates}
                disabled={isInstalling}
              >
                {isInstalling ? t('pluginButtons.updating') : t('pluginButtons.checkForUpdates')}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="text-xs w-full pl-2 pr-3 py-0 bg-black text-white hover:bg-black/70 dark:hover:bg-darkModeDropdown dark:bg-darkModeDropdown dark:border-darkModeCompliment hover:text-white dark:hover:text-primary"
                icon={<LuDownload />}
                onClick={onInstall}
                disabled={isInstalling}
              >
                {isInstalling ? t('pluginButtons.installing') : t('pluginButtons.install')}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PluginCard;
