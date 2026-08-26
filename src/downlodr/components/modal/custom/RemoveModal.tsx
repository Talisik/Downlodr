import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import BaseModal from '../BaseModal';

interface RemoveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deleteFolder?: boolean) => void;
  allowFolderDeletion?: boolean;
}

const RemoveModal: React.FC<RemoveModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  allowFolderDeletion = false,
}) => {
  const { t } = useTranslation('downlodr');
  const { t: tc } = useTranslation('common');
  // Checked by default — the user must opt out to keep the folder
  const [deleteFolder, setDeleteFolder] = useState(allowFolderDeletion);

  useEffect(() => {
    if (isOpen) setDeleteFolder(allowFolderDeletion);
  }, [isOpen, allowFolderDeletion]);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('removeModal.title')}
      footer={
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-1 border rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-darkModeHover"
          >
            {tc('buttons.cancel')}
          </button>

          <button
            onClick={() => onConfirm(deleteFolder)}
            className="h-8 px-3 bg-primary text-white rounded-md hover:bg-primary/90 dark:hover:bg-primary/80"
          >
            {tc('buttons.remove')}
          </button>
        </div>
      }
    >
      <p className="text-gray-700 dark:text-gray-300 mb-4">
        {t('removeModal.message')}
      </p>

      {allowFolderDeletion && (
        <label className="flex items-center space-x-2 text-xs text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            checked={deleteFolder}
            onChange={(e) => setDeleteFolder(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700"
          />
          <span>{t('removeModal.alsoDeleteFolder')}</span>
        </label>
      )}
    </BaseModal>
  );
};

export default RemoveModal;
