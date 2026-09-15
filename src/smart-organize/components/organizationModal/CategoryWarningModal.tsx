import { CiWarning } from 'react-icons/ci';
import { IoMdClose } from 'react-icons/io';

interface CategoryWarningModalProps {
  data: {
    affectedCategories: string[];
    movedToUncategorized: string[];
  };
  onNext: () => void;
  onCancel: () => void;
}

export const CategoryWarningModal: React.FC<CategoryWarningModalProps> = ({
  data,
  onNext,
  onCancel,
}) => {
  const { affectedCategories, movedToUncategorized } = data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-[#3D3D3D] rounded-lg border border-darkModeCompliment p-6 max-w-md w-full mx-2">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="bg-primaryLight dark:bg-primaryDark text-primary rounded-md p-3">
              <CiWarning size={20} />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-[18px] font-bold text-gray-900 dark:text-gray-100">
                Category Warning
              </h3>
              <p className="text-[13px]">
                Videos in certain categories will be affected
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <IoMdClose size={16} />
          </button>
        </div>
        <div className="space-y-4 max-h-[300px] overflow-y-auto text-sm ml-3">
          {affectedCategories.length > 0 && (
            <div>
              <p className="font-medium mb-6 text-[13px]">
                This action will overwrite the existing organization, including
                all manual changes made to your library.{' '}
              </p>
              <p className="font-medium text-[13px]">
                Are you sure you want to continue?
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-6 gap-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 border rounded-md hover:bg-gray-50 flex justify-center items-center
            dark:border-secondarkDarkHover dark:hover:bg-secondarkDarkHover dark:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={onNext}
            className="px-4 py-2 rounded-lg bg-primary dark:bg-primary dark:hover:bg-primaryDarkHover text-white hover:bg-black transition"
          >
            Continue Smart Organize
          </button>
        </div>
      </div>
    </div>
  );
};
