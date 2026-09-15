import { useEffect, useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import { IoMdClose } from 'react-icons/io';

type ButtonClickEvent = React.MouseEvent<HTMLButtonElement>;
type DivClickEvent = React.MouseEvent<HTMLDivElement>;

interface NewCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
  initialValue?: string;
}

const NewCategoryModal: React.FC<NewCategoryModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialValue = '',
}) => {
  const [categoryName, setCategoryName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setCategoryName(initialValue);
    }
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!categoryName.trim()) return;
    onConfirm(categoryName.trim());
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e: DivClickEvent) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white dark:bg-[#3D3D3D] rounded-lg border border-darkModeCompliment p-6 max-w-md w-full mx-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="bg-primaryLight dark:bg-primaryDark text-primary rounded-md p-3">
              <FiPlus size={20} />
            </div>
            <div>
              <h3 className="text-[18px] font-bold text-gray-900 dark:text-gray-100">
                Add to New Category
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <IoMdClose size={16} />
          </button>
        </div>

        {/* Input */}
        <div className="mb-4">
          <input
            type="text"
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            placeholder="Enter category name..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') onClose();
            }}
            className="w-full px-3 py-2 rounded-md
                       focus:outline-none bg-primaryInput dark:bg-[#474747]"
          />
          <h1 className="text-xs italic ml-1 mt-2">
            Selected videos will be added to newly created category
          </h1>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 -mx-6 -mb-6 px-4 py-3 ">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-md hover:bg-gray-50 flex justify-center items-center
            dark:border-secondarkDarkHover dark:hover:bg-secondarkDarkHover dark:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!categoryName.trim()}
            className="px-3 py-2 bg-primary text-white rounded-md flex justify-center items-center
                       hover:bg-primary/90 dark:bg-primary dark:hover:bg-primaryDarkHover disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Add to New
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewCategoryModal;
