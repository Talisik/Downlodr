import { useTaskbarDownloadStore } from '@/downlodr/store/taskbarDownloadStore';
import { Loader2 } from 'lucide-react';

/**
 * Spinner over a download table while a taskbar title search is waiting out
 * its debounce, so the page doesn't sit unchanged before results appear.
 * The parent must be `relative`; place this beside (not inside) the scroll
 * container so it stays put while the table scrolls.
 */
const SearchPendingOverlay: React.FC = () => {
  const isSearchPending = useTaskbarDownloadStore(
    (state) => state.isSearchPending,
  );
  if (!isSearchPending) return null;
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 dark:bg-darkMode/60">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
};

export default SearchPendingOverlay;
