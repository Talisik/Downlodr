import React from 'react';
import { IoMdClose } from 'react-icons/io';
import { LuTrash } from 'react-icons/lu';

// TypeScript interfaces for event handlers
type ButtonClickEvent = React.MouseEvent<HTMLButtonElement>;
type DivClickEvent = React.MouseEvent<HTMLDivElement>;

interface VideoWithGroup {
  video_id: string;
  video_title: string;
  groupName: string;
  // ... other video properties
}

interface RemoveVideoProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  videoToDelete: VideoWithGroup | null;
}

const RemoveVideo: React.FC<RemoveVideoProps> = ({
  isOpen,
  onClose,
  onConfirm,
  videoToDelete,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e: DivClickEvent) => {
        // Only close if clicking the overlay background
        if (e.target === e.currentTarget) {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        className="bg-white dark:bg-[#3D3D3D] rounded-lg border border-darkModeCompliment p-6 max-w-lg w-full mx-2"
        onClick={(e: DivClickEvent) => e.stopPropagation()} // Prevent clicks inside modal from closing it
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="bg-primaryLight dark:bg-primaryDark text-primary rounded-md p-3">
              <LuTrash size={20} />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-[18px] font-bold text-gray-900 dark:text-gray-100">
                Remove Video
              </h3>
              <p>"{videoToDelete?.video_title}"</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <IoMdClose size={16} />
          </button>
        </div>

        {/* Main message */}
        <p className="text-gray-700 dark:text-gray-300 mb-4">
          Are you sure you want to remove "{videoToDelete?.video_title}" from
          the <span className="font-bold">{videoToDelete?.groupName}</span>{' '}
          category? This will cause the video to be reclassified as{' '}
          <span className="font-bold">Uncategorized</span>.
        </p>

        {/* Action buttons */}
        <div className="flex justify-end space-x-3 -mx-6 -mb-6 px-4 py-3">
          <button
            onClick={(e: ButtonClickEvent) => {
              e.stopPropagation();
              onClose();
            }}
            className="px-4 py-2 border rounded-md hover:bg-gray-50 flex justify-center items-center
            dark:border-secondarkDarkHover dark:hover:bg-secondarkDarkHover dark:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={(e: ButtonClickEvent) => {
              e.stopPropagation();
              onConfirm();
            }}
            className="px-3 py-2 bg-primary text-white rounded-md flex justify-center items-center
            hover:bg-primary/90 dark:bg-primary dark:hover:bg-primaryDarkHover disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
};

export default RemoveVideo;
