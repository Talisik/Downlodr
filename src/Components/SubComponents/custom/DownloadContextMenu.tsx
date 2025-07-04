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

import { PlayCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { BsArrowCounterclockwise } from 'react-icons/bs';
import { GoChevronRight, GoPlus } from 'react-icons/go';
import { HiOutlineStopCircle } from 'react-icons/hi2';
import { IoCodeSlashSharp, IoPauseCircleOutline } from 'react-icons/io5';
import { LiaFileVideoSolid, LiaTagsSolid } from 'react-icons/lia';
import { LuFolderOpen, LuTrash } from 'react-icons/lu';
import { MdEdit } from 'react-icons/md';
import { PiPuzzlePieceBold } from 'react-icons/pi';
import { VscDebugStart } from 'react-icons/vsc';
import { processFileName } from '../../../DataFunctions/FilterName';
import { usePluginState } from '../../../plugins/Hooks/usePluginState';
import { MenuItem } from '../../../plugins/types';
import useDownloadStore from '../../../Store/downloadStore';
import { useMainStore } from '../../../Store/mainStore';
import { toast } from '../shadcn/hooks/use-toast';

// import CategoryMenu from './CategoryMenu';
// import TagMenu from './TagsMenu';
// import FormatConverterMenu from './FormatConverterMenu';

// Interface representing the props for the DownloadContextMenu component
interface DownloadContextMenuProps {
  downloadId: string; // Unique identifier for the download
  position: { x: number; y: number }; // Position of the context menu
  downloadLocation?: string; // Location of the download file
  controllerId?: string; // ID of the controller managing the download
  downloadStatus?: string; // Current status of the download
  onClose: () => void; // Function to close the context menu
  onPause: (
    id: string,
    downloadLocation?: string,
    controllerId?: string,
    downloadStatus?: string,
  ) => void; // Function to pause the download'
  onRetry: (downloadId: string) => void; // Function to retry the download
  onShowLog: (downloadId: string) => void; // Function to show the log of the download
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
  downloadName?: string; // Name of the download file
  downloadFile?: string; // File of the download
  onRename: (downloadId: string, currentName: string) => void; // Add this
  onShowRemoveModal: (
    downloadId: string,
    downloadLocation?: string,
    controllerId?: string,
  ) => void; // Add this
  onShowStopModal: (
    downloadId: string,
    downloadLocation?: string,
    controllerId?: string,
  ) => void; // Add this
}

/*
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deleteFolder?: boolean) => void;
  message: string;
  allowFolderDeletion?: boolean;
}

interface RenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRename: (newName: string) => void;
  currentName: string;
}

const StopModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  message,
  allowFolderDeletion = false,
}) => {
  const [deleteFolder, setDeleteFolder] = useState(false);

  // Reset checkbox when modal opens
  useEffect(() => {
    if (isOpen) {
      setDeleteFolder(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-darkModeDropdown rounded-lg border border-darkModeCompliment p-6 max-w-lg w-full mx-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Stop Download
          </h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <IoMdClose size={20} />
          </button>
        </div>

        <p className="text-gray-700 dark:text-gray-300 mb-4">
          Are you sure you want to stop and remove this download?
        </p>

        <div className="flex justify-end space-x-3 bg-[#FEF9F4] dark:bg-darkMode -mx-6 -mb-6 px-4 py-3 rounded-b-lg border-t border-[#D9D9D9] dark:border-darkModeCompliment">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="px-4 py-1 text-gray-600 bg-white dark:bg-[#18181B] dark:text-white border dark:border-[#27272A] hover:bg-gray-50 dark:hover:bg-darkModeHover dark:hover:text-gray-200 rounded-md font-medium"
          >
            Cancel
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onConfirm(deleteFolder);
            }}
            className="px-4 py-1 bg-[#F45513] text-white rounded-md hover:bg-white hover:text-black font-medium"
          >
            Stop
          </button>
        </div>
      </div>
    </div>
  );
};

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  message,
  allowFolderDeletion = false,
}) => {
  const [deleteFolder, setDeleteFolder] = useState(false);

  // Reset checkbox when modal opens
  useEffect(() => {
    if (isOpen) {
      setDeleteFolder(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-darkModeDropdown rounded-lg border border-darkModeCompliment p-6 max-w-lg w-full mx-2"
        onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Remove selected item
          </h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <IoMdClose size={20} />
          </button>
        </div>

        <p className="text-gray-700 dark:text-gray-300 mb-4">
          Are you sure you want to remove these downloads from the download
          list?
        </p>

        {allowFolderDeletion && (
          <div className="mb-6">
            <label
              className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300"
              onClick={(e) => e.stopPropagation()} // Prevent label click from closing modal
            >
              <input
                type="checkbox"
                checked={deleteFolder}
                onChange={(e) => {
                  e.stopPropagation(); // Prevent checkbox change from closing modal
                  setDeleteFolder(e.target.checked);
                }}
                onClick={(e) => e.stopPropagation()} // Prevent checkbox click from closing modal
                className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
              />
              <span>Also remove the downloaded folder</span>
            </label>
          </div>
        )}

        <div className="flex justify-end space-x-3 bg-[#FEF9F4] dark:bg-darkMode -mx-6 -mb-6 px-4 py-3 rounded-b-lg border-t border-[#D9D9D9] dark:border-darkModeCompliment">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="px-4 py-1 text-gray-600 bg-white dark:bg-[#18181B] dark:text-white border dark:border-[#27272A] hover:bg-gray-50 dark:hover:bg-darkModeHover dark:hover:text-gray-200 rounded-md font-medium"
          >
            Cancel
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onConfirm(deleteFolder);
            }}
            className="px-4 py-1 bg-[#F45513] text-white rounded-md hover:bg-white hover:text-black font-medium"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
};

const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  onClose,
  onRename,
  currentName,
}) => {
  const [newName, setNewName] = useState(currentName);

  // Reset the input when modal opens or currentName changes
  useEffect(() => {
    if (isOpen) {
      setNewName(currentName);
    }
  }, [isOpen, currentName]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim() && newName.trim().length <= 50) {
      onRename(newName.trim());
      toast({
        variant: 'success',
        title: 'File Renamed',
        description: `Successfully renamed to ${newName}`,
        duration: 3000,
      });
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="bg-white dark:bg-darkModeDropdown rounded-lg p-6 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-medium mb-4 dark:text-gray-200">
          Rename Download
        </h3>
        <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={50}
            className="w-full p-2 border rounded mb-1 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {newName.length}/50 characters
          </div>
          <hr className="solid mb-2 -mx-6 w-[calc(100%+48px)] border-t-2 border-divider dark:border-gray-700" />

          <div className="flex justify-start space-x-2 mb-[-10px]">
            <button
              type="submit"
              onClick={(e) => e.stopPropagation()}
              className="px-4 py-1 bg-primary text-white rounded disabled:opacity-50"
              disabled={!newName.trim() || newName.trim().length > 50}
            >
              Save
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="px-4 py-1 border rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-darkModeHover dark:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
*/

const DownloadContextMenu: React.FC<DownloadContextMenuProps> = ({
  downloadId,
  position,
  downloadLocation,
  controllerId,
  downloadStatus,
  downloadFile,
  onClose,
  onPause,
  onRetry,
  onShowLog,
  // onStop,
  // onForceStart,
  // onRemove,
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
  downloadName = '',
  onRename,
  onShowRemoveModal,
  onShowStopModal,
}) => {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const tagButtonRef = React.useRef<HTMLButtonElement>(null);
  const categoryButtonRef = React.useRef<HTMLButtonElement>(null);
  const pluginButtonRef = React.useRef<HTMLButtonElement>(null);
  const [showTagMenu, setShowTagMenu] = useState(false); // State to track visibility of the tag menu
  const [showCategoryMenu, setShowCategoryMenu] = useState(false); // State to track visibility of the category menu
  const [showPluginMenu, setShowPluginMenu] = useState(false); // State to track visibility of the plugin menu
  const [submenuPosition, setSubmenuPosition] = useState({ x: 0, y: 0 });

  const { settings } = useMainStore();
  const {
    downloading,
    addDownload,
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
          const baseMenuHeight = itemHeight * 6; // All download statuses have 6 base menu items (including Tags and Category)
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
  }, [position, pluginMenuItems.length, downloadStatus]);

  // Function to handle opening tag menu
  const handleTagMenuClick = (e: React.MouseEvent) => {
    console.log(pluginMenuItems);
    e.stopPropagation();

    // Calculate position for submenu
    if (tagButtonRef.current && menuRef.current) {
      const buttonRect = tagButtonRef.current.getBoundingClientRect();
      const menuRect = menuRef.current.getBoundingClientRect();

      // Position submenu to the right of the main menu
      let submenuX = menuRect.right + 1;
      const submenuY = buttonRect.top;

      // Check if submenu would overflow viewport and adjust if needed
      const submenuWidth = 200; // approximate width
      if (submenuX + submenuWidth > window.innerWidth) {
        submenuX = menuRect.left - submenuWidth - 1; // Position to the left instead
      }

      setSubmenuPosition({ x: submenuX, y: submenuY });
    }

    setShowCategoryMenu(false); // Close category menu
    setShowTagMenu(!showTagMenu);
  };

  // Function to handle opening category menu
  const handleCategoryMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Calculate position for submenu
    if (categoryButtonRef.current && menuRef.current) {
      const buttonRect = categoryButtonRef.current.getBoundingClientRect();
      const menuRect = menuRef.current.getBoundingClientRect();

      // Position submenu to the right of the main menu
      let submenuX = menuRect.right + 1;
      const submenuY = buttonRect.top;

      // Check if submenu would overflow viewport and adjust if needed
      const submenuWidth = 200; // approximate width
      if (submenuX + submenuWidth > window.innerWidth) {
        submenuX = menuRect.left - submenuWidth - 1; // Position to the left instead
      }

      setSubmenuPosition({ x: submenuX, y: submenuY });
    }

    setShowTagMenu(false); // Close tag menu
    setShowCategoryMenu(!showCategoryMenu);
  };

  // Function to handle opening plugin menu
  const handlePluginMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // Calculate position for submenu
    if (pluginButtonRef.current && menuRef.current) {
      const buttonRect = pluginButtonRef.current.getBoundingClientRect();
      const menuRect = menuRef.current.getBoundingClientRect();

      // Position submenu to the right of the main menu
      let submenuX = menuRect.right + 1;
      let submenuY = buttonRect.top;

      // Always align submenu to the TOP of the plugin button
      // Calculate the height of the submenu
      const submenuHeight = Math.min(pluginMenuItems.length * 40, 300); // approximate height
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

    setShowTagMenu(false); // Close tag menu
    setShowCategoryMenu(false); // Close category menu
    setShowPluginMenu(!showPluginMenu);
  };

  // Function to start the download
  const handleStartDownload = async () => {
    // Find the download information from forDownloads using downloadId
    const currentDownload = forDownloads.find((d) => d.id === downloadId);

    if (!currentDownload) {
      console.error('Download not found in forDownloads');
      return;
    }

    // Process the filename first
    const processedName = await processFileName(
      currentDownload.location,
      currentDownload.name,
      currentDownload.ext || currentDownload.audioExt,
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
    // calls the addDownload function from store to start each selected download
    addDownload(
      currentDownload.videoUrl,
      `${processedName}.${currentDownload.ext}`,
      `${processedName}.${currentDownload.ext}`,
      currentDownload.size || 0,
      currentDownload.speed || '0 KB/s',
      currentDownload.timeLeft || '0:00:00',
      new Date().toISOString(),
      0,
      currentDownload.location,
      'downloading',
      currentDownload.ext || 'mp4',
      currentDownload.formatId || '',
      currentDownload.audioExt || '',
      currentDownload.audioFormatId || '',
      currentDownload.extractorKey || '',
      settings.defaultDownloadSpeed === 0
        ? ''
        : `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`,
      currentDownload.automaticCaption,
      currentDownload.thumbnails,
      currentDownload.getTranscript || false,
      currentDownload.getThumbnail || false,
      currentDownload.duration || 0,
      true,
    );

    removeFromForDownloads(currentDownload.id); // Remove from forDownloads after starting
    onClose();
  };

  // Function to render menu options based on download status
  const renderMenuOptions = () => {
    // Common options for tags and categories
    const commonOptions = (
      <>
        <button
          ref={tagButtonRef}
          className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
          onClick={handleTagMenuClick}
        >
          <span className="flex items-center space-x-2">
            <LiaTagsSolid size={20} />
            <span>Tags</span>
          </span>
          <span className="ml-auto">
            <GoChevronRight size={20} />
          </span>
        </button>

        <button
          ref={categoryButtonRef}
          className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
          onClick={handleCategoryMenuClick}
        >
          <span className="flex items-center space-x-2">
            <LiaTagsSolid size={20} />
            <span>Category</span>
          </span>
          <span className="ml-auto">
            <GoChevronRight size={20} />
          </span>
        </button>
      </>
    );

    if (downloadStatus === 'failed') {
      return (
        <>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={() => {
              onRetry(downloadId);
              onClose();
            }}
          >
            <span className="flex items-center space-x-2">
              <BsArrowCounterclockwise size={20} />
              <span>Retry</span>
            </span>
          </button>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={() => {
              onViewFolder(
                downloadLocation?.replace(/(\/|\\)[^/\\]+$/, ''),
                downloadFile,
              );
              onClose();
            }}
          >
            <span className="flex items-center space-x-2">
              <LuFolderOpen size={20} />
              <span>View Folder</span>
            </span>
          </button>

          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={(e) => {
              e.stopPropagation();
              onShowRemoveModal(downloadId, downloadLocation, controllerId);
              onClose();
            }}
          >
            <span className="flex items-center space-x-2">
              <LuTrash size={16} />
              <span>Remove</span>
            </span>
          </button>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={() => {
              onShowLog(downloadId);
              onClose();
            }}
          >
            <span className="flex items-center space-x-2">
              <IoCodeSlashSharp size={20} />
              <span>Show Log</span>
            </span>
          </button>
          {commonOptions}
        </>
      );
    }

    if (downloadStatus === 'finished') {
      return (
        <>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={() => {
              onViewDownload(downloadLocation, downloadId);
              onClose();
            }}
          >
            <span className="flex items-center space-x-2">
              <LiaFileVideoSolid size={20} />
              <span>Play Download</span>
            </span>
          </button>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={() => {
              onViewFolder(
                downloadLocation?.replace(/(\/|\\)[^/\\]+$/, ''),
                downloadFile,
              );
              onClose();
            }}
          >
            <span className="flex items-center space-x-2">
              <LuFolderOpen size={20} />
              <span>View Folder</span>
            </span>
          </button>

          {/* Add Format Converter option 
          <div className="relative">
            <button
              className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
              onClick={handleFormatConverterClick}
            >
              <span className="flex items-center space-x-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 15h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-2"></path>
                  <path d="M7 15H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h2"></path>
                  <line x1="8" y1="9" x2="16" y2="9"></line>
                  <line x1="8" y1="15" x2="16" y2="15"></line>
                </svg>
                <span>Format converter</span>
              </span>
              <span className="ml-auto">
                <GoChevronRight size={20} />
              </span>
            </button>

            {showFormatConverterMenu && (
              <FormatConverterMenu
                downloadId={downloadId}
                menuPositionClass={getTagMenuPositionClass()}
                onConvert={handleConvert}
              />
            )}
          </div>
*/}
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={(e) => {
              e.stopPropagation();
              onShowRemoveModal(downloadId, downloadLocation, controllerId);
              onClose();
            }}
          >
            <span className="flex items-center space-x-2">
              <LuTrash size={16} />
              <span>Remove</span>
            </span>
          </button>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={() => {
              onShowLog(downloadId);
              onClose();
            }}
          >
            <span className="flex items-center space-x-2">
              <IoCodeSlashSharp size={20} />
              <span>Show Log</span>
            </span>
          </button>
          {commonOptions}
          {renderPluginMenuItems()}
        </>
      );
    }

    if (downloadStatus === 'initializing') {
      return (
        <>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={() => {
              onViewFolder(
                downloadLocation?.replace(/(\/|\\)[^/\\]+$/, ''),
                downloadFile,
              );
              onClose();
            }}
          >
            <span className="flex items-center space-x-2">
              <LuFolderOpen size={20} />
              <span>View Folder</span>
            </span>
          </button>

          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={() => {
              onPause(
                downloadId,
                downloadLocation,
                controllerId,
                downloadStatus,
              );
              onClose();
            }}
          >
            <span className="flex items-center space-x-2">
              <IoPauseCircleOutline size={20} />
              <span>Pause</span>
            </span>
          </button>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={(e) => {
              e.stopPropagation();
              onShowStopModal(downloadId, downloadLocation, controllerId);
              onClose();
            }}
          >
            <span className="flex items-center space-x-2">
              <HiOutlineStopCircle size={20} />
              <span>Stop</span>
            </span>
          </button>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={() => {
              onShowLog(downloadId);
              onClose();
            }}
          >
            <span className="flex items-center space-x-2">
              <IoCodeSlashSharp size={20} />
              <span>Show Logs</span>
            </span>
          </button>
          {commonOptions}
        </>
      );
    }

    if (downloadStatus === 'paused') {
      return (
        <>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={() => {
              onViewFolder(
                downloadLocation?.replace(/(\/|\\)[^/\\]+$/, ''),
                downloadFile,
              );
              onClose();
            }}
          >
            <span className="flex items-center space-x-2">
              <LuFolderOpen size={20} />
              <span>View Folder</span>
            </span>
          </button>

          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={() => {
              onPause(
                downloadId,
                downloadLocation,
                controllerId,
                downloadStatus,
              );
              onClose();
            }}
          >
            <span className="flex items-center space-x-2">
              <VscDebugStart size={20} />
              <span>Start</span>
            </span>
          </button>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={(e) => {
              e.stopPropagation();
              onShowStopModal(downloadId, downloadLocation, controllerId);
              onClose();
            }}
          >
            <span className="flex items-center space-x-2">
              <HiOutlineStopCircle size={20} />
              <span>Stop</span>
            </span>
          </button>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={() => {
              onShowLog(downloadId);
              onClose();
            }}
          >
            <span className="flex items-center space-x-2">
              <VscDebugStart size={20} />
              <span>Start</span>
            </span>
          </button>
          {commonOptions}
        </>
      );
    }

    if (downloadStatus === 'to download') {
      return (
        <>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={handleStartDownload}
          >
            <span className="flex items-center space-x-2">
              <PlayCircle size={20} />
              <span>Start</span>
            </span>
          </button>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={() => {
              onViewFolder(
                downloadLocation?.replace(/(\/|\\)[^/\\]+$/, ''),
                downloadFile,
              );
              onClose();
            }}
          >
            <span className="flex items-center space-x-2">
              <LuFolderOpen size={20} />
              <span>View Folder</span>
            </span>
          </button>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={(e) => {
              e.stopPropagation();
              onRename(downloadId, downloadName);
              onClose();
            }}
          >
            <span className="flex items-center space-x-2">
              <MdEdit size={20} />
              <span>Rename</span>
            </span>
          </button>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={(e) => {
              e.stopPropagation();
              onShowRemoveModal(downloadId, downloadLocation, controllerId);
              onClose();
            }}
          >
            <span className="flex items-center space-x-2">
              <LuTrash size={16} />
              <span>Remove</span>
            </span>
          </button>
          {commonOptions}
        </>
      );
    }

    if (downloadStatus === 'downloading') {
      return (
        <>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={() => {
              onViewFolder(
                downloadLocation?.replace(/(\/|\\)[^/\\]+$/, ''),
                downloadFile,
              );
              onClose();
            }}
          >
            <span className="flex items-center space-x-2">
              <LuFolderOpen size={20} />
              <span>View Folder</span>
            </span>
          </button>

          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={() => {
              onPause(
                downloadId,
                downloadLocation,
                controllerId,
                downloadStatus,
              );
              onClose();
            }}
          >
            <span className="flex items-center space-x-2">
              <IoPauseCircleOutline size={20} />
              <span>Pause</span>
            </span>
          </button>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={(e) => {
              e.stopPropagation();
              onShowStopModal(downloadId, downloadLocation, controllerId);
              onClose();
            }}
          >
            <span className="flex items-center space-x-2">
              <HiOutlineStopCircle size={20} />
              <span>Stop</span>
            </span>
          </button>
          {/* 
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={() => {
              onForceStart(downloadId, downloadLocation, controllerId);
              onClose();
            }}
          >

            <span className="flex items-center space-x-2">
              <BiRightArrow size={18} />
              <span>Force Start</span>
            </span>
          </button>
          */}
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={() => {
              onShowLog(downloadId);
              onClose();
            }}
          >
            <span className="flex items-center space-x-2">
              <IoCodeSlashSharp size={20} />
              <span>Show Log</span>
            </span>
          </button>
          {commonOptions}
        </>
      );
    }

    // Default case (downloading)
    return (
      <>
        <button
          className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
          onClick={() => {
            onViewFolder(
              downloadLocation?.replace(/(\/|\\)[^/\\]+$/, ''),
              downloadFile,
            );
            onClose();
          }}
        >
          <span className="flex items-center space-x-2">
            <LuFolderOpen size={20} />
            <span>View Folder</span>
          </span>
        </button>
      </>
    );
  };

  /*
  function handleMenuItemClick(menuItemId: string) {
    const downloadInfo = allDownloads.find((d) => d.id === downloadId);

    if (downloadInfo) {
      // Use the IPC channel instead of direct call
      window.plugins.executeMenuItem(menuItemId, downloadInfo);
    } else {
      window.plugins.executeMenuItem(menuItemId, { id: downloadId });
    }
  }
*/

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
              className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
              onClick={() => {
                const contextData = {
                  name: downloadName,
                  downloadId,
                  videoUrl: allDownloads.find((d) => d.id === downloadId)
                    ?.videoUrl,
                  location: downloadLocation,
                  status: downloadStatus,
                  duration: allDownloads.find((d) => d.id === downloadId)
                    ?.duration,
                  size: allDownloads.find((d) => d.id === downloadId)?.size,
                  ext: allDownloads.find((d) => d.id === downloadId)?.ext,
                  captionLocation: allDownloads.find((d) => d.id === downloadId)
                    ?.autoCaptionLocation,
                  thumbnailLocation: allDownloads.find(
                    (d) => d.id === downloadId,
                  )?.thumnailsLocation,
                  extractorKey: allDownloads.find((d) => d.id === downloadId)
                    ?.extractorKey,
                };

                console.log('Context data:', contextData);

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
        className="fixed bg-white dark:bg-darkMode border rounded-md shadow-lg py-1 z-50 dark:border-gray-700 min-w-[180px]"
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
          <div className="m-2 px-4 py-2 flex flex-row border rounded dark:border-gray-700">
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
                    onAddTag(downloadId, target.value.trim());
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
                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-darkModeHover flex items-center gap-2 dark:text-gray-200"
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentTags.includes(tag)) {
                    onRemoveTag(downloadId, tag);
                  } else {
                    onAddTag(downloadId, tag);
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
          <div className="m-2 px-4 py-2 flex flex-row border rounded dark:border-gray-700">
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
                    if (currentCategories.length > 0) {
                      onRemoveCategory(downloadId, currentCategories[0]);
                    }
                    onAddCategory(downloadId, target.value.trim());
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
                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-darkModeHover flex items-center gap-2 dark:text-gray-200"
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentCategories.includes(category)) {
                    onRemoveCategory(downloadId, category);
                  } else {
                    if (currentCategories.length > 0) {
                      onRemoveCategory(downloadId, currentCategories[0]);
                    }
                    onAddCategory(downloadId, category);
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
              className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-darkModeHover flex items-center gap-2"
              onClick={() => {
                const contextData = {
                  name: downloadName,
                  downloadId,
                  videoUrl: allDownloads.find((d) => d.id === downloadId)
                    ?.videoUrl,
                  location: downloadLocation,
                  status: downloadStatus,
                  duration: allDownloads.find((d) => d.id === downloadId)
                    ?.duration,
                  size: allDownloads.find((d) => d.id === downloadId)?.size,
                  ext: allDownloads.find((d) => d.id === downloadId)?.ext,
                  captionLocation: allDownloads.find((d) => d.id === downloadId)
                    ?.autoCaptionLocation,
                  thumbnailLocation: allDownloads.find(
                    (d) => d.id === downloadId,
                  )?.thumnailsLocation,
                  extractorKey: allDownloads.find((d) => d.id === downloadId)
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

// export { ConfirmModal, RenameModal, StopModal };
export default DownloadContextMenu;
