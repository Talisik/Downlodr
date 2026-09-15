/**
 * A dedicated organization modal for Downlodr
 * Allows users to organize selected videos into groups/modules
 * Features drag-and-drop functionality, group management, and video assignment
 *
 * @param isOpen - If modal is open, keeps it open
 * @param onClose - If modal has been closed, closes modal
 * @param selectedVideos - Array of video IDs that are selected for organization
 * @param onSave - Callback function when organization is saved
 * @returns JSX.Element - The rendered component displaying an OrganizationTable
 */

import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import OrganizationTableProps from '../schema/organizationPropSchema';
import {
  ContextMenuState,
  Position,
  SearchQuery,
  SelectedDownload,
  UndoOperation,
} from '../schema/organizationTableSchema';
import { useDownloadStore } from '@/downlodr/store/downloadStore';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { MdChevronRight } from 'react-icons/md';
import NewCategoryModal from './organizationModal/NewCategory';
import RemoveModal from './organizationModal/RemoveModal';
import RenameModal from './organizationModal/RenameModal';
import OrganizationHeader from './organizationTable/OrganizationHeader';
import { OrganizationTableBanner } from './organizationTable/OrganizationTableBanner';
import OrganizationTableContent from './organizationTable/OrganizationTableContent';
import PermanentCategorySidebar from './PermanentCategorySidebar';
import RenameModalCategory from './RenameModalCategory';
// Constants
const UNCATEGORIZED_NAME = 'Uncategorized';

const createInitialContextMenu = (): ContextMenuState => ({
  visible: false,
  x: 0,
  y: 0,
  video: {
    video_id: '',
    video_title: '',
    thumbnails: '',
    channelName: '',
    tags: [],
  },
  currentCategory: '',
});

