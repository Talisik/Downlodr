import React, { useState } from 'react';
import TagMenu from './TagsMenu';
import CategoryMenu from './CategoryMenu';
import { IoPauseCircleOutline } from 'react-icons/io5';
import { LiaFileVideoSolid, LiaTagsSolid } from 'react-icons/lia';
import { HiOutlineStopCircle } from 'react-icons/hi2';
import { BiRightArrow } from 'react-icons/bi';
import { LuTrash, LuFolderOpen } from 'react-icons/lu';
import { GoChevronRight } from 'react-icons/go';
import { VscDebugStart } from 'react-icons/vsc';
import useDownloadStore from '../../../Store/downloadStore';
import { MdEdit } from 'react-icons/md';
import { PlayCircle } from 'lucide-react';
import { processFileName } from '../../../DataFunctions/FilterName';
import { useMainStore } from '../../../Store/mainStore';
import { toast } from '../shadcn/hooks/use-toast';

interface DownloadContextMenuProps {
  downloadId: string;
  position: { x: number; y: number };
  downloadLocation?: string;
  controllerId?: string;
  downloadStatus?: string;
  onClose: () => void;
  onPause: (
    id: string,
    downloadLocation?: string,
    controllerId?: string,
    downloadStatus?: string,
  ) => void;
  onStop: (
    id: string,
    downloadLocation?: string,
    controllerId?: string,
  ) => void;
  onForceStart: (
    id: string,
    downloadLocation?: string,
    controllerId?: string,
  ) => void;
  onRemove: (
    downloadLocation?: string,
    id?: string,
    controllerId?: string,
  ) => void;
  onViewDownload: (downloadLocation?: string) => void;
  onAddTag: (downloadId: string, tag: string) => void;
  onRemoveTag: (downloadId: string, tag: string) => void;
  currentTags: string[];
  availableTags: string[]; // All tags used in the system
  onAddCategory: (downloadId: string, category: string) => void;
  onRemoveCategory: (downloadId: string, category: string) => void;
  currentCategories: string[];
  availableCategories: string[];
  onViewFolder: (downloadLocation?: string) => void;
  downloadName?: string;
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
            className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
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
              className="px-4 py-1 border rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 dark:text-gray-200"
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
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [tagMenuPosition, setTagMenuPosition] = useState<
    'right' | 'left' | 'top'
  >('right');
  const [showStopConfirmation, setShowStopConfirmation] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showRemoveConfirmation, setShowRemoveConfirmation] = useState(false);
  const renameDownload = useDownloadStore((state) => state.renameDownload);
  const { settings } = useMainStore();
  const { downloading, addDownload, removeFromForDownloads, forDownloads } =
    useDownloadStore();

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

  React.useEffect(() => {
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

  const handleStopConfirm = () => {
    onStop(downloadId, downloadLocation, controllerId);
    setShowStopConfirmation(false);
    onClose();
  };

  const handleRename = (newName: string) => {
    renameDownload(downloadId, newName);
    onClose();
  };

  const handleRemoveConfirm = () => {
    onRemove(downloadLocation, downloadId, controllerId);
    setShowRemoveConfirmation(false);
    onClose();
  };

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
      });
      return;
    }

    addDownload(
      currentDownload.videoUrl,
      `${processedName}.${currentDownload.ext}`, // Use the correct extension
      `${processedName}.${currentDownload.ext}`, // Use the correct extension
      currentDownload.size || 0, // Use the actual size if known
      currentDownload.speed || '0 KB/s', // Use the actual speed if known
      currentDownload.timeLeft || '0:00:00', // Use the actual time left if known
      new Date().toISOString(),
      0, // Progress can be set to 0
      currentDownload.location,
      'downloading',
      currentDownload.ext || 'mp4', // Use the correct extension
      currentDownload.formatId || '', // Use the actual formatId if known
      currentDownload.audioExt || '', // Use the actual audioExt if known
      currentDownload.audioFormatId || '', // Use the actual audioFormatId if known
      currentDownload.extractorKey || '', // Use the actual extractorKey if known
      settings.defaultDownloadSpeed === 0
        ? ''
        : `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`,
    );

    removeFromForDownloads(currentDownload.id); // Remove from forDownloads after starting
    onClose();
  };

  const renderMenuOptions = () => {
    const commonOptions = (
      <>
        {/* Tags and Categories are always available */}
        <div className="relative">
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-gray-700"
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
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-gray-700"
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
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-gray-700"
            onClick={() => {
              onViewDownload(downloadLocation);
              onClose();
            }}
          >
            <span className="flex items-center space-x-2">
              <LiaFileVideoSolid size={20} />
              <span>View Download</span>
            </span>
          </button>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-gray-700"
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
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-gray-700"
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
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-gray-700"
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
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-gray-700"
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
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-gray-700"
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
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-gray-700"
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
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-gray-700"
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
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-gray-700"
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
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-gray-700"
            onClick={handleStartDownload}
          >
            <span className="flex items-center space-x-2">
              <PlayCircle size={20} />
              <span>Start</span>
            </span>
          </button>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-gray-700"
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
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-gray-700"
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
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-gray-700"
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
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-gray-700"
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
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-gray-700"
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
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-gray-700"
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
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-gray-700"
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
          className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-gray-700"
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
