import React from 'react';
import BaseModal from '../BaseModal';

interface BulkTranscriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  count: number;
}

const BulkTranscriptModal: React.FC<BulkTranscriptModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  count,
}) => {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Generate Transcriptions"
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
            Generate
          </button>
        </div>
      }
    >
      <p className="text-gray-700 dark:text-gray-300 text-sm py-3">
        This will generate transcriptions for{' '}
        <span className="font-semibold">{count}</span>{' '}
        {count === 1 ? 'download' : 'downloads'}. This process may take a while
        depending on the file size. Do you want to proceed?
      </p>
    </BaseModal>
  );
};

export default BulkTranscriptModal;
