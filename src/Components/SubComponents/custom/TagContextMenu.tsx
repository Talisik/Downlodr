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

import React, { useEffect } from 'react';
import { MdEdit, MdDelete } from 'react-icons/md';

interface TagContextMenuProps {
  position: { x: number; y: number }; // Position of the context menu
  tagName: string; // Name of the tag
  onClose: () => void; // Function to close the menu
  onRename: (oldName: string, newName: string) => void; // Function to rename the tag
  onDelete: (tag: string) => void; // Function to delete the tag
}

const TagContextMenu: React.FC<TagContextMenuProps> = ({
  position,
  tagName,
  onClose,
  onRename,
  onDelete,
}) => {
  const [isRenaming, setIsRenaming] = React.useState(false);
  const [newName, setNewName] = React.useState(tagName);
  const [adjustedPosition, setAdjustedPosition] = React.useState(position);
  const inputRef = React.useRef<HTMLInputElement>(null);
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

  // handles renaming tag
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isRenaming]);

  const handleRename = () => {
    if (newName.trim() && newName !== tagName) {
      onRename(tagName, newName.trim());
    }
    setIsRenaming(false);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="fixed bg-white dark:bg-darkMode border rounded-md shadow-lg py-1 z-50 dark:border-gray-700"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }}
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
              onDelete(tagName);
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

export default TagContextMenu;
