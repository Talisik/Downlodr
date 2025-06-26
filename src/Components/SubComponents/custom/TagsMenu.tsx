/**
 * A custom React component
 * A React component that displays a menu for managing tags.
 * It allows users to add new tags and select from available tags.
 *
 * @param TagMenuProps
 *   @param downloadId - A unique identifier for the download associated with the tags.
 *   @param onAddTag - A function to handle adding a new tag.
 *   @param onRemoveTag - A function to handle removing a tag.
 *   @param currentTags - An array of currently selected tag names.
 *   @param availableTags - An array of available tag names to choose from.
 *   @param menuPositionClass - A string representing CSS classes for positioning the menu.
 *
 * @returns JSX.Element - The rendered tag menu component.
 */

import React, { useEffect, useState } from 'react';
import { GoPlus } from 'react-icons/go';

interface TagMenuProps {
  downloadId: string; // Unique identifier for the download
  onAddTag: (downloadId: string, tag: string) => void; // Function to add a new tag
  onRemoveTag: (downloadId: string, tag: string) => void; // Function to remove a tag
  currentTags: string[]; // Array of currently selected tags
  availableTags: string[]; // Array of available tags to choose from
  menuPositionClass: string; // CSS classes for positioning the menu
}

const TagMenu: React.FC<TagMenuProps> = ({
  downloadId,
  onAddTag,
  onRemoveTag,
  currentTags,
  availableTags,
  menuPositionClass,
}) => {
  const [newTag, setNewTag] = useState('');
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Adjusts menu location based on element location
  useEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      if (menuRect.right > viewportWidth) {
        menuRef.current.style.left = 'auto';
        menuRef.current.style.right = '100%';
        menuRef.current.style.marginLeft = '-1px';
      }

      if (menuRect.bottom > viewportHeight) {
        menuRef.current.style.top = 'auto';
        menuRef.current.style.bottom = '0';
      }
    }
  }, []);

  return (
    <div
      ref={menuRef}
      className={`absolute bg-white dark:bg-darkMode border rounded-md shadow-lg py-1 min-w-[180px] z-50 ${menuPositionClass} dark:border-gray-700`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="m-2 px-4 py-2 flex flex-row border rounded dark:border-gray-700">
        <GoPlus size={22} className="ml-[-10px] mr-2 dark:text-gray-200" />
        <div className="flex-1">
          <input
            type="text"
            placeholder="Add new tag..."
            value={newTag}
            maxLength={10}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === 'Enter' &&
                newTag.trim() &&
                newTag.trim().length <= 10
              ) {
                onAddTag(downloadId, newTag.trim());
                setNewTag('');
              }
            }}
            className="w-full outline-none dark:bg-darkMode dark:text-gray-200"
          />
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {newTag.length}/10 characters
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
  );
};

export default TagMenu;
