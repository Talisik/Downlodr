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
 *
 * @returns JSX.Element - The rendered context menu component.
 */

import { PlayCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { BiRightArrow } from 'react-icons/bi';
import { GoChevronRight } from 'react-icons/go';
import { HiOutlineStopCircle } from 'react-icons/hi2';
import { IoPauseCircleOutline } from 'react-icons/io5';
import { LiaFileVideoSolid, LiaTagsSolid } from 'react-icons/lia';
import { LuFolderOpen, LuTrash } from 'react-icons/lu';
import { MdEdit } from 'react-icons/md';
import { VscDebugStart } from 'react-icons/vsc';
import { processFileName } from '../../../DataFunctions/FilterName';
import { usePluginState } from '../../../plugins/Hooks/usePluginState';
import { MenuItem } from '../../../plugins/types';
import useDownloadStore from '../../../Store/downloadStore';
import { useMainStore } from '../../../Store/mainStore';
import { toast } from '../shadcn/hooks/use-toast';
import CategoryMenu from './CategoryMenu';
import TagMenu from './TagsMenu';
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
  ) => void; // Function to pause the download
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
  onViewFolder: (downloadLocation?: string) => void; // Function to view the folder containing the download
  downloadName?: string; // Name of the download file
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string;
}

interface RenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRename: (newName: string) => void;
  currentName: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  message,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-darkMode rounded-lg p-6 max-w-sm w-full mx-4">
        <p className="text-gray-800 dark:text-gray-200 mb-4">{message}</p>
        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-darkModeHover rounded"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Confirm
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

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
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
        className="bg-white dark:bg-darkMode rounded-lg p-6 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-medium mb-4 dark:text-gray-200">Rename</h3>
        <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
          <label className="font-medium">New name</label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full p-2 border rounded mb-4 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
          <hr className="solid mb-2 -mx-6 w-[calc(100%+48px)] border-t-2 border-divider dark:border-gray-700" />

          <div className="flex justify-start space-x-2 mb-[-10px]">
            <button
              type="submit"
              onClick={(e) => e.stopPropagation()}
              className="px-4 py-1 bg-primary text-white rounded"
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