const OrganizationTable: React.FC<OrganizationTableProps> = ({
  isOpen,
  onClose,
  selectedVideos: _selectedVideos,
  onSave,
  initialGroups,
  categoryContexts = {},
}) => {
  const { addCategory, removeCategory } = useDownloadStore();
  const finishedDownloads = useDownloadStore(
    (state) => state.finishedDownloads,
  );
  const availableCategories = useDownloadStore(
    (state) => state.availableCategories,
  );
  const [selectedDownload, setSelectedDownload] =
    useState<SelectedDownload | null>(null);

  // Track categories that have already been toasted to prevent duplicates
  const toastedCategoriesRef = useRef<Set<string>>(new Set());

  // Track previous initialGroups to only clear toasts when groups actually change
  const prevInitialGroupsRef = useRef<Record<string, any>>();
  // Track if activeTab has been manually set by user
  const activeTabManuallySetRef = useRef<boolean>(false);
  // Helper function to build AI suggestion groups only
  type SuggestedVideo = {
    video_id: string;
    video_title: string;
    thumbnails?: string;
    channelName?: string;
    tags?: string[];
  };

  type VideoLite = {
    video_id: string;
    video_title: string;
  };

  // create category group that is exclusively AI suggested groups that are new and not found in already made categories
  const buildAISuggestionGroups = useCallback(
    (
      initialGroups: Record<string, SuggestedVideo[]> | null,
    ): Record<string, VideoLite[]> => {
      const aiGroups: Record<string, VideoLite[]> = {};
      if (!initialGroups) return aiGroups;

      const existingCategories = new Set(
        finishedDownloads.flatMap((d) =>
          (d.category ?? []).map((c) => c.toLowerCase()),
        ),
      );

      // ✅ Tracks duplicates across ALL groups
      const processedIds = new Set<string>();

      Object.entries(initialGroups).forEach(([categoryName, videos]) => {
        if (existingCategories.has(categoryName.toLowerCase())) return;

        const uniqueVideos: VideoLite[] = [];

        videos.forEach((video) => {
          // ✅ Skip duplicates
          if (processedIds.has(video.video_id)) return;

          processedIds.add(video.video_id);

          const download = finishedDownloads.find(
            (d) => d.id === video.video_id,
          );

          uniqueVideos.push({
            video_id: video.video_id,
            video_title: download?.downloadName ?? video.video_title,
          });
        });

        if (uniqueVideos.length > 0) {
          aiGroups[categoryName] = uniqueVideos;
        }
      });

      return aiGroups;
    },
    [finishedDownloads],
  );

  // create category group that is the combination of already created categories + updated AI suggested groups
  const buildMergedCategoryGroups = useCallback(
    (
      initialGroups: Record<string, SuggestedVideo[]> | null,
    ): Record<string, VideoLite[]> => {
      const mergedGroups: Record<string, VideoLite[]> = {};

      // ✅ Fast lookup for downloads
      const downloadsMap = new Map(finishedDownloads.map((d) => [d.id, d]));

      // ✅ Track IDs per category
      const categoryIdSets: Record<string, Set<string>> = {};

      // 1️⃣ Add all videos from finishedDownloads safely
      finishedDownloads.forEach((download) => {
        if (!Array.isArray(download.category)) return;

        download.category.forEach((categoryName) => {
          if (!mergedGroups[categoryName]) {
            mergedGroups[categoryName] = [];
            categoryIdSets[categoryName] = new Set();
          }

          // ✅ Skip duplicate IDs
          if (categoryIdSets[categoryName].has(download.id)) return;

          categoryIdSets[categoryName].add(download.id);

          mergedGroups[categoryName].push({
            video_id: download.id,
            video_title: download.downloadName || download.name || download.id,
          });
        });
      });

      // 2️⃣ Merge AI suggestions safely
      if (initialGroups) {
        Object.entries(initialGroups).forEach(([categoryName, videos]) => {
          if (!mergedGroups[categoryName]) return;

          const idSet = categoryIdSets[categoryName];

          videos.forEach((video) => {
            if (idSet.has(video.video_id)) return;

            idSet.add(video.video_id);

            const download = downloadsMap.get(video.video_id);

            mergedGroups[categoryName].push({
              video_id: video.video_id,
              video_title: download?.downloadName ?? video.video_title,
            });
          });
        });
      }

      return mergedGroups;
    },
    [finishedDownloads],
  );
  // State management moved to after state declarations

  const [groups, setGroups] = useState<Record<string, VideoLite[]>>({});
  const [activeTab, setActiveTab] = useState<string>('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(
    createInitialContextMenu(),
  );
  const [isCategorySelected, setIsCategorySelected] = useState(false);
  const [showCategorySidebar, setShowCategorySidebar] = useState(false);
  const [submenuPosition, setSubmenuPosition] = useState<Position>({
    x: 0,
    y: 0,
  });
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingFromAddNew, setIsCreatingFromAddNew] = useState(false);
  // Track renamed AI suggestion categories for inline renaming (must be before useMemo hooks)
  const [renamedAISuggestions, setRenamedAISuggestions] = useState<
    Record<string, string>
  >({});

  // Consolidated state management
  const aiSuggestionGroups = useMemo(
    () => buildAISuggestionGroups(initialGroups),
    [buildAISuggestionGroups, initialGroups],
  );

  const mergedCategoryGroups = useMemo(
    () => buildMergedCategoryGroups(initialGroups),
    [buildMergedCategoryGroups, initialGroups],
  );

  const pendingCategoryVideos = useMemo(() => {
    const pending: Record<
      string,
      {
        video_id: string;
        video_title: string;
      }[]
    > = {};

    if (availableCategories.length === 0) {
      return pending;
    }

    const existingCategoryMap = new Map<string, Set<string>>();

    finishedDownloads.forEach((download) => {
      download.category?.forEach((cat) => {
        let existingSet = existingCategoryMap.get(cat);
        if (!existingSet) {
          existingSet = new Set<string>();
          existingCategoryMap.set(cat, existingSet);
        }
        existingSet.add(download.id);
      });
    });

    availableCategories.forEach((categoryName) => {
      const groupVideos = groups[categoryName] || [];
      if (groupVideos.length === 0) return;

      const existingIds = existingCategoryMap.get(categoryName) || new Set();
      const pendingVideos = groupVideos.filter(
        (video) => !existingIds.has(video.video_id),
      );

      if (pendingVideos.length > 0) {
        pending[categoryName] = pendingVideos;
      }
    });

    return pending;
  }, [groups, finishedDownloads, availableCategories]);

  const pendingCategoryRemovals = useMemo(() => {
    const pending: Record<string, string[]> = {};

    if (availableCategories.length === 0) {
      return pending;
    }

    const existingCategoryMap = new Map<string, Set<string>>();

    finishedDownloads.forEach((download) => {
      download.category?.forEach((cat) => {
        let existingSet = existingCategoryMap.get(cat);
        if (!existingSet) {
          existingSet = new Set<string>();
          existingCategoryMap.set(cat, existingSet);
        }
        existingSet.add(download.id);
      });
    });

    availableCategories.forEach((categoryName) => {
      const groupVideos = groups[categoryName] || [];
      const groupIds = new Set(groupVideos.map((video) => video.video_id));
      const existingIds = existingCategoryMap.get(categoryName) || new Set();
      const removedIds = Array.from(existingIds).filter(
        (id) => !groupIds.has(id),
      );

      if (removedIds.length > 0) {
        pending[categoryName] = removedIds;
      }
    });

    return pending;
  }, [groups, finishedDownloads, availableCategories]);

  // Filter AI suggestions to only include categories that haven't been merged
  const unmergedAISuggestionGroups = useMemo(() => {
    const userCategoryNames = new Set([
      ...Object.keys(mergedCategoryGroups),
      ...availableCategories,
    ]);
    const filtered: typeof groups = {};

    // Get AI suggestion categories from current groups state
    Object.entries(groups).forEach(([categoryName, videos]) => {
      if (!userCategoryNames.has(categoryName)) {
        // Apply any renames for this category
        const displayName = renamedAISuggestions[categoryName] || categoryName;
        filtered[displayName] = videos;
      }
    });

    return filtered;
  }, [groups, mergedCategoryGroups, availableCategories, renamedAISuggestions]);

  // Combine both AI suggestions and merged categories for display, removing duplicates
  const allGroups = useMemo(() => {
    const combined: Record<string, VideoLite[]> = {};

    // Get all unique category names from both sources
    const allCategoryNames = new Set([
      ...Object.keys(aiSuggestionGroups),
      ...Object.keys(mergedCategoryGroups),
    ]);

    // For each category, merge videos from both sources and deduplicate
    allCategoryNames.forEach((categoryName) => {
      const aiVideos = aiSuggestionGroups[categoryName] || [];
      const mergedVideos = mergedCategoryGroups[categoryName] || [];

      // Combine all videos and deduplicate by video_id
      const allVideos = [...aiVideos, ...mergedVideos];
      const uniqueVideos = allVideos.filter(
        (video, index, self) =>
          index === self.findIndex((v) => v.video_id === video.video_id),
      );

      if (uniqueVideos.length > 0) {
        combined[categoryName] = uniqueVideos;
      }
    });

    return combined;
  }, [aiSuggestionGroups, mergedCategoryGroups]);

  const downloadById = useMemo(
    () => new Map(finishedDownloads.map((download) => [download.id, download])),
    [finishedDownloads],
  );

  const buildDisplayGroups = useCallback(
    (sourceGroups: Record<string, VideoLite[]>) => {
      const display: Record<
        string,
        {
          video_id: string;
          video_title: string;
          thumbnails: string;
          channelName: string;
          tags: string[];
        }[]
      > = {};

      Object.entries(sourceGroups).forEach(([categoryName, videos]) => {
        display[categoryName] = videos.map((video) => {
          const download = downloadById.get(video.video_id);
          return {
            video_id: video.video_id,
            video_title: video.video_title,
            thumbnails: download?.thumbnails || '',
            channelName: download?.channelName || '',
            tags: download?.tags || [],
          };
        });
      });

      return display;
    },
    [downloadById],
  );

  const displayGroups = useMemo(
    () => buildDisplayGroups(groups),
    [buildDisplayGroups, groups],
  );

  const myCategoryDisplayGroups = useMemo(() => {
    const filtered: typeof displayGroups = {};

    availableCategories.forEach((categoryName) => {
      filtered[categoryName] = displayGroups[categoryName] || [];
    });

    return filtered;
  }, [displayGroups, availableCategories]);

  const pendingCategoryDisplayGroups = useMemo(
    () => buildDisplayGroups(pendingCategoryVideos),
    [buildDisplayGroups, pendingCategoryVideos],
  );

  const displayUnmergedAISuggestionGroups = useMemo(
    () => buildDisplayGroups(unmergedAISuggestionGroups),
    [buildDisplayGroups, unmergedAISuggestionGroups],
  );

  const [checkedVideos, setCheckedVideos] = useState<Set<string>>(new Set());
  const [isShowSidePlayer, setShowSidePlayer] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const setVideoSrcWithCleanup = useCallback((nextSrc: string | null) => {
    setVideoSrc((prev) => {
      if (prev && prev.startsWith('blob:') && prev !== nextSrc) {
        URL.revokeObjectURL(prev);
      }
      return nextSrc;
    });
  }, []);
  const toVideoLite = useCallback(
    (video: { video_id: string; video_title: string }) => ({
      video_id: video.video_id,
      video_title: video.video_title,
    }),
    [],
  );

  // Undo functionality
  const [undoStack, setUndoStack] = useState<UndoOperation[]>([]);
  // Category contexts state management
  const [localCategoryContexts, setLocalCategoryContexts] =
    useState<Record<string, string>>(categoryContexts);

  // Search state
  const searchDivRef = useRef<HTMLDivElement>(null);
  const [isAllSearchMode, setIsAllSearchMode] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [allSearchQuery, setAllSearchQuery] = useState<SearchQuery[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [filterType, setFilterType] = useState<'Title' | 'Category'>('Title');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Special All Videos search state
  const [isAllVideosSearchMode, setIsAllVideosSearchMode] = useState(false);
  const [allVideosSearchQuery, setAllVideosSearchQuery] = useState('');
  const [isAllVideosSearchResultsView, setIsAllVideosSearchResultsView] =
    useState(false);

  // Track new videos added to My Categories during merge
  const [newVideosInMyCategories, setNewVideosInMyCategories] = useState<
    Record<string, number>
  >({});

  // Delete confirmation dialog state
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const handleAddQuery = (query: string) => {
    const trimmed = query.trim();
    if (trimmed === '') return;
    setAllSearchQuery((prev) => [
      ...prev,
      { searchQuery: trimmed, filterType },
    ]);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddQuery(inputValue);
    }
    if (
      e.key === 'Backspace' &&
      inputValue === '' &&
      allSearchQuery.length > 0
    ) {
      // Remove last pill on backspace
      setAllSearchQuery((prev) => prev.slice(0, prev.length - 1));
    }
  };

  const removePill = (index: number) => {
    setAllSearchQuery((prev) => prev.filter((_, i) => i !== index));
  };

  // Category navigation context menu state
  const [categoryNavContextMenu, setCategoryNavContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    categoryName: string;
  }>({
    visible: false,
    x: 0,
    y: 0,
    categoryName: '',
  });

  // Rename category state
  const [showRenameCategoryInput, setShowRenameCategoryInput] = useState(false);
  const [renameCategoryName, setRenameCategoryName] = useState('');
  const [categoryBeingRenamed, setCategoryBeingRenamed] = useState('');
  const [inlineRenamingCategory, setInlineRenamingCategory] = useState<
    string | null
  >(null);
  const [inlineRenameValue, setInlineRenameValue] = useState('');

  // Loading state for apply button
  const [isApplying, setIsApplying] = useState(false);

  // Notification
  const [isShowNotification, setShowNotification] = useState(false);
  const [notificationVal, setNotificationVal] = useState('');

  // Memoized handlers for better performance

  // Navigation collapse state
  const [navCollapsed, setNavCollapsed] = useState(false);

  // View mode state (folder view vs list view) - persistent across page changes
  const [isFolderView, setIsFolderView] = useState(() => {
    const saved = localStorage.getItem('organization-view-mode');
    return saved !== null ? JSON.parse(saved) : false;
  });

  // Save view mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(
      'organization-view-mode',
      JSON.stringify(isFolderView),
    );
  }, [isFolderView]);
  const [viewedGroup, setViewedGroup] = useState<string | null>(null);

  // Toggle navigation collapse
  const toggleNavCollapse = () => {
    setNavCollapsed(!navCollapsed);
  };

  // Undo functionality state
  const [lastRenameOperation, setLastRenameOperation] = useState<{
    oldName: string;
    newName: string;
    timestamp: number;
    videos: {
      video_id: string;
      video_title: string;
      thumbnails?: string;
      channelName?: string;
      tags?: string[];
    }[];
  } | null>(null);

  // Memoized handlers for better performance
  const handleVideoCheck = useCallback(
    (video: { video_id: string; video_title: string }, isChecked: boolean) => {
      setCheckedVideos((prev) => {
        const newSet = new Set(prev);
        const key = video.video_id; // Using video_id as the unique key for checked videos
        if (isChecked) {
          newSet.add(key);
        } else {
          newSet.delete(key);
        }
        return newSet;
      });
    },
    [],
  );

  const resetCheckboxes = useCallback(() => {
    setCheckedVideos(new Set());
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(createInitialContextMenu());
  }, []);

  const closeCategoryNavContextMenu = useCallback(() => {
    setCategoryNavContextMenu({
      visible: false,
      x: 0,
      y: 0,
      categoryName: '',
    });
  }, []);

  const handleCategoryNavDotsClick = useCallback(
    (e: React.MouseEvent, categoryName: string) => {
      e.preventDefault();
      e.stopPropagation();

      setCategoryNavContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
        categoryName,
      });
    },
    [],
  );

  /*
  useEffect(() => {
    if (!selectedDownload?.location) {
      setIsVideoLoading(false);
      return;
    }

    const videoPath = selectedDownload.location;
    setIsVideoLoading(true);
    setVideoSrcWithCleanup(null); // Clear previous video immediately

    const loadVideo = async () => {
      try {
        const fileUrl = await window.downlodrFunctions.joinDownloadPath(
          videoPath,
          selectedDownload.downloadName,
        );
        if (fileUrl) {
          setVideoSrcWithCleanup(fileUrl);
          setIsVideoLoading(false);
          return;
        }

        const result = await window.downlodrFunctions.getVideoBlob(videoPath);
        if (!result) {
          setIsVideoLoading(false);
          return;
        }

        // Handle different response types
        if (typeof result === 'string') {
          // Legacy base64 string response (for backward compatibility)
          const bytes = Uint8Array.from(atob(result), (c) => c.charCodeAt(0));
          const blob = new Blob([bytes], { type: 'video/mp4' });
          const url = URL.createObjectURL(blob);
          setVideoSrcWithCleanup(url);
          setIsVideoLoading(false);
        } else if (result.type === 'buffer') {
          // New buffer response - direct binary data
          const uint8Array = new Uint8Array(result.data);
          const blob = new Blob([uint8Array], {
            type: result.mimeType || 'video/mp4',
          });
          const url = URL.createObjectURL(blob);
          setVideoSrcWithCleanup(url);
          setIsVideoLoading(false);
        } else if (result.type === 'stream') {
          // Large file streaming approach
          await loadVideoStream(result);
        } else if (result.type === 'base64') {
          // Base64 object response (fallback)
          const bytes = Uint8Array.from(atob(result.data), (c) =>
            c.charCodeAt(0),
          );
          const blob = new Blob([bytes], { type: 'video/mp4' });
          const url = URL.createObjectURL(blob);
          setVideoSrcWithCleanup(url);
          setIsVideoLoading(false);
        }
      } catch (error) {
        console.error('Error loading video:', error);
        // Optionally set a fallback or show an error state
        setVideoSrcWithCleanup('');
        setIsVideoLoading(false);
      }
    };

    const loadVideoStream = async (streamInfo: {
      filePath: string;
      size: number;
      mimeType: string;
    }) => {
      try {
        const chunkSize = 50 * 1024 * 1024; // 50MB chunks
        const chunks: Uint8Array[] = [];

        for (let start = 0; start < streamInfo.size; start += chunkSize) {
          const end = Math.min(start + chunkSize, streamInfo.size);
          const chunkResult = await window.downlodrFunctions.getVideoChunk(
            streamInfo.filePath,
            start,
            end,
          );

          if (!chunkResult) {
            throw new Error('Failed to load video chunk');
          }

          // Create a new Uint8Array to ensure proper ArrayBuffer
          const chunk = new Uint8Array(chunkResult.bytesRead);
          chunk.set(new Uint8Array(chunkResult.data));
          chunks.push(chunk);
        }

        const blobParts = chunks.map(
          (chunk) => chunk.slice().buffer as ArrayBuffer,
        );
        const blob = new Blob(blobParts, { type: streamInfo.mimeType });
        const url = URL.createObjectURL(blob);
        setVideoSrcWithCleanup(url);
        setIsVideoLoading(false);
      } catch (error) {
        console.error('Error loading video stream:', error);
        setVideoSrcWithCleanup('');
        setIsVideoLoading(false);
      }
    };

    loadVideo();
  }, [selectedDownload, setVideoSrcWithCleanup]);

  useEffect(() => {
    return () => {
      if (videoSrc && videoSrc.startsWith('blob:')) {
        URL.revokeObjectURL(videoSrc);
      }
    };
  }, [videoSrc]);
  */

  // Initialize state with computed values once (avoid duplicating on every change)
  useEffect(() => {
    if (Object.keys(groups).length === 0 && Object.keys(allGroups).length > 0) {
      setGroups(allGroups);
    }
  }, [allGroups, groups]);

  useEffect(() => {
    // Only auto-set activeTab if it hasn't been manually set by the user
    if (activeTabManuallySetRef.current) {
      return;
    }

    if (
      unmergedAISuggestionGroups &&
      Object.keys(unmergedAISuggestionGroups).length > 0
    ) {
      // Go to the first AI suggestion category (prefer non-Uncategorized)
      const categories = Object.keys(unmergedAISuggestionGroups);
      const firstNonUncategorized = categories.find(
        (cat) => cat !== UNCATEGORIZED_NAME,
      );
      const targetCategory = firstNonUncategorized || UNCATEGORIZED_NAME;

      setActiveTab(targetCategory);
      setViewedGroup(targetCategory);
      setIsCategorySelected(true);
    } else if (initialGroups && Object.keys(initialGroups).length > 0) {
      const firstCategory = Object.keys(initialGroups)[0];
      setActiveTab(firstCategory);
      setViewedGroup(firstCategory);
      setIsCategorySelected(true);
    }
  }, [unmergedAISuggestionGroups, initialGroups]);

  // 🔹 Automatically hide after 3 seconds
  useEffect(() => {
    if (isShowNotification) {
      const timer = setTimeout(() => {
        setShowNotification(false);
      }, 5000); // 3 seconds

      return () => clearTimeout(timer); // cleanup on unmount or re-trigger
    }
  }, [isShowNotification]);

  // Enhanced validation function for category names
  const validateCategoryName = useCallback(
    (name: string): { isValid: boolean; error?: string } => {
      const trimmedName = name.trim();

      // Check if empty
      if (!trimmedName) {
        return {
          isValid: false,
          error: 'Category name cannot be empty',
        };
      }

      // Check length limits
      if (trimmedName.length > 50) {
        return {
          isValid: false,
          error: 'Category name must be 50 characters or less',
        };
      }

      if (trimmedName.length < 2) {
        return {
          isValid: false,
          error: 'Category name must be at least 2 characters',
        };
      }

      // Check for reserved names
      const reservedNames = [
        'Uncategorized',
        'All',
        'Default',
        'New',
        'Temp',
        'Temporary',
      ];
      if (
        reservedNames.some(
          (reserved) => reserved.toLowerCase() === trimmedName.toLowerCase(),
        )
      ) {
        return {
          isValid: false,
          error: `"${trimmedName}" is a reserved name and cannot be used`,
        };
      }

      // Check for invalid characters
      const invalidChars = /[<>:"/\\|?*]/;
      if (invalidChars.test(trimmedName)) {
        return {
          isValid: false,
          error:
            'Category name contains invalid characters (< > : " / \\ | ? *)',
        };
      }

      // Check if starts or ends with dots or spaces (problematic for file systems)
      if (
        trimmedName.startsWith('.') ||
        trimmedName.endsWith('.') ||
        trimmedName.startsWith(' ') ||
        trimmedName.endsWith(' ')
      ) {
        return {
          isValid: false,
          error: 'Category name cannot start or end with dots or spaces',
        };
      }

      return { isValid: true };
    },
    [],
  );

  const handleConfirmRenameCategory = useCallback(() => {
    const trimmedName = renameCategoryName.trim();
    const oldName = categoryBeingRenamed;

    // Validate the new name
    const validation = validateCategoryName(trimmedName);
    if (!validation.isValid) {
      toast({
        title: 'Invalid Category Name',
        description: validation.error,
        variant: 'destructive',
        duration: 5000,
      });
      return;
    }

    // Don't do anything if names are the same
    if (trimmedName === oldName) {
      setShowRenameCategoryInput(false);
      setRenameCategoryName('');
      return;
    }

    // Check if new name already exists (case-insensitive)
    const existingNames = Object.keys(groups);
    const nameExists = existingNames.some(
      (name) =>
        name.toLowerCase() === trimmedName.toLowerCase() && name !== oldName,
    );

    if (nameExists) {
      toast({
        title: 'Category Already Exists',
        description: `A category with the name "${trimmedName}" already exists`,
        variant: 'destructive',
        duration: 5000,
      });
      return;
    }

    // Get videos before updating state
    const videosInCategory = groups[oldName] || [];

    // Update groups state
    setGroups((prevGroups) => {
      const newGroups = { ...prevGroups };

      // Only proceed if old category exists
      if (newGroups[oldName]) {
        // Create new category with videos
        newGroups[trimmedName] = [...newGroups[oldName]];
        // Delete old category
        delete newGroups[oldName];
      }

      return newGroups;
    });

    // Update category contexts to preserve context for renamed category
    setLocalCategoryContexts((prevContexts) => {
      const newContexts = { ...prevContexts };

      // If the old category had a context, move it to the new category name
      if (newContexts[oldName]) {
        newContexts[trimmedName] = newContexts[oldName];
        delete newContexts[oldName];
      }

      return newContexts;
    });

    // Update active tab if it was the renamed category
    if (activeTab === oldName) {
      setActiveTab(trimmedName);
      setViewedGroup(trimmedName);
    }

    // Show success message with details
    const videoCount = videosInCategory.length;
    const successMessage =
      videoCount > 0
        ? `Category renamed from "${oldName}" to "${trimmedName}"`
        : `Category renamed from "${oldName}" to "${trimmedName}"`;

    // Store undo operation
    setLastRenameOperation({
      oldName,
      newName: trimmedName,
      timestamp: Date.now(),
      videos: videosInCategory,
    });

    toast({
      title: 'Category Renamed',
      description: successMessage,
      duration: 5000,
    });

    setShowRenameCategoryInput(false);
    setRenameCategoryName('');
    setCategoryBeingRenamed('');

    // NOTE: Removed immediate download store updates - changes will be applied when user clicks "Apply"
    // The category rename is now only reflected in the local UI state until Apply is clicked
  }, [renameCategoryName, categoryBeingRenamed, groups, activeTab]);

  const handleCancelRenameCategory = useCallback(() => {
    setShowRenameCategoryInput(false);
    setRenameCategoryName('');
    setCategoryBeingRenamed('');
  }, []);

  // Function to perform category rename (used by CategoryContextMenu)
  const performCategoryRename = useCallback(
    (oldName: string, newName: string) => {
      const trimmedName = newName.trim();

      // Validate the new name
      const validation = validateCategoryName(trimmedName);
      if (!validation.isValid) {
        toast({
          title: 'Invalid Category Name',
          description: validation.error,
          variant: 'destructive',
          duration: 5000,
        });
        return;
      }

      // Don't do anything if names are the same
      if (trimmedName === oldName) {
        return;
      }

      // Check if new name already exists (case-insensitive)
      const existingNames = Object.keys(groups);
      const nameExists = existingNames.some(
        (name) =>
          name.toLowerCase() === trimmedName.toLowerCase() && name !== oldName,
      );

      if (nameExists) {
        toast({
          title: 'Category Already Exists',
          description: `A category with the name "${trimmedName}" already exists`,
          variant: 'destructive',
          duration: 5000,
        });
        return;
      }

      // Get videos before updating state
      const videosInCategory = groups[oldName] || [];

      // Update groups state
      setGroups((prevGroups) => {
        const newGroups = { ...prevGroups };

        // Only proceed if old category exists
        if (newGroups[oldName]) {
          // Create new category with videos
          newGroups[trimmedName] = [...newGroups[oldName]];
          // Delete old category
          delete newGroups[oldName];
        }

        return newGroups;
      });

      // Update category contexts to preserve context for renamed category
      setLocalCategoryContexts((prevContexts) => {
        const newContexts = { ...prevContexts };

        // If the old category had a context, move it to the new category name
        if (newContexts[oldName]) {
          newContexts[trimmedName] = newContexts[oldName];
          delete newContexts[oldName];
        }

        return newContexts;
      });

      // Update active tab if it was the renamed category
      if (activeTab === oldName) {
        setActiveTab(trimmedName);
      }

      // Update viewedGroup if it was the renamed category
      if (viewedGroup === oldName) {
        setViewedGroup(trimmedName);
      }

      // Show success message with details
      const videoCount = videosInCategory.length;
      const successMessage =
        videoCount > 0
          ? `Category renamed from "${oldName}" to "${trimmedName}"`
          : `Category renamed from "${oldName}" to "${trimmedName}"`;

      // Store undo operation
      setLastRenameOperation({
        oldName,
        newName: trimmedName,
        timestamp: Date.now(),
        videos: videosInCategory,
      });

      toast({
        title: 'Category Renamed',
        description: successMessage,
        duration: 5000,
      });
    },
    [groups, activeTab, viewedGroup, validateCategoryName],
  );

  // Inline rename handlers
  const startInlineRename = useCallback((categoryName: string) => {
    if (categoryName === UNCATEGORIZED_NAME) return; // Don't allow renaming Uncategorized
    setInlineRenamingCategory(categoryName);
    setInlineRenameValue(categoryName);
  }, []);

  const cancelInlineRename = useCallback(() => {
    setInlineRenamingCategory(null);
    setInlineRenameValue('');
  }, []);

  const confirmInlineRename = useCallback(() => {
    if (!inlineRenamingCategory) return;

    const trimmedValue = inlineRenameValue.trim();

    // If no change, just cancel
    if (trimmedValue === inlineRenamingCategory) {
      cancelInlineRename();
      return;
    }

    // Validate the new name
    const validation = validateCategoryName(trimmedValue);
    if (!validation.isValid) {
      toast({
        title: 'Invalid Category Name',
        description: validation.error,
        variant: 'destructive',
        duration: 5000,
      });
      return;
    }

    // Check if new name already exists (case-insensitive) in both AI suggestions and merged categories
    const existingNames = [
      ...Object.keys(unmergedAISuggestionGroups),
      ...Object.keys(mergedCategoryGroups),
    ];
    const nameExists = existingNames.some(
      (name) =>
        name.toLowerCase() === trimmedValue.toLowerCase() &&
        name !== inlineRenamingCategory,
    );

    if (nameExists) {
      toast({
        title: 'Category Already Exists',
        description: `A category with the name "${trimmedValue}" already exists`,
        variant: 'destructive',
        duration: 5000,
      });
      return;
    }

    // Update the renamed AI suggestions mapping
    setRenamedAISuggestions((prev) => ({
      ...prev,
      [inlineRenamingCategory]: trimmedValue,
    }));

    // Update active tab if needed
    if (activeTab === inlineRenamingCategory) {
      setActiveTab(trimmedValue);
      setViewedGroup(trimmedValue);
    }

    // Store undo operation
    const videosInCategory =
      unmergedAISuggestionGroups[inlineRenamingCategory] || [];
    setLastRenameOperation({
      oldName: inlineRenamingCategory,
      newName: trimmedValue,
      timestamp: Date.now(),
      videos: videosInCategory,
    });

    toast({
      title: 'Category Renamed Successfully',
      description: `Category renamed from "${inlineRenamingCategory}" to "${trimmedValue}"`,
      duration: 5000,
    });

    cancelInlineRename();
  }, [
    inlineRenamingCategory,
    inlineRenameValue,
    unmergedAISuggestionGroups,
    mergedCategoryGroups,
    validateCategoryName,
    activeTab,
    setActiveTab,
    cancelInlineRename,
  ]);

  const handleCategoryDoubleClick = useCallback(
    (categoryName: string) => {
      startInlineRename(categoryName);
    },
    [startInlineRename],
  );

  const handleCategoryKeyDown = useCallback(
    (e: React.KeyboardEvent, categoryName: string) => {
      if (e.key === 'F2') {
        e.preventDefault();
        startInlineRename(categoryName);
      }
    },
    [startInlineRename],
  );

  // Auto-clear undo after 30 seconds
  useEffect(() => {
    if (lastRenameOperation) {
      const timer = setTimeout(() => {
        setLastRenameOperation(null);
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [lastRenameOperation]);

  // Click outside detection for context menus and modals
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      // Check if click is outside context menu
      if (contextMenu.visible && !showCategorySidebar) {
        const contextMenuElement = document.querySelector(
          '[data-context-menu]',
        );
        if (contextMenuElement && !contextMenuElement.contains(target)) {
          closeContextMenu();
        }
      }

      // Check if click is outside category navigation context menu
      if (categoryNavContextMenu.visible) {
        const categoryNavMenuElement = document.querySelector(
          '[data-category-nav-context-menu]',
        );
        if (
          categoryNavMenuElement &&
          !categoryNavMenuElement.contains(target)
        ) {
          closeCategoryNavContextMenu();
        }
      }

      // Check if click is outside category sidebar
      if (showCategorySidebar) {
        const categorySidebarElement = document.querySelector(
          '[data-category-sidebar]',
        );
        if (
          categorySidebarElement &&
          !categorySidebarElement.contains(target)
        ) {
          setShowCategorySidebar(false);
          closeContextMenu();
        }
      }
    };

    // Add event listener when any menu/modal is visible
    if (
      contextMenu.visible ||
      categoryNavContextMenu.visible ||
      showCategorySidebar
    ) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [
    contextMenu.visible,
    categoryNavContextMenu.visible,
    showCategorySidebar,
    closeContextMenu,
    closeCategoryNavContextMenu,
  ]);

  // ESC key detection for modals and menus
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Close modals and menus in order of priority
        if (showNewCategoryInput) {
          handleCancelNewCategory();
        } else if (showRenameCategoryInput) {
          handleCancelRenameCategory();
        } else if (showCategorySidebar) {
          setShowCategorySidebar(false);
        } else if (contextMenu.visible) {
          closeContextMenu();
        } else if (categoryNavContextMenu.visible) {
          closeCategoryNavContextMenu();
        }
      }
    };

    // Add event listener when any modal or menu is visible
    if (
      showNewCategoryInput ||
      showRenameCategoryInput ||
      showCategorySidebar ||
      contextMenu.visible ||
      categoryNavContextMenu.visible
    ) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => {
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [
    showNewCategoryInput,
    showRenameCategoryInput,
    showCategorySidebar,
    contextMenu.visible,
    categoryNavContextMenu.visible,
  ]);

  const handleDeleteCategory = useCallback(
    (categoryName?: string) => {
      const category = categoryName || categoryNavContextMenu.categoryName;
      setCategoryToDelete(category);
      setShowDeleteConfirmation(true);
    },
    [categoryNavContextMenu.categoryName],
  );

  const confirmDeleteCategory = useCallback(
    (categoryName: string) => {
      const videosInCategory = groups[categoryName] || [];
      setGroups((prevGroups) => {
        const newGroups = { ...prevGroups };

        // Move videos to Uncategorized if they exist
        if (videosInCategory.length > 0) {
          if (!newGroups[UNCATEGORIZED_NAME]) {
            newGroups[UNCATEGORIZED_NAME] = [];
          }

          // Add videos to Uncategorized (prevent duplicates)
          videosInCategory.forEach((video) => {
            // Check if video (by ID) already exists in Uncategorized
            if (
              !newGroups[UNCATEGORIZED_NAME].some(
                (existingVideo) => existingVideo.video_id === video.video_id,
              )
            ) {
              newGroups[UNCATEGORIZED_NAME].push(video);
            }
          });
        }

        // Delete the category
        delete newGroups[categoryName];

        return newGroups;
      });

      // NOTE: Removed immediate download store updates - changes will be applied when user clicks "Apply"

      // Switch to first available category or Uncategorized
      if (activeTab === categoryName) {
        const remainingCategories = Object.keys(groups).filter(
          (name) => name !== categoryName,
        );
        if (remainingCategories.length > 0) {
          setActiveTab(remainingCategories[0]);
          setViewedGroup(remainingCategories[0]);
          setIsCategorySelected(true);
        } else if (videosInCategory.length > 0) {
          setActiveTab(UNCATEGORIZED_NAME);
          setViewedGroup(UNCATEGORIZED_NAME);
          setIsCategorySelected(true);
        } else {
          setActiveTab('');
          setViewedGroup(null);
          setIsCategorySelected(false);
        }
      }
      // Switch back to organization table view if not viewing a category
      if (activeTab !== categoryName) {
        setViewedGroup(null);
        setIsFolderView(true);
        setIsCategorySelected(false);
      }

      // Show toast notification
      toast({
        title: 'Category Deleted',
        description:
          videosInCategory.length > 0
            ? `Deleted "${categoryName}" and moved ${videosInCategory.length} video(s) to Uncategorized`
            : `Deleted empty category "${categoryName}"`,
        duration: 5000,
      });

      closeCategoryNavContextMenu();
      setShowDeleteConfirmation(false);
      setCategoryToDelete(null);
    },
    [
      groups,
      activeTab,
      closeCategoryNavContextMenu,
      setViewedGroup,
      setIsFolderView,
      setIsCategorySelected,
    ],
  );

  // Helper function to merge suggested categories with existing my categories
  const mergeCategoriesWithExisting = useCallback(
    (
      suggestedGroups: Record<string, VideoLite[]>,
    ): {
      mergedGroups: Record<string, VideoLite[]>;
      newVideosCount: Record<string, number>;
    } => {
      const categoriesToRemove: string[] = [];
      const newVideosCount: Record<string, number> = {};
      const mergedGroups = { ...groups };

      Object.entries(suggestedGroups).forEach(
        ([suggestedCategoryName, suggestedVideos]) => {
          if (suggestedCategoryName === UNCATEGORIZED_NAME) return;

          const matchingMyCategory = availableCategories.find(
            (myCategory) =>
              myCategory.toLowerCase() === suggestedCategoryName.toLowerCase(),
          );

          const targetCategory = matchingMyCategory ?? suggestedCategoryName;

          // Ensure category exists in merged groups
          if (!mergedGroups[targetCategory]) {
            mergedGroups[targetCategory] = [];
          }

          const existingIds = new Set(
            mergedGroups[targetCategory].map((v) => v.video_id),
          );

          const videosToAdd = suggestedVideos
            .filter((video) => !existingIds.has(video.video_id))
            .map((video) => ({
              video_id: video.video_id,
              video_title: video.video_title,
            }));

          mergedGroups[targetCategory].push(...videosToAdd);

          if (matchingMyCategory) {
            newVideosCount[matchingMyCategory] = suggestedVideos.length;

            categoriesToRemove.push(suggestedCategoryName);
          }
        },
      );

      // Remove merged categories from suggested groups
      categoriesToRemove.forEach((categoryName) => {
        delete mergedGroups[categoryName];
      });

      return { mergedGroups, newVideosCount };
    },
    [availableCategories, finishedDownloads],
  );

  // Update groups when initialGroups prop changes
  useEffect(() => {
    // Only clear toasted categories when initialGroups actually changes
    const initialGroupsChanged =
      JSON.stringify(prevInitialGroupsRef.current) !==
      JSON.stringify(initialGroups);
    if (initialGroupsChanged) {
      toastedCategoriesRef.current.clear();
      prevInitialGroupsRef.current = initialGroups;
    }

    if (initialGroups && Object.keys(initialGroups).length > 0) {
      // Debug the structure of initialGroups
      Object.entries(initialGroups).forEach(([categoryName, videos]) => {
        if (Array.isArray(videos)) {
          videos.forEach((video, index) => {
            if (!video.video_title || video.video_title.trim() === '') {
              console.warn(
                `Empty or invalid video title at index ${index} in category "${categoryName}":`,
                video,
              );
            }
          });
        } else {
          console.warn(
            `Invalid video titles format for category "${categoryName}":`,
            videos,
          );
        }
      });

      // First, merge suggested categories with existing my categories
      const { mergedGroups, newVideosCount } =
        mergeCategoriesWithExisting(initialGroups);

      // Update the new videos count state (shows how many videos AI categorized into each existing category)
      setNewVideosInMyCategories(newVideosCount);

      // Combine AI suggestions (after merging) with merged categories
      const updatedAIGroups = buildAISuggestionGroups(mergedGroups);
      const combinedGroups: Record<string, VideoLite[]> = {};

      const allCategoryNames = new Set([
        ...Object.keys(updatedAIGroups),
        ...Object.keys(mergedCategoryGroups),
      ]);

      allCategoryNames.forEach((categoryName) => {
        const aiVideos = updatedAIGroups[categoryName] || [];
        const mergedVideos = mergedCategoryGroups[categoryName] || [];
        const allVideos = [...aiVideos, ...mergedVideos];
        const uniqueVideos = allVideos.filter(
          (video, index, self) =>
            index === self.findIndex((v) => v.video_id === video.video_id),
        );

        if (uniqueVideos.length > 0) {
          combinedGroups[categoryName] = uniqueVideos;
        }
      });
      setGroups(combinedGroups);
      // Set first group as active tab only if not manually set
      if (
        !activeTabManuallySetRef.current &&
        Object.keys(groups).length === 0
      ) {
        const firstGroupName =
          Object.keys(mergedGroups).length > 0
            ? Object.keys(mergedGroups)[0]
            : UNCATEGORIZED_NAME;
        setActiveTab(firstGroupName);
        setViewedGroup(firstGroupName);
        setIsCategorySelected(true);
      }
    }
  }, [
    initialGroups,
    finishedDownloads,
    mergeCategoriesWithExisting,
    mergedCategoryGroups,
    buildAISuggestionGroups,
  ]);

  // Reset checkboxes when switching between categories
  useEffect(() => {
    resetCheckboxes();
  }, [activeTab]);

  const handleReset = () => {
    closeCategoryNavContextMenu();
    closeContextMenu();
    resetCheckboxes();
    setShowCategorySidebar(false);

    setShowNewCategoryInput(false);
    setNewCategoryName('');
    setIsCreatingFromAddNew(false);
    // Rename category state
    setShowRenameCategoryInput(false);
    setRenameCategoryName('');
    setCategoryBeingRenamed('');
    // Inline rename state
    setInlineRenamingCategory(null);
    setInlineRenameValue('');
    // Undo state
    setLastRenameOperation(null);
  };

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [onClose]);

  // Calculate submenu position to prevent viewport overflow
  const calculateSubmenuPosition = useCallback(() => {
    const itemCount = Object.keys(groups).filter(
      (category) => category !== contextMenu.currentCategory,
    ).length;

    let submenuX = contextMenu.x + 120;
    let submenuY = Math.max(10, contextMenu.y - 20);

    // Calculate submenu dimensions
    const headerHeight = 60;
    const maxListHeight = 192;
    const actualListHeight = Math.min(itemCount * 40, maxListHeight);
    const submenuHeight = headerHeight + actualListHeight;
    const submenuWidth = 140;

    // Adjust for viewport overflow
    if (submenuY + submenuHeight > window.innerHeight - 10) {
      submenuY = Math.max(10, window.innerHeight - submenuHeight - 10);
    }
    if (submenuX + submenuWidth > window.innerWidth) {
      submenuX = contextMenu.x - submenuWidth - 20;
    }

    setSubmenuPosition({ x: submenuX, y: submenuY });
  }, [groups, contextMenu.currentCategory, contextMenu.x, contextMenu.y]);

  const moveVideoToCategory = useCallback(
    (
      video: {
        video_id: string;
        video_title: string;
      },
      fromCategory: string,
      toCategory: string,
    ) => {
      if (!video.video_id || video.video_id.trim() === '') {
        console.error('Cannot move video: video ID is empty or undefined');
        return;
      }

      // Record undo operation
      const liteVideo = toVideoLite(video);
      setUndoStack((prev) => [
        ...prev,
        {
          type: 'move_video',
          video: liteVideo,
          fromCategory: toCategory, // Reverse for undo
          toCategory: fromCategory, // Reverse for undo
        },
      ]);

      setGroups((prevGroups) => {
        const newGroups = { ...prevGroups };

        // Remove from source category
        if (fromCategory && newGroups[fromCategory]) {
          newGroups[fromCategory] = newGroups[fromCategory].filter(
            (v) => v.video_id !== video.video_id,
          );
        }

        // Add to destination category (prevent duplicates)
        if (!newGroups[toCategory]) {
          newGroups[toCategory] = [];
        }

        if (
          !newGroups[toCategory].some(
            (existingVideo) => existingVideo.video_id === video.video_id,
          )
        ) {
          newGroups[toCategory].push(liteVideo);
        }

        return newGroups;
      });

      // Check if source category becomes empty and switch tabs if needed
      setGroups((currentGroups) => {
        if (
          fromCategory &&
          currentGroups[fromCategory] &&
          currentGroups[fromCategory].length === 0 &&
          activeTab === fromCategory
        ) {
          // Source category is now empty and is the active tab, switch to a different view
          const remainingCategories = Object.keys(currentGroups).filter(
            (name) => name !== fromCategory && currentGroups[name].length > 0,
          );

          if (remainingCategories.length > 0) {
            setActiveTab(remainingCategories[0]);
            setViewedGroup(remainingCategories[0]);
            setIsCategorySelected(true);
          } else {
            // No other categories with videos, switch to All Videos
            setActiveTab('All Videos');
            setViewedGroup(null);
            setIsCategorySelected(false);
          }
        }

        return currentGroups;
      });
    },
    [toVideoLite],
  );

  // Bulk category management functions
  const moveVideosToCategory = useCallback(
    (videoIds: string[], targetCategory: string, sourceCategory?: string) => {
      // If sourceCategory is provided, use the more efficient source-based logic (like drag and drop)
      if (sourceCategory && groups[sourceCategory]) {
        const targetExistingIds = new Set(
          (groups[targetCategory] || []).map((video) => video.video_id),
        );
        const addedCount = videoIds.filter(
          (id) => !targetExistingIds.has(id),
        ).length;

        const sourceVideos = groups[sourceCategory];
        const remainingIds = new Set(videoIds);

        sourceVideos.forEach((video) => {
          if (!remainingIds.has(video.video_id)) return;
          remainingIds.delete(video.video_id);
          moveVideoToCategory(video, sourceCategory, targetCategory);
        });

        // Handle any remaining IDs that weren't in the source category
        if (remainingIds.size > 0) {
          const remainingVideosToMove = Array.from(remainingIds)
            .map((id) => {
              // Find the video in any category
              for (const [categoryName, videos] of Object.entries(groups)) {
                const video = videos.find((v) => v.video_id === id);
                if (video) {
                  return { video, fromCategory: categoryName };
                }
              }
              return null;
            })
            .filter(Boolean);

          remainingVideosToMove.forEach(({ video, fromCategory }) => {
            moveVideoToCategory(video, fromCategory, targetCategory);
          });
        }

        if (availableCategories.includes(targetCategory) && addedCount > 0) {
          setNewVideosInMyCategories((prev) => ({
            ...prev,
            [targetCategory]: (prev[targetCategory] || 0) + addedCount,
          }));
        }

        // Navigate to the target category
        activeTabManuallySetRef.current = true;
        setActiveTab(targetCategory);
        setIsCategorySelected(true);
        setViewedGroup(targetCategory);
        return;
      }

      // Fallback to original logic when no sourceCategory is provided
      const targetExistingIds = new Set(
        (groups[targetCategory] || []).map((video) => video.video_id),
      );
      const addedCount = videoIds.filter(
        (id) => !targetExistingIds.has(id),
      ).length;

      const videosToMove = videoIds
        .map((id) => {
          // Find the video in any category
          for (const [categoryName, videos] of Object.entries(groups)) {
            const video = videos.find((v) => v.video_id === id);
            if (video) {
              return { video, fromCategory: categoryName };
            }
          }
          return null;
        })
        .filter(Boolean);

      videosToMove.forEach(({ video, fromCategory }) => {
        moveVideoToCategory(video, fromCategory, targetCategory);
      });

      if (availableCategories.includes(targetCategory) && addedCount > 0) {
        setNewVideosInMyCategories((prev) => ({
          ...prev,
          [targetCategory]: (prev[targetCategory] || 0) + addedCount,
        }));
      }

      // Navigate to the target category
      activeTabManuallySetRef.current = true;
      setActiveTab(targetCategory);
      setIsCategorySelected(true);
      setViewedGroup(targetCategory);
    },
    [groups, moveVideoToCategory, availableCategories],
  );

  const moveVideosToCategoryFromSource = useCallback(
    (videoIds: string[], targetCategory: string, sourceCategory?: string) => {
      if (!sourceCategory || !groups[sourceCategory]) {
        moveVideosToCategory(videoIds, targetCategory);
        return;
      }

      const sourceVideos = groups[sourceCategory];
      const remainingIds = new Set(videoIds);

      sourceVideos.forEach((video) => {
        if (!remainingIds.has(video.video_id)) return;
        remainingIds.delete(video.video_id);
        moveVideoToCategory(video, sourceCategory, targetCategory);
      });

      if (remainingIds.size > 0) {
        moveVideosToCategory(Array.from(remainingIds), targetCategory);
      }
    },
    [groups, moveVideoToCategory, moveVideosToCategory],
  );

  const handleDropVideosToCategory = useCallback(
    (videoIds: string[], targetCategory: string, sourceCategory?: string) => {
      if (videoIds.length === 0) return;

      moveVideosToCategoryFromSource(videoIds, targetCategory, sourceCategory);

      toast({
        title: 'Videos Moved',
        description: `Moved ${videoIds.length} video(s) to "${targetCategory}"`,
        duration: 5000,
      });
    },
    [moveVideosToCategoryFromSource],
  );

  const removeVideosFromCategory = useCallback(
    (videoIds: string[], fromCategory: string) => {
      moveVideosToCategory(videoIds, UNCATEGORIZED_NAME);
    },
    [moveVideosToCategory],
  );

  const addVideosToNewCategory = useCallback(
    (videoIds: string[], newCategoryName: string) => {
      // Create the new category first
      setGroups((prevGroups) => {
        const newGroups = { ...prevGroups };
        if (!newGroups[newCategoryName]) {
          newGroups[newCategoryName] = [];
        }
        return newGroups;
      });

      // Then move the videos to it
      moveVideosToCategory(videoIds, newCategoryName);

      // Auto-open the new category
      activeTabManuallySetRef.current = true;
      setActiveTab(newCategoryName);
      setViewedGroup(newCategoryName);
      setIsCategorySelected(true);
    },
    [moveVideosToCategory],
  );

  const createNewCategory = useCallback((categoryName: string) => {
    setGroups((prevGroups) => {
      const newGroups = { ...prevGroups };
      if (!newGroups[categoryName]) {
        newGroups[categoryName] = [];
      }
      return newGroups;
    });
  }, []);

  // Undo function
  const undoLastOperation = useCallback(() => {
    if (undoStack.length === 0) {
      toast({
        title: 'Nothing to undo',
        description: 'No recent operations to undo',
        duration: 5000,
      });
      return;
    }

    const lastOperation = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1)); // Remove from undo stack

    if (lastOperation.type === 'move_video') {
      // Directly move without recording to undo stack
      setGroups((prevGroups) => {
        const newGroups = { ...prevGroups };

        // Remove from current category (where it was moved to)
        if (
          lastOperation.fromCategory &&
          newGroups[lastOperation.fromCategory]
        ) {
          newGroups[lastOperation.fromCategory] = newGroups[
            lastOperation.fromCategory
          ].filter((v) => v.video_id !== lastOperation.video.video_id);
        }

        // Add back to original category
        if (!newGroups[lastOperation.toCategory]) {
          newGroups[lastOperation.toCategory] = [];
        }

        if (
          !newGroups[lastOperation.toCategory].some(
            (existingVideo) =>
              existingVideo.video_id === lastOperation.video.video_id,
          )
        ) {
          newGroups[lastOperation.toCategory].push(lastOperation.video);
        }

        return newGroups;
      });

      toast({
        title: 'Undone',
        description: `Moved "${lastOperation.video.video_title}" back`,
        duration: 5000,
      });
    }
  }, [undoStack]);

  // Keyboard shortcuts for undo (Ctrl+Z)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
        event.preventDefault();
        undoLastOperation();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [undoLastOperation]);

  const handleMoveToCategory = useCallback(() => {
    calculateSubmenuPosition();
    setShowCategorySidebar(true);
  }, [calculateSubmenuPosition]);

  const handleAddNewCategory = useCallback(() => {
    setIsCreatingFromAddNew(true);
    setShowNewCategoryInput(true);
    closeContextMenu();
  }, [closeContextMenu]);

  // Handler for folder group clicks
  const handleGroupClick = useCallback(
    (
      groupName: string,
      videos: { video_id: string; video_title: string }[],
    ) => {
      setIsCategorySelected(true);
      activeTabManuallySetRef.current = true;
      setActiveTab(groupName);
      setViewedGroup(groupName);
    },
    [],
  );

  const handleCreateNewCategory = () => {
    if (newCategoryName && newCategoryName.trim()) {
      const trimmedName = newCategoryName.trim();
      // Don't create if it's the same category name as current
      if (trimmedName === contextMenu.currentCategory) {
        toast({
          title: 'Category Already Exists',
          description: `Video is already in category "${trimmedName}"`,
          duration: 5000,
        });
        setNewCategoryName('');
        setShowNewCategoryInput(false);
        return;
      }

      // Check if category already exists
      if (groups[trimmedName]) {
        toast({
          title: 'Category Already Exists',
          description: `Category "${trimmedName}" already exists. Use "Move to Category" instead.`,
          variant: 'destructive',
          duration: 5000,
        });
        return;
      }
      // Validate that we have a valid video title
      if (
        !contextMenu.video.video_id ||
        contextMenu.video.video_id.trim() === ''
      ) {
        setShowNotification(true);
        setNotificationVal(
          'No video selected. Please try right-clicking on a video first.',
        );
        setNewCategoryName('');
        setShowNewCategoryInput(false);
        return;
      }

      // NOTE: Removed immediate download store updates - changes will be applied when user clicks "Apply"

      // Update the groups state using helper function
      moveVideoToCategory(
        contextMenu.video,
        contextMenu.currentCategory,
        trimmedName,
      );
      setShowNotification(true);
      setNotificationVal(
        `Created category "${trimmedName}" and moved "${contextMenu.video.video_title}"`,
      );
      // Reset and close
      setNewCategoryName('');
      setShowNewCategoryInput(false);
      setIsCreatingFromAddNew(false);
    }
  };

  const handleCancelNewCategory = () => {
    setNewCategoryName('');
    setShowNewCategoryInput(false);
    setIsCreatingFromAddNew(false);
  };

  // Auto-create new category and move checked videos or create empty if none checked
  const handleCreateNewCategoryAuto = () => {
    if (newCategoryName && newCategoryName.trim()) {
      const trimmedName = newCategoryName.trim();

      // Check if category already exists
      if (groups[trimmedName]) {
        toast({
          title: 'Category Already Exists',
          description: `Category "${trimmedName}" already exists.`,
          variant: 'destructive',
          duration: 5000,
        });
        return;
      }

      const checkedVideoObjects = Array.from(checkedVideos).map((videoId) => {
        const download = finishedDownloads.find((d) => d.id === videoId);
        return {
          video_id: videoId,
          video_title: download?.downloadName || videoId,
        };
      });

      let videosMovedCount = 0;

      // Create new category with checked videos or empty
      setGroups((prevGroups) => {
        const newGroups = { ...prevGroups };

        // Create the new category
        newGroups[trimmedName] = [];

        // Move checked video objects to the new category
        if (checkedVideoObjects.length > 0) {
          checkedVideoObjects.forEach((video) => {
            // Find and remove from current category (by video_id)
            Object.keys(newGroups).forEach((categoryName) => {
              if (
                categoryName !== trimmedName &&
                newGroups[categoryName].some(
                  (v) => v.video_id === video.video_id,
                )
              ) {
                newGroups[categoryName] = newGroups[categoryName].filter(
                  (v) => v.video_id !== video.video_id,
                );
              }
            });

            // Add to new category (prevent duplicates by video_id)
            if (
              !newGroups[trimmedName].some((v) => v.video_id === video.video_id)
            ) {
              newGroups[trimmedName].push(toVideoLite(video));
              videosMovedCount++;
            }
          });

          // NOTE: Removed immediate download store updates - changes will be applied when user clicks "Apply"
        }

        return newGroups;
      });

      // Set the new category as active tab
      activeTabManuallySetRef.current = true;
      setActiveTab(trimmedName);
      setViewedGroup(trimmedName);
      setIsCategorySelected(true);

      // Reset checkboxes
      resetCheckboxes();

      // Show appropriate toast message
      if (videosMovedCount > 0) {
        setShowNotification(true);
        setNotificationVal(
          `Created category "${trimmedName}" and moved ${videosMovedCount} video(s)`,
        );
      } else {
        setShowNotification(true);
        setNotificationVal(`Created empty category "${trimmedName}"`);
      }

      // Reset and close
      setNewCategoryName('');
      setShowNewCategoryInput(false);
      setIsCreatingFromAddNew(false);
    }
  };

  const handleCreateNewCategoryAutoWithName = (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    // Check if category already exists
    if (groups[trimmedName]) {
      toast({
        title: 'Category Already Exists',
        description: `Category "${trimmedName}" already exists.`,
        variant: 'destructive',
        duration: 5000,
      });
      return;
    }

    const checkedVideoObjects = Array.from(checkedVideos).map((videoId) => {
      const download = finishedDownloads.find((d) => d.id === videoId);
      return {
        video_id: videoId,
        video_title: download?.downloadName || videoId,
      };
    });

    let videosMovedCount = 0;

    setGroups((prevGroups) => {
      const newGroups = { ...prevGroups };

      // Create new category
      newGroups[trimmedName] = [];

      // Move checked videos
      if (checkedVideoObjects.length > 0) {
        checkedVideoObjects.forEach((video) => {
          Object.keys(newGroups).forEach((categoryName) => {
            if (
              categoryName !== trimmedName &&
              newGroups[categoryName].some((v) => v.video_id === video.video_id)
            ) {
              newGroups[categoryName] = newGroups[categoryName].filter(
                (v) => v.video_id !== video.video_id,
              );
            }
          });

          if (
            !newGroups[trimmedName].some((v) => v.video_id === video.video_id)
          ) {
            newGroups[trimmedName].push(toVideoLite(video));
            videosMovedCount++;
          }
        });
      }

      return newGroups;
    });

    activeTabManuallySetRef.current = true;
    setActiveTab(trimmedName);
    setViewedGroup(trimmedName);
    setIsCategorySelected(true);

    resetCheckboxes();

    // Toast
    setShowNotification(true);
    setNotificationVal(
      videosMovedCount > 0
        ? `Created category "${trimmedName}" and moved ${videosMovedCount} video(s)`
        : `Created empty category "${trimmedName}"`,
    );

    // Close modal and reset
    setShowNewCategoryInput(false);
    setIsCreatingFromAddNew(false);
  };

  const handleCreateNewCategoryWithName = (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    // Don't create if same as current
    if (trimmedName === contextMenu.currentCategory) {
      toast({
        title: 'Category Already Exists',
        description: `Video is already in category "${trimmedName}"`,
        duration: 5000,
      });
      setShowNewCategoryInput(false);
      return;
    }

    // Check if category exists
    if (groups[trimmedName]) {
      toast({
        title: 'Category Already Exists',
        description: `Category "${trimmedName}" already exists. Use "Move to Category" instead.`,
        variant: 'destructive',
        duration: 5000,
      });
      return;
    }

    // Validate video
    if (!contextMenu.video?.video_id?.trim()) {
      setShowNotification(true);
      setNotificationVal(
        'No video selected. Please try right-clicking on a video first.',
      );
      setShowNewCategoryInput(false);
      return;
    }

    moveVideoToCategory(
      contextMenu.video,
      contextMenu.currentCategory,
      trimmedName,
    );

    setShowNotification(true);
    setNotificationVal(
      `Created category "${trimmedName}" and moved "${contextMenu.video.video_title}"`,
    );

    setShowNewCategoryInput(false);
    setIsCreatingFromAddNew(false);
  };

  const handleDeleteVideo = () => {
    // Validate that we have a valid video title
    if (
      !contextMenu.video.video_title ||
      contextMenu.video.video_title.trim() === ''
    ) {
      toast({
        title: 'Error',
        description:
          'No video selected. Please try right-clicking on a video first.',
        variant: 'destructive',
        duration: 5000,
      });
      closeContextMenu();
      return;
    }

    const uncategorizedName = 'Uncategorized';

    // Check if Uncategorized category exists, create if it doesn't
    setGroups((prevGroups) => {
      const newGroups = { ...prevGroups };

      // Create Uncategorized category if it doesn't exist
      if (!newGroups[uncategorizedName]) {
        newGroups[uncategorizedName] = [];
      }

      // Remove video from current category
      if (
        contextMenu.currentCategory &&
        newGroups[contextMenu.currentCategory]
      ) {
        newGroups[contextMenu.currentCategory] = newGroups[
          contextMenu.currentCategory
        ].filter((v) => v.video_id !== contextMenu.video.video_id);
      }

      // Add video to Uncategorized (prevent duplicates)
      if (
        !newGroups[uncategorizedName].some(
          (v) => v.video_id === contextMenu.video.video_id,
        )
      ) {
        newGroups[uncategorizedName].push(toVideoLite(contextMenu.video));
      }

      return newGroups;
    });

    // Find the download that matches this video title and update store
    // NOTE: Removed immediate download store updates - changes will be applied when user clicks "Apply"
    setShowNotification(true);
    setNotificationVal(
      `Moved "${contextMenu.video.video_title}" to Uncategorized`,
    );

    closeContextMenu();
  };

  if (!isOpen) return null;

  return (
    <div className="w-full h-full overflow-hidden flex flex-col gap-2 bg-[#F9F9F9] dark:bg-[#151515]">
      <OrganizationHeader
        onClose={handleClose}
        onSave={onSave}
        groups={groups}
        finishedDownloads={finishedDownloads}
        addCategory={addCategory}
        removeCategory={removeCategory}
        isApplying={isApplying}
        setIsApplying={setIsApplying}
      />

      <div className="flex flex-1 overflow-hidden h-[calc(100vh-160px)] bg-[#F9F9F9] dark:bg-[#151515] gap-2">
        {/* Permanent Category Sidebar */}
        <div className="h-full bg-white dark:bg-[#151515]">
          <PermanentCategorySidebar
            isShowSidePlayer={isShowSidePlayer}
            setActiveTab={setActiveTab}
            setIsCategorySelected={setIsCategorySelected}
            setIsFolderView={setIsFolderView}
            groups={displayUnmergedAISuggestionGroups}
            activeTab={activeTab}
            onTabChange={(tabName) => {
              activeTabManuallySetRef.current = true;
              setActiveTab(tabName);
              // When switching to a category (not 'All Videos'), show the category view
              if (tabName !== 'All Videos') {
                setIsCategorySelected(true);
              }
              // When selecting a category from sidebar, set viewedGroup (view mode persists)
              setViewedGroup(tabName);
              // Reset All Videos search states when changing tabs
              setIsAllVideosSearchMode(false);
              setAllVideosSearchQuery('');
              setIsAllVideosSearchResultsView(false);
            }}
            onGroupClick={handleGroupClick}
            onAddNewCategory={handleAddNewCategory}
            onCategoryDotsClick={handleCategoryNavDotsClick}
            // All Videos search props
            isAllVideosSearchMode={isAllVideosSearchMode}
            allVideosSearchQuery={allVideosSearchQuery}
            onAllVideosSearchQueryChange={setAllVideosSearchQuery}
            onAllVideosSearchSubmit={(query) => {
              if (query.trim()) {
                setIsAllVideosSearchMode(false);
                setIsAllVideosSearchResultsView(true);
              }
            }}
            onAllVideosSearchCancel={() => {
              setIsAllVideosSearchMode(false);
              setAllVideosSearchQuery('');
            }}
            onAllVideosSearchClick={() => {
              setIsAllVideosSearchMode(true);
              setAllVideosSearchQuery('');
            }}
            inlineRenamingCategory={inlineRenamingCategory}
            inlineRenameValue={inlineRenameValue}
            onInlineRenameChange={setInlineRenameValue}
            onInlineRenameConfirm={confirmInlineRename}
            onInlineRenameCancel={cancelInlineRename}
            onCategoryDoubleClick={handleCategoryDoubleClick}
            onCategoryKeyDown={handleCategoryKeyDown}
            collapsed={navCollapsed}
            toggleCollapse={toggleNavCollapse}
            isFolderView={isFolderView}
            viewedGroup={viewedGroup}
            setViewedGroup={(group) => {
              setViewedGroup(group);
            }}
            finishedDownloads={finishedDownloads}
            newVideosInMyCategories={newVideosInMyCategories}
            myCategoryGroups={myCategoryDisplayGroups}
            setShowSidePlayer={setShowSidePlayer}
            onDropVideosToCategory={handleDropVideosToCategory}
          />
        </div>
        <div className="flex-1 flex flex-col bg-white dark:bg-[#151515]">
          {!isAllVideosSearchResultsView && (
            <OrganizationTableBanner
              unmergedAISuggestionGroups={unmergedAISuggestionGroups}
              initialGroups={initialGroups}
              isAllVideosSearchResultsView={isAllVideosSearchResultsView}
              setIsAllVideosSearchResultsView={setIsAllVideosSearchResultsView}
              setIsAllVideosSearchMode={setIsAllVideosSearchMode}
              setAllVideosSearchQuery={setAllVideosSearchQuery}
              setAllSearchMode={setIsAllSearchMode}
              isCategorySelected={isCategorySelected}
              setViewedGroup={setViewedGroup}
              setIsCategorySelected={setIsCategorySelected}
              viewedGroup={viewedGroup || ''}
              availableCategories={availableCategories}
              categoryContexts={categoryContexts}
              groups={groups}
              setGroups={setGroups}
              setLastRenameOperation={setLastRenameOperation}
              handleCategoryNavDotsClick={handleCategoryNavDotsClick}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              isAllSearchMode={isAllSearchMode}
              setIsAllSearchMode={setIsAllSearchMode}
              allSearchQuery={allSearchQuery}
              setAllSearchQuery={setAllSearchQuery}
              inputValue={inputValue}
              setInputValue={setInputValue}
              filterType={filterType}
              setFilterType={setFilterType}
              isDropdownOpen={isDropdownOpen}
              setIsDropdownOpen={setIsDropdownOpen}
              searchDivRef={searchDivRef}
              dropdownRef={dropdownRef}
              isFolderView={isFolderView}
              setIsFolderView={setIsFolderView}
              inlineRenamingCategory={inlineRenamingCategory}
              setInlineRenamingCategory={setInlineRenamingCategory}
              inlineRenameValue={inlineRenameValue}
              setInlineRenameValue={setInlineRenameValue}
              removePill={removePill}
              handleKeyDown={handleKeyDown}
              confirmInlineRename={confirmInlineRename}
              cancelInlineRename={cancelInlineRename}
              finishedDownloads={finishedDownloads}
              addCategory={addCategory}
              removeCategory={removeCategory}
              isApplying={isApplying}
              setIsApplying={setIsApplying}
            />
          )}
          {/* Main Content */}
          <OrganizationTableContent
            isShowSidePlayer={isShowSidePlayer}
            finishedDownloads={finishedDownloads}
            checkedVideos={checkedVideos}
            isFolderView={isFolderView}
            handleVideoCheck={handleVideoCheck}
            handleAddNewCategory={handleAddNewCategory}
            setCheckedVideos={setCheckedVideos}
            moveVideoToCategory={moveVideoToCategory}
            moveVideosToCategory={moveVideosToCategory}
            removeVideosFromCategory={removeVideosFromCategory}
            addVideosToNewCategory={addVideosToNewCategory}
            isAllVideosSearchResultsView={isAllVideosSearchResultsView}
            setIsAllVideosSearchResultsView={setIsAllVideosSearchResultsView}
            allVideosSearchQuery={allVideosSearchQuery}
            setAllVideosSearchQuery={setAllVideosSearchQuery}
            allGroups={displayGroups}
            allSearchQuery={allSearchQuery}
            isCategorySelected={isCategorySelected}
            availableCategories={availableCategories}
            pendingCategoryVideos={pendingCategoryDisplayGroups}
            pendingCategoryRemovals={pendingCategoryRemovals}
            activeTab={activeTab}
            unmergedAISuggestionGroups={displayUnmergedAISuggestionGroups}
            viewedGroup={viewedGroup}
            setShowSidePlayer={setShowSidePlayer}
            handleGroupClick={handleGroupClick}
          />
        </div>
      </div>
      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          data-context-menu
          className="fixed bg-white dark:bg-darkModeCompliment rounded-lg drop-shadow-lg shadow-md z-[9000] py-1 px-2 w-28 text-xs font-medium"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <button
            className="rounded flex w-full text-left px-2 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-200"
            onClick={handleMoveToCategory}
          >
            Move
            <MdChevronRight
              size={14}
              className="justify-center align-center ml-0.5 mt-0.5"
            />
          </button>
          <button
            className="font-medium rounded w-full text-left px-2 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-200"
            onClick={handleDeleteVideo}
          >
            Delete
          </button>
        </div>
      )}

      {/* Category Navigation Context Menu */}
      <RenameModalCategory
        isVisible={categoryNavContextMenu.visible}
        position={{ x: categoryNavContextMenu.x, y: categoryNavContextMenu.y }}
        categoryName={categoryNavContextMenu.categoryName}
        onRename={(oldName, newName) => performCategoryRename(oldName, newName)}
        onDelete={() => handleDeleteCategory()}
        onClose={closeCategoryNavContextMenu}
      />

      <NewCategoryModal
        isOpen={showNewCategoryInput}
        onClose={() => setShowNewCategoryInput(false)}
        onConfirm={(name) => {
          if (isCreatingFromAddNew) {
            handleCreateNewCategoryAutoWithName(name);
          } else {
            handleCreateNewCategoryWithName(name);
          }
        }}
      />

      <RenameModal
        isOpen={showRenameCategoryInput}
        onClose={() => setShowRenameCategoryInput(false)}
        onConfirm={handleConfirmRenameCategory}
        categoryToRename={categoryBeingRenamed}
        groups={groups}
      />

      <RemoveModal
        isOpen={showDeleteConfirmation}
        onClose={() => setShowDeleteConfirmation(false)}
        onConfirm={() => confirmDeleteCategory(categoryToDelete || '')}
        categoryToDelete={categoryToDelete}
        groups={groups}
      />
    </div>
  );
};

export default OrganizationTable;
