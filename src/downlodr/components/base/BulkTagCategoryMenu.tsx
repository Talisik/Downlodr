/**
 * A custom React component
 * A toolbar dropdown that applies a tag or a category to every selected download at
 * once. It mirrors the single-item flyout in DownloadContextMenu, but each entry is
 * tri-state across the selection:
 *  - ✓ every selected item has the value (clicking removes it from all)
 *  - – some of them have it (clicking adds it to the rest)
 *  - blank, none of them have it (clicking adds it to all)
 *
 * Video downloads live in useDownloadStore while scraped articles live in
 * useArticleDownloadStore, so a mixed selection is routed to both stores.
 *
 * @param mode - 'tag' renders the Tag menu, 'category' the Category menu
 * @returns JSX.Element - The rendered trigger button and its dropdown
 */

import { useArticleDownloadStore } from '@/afda/store/articleDownloadStore';
import { Button } from '@/core-app/components/shadcn/components/ui/button';
import { useToast } from '@/core-app/components/shadcn/hooks/use-toast';
import { cn } from '@/core-app/components/shadcn/lib/utils';
import TooltipWrapper from '@/core-app/components/wrapper/TooltipWrapper';
import { useSelectedDownloadStore } from '@/core-app/store/selectedDownloadStore';
import { useDownloadStore } from '@/downlodr/store/downloadStore';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BiLayer } from 'react-icons/bi';
import { BsTag } from 'react-icons/bs';
import { GoPlus } from 'react-icons/go';

const MAX_LENGTH = 120;

interface BulkTagCategoryMenuProps {
  mode: 'tag' | 'category';
}

