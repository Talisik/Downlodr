import { FiTrash } from 'react-icons/fi';
import { IoClose } from 'react-icons/io5';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string;
  title?: string;
  confirmLabel?: string;
}

const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  message,
  title,
  confirmLabel = 'Remove',
}: ConfirmModalProps) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => {
        // Only close if clicking the overlay background
        if (e.target === e.currentTarget) {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="bg-white dark:bg-darkModeDropdown rounded-lg border border-darkModeCompliment max-w-md w-full mx-2 overflow-hidden">
        {title && (
          <div className="flex justify-between px-4 pt-4 pb-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[#FFEEE7] flex justify-center items-center rounded">
                <FiTrash className="inline-block text-orange-500" size={18} />
              </div>
              <h2 className="text-[14px] font-semibold text-gray-800 dark:text-gray-100">
                {title}
              </h2>
            </div>
            <button onClick={onClose}>
              <IoClose size={18} />
            </button>
          </div>
        )}
        <p className="rounded text-gray-800 dark:text-gray-200 mx-4 mt-2 mb-4 px-4 py-2 text-md font-medium bg-[#F3F3F3] dark:bg-darkMode">
          {message}
        </p>
        <div className="flex justify-end space-x-3 px-4 pb-4">
          <button
            onClick={onClose}
            className="px-4 py-1 border rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-darkModeHover dark:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="h-8 px-3 py-0.5 bg-primary dark:bg-primary dark:text-darkModeLight  dark:hover:bg-primary/90 text-white rounded-md hover:bg-primary/90 cursor-pointer"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
