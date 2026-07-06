import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { FavoriteItem } from '@/downlodr/store/favoritesStore';
import React, { useEffect, useRef, useState } from 'react';
import { FaHeart } from 'react-icons/fa';
import { GoChevronRight, GoPlus } from 'react-icons/go';
import { LiaFileVideoSolid, LiaTagsSolid } from 'react-icons/lia';
import { LuFolderOpen } from 'react-icons/lu';
import { MdOutlinePlayCircle } from 'react-icons/md';

interface FavoritesContextMenuProps {
  favorite: FavoriteItem;
  position: { x: number; y: number };
  onClose: () => void;
  onViewFolder: (location: string, name: string) => void;
  onViewDownload: (location: string, downloadName: string) => void;
  onViewEmbed: (fav: FavoriteItem) => void;
  onRemoveFavorite: (downloadId: string) => void;
  onAddTag: (downloadId: string, tag: string) => void;
  onRemoveTag: (downloadId: string, tag: string) => void;
  currentTags: string[];
  availableTags: string[];
  onAddCategory: (downloadId: string, category: string) => void;
  onRemoveCategory: (downloadId: string, category: string) => void;
  currentCategories: string[];
  availableCategories: string[];
}

const FavoritesContextMenu: React.FC<FavoritesContextMenuProps> = ({
  favorite,
  position,
  onClose,
  onViewFolder,
  onViewDownload,
  onViewEmbed,
  onRemoveFavorite,
  onAddTag,
  onRemoveTag,
  currentTags = [],
  availableTags = [],
  onAddCategory,
  onRemoveCategory,
  currentCategories = [],
  availableCategories = [],
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const tagButtonRef = useRef<HTMLButtonElement>(null);
  const categoryButtonRef = useRef<HTMLButtonElement>(null);
  const tagSubmenuRef = useRef<HTMLDivElement>(null);
  const categorySubmenuRef = useRef<HTMLDivElement>(null);

  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [submenuPosition, setSubmenuPosition] = useState({ x: 0, y: 0 });

  // Close on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const inside =
        menuRef.current?.contains(target) ||
        tagSubmenuRef.current?.contains(target) ||
        categorySubmenuRef.current?.contains(target);
      if (!inside) onClose();
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  // Adjust menu position to avoid viewport overflow
  useEffect(() => {
    if (!menuRef.current) return;
    requestAnimationFrame(() => {
      if (!menuRef.current) return;
      const rect = menuRef.current.getBoundingClientRect();
      const margin = 10;
      let x = position.x;
      let y = position.y;
      if (rect.bottom > window.innerHeight - margin)
        y = Math.max(margin, window.innerHeight - rect.height - margin);
      if (rect.right > window.innerWidth - margin)
        x = Math.max(margin, window.innerWidth - rect.width - margin);
      if (rect.left < margin) x = margin;
      if (rect.top < margin) y = margin;
      menuRef.current.style.left = `${x}px`;
      menuRef.current.style.top = `${y}px`;
    });
  }, [position]);

  const recalculateSubmenuPosition = (
    buttonRef: React.RefObject<HTMLButtonElement>,
    itemCount: number,
  ) => {
    if (!buttonRef.current || !menuRef.current) return;
    const buttonRect = buttonRef.current.getBoundingClientRect();
    const menuRect = menuRef.current.getBoundingClientRect();
    const inputAreaHeight = 80;
    const maxListHeight = 192;
    const submenuHeight = inputAreaHeight + Math.min(itemCount * 40, maxListHeight);
    const submenuWidth = 200;

    let x = menuRect.right + 1;
    let y = buttonRect.top;

    if (y + submenuHeight > window.innerHeight - 10)
      y = Math.max(10, window.innerHeight - submenuHeight - 10);
    if (y < 10) y = 10;
    if (x + submenuWidth > window.innerWidth) x = menuRect.left - submenuWidth - 1;

    setSubmenuPosition({ x, y });
  };

  useEffect(() => {
    if (showTagMenu) recalculateSubmenuPosition(tagButtonRef, availableTags.length);
  }, [availableTags.length, showTagMenu]);

  useEffect(() => {
    if (showCategoryMenu)
      recalculateSubmenuPosition(categoryButtonRef, availableCategories.length);
  }, [availableCategories.length, showCategoryMenu]);

  const handleTagMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowCategoryMenu(false);
    const next = !showTagMenu;
    setShowTagMenu(next);
    if (next) recalculateSubmenuPosition(tagButtonRef, availableTags.length);
  };

  const handleCategoryMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowTagMenu(false);
    const next = !showCategoryMenu;
    setShowCategoryMenu(next);
    if (next) recalculateSubmenuPosition(categoryButtonRef, availableCategories.length);
  };

  return (
    <>
      <div
        ref={menuRef}
        className="fixed bg-white dark:bg-darkMode border rounded-md shadow-lg py-1 z-50 dark:border-gray-700 min-w-[175px]"
        style={{ left: `${position.x}px`, top: `${position.y}px`, maxHeight: '80vh', overflowY: 'auto' }}
      >
        {/* View Folder */}
        <button
          className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover dark:text-gray-200"
          onClick={() => { onViewFolder(favorite.location, favorite.downloadName); onClose(); }}
        >
          <LuFolderOpen size={18} />
          View Folder
        </button>

        {/* Open with External Player */}
        <button
          className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover dark:text-gray-200"
          onClick={() => { onViewDownload(favorite.location, favorite.downloadName); onClose(); }}
        >
          <LiaFileVideoSolid size={20} />
          Open with External Player
        </button>

        {/* View Embedded */}
        <button
          className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover dark:text-gray-200"
          onClick={() => { onViewEmbed(favorite); onClose(); }}
        >
          <MdOutlinePlayCircle size={18} />
          View Embedded
        </button>

        {/* Remove from Favorites */}
        <button
          className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover dark:text-gray-200"
          onClick={() => { onRemoveFavorite(favorite.downloadId); onClose(); }}
        >
          <FaHeart size={14} className="text-red-400" />
          Remove from Favorites
        </button>

        {/* Tags submenu trigger */}
        <button
          ref={tagButtonRef}
          className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover dark:text-gray-200"
          onClick={handleTagMenuClick}
        >
          <LiaTagsSolid size={18} />
          Tags
          <span className="ml-auto"><GoChevronRight size={18} /></span>
        </button>

        {/* Categories submenu trigger */}
        <button
          ref={categoryButtonRef}
          className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-2 dark:hover:bg-darkModeHover dark:text-gray-200"
          onClick={handleCategoryMenuClick}
        >
          <LiaTagsSolid size={18} />
          Categories
          <span className="ml-auto"><GoChevronRight size={18} /></span>
        </button>
      </div>

      {/* Tags submenu */}
      {showTagMenu && (
        <div
          ref={tagSubmenuRef}
          className="fixed bg-white dark:bg-darkMode border rounded-md shadow-lg py-1 min-w-[180px] z-50 dark:border-gray-700"
          style={{ left: `${submenuPosition.x}px`, top: `${submenuPosition.y}px`, maxHeight: '80vh', overflowY: 'auto' }}
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
                  if (e.key === 'Enter' && target.value.trim()) {
                    const newTag = target.value.trim();
                    const isDuplicate =
                      availableTags.some((t) => t.toLowerCase() === newTag.toLowerCase()) ||
                      currentTags.some((t) => t.toLowerCase() === newTag.toLowerCase());
                    if (isDuplicate) {
                      toast({ variant: 'destructive', title: 'Duplicate Tag', description: `Tag "${newTag}" already exists.`, duration: 2000 });
                    } else {
                      onAddTag(favorite.downloadId, newTag);
                      toast({ title: 'Tag Added', description: `Tag "${newTag}" has been added.`, duration: 2000 });
                    }
                    target.value = '';
                  }
                }}
                className="w-full outline-none dark:bg-darkMode dark:text-gray-200"
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Max 10 characters</div>
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
                    onRemoveTag(favorite.downloadId, tag);
                  } else {
                    onAddTag(favorite.downloadId, tag);
                  }
                }}
              >
                <span>{currentTags.includes(tag) ? '✓' : ''}</span>
                <span>{tag}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Categories submenu */}
      {showCategoryMenu && (
        <div
          ref={categorySubmenuRef}
          className="fixed bg-white dark:bg-darkMode border rounded-md shadow-lg py-1 min-w-[185px] z-50 dark:border-gray-700"
          style={{ left: `${submenuPosition.x}px`, top: `${submenuPosition.y}px`, maxHeight: '80vh', overflowY: 'auto' }}
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
                  if (e.key === 'Enter' && target.value.trim()) {
                    const newCategory = target.value.trim();
                    const isDuplicate = availableCategories.some(
                      (c) => c.toLowerCase() === newCategory.toLowerCase(),
                    );
                    if (isDuplicate) {
                      toast({ variant: 'destructive', title: 'Duplicate Category', description: `Category "${newCategory}" already exists.`, duration: 2000 });
                    } else {
                      if (currentCategories.length > 0) {
                        onRemoveCategory(favorite.downloadId, currentCategories[0]);
                      }
                      onAddCategory(favorite.downloadId, newCategory);
                      toast({ title: 'Category Added', description: `Category "${newCategory}" has been added.`, duration: 2000 });
                    }
                    target.value = '';
                  }
                }}
                className="w-full outline-none dark:bg-darkMode dark:text-gray-200"
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Max 10 characters</div>
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
                    onRemoveCategory(favorite.downloadId, category);
                  } else {
                    if (currentCategories.length > 0) {
                      onRemoveCategory(favorite.downloadId, currentCategories[0]);
                    }
                    onAddCategory(favorite.downloadId, category);
                  }
                }}
              >
                <span>{currentCategories.includes(category) ? '✓' : ''}</span>
                <span>{category}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
};

export default FavoritesContextMenu;