const BulkTagCategoryMenu: React.FC<BulkTagCategoryMenuProps> = ({ mode }) => {
  const { t } = useTranslation('downlodr');
  const { toast } = useToast();
  const isTag = mode === 'tag';

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedDownloads = useSelectedDownloadStore(
    (state) => state.selectedDownloads,
  );

  const downloading = useDownloadStore((state) => state.downloading);
  const finishedDownloads = useDownloadStore(
    (state) => state.finishedDownloads,
  );
  const historyDownloads = useDownloadStore((state) => state.historyDownloads);
  const forDownloads = useDownloadStore((state) => state.forDownloads);
  const queuedDownloads = useDownloadStore((state) => state.queuedDownloads);
  const availableTags = useDownloadStore((state) => state.availableTags);
  const availableCategories = useDownloadStore(
    (state) => state.availableCategories,
  );

  const articleDownloads = useArticleDownloadStore((s) => s.articleDownloads);

  // Translation keys differ per mode, everything else is shared
  const keys = isTag
    ? {
        label: 'toolbar.tagLabel',
        tooltip: 'toolbar.tooltip.bulkTag',
        placeholder: 'toolbar.bulkMenu.addNewTag',
        empty: 'toolbar.bulkMenu.noTags',
        duplicateTitle: 'toolbar.toast.duplicateTagTitle',
        duplicateDesc: 'toolbar.toast.duplicateTagDesc',
        appliedTitle: 'toolbar.toast.bulkTagAppliedTitle',
        appliedDesc: 'toolbar.toast.bulkTagAppliedDesc',
        removedTitle: 'toolbar.toast.bulkTagRemovedTitle',
        removedDesc: 'toolbar.toast.bulkTagRemovedDesc',
      }
    : {
        label: 'toolbar.categoryLabel',
        tooltip: 'toolbar.tooltip.bulkCategory',
        placeholder: 'toolbar.bulkMenu.addNewCategory',
        empty: 'toolbar.bulkMenu.noCategories',
        duplicateTitle: 'toolbar.toast.duplicateCategoryTitle',
        duplicateDesc: 'toolbar.toast.duplicateCategoryDesc',
        appliedTitle: 'toolbar.toast.bulkCategoryAppliedTitle',
        appliedDesc: 'toolbar.toast.bulkCategoryAppliedDesc',
        removedTitle: 'toolbar.toast.bulkCategoryRemovedTitle',
        removedDesc: 'toolbar.toast.bulkCategoryRemovedDesc',
      };

  // Merge the store list with values only articles carry, same as DownloadContextMenu
  const availableValues = useMemo(
    () =>
      Array.from(
        new Set([
          ...(isTag ? availableTags : availableCategories),
          ...articleDownloads.flatMap(
            (a) => (isTag ? a.tags : a.category) ?? [],
          ),
        ]),
      ),
    [isTag, availableTags, availableCategories, articleDownloads],
  );

  // Split the selection per store and resolve each item's current values by id.
  // Selection entries can be placeholders holding only an id, so never read
  // tags/categories off selected.download.
  const { videoIds, articleIds, valuesById } = useMemo(() => {
    const articleById = new Map(articleDownloads.map((a) => [a.id, a]));
    const downloadById = new Map(
      [
        ...downloading,
        ...finishedDownloads,
        ...historyDownloads,
        ...forDownloads,
        ...queuedDownloads,
      ].map((d) => [d.id, d]),
    );

    const videoIds: string[] = [];
    const articleIds: string[] = [];
    const valuesById = new Map<string, string[]>();

    for (const selected of selectedDownloads) {
      if (!selected.id || valuesById.has(selected.id)) continue;

      const article = articleById.get(selected.id);
      if (article) {
        articleIds.push(selected.id);
        valuesById.set(selected.id, (isTag ? article.tags : article.category) ?? []);
        continue;
      }

      const download = downloadById.get(selected.id);
      // Not in a list the tag/category actions touch, so it cannot be updated
      if (!download) continue;
      videoIds.push(selected.id);
      valuesById.set(selected.id, (isTag ? download.tags : download.category) ?? []);
    }

    return { videoIds, articleIds, valuesById };
  }, [
    isTag,
    selectedDownloads,
    articleDownloads,
    downloading,
    finishedDownloads,
    historyDownloads,
    forDownloads,
    queuedDownloads,
  ]);

  const targetCount = valuesById.size;

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

  // 'all' | 'some' | 'none' across the selection
  const getSelectionState = (value: string) => {
    if (targetCount === 0) return 'none';
    let count = 0;
    valuesById.forEach((values) => {
      if (values.includes(value)) count += 1;
    });
    if (count === 0) return 'none';
    return count === targetCount ? 'all' : 'some';
  };

  // Adds the value to every selected item missing it. Categories are single per
  // download, so any existing category is removed first (same rule as the
  // right-click menu). Returns how many items changed.
  const applyValue = (value: string) => {
    const { addTag, addCategory, removeCategory } = useDownloadStore.getState();
    const { addArticleTag, addArticleCategory, removeArticleCategory } =
      useArticleDownloadStore.getState();
    let changed = 0;

    for (const id of videoIds) {
      const current = valuesById.get(id) ?? [];
      if (current.includes(value)) continue;
      if (isTag) {
        addTag(id, value);
      } else {
        current.forEach((category) => removeCategory(id, category));
        addCategory(id, value);
      }
      changed += 1;
    }

    for (const id of articleIds) {
      const current = valuesById.get(id) ?? [];
      if (current.includes(value)) continue;
      if (isTag) {
        addArticleTag(id, value);
      } else {
        current.forEach((category) => removeArticleCategory(id, category));
        addArticleCategory(id, value);
      }
      changed += 1;
    }

    return changed;
  };

  // Removes the value from every selected item that has it
  const removeValue = (value: string) => {
    const { removeTag, removeCategory } = useDownloadStore.getState();
    const { removeArticleTag, removeArticleCategory } =
      useArticleDownloadStore.getState();
    let changed = 0;

    for (const id of videoIds) {
      if (!(valuesById.get(id) ?? []).includes(value)) continue;
      if (isTag) removeTag(id, value);
      else removeCategory(id, value);
      changed += 1;
    }

    for (const id of articleIds) {
      if (!(valuesById.get(id) ?? []).includes(value)) continue;
      if (isTag) removeArticleTag(id, value);
      else removeArticleCategory(id, value);
      changed += 1;
    }

    return changed;
  };

  const handleValueClick = (value: string) => {
    if (targetCount === 0) {
      toast({
        variant: 'destructive',
        title: t('toolbar.toast.noDownloadsSelectedTitle'),
        description: t('toolbar.toast.bulkNoTargetsDesc'),
        duration: 5000,
      });
      return;
    }

    const isApplied = getSelectionState(value) === 'all';
    const count = isApplied ? removeValue(value) : applyValue(value);
    if (count === 0) return;

    toast({
      variant: 'success',
      title: t(isApplied ? keys.removedTitle : keys.appliedTitle),
      description: t(isApplied ? keys.removedDesc : keys.appliedDesc, {
        value,
        count,
      }),
      duration: 5000,
    });
  };

  const handleCreate = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;

    const input = e.target as HTMLInputElement;
    const value = input.value.trim();
    if (!value || value.length > MAX_LENGTH) return;

    // Duplicate check is case-insensitive, matching the right-click menu
    const isDuplicate = availableValues.some(
      (existing) => existing.toLowerCase() === value.toLowerCase(),
    );
    if (isDuplicate) {
      toast({
        variant: 'destructive',
        title: t(keys.duplicateTitle),
        description: t(keys.duplicateDesc, { value }),
        duration: 5000,
      });
      input.value = '';
      return;
    }

    input.value = '';
    handleValueClick(value);
  };

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
                maxLength={MAX_LENGTH}
                onKeyDown={handleCreate}
                className="w-full outline-none dark:bg-darkMode dark:text-gray-200"
              />
              {isTag && (
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('toolbar.bulkMenu.maxChars', { max: MAX_LENGTH })}
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
                    onClick={() => handleValueClick(value)}
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
