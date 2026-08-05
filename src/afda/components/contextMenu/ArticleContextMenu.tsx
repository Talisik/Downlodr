import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { ArticleDownload } from '@/afda/store/articleDownloadStore';
import ContextMenuItem from '@/downlodr/components/contextMenu/ContextMenuItem';
import React, { useEffect, useState } from 'react';
import { BsArrowCounterclockwise } from 'react-icons/bs';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import { GoPlus } from 'react-icons/go';
import { IoMdDownload } from 'react-icons/io';
import { LiaTagsSolid } from 'react-icons/lia';
import { LuEye, LuExternalLink, LuFolderOpen, LuTrash } from 'react-icons/lu';

interface ArticleContextMenuProps {
  article: ArticleDownload;
  position: { x: number; y: number };
  onClose: () => void;
  onViewArticle: (articleId: string) => void;
  onOpenInBrowser: (url: string) => void;
  onOpenFolder: (filePath: string) => void;
  onRemove: (articleId: string) => void;
  onRetry: (articleId: string) => void;
  onDownload: (articleId: string) => void;
  onToggleFavorite: (articleId: string) => void;
  isFavorited: boolean;
  onAddTag: (articleId: string, tag: string) => void;
  onRemoveTag: (articleId: string, tag: string) => void;
  currentTags: string[];
  availableTags: string[];
  onAddCategory: (articleId: string, category: string) => void;
  onRemoveCategory: (articleId: string, category: string) => void;
  currentCategories: string[];
  availableCategories: string[];
}

