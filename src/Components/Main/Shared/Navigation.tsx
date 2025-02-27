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
import { FiDownload } from 'react-icons/fi';
import { AiOutlineCheck } from 'react-icons/ai';
import { BiLayer } from 'react-icons/bi';
import { BsTag } from 'react-icons/bs';
import { CiFolderOn } from 'react-icons/ci';
import useDownloadStore from '../../../Store/downloadStore';
import CategoryContextMenu from '../../SubComponents/custom/CategoryContextMenu';
import TagContextMenu from '../../SubComponents/custom/TagContextMenu';

const Navigation = ({ className }: { className?: string }) => {
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

  return (
    <nav
      ref={navRef}
      className={`${className} border-solid border-r-2 border-gray-200 dark:border-gray-700`}
    >
      <div className="p-2 space-y-2 ml-2">
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
            <div className="ml-4 space-y-1">
              <NavLink
                to="/allDownloads"
                className={({ isActive }) =>
                  `nav-link ${
                    isActive ? 'bg-gray-100 dark:bg-gray-700' : ''
                  } dark:text-gray-200 dark:hover:bg-gray-700`
                }
              >
                <CiFolderOn className="text-gray-600 dark:text-gray-400 text-lg flex-shrink-0" />
                <span className="ml-2">All</span>
              </NavLink>
              <NavLink
                to="/downloading"
                className={({ isActive }) =>
                  `nav-link ${
                    isActive ? 'bg-gray-100 dark:bg-gray-700' : ''
                  } dark:text-gray-200 dark:hover:bg-gray-700`
                }
              >
                <FiDownload className="text-blue-500 text-lg flex-shrink-0" />
                <span className="ml-2">Downloading</span>
              </NavLink>
              <NavLink
                to="/completed"
                className={({ isActive }) =>
                  `nav-link ${
                    isActive ? 'bg-gray-100 dark:bg-gray-700' : ''
                  } dark:text-gray-200 dark:hover:bg-gray-700`
                }
              >
                <AiOutlineCheck className="text-green-500 text-lg flex-shrink-0" />
                <span className="ml-2">Completed</span>
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
            <span className="ml-2 text-sm font-semibold">Category</span>
          </button>

          {openSections.category && (
            <div className="ml-4 space-y-1">
              <NavLink to="/category/all" className="nav-link">
                <BiLayer className="text-orange-500 text-lg flex-shrink-0" />
                <span className="ml-2">All</span>
              </NavLink>
              <NavLink to="/category/uncategorized" className="nav-link">
                <BiLayer className="text-blue-500 text-lg flex-shrink-0" />
                <span className="ml-2">Uncategorized</span>
              </NavLink>
              {availableCategories.map((category) => (
                <NavLink
                  key={category}
                  to={`/category/${encodeURIComponent(category)}`}
                  className="nav-link"
                  onContextMenu={(e) => handleCategoryContextMenu(e, category)}
                >
                  <BiLayer className="text-yellow-500 text-lg flex-shrink-0" />
                  <span className="ml-2 truncate">{category}</span>
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
            <span className="ml-2 text-sm font-semibold">Tag</span>
          </button>

          {openSections.tag && (
            <div className="ml-4 space-y-1">
              <NavLink to="/tags/all" className="nav-link">
                <BsTag className="text-orange-500 text-lg flex-shrink-0" />
                <span className="ml-2">All</span>
              </NavLink>
              <NavLink to="/tags/untagged" className="nav-link">
                <BsTag className="text-blue-500 text-lg flex-shrink-0" />
                <span className="ml-2">Untagged</span>
              </NavLink>
              {availableTags.map((tag) => (
                <NavLink
                  key={tag}
                  to={`/tags/${encodeURIComponent(tag)}`}
                  className="nav-link"
                  onContextMenu={(e) => {
                    e.preventDefault();
                    handleTagContextMenu(e, tag);
                  }}
                >
                  <BsTag className="text-yellow-500 text-lg flex-shrink-0" />
                  <span className="ml-2 truncate">{tag}</span>
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
