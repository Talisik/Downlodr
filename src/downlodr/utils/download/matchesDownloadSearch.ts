/**
 * Whether a download matches the taskbar search query.
 *
 * The list shows `displayName || name`, where `name` is the original title the
 * file on disk is named after and `displayName` is what the user sees (and
 * can rename). Searching `name` alone meant typing the title on screen found
 * nothing, so both are matched.
 */
interface SearchableFields {
  name: string;
  displayName?: string;
  extractorKey?: string;
  status: string;
  tags?: string[];
  category?: string[];
}

export function matchesDownloadSearch(
  download: SearchableFields,
  rawQuery: string,
): boolean {
  const query = rawQuery.trim().toLowerCase();
  const has = (value?: string) => !!value && value.toLowerCase().includes(query);
  return (
    has(download.displayName) ||
    has(download.name) ||
    has(download.extractorKey) ||
    has(download.status) ||
    !!download.tags?.some(has) ||
    !!download.category?.some(has)
  );
}
