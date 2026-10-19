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
 *   @param onRequestRename - Asks the owner to open the rename modal for this category.
 *   @param onDelete - Asks the owner to confirm and delete this category.
 *   @param onShare - Optional. Takes the category name to share it and the videos inside it.
 *
 * @returns JSX.Element - The rendered context menu component.
 */

import { MdDelete, MdEdit, MdShare } from 'react-icons/md';

import BaseContextMenu from './BaseContextMenu';

// Interface representing the props for the CategoryContextMenu component
interface CategoryContextMenuProps {
  position: { x: number; y: number }; // Position of the context menu
  categoryName: string; // Name of the category
  onClose: () => void; // Function to close the menu
  onRequestRename: (categoryName: string) => void; // Ask the owner to open the rename modal
  onDelete: (category: string) => void; // Ask the owner to confirm the delete
  onShare?: (category: string) => void; // Function to share the category and its videos
}

const MENU_ITEM_CLASS =
  'text-xs w-full text-left px-1.5 py-2 hover:bg-gray-100 dark:hover:bg-darkModeHover flex items-center gap-2 dark:text-gray-200';

// Displays a context menu for category actions such as renaming and deleting.
export default function CategoryContextMenu({
  position,
  onClose,
  onRequestRename,
  onDelete,
  onShare,
  categoryName,
}: CategoryContextMenuProps) {
  // The rename modal is deliberately NOT rendered here. This menu is unmounted
  // by its owner the moment anything outside it is clicked, which would take a
  // child modal down with it before Save could ever be pressed. Rename is a
  // request to the owner, which renders the modal as a sibling — the same shape
  // DownloadContextMenu uses for its (working) rename.
  return (
    <BaseContextMenu
      position={position}
      onClose={onClose}
      dataAttribute="data-category-context-menu"
    >
      <button
        onClick={() => {
          onRequestRename(categoryName);
          onClose();
        }}
        className={MENU_ITEM_CLASS}
      >
        <MdEdit className="text-gray-600 dark:text-gray-400" />
        <span>Rename</span>
      </button>
      <button
        onClick={() => {
          onDelete(categoryName);
          onClose();
        }}
        className={`${MENU_ITEM_CLASS} text-red-600 dark:text-red-400`}
      >
        <MdDelete />
        <span>Delete</span>
      </button>
    </BaseContextMenu>
  );
}
