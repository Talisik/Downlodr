import BaseModal from '../BaseModal';

interface StopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const StopModal: React.FC<StopModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Stop Download"
      width="max-w-lg"
      footer={
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-1 text-gray-600 bg-white dark:bg-[#18181B] dark:text-white border dark:border-[#27272A] hover:bg-gray-50 dark:hover:bg-darkModeHover rounded-md font-medium"
          >
            Cancel
          </button>

          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="px-4 py-1 bg-[#F45513] text-white rounded-md hover:bg-black hover:text-white font-medium"
          >
            Stop
          </button>
        </div>
      }
    >
      <p className="text-gray-700 dark:text-gray-300 text-sm">
        Are you sure you want to stop and remove this download?
      </p>
    </BaseModal>
  );
};

export default StopModal;
