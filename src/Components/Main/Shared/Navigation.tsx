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
import React, { useEffect, useRef, useState } from 'react';
import { BiLayer } from 'react-icons/bi';
import { BsHourglassSplit, BsTag } from 'react-icons/bs';
import { CgClose } from 'react-icons/cg';
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
import useDownloadStore from '../../../Store/downloadStore';
import CategoryContextMenu from '../../SubComponents/custom/CategoryContextMenu';
import TagContextMenu from '../../SubComponents/custom/TagContextMenu';

// import { toast } from 'react-hot-toast';
import { toast } from '../../../Components/SubComponents/shadcn/hooks/use-toast';

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
  // New state for All navigation dropdown
  const [showStatusSubItems, setShowStatusSubItems] = useState(false);

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Toggle status sub-items on double click
  const toggleStatusSubItems = () => {
    setShowStatusSubItems((prev) => !prev);
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

    // Add the new category
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
      // Add the download to this tag
      // useDownloadStore.getState().addTag(downloadId, tag);
      ensureNoDouble(downloadId, tag);
      // Show a success toast
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
        className={`${collapsed ? 'px-1' : 'p-2 ml-2'} mt-2 space-y-2 pb-20`}
      >
        {/* Status Section */}
        <div>
          <button
            onClick={() => toggleSection('status')}
            className={`w-full flex items-center ${
              collapsed
                ? 'justify-center hover:none dark:hover:none cursor-default'
                : 'hover:bg-gray-200 dark:hover:bg-darkModeCompliment rounded dark:text-gray-200'
            } p-2`}
          >
            {!collapsed &&
              (openSections.status ? (
                <FiChevronDown size={18} />
              ) : (
                <FiChevronRight size={18} />
              ))}
            {!collapsed && (
              <span className="ml-2 text-sm font-semibold">Status</span>
            )}
          </button>
          {/* Show items regardless of openSections when collapsed */}
          {(openSections.status || collapsed) && (
            <div
              className={`${
                collapsed ? 'flex flex-col items-center' : 'ml-2'
              } space-y-1 mt-1`}
            >
              <NavLink
                to="/status/all"
                className={({ isActive }) =>
                  `${collapsed ? 'p-2 ' : 'nav-link '} ${
                    isActive ? 'bg-gray-100 dark:bg-darkModeCompliment' : ''
                  } dark:text-gray-200 dark:hover:bg-darkModeCompliment flex ${
                    collapsed
                      ? 'justify-center p-2 hover:bg-gray-200 dark:hover:bg-darkModeCompliment rounded dark:text-gray-200'
                      : 'items-center'
                  }`
                }
                title={collapsed ? 'All' : ''}
              >
                <FiFolder size={16} className="text-primary flex-shrink-0" />
                {!collapsed && <span className="ml-2 text-[14px]">All</span>}
              </NavLink>

              <NavLink
                to="/status/fetching-metadata"
                className={({ isActive }) =>
                  `${collapsed ? 'p-2 ' : 'nav-link '} ${
                    isActive ? 'bg-gray-100 dark:bg-darkModeCompliment' : ''
                  } dark:text-gray-200 dark:hover:bg-darkModeCompliment flex ${
                    collapsed
                      ? 'justify-center p-2 hover:bg-gray-200 dark:hover:bg-darkModeCompliment rounded dark:text-gray-200'
                      : 'items-center'
                  }`
                }
                title={collapsed ? 'Fetching Metadata' : ''}
              >
                <TbDeviceTabletSearch
                  size={17}
                  className="text-blue-500 flex-shrink-0"
                />
                {!collapsed && (
                  <span className="ml-2 text-[14px] whitespace-nowrap">
                    Loading Metadata
                  </span>
                )}
              </NavLink>

              <NavLink
                to="/status/to-download"
                className={({ isActive }) =>
                  `${collapsed ? 'p-2 ' : 'nav-link '} ${
                    isActive ? 'bg-gray-100 dark:bg-darkModeCompliment' : ''
                  } dark:text-gray-200 dark:hover:bg-darkModeCompliment flex ${
                    collapsed
                      ? 'justify-center p-2 hover:bg-gray-200 dark:hover:bg-darkModeCompliment rounded dark:text-gray-200'
                      : 'items-center'
                  }`
                }
                title={collapsed ? 'Start Download' : ''}
              >
                <FiDownload size={16} className="text-primary flex-shrink-0" />
                {!collapsed && (
                  <span className="ml-2 text-[14px] whitespace-nowrap">
                    Starting Download
                  </span>
                )}
              </NavLink>

              <NavLink
                to="/status/downloading"
                className={({ isActive }) =>
                  `${collapsed ? 'p-2 ' : 'nav-link '} ${
                    isActive ? 'bg-gray-100 dark:bg-darkModeCompliment' : ''
                  } dark:text-gray-200 dark:hover:bg-darkModeCompliment flex ${
                    collapsed
                      ? 'justify-center p-2 hover:bg-gray-200 dark:hover:bg-darkModeCompliment rounded dark:text-gray-200'
                      : 'items-center'
                  }`
                }
                title={collapsed ? 'Downloading' : ''}
              >
                <BsHourglassSplit
                  size={16}
                  className="text-primary flex-shrink-0"
                />
                {!collapsed && (
                  <span className="ml-2 text-[14px]">Downloading</span>
                )}
              </NavLink>

              <NavLink
                to="/status/paused"
                className={({ isActive }) =>
                  `${collapsed ? 'p-2 ' : 'nav-link '} ${
                    isActive ? 'bg-gray-100 dark:bg-darkModeCompliment' : ''
                  } dark:text-gray-200 dark:hover:bg-darkModeCompliment flex ${
                    collapsed
                      ? 'justify-center p-2 hover:bg-gray-200 dark:hover:bg-darkModeCompliment rounded dark:text-gray-200'
                      : 'items-center'
                  }`
                }
                title={collapsed ? 'Paused' : ''}
              >
                <PiPauseBold
                  size={16}
                  className="text-blue-500 flex-shrink-0"
                />
                {!collapsed && <span className="ml-2 text-[14px]">Paused</span>}
              </NavLink>

              <NavLink
                to="/status/initializing"
                className={({ isActive }) =>
                  `${collapsed ? 'p-2 ' : 'nav-link '} ${
                    isActive ? 'bg-gray-100 dark:bg-darkModeCompliment' : ''
                  } dark:text-gray-200 dark:hover:bg-darkModeCompliment flex ${
                    collapsed
                      ? 'justify-center p-2 hover:bg-gray-200 dark:hover:bg-darkModeCompliment rounded dark:text-gray-200'
                      : 'items-center'
                  }`
                }
                title={collapsed ? 'Initializing' : ''}
              >
                <HiMiniArrowPath
                  size={17}
                  className="text-blue-500 flex-shrink-0"
                />
                {!collapsed && (
                  <span className="ml-2 text-[14px]">Initializing</span>
                )}
              </NavLink>

              <NavLink
                to="/status/failed"
                className={({ isActive }) =>
                  `${collapsed ? 'p-2 ' : 'nav-link '} ${
                    isActive ? 'bg-gray-100 dark:bg-darkModeCompliment' : ''
                  } dark:text-gray-200 dark:hover:bg-darkModeCompliment flex ${
                    collapsed
                      ? 'justify-center p-2 hover:bg-gray-200 dark:hover:bg-darkModeCompliment rounded dark:text-gray-200'
                      : 'items-center'
                  }`
                }
                title={collapsed ? 'Failed' : ''}
              >
                <CgClose size={17} className="text-red-500 flex-shrink-0" />
                {!collapsed && <span className="ml-2 text-[14px]">Failed</span>}
              </NavLink>

              <NavLink
                to="/status/finished"
                className={({ isActive }) =>
                  `${collapsed ? 'p-2 ' : 'nav-link '} ${
                    isActive ? 'bg-gray-100 dark:bg-darkModeCompliment' : ''
                  } dark:text-gray-200 dark:hover:bg-darkModeCompliment flex ${
                    collapsed
                      ? 'justify-center p-2 hover:bg-gray-200 dark:hover:bg-darkModeCompliment rounded dark:text-gray-200'
                      : 'items-center'
                  }`
                }
                title={collapsed ? 'Finished' : ''}
              >
                <MdPlayArrow
                  size={18}
                  className="text-green-500 flex-shrink-0"
                />
                {!collapsed && (
                  <span className="ml-2 text-[14px]">Finished</span>
                )}
              </NavLink>
            </div>
          )}
        </div>

        {/* Category Section */}
        <div>
          <button
            onClick={() => toggleSection('category')}
            className={`w-full flex items-center ${
              collapsed
                ? 'justify-center'
                : 'hover:bg-gray-200 dark:hover:bg-darkModeCompliment rounded dark:text-gray-200 p-2'
            } `}
          >
            {!collapsed &&
              (openSections.category ? (
                <FiChevronDown size={18} />
              ) : (
                <FiChevronRight size={18} />
              ))}
            {!collapsed && (
              <span className="ml-2 text-sm font-semibold">Categories</span>
            )}
            {collapsed && (
              <div
                className="p-2 hover:bg-gray-200 dark:hover:bg-darkModeCompliment rounded dark:text-gray-200"
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

          {openSections.category && !collapsed && (
            <div className="ml-2 space-y-1 mt-1">
              <NavLink
                to="/category/all"
                className={({ isActive }) =>
                  `nav-link ${
                    isActive ? 'bg-gray-100 dark:bg-darkModeCompliment' : ''
                  } dark:text-gray-200 dark:hover:bg-darkModeCompliment`
                }
              >
                <BiLayer size={16} className="text-orange-500 flex-shrink-0" />
                <span className="ml-2 text-[14px]">All</span>
              </NavLink>
              <NavLink
                to="/category/uncategorized"
                className={({ isActive }) =>
                  `nav-link ${
                    isActive ? 'bg-gray-100 dark:bg-darkModeCompliment' : ''
                  } dark:text-gray-200 dark:hover:bg-darkModeCompliment`
                }
              >
                <BiLayer size={16} className="text-blue-500 flex-shrink-0" />
                <span className="ml-2 text-[14px]">Uncategorized</span>
              </NavLink>
              {availableCategories.map((category) => (
                <NavLink
                  key={category}
                  to={`/category/${encodeURIComponent(category)}`}
                  className={({ isActive }) =>
                    `nav-link ${
                      isActive ? 'bg-gray-100 dark:bg-darkModeCompliment' : ''
                    } dark:text-gray-200 dark:hover:bg-darkModeCompliment ${
                      dragOverItem === category
                        ? 'bg-gray-200 dark:bg-darkModeCompliment'
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
                  <span className="ml-2 text-[14px] truncate">{category}</span>
                </NavLink>
              ))}
            </div>
          )}
        </div>

        {/* Tag Section */}
        <div>
          <button
            onClick={() => toggleSection('tag')}
            className={`w-full flex items-center ${
              collapsed
                ? 'justify-center'
                : 'p-2 hover:bg-gray-200 dark:hover:bg-darkModeCompliment rounded dark:text-gray-200 '
            }`}
          >
            {!collapsed &&
              (openSections.tag ? (
                <FiChevronDown size={18} />
              ) : (
                <FiChevronRight size={18} />
              ))}
            {!collapsed && (
              <span className="ml-2 text-sm font-semibold">Tags</span>
            )}
            {collapsed && (
              <div
                className="p-2 hover:bg-gray-200 dark:hover:bg-darkModeCompliment rounded dark:text-gray-200"
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
                <BsTag
                  size={16}
                  className="text-[#16161E] dark:text-white"
                  title="Tags"
                />
              </div>
            )}
          </button>

          {openSections.tag && !collapsed && (
            <div className="ml-2 space-y-1 mt-1">
              <NavLink
                to="/tags/all"
                className={({ isActive }) =>
                  `nav-link ${
                    isActive ? 'bg-gray-100 dark:bg-darkModeCompliment' : ''
                  } dark:text-gray-200 dark:hover:bg-darkModeCompliment`
                }
              >
                <BsTag size={16} className="text-orange-500 flex-shrink-0" />
                <span className="ml-2 text-[14px]">All</span>
              </NavLink>
              <NavLink
                to="/tags/untagged"
                className={({ isActive }) =>
                  `nav-link ${
                    isActive ? 'bg-gray-100 dark:bg-darkModeCompliment' : ''
                  } dark:text-gray-200 dark:hover:bg-darkModeCompliment`
                }
              >
                <BsTag size={16} className="text-blue-500 flex-shrink-0" />
                <span className="ml-2 text-[14px]">Untagged</span>
              </NavLink>
              {availableTags.map((tag) => (
                <NavLink
                  key={tag}
                  to={`/tags/${encodeURIComponent(tag)}`}
                  className={({ isActive }) =>
                    `nav-link ${
                      isActive ? 'bg-gray-100 dark:bg-darkModeCompliment' : ''
                    } dark:text-gray-200 dark:hover:bg-darkModeCompliment ${
                      dragOverItem === tag
                        ? 'bg-gray-200 dark:bg-darkModeCompliment'
                        : ''
                    }`
                  }
                  onContextMenu={(e) => handleTagRightClick(e, tag)}
                  onDragOver={(e) => handleDragOver(e, tag)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleTagDrop(e, tag)}
                >
                  <BsTag size={16} className="text-yellow-500 flex-shrink-0" />
                  <span className="ml-2 text-[14px] truncate">{tag}</span>
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* close and open toggle */}
      <div
        className="fixed bottom-4 z-10 ml-3"
        style={{
          width: collapsed ? '70px' : '205px',
          transform: 'translateX(-50%)',
          left: collapsed ? '35px' : '102.5px',
        }}
      >
        <button
          onClick={toggleCollapse}
          className={`flex items-center justify-center w-10 h-10 rounded-full bg-white dark:darkModeLight shadow-md hover:bg-gray-100 dark:hover:bg-darkModeCompliment dark:text-black dark:hover:text-white border border-gray-200 dark:border-gray-700`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <FiChevronRight size={22} />
          ) : (
            <FiChevronLeft size={22} />
          )}
        </button>
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
