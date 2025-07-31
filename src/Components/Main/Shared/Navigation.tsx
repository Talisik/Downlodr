/**
 * A custom React fixed component
 * A Fixed element in Downlodr, displays the navigation links for status, categories and tag pages
 *  - Status (All Downloads, Currently Downloading, and Finished Downloads)
 *  - Categories (All Categories, Uncategorized downloads, and then list of individual categories)
 *  - Tags (All Tags, Untaged downloads, and then list of individual tags)
 *
 * @param className - for UI of Navigation
 * @returns JSX.Element - The rendered component displaying a Navigation
 *
 */
import CategoryContextMenu from '@/Components/SubComponents/custom/CategoryContextMenu';
import TagContextMenu from '@/Components/SubComponents/custom/TagContextMenu';
import useDownloadStore from '@/Store/downloadStore';
import React, { useEffect, useRef, useState } from 'react';
import { BiLayer, BiSolidPlusSquare } from 'react-icons/bi';
import { BsHourglassSplit, BsTag } from 'react-icons/bs';
import {
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiDownload,
  FiFolder,
} from 'react-icons/fi';
import { HiMiniArrowPath } from 'react-icons/hi2';
import { MdPlayArrow } from 'react-icons/md';
import { PiPauseBold } from 'react-icons/pi';
import { TbDeviceTabletSearch } from 'react-icons/tb';
import { NavLink } from 'react-router-dom';

// import { toast } from 'react-hot-toast';
import TooltipWrapper from '@/Components/SubComponents/custom/TooltipWrapper';
import { toast } from '@/Components/SubComponents/shadcn/hooks/use-toast';
import { FaRegTimesCircle } from 'react-icons/fa';

