/**
 * A custom React component
 * A React component that displays a context menu for managing downloads.
 * It provides options to pause, stop, remove, and view downloads, as well as manage tags and categories.
 *
 * @param DownloadContextMenuProps
 *   @param downloadId - The unique identifier for the download.
 *   @param position - An object containing the x and y coordinates for positioning the menu.
 *   @param downloadLocation - The location of the download file.
 *   @param controllerId - The ID of the controller managing the download.
 *   @param downloadStatus - The current status of the download.
 *   @param onClose - A function to call when the menu should be closed.
 *   @param onPause - A function to pause the download.
 *   @param onStop - A function to stop the download.
 *   @param onForceStart - A function to force start the download.
 *   @param onRemove - A function to remove the download.
 *   @param onViewDownload - A function to view the download.
 *   @param onAddTag - A function to add a tag to the download.
 *   @param onRemoveTag - A function to remove a tag from the download.
 *   @param currentTags - An array of current tags for the download.
 *   @param availableTags - An array of all available tags in the system.
 *   @param onAddCategory - A function to add a category to the download.
 *   @param onRemoveCategory - A function to remove a category from the download.
 *   @param currentCategories - An array of current categories for the download.
 *   @param availableCategories - An array of all available categories in the system.
 *   @param onViewFolder - A function to view the folder containing the download.
 *   @param downloadName - The name of the download file.
 *   @param onRename - A function to rename the download.
 *   @param onShowRemoveModal - A function to show the remove confirmation modal.
 *   @param onShowStopModal - A function to show the stop confirmation modal.
 *
 * @returns JSX.Element - The rendered context menu component.
 */

import { toast } from '@/Components/SubComponents/shadcn/hooks/use-toast';
import { processFileName } from '@/DataFunctions/FilterName';
import { usePluginState } from '@/plugins/Hooks/usePluginState';
import { MenuItem } from '@/plugins/types';
import useDownloadStore, { BaseDownload } from '@/Store/downloadStore';
import { useMainStore } from '@/Store/mainStore';
import React, { useEffect, useState } from 'react';
import { BsArrowCounterclockwise } from 'react-icons/bs';
import { FaTerminal } from 'react-icons/fa';
import { GoChevronRight, GoPlus } from 'react-icons/go';
import { HiOutlineStopCircle } from 'react-icons/hi2';
import { IoCodeSlashSharp, IoPauseCircleOutline } from 'react-icons/io5';
import { LiaFileVideoSolid, LiaTagsSolid } from 'react-icons/lia';
import { LuFolderOpen, LuTrash } from 'react-icons/lu';
import { MdEdit, MdOutlinePlayCircle } from 'react-icons/md';
import { PiPuzzlePieceBold } from 'react-icons/pi';

interface DownloadContextMenuProps {
  download: BaseDownload;
  position: { x: number; y: number };
  onClose: () => void; // Function to close the context menu
  onPause: (
    id: string,
    downloadLocation?: string,
    controllerId?: string,
    downloadStatus?: string,
  ) => void; // Function to pause the download'
  onRetry: (downloadId: string) => void; // Function to retry the download
  onShowLog: (downloadId: string) => void; // Function to show the log of the download
  onShowActivityTracker: (downloadId: string) => void; // Function to show the activity tracker of the download
  onStop: (
    id: string,
    downloadLocation?: string,
    controllerId?: string,
  ) => void; // Function to stop the download
  onForceStart: (
    id: string,
    downloadLocation?: string,
    controllerId?: string,
  ) => void; // Function to force start the download
  onRemove: (
    downloadLocation?: string,
    id?: string,
    controllerId?: string,
    deleteFolder?: boolean,
  ) => void; // Function to remove the download
  onViewDownload: (downloadLocation?: string, downloadId?: string) => void; // Function to view the download
  onAddTag: (downloadId: string, tag: string) => void; // Function to add a tag to the download
  onRemoveTag: (downloadId: string, tag: string) => void; // Function to remove a tag from the download
  currentTags: string[]; // Array of current tags for the download
  availableTags: string[]; // Array of all available tags in the system
  onAddCategory: (downloadId: string, category: string) => void; // Function to add a category to the download
  onRemoveCategory: (downloadId: string, category: string) => void; // Function to remove a category from the download
  currentCategories: string[]; // Array of current categories for the download
  availableCategories: string[]; // Array of all available categories in the system
  onViewFolder: (downloadLocation?: string, downloadFile?: string) => void; // Function to view the folder containing the download
  onRename: (downloadId: string, currentName: string) => void; //
  onShowRemoveModal: (
    downloadId: string,
    downloadLocation?: string,
    controllerId?: string,
  ) => void;
  onShowStopModal: (
    downloadId: string,
    downloadLocation?: string,
    controllerId?: string,
  ) => void;
}

