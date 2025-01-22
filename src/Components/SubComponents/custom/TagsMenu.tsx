import React, { useState } from 'react';
import { GoPlus } from 'react-icons/go';

interface TagMenuProps {
  downloadId: string;
  onAddTag: (downloadId: string, tag: string) => void;
  onRemoveTag: (downloadId: string, tag: string) => void;
  currentTags: string[];
  availableTags: string[];
  menuPositionClass: string;
}

const TagMenu: React.FC<TagMenuProps> = ({
  downloadId,
  onAddTag,
  onRemoveTag,
  currentTags,
  availableTags,
  menuPositionClass,
}) => {
  const [newTag, setNewTag] = useState('');
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      if (menuRect.right > viewportWidth) {
        menuRef.current.style.left = 'auto';
        menuRef.current.style.right = '100%';
        menuRef.current.style.marginLeft = '-1px';
      }

      if (menuRect.bottom > viewportHeight) {
        menuRef.current.style.top = 'auto';
        menuRef.current.style.bottom = '0';
      }
    }
  }, []);

  return (
    <div
      ref={menuRef}
      className={`absolute bg-white border rounded-md shadow-lg py-1 min-w-[180px] z-50 ${menuPositionClass}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="m-2 px-4 py-2 flex flex-row border rounded">
        <GoPlus size={22} className="ml-[-10px] mr-2" />
        <input
          type="text"
          placeholder="Add New Tag..."
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newTag.trim()) {
              onAddTag(downloadId, newTag.trim());
              setNewTag('');
            }
          }}
          className="w-full outline-none"
        />
      </div>
      <hr className="solid mt-2 mb-1 mx-2 w-[calc(100%-20px)] border-t-2 border-divider" />

      <div className="max-h-48 overflow-y-auto">
        {availableTags.map((tag) => (
          <button
            key={tag}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
            onClick={(e) => {
              e.stopPropagation();
              if (currentTags.includes(tag)) {
                onRemoveTag(downloadId, tag);
              } else {
                onAddTag(downloadId, tag);
              }
            }}
          >
            <span>{currentTags.includes(tag) ? '✓' : ''}</span>
            <span>{tag}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TagMenu;
