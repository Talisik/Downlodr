import { useEffect, useState } from 'react';
import { IoMdClose } from 'react-icons/io';

// TypeScript interfaces for event handlers
type ButtonClickEvent = React.MouseEvent<HTMLButtonElement>;
type DivClickEvent = React.MouseEvent<HTMLDivElement>;
type LabelClickEvent = React.MouseEvent<HTMLLabelElement>;
type InputClickEvent = React.MouseEvent<HTMLInputElement>;
type CheckboxChangeEvent = React.ChangeEvent<HTMLInputElement>;

interface RenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  categoryToRename: string;
  groups: Record<string, any>;
}

const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  categoryToRename,
  groups,
  //message,
}) => {
  const [deleteFolder, setRenameFolder] = useState(false);

  // Reset checkbox when modal opens
  useEffect(() => {
    if (isOpen) {
      setRenameFolder(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e: DivClickEvent) => {
        // Only close if clicking the overlay background
        if (e.target === e.currentTarget) {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        className="bg-white dark:bg-[#3D3D3D] rounded-lg border border-darkModeCompliment p-6 max-w-lg w-full mx-2"
        onClick={(e: DivClickEvent) => e.stopPropagation()} // Prevent clicks inside modal from closing it
      >
        {/* Header with title and close button */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[15px] font-medium text-gray-900 dark:text-gray-100">
            Rename Category
          </h3>
          <button
            onClick={(e: ButtonClickEvent) => {
              e.stopPropagation();
              onClose();
            }}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <IoMdClose size={20} />
          </button>
        </div>

        {/* Main message */}
        <p className="text-gray-700 dark:text-gray-300 mb-4">
          Are you sure you want to rename the category "{categoryToRename}"?
        </p>

        {/* Action buttons */}
        <div className="flex justify-end space-x-3 bg-[#FEF9F4] dark:bg-darkMode -mx-6 -mb-6 px-4 py-3 rounded-b-lg border-t border-[#D9D9D9] dark:border-darkModeCompliment">
          <button
            onClick={(e: ButtonClickEvent) => {
              e.stopPropagation();
              onClose();
            }}
            className="px-4 py-1 border rounded-md hover:bg-gray-50 dark:border-secondarkDarkHover dark:hover:bg-secondarkDarkHover dark:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={(e: ButtonClickEvent) => {
              e.stopPropagation();
              onConfirm();
            }}
            className="h-8 px-3 py-0.5 bg-primary dark:bg-primary dark:text-darkModeLight  dark:hover:bg-primaryDarkHover text-white rounded-md hover:bg-primary/90 cursor-pointer"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
};

export default RenameModal;
