import { useEffect, useState } from 'react';
import { IoMdClose } from 'react-icons/io';

interface RemoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deleteFolder?: boolean) => void;
  message: string;
  allowFolderDeletion?: boolean;
}

const RemoveModal: React.FC<RemoveModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  //message,
  allowFolderDeletion = false,
}) => {
  const [deleteFolder, setDeleteFolder] = useState(false);

  // Reset checkbox when modal opens
  useEffect(() => {
    if (isOpen) {
      setDeleteFolder(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-darkModeDropdown rounded-lg border border-darkModeCompliment p-6 max-w-lg w-full mx-2"
        onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it
      >
        {/* Header with title and close button */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Remove selected item
          </h3>
          <button
            onClick={(e) => {
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
          Are you sure you want to remove these downloads from the download
          list?
        </p>

        {allowFolderDeletion && (
          <div className="mb-6">
            <label
              className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300"
              onClick={(e) => e.stopPropagation()} // Prevent label click from closing modal
            >
              <input
                type="checkbox"
                checked={deleteFolder}
                onChange={(e) => {
                  e.stopPropagation(); // Prevent checkbox change from closing modal
                  setDeleteFolder(e.target.checked);
                }}
                onClick={(e) => e.stopPropagation()} // Prevent checkbox click from closing modal
                className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
              />
              <span>Also remove the downloaded folder</span>
            </label>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-end space-x-3 bg-[#FEF9F4] dark:bg-darkMode -mx-6 -mb-6 px-4 py-3 rounded-b-lg border-t border-[#D9D9D9] dark:border-darkModeCompliment">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="px-4 py-1 text-gray-600 bg-white dark:bg-[#18181B] dark:text-white border dark:border-[#27272A] hover:bg-gray-50 dark:hover:bg-darkModeHover dark:hover:text-gray-200 rounded-md font-medium"
          >
            Cancel
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onConfirm(deleteFolder);
            }}
            className="px-4 py-1 bg-[#F45513] text-white rounded-md hover:bg-white hover:text-black font-medium"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
};

export default RemoveModal;
