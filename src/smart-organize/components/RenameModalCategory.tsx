import React, { useState } from 'react';
import { FaPenToSquare } from 'react-icons/fa6';
import { IoMdClose } from 'react-icons/io';

interface RenameModalCategoryMenuProps {
  isVisible: boolean;
  position: { x: number; y: number };
  categoryName: string;
  onRename: (oldName: string, newName: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

const RenameModalCategoryMenu: React.FC<RenameModalCategoryMenuProps> = ({
  isVisible,
  position,
  categoryName,
  onRename,
  onDelete,
  onClose,
}) => {
  const [showRenamePopup, setShowRenamePopup] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameCategoryName, setRenameCategoryName] = useState('');

  const handleRenameClick = () => {
    setRenameValue(categoryName);
    setRenameCategoryName(categoryName);
    setShowRenamePopup(true);
    onClose();
  };

  const handleRenameConfirm = () => {
    const trimmedValue = renameValue.trim();
    if (trimmedValue && trimmedValue !== renameCategoryName) {
      onRename(renameCategoryName, trimmedValue);
    }
    setShowRenamePopup(false);
    setRenameValue('');
    setRenameCategoryName('');
  };

  const handleRenameCancel = () => {
    setShowRenamePopup(false);
    setRenameValue('');
    setRenameCategoryName('');
  };

  if (!isVisible && !showRenamePopup) return null;

  return (
    <div className="fixed inset-0 z-[8999]" onClick={onClose}>
      {/* Show Rename Popup if active */}
      {showRenamePopup && (
        <div
          className="fixed inset-0 bg-black bg-opacity-20 dark:bg-opacity-50 flex items-center justify-center h-full z-[9002]"
          onClick={handleRenameCancel}
        >
          <div
            className="bg-white dark:bg-[#3D3D3D] border border-titleBarBorder dark:border-gray-700 rounded-lg max-w-md w-full mx-4 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="bg-primaryLight dark:bg-primaryDark text-primary rounded-md p-3">
                  <FaPenToSquare size={20} />
                </div>
                <div>
                  <h3 className="text-[18px] font-bold text-gray-900 dark:text-gray-100">
                    Rename Category
                  </h3>
                </div>
              </div>
              <button
                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                  e.stopPropagation();
                  handleRenameCancel();
                }}
                className="hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
              >
                <IoMdClose size={16} />
              </button>
            </div>

            <div className="mb-4">
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                placeholder="Enter new category name..."
                className="w-full px-3 py-2 rounded-md focus:outline-none bg-primaryInput dark:bg-[#474747]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameConfirm();
                  else if (e.key === 'Escape') handleRenameCancel();
                }}
              />
              <h1 className="text-xs italic ml-1 mt-2">
                Chosen name will be applied to selected category
              </h1>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={handleRenameCancel}
                className="px-4 py-2 text-xs border border-gray-300
                 dark:border-secondarkDarkHover dark:hover:bg-secondarkDarkHover
                  rounded-md hover:bg-gray-50 dark:text-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameConfirm}
                disabled={
                  !renameValue.trim() ||
                  renameValue.trim() === renameCategoryName
                }
                className="px-4 py-2 text-xs bg-primary text-white rounded-md hover:bg-primary dark:bg-primary dark:hover:bg-primaryDarkHover disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Rename Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Show Context Menu only if rename popup is not visible */}
      {!showRenamePopup && isVisible && (
        <div
          className="fixed bg-offWhite dark:bg-darkModeCompliment rounded-lg drop-shadow-lg shadow-md z-[9000] py-1 px-2 w-28 text-xs font-medium"
          style={{
            left: position.x,
            top: position.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-secondarkDarkHover dark:text-gray-200 rounded transition-colors"
            onClick={handleRenameClick}
          >
            Rename
          </button>
          <button
            className="font-medium rounded w-full text-left px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            onClick={() => {
              onDelete();
              onClose();
            }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default RenameModalCategoryMenu;
