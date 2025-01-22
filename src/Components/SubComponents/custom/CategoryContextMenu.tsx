import React from 'react';
import { MdEdit, MdDelete } from 'react-icons/md';

interface CategoryContextMenuProps {
  position: { x: number; y: number };
  categoryName: string;
  onClose: () => void;
  onRename: (oldName: string, newName: string) => void;
  onDelete: (category: string) => void;
}

const CategoryContextMenu: React.FC<CategoryContextMenuProps> = ({
  position,
  categoryName,
  onClose,
  onRename,
  onDelete,
}) => {
  const [isRenaming, setIsRenaming] = React.useState(false);
  const [newName, setNewName] = React.useState(categoryName);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isRenaming]);

  const handleRename = () => {
    if (newName.trim() && newName !== categoryName) {
      onRename(categoryName, newName.trim());
    }
    setIsRenaming(false);
    onClose();
  };

  return (
    <div
      className="fixed bg-white border rounded-md shadow-lg py-1 z-50"
      style={{ left: position.x, top: position.y }}
    >
      {isRenaming ? (
        <div className="px-4 py-2 flex items-center gap-2">
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
            className="border rounded px-2 py-1 text-sm"
            onBlur={handleRename}
          />
        </div>
      ) : (
        <>
          <button
            onClick={() => setIsRenaming(true)}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
          >
            <MdEdit className="text-gray-600" />
            <span>Rename</span>
          </button>
          <button
            onClick={() => {
              onDelete(categoryName);
              onClose();
            }}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-red-600"
          >
            <MdDelete />
            <span>Delete</span>
          </button>
        </>
      )}
    </div>
  );
};

export default CategoryContextMenu;
