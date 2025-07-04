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

import React, { useState } from 'react';
import { MdDelete, MdEdit } from 'react-icons/md';

// Interface representing the props for the CategoryContextMenu component
interface CategoryContextMenuProps {
  position: { x: number; y: number }; // Position of the context menu
  categoryName: string; // Name of the category
  onClose: () => void; // Function to close the menu
  onRename: (oldName: string, newName: string) => void; // Function to rename the category
  onDelete: (category: string) => void; // Function to delete the category
}

interface RenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRename: (newName: string) => void;
  currentName: string;
}

const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  onClose,
  onRename,
  currentName,
}) => {
  const [newName, setNewName] = useState(currentName);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim() && newName.trim().length <= 10) {
      onRename(newName.trim());
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="bg-white dark:bg-darkModeDropdown rounded-lg p-6 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-medium mb-4 dark:text-gray-200">
          Rename Category
        </h3>
        <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={10}
            className="w-full p-2 border rounded mb-4 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {newName.length}/10 characters
          </div>
          <hr className="solid mb-2 -mx-6 w-[calc(100%+48px)] border-t-2 border-divider dark:border-gray-700" />

          <div className="flex justify-start space-x-2 mb-[-10px]">
            <button
              type="submit"
              onClick={(e) => e.stopPropagation()}
              className="px-4 py-1 bg-primary text-white rounded disabled:opacity-50"
              disabled={!newName.trim() || newName.trim().length > 10}
            >
              Save
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="px-4 py-1 border rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-darkModeHover dark:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Displays a context menu for category actions such as renaming and deleting.
export default function CategoryContextMenu({
  position,
  onClose,
  onRename,
  onDelete,
  categoryName,
}: CategoryContextMenuProps) {
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);

  const handleRename = (newName: string) => {
    onRename(categoryName, newName);
    setIsRenameModalOpen(false);
    onClose();
  };

  return (
    <>
      <div
        className="fixed bg-white dark:bg-darkMode border rounded-md shadow-lg py-1 z-50 dark:border-gray-700"
        style={{ left: `${position.x}px`, top: `${position.y}px` }}
        onClick={(e) => e.stopPropagation()}
        data-category-context-menu
      >
        <button
          onClick={() => {
            setIsRenameModalOpen(true);
          }}
          className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-darkModeHover flex items-center gap-2 dark:text-gray-200"
        >
          <MdEdit className="text-gray-600 dark:text-gray-400" />
          <span>Rename</span>
        </button>
        <button
          onClick={() => {
            onDelete(categoryName);
            onClose();
          }}
          className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-darkModeHover flex items-center gap-2 text-red-600 dark:text-red-400"
        >
          <MdDelete />
          <span>Delete</span>
        </button>
      </div>

      <RenameModal
        isOpen={isRenameModalOpen}
        onClose={() => setIsRenameModalOpen(false)}
        onRename={handleRename}
        currentName={categoryName}
      />
    </>
  );
}
