import { Button } from '@/Components/SubComponents/shadcn/components/ui/button';
import { toast } from '@/Components/SubComponents/shadcn/hooks/use-toast';
import { usePluginStore } from '@/Store/pluginStore';
import { useTaskbarDownloadStore } from '@/Store/taskbarDownloadStore';
import React from 'react';
import { FaPlus } from 'react-icons/fa';
import { NavLink, useLocation } from 'react-router-dom';

interface PageNavigationProps {
  className?: string;
}

const PageNavigation: React.FC<PageNavigationProps> = ({ className = '' }) => {
  const location = useLocation();

  const { updateIsOpenPluginSidebar, plugins, loadPlugins } = usePluginStore();
  const { isSelectingDirectory, setIsSelectingDirectory } =
    useTaskbarDownloadStore();

  const handleClosePanel = () => {
    updateIsOpenPluginSidebar(false);
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
          await loadPlugins();
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

  return (
    <div className="flex justify-between items-center w-full">
      <div className={`flex items-center ${className} gap-2`}>
        <NavLink
          to="/status/all"
          className={({ isActive }) =>
            `px-1 md:px-2 py-1 rounded flex gap-1 font-semibold ${
              isActive || !location.pathname.startsWith('/plugins')
                ? 'bg-[#F5F5F5] text-[#F45513] dark:bg-darkModeNavigation'
                : 'hover:bg-gray-100 dark:hover:bg-darkModeNavigation dark:text-gray-200'
            }`
          }
          end={false}
        >
          <span>Downloads</span>
        </NavLink>
        <NavLink
          to="/plugins"
          className={({ isActive }) =>
            `px-3 py-1 rounded flex gap-1 font-semibold ${
              isActive
                ? 'bg-[#F5F5F5] text-[#F45513] dark:bg-darkModeNavigation'
                : 'hover:bg-gray-100 dark:hover:bg-darkModeNavigation dark:text-gray-200'
            }`
          }
          onClick={handleClosePanel}
        >
          <span>Plugins</span>
        </NavLink>
      </div>

      {plugins.length > 0 && location.pathname.startsWith('/plugins') && (
        <div className="flex items-center">
          <Button
            variant="default"
            onClick={handleInstall}
            className="text-md bg-[#F45513] dark:bg-[#F45513] dark:text-white dark:hover:text-black dark:hover:bg-white font-normal px-4 py-1 h-8 ml-4"
            icon={<FaPlus />}
          >
            Add Plugin
          </Button>
        </div>
      )}
    </div>
  );
};

export default PageNavigation;
