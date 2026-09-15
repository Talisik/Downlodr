import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { useSelectedDownloadStore } from '@/core-app/store/selectedDownloadStore';
// import { getRandomColor } from '@/Utils/getRandromColor';
import { useCallback, useState } from 'react';
import CancelSmartOrganize from '../organizationModal/CancelSmartOrganize';
import { CategoryWarningModal } from '../organizationModal/CategoryWarningModal';
import { useNavigate } from 'react-router-dom';
interface DownloadItem {
  id: string;
  category?: string[];
}

const UNCATEGORIZED_NAME = 'Uncategorized';

const findMatchingDownload = (
  finishedDownloads: DownloadItem[],
  videoIdentifier: string | { video_id: string; video_title: string },
) => {
  const idToMatch =
    typeof videoIdentifier === 'string'
      ? videoIdentifier
      : videoIdentifier.video_id;

  return finishedDownloads.find((download) => download.id === idToMatch);
};

interface VideoGroup {
  id: string;
  name: string;
  description?: string;
  videos: {
    video_id: string;
    video_title: string;
    thumbnails?: string;
    channelName?: string;
    tags?: string[];
  }[];
  color?: string;
}

interface OrganizationHeaderProps {
  onClose: () => void;
  onSave: (videoGroups: VideoGroup[]) => void;
  groups: Record<
    string,
    {
      video_id: string;
      video_title: string;
      thumbnails?: string;
      channelName?: string;
      tags?: string[];
    }[]
  >;
  finishedDownloads: DownloadItem[];
  addCategory: (downloadId: string, categoryName: string) => void;
  removeCategory: (downloadId: string, categoryName: string) => void;
  isApplying: boolean;
  setIsApplying: (applying: boolean) => void;
}

