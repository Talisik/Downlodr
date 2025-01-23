import React from 'react';
import { MdEdit, MdDelete } from 'react-icons/md';

interface TagContextMenuProps {
  position: { x: number; y: number };
  tagName: string;
  onClose: () => void;
  onRename: (oldName: string, newName: string) => void;
  onDelete: (tag: string) => void;
}

const TagContextMenu: React.FC<TagContextMenuProps> = ({
  position,
  tagName,
  onClose,
  onRename,
  onDelete,
}) => {
  const [isRenaming, setIsRenaming] = React.useState(false);
  const [newName, setNewName] = React.useState(tagName);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isRenaming]);

  const handleRename = () => {
    if (newName.trim() && newName !== tagName) {
      onRename(tagName, newName.trim());
    }
    setIsRenaming(false);
    onClose();
  };

  return (
    <div
      className="fixed bg-white dark:bg-darkMode border rounded-md shadow-lg py-1 z-50 dark:border-gray-700"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      {isRenaming ? (
        <div className="px-4 py-2 flex items-center gap-2 w-full">
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') {
                setIsRenaming(false);
                onClose();
              }
            }}
            className="border rounded px-2 py-1 text-sm w-full min-w-[150px] dark:bg-inputDarkMode dark:text-gray-200 outline-none dark:border-transparent"
            onBlur={handleRename}
            autoFocus
          />
        </div>
      ) : (
        <>
          <button
            onClick={() => {
              console.log('Rename button clicked');
              setIsRenaming(true);
            }}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 dark:text-gray-200"
          >
            <MdEdit className="text-gray-600 dark:text-gray-400" />
            <span>Rename</span>
          </button>
          <button
            onClick={() => {
              onDelete(tagName);
              onClose();
            }}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 text-red-600 dark:text-red-400"
          >
            <MdDelete />
            <span>Delete</span>
          </button>
        </>
      )}
    </div>
  );
};

export default TagContextMenu;
