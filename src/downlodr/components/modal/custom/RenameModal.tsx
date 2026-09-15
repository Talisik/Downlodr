import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { useEffect, useRef, useState } from 'react';
import BaseModal from '../BaseModal';

interface RenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRename: (newName: string) => void;
  currentName: string;
}

const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  onClose,
  onRename,
  currentName,
}) => {
  const [newName, setNewName] = useState(currentName);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset + focus when opened
  useEffect(() => {
    if (isOpen) {
      setNewName(currentName);

      // focus after render
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen, currentName]);

  const trimmedName = newName.trim();
  const isValid = trimmedName.length > 0 && trimmedName.length <= 30;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    onRename(trimmedName);

    toast({
      variant: 'success',
      title: 'File Renamed',
      description: `Successfully renamed to ${trimmedName}`,
      duration: 5000,
    });

    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Rename Download"
      width="max-w-sm"
      footer={
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1 border rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-darkModeHover dark:text-gray-200"
          >
            Cancel
          </button>

          <button
            type="submit"
            form="rename-form"
            disabled={!isValid}
            className="px-5 py-1 bg-primary text-white rounded disabled:opacity-50 hover:opacity-90 dark:hover:opacity-75"
          >
            Save
          </button>
        </div>
      }
    >
      <form id="rename-form" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={30}
          className="w-full p-2 border rounded mb-1 dark:bg-darkMode dark:border-inputDarkModeBorder outline-none dark:text-gray-200"
        />

        <div className="text-xs text-gray-500 dark:text-gray-400">
          {newName.length}/30 characters
        </div>
      </form>
    </BaseModal>
  );
};

export default RenameModal;
