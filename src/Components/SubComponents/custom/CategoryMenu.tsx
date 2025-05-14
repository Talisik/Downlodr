/**
 * A custom React component
 * A React component that displays a menu for managing categories.
 * It allows users to add new categories and select from available categories.
 *
 * @param CategoryMenuProps
 *   @param downloadId - A unique identifier for the download associated with the categories.
 *   @param onAddCategory - A function to handle adding a new category.
 *   @param onRemoveCategory - A function to handle removing a category.
 *   @param currentCategories - An array of currently selected category names.
 *   @param availableCategories - An array of available category names to choose from.
 *   @param menuPositionClass - A string representing CSS classes for positioning the menu.
 *
 * @returns JSX.Element - The rendered category menu component.
 */

import React, { useState } from 'react';
import { GoPlus } from 'react-icons/go';

interface CategoryMenuProps {
  downloadId: string; // Unique identifier for the download
  onAddCategory: (downloadId: string, category: string) => void; // Function to add a new category
  onRemoveCategory: (downloadId: string, category: string) => void; // Function to remove a category
  currentCategories: string[]; // Array of currently selected categories
  availableCategories: string[]; // Array of available categories to choose from
  menuPositionClass: string; // CSS classes for positioning the menu
}

const CategoryMenu: React.FC<CategoryMenuProps> = ({
  downloadId,
  onAddCategory,
  onRemoveCategory,
  currentCategories,
  availableCategories,
  menuPositionClass,
}) => {
  const [newCategory, setNewCategory] = useState('');
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
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

  const handleCategoryClick = (category: string) => {
    if (currentCategories.includes(category)) {
      onRemoveCategory(downloadId, category);
    } else {
      if (currentCategories.length > 0) {
        onRemoveCategory(downloadId, currentCategories[0]);
      }
      onAddCategory(downloadId, category);
    }
  };

  const handleNewCategory = (category: string) => {
    if (category.trim()) {
      if (currentCategories.length > 0) {
        onRemoveCategory(downloadId, currentCategories[0]);
      }
      onAddCategory(downloadId, category.trim());
      setNewCategory('');
    }
  };

  return (
    <div
      ref={menuRef}
      className={`absolute bg-white dark:bg-darkMode border rounded-md shadow-lg py-1 min-w-[180px] z-50 ${menuPositionClass} dark:border-gray-700`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="m-2 px-4 py-2 flex flex-row border rounded dark:border-gray-700">
        <GoPlus size={22} className="ml-[-10px] mr-2 dark:text-gray-200" />
        <input
          type="text"
          placeholder="Add new category..."
          value={newCategory}
          onChange={(e) => setNewCategory(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleNewCategory(newCategory);
            }
          }}
          className="w-full outline-none dark:bg-darkMode dark:text-gray-200"
        />
      </div>
      <hr className="solid mt-2 mb-1 mx-2 w-[calc(100%-20px)] border-t-2 border-divider dark:border-gray-700" />

      <div className="max-h-48 overflow-y-auto">
        {availableCategories.map((category) => (
          <button
            key={category}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-darkModeHover flex items-center gap-2 dark:text-gray-200"
            onClick={(e) => {
              e.stopPropagation();
              handleCategoryClick(category);
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
  );
};

export default CategoryMenu;
