import { DotIcon } from 'lucide-react';
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FiChevronDown, FiChevronUp, FiX } from 'react-icons/fi';

// Drag Preview Component
const DragPreview: React.FC<{
  video: VideoItem;
  mousePosition: { x: number; y: number };
}> = ({ video, mousePosition }) => {
  return (
    <div
      className="fixed pointer-events-none z-[9999] opacity-80 transform -translate-x-1/2 -translate-y-1/2"
      style={{
        left: mousePosition.x,
        top: mousePosition.y,
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-300 dark:border-gray-600 p-2 flex items-center gap-2 max-w-xs">
        <img
          src={video.thumbnails || ''}
          alt={video.video_title}
          className="w-12 h-8 object-cover rounded"
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">
            {video.video_title}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {video.channelName || ''}
          </p>
        </div>
      </div>
    </div>
  );
};

interface VideoItem {
  video_id: string;
  video_title: string;
  thumbnails?: string;
  channelName?: string;
  tags?: string[];
}

interface OrganizationSideSearchBarProps {
  groups: Record<string, VideoItem[]>;
  activeTab: string;
  onTabChangeHandler: (tabName: string) => void;
}

const OrganizationSideSearchBar: React.FC<OrganizationSideSearchBarProps> = ({
  groups,
  activeTab,
  onTabChangeHandler,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const [isSearchMode, setIsSearchMode] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [searchScope, setSearchScope] = useState<'current' | 'all'>('current');
  const [isScopeDropdownOpen, setIsScopeDropdownOpen] = useState(false);

  // Drag preview state
  const [isDragging, setIsDragging] = useState(false);
  const [dragVideo, setDragVideo] = useState<VideoItem | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [showTitleResults, setShowTitleResults] = useState(true);
  const [showCategoryResults, setShowCategoryResults] = useState(true);

  const normalizedGroups = useMemo(() => {
    const result: Record<
      string,
      (VideoItem & {
        _titleLower: string;
        _channelLower: string;
      })[]
    > = {};

    for (const [groupName, videos] of Object.entries(groups)) {
      result[groupName] = videos.map((v) => ({
        ...v,
        _titleLower: v.video_title.toLowerCase(),
        _channelLower: (v.channelName || '').toLowerCase(),
      }));
    }

    return result;
  }, [groups]);

  // Filter categories based on search scope (always respect scope, not just when searching)
  const getCategoriesToSearch = useMemo(() => {
    return searchScope === 'current' && activeTab !== 'All Videos'
      ? [activeTab]
      : Object.keys(groups);
  }, [searchScope, activeTab, groups]);

  const filteredTitleResults = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    if (!query) return [];

    const results: { category: string; video: VideoItem }[] = [];

    for (const category of getCategoriesToSearch) {
      const videos = normalizedGroups[category] || [];

      for (const video of videos) {
        if (video._titleLower.includes(query)) {
          results.push({ category, video });
        }
      }
    }

    return results;
  }, [normalizedGroups, deferredSearchQuery, getCategoriesToSearch]);

  const filteredGroupCategories = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    const filtered: Record<string, VideoItem[]> = {};

    if (!query) return filtered;

    for (const category of getCategoriesToSearch) {
      if (category.toLowerCase().includes(query)) {
        filtered[category] = normalizedGroups[category] || [];
      }
    }

    return filtered;
  }, [normalizedGroups, deferredSearchQuery, getCategoriesToSearch]);

  const handleSearchExit = () => {
    setSearchQuery('');
    setIsSearchMode(false);
    setShowTitleResults(false);
    setShowCategoryResults(false);

    // Optionally, blur the input so keyboard closes
    searchInputRef.current?.blur();
  };
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') handleSearchExit();
    if (e.key === 'Enter') {
      const filteredKeys = Object.keys(groups);
      if (filteredKeys.length === 1) {
        onTabChangeHandler(filteredKeys[0]);
        handleSearchExit();
      }
    }
  };

  // Mouse move handler for drag preview
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        setMousePosition({ x: e.clientX, y: e.clientY });
      }
    },
    [isDragging],
  );

  // Add mouse move listener when dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      return () => document.removeEventListener('mousemove', handleMouseMove);
    }
  }, [isDragging, handleMouseMove]);

  return (
    <div className="w-full max-w-full">
      <div
        className="justify-start flex flex-col w-full max-w-full"
        ref={searchContainerRef}
      >
        <div className="flex items-center px-2 py-1.5 justify-between border border-primary rounded-md w-full max-w-full">
          <div className="flex items-center gap-2">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              placeholder=""
              className="text-[12px] font-normal bg-transparent text-md outline-none placeholder:font-normal placeholder:text-gray-400 dark:placeholder:text-gray-500 flex-1 min-w-0"
              autoComplete="off"
              maxLength={25}
            />
          </div>
          <FiX
            size={12}
            className="flex-shrink-0 cursor-pointer"
            onClick={() => {
              handleSearchExit();
            }}
          />
        </div>
        <div className="flex items-center gap-1 pt-2 px-2">
          <span className="text-[10.5px] font-normal text-gray-500 dark:text-gray-400">
            {Object.keys(filteredTitleResults).length +
              Object.keys(filteredGroupCategories).length}{' '}
            results
          </span>
          <DotIcon size={12} className="text-gray-500 dark:text-gray-400" />
          <div className="relative">
            <button
              onClick={() => setIsScopeDropdownOpen(!isScopeDropdownOpen)}
              className="flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-gray-700 px-1 py-0.5 rounded transition-colors"
            >
              <span className="text-[10.5px] font-normal text-gray-500 dark:text-gray-400">
                {searchScope === 'current' ? 'This Category' : 'All Categories'}
              </span>
              <FiChevronDown
                size={12}
                className={`text-gray-500 dark:text-gray-400 transition-transform ${
                  isScopeDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {isScopeDropdownOpen && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsScopeDropdownOpen(false)}
                />

                {/* Dropdown */}
                <div className="absolute top-full gap-y-1.5 space-y-1.5 left-0 mt-1 bg-white dark:bg-darkModeDropdown border border-titleBarBorder dark:border-gray-700 rounded-md shadow-lg z-20 min-w-[120px] py-1">
                  <button
                    onClick={() => {
                      setSearchScope('current');
                      setIsScopeDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 text-[10.5px] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                      searchScope === 'current'
                        ? 'bg-lightModeBorder dark:bg-darkModeCompliment text-primary'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    This Category
                  </button>
                  <button
                    onClick={() => {
                      setSearchScope('all');
                      setIsScopeDropdownOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 text-[10.5px] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                      searchScope === 'all'
                        ? 'bg-lightModeBorder dark:bg-darkModeCompliment text-primary'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    All Categories
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2 px-1 mt-3">
        <div className="flex items-center gap-1 justify-between px-1">
          <div
            className="flex items-center gap-1"
            onClick={() => setShowTitleResults(!showTitleResults)}
          >
            {showTitleResults ? (
              <FiChevronDown
                size={12}
                className="text-gray-500 dark:text-gray-400"
              />
            ) : (
              <FiChevronUp
                size={12}
                className="text-gray-500 dark:text-gray-400"
              />
            )}
            <h1 className="text-[10.5px] font-normal text-gray-500 dark:text-gray-400">
              Title
            </h1>
          </div>
          <span className="text-[10.5px] font-normal text-gray-500 dark:text-gray-400">
            {filteredTitleResults.length}
          </span>
        </div>
        {showTitleResults && (
          <div className="flex flex-col gap-2 px-1">
            {/* Show individual videos that match the title search */}
            {filteredTitleResults.map(({ category, video }) => (
              <div
                key={`title-video-${video.video_id}`}
                draggable="true"
                onDragStart={(e) => {
                  setIsDragging(true);
                  setDragVideo(video);
                  setMousePosition({ x: e.clientX, y: e.clientY });
                  e.dataTransfer.setData(
                    'application/json',
                    JSON.stringify({
                      video,
                      fromCategory: category,
                    }),
                  );
                  e.dataTransfer.effectAllowed = 'move';
                  // Hide the default drag image
                  const img = new Image();
                  img.src =
                    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                  e.dataTransfer.setDragImage(img, 0, 0);
                }}
                onDragEnd={() => {
                  setIsDragging(false);
                  setDragVideo(null);
                }}
                className="px-2 w-full flex items-center rounded transition-colors py-1 hover:bg-[#F2F2F2] dark:hover:bg-darkModeCompliment dark:text-gray-200 cursor-move"
              >
                <button
                  onClick={() => {
                    onTabChangeHandler(category);
                    if (isSearchMode) handleSearchExit();
                  }}
                  className="flex flex-1 min-w-0"
                  tabIndex={0}
                  title={`${video.video_title} (${category})`}
                >
                  <div className="w-12 h-10 bg-black rounded overflow-hidden flex-shrink-0 cursor-pointer hover:opacity-70 transition-opacity">
                    <img
                      src={video.thumbnails}
                      alt={video.video_title}
                      className="w-full h-full object-cover "
                    />
                  </div>
                  <div className="flex flex-col justify-start items-start ml-2 overflow-hidden flex-1 min-w-0">
                    <span className="font-semibold mt-2 text-[11px] font-[500] text-black dark:text-gray-100 truncate w-full min-w-0">
                      {video.video_title}
                    </span>
                    <span className="items-start text-start text-[10px] text-gray-500 dark:text-gray-400 truncate w-full min-w-0">
                      {video.channelName}
                    </span>
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Drag Preview */}
        {isDragging && dragVideo && (
          <DragPreview video={dragVideo} mousePosition={mousePosition} />
        )}
      </div>
      <div className="flex flex-col gap-2 px-1 mt-3">
        <div className="flex items-center gap-1 justify-between px-1">
          <div
            className="flex items-center gap-1"
            onClick={() => setShowCategoryResults(!showCategoryResults)}
          >
            {showCategoryResults ? (
              <FiChevronDown
                size={12}
                className="text-gray-500 dark:text-gray-400"
              />
            ) : (
              <FiChevronUp
                size={12}
                className="text-gray-500 dark:text-gray-400"
              />
            )}

            <h1 className="text-[10.5px] font-normal text-gray-500 dark:text-gray-400">
              Category
            </h1>
          </div>
          <span className="text-[10.5px] font-normal text-gray-500 dark:text-gray-400">
            {Object.keys(filteredGroupCategories).length}
          </span>
        </div>
        {showCategoryResults && (
          <div className="flex flex-col gap-2 px-1">
            {Object.entries(filteredGroupCategories).flatMap(
              ([category, videos]) =>
                videos.map((video) => (
                  <div
                    key={`category-video-${video.video_id}`}
                    draggable="true"
                    onDragStart={(e) => {
                      setIsDragging(true);
                      setDragVideo(video);
                      setMousePosition({ x: e.clientX, y: e.clientY });
                      e.dataTransfer.setData(
                        'application/json',
                        JSON.stringify({
                          video,
                          fromCategory: category,
                        }),
                      );
                      e.dataTransfer.effectAllowed = 'move';
                      // Hide the default drag image
                      const img = new Image();
                      img.src =
                        'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
                      e.dataTransfer.setDragImage(img, 0, 0);
                    }}
                    onDragEnd={() => {
                      setIsDragging(false);
                      setDragVideo(null);
                    }}
                    className="px-2 w-full flex items-center rounded transition-colors py-1 hover:bg-[#F2F2F2] dark:hover:bg-darkModeCompliment dark:text-gray-200 cursor-move"
                  >
                    <button
                      onClick={() => {
                        onTabChangeHandler(category);
                        if (isSearchMode) handleSearchExit();
                      }}
                      className="flex flex-1 min-w-0"
                      tabIndex={0}
                      title={`${video.video_title} (${category})`}
                    >
                      <div className="w-12 h-10 bg-black rounded overflow-hidden flex-shrink-0 cursor-pointer hover:opacity-70 transition-opacity">
                        <img
                          src={video.thumbnails}
                          alt={video.video_title}
                          className="w-full h-full object-cover "
                        />
                      </div>
                      <div className="flex flex-col justify-start items-start ml-2 overflow-hidden flex-1 min-w-0">
                        <span className="font-semibold mt-2 text-[11px] font-[500] text-black dark:text-gray-100 truncate w-full min-w-0">
                          {video.video_title}
                        </span>
                        <span className="items-start text-start text-[10px] text-gray-500 dark:text-gray-400 truncate w-full min-w-0">
                          {video.channelName}
                        </span>
                      </div>
                    </button>
                  </div>
                )),
            )}
          </div>
        )}

        {/* Drag Preview */}
        {isDragging && dragVideo && (
          <DragPreview video={dragVideo} mousePosition={mousePosition} />
        )}
      </div>
    </div>
  );
};

export default OrganizationSideSearchBar;
