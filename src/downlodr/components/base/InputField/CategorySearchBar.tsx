/**
 * A custom React component
 * A search bar for filtering downloads in CategoryTagPage.
 * Supports multi-field filtering (title, tags, categories, status, source)
 * with a field-selector dropdown. Defaults to searching by title.
 *
 * @param CategorySearchBarProps
 *   @param onSearch - Callback fired (debounced 300ms) with the current query and selected fields.
 *
 * @returns JSX.Element - The rendered search bar component.
 */
import Input from '@/core-app/components/shadcn/components/ui/input';
import { useTaskbarDownloadStore } from '@/downlodr/store/taskbarDownloadStore';
import { cn } from '@/core-app/components/shadcn/lib/utils';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HiAdjustmentsHorizontal,
  HiMagnifyingGlass,
  HiXMark,
} from 'react-icons/hi2';

export type SearchField = 'title' | 'tags' | 'categories' | 'status' | 'source';

const FIELD_IDS: SearchField[] = [
  'title',
  'tags',
  'categories',
  'status',
  'source',
];

interface CategorySearchBarProps {
  onSearch: (query: string, fields: SearchField[]) => void;
}

const CategorySearchBar = ({ onSearch }: CategorySearchBarProps) => {
  const { t } = useTranslation('downlodr');
  const [query, setQuery] = useState('');
  const [selectedFields, setSelectedFields] = useState<SearchField[]>([
    'title',
  ]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { isSearchActive, searchQuery: taskbarQuery } = useTaskbarDownloadStore(
    (state) => state.searchState,
  );
  const clearSearch = useTaskbarDownloadStore((state) => state.clearSearch);

  const onSearchRef = useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  });

  useEffect(() => {
    setQuery(isSearchActive ? taskbarQuery : '');
  }, [isSearchActive, taskbarQuery]);

  // Debounced onSearch
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchRef.current(query, selectedFields);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, selectedFields]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fieldOptions = FIELD_IDS.map((id) => ({
    id,
    label: t(`categorySearchBar.fields.${id}`),
  }));

  const toggleField = (field: SearchField) => {
    setSelectedFields((prev) => {
      if (prev.includes(field)) {
        if (prev.length === 1) return prev;
        return prev.filter((f) => f !== field);
      }
      return [...prev, field];
    });
  };

  const activeFieldLabels = useMemo(
    () =>
      selectedFields
        .map((id) => t(`categorySearchBar.fields.${id}`))
        .join(', '),
    [selectedFields, t],
  );

  return (
    <div ref={containerRef} className="relative w-1/2 m-2 justify-self-end">
      <Input
        placeholder={t('categorySearchBar.placeholder', {
          fields: activeFieldLabels,
        })}
        className="text-xs py-4"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        leftIcons={[
          <HiMagnifyingGlass
            key="search"
            className="text-darkModeHover dark:text-darkModeLight"
          />,
        ]}
        rightIcons={[
          {
            icon: (
              <HiAdjustmentsHorizontal
                className={cn(
                  'text-darkModeHover dark:text-darkModeLight',
                  dropdownOpen && 'text-primary',
                )}
              />
            ),
            onClick: () => setDropdownOpen((prev) => !prev),
            tooltip: t('categorySearchBar.filterTooltip'),
          },
        ]}
        actionIcon={
          query
            ? {
                icon: (
                  <HiXMark className="text-darkModeHover dark:text-darkModeLight" />
                ),
                onClick: () => {
                  setQuery('');
                  clearSearch();
                },
                tooltip: t('categorySearchBar.clearTooltip'),
              }
            : undefined
        }
        onContextMenu={(e) => {
          e.preventDefault();
          window.downlodrFunctions.showInputContextMenu();
        }}
      />

      {dropdownOpen && (
        <div className="absolute z-30 top-full left-0 w-full mt-1 bg-white dark:bg-darkModeDropdown border border-[#D1D5DB] dark:border-none rounded-md shadow-sm py-1">
          {fieldOptions.map((option) => {
            const isChecked = selectedFields.includes(option.id);
            const isDisabled = isChecked && selectedFields.length === 1;
            return (
              <label
                key={option.id}
                className={cn(
                  'flex items-center gap-2 px-3 py-1 text-xs cursor-pointer',
                  'hover:bg-gray-50 dark:hover:bg-gray-700',
                  isDisabled && 'opacity-50 cursor-not-allowed',
                )}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={isDisabled}
                  onChange={() => toggleField(option.id)}
                  className="rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-blue-500"
                />
                <span className="dark:text-gray-200">{option.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CategorySearchBar;
