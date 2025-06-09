/**
 * A custom React component
 * A React component that displays a context menu for managing tags.
 * It provides options to rename and delete tags.
 *
 * @param TagContextMenuProps
 *   @param position - An object containing the x and y coordinates for positioning the menu.
 *   @param tagName - The name of the tag being acted upon.
 *   @param onClose - A function to call when the menu should be closed.
 *   @param onRename - A function that takes the old and new tag names to handle renaming.
 *   @param onDelete - A function that takes the tag name to handle deletion.
 *
 * @returns JSX.Element - The rendered context menu component.
 */

import React, { useEffect, useState } from 'react';
import { MdDelete, MdEdit } from 'react-icons/md';

interface TagContextMenuProps {
  position: { x: number; y: number }; // Position of the context menu
  tagName: string; // Name of the tag
  onClose: () => void; // Function to close the menu
  onRename: (oldName: string, newName: string) => void; // Function to rename the tag
  onDelete: (tag: string) => void; // Function to delete the tag
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
        className="bg-white dark:bg-darkMode rounded-lg p-6 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-medium mb-4 dark:text-gray-200">
          Rename Tag
        </h3>
        <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
          <label className="font-medium dark:text-gray-200">New name</label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={10}
            className="w-full p-2 border rounded mb-1 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
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

const TagContextMenu: React.FC<TagContextMenuProps> = ({
  position,
  tagName,
  onClose,
  onRename,
  onDelete,
}) => {
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Adjusts context menu location based on element
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = position.x;
    let adjustedY = position.y;

    // Adjust horizontal position if menu would overflow
    if (position.x + rect.width > viewportWidth) {
      adjustedX = viewportWidth - rect.width - 10;
    }

    // Adjust vertical position if menu would overflow
    if (position.y + rect.height > viewportHeight) {
      adjustedY = viewportHeight - rect.height - 10;
    }

    // Ensure menu doesn't go beyond left or top edges
    adjustedX = Math.max(10, adjustedX);
    adjustedY = Math.max(10, adjustedY);

    setAdjustedPosition({ x: adjustedX, y: adjustedY });
  }, [position]);

  const handleRename = (newName: string) => {
    onRename(tagName, newName);
    setIsRenameModalOpen(false);
    onClose();
  };

  return (
    <>
      <div
        ref={menuRef}
        className="fixed bg-white dark:bg-darkMode border rounded-md shadow-lg py-1 z-50 dark:border-gray-700"
        style={{
          left: `${adjustedPosition.x}px`,
          top: `${adjustedPosition.y}px`,
        }}
        onClick={(e) => e.stopPropagation()}
        data-tag-context-menu
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
            onDelete(tagName);
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
        currentName={tagName}
      />
    </>
  );
};

export default TagContextMenu;
