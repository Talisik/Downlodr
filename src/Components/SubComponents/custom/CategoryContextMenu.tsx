/**
 * A custom React component
 * A React component that displays a context menu for category actions such as renaming
 * and deleting a category. It provides an interface for users to interact with category
 * items in a user-friendly manner.
 *
 * @param CategoryContextMenuProps
 *   @param position - An object containing the x and y coordinates for positioning the menu.
 *   @param categoryName - The name of the category being acted upon.
 *   @param onClose - A function to call when the menu should be closed.
 *   @param onRename - A function that takes the old and new category names to handle renaming.
 *   @param onDelete - A function that takes the category name to handle deletion.
 *
 * @returns JSX.Element - The rendered context menu component.
 */

import React from 'react';
import { MdEdit, MdDelete } from 'react-icons/md';

// Interface representing the props for the CategoryContextMenu component
interface CategoryContextMenuProps {
  position: { x: number; y: number }; // Position of the context menu
  categoryName: string; // Name of the category
  onClose: () => void; // Function to close the menu
  onRename: (oldName: string, newName: string) => void; // Function to rename the category
  onDelete: (category: string) => void; // Function to delete the category
}

// Displays a context menu for category actions such as renaming and deleting.
const CategoryContextMenu: React.FC<CategoryContextMenuProps> = ({
  position,
  categoryName,
  onClose,
  onRename,
  onDelete,
}) => {
  const [isRenaming, setIsRenaming] = React.useState(false);
  const [newName, setNewName] = React.useState(categoryName);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Effect to focus the input when renaming starts
  React.useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isRenaming]);

  /**
   * Handles the renaming of the category.
   * If the new name is valid, it calls the onRename function and closes the menu.
   */
  const handleRename = () => {
    if (newName.trim() && newName !== categoryName) {
      onRename(categoryName, newName.trim());
    }
    setIsRenaming(false);
    onClose();
  };

  return (
    <div
      className="fixed bg-white dark:bg-darkMode border rounded-md shadow-lg py-1 z-50 dark:border-gray-700"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      {isRenaming ? (
        <div className="px-4 py-2 flex items-center gap-2 w-full">
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') {
                setIsRenaming(false);
                onClose();
              }
            }}
            className="border rounded px-2 py-1 text-sm w-full min-w-[150px] dark:bg-inputDarkMode dark:text-gray-200 outline-none dark:border-transparent"
            onBlur={handleRename}
            autoFocus
          />
        </div>
      ) : (
        <>
          <button
            onClick={() => {
              setIsRenaming(true);
            }}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 dark:text-gray-200"
          >
            <MdEdit className="text-gray-600 dark:text-gray-400" />
            <span>Rename</span>
          </button>
          <button
            onClick={() => {
              onDelete(categoryName);
              onClose();
            }}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400"
          >
            <MdDelete />
            <span>Delete</span>
          </button>
        </>
      )}
    </div>
  );
};

export default CategoryContextMenu;
