/**
 * A custom React component
 * A toolbar dropdown that applies a tag or a category to every selected download at
 * once. The selection logic lives in useBulkTagCategory (shared with
 * DownloadContextMenu); each entry is tri-state across the selection:
 *  - ✓ every selected item has the value (clicking removes it from all)
 *  - – some of them have it (clicking adds it to the rest)
 *  - blank, none of them have it (clicking adds it to all)
 *
 * @param mode - 'tag' renders the Tag menu, 'category' the Category menu
 * @returns JSX.Element - The rendered trigger button and its dropdown
 */

import { Button } from '@/core-app/components/shadcn/components/ui/button';
import { cn } from '@/core-app/components/shadcn/lib/utils';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import {
  BULK_VALUE_MAX_LENGTH,
  useBulkTagCategory,
} from '@/downlodr/hooks/useBulkTagCategory';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BiLayer } from 'react-icons/bi';
import { BsTag } from 'react-icons/bs';
import { GoPlus } from 'react-icons/go';

interface BulkTagCategoryMenuProps {
  mode: 'tag' | 'category';
}

const BulkTagCategoryMenu: React.FC<BulkTagCategoryMenuProps> = ({ mode }) => {
  const { t } = useTranslation('downlodr');
  const isTag = mode === 'tag';

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    availableValues,
    getSelectionState,
    toggleValue,
    handleCreateKeyDown,
  } = useBulkTagCategory(mode);

  // Translation keys differ per mode, everything else is shared
  const keys = isTag
    ? {
        label: 'toolbar.tagLabel',
        tooltip: 'toolbar.tooltip.bulkTag',
        placeholder: 'toolbar.bulkMenu.addNewTag',
        empty: 'toolbar.bulkMenu.noTags',
      }
    : {
        label: 'toolbar.categoryLabel',
        tooltip: 'toolbar.tooltip.bulkCategory',
        placeholder: 'toolbar.bulkMenu.addNewCategory',
        empty: 'toolbar.bulkMenu.noCategories',
      };

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <TooltipWrapper content={t(keys.tooltip)} side="bottom">
        <Button
          variant="transparent"
          size="icon"
          className={cn(
            'text-[12px] rounded-md h-6 flex items-center justify-center px-2 py-[2px] border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-darkModeHover',
            isOpen && 'bg-gray-100 dark:bg-darkModeHover',
          )}
          onClick={() => setIsOpen((open) => !open)}
          icon={isTag ? <BsTag size={13} /> : <BiLayer size={13} />}
        >
          {t(keys.label)}
        </Button>
      </TooltipWrapper>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 bg-white dark:bg-darkMode border rounded-md shadow-lg py-1 min-w-[185px] z-50 dark:border-gray-700">
          <div className="m-2 px-3 py-2 flex flex-row border rounded dark:border-gray-700">
            <GoPlus size={22} className="ml-[-10px] mr-2 dark:text-gray-200" />
            <div className="flex-1">
              <input
                type="text"
                placeholder={t(keys.placeholder)}
                maxLength={BULK_VALUE_MAX_LENGTH}
                onKeyDown={handleCreateKeyDown}
                className="w-full outline-none dark:bg-darkMode dark:text-gray-200"
              />
              {isTag && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('toolbar.bulkMenu.maxChars', {
                    max: BULK_VALUE_MAX_LENGTH,
                  })}
                </div>
              )}
            </div>
          </div>
          <hr className="solid mt-2 mb-1 mx-2 w-[calc(100%-20px)] border-t-2 border-divider dark:border-gray-700" />
          <div className="max-h-48 overflow-y-auto">
            {availableValues.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
                {t(keys.empty)}
              </div>
            ) : (
              availableValues.map((value) => {
                const state = getSelectionState(value);
                return (
                  <button
                    key={value}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-darkModeHover flex items-center gap-2 dark:text-gray-200"
                    onClick={() => toggleValue(value)}
                  >
                    <span
                      className={cn(
                        'w-3 flex-shrink-0 dark:text-gray-200',
                        state === 'some' && 'text-gray-400 dark:text-gray-500',
                      )}
                    >
                      {state === 'all' ? '✓' : state === 'some' ? '–' : ''}
                    </span>
                    <span className="truncate">{value}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BulkTagCategoryMenu;
