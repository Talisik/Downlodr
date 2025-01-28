import React, { useState } from 'react';
import TagMenu from './TagsMenu';
import CategoryMenu from './CategoryMenu';
import { IoPauseCircleOutline } from 'react-icons/io5';
import { LiaFileVideoSolid, LiaTagsSolid } from 'react-icons/lia';
import { HiOutlineStopCircle } from 'react-icons/hi2';
import { BiRightArrow } from 'react-icons/bi';
import { LuTrash, LuFolderOpen } from 'react-icons/lu';
import { GoChevronRight } from 'react-icons/go';

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
}

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
}) => {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const tagMenuRef = React.useRef<HTMLDivElement>(null);
  // const categoryMenuRef = React.useRef<HTMLDivElement>(null);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [tagMenuPosition, setTagMenuPosition] = useState<
    'right' | 'left' | 'top'
  >('right');
  // const [newTag, setNewTag] = useState('');
  // const [newCategory, setNewCategory] = useState('');

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

  /* const handleTagClick = (tag: string) => {
    console.log('Tag clicked:', tag);
    console.log('Current tags:', currentTags);
    if (currentTags.includes(tag)) {
      onRemoveTag(downloadId, tag);
    } else {
      onAddTag(downloadId, tag);
    }
  };*/

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
            onClick={() => {
              onRemove(downloadLocation, downloadId, controllerId);
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
              <IoPauseCircleOutline size={20} />
              <span>Start</span>
            </span>
          </button>
          <button
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-gray-700"
            onClick={() => {
              onStop(downloadId, downloadLocation, controllerId);
              onClose();
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

        <button
          className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-gray-700"
          onClick={() => {
            onPause(downloadId, downloadLocation, controllerId, downloadStatus);
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
          onClick={() => {
            onStop(downloadId, downloadLocation, controllerId);
            onClose();
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
  };

  return (
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
  );
};

export default DownloadContextMenu;