const ArticleContextMenu: React.FC<ArticleContextMenuProps> = ({
  article,
  position,
  onClose,
  onViewArticle,
  onOpenInBrowser,
  onOpenFolder,
  onRemove,
  onRetry,
  onDownload,
  onToggleFavorite,
  isFavorited,
  onAddTag,
  onRemoveTag,
  currentTags = [],
  availableTags = [],
  onAddCategory,
  onRemoveCategory,
  currentCategories = [],
  availableCategories = [],
}) => {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const tagButtonRef = React.useRef<HTMLButtonElement>(null);
  const categoryButtonRef = React.useRef<HTMLButtonElement>(null);
  const tagSubmenuRef = React.useRef<HTMLDivElement>(null);
  const categorySubmenuRef = React.useRef<HTMLDivElement>(null);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [submenuPosition, setSubmenuPosition] = useState({ x: 0, y: 0 });

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

          if (menuRect.bottom > viewportHeight - margin) {
            newY = Math.max(margin, viewportHeight - menuRect.height - margin);
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
      requestAnimationFrame(checkAndAdjustPosition);
    }
  }, [position, article.status]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideMenu = menuRef.current?.contains(target);
      const insideTagSubmenu = tagSubmenuRef.current?.contains(target);
      const insideCategorySubmenu =
        categorySubmenuRef.current?.contains(target);
      if (!insideMenu && !insideTagSubmenu && !insideCategorySubmenu) {
        onClose();
      }
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

  const recalculateSubmenuPosition = (
    buttonRef: React.RefObject<HTMLButtonElement>,
    itemCount: number,
  ) => {
    if (buttonRef.current && menuRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const menuRect = menuRef.current.getBoundingClientRect();

      const inputAreaHeight = 80;
      const maxListHeight = 192;
      const actualListHeight = Math.min(itemCount * 40, maxListHeight);
      const submenuHeight = inputAreaHeight + actualListHeight;

      let submenuX = menuRect.right + 1;
      let submenuY = buttonRect.top;

      if (submenuY + submenuHeight > window.innerHeight - 10) {
        submenuY = Math.max(10, window.innerHeight - submenuHeight - 10);
      }
      if (submenuY < 10) submenuY = 10;

      const submenuWidth = 200;
      if (submenuX + submenuWidth > window.innerWidth) {
        submenuX = menuRect.left - submenuWidth - 1;
      }

      setSubmenuPosition({ x: submenuX, y: submenuY });
    }
  };

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
    if (next)
      recalculateSubmenuPosition(categoryButtonRef, availableCategories.length);
  };

  useEffect(() => {
    if (showTagMenu)
      recalculateSubmenuPosition(tagButtonRef, availableTags.length);
  }, [availableTags.length, showTagMenu]);

  useEffect(() => {
    if (showCategoryMenu)
      recalculateSubmenuPosition(categoryButtonRef, availableCategories.length);
  }, [availableCategories.length, showCategoryMenu]);

  const renderMenuOptions = () => {
    const viewArticleOption = (
      <ContextMenuItem
        icon={<LuEye size={16} />}
        label="View Article"
        onClick={() => {
          onViewArticle(article.id);
          onClose();
        }}
      />
    );

    const openInBrowserOption = (
      <ContextMenuItem
        icon={<LuExternalLink size={16} />}
        label="Open in Browser"
        onClick={() => {
          onOpenInBrowser(article.url);
          onClose();
        }}
      />
    );

    const openFolderOption = article.filePath ? (
      <ContextMenuItem
        icon={<LuFolderOpen size={18} />}
        label="Open Folder"
        onClick={() => {
          onOpenFolder(article.filePath!);
          onClose();
        }}
      />
    ) : null;

    const favoritesOption = (
      <ContextMenuItem
        icon={
          isFavorited ? (
            <FaHeart size={14} className="text-red-400" />
          ) : (
            <FaRegHeart size={14} />
          )
        }
        label={isFavorited ? 'Remove from Favorites' : 'Add to Favorites'}
        onClick={() => {
          onToggleFavorite(article.id);
          onClose();
        }}
      />
    );

    const tagsOption = (
      <ContextMenuItem
        buttonRef={tagButtonRef}
        icon={<LiaTagsSolid size={18} />}
        label="Tags"
        chevron
        onClick={handleTagMenuClick}
      />
    );

    const categoriesOption = (
      <ContextMenuItem
        buttonRef={categoryButtonRef}
        icon={<LiaTagsSolid size={18} />}
        label="Categories"
        chevron
        onClick={handleCategoryMenuClick}
      />
    );

    const removeOption = (
      <ContextMenuItem
        icon={<LuTrash size={16} />}
        label="Remove"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(article.id);
          onClose();
        }}
      />
    );

    const retryOption = (
      <ContextMenuItem
        icon={<BsArrowCounterclockwise size={20} />}
        label="Retry"
        onClick={() => {
          onRetry(article.id);
          onClose();
        }}
      />
    );

    const downloadOption = (
      <ContextMenuItem
        icon={<IoMdDownload size={18} style={{ color: '#FF9800' }} />}
        label="Download"
        onClick={() => {
          onDownload(article.id);
          onClose();
        }}
      />
    );

    if (article.status === 'finished') {
      return (
        <>
          {removeOption}
          {viewArticleOption}
          {openInBrowserOption}
          {openFolderOption}
          {favoritesOption}
          {tagsOption}
          {categoriesOption}
        </>
      );
    }

    if (article.status === 'failed') {
      return (
        <>
          {removeOption}
          {retryOption}
          {openInBrowserOption}
        </>
      );
    }

    if (article.status === 'for_download') {
      return (
        <>
          {removeOption}
          {downloadOption}
          {openInBrowserOption}
        </>
      );
    }

    // loading
    return <>{removeOption}</>;
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

      {showTagMenu && (
        <div
          ref={tagSubmenuRef}
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
                maxLength={120}
                onKeyDown={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (
                    e.key === 'Enter' &&
                    target.value.trim() &&
                    target.value.trim().length <= 120
                  ) {
                    const newTag = target.value.trim();
                    const alreadyOnArticle = currentTags.some(
                      (t) => t.toLowerCase() === newTag.toLowerCase(),
                    );
                    if (alreadyOnArticle) {
                      toast({
                        variant: 'destructive',
                        title: 'Duplicate Tag',
                        description: `This article already has tag "${newTag}".`,
                        duration: 5000,
                      });
                    } else {
                      onAddTag(article.id, newTag);
                      toast({
                        title: 'Tag Added',
                        description: `Tag "${newTag}" has been added.`,
                        duration: 5000,
                      });
                    }
                    target.value = '';
                  }
                }}
                className="w-full outline-none dark:bg-darkMode dark:text-gray-200"
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Max 120 characters
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
                    onRemoveTag(article.id, tag);
                  } else {
                    onAddTag(article.id, tag);
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
          ref={categorySubmenuRef}
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
                maxLength={120}
                onKeyDown={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (
                    e.key === 'Enter' &&
                    target.value.trim() &&
                    target.value.trim().length <= 120
                  ) {
                    const newCategory = target.value.trim();
                    const alreadyOnArticle = currentCategories.some(
                      (c) => c.toLowerCase() === newCategory.toLowerCase(),
                    );
                    if (alreadyOnArticle) {
                      toast({
                        variant: 'destructive',
                        title: 'Duplicate Category',
                        description: `This article already has category "${newCategory}".`,
                        duration: 5000,
                      });
                    } else {
                      if (currentCategories.length > 0) {
                        onRemoveCategory(article.id, currentCategories[0]);
                      }
                      onAddCategory(article.id, newCategory);
                      toast({
                        title: 'Category Added',
                        description: `Category "${newCategory}" has been added.`,
                        duration: 5000,
                      });
                    }
                    target.value = '';
                  }
                }}
                className="w-full outline-none dark:bg-darkMode dark:text-gray-200"
              />
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
                    onRemoveCategory(article.id, category);
                  } else {
                    if (currentCategories.length > 0) {
                      onRemoveCategory(article.id, currentCategories[0]);
                    }
                    onAddCategory(article.id, category);
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
    </>
  );
};

export default ArticleContextMenu;
