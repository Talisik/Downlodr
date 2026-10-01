/**
 * A custom React component
 * A React component that displays a context menu for managing tags.
 * It provides options to rename and delete tags.
 *
 * @param TagContextMenuProps
 *   @param position - An object containing the x and y coordinates for positioning the menu.
 *   @param tagName - The name of the tag being acted upon.
 *   @param onClose - A function to call when the menu should be closed.
 *   @param onRequestRename - Asks the owner to open the rename modal for this tag.
 *   @param onDelete - Asks the owner to delete this tag.
 *
 * @returns JSX.Element - The rendered context menu component.
 */

import React from 'react';
import { MdDelete, MdEdit } from 'react-icons/md';

import BaseContextMenu from './BaseContextMenu';

interface TagContextMenuProps {
  position: { x: number; y: number }; // Position of the context menu
  tagName: string; // Name of the tag
  onClose: () => void; // Function to close the menu
  onRequestRename: (tagName: string) => void; // Ask the owner to open the rename modal
  onDelete: (tag: string) => void; // Ask the owner to delete the tag
}

const MENU_ITEM_CLASS =
  'text-xs w-full text-left px-1.5 py-2 hover:bg-gray-100 dark:hover:bg-darkModeHover flex items-center gap-2 dark:text-gray-200';

const TagContextMenu: React.FC<TagContextMenuProps> = ({
  position,
  tagName,
  onClose,
  onRequestRename,
  onDelete,
}) => {
  // The rename modal is deliberately NOT rendered here, for the same reason as
  // CategoryContextMenu: the owner unmounts this menu on any click outside it,
  // which would take a child modal down before Save could be pressed.
  return (
    <BaseContextMenu
      position={position}
      onClose={onClose}
      dataAttribute="data-tag-context-menu"
    >
      <button
        onClick={() => {
          onRequestRename(tagName);
          onClose();
        }}
        className={MENU_ITEM_CLASS}
      >
        <MdEdit className="text-gray-600 dark:text-gray-400" />
        <span>Rename</span>
      </button>
      <button
        onClick={() => {
          onDelete(tagName);
          onClose();
        }}
        className={`${MENU_ITEM_CLASS} text-red-600 dark:text-red-400`}
      >
        <MdDelete />
        <span>Delete</span>
      </button>
    </BaseContextMenu>
  );
};

export default TagContextMenu;
