import React, { useEffect, useRef, useState } from 'react';
import { IoMdClose } from 'react-icons/io';
import { LiaArrowsAltSolid } from 'react-icons/lia';
import { MdOutlineFolder } from 'react-icons/md';

interface MoveVideosModalProps {
  show: boolean;
  availableCategories: { name: string; count: number }[];
  onConfirmMove: (category: string) => void;
  activeTab: string;
  onClose: () => void;
  checkedVideoCount: number;
}

const MoveVideosModal: React.FC<MoveVideosModalProps> = ({
  show,
  availableCategories,
  activeTab,
  onConfirmMove,
  onClose,
  checkedVideoCount,
}) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        onClose();
      }
    }
    if (show) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [show, onClose]);

  if (!show) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        ref={modalRef}
        className="bg-white dark:bg-[#3D3D3D] rounded-lg border border-darkModeCompliment p-6 w-96 max-h-[80vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <div className="bg-primaryLight dark:bg-primaryDark text-primary rounded-md p-3">
              <LiaArrowsAltSolid size={20} />
            </div>
            <div>
              <h3 className="text-[18px] font-bold text-gray-900 dark:text-gray-100">
                Move to Category
              </h3>
              <p>
                {checkedVideoCount}{' '}
                {checkedVideoCount === 1 ? 'video' : 'videos'} selected
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="hover:text-gray-600 dark:text-white dark:hover:text-gray-300"
          >
            <IoMdClose size={16} />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex ml-0.5 flex-col">
            <p className="text-xs">Currently in:</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 flex gap-2 px-2.5 py-2 rounded-md items-center">
                <div className="px-1 py-1 bg-[#E6E6E6] dark:bg-primaryDark rounded-md">
                  <MdOutlineFolder
                    size={16}
                    className="text-[#474747] dark:text-primary font-bold"
                  />
                </div>
                {/* Selected Value */}
                <div
                  className="
                     text-gray-700 dark:text-gray-300 text-[13px]"
                >
                  {activeTab}
                </div>
              </div>
            </div>
          </div>
          <div>
            <div className="relative flex ml-0.5 flex-col gap-1">
              <p className="text-xs">Moved to:</p>
              <div className="flex items-center px-2 gap-3 bg-[#FEF9F4] dark:bg-[#474747] rounded">
                <div className="flex-1 flex gap-2 px-1 py-2 rounded-md items-center">
                  <div className="px-1 py-1 bg-[#E6E6E6] dark:bg-[#727272] rounded-md">
                    <MdOutlineFolder
                      size={16}
                      className="text-[#474747] dark:text-[#F3F3F3]"
                    />
                  </div>
                  {/* Selected Value */}
                  <div
                    className="
                     text-gray-700 dark:text-gray-300 text-[13px]"
                  >
                    {selected ?? 'Select a category'}
                  </div>
                </div>
                <button
                  onClick={() => setOpen((o) => !o)}
                  className="px-2 py-1 rounded-md text-[11px] font-medium
                     bg-gray-100 dark:bg-[#3D3D3D]
                     text-gray-700 dark:text-gray-200
                     hover:bg-gray-200 dark:hover:bg-gray-600 mr-1"
                >
                  Change
                </button>
              </div>

              {/* Dropdown */}
              {open && (
                <div
                  ref={dropdownRef}
                  className="absolute z-20 mt-16 w-full max-h-[80px] overflow-y-auto rounded-md bg-white dark:bg-[#5B5B5B] shadow-lg"
                >
                  {availableCategories.length > 0 ? (
                    availableCategories.map((category) => (
                      <button
                        key={category.name}
                        onClick={() => {
                          setSelected(category.name);
                          setOpen(false);
                        }}
                        className={`group justify-between gap-2 flex w-full text-left px-3.5 py-2 text-[13px] ${
                          selected === category.name
                            ? 'bg-primary dark:bg-primary text-white'
                            : 'text-gray-700 dark:text-white'
                        } hover:bg-primary dark:hover:bg-primaryDarkHover`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`px-1 py-1 bg-[#E6E6E6] dark:bg-[#727272] rounded-md group-hover:bg-white group-hover:text-white transition-colors ${
                              selected === category.name
                                ? 'bg-white dark:bg-white'
                                : ''
                            }`}
                          >
                            <MdOutlineFolder
                              size={16}
                              className={`text-[#474747] dark:text-[#F3F3F3] group-hover:text-primary transition-colors ${
                                selected === category.name
                                  ? 'text-primary dark:text-primary'
                                  : ''
                              }`}
                            />
                          </div>
                          <span className="group-hover:text-white transition-colors">
                            {category.name}
                          </span>
                        </div>
                        <div className="py-1 flex items-center justify-center">
                          <span className="text-xs group-hover:text-white transition-colors">
                            {category.count}
                          </span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-4 text-center text-[13px] text-gray-500 dark:text-gray-400">
                      No other categories to move to
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        {/* Footer */}
        <div className="flex justify-end space-x-3 -mx-6 -mb-6 px-4 py-3 mt-8">
          <button
            onClick={onClose}
            className="px-6 py-2 border rounded-md hover:bg-gray-50 flex justify-center items-center
                       dark:border-[#474747] dark:hover:bg-secondarkDarkHover dark:text-gray-200"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (selected) {
                onConfirmMove(selected);
                setOpen(false);
                setSelected(null);
                onClose();
              }
            }}
            disabled={!selected}
            className="px-3 py-2 bg-primary text-white rounded-md flex justify-center items-center
                       hover:bg-primary/90 dark:bg-primary dark:hover:bg-primaryDarkHover disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default MoveVideosModal;