const DownloadContextMenu: React.FC<DownloadContextMenuProps> = ({
  download,
  position,
  onClose,
  onPause,
  onRetry,
  onShowLog,
  onShowActivityTracker,
  onStop,
  onForceStart,
  onRemove,
  onViewDownload,
  onAddTag,
  onRemoveTag,
  currentTags = [],
  availableTags = [],
  onAddCategory,
  onRemoveCategory,
  currentCategories = [],
  availableCategories = [],
  onViewFolder,
  onRename,
  onShowRemoveModal,
  onShowStopModal,
}) => {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const tagButtonRef = React.useRef<HTMLButtonElement>(null);
  const categoryButtonRef = React.useRef<HTMLButtonElement>(null);
  const pluginButtonRef = React.useRef<HTMLButtonElement>(null);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [showPluginMenu, setShowPluginMenu] = useState(false);
  const [submenuPosition, setSubmenuPosition] = useState({ x: 0, y: 0 });

  const { settings } = useMainStore();
  const {
    downloading,
    addQueue,
    removeFromForDownloads,
    forDownloads,
    finishedDownloads,
  } = useDownloadStore();
  const allDownloads = [...forDownloads, ...downloading, ...finishedDownloads]; //Plugins
  const [pluginMenuItems, setPluginMenuItems] = useState<MenuItem[]>([]);
  const enabledPlugins = usePluginState();

  const fetchPluginMenuItems = async () => {
    try {
      const items = await window.plugins.getMenuItems('download');
      const filteredItems = (items || []).filter(
        (item) => !item.pluginId || enabledPlugins[item.pluginId] !== false,
      ) as MenuItem[];
      setPluginMenuItems(filteredItems);
    } catch (error) {
      console.error('Failed to fetch plugin menu items:', error);
      setPluginMenuItems([]);
    }
  };

  // Listen for plugins ready event
  useEffect(() => {
    const handlePluginsReady = () => {
      fetchPluginMenuItems();
    };

    window.addEventListener('pluginsReady', handlePluginsReady);

    // Initial fetch
    fetchPluginMenuItems();

    return () => {
      window.removeEventListener('pluginsReady', handlePluginsReady);
    };
  }, []);

  // Handle plugin state changes
  useEffect(() => {
    fetchPluginMenuItems();
  }, [enabledPlugins]);

  // Function to recalculate submenu position
  const recalculateSubmenuPosition = (
    buttonRef: React.RefObject<HTMLButtonElement>,
    itemCount: number,
    menuType: 'tag' | 'category' | 'plugin',
  ) => {
    if (buttonRef.current && menuRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const menuRect = menuRef.current.getBoundingClientRect();

      let submenuX = menuRect.right + 1;
      let submenuY = buttonRect.top;

      // Calculate the height of the submenu based on type
      let submenuHeight;
      if (menuType === 'plugin') {
        submenuHeight = Math.min(itemCount * 40, 300);
      } else {
        const inputAreaHeight = 80; // approximate height of input area + divider
        const maxListHeight = 192; // max-h-48 = 192px
        const actualListHeight = Math.min(itemCount * 40, maxListHeight);
        submenuHeight = inputAreaHeight + actualListHeight;
      }

      // If the submenu would overflow the bottom, shift up
      if (submenuY + submenuHeight > window.innerHeight - 10) {
        submenuY = Math.max(10, window.innerHeight - submenuHeight - 10);
      }
      // If the submenu would overflow the top, shift down
      if (submenuY < 10) {
        submenuY = 10;
      }

      // Check if submenu would overflow viewport horizontally and adjust if needed
      const submenuWidth = 200; // approximate width
      if (submenuX + submenuWidth > window.innerWidth) {
        submenuX = menuRect.left - submenuWidth - 1; // Position to the left instead
      }

      setSubmenuPosition({ x: submenuX, y: submenuY });
    }
  };

  // Recalculate tag submenu position when available tags change
  useEffect(() => {
    if (showTagMenu) {
      recalculateSubmenuPosition(tagButtonRef, availableTags.length, 'tag');
    }
  }, [availableTags.length, showTagMenu]);

  // Recalculate category submenu position when available categories change
  useEffect(() => {
    if (showCategoryMenu) {
      recalculateSubmenuPosition(
        categoryButtonRef,
        availableCategories.length,
        'category',
      );
    }
  }, [availableCategories.length, showCategoryMenu]);

  // Recalculate plugin submenu position when plugin items change
  useEffect(() => {
    if (showPluginMenu) {
      recalculateSubmenuPosition(
        pluginButtonRef,
        pluginMenuItems.length,
        'plugin',
      );
    }
  }, [pluginMenuItems.length, showPluginMenu]);

  // Helper function to check if a string is an SVG
  const isSvgString = (str: string): boolean => {
    return str.trim().startsWith('<svg') && str.trim().endsWith('</svg>');
  };

  useEffect(() => {
    if (menuRef.current) {
      const checkAndAdjustPosition = () => {
        if (menuRef.current) {
          const menuRect = menuRef.current.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const viewportWidth = window.innerWidth;
          const margin = 10;
          let needsAdjustment = false;
          let newX = position.x;
          let newY = position.y;

          // Calculate approximate menu height based on number of items
          const itemHeight = 40; // approximate height of each menu item
          const baseMenuHeight = itemHeight * 7; // All download statuses have 6 base menu items (including Tags and Category)
          const pluginItemsHeight =
            pluginMenuItems.length <= 4
              ? pluginMenuItems.length * itemHeight +
                (pluginMenuItems.length > 0 ? 10 : 0) // show all plugin items + divider height
              : itemHeight + 10; // show just the Plugins button + divider height
          const totalMenuHeight = baseMenuHeight + pluginItemsHeight;

          // Only adjust if menu is actually overflowing
          if (menuRect.bottom > viewportHeight - margin) {
            newY = Math.max(margin, viewportHeight - totalMenuHeight - margin);
            needsAdjustment = true;
          }

          if (menuRect.right > viewportWidth - margin) {
            newX = Math.max(margin, viewportWidth - menuRect.width - margin);
            needsAdjustment = true;
          }

          if (menuRect.left < margin) {
            newX = margin;
            needsAdjustment = true;
          }

          if (menuRect.top < margin) {
            newY = margin;
            needsAdjustment = true;
          }

          if (needsAdjustment) {
            menuRef.current.style.left = `${newX}px`;
            menuRef.current.style.top = `${newY}px`;
          }
        }
      };

      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(checkAndAdjustPosition);
    }
  }, [position, pluginMenuItems.length, download.status]);

  // Function to handle opening tag menu
  const handleTagMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    setShowCategoryMenu(false); // Close category menu
    setShowPluginMenu(false); // Close plugin menu
    const newShowTagMenu = !showTagMenu;
    setShowTagMenu(newShowTagMenu);

    // Calculate position for submenu
    if (newShowTagMenu) {
      recalculateSubmenuPosition(tagButtonRef, availableTags.length, 'tag');
    }
  };

  // Function to handle opening category menu
  const handleCategoryMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    setShowTagMenu(false); // Close tag menu
    setShowPluginMenu(false); // Close plugin menu
    const newShowCategoryMenu = !showCategoryMenu;
    setShowCategoryMenu(newShowCategoryMenu);

    // Calculate position for submenu
    if (newShowCategoryMenu) {
      recalculateSubmenuPosition(
        categoryButtonRef,
        availableCategories.length,
        'category',
      );
    }
  };

  // Function to handle opening plugin menu
  const handlePluginMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    setShowTagMenu(false);
    setShowCategoryMenu(false);
    const newShowPluginMenu = !showPluginMenu;
    setShowPluginMenu(newShowPluginMenu);

    // Calculate position for submenu
    if (newShowPluginMenu) {
      recalculateSubmenuPosition(
        pluginButtonRef,
        pluginMenuItems.length,
        'plugin',
      );
    }
  };

  // Function to start the download
  const handleStartDownload = async () => {
    // Process the filename first
    const processedName = await processFileName(
      download.location || '',
      download.name || '',
      download.ext || download.audioExt,
    );

    if (downloading.length >= settings.maxDownloadNum) {
      toast({
        variant: 'destructive',
        title: 'Download limit reached',
        description: `Maximum download limit (${settings.maxDownloadNum}) reached. Please wait for current downloads to complete or increase limit via settings.`,
        duration: 3000,
      });
      return;
    }

    // Add to queue - let the download controller handle starting it
    addQueue(
      download.videoUrl || '',
      `${processedName}.${download.ext || ''}`,
      `${processedName}.${download.ext || ''}`,
      download.size || 0,
      download.speed || '0 KB/s',
      download.channelName || '',
      download.timeLeft || '0:00:00',
      new Date().toISOString(),
      download.progress || 0,
      download.location || '',
      'queued',
      download.ext || '',
      download.formatId || '',
      download.audioExt || '',
      download.audioFormatId || '',
      download.extractorKey || '',
      settings.defaultDownloadSpeed === 0
        ? ''
        : `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`,
      download.automaticCaption || false,
      download.thumbnails || [],
      download.getTranscript || false,
      download.getThumbnail || false,
      download.duration || 60,
      true,
    );

    // Remove from forDownloads
    removeFromForDownloads(download.id || '');

    toast({
      title: 'Download Added to Queue',
      description: `"${processedName}" added to queue. The download controller will start it automatically.`,
      duration: 3000,
    });

    onClose();
  };

  // Function to render menu options based on download status
  const renderMenuOptions = () => {
    const viewFolderOption = (
      <>
        <button
          className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
          onClick={() => {
            onViewFolder(download.location, download.name);
            onClose();
          }}
        >
          <span className="flex items-center space-x-2">
            <LuFolderOpen size={18} />
            <span>View Folder</span>
          </span>
        </button>
      </>
    );

    const commonOptions = (
      <>
        <button
          ref={tagButtonRef}
          className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
          onClick={handleTagMenuClick}
        >
          <span className="flex items-center space-x-2">
            <LiaTagsSolid size={18} />
            <span>Tags</span>
          </span>
          <span className="ml-auto">
            <GoChevronRight size={18} />
          </span>
        </button>

        <button
          ref={categoryButtonRef}
          className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
          onClick={handleCategoryMenuClick}
        >
          <span className="flex items-center space-x-2">
            <LiaTagsSolid size={18} />
            <span>Category</span>
          </span>
          <span className="ml-auto">
            <GoChevronRight size={18} />
          </span>
        </button>
      </>
    );

    const activityTrackerOption = (
      <>
        <button
          className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
          onClick={() => {
            onShowActivityTracker(download.id || '');
            onClose();
          }}
        >
          <span className="flex items-center space-x-2">
            <FaTerminal size={13} />
            <span>Show Activity Tracker</span>
          </span>
        </button>
      </>
    );

    const pausedOptions = (
      <>
        <button
          className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
          onClick={() => {
            onPause(
              download.id || '',
              download.location,
              download.controllerId,
              download.status,
            );
            onClose();
          }}
        >
          <span className="flex items-center space-x-2">
            <IoPauseCircleOutline size={20} />
            <span>Pause</span>
          </span>
        </button>
      </>
    );

    const stopOptions = (
      <>
        <button
          className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
          onClick={(e) => {
            e.stopPropagation();
            onShowStopModal(
              download.id || '',
              download.location,
              download.controllerId,
            );
            onClose();
          }}
        >
          <span className="flex items-center space-x-2">
            <HiOutlineStopCircle size={20} />
            <span>Stop</span>
          </span>
        </button>
      </>
    );

    const removeOptions = (
      <>
        <button
          className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
          onClick={(e) => {
            e.stopPropagation();
            onShowRemoveModal(
              download.id || '',
              download.location,
              download.controllerId,
            );
            onClose();
          }}
        >
          <span className="flex items-center space-x-2">
            <LuTrash size={16} />
            <span>Remove</span>
          </span>
        </button>
      </>
    );

    const showLogOption = (
      <>
        <button
          className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
          onClick={() => {
            onShowLog(download.id || '');
            onClose();
          }}
        >
          <span className="flex items-center space-x-2">
            <IoCodeSlashSharp size={16} />
            <span>Show Logs</span>
          </span>
        </button>
      </>
    );

    const startOption = (
      <>
        <button
          className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
          onClick={handleStartDownload}
        >
          <span className="flex items-center space-x-2">
            <MdOutlinePlayCircle size={16} />
            <span>Start</span>
          </span>
        </button>
      </>
    );

    const startFromPausedOption = (
      <>
        <button
          className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
          onClick={() => {
            onPause(
              download.id || '',
              download.location,
              download.controllerId,
              download.status,
            );
            onClose();
          }}
        >
          <span className="flex items-center space-x-2">
            <MdOutlinePlayCircle size={20} />
            <span>Start</span>
          </span>
        </button>
      </>
    );

    if (download.status === 'failed') {
      return (
        <>
          {viewFolderOption}
          <button
            className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={() => {
              onRetry(download.id || '');
              onClose();
            }}
          >
            <span className="flex items-center space-x-2">
              <BsArrowCounterclockwise size={20} />
              <span>Retry</span>
            </span>
          </button>
          {removeOptions}
          {showLogOption}
          {activityTrackerOption}
        </>
      );
    }

    if (download.status === 'finished') {
      return (
        <>
          {viewFolderOption}
          <button
            className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={() => {
              onViewDownload(download.location, download.id);
              onClose();
            }}
          >
            <span className="flex items-center space-x-2">
              <LiaFileVideoSolid size={20} />
              <span>Play Download</span>
            </span>
          </button>
          {removeOptions}
          {showLogOption}
          {activityTrackerOption}
          {commonOptions}
          {renderPluginMenuItems()}
        </>
      );
    }

    if (download.status === 'initializing') {
      return (
        <>
          {viewFolderOption}
          {pausedOptions}
          {stopOptions}
          {showLogOption}
          {activityTrackerOption}
        </>
      );
    }

    if (download.status === 'paused') {
      return (
        <>
          {viewFolderOption}
          {startFromPausedOption}
          {stopOptions}
          {showLogOption}
          {activityTrackerOption}
        </>
      );
    }

    if (download.status === 'to download') {
      return (
        <>
          {viewFolderOption}
          {startOption}
          <button
            className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={(e) => {
              e.stopPropagation();
              onRename(download.id || '', download.name || '');
              onClose();
            }}
          >
            <span className="flex items-center space-x-2">
              <MdEdit size={20} />
              <span>Rename</span>
            </span>
          </button>
          {removeOptions}
          {activityTrackerOption}
        </>
      );
    }

    if (download.status === 'downloading') {
      return (
        <>
          {viewFolderOption}
          {pausedOptions}
          {stopOptions}
          {showLogOption}
          {activityTrackerOption}
          {commonOptions}
        </>
      );
    }

    return <>{viewFolderOption}</>;
  };

  const renderPluginMenuItems = () => {
    if (!pluginMenuItems || pluginMenuItems.length === 0) return null;

    // If 4 or fewer plugins, show them directly
    if (pluginMenuItems.length <= 4) {
      return (
        <>
          {/* Divider if there are other menu items */}
          <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>

          {/* Plugin menu items */}
          {pluginMenuItems.map((item) => (
            <button
              key={item.id || item.label}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
              onClick={() => {
                const contextData = {
                  name: download.name || '',
                  downloadId: download.id || '',
                  videoUrl: allDownloads.find((d) => d.id === download.id)
                    ?.videoUrl,
                  location: download.location,
                  status: download.status,
                  duration: allDownloads.find((d) => d.id === download.id)
                    ?.duration,
                  size: allDownloads.find((d) => d.id === download.id)?.size,
                  ext: allDownloads.find((d) => d.id === download.id)?.ext,
                  captionLocation: allDownloads.find(
                    (d) => d.id === download.id,
                  )?.autoCaptionLocation,
                  thumbnailLocation: allDownloads.find(
                    (d) => d.id === download.id,
                  )?.thumnailsLocation,
                  extractorKey: allDownloads.find((d) => d.id === download.id)
                    ?.extractorKey,
                };

                if (
                  item.handlerId &&
                  window.PluginHandlers &&
                  window.PluginHandlers[item.handlerId]
                ) {
                  window.PluginHandlers[item.handlerId](contextData);
                } else {
                  window.plugins.executeMenuItem(item.id || '', contextData);
                }

                onClose();
              }}
            >
              <span className="flex items-center space-x-2">
                {item.icon && (
                  <span className="inline-flex items-center justify-center w-5 h-5 mr-2">
                    {typeof item.icon === 'string' && isSvgString(item.icon) ? (
                      <span
                        dangerouslySetInnerHTML={{ __html: item.icon }}
                        className="text-black dark:text-white"
                      />
                    ) : (
                      <span>{item.icon}</span>
                    )}
                  </span>
                )}
                <span>{item.label}</span>
              </span>
            </button>
          ))}
        </>
      );
    }

    // If more than 4 plugins, show a Plugin button
    return (
      <>
        {/* Divider if there are other menu items */}
        <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>

        <button
          ref={pluginButtonRef}
          className="w-full text-left px-5 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
          onClick={handlePluginMenuClick}
        >
          <span className="flex items-center space-x-2">
            <PiPuzzlePieceBold size={17} />
            <span>Plugins ({pluginMenuItems.length})</span>
          </span>
          <span className="ml-auto">
            <GoChevronRight size={20} />
          </span>
        </button>
      </>
    );
  };

  return (
    <>
      <div
        ref={menuRef}
        className="fixed bg-white dark:bg-darkMode border rounded-md shadow-lg py-1 z-50 dark:border-gray-700 min-w-[175px]"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        {renderMenuOptions()}
      </div>

      {/* Render submenus outside of main menu container */}
      {showTagMenu && (
        <div
          className="fixed bg-white dark:bg-darkMode border rounded-md shadow-lg py-1 min-w-[180px] z-50 dark:border-gray-700"
          style={{
            left: `${submenuPosition.x}px`,
            top: `${submenuPosition.y}px`,
            maxHeight: '80vh',
            overflowY: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="m-2 px-3 py-2 flex flex-row border rounded dark:border-gray-700">
            <GoPlus size={22} className="ml-[-10px] mr-2 dark:text-gray-200" />
            <div className="flex-1">
              <input
                type="text"
                placeholder="Add new tag..."
                maxLength={10}
                onKeyDown={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (
                    e.key === 'Enter' &&
                    target.value.trim() &&
                    target.value.trim().length <= 10
                  ) {
                    const newTag = target.value.trim();

                    // Check for duplicates (case-insensitive)
                    const isDuplicate = availableTags.some(
                      (existingTag) =>
                        existingTag.toLowerCase() === newTag.toLowerCase(),
                    );

                    if (isDuplicate) {
                      toast({
                        variant: 'destructive',
                        title: 'Duplicate Tag',
                        description: `Tag "${newTag}" already exists.`,
                        duration: 2000,
                      });
                    } else {
                      onAddTag(download.id || '', newTag);
                      toast({
                        title: 'Tag Added',
                        description: `Tag "${newTag}" has been added.`,
                        duration: 2000,
                      });
                    }
                    target.value = '';
                  }
                }}
                className="w-full outline-none dark:bg-darkMode dark:text-gray-200"
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Max 10 characters
              </div>
            </div>
          </div>
          <hr className="solid mt-2 mb-1 mx-2 w-[calc(100%-20px)] border-t-2 border-divider dark:border-gray-700" />
          <div className="max-h-48 overflow-y-auto">
            {availableTags.map((tag) => (
              <button
                key={tag}
                className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-darkModeHover flex items-center gap-2 dark:text-gray-200"
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentTags.includes(tag)) {
                    onRemoveTag(download.id || '', tag);
                  } else {
                    onAddTag(download.id || '', tag);
                  }
                }}
              >
                <span className="dark:text-gray-200">
                  {currentTags.includes(tag) ? '✓' : ''}
                </span>
                <span>{tag}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showCategoryMenu && (
        <div
          className="fixed bg-white dark:bg-darkMode border rounded-md shadow-lg py-1 min-w-[185px] z-50 dark:border-gray-700"
          style={{
            left: `${submenuPosition.x}px`,
            top: `${submenuPosition.y}px`,
            maxHeight: '80vh',
            overflowY: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="m-2 px-3 py-2 flex flex-row border rounded dark:border-gray-700">
            <GoPlus size={22} className="ml-[-10px] mr-2 dark:text-gray-200" />
            <div className="flex-1">
              <input
                type="text"
                placeholder="Add new category..."
                maxLength={10}
                onKeyDown={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (
                    e.key === 'Enter' &&
                    target.value.trim() &&
                    target.value.trim().length <= 10
                  ) {
                    const newCategory = target.value.trim();

                    // Check for duplicates (case-insensitive)
                    const isDuplicate = availableCategories.some(
                      (existingCategory) =>
                        existingCategory.toLowerCase() ===
                        newCategory.toLowerCase(),
                    );

                    if (isDuplicate) {
                      toast({
                        variant: 'destructive',
                        title: 'Duplicate Category',
                        description: `Category "${newCategory}" already exists.`,
                        duration: 2000,
                      });
                    } else {
                      // Remove current category first (single category per download)
                      if (currentCategories.length > 0) {
                        onRemoveCategory(download.id, currentCategories[0]);
                      }
                      onAddCategory(download.id, newCategory);
                      toast({
                        title: 'Category Added',
                        description: `Category "${newCategory}" has been added.`,
                        duration: 2000,
                      });
                    }
                    target.value = '';
                  }
                }}
                className="w-full outline-none dark:bg-darkMode dark:text-gray-200"
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Max 10 characters
              </div>
            </div>
          </div>
          <hr className="solid mt-2 mb-1 mx-2 w-[calc(100%-20px)] border-t-2 border-divider dark:border-gray-700" />
          <div className="max-h-48 overflow-y-auto">
            {availableCategories.map((category) => (
              <button
                key={category}
                className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-darkModeHover flex items-center gap-2 dark:text-gray-200"
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentCategories.includes(category)) {
                    onRemoveCategory(download.id, category);
                  } else {
                    if (currentCategories.length > 0) {
                      onRemoveCategory(download.id, currentCategories[0]);
                    }
                    onAddCategory(download.id, category);
                  }
                }}
              >
                <span className="dark:text-gray-200">
                  {currentCategories.includes(category) ? '✓' : ''}
                </span>
                <span>{category}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showPluginMenu && (
        <div
          className="fixed bg-white dark:bg-darkMode border rounded-md shadow-lg py-1 min-w-[200px] z-50 dark:border-gray-700"
          style={{
            left: `${submenuPosition.x}px`,
            top: `${submenuPosition.y}px`,
            maxHeight: '80vh',
            overflowY: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {pluginMenuItems.map((item) => (
            <button
              key={item.id || item.label}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-darkModeHover flex items-center gap-2"
              onClick={() => {
                const contextData = {
                  name: download.name,
                  downloadId: download.id,
                  videoUrl: allDownloads.find((d) => d.id === download.id)
                    ?.videoUrl,
                  location: download.location,
                  status: download.status,
                  duration: allDownloads.find((d) => d.id === download.id)
                    ?.duration,
                  size: allDownloads.find((d) => d.id === download.id)?.size,
                  ext: allDownloads.find((d) => d.id === download.id)?.ext,
                  captionLocation: allDownloads.find(
                    (d) => d.id === download.id,
                  )?.autoCaptionLocation,
                  thumbnailLocation: allDownloads.find(
                    (d) => d.id === download.id,
                  )?.thumnailsLocation,
                  extractorKey: allDownloads.find((d) => d.id === download.id)
                    ?.extractorKey,
                };

                if (
                  item.handlerId &&
                  window.PluginHandlers &&
                  window.PluginHandlers[item.handlerId]
                ) {
                  window.PluginHandlers[item.handlerId](contextData);
                } else {
                  window.plugins.executeMenuItem(item.id || '', contextData);
                }

                onClose();
              }}
            >
              <span className="flex items-center space-x-2">
                {item.icon && (
                  <span className="inline-flex items-center justify-center w-5 h-5 mr-2">
                    {typeof item.icon === 'string' && isSvgString(item.icon) ? (
                      <span
                        dangerouslySetInnerHTML={{ __html: item.icon }}
                        className="text-black dark:text-white"
                      />
                    ) : (
                      <span>{item.icon}</span>
                    )}
                  </span>
                )}
                <span className="dark:text-gray-200">{item.label}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </>
  );
};

export default DownloadContextMenu;
