import React from 'react';
import { IoMdClose } from 'react-icons/io';
import { IoWarningOutline } from 'react-icons/io5';

// TypeScript interfaces for event handlers
type ButtonClickEvent = React.MouseEvent<HTMLButtonElement>;
type DivClickEvent = React.MouseEvent<HTMLDivElement>;

interface CancelSmartOrganizeProps {
  isOpen: boolean;
  onClose: () => void;
  resetUsage: () => void;
  setActiveMenu: (menu: string | null) => void;
  handleSmartOrganize: () => Promise<void>;
  closeModal: () => void;
}

const CancelSmartOrganize: React.FC<CancelSmartOrganizeProps> = ({
  isOpen,
  onClose,
  closeModal,
  setActiveMenu,
  handleSmartOrganize,
}) => {
  if (!isOpen) return null;

  const handleConfirm = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();

    setActiveMenu(null);
    onClose();

    await handleSmartOrganize();
  };
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e: DivClickEvent) => {
        // Close only when clicking overlay
        if (e.target === e.currentTarget) {
          e.stopPropagation();
          closeModal();
        }
      }}
    >
      <div
        className="bg-white dark:bg-[#3D3D3D] border border-darkModeCompliment dark:border-[#272727] shadow-lg rounded-lg 
        p-6 max-w-lg w-[430px] mx-2"
        onClick={(e: DivClickEvent) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="bg-lightOrange dark:bg-primaryDark text-primary rounded-md p-3">
              <IoWarningOutline size={20} />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-[18px] font-bold text-gray-900 dark:text-gray-100">
                Cancel Smart Organize
              </h3>
              <p className="text-[12px]">
                All changes and categorizations will be discarded
              </p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeModal();
            }}
            className="hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 mb-8"
          >
            <IoMdClose size={16} />
          </button>
        </div>

        {/* Message */}
        <p className="text-gray-700 dark:text-gray-300 mb-4 mx-1 mr-2 bg-[#F3F3F3] dark:bg-[#474747] p-3 rounded-lg">
          You have unsaved changes to your video organization. If you cancel
          now, all category assignments and modifications will be lost.{' '}
        </p>

        {/* Actions */}
        <div className="flex justify-end space-x-3 -mx-6 -mb-6 px-4 py-3 rounded-b-lg">
          <button
            onClick={(e: ButtonClickEvent) => {
              e.stopPropagation();
              closeModal();
            }}
            className="px-4 py-1 border border-lightBorder rounded-md hover:bg-gray-50 dark:border-[#474747] dark:hover:bg-[#474747] dark:text-gray-200"
          >
            Continue Editing
          </button>
          <button
            onClick={onClose}
            className="h-8 px-4 py-0.5 bg-primary hover:bg-primary/90 dark:bg-primary dark:hover:bg-primaryDarkHover text-white rounded-md cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default CancelSmartOrganize;
