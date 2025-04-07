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
import React, { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { HiChevronDown, HiChevronRight } from 'react-icons/hi';
import { FiDownload, FiFolder } from 'react-icons/fi';
import { AiOutlineCheck, AiOutlineFileSearch } from 'react-icons/ai';
import { BiLayer } from 'react-icons/bi';
import { BsTag } from 'react-icons/bs';
import { CiFolderOn } from 'react-icons/ci';
import useDownloadStore from '../../../Store/downloadStore';
import CategoryContextMenu from '../../SubComponents/custom/CategoryContextMenu';
import TagContextMenu from '../../SubComponents/custom/TagContextMenu';
import { TbDeviceTabletSearch } from 'react-icons/tb';
import { PiPauseBold } from 'react-icons/pi';
import { HiMiniArrowPath } from 'react-icons/hi2';
import { CgClose } from 'react-icons/cg';
import { MdPlayArrow } from 'react-icons/md';

// import { toast } from 'react-hot-toast';
import { toast } from '../../../Components/SubComponents/shadcn/hooks/use-toast';

const Navigation = ({ className }: { className?: string }) => {
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

  const handleCategoryContextMenu = (e: React.MouseEvent, category: string) => {
    e.preventDefault();
    setContextMenu({
      category,
      x: e.clientX,
      y: e.clientY,
    });
  };

  const handleTagContextMenu = (e: React.MouseEvent, tag: string) => {
    e.preventDefault();
    setTagContextMenu({
      tag,
      x: e.clientX,
      y: e.clientY,
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
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setContextMenu(null);
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
      className={`${className} border-solid border-r border-gray-200 dark:border-componentBorder`}
    >
      <div className="p-2 space-y-2 ml-2 mt-2">
        {/* Status Section */}
        <div>
          <button
            onClick={() => toggleSection('status')}
            className="w-full flex items-center p-2 hover:bg-gray-200 dark:hover:bg-darkModeCompliment rounded dark:text-gray-200"
          >
            {openSections.status ? (
              <HiChevronDown size={18} />
            ) : (
              <HiChevronRight size={18} />
            )}
            <span className="ml-2 text-sm font-semibold">Status</span>
          </button>

          {openSections.status && (
            <div className="ml-2 space-y-1 mt-1">
              <NavLink
                to="/status/all"
                className={({ isActive }) =>
                  `nav-link ${
                    isActive ? 'bg-gray-100 dark:bg-gray-700' : ''
                  } dark:text-gray-200 dark:hover:bg-gray-700`
                }
              >
                <FiFolder size={16} className="text-primary flex-shrink-0" />
                <span className="ml-2 text-[14px]">All</span>
              </NavLink>
              <NavLink
                to="/status/fetching-metadata"
                className={({ isActive }) =>
                  `nav-link ${
                    isActive ? 'bg-gray-100 dark:bg-gray-700' : ''
                  } dark:text-gray-200 dark:hover:bg-gray-700`
                }
              >
                <TbDeviceTabletSearch
                  size={17}
                  className="text-blue-500 flex-shrink-0"
                />
                <span className="ml-2 text-[14px]">Fetching Metadata</span>
              </NavLink>
              <NavLink
                to="/status/to-download"
                className={({ isActive }) =>
                  `nav-link ${
                    isActive ? 'bg-gray-100 dark:bg-gray-700' : ''
                  } dark:text-gray-200 dark:hover:bg-gray-700`
                }
              >
                <FiDownload size={16} className="text-primary flex-shrink-0" />
                <span className="ml-2 text-[14px] ">Start Download</span>
              </NavLink>
              <NavLink
                to="/status/downloading"
                className={({ isActive }) =>
                  `nav-link ${
                    isActive ? 'bg-gray-100 dark:bg-gray-700' : ''
                  } dark:text-gray-200 dark:hover:bg-gray-700`
                }
              >
                <FiDownload size={16} className="text-primary flex-shrink-0" />
                <span className="ml-2 text-[14px]">Downloading</span>
              </NavLink>

              <NavLink
                to="/status/paused"
                className={({ isActive }) =>
                  `nav-link ${
                    isActive ? 'bg-gray-100 dark:bg-gray-700' : ''
                  } dark:text-gray-200 dark:hover:bg-gray-700`
                }
              >
                <PiPauseBold
                  size={16}
                  className="text-blue-500 flex-shrink-0"
                />
                <span className="ml-2 text-[14px]">Paused</span>
              </NavLink>
              <NavLink
                to="/status/initializing"
                className={({ isActive }) =>
                  `nav-link ${
                    isActive ? 'bg-gray-100 dark:bg-gray-700' : ''
                  } dark:text-gray-200 dark:hover:bg-gray-700`
                }
              >
                <HiMiniArrowPath
                  size={17}
                  className="text-blue-500 flex-shrink-0"
                />
                <span className="ml-2 text-[14px]">Initializing</span>
              </NavLink>

              <NavLink
                to="/status/failed"
                className={({ isActive }) =>
                  `nav-link ${
                    isActive ? 'bg-gray-100 dark:bg-gray-700' : ''
                  } dark:text-gray-200 dark:hover:bg-gray-700`
                }
              >
                <CgClose size={17} className="text-red-500 flex-shrink-0" />
                <span className="ml-2 text-[14px]">Failed</span>
              </NavLink>
              <NavLink
                to="/status/finished"
                className={({ isActive }) =>
                  `nav-link ${
                    isActive ? 'bg-gray-100 dark:bg-gray-700' : ''
                  } dark:text-gray-200 dark:hover:bg-gray-700`
                }
              >
                <MdPlayArrow
                  size={18}
                  className="text-green-500 flex-shrink-0"
                />
                <span className="ml-2 text-[14px]">Finished</span>
              </NavLink>
            </div>
          )}
        </div>

        {/* Category Section */}
        <div>
          <button
            onClick={() => toggleSection('category')}
            className="w-full flex items-center p-2 hover:bg-gray-200 dark:hover:bg-darkModeCompliment rounded dark:text-gray-200"
          >
            {openSections.category ? (
              <HiChevronDown size={18} />
            ) : (
              <HiChevronRight size={18} />
            )}
            <span className="ml-2 text-sm font-semibold">Categories</span>
          </button>

          {openSections.category && (
            <div className="ml-2 space-y-1 mt-1">
              <NavLink
                to="/category/all"
                className={({ isActive }) =>
                  `nav-link ${
                    isActive ? 'bg-gray-100 dark:bg-gray-700' : ''
                  } dark:text-gray-200 dark:hover:bg-gray-700`
                }
              >
                <BiLayer size={16} className="text-orange-500 flex-shrink-0" />
                <span className="ml-2 text-[14px]">All</span>
              </NavLink>
              <NavLink
                to="/category/uncategorized"
                className={({ isActive }) =>
                  `nav-link ${
                    isActive ? 'bg-gray-100 dark:bg-gray-700' : ''
                  } dark:text-gray-200 dark:hover:bg-gray-700`
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
                      isActive ? 'bg-gray-100 dark:bg-gray-700' : ''
                    } dark:text-gray-200 dark:hover:bg-gray-700 ${
                      dragOverItem === category
                        ? 'bg-gray-200 dark:bg-gray-700'
                        : ''
                    }`
                  }
                  onContextMenu={(e) => handleCategoryContextMenu(e, category)}
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
            className="w-full flex items-center p-2 hover:bg-gray-200 dark:hover:bg-darkModeCompliment rounded dark:text-gray-200"
          >
            {openSections.tag ? (
              <HiChevronDown size={18} />
            ) : (
              <HiChevronRight size={18} />
            )}
            <span className="ml-2 text-sm font-semibold">Tags</span>
          </button>

          {openSections.tag && (
            <div className="ml-2 space-y-1 mt-1">
              <NavLink
                to="/tags/all"
                className={({ isActive }) =>
                  `nav-link ${
                    isActive ? 'bg-gray-100 dark:bg-gray-700' : ''
                  } dark:text-gray-200 dark:hover:bg-gray-700`
                }
              >
                <BsTag size={16} className="text-orange-500 flex-shrink-0" />
                <span className="ml-2 text-[14px]">All</span>
              </NavLink>
              <NavLink
                to="/tags/untagged"
                className={({ isActive }) =>
                  `nav-link ${
                    isActive ? 'bg-gray-100 dark:bg-gray-700' : ''
                  } dark:text-gray-200 dark:hover:bg-gray-700`
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
                      isActive ? 'bg-gray-100 dark:bg-gray-700' : ''
                    } dark:text-gray-200 dark:hover:bg-gray-700 ${
                      dragOverItem === tag ? 'bg-gray-200 dark:bg-gray-700' : ''
                    }`
                  }
                  onContextMenu={(e) => handleTagContextMenu(e, tag)}
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