const OrganizationHeader = ({
  onClose,
  onSave,
  groups,
  finishedDownloads,
  addCategory,
  removeCategory,
  isApplying,
  setIsApplying,
}: OrganizationHeaderProps) => {
  const navigate = useNavigate();
  const [isConfirmCancelOpen, setIsConfirmCancelOpen] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const setSelectedRowIds = useSelectedDownloadStore(
    (state) => state.setSelectedRowIds,
  );
  const setSelectedDownloads = useSelectedDownloadStore(
    (state) => state.setSelectedDownloads,
  );
  const handleClose = useCallback(() => {
    setIsConfirmCancelOpen(true);
  }, [setIsConfirmCancelOpen]);

  const handleSave = useCallback(async () => {
    // Set loading state
    setIsApplying(true);
    await new Promise((resolve) => setTimeout(resolve, 0));

    try {
      let categoriesCreated = 0;
      let videosAssigned = 0;
      setSelectedRowIds([]);
      setSelectedDownloads([]);
      // Collect all video IDs being organized in this session
      const videosBeingOrganized = new Set<string>();
      Object.values(groups).forEach((videos) => {
        videos.forEach((video) => {
          videosBeingOrganized.add(video.video_id);
        });
      });

      // Create a map for quick lookup of existing categories for each video
      const oldCategoriesMap = new Map<string, Set<string>>();
      finishedDownloads.forEach((download) => {
        if (download.category) {
          oldCategoriesMap.set(download.id, new Set(download.category));
        }
      });

      // Collect all promises for category operations to run them concurrently
      const categoryOperations: Promise<void>[] = [];

      // Process videos being organized for category changes
      videosBeingOrganized.forEach((videoId) => {
        const previousCategories =
          oldCategoriesMap.get(videoId) || new Set<string>();
        const currentCategories = new Set<string>();

        // Populate currentCategories from the `groups` state
        Object.entries(groups).forEach(([categoryName, videos]) => {
          if (categoryName !== UNCATEGORIZED_NAME) {
            videos.forEach((video) => {
              if (video.video_id === videoId) {
                currentCategories.add(categoryName);
              }
            });
          }
        });

        // Identify categories to remove
        previousCategories.forEach((existingCategory) => {
          if (!currentCategories.has(existingCategory)) {
            categoryOperations.push(
              Promise.resolve(removeCategory(videoId, existingCategory)),
            );
          }
        });

        // Identify categories to add
        currentCategories.forEach((newCategory) => {
          if (!previousCategories.has(newCategory)) {
            categoryOperations.push(
              Promise.resolve(addCategory(videoId, newCategory)),
            );
          }
        });
      });

      setProgress({ completed: 0, total: categoryOperations.length });

      // Wrap each operation to update progress
      const trackedCategoryOperations = categoryOperations.map((op) =>
        Promise.resolve(op).finally(() => {
          setProgress((prev) => ({ ...prev, completed: prev.completed + 1 }));
        }),
      );

      // Wait for all category operations to complete
      await Promise.all(trackedCategoryOperations);

      // Process groups (skip Uncategorized) to count assigned videos and created categories
      const uniqueCategoriesAssigned = new Set<string>();
      Object.entries(groups).forEach(([categoryName, videos]) => {
        if (videos.length > 0 && categoryName !== UNCATEGORIZED_NAME) {
          videos.forEach((video) => {
            // We assume categories were added/removed in the previous step
            videosAssigned++;
          });
          uniqueCategoriesAssigned.add(categoryName);
        }
      });

      categoriesCreated = uniqueCategoriesAssigned.size;

      // Convert to VideoGroup format (exclude Uncategorized)
      const convertedVideoGroups: VideoGroup[] = Object.entries(groups)
        .filter(([name]) => name !== UNCATEGORIZED_NAME)
        .map(([name, videos]) => ({
          id: `mcp-group-${name}`,
          name,
          description: 'Generated by Smart Organize',
          videos: videos,
          // color: getRandomColor(),
        }));

      onSave(convertedVideoGroups);

      toast({
        title: 'Organization Saved',
        description: `Created ${categoriesCreated} categories and assigned ${videosAssigned} videos.`,
        duration: 5000,
      });

      onClose();
    } catch (error) {
      console.error('Error during organization save:', error);
      toast({
        title: 'Error',
        description: 'Failed to save organization. Please try again.',
        duration: 5000,
      });
    } finally {
      setIsApplying(false);
    }
  }, [
    groups,
    finishedDownloads,
    addCategory,
    removeCategory,
    onSave,
    onClose,
    setIsApplying,
  ]);

  const getUpdatedExistingCategories = useCallback(() => {
    const affected = new Set<string>();

    const existingCategoryMap = new Map<string, Set<string>>();

    finishedDownloads.forEach((download) => {
      download.category?.forEach((cat) => {
        if (!existingCategoryMap.has(cat)) {
          existingCategoryMap.set(cat, new Set());
        }
        existingCategoryMap.get(cat)!.add(download.id);
      });
    });

    for (const [categoryName, videos] of Object.entries(groups)) {
      if (categoryName === UNCATEGORIZED_NAME) continue;

      const existingVideos = existingCategoryMap.get(categoryName);
      if (!existingVideos) continue;

      if (videos.some((v) => !existingVideos.has(v.video_id))) {
        affected.add(categoryName);
      }
    }

    return Array.from(affected);
  }, [groups, finishedDownloads]);

  const getCategoryWarningData = useCallback(() => {
    const affectedCategories = new Set<string>();
    const movedToUncategorized: string[] = [];

    // Map video -> old categories
    const videoOldCategories = new Map<string, Set<string>>();

    // Track all existing categories
    const existingCategories = new Set<string>();

    finishedDownloads.forEach((download) => {
      if (!download.category) return;

      const catSet = new Set(download.category);
      videoOldCategories.set(download.id, catSet);

      download.category.forEach((cat) => {
        existingCategories.add(cat);
      });
    });

    // Map video -> new categories
    const videoNewCategories = new Map<string, Set<string>>();
    Object.entries(groups).forEach(([categoryName, videos]) => {
      console.log('Checking category:', categoryName);
      const isUncategorized = categoryName === UNCATEGORIZED_NAME;

      videos.forEach((video) => {
        const videoId = video.video_id;
        const oldCats = videoOldCategories.get(videoId) || new Set();
        console.log(
          `Video ${videoId} oldCats:`,
          Array.from(oldCats),
          'newCat:',
          categoryName,
        );

        if (!isUncategorized && existingCategories.has(categoryName)) {
          if (!oldCats.has(categoryName)) {
            console.log(
              `DEBUG TRIGGER: Video ${videoId} is being added to existing category '${categoryName}'`,
            );
            affectedCategories.add(categoryName);
          }
        }

        if (isUncategorized && oldCats.size > 0) {
          console.log(
            `DEBUG TRIGGER: Video ${videoId} moved to Uncategorized`,
            Array.from(oldCats),
          );
          movedToUncategorized.push(videoId);
        }
      });
    });

    // 🔍 Compare OLD vs NEW
    videoNewCategories.forEach((newCats, videoId) => {
      const oldCats = videoOldCategories.get(videoId) || new Set();

      // --- Detect new additions into existing categories ---
      newCats.forEach((cat) => {
        if (!oldCats.has(cat) && existingCategories.has(cat)) {
          console.log(
            `[DEBUG] Video ${videoId} is being added to existing category '${cat}'.`,
            'Old categories:',
            Array.from(oldCats),
            'New categories:',
            Array.from(newCats),
          );
          affectedCategories.add(cat);
        }
      });

      // --- Detect moved to Uncategorized ---
      if (newCats.size === 0 && oldCats.size > 0) {
        console.log(
          `[DEBUG] Video ${videoId} is being moved to Uncategorized.`,
          'Old categories:',
          Array.from(oldCats),
        );
        movedToUncategorized.push(videoId);
      }
    });

    console.log(
      `[DEBUG] Warning check complete. Affected categories:`,
      Array.from(affectedCategories),
      'Videos moved to Uncategorized:',
      movedToUncategorized,
    );

    return {
      affectedCategories: Array.from(affectedCategories),
      movedToUncategorized,
    };
  }, [groups, finishedDownloads]);

  const [warningData, setWarningData] = useState<{
    affectedCategories: string[];
    movedToUncategorized: string[];
  } | null>(null);

  const handleSaveClick = () => {
    console.log('passed handler');
    const data = getCategoryWarningData();
    console.log(data);
    if (
      data.affectedCategories.length > 0 ||
      data.movedToUncategorized.length > 0
    ) {
      setWarningData(data);
    } else {
      console.log('hi');
      handleSave();
    }
  };

  const handleWarningNext = () => {
    setWarningData(null);
    handleSave();
  };

  return (
    <div className="bg-white dark:bg-darkModeCompliment rounded-md overflow-hidden">
      {/* Header with View Toggle */}
      <div className="flex items-center justify-between py-2 px-6 bg-offWhite dark:bg-black">
        <div className="flex px-1 md:px-2 py-1 rounded flex gap-1 items-center justify-center">
          <h2 className="text-[13.5px] font-bold dark:text-white">
            Smart Organize
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex">
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                disabled={isApplying}
                className={`px-5 py-1 text-[12px] border rounded-md bg-lightModeBorder dark:bg-[#333333] font-semibold ${
                  isApplying
                    ? 'cursor-not-allowed opacity-50 border-gray-300 text-gray-400'
                    : 'hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-darkModeHover dark:text-gray-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveClick}
                disabled={isApplying}
                className={`px-7 py-1 text-[12px] rounded-md flex items-center gap-2 ${
                  isApplying
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : 'bg-primary text-white hover:bg-orange-600'
                }`}
              >
                {isApplying ? (
                  <>
                    <div className="relative w-4 h-4">
                      <svg
                        className="w-4 h-4 transform -rotate-90 animate-spin"
                        viewBox="0 0 16 16"
                      >
                        <circle
                          cx="8"
                          cy="8"
                          r="6"
                          stroke="currentColor"
                          strokeWidth="2"
                          fill="none"
                          className="opacity-25"
                        />
                        <circle
                          cx="8"
                          cy="8"
                          r="6"
                          stroke="currentColor"
                          strokeWidth="2"
                          fill="none"
                          strokeDasharray={`${2 * Math.PI * 6 * 0.25}`}
                          strokeDashoffset={0}
                          className="transition-all duration-300"
                        />
                      </svg>
                    </div>
                    Applying...
                  </>
                ) : (
                  'Apply'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      <CancelSmartOrganize
        isOpen={isConfirmCancelOpen}
        closeModal={() => {
          setIsConfirmCancelOpen(false);
        }}
        onClose={() => {
          onClose();
          setIsConfirmCancelOpen(false);
        }}
        handleSmartOrganize={handleSave}
        setActiveMenu={() => undefined}
        resetUsage={() => {
          /*hello */
        }}
      />

      {warningData && (
        <CategoryWarningModal
          data={warningData}
          onNext={handleWarningNext}
          onCancel={() => setWarningData(null)}
        />
      )}

      {isApplying && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-darkModeCompliment p-6 rounded-lg shadow-lg text-center">
            <div className="relative w-16 h-16 mx-auto mb-4">
              <svg
                className="w-full h-full transform -rotate-90 animate-spin text-primary"
                viewBox="0 0 16 16"
              >
                <circle
                  cx="8"
                  cy="8"
                  r="6"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  className="opacity-25"
                />
                <circle
                  cx="8"
                  cy="8"
                  r="6"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 6 * 0.25}`}
                  strokeDashoffset={0}
                  className="transition-all duration-300"
                />
              </svg>
            </div>
            <p className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
              Applying Organization...
            </p>
            {progress.total > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {`Processed ${progress.completed} of ${progress.total} changes`}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationHeader;
