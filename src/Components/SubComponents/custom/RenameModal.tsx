import { useEffect, useState } from 'react';
import { toast } from '../shadcn/hooks/use-toast';

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

  // Reset the input when modal opens or currentName changes
  useEffect(() => {
    if (isOpen) {
      setNewName(currentName);
    }
  }, [isOpen, currentName]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim() && newName.trim().length <= 50) {
      onRename(newName.trim());
      toast({
        variant: 'success',
        title: 'File Renamed',
        description: `Successfully renamed to ${newName}`,
        duration: 3000,
      });
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="bg-white dark:bg-darkModeDropdown rounded-lg p-6 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-medium mb-4 dark:text-gray-200">
          Rename Download
        </h3>
        <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={50}
            className="w-full p-2 border rounded mb-1 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {newName.length}/50 characters
          </div>
          <hr className="solid mb-2 -mx-6 w-[calc(100%+48px)] border-t-2 border-divider dark:border-gray-700" />

          <div className="flex justify-start space-x-2 mb-[-10px]">
            <button
              type="submit"
              onClick={(e) => e.stopPropagation()}
              className="px-4 py-1 bg-primary text-white rounded disabled:opacity-50"
              disabled={!newName.trim() || newName.trim().length > 50}
            >
              Save
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="px-4 py-1 border rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-darkModeHover dark:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RenameModal;
