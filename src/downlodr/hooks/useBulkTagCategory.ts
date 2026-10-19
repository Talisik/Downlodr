/**
 * Shared logic for applying a tag or a category to every selected download at once.
 * Used by the toolbar's BulkTagCategoryMenu and by DownloadContextMenu when the
 * right-clicked row is part of a multi-row selection.
 *
 * Each value is tri-state across the selection:
 *  - 'all'  every selected item has the value (toggling removes it from all)
 *  - 'some' some of them have it (toggling adds it to the rest)
 *  - 'none' none of them have it (toggling adds it to all)
 *
 * Video downloads live in useDownloadStore while scraped articles live in
 * useArticleDownloadStore, so a mixed selection is routed to both stores.
 *
 * @param mode - 'tag' or 'category'
 */

import { useArticleDownloadStore } from '@/afda/store/articleDownloadStore';
import { useToast } from '@/core-app/components/shadcn/hooks/use-toast';
import { useSelectedDownloadStore } from '@/core-app/store/selectedDownloadStore';
import { useDownloadStore } from '@/downlodr/store/downloadStore';
import { KeyboardEvent, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export const BULK_VALUE_MAX_LENGTH = 120;

export type BulkSelectionState = 'all' | 'some' | 'none';

export const useBulkTagCategory = (mode: 'tag' | 'category') => {
  const { t } = useTranslation('downlodr');
  const { toast } = useToast();
  const isTag = mode === 'tag';

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

  // Toast keys differ per mode, everything else is shared
  const keys = isTag
    ? {
        duplicateTitle: 'toolbar.toast.duplicateTagTitle',
        duplicateDesc: 'toolbar.toast.duplicateTagDesc',
        appliedTitle: 'toolbar.toast.bulkTagAppliedTitle',
        appliedDesc: 'toolbar.toast.bulkTagAppliedDesc',
        removedTitle: 'toolbar.toast.bulkTagRemovedTitle',
        removedDesc: 'toolbar.toast.bulkTagRemovedDesc',
      }
    : {
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
        valuesById.set(
          selected.id,
          (isTag ? article.tags : article.category) ?? [],
        );
        continue;
      }

      const download = downloadById.get(selected.id);
      // Not in a list the tag/category actions touch, so it cannot be updated
      if (!download) continue;
      videoIds.push(selected.id);
      valuesById.set(
        selected.id,
        (isTag ? download.tags : download.category) ?? [],
      );
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

  const getSelectionState = (value: string): BulkSelectionState => {
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

  // Removes the value from all when every item has it, otherwise adds it to the rest
  const toggleValue = (value: string) => {
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

    // Only applying can skip items (removing only runs when every item has it),
    // so tell the user how many were left alone because they already had it
    const alreadyHad = targetCount - count;
    const description = t(isApplied ? keys.removedDesc : keys.appliedDesc, {
      value,
      count,
    });

    toast({
      variant: 'success',
      title: t(isApplied ? keys.removedTitle : keys.appliedTitle, { count }),
      description:
        !isApplied && alreadyHad > 0
          ? `${description} ${t('toolbar.toast.bulkAlreadyHadDesc', {
              count: alreadyHad,
            })}`
          : description,
      duration: 5000,
    });
  };

  // onKeyDown handler for the "add new" input: creates the value and applies it
  // to the whole selection. Duplicate check is case-insensitive.
  const handleCreateKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;

    const input = e.target as HTMLInputElement;
    const value = input.value.trim();
    if (!value || value.length > BULK_VALUE_MAX_LENGTH) return;

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
    toggleValue(value);
  };

  return {
    availableValues,
    targetCount,
    getSelectionState,
    toggleValue,
    handleCreateKeyDown,
  };
};