const Navigation = ({
  className,
  collapsed,
  toggleCollapse,
}: {
  className?: string;
  collapsed?: boolean;
  toggleCollapse?: () => void;
}) => {
  // states for opening and closing navigation sections
  const [openSections, setOpenSections] = useState({
    status: true,
    category: false,
    tag: false,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Context menu for Tags and Category
  const [contextMenu, setContextMenu] = useState<{
    category: string;
    x: number;
    y: number;
  } | null>(null);
  const renameCategory = useDownloadStore((state) => state.renameCategory);
  const deleteCategory = useDownloadStore((state) => state.deleteCategory);

  const [tagContextMenu, setTagContextMenu] = useState<{
    tag: string;
    x: number;
    y: number;
  } | null>(null);
  const renameTag = useDownloadStore((state) => state.renameTag);
  const deleteTag = useDownloadStore((state) => state.deleteTag);

  const handleCategoryRightClick = (
    e: React.MouseEvent,
    categoryName: string,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    // Close any existing tag context menu
    setTagContextMenu(null);

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      category: categoryName,
    });
  };

  const handleTagRightClick = (e: React.MouseEvent, tagName: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Close any existing category context menu
    setContextMenu(null);

    setTagContextMenu({
      x: e.clientX,
      y: e.clientY,
      tag: tagName,
    });
  };

  // List of available tags and categories
  const availableCategories = useDownloadStore(
    (state) => state.availableCategories,
  );
  const availableTags = useDownloadStore((state) => state.availableTags);

  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close context menus when clicking anywhere except on the context menu itself
      const target = event.target as Node;

      // Check if click is on category context menu
      const categoryContextMenuElement = document.querySelector(
        '[data-category-context-menu]',
      );
      const isClickOnCategoryMenu =
        categoryContextMenuElement?.contains(target);

      // Check if click is on tag context menu
      const tagContextMenuElement = document.querySelector(
        '[data-tag-context-menu]',
      );
      const isClickOnTagMenu = tagContextMenuElement?.contains(target);

      // Close menus if not clicking on them
      if (!isClickOnCategoryMenu) {
        setContextMenu(null);
      }
      if (!isClickOnTagMenu) {
        setTagContextMenu(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Handle dragging over a tag
  const handleDragOver = (e: React.DragEvent, item?: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'link';
    if (item) {
      setDragOverItem(item);
    }
  };

  // Helper function to ensure a download has only one category
  const ensureSingleCategory = (downloadId: string, newCategory: string) => {
    // Get the current categories for this download
    const allDownloads = [
      ...useDownloadStore.getState().downloading,
      ...useDownloadStore.getState().finishedDownloads,
      ...useDownloadStore.getState().historyDownloads,
      ...useDownloadStore.getState().forDownloads,
    ];

    const download = allDownloads.find((d) => d.id === downloadId);
    const currentCategories = download?.category || [];

    // Remove any existing categories before adding the new one
    if (currentCategories.length > 0) {
      currentCategories.forEach((existingCategory) => {
        useDownloadStore
          .getState()
          .removeCategory(downloadId, existingCategory);
      });
    }
    useDownloadStore.getState().addCategory(downloadId, newCategory);
  };

  // Helper function to ensure a download has only one category
  const ensureNoDouble = (downloadId: string, newCategory: string) => {
    // Get the current categories for this download
    const allDownloads = [
      ...useDownloadStore.getState().downloading,
      ...useDownloadStore.getState().finishedDownloads,
      ...useDownloadStore.getState().historyDownloads,
      ...useDownloadStore.getState().forDownloads,
      ...useDownloadStore.getState().queuedDownloads,
    ];

    const download = allDownloads.find((d) => d.id === downloadId);
    const currentTags = download?.tags || [];

    // Remove any existing categories before adding the new one
    if (!currentTags.includes(newCategory)) {
      useDownloadStore.getState().addTag(downloadId, newCategory);
    }
  };

  // Update handleCategoryDrop to clear the highlight after dropping
  const handleCategoryDrop = (e: React.DragEvent, category: string) => {
    e.preventDefault();
    const downloadId = e.dataTransfer.getData('downloadId');
    if (downloadId) {
      ensureSingleCategory(downloadId, category);

      // Show a success toast
      toast({
        title: 'Download categorized',
        description: `Set to "${category}"`,
        duration: 3000,
      });
    }
    // Clear the highlight after drop
    setDragOverItem(null);
  };

  // Handle dropping on a tag
  const handleTagDrop = (e: React.DragEvent, tag: string) => {
    e.preventDefault();
    const downloadId = e.dataTransfer.getData('downloadId');
    if (downloadId) {
      ensureNoDouble(downloadId, tag);
      toast({
        title: 'Download tagged',
        description: `Tagged with "${tag}"`,
        duration: 3000,
      });
    }
    // Clear the highlight after drop
    setDragOverItem(null);
  };

  const [dragOverItem, setDragOverItem] = useState<string | null>(null);

  const handleDragLeave = () => {
    setDragOverItem(null);
  };

  return (
    <nav
      ref={navRef}
      className={`${className} transition-all duration-300 ${
        collapsed ? 'w-[70px]' : ''
      } relative overflow-x-hidden`}
    >
      <div
        className={`${
          collapsed ? 'px-1' : 'p-2 ml-0 md:ml-1'
        } mt-2 space-y-2 pb-20`}
      >
        {/* Category Section */}
        <div>
          <TooltipWrapper content={collapsed ? 'Status' : null} side="left">
            <button
              onClick={() => toggleSection('status')}
              className={`w-full flex items-center ${
                collapsed
                  ? 'justify-center'
                  : 'hover:bg-titleBar dark:hover:bg-darkModeCompliment rounded dark:text-gray-200 p-2'
              } `}
            >
              <div
                className={`flex items-center transition-opacity duration-300 ${
                  collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
                }`}
              >
                {openSections.status ? (
                  <FiChevronDown size={18} />
                ) : (
                  <FiChevronRight size={18} />
                )}
                <span className="ml-1 text-sm font-semibold whitespace-nowrap">
                  Status
                </span>
              </div>
            </button>
          </TooltipWrapper>

          {/* Show items regardless of openSections when collapsed */}
          {(openSections.status || collapsed) && (
            <div
              className={`${
                collapsed ? 'flex flex-col items-center' : 'ml-1'
              } space-y-[6px]`}
            >
              <TooltipWrapper content={collapsed ? 'All' : null} side="left">
                <NavLink
                  to="/status/all"
                  className={({ isActive }) =>
                    `${collapsed ? 'p-2 ' : 'nav-link '} ${
                      isActive ? 'bg-titleBar dark:bg-darkModeNavigation' : ''
                    } dark:text-gray-200 dark:hover:bg-darkModeNavigation flex ml-1 ${
                      collapsed
                        ? 'justify-center p-2 hover:bg-titleBar dark:hover:bg-darkModeNavigation rounded dark:text-gray-200'
                        : 'items-center'
                    }`
                  }
                >
                  <FiFolder size={16} className="text-primary flex-shrink-0" />
                  {!collapsed && (
                    <span className="ml-2 text-[12px] whitespace-nowrap">
                      All
                    </span>
                  )}
                </NavLink>
              </TooltipWrapper>
              <TooltipWrapper
                content={collapsed ? 'Fetching Metadata' : null}
                side="left"
              >
                <NavLink
                  to="/status/fetching-metadata"
                  className={({ isActive }) =>
                    `${collapsed ? 'p-2 ' : 'nav-link '} ${
                      isActive ? 'bg-titleBar dark:bg-darkModeCompliment' : ''
                    } dark:text-gray-200 dark:hover:bg-darkModeCompliment flex ml-1 ${
                      collapsed
                        ? 'justify-center p-2 hover:bg-titleBar dark:hover:bg-darkModeCompliment rounded dark:text-gray-200'
                        : 'items-center'
                    }`
                  }
                >
                  <TbDeviceTabletSearch
                    size={17}
                    className="text-blue-500 flex-shrink-0"
                  />
                  {!collapsed && (
                    <span className="ml-2 text-[12px] whitespace-nowrap">
                      Fetching Metadata
                    </span>
                  )}
                </NavLink>
              </TooltipWrapper>
              <TooltipWrapper
                content={collapsed ? 'Start Download' : null}
                side="left"
              >
                <NavLink
                  to="/status/to-download"
                  className={({ isActive }) =>
                    `${collapsed ? 'p-2 ' : 'nav-link '} ${
                      isActive ? 'bg-titleBar dark:bg-darkModeCompliment' : ''
                    } dark:text-gray-200 dark:hover:bg-darkModeCompliment flex ml-1 ${
                      collapsed
                        ? 'justify-center p-2 hover:bg-titleBar dark:hover:bg-darkModeCompliment rounded dark:text-gray-200'
                        : 'items-center'
                    }`
                  }
                >
                  <FiDownload
                    size={16}
                    className="text-primary flex-shrink-0"
                  />
                  {!collapsed && (
                    <span className="ml-2 text-[12px] whitespace-nowrap">
                      Start Download
                    </span>
                  )}
                </NavLink>
              </TooltipWrapper>
              <TooltipWrapper content={collapsed ? 'Queued' : null} side="left">
                <NavLink
                  to="/status/queued"
                  className={({ isActive }) =>
                    `${collapsed ? 'p-2 ' : 'nav-link '} ${
                      isActive ? 'bg-titleBar dark:bg-darkModeCompliment' : ''
                    } dark:text-gray-200 dark:hover:bg-darkModeCompliment flex ml-1 ${
                      collapsed
                        ? 'justify-center p-2 hover:bg-titleBar dark:hover:bg-darkModeCompliment rounded dark:text-gray-200'
                        : 'items-center'
                    }`
                  }
                >
                  <BiSolidPlusSquare
                    size={16}
                    className="text-primary flex-shrink-0"
                  />
                  {!collapsed && (
                    <span className="ml-2 text-[12px] whitespace-nowrap">
                      Queued
                    </span>
                  )}
                </NavLink>
              </TooltipWrapper>
              <TooltipWrapper
                content={collapsed ? 'Downloading' : null}
                side="left"
              >
                <NavLink
                  to="/status/downloading"
                  className={({ isActive }) =>
                    `${collapsed ? 'p-2 ' : 'nav-link '} ${
                      isActive ? 'bg-titleBar dark:bg-darkModeCompliment' : ''
                    } dark:text-gray-200 dark:hover:bg-darkModeCompliment flex ml-1 ${
                      collapsed
                        ? 'justify-center p-2 hover:bg-titleBar dark:hover:bg-darkModeCompliment rounded dark:text-gray-200'
                        : 'items-center'
                    }`
                  }
                >
                  <BsHourglassSplit
                    size={16}
                    className="text-primary flex-shrink-0"
                  />
                  {!collapsed && (
                    <span className="ml-2 text-[12px] whitespace-nowrap">
                      Downloading
                    </span>
                  )}
                </NavLink>
              </TooltipWrapper>
              <TooltipWrapper content={collapsed ? 'Paused' : null} side="left">
                <NavLink
                  to="/status/paused"
                  className={({ isActive }) =>
                    `${collapsed ? 'p-2 ' : 'nav-link '} ${
                      isActive ? 'bg-titleBar dark:bg-darkModeCompliment' : ''
                    } dark:text-gray-200 dark:hover:bg-darkModeCompliment flex ml-1 ${
                      collapsed
                        ? 'justify-center p-2 hover:bg-titleBar dark:hover:bg-darkModeCompliment rounded dark:text-gray-200'
                        : 'items-center'
                    }`
                  }
                >
                  <PiPauseBold
                    size={16}
                    className="text-blue-500 flex-shrink-0"
                  />
                  {!collapsed && (
                    <span className="ml-2 text-[12px] whitespace-nowrap">
                      Paused
                    </span>
                  )}
                </NavLink>
              </TooltipWrapper>
              <TooltipWrapper
                content={collapsed ? 'Initializing' : null}
                side="left"
              >
                <NavLink
                  to="/status/initializing"
                  className={({ isActive }) =>
                    `${collapsed ? 'p-2 ' : 'nav-link '} ${
                      isActive ? 'bg-titleBar dark:bg-darkModeCompliment' : ''
                    } dark:text-gray-200 dark:hover:bg-darkModeCompliment flex ml-1 ${
                      collapsed
                        ? 'justify-center p-2 hover:bg-titleBar dark:hover:bg-darkModeCompliment rounded dark:text-gray-200'
                        : 'items-center'
                    }`
                  }
                >
                  <HiMiniArrowPath
                    size={17}
                    className="text-blue-500 flex-shrink-0"
                  />
                  {!collapsed && (
                    <span className="ml-2 text-[12px] whitespace-nowrap">
                      Initializing
                    </span>
                  )}
                </NavLink>
              </TooltipWrapper>
              <TooltipWrapper content={collapsed ? 'Failed' : null} side="left">
                <NavLink
                  to="/status/failed"
                  className={({ isActive }) =>
                    `${collapsed ? 'p-2 ' : 'nav-link '} ${
                      isActive ? 'bg-titleBar dark:bg-darkModeCompliment' : ''
                    } dark:text-gray-200 dark:hover:bg-darkModeCompliment flex ml-1 ${
                      collapsed
                        ? 'justify-center p-2 hover:bg-titleBar dark:hover:bg-darkModeCompliment rounded dark:text-gray-200'
                        : 'items-center'
                    }`
                  }
                >
                  <FaRegTimesCircle
                    size={17}
                    className="text-red-500 flex-shrink-0"
                  />
                  {!collapsed && (
                    <span className="ml-2 text-[12px] whitespace-nowrap">
                      Failed
                    </span>
                  )}
                </NavLink>
              </TooltipWrapper>
              <TooltipWrapper
                content={collapsed ? 'Finished' : null}
                side="left"
              >
                <NavLink
                  to="/status/finished"
                  className={({ isActive }) =>
                    `${collapsed ? 'p-2 ' : 'nav-link '} ${
                      isActive ? 'bg-titleBar dark:bg-darkModeCompliment' : ''
                    } dark:text-gray-200 dark:hover:bg-darkModeCompliment flex ml-1 ${
                      collapsed
                        ? 'justify-center p-2 hover:bg-titleBar dark:hover:bg-darkModeCompliment rounded dark:text-gray-200'
                        : 'items-center'
                    }`
                  }
                >
                  <MdPlayArrow
                    size={18}
                    className="text-green-500 flex-shrink-0"
                  />
                  {!collapsed && (
                    <span className="ml-2 text-[12px] whitespace-nowrap">
                      Finished
                    </span>
                  )}
                </NavLink>
              </TooltipWrapper>
            </div>
          )}
        </div>
        {/* Category Section */}
        <div>
          <TooltipWrapper content={collapsed ? 'Categories' : null} side="left">
            <button
              onClick={() => toggleSection('category')}
              className={`w-full flex items-center ${
                collapsed
                  ? 'justify-center'
                  : 'hover:bg-titleBar dark:hover:bg-darkModeCompliment rounded dark:text-gray-200 p-2'
              } `}
            >
              <div
                className={`flex items-center transition-opacity duration-300 ${
                  collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
                }`}
              >
                {openSections.category ? (
                  <FiChevronDown size={18} />
                ) : (
                  <FiChevronRight size={18} />
                )}
                <span className="ml-1 text-sm font-semibold whitespace-nowrap">
                  Categories
                </span>
              </div>
              {collapsed && (
                <div
                  className="p-2 hover:bg-titleBar dark:hover:bg-darkModeCompliment rounded dark:text-gray-200"
                  onClick={() => {
                    toggleCollapse();
                    setTimeout(() => {
                      setOpenSections((prev) => ({
                        ...prev,
                        category: true,
                      }));
                    }, 50);
                  }}
                >
                  <BiLayer
                    size={16}
                    className="text-[#16161E] dark:text-white"
                    title="Categories"
                  />
                </div>
              )}
            </button>
          </TooltipWrapper>
          {openSections.category && !collapsed && (
            <div className="ml-1 space-y-[6px]">
              <NavLink
                to="/category/all"
                className={({ isActive }) =>
                  `nav-link ${
                    isActive ? 'bg-titleBar dark:bg-darkModeCompliment' : ''
                  } dark:text-gray-200 dark:hover:bg-darkModeCompliment ml-1`
                }
              >
                <BiLayer size={16} className="text-orange-500 flex-shrink-0" />
                <span className="ml-2 text-[12px]">All</span>
              </NavLink>
              <NavLink
                to="/category/uncategorized"
                className={({ isActive }) =>
                  `nav-link ${
                    isActive ? 'bg-titleBar dark:bg-darkModeCompliment' : ''
                  } dark:text-gray-200 dark:hover:bg-darkModeCompliment ml-1`
                }
              >
                <BiLayer size={16} className="text-blue-500 flex-shrink-0" />
                <span className="ml-2 text-[12px]">Uncategorized</span>
              </NavLink>
              {availableCategories.map((category) => (
                <NavLink
                  key={category}
                  to={`/category/${encodeURIComponent(category)}`}
                  className={({ isActive }) =>
                    `nav-link ${
                      isActive ? 'bg-titleBar dark:bg-darkModeCompliment' : ''
                    } dark:text-gray-200 dark:hover:bg-darkModeCompliment ml-1 ${
                      dragOverItem === category
                        ? 'bg-titleBar dark:bg-darkModeCompliment'
                        : ''
                    }`
                  }
                  onContextMenu={(e) => handleCategoryRightClick(e, category)}
                  onDragOver={(e) => handleDragOver(e, category)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleCategoryDrop(e, category)}
                  aria-dropeffect="link"
                  role="listitem"
                >
                  <BiLayer
                    size={16}
                    className="text-yellow-500 flex-shrink-0"
                  />
                  <span className="ml-2 text-[12px] truncate">{category}</span>
                </NavLink>
              ))}
            </div>
          )}
        </div>

        {/* Tag Section */}
        <div>
          <TooltipWrapper content={collapsed ? 'Tags' : null} side="left">
            <button
              onClick={() => toggleSection('tag')}
              className={`w-full flex items-center ${
                collapsed
                  ? 'justify-center'
                  : 'p-2 hover:bg-titleBar dark:hover:bg-darkModeCompliment rounded dark:text-gray-200 '
              }`}
            >
              <div
                className={`flex items-center transition-opacity duration-300 ${
                  collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'
                }`}
              >
                {openSections.tag ? (
                  <FiChevronDown size={18} />
                ) : (
                  <FiChevronRight size={18} />
                )}
                <span className="ml-1 text-sm font-semibold whitespace-nowrap">
                  Tags
                </span>
              </div>
              {collapsed && (
                <div
                  className="p-2 hover:bg-titleBar dark:hover:bg-darkModeCompliment rounded dark:text-gray-200"
                  onClick={() => {
                    toggleCollapse();
                    setTimeout(() => {
                      setOpenSections((prev) => ({
                        ...prev,
                        tag: true,
                      }));
                    }, 50);
                  }}
                >
                  <BsTag size={16} className="text-[#16161E] dark:text-white" />
                </div>
              )}
            </button>
          </TooltipWrapper>
          {openSections.tag && !collapsed && (
            <div className="ml-2 space-y-[6px]">
              <NavLink
                to="/tags/all"
                className={({ isActive }) =>
                  `nav-link ${
                    isActive ? 'bg-titleBar dark:bg-darkModeCompliment' : ''
                  } dark:text-gray-200 dark:hover:bg-darkModeCompliment`
                }
              >
                <BsTag size={16} className="text-orange-500 flex-shrink-0" />
                <span className="ml-2 text-[12px]">All</span>
              </NavLink>
              <NavLink
                to="/tags/untagged"
                className={({ isActive }) =>
                  `nav-link ${
                    isActive ? 'bg-titleBar dark:bg-darkModeCompliment' : ''
                  } dark:text-gray-200 dark:hover:bg-darkModeCompliment`
                }
              >
                <BsTag size={16} className="text-blue-500 flex-shrink-0" />
                <span className="ml-1 text-[12px]">Untagged</span>
              </NavLink>
              {availableTags.map((tag) => (
                <NavLink
                  key={tag}
                  to={`/tags/${encodeURIComponent(tag)}`}
                  className={({ isActive }) =>
                    `nav-link ${
                      isActive ? 'bg-titleBar dark:bg-darkModeCompliment' : ''
                    } dark:text-gray-200 dark:hover:bg-darkModeCompliment ${
                      dragOverItem === tag
                        ? 'bg-titleBar dark:bg-darkModeCompliment'
                        : ''
                    }`
                  }
                  onContextMenu={(e) => handleTagRightClick(e, tag)}
                  onDragOver={(e) => handleDragOver(e, tag)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleTagDrop(e, tag)}
                >
                  <BsTag size={16} className="text-yellow-500 flex-shrink-0" />
                  <span className="ml-2 text-[12px] truncate">{tag}</span>
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* close and open toggle */}
      <div
        className="fixed bottom-4 z-10 ml-2"
        style={{
          width: collapsed ? '70px' : '205px',
          transform: 'translateX(-50%)',
          left: collapsed ? '35px' : '102.5px',
        }}
      >
        <TooltipWrapper
          content={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          side="left"
        >
          <button
            onClick={toggleCollapse}
            className={`flex items-center justify-center w-10 h-10 rounded-full bg-white dark:bg-darkModeCompliment shadow-md hover:bg-titleBar dark:hover:bg-secondary dark:text-white dark:hover:text-white border border-gray-200 dark:border-inputDarkMode`}
          >
            {collapsed ? (
              <FiChevronRight size={22} />
            ) : (
              <FiChevronLeft size={22} />
            )}
          </button>
        </TooltipWrapper>
      </div>

      {contextMenu && (
        <CategoryContextMenu
          position={{ x: contextMenu.x, y: contextMenu.y }}
          categoryName={contextMenu.category}
          onClose={() => setContextMenu(null)}
          onRename={renameCategory}
          onDelete={deleteCategory}
        />
      )}

      {tagContextMenu && (
        <TagContextMenu
          position={{ x: tagContextMenu.x, y: tagContextMenu.y }}
          tagName={tagContextMenu.tag}
          onClose={() => setTagContextMenu(null)}
          onRename={(oldName, newName) => {
            renameTag(oldName, newName);
            setTagContextMenu(null);
          }}
          onDelete={(tag) => {
            deleteTag(tag);
            setTagContextMenu(null);
          }}
        />
      )}
    </nav>
  );
};

export default Navigation;