const DownloadContextMenu: React.FC<DownloadContextMenuProps> = ({
  downloadId,
  position,
  downloadLocation,
  controllerId,
  downloadStatus,
  onClose,
  onPause,
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
  downloadName = '',
}) => {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const tagMenuRef = React.useRef<HTMLDivElement>(null);
  // const categoryMenuRef = React.useRef<HTMLDivElement>(null);
  const [showTagMenu, setShowTagMenu] = useState(false); // State to track visibility of the tag menu
  const [showCategoryMenu, setShowCategoryMenu] = useState(false); // State to track visibility of the category menu
  const [tagMenuPosition, setTagMenuPosition] = useState<
    'right' | 'left' | 'top'
  >('right');
  const [showStopConfirmation, setShowStopConfirmation] = useState(false); // State to track visibility of the stop confirmation modal
  const [showRenameModal, setShowRenameModal] = useState(false); // State to track visibility of the rename modal
  const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false); // State to track visibility of the remove confirmation modal
  // const [showFormatConverterMenu, setShowFormatConverterMenu] = useState(false); // State to track visibility of format converter menu
  const renameDownload = useDownloadStore((state) => state.renameDownload); // Function to rename a download
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
      // Option 1: Using the window.plugins API with filtering
      const items = await window.plugins.getMenuItems('download');
      const filteredItems = (items || []).filter(
        (item) => !item.pluginId || enabledPlugins[item.pluginId] !== false,
      ) as MenuItem[];

      // OR Option 2: Using the registry directly (if it exposes a method)
      // const filteredItems = pluginRegistry.getMenuItems('download');

      setPluginMenuItems(filteredItems);
    } catch (error) {
      console.error('Failed to fetch plugin menu items:', error);
      setPluginMenuItems([]);
    }
  };

  // Helper function to check if a string is an SVG
  const isSvgString = (str: string): boolean => {
    return str.trim().startsWith('<svg') && str.trim().endsWith('</svg>');
  };

  useEffect(() => {
    fetchPluginMenuItems();
  }, [enabledPlugins]);

  // Effect to position the context menu based on the provided coordinates
  React.useEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      let { x, y } = position;

      // Adjust vertical position if menu overflows bottom
      if (y + menuRect.height > viewportHeight) {
        y = Math.max(0, viewportHeight - menuRect.height);
      }

      // Adjust horizontal position if menu overflows right
      if (x + menuRect.width > viewportWidth) {
        x = Math.max(0, viewportWidth - menuRect.width);
      }

      menuRef.current.style.left = `${x}px`;
      menuRef.current.style.top = `${y}px`;
    }
  }, [position]);

  // Effect to position the context menu based on the provided coordinates
  useEffect(() => {
    if (showTagMenu && tagMenuRef.current && menuRef.current) {
      const tagMenu = tagMenuRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      if (tagMenu.right > viewportWidth) {
        setTagMenuPosition('left');
      }

      if (tagMenu.bottom > viewportHeight) {
        setTagMenuPosition('top');
      }
    }
  }, [showTagMenu]);

  // Function to handle opening tag menu
  const getTagMenuPositionClass = () => {
    switch (tagMenuPosition) {
      case 'left':
        return 'right-full top-0 ml-[-1px]';
      case 'top':
        return 'left-full bottom-0 ml-1';
      default:
        return 'left-full top-0 ml-1';
    }
  };

  // Function to handle opening tag menu
  const handleTagMenuClick = (e: React.MouseEvent) => {
    console.log(pluginMenuItems);
    e.stopPropagation();
    setShowCategoryMenu(false); // Close category menu
    setShowTagMenu(!showTagMenu);
  };

  // Function to handle opening category menu
  const handleCategoryMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTagMenu(false); // Close tag menu
    setShowCategoryMenu(!showCategoryMenu);
  };
  /*
  // Function to handle opening format converter menu
  const handleFormatConverterClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTagMenu(false); // Close tag menu
    setShowCategoryMenu(false); // Close category menu
    setShowFormatConverterMenu(!showFormatConverterMenu);
  };

  // Function to handle format conversion
  const handleConvert = (
    downloadId: string,
    format: string,
    keepOriginal: boolean,
  ) => {
    // Here you would implement the actual conversion logic
    // This could call an API or dispatch an action to your state management
    console.log(
      `Converting ${downloadId} to ${format}${
        keepOriginal ? ' (keeping original)' : ''
      }`,
    );

    // Close menus
    setShowFormatConverterMenu(false);
    onClose();
  };
*/
  // Function to confirm stopping the download
  const handleStopConfirm = () => {
    onStop(downloadId, downloadLocation, controllerId);
    setShowStopConfirmation(false);
    onClose();
  };

  // Function to handle renaming the download
  const handleRename = (newName: string) => {
    renameDownload(downloadId, newName);
    onClose();
  };

  // Function to confirm removing the download
  const handleRemoveConfirm = () => {
    onRemove(downloadLocation, downloadId, controllerId);
    setShowRemoveConfirmation(false);
    onClose();
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
        {/* Tags and Categories are always available */}
        <div className="relative">
          <button
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

          {showTagMenu && (
            <TagMenu
              downloadId={downloadId}
              onAddTag={onAddTag}
              onRemoveTag={onRemoveTag}
              currentTags={currentTags}
              availableTags={availableTags}
              menuPositionClass={getTagMenuPositionClass()}
            />
          )}
        </div>

        <div className="relative">
          <button
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

          {showCategoryMenu && (
            <CategoryMenu
              downloadId={downloadId}
              onAddCategory={onAddCategory}
              onRemoveCategory={onRemoveCategory}
              currentCategories={currentCategories}
              availableCategories={availableCategories}
              menuPositionClass={getTagMenuPositionClass()}
            />
          )}
        </div>
      </>
    );

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
              onViewFolder(downloadLocation?.replace(/(\/|\\)[^/\\]+$/, ''));
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
              setShowRemoveConfirmation(true);
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

    if (downloadStatus === 'initializing') {
      return (
        <>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={() => {
              onViewFolder(downloadLocation?.replace(/(\/|\\)[^/\\]+$/, ''));
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
              setShowStopConfirmation(true);
            }}
          >
            <span className="flex items-center space-x-2">
              <HiOutlineStopCircle size={20} />
              <span>Stop</span>
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
              onViewFolder(downloadLocation?.replace(/(\/|\\)[^/\\]+$/, ''));
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
              setShowStopConfirmation(true);
            }}
          >
            <span className="flex items-center space-x-2">
              <HiOutlineStopCircle size={20} />
              <span>Stop</span>
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
              onViewFolder(downloadLocation?.replace(/(\/|\\)[^/\\]+$/, ''));
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
              setShowRenameModal(true);
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
              setShowRemoveConfirmation(true);
            }}
          >
            <span className="flex items-center space-x-2">
              <LuTrash size={16} />
              <span>Remove</span>
            </span>
          </button>
        </>
      );
    }

    if (downloadStatus === 'downloading') {
      return (
        <>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover"
            onClick={() => {
              onViewFolder(downloadLocation?.replace(/(\/|\\)[^/\\]+$/, ''));
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
              setShowStopConfirmation(true);
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
              onForceStart(downloadId, downloadLocation, controllerId);
              onClose();
            }}
          >
            <span className="flex items-center space-x-2">
              <BiRightArrow size={18} />
              <span>Force Start</span>
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
            onViewFolder(downloadLocation?.replace(/(\/|\\)[^/\\]+$/, ''));
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
                thumbnailLocation: allDownloads.find((d) => d.id === downloadId)
                  ?.thumnailsLocation,
              };

              // Log which menu item was clicked
              console.log('Plugin menu item clicked:', {
                id: item.id,
                label: item.label,
                pluginId: item.pluginId,
                handlerId: item.handlerId,
              });
              console.log('Context data:', contextData);

              // Find and execute the handler directly if it's a rendered plugin with handlerId
              if (
                item.handlerId &&
                window.PluginHandlers &&
                window.PluginHandlers[item.handlerId]
              ) {
                // Call the handler directly
                window.PluginHandlers[item.handlerId](contextData);
              } else {
                // Fall back to the IPC method for non-renderer plugins
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
  };

  return (
    <>
      <div
        ref={menuRef}
        className="fixed bg-white dark:bg-darkMode border rounded-md shadow-lg py-1 z-50 dark:border-gray-700"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
        }}
      >
        {renderMenuOptions()}
        {renderPluginMenuItems()}
      </div>

      <RenameModal
        isOpen={showRenameModal}
        onClose={() => setShowRenameModal(false)}
        onRename={handleRename}
        currentName={downloadName}
      />

      <ConfirmModal
        isOpen={showStopConfirmation}
        onClose={() => setShowStopConfirmation(false)}
        onConfirm={handleStopConfirm}
        message="Are you sure you want to stop and remove this download?"
      />

      <ConfirmModal
        isOpen={showRemoveConfirmation}
        onClose={() => setShowRemoveConfirmation(false)}
        onConfirm={handleRemoveConfirm}
        message="Are you sure you want to remove this download?"
      />
    </>
  );
};

export default DownloadContextMenu;
