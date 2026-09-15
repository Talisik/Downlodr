import { useComponentTriggerStore } from '@/smart-organize/hooks/useComponentTrigger';
import { OrganizationTableBannerProps } from '@/smart-organize/schema/organizationTableSchema';
import { InfoIcon } from 'lucide-react';
import { BsThreeDotsVertical } from 'react-icons/bs';
import { GoTag } from 'react-icons/go';
import { HiOutlineListBullet, HiOutlineSquares2X2 } from 'react-icons/hi2';
import { MdChevronRight } from 'react-icons/md';

const OrganizationTableBanner = ({
  unmergedAISuggestionGroups,
  initialGroups,
  isAllVideosSearchResultsView,
  isCategorySelected,
  setViewedGroup,
  setIsCategorySelected,
  viewedGroup,
  availableCategories,
  categoryContexts,
  groups,
  setGroups,
  setLastRenameOperation,
  handleCategoryNavDotsClick,
  activeTab,
  setActiveTab,
  isAllSearchMode,
  setIsAllSearchMode,
  allSearchQuery,
  setAllSearchQuery,
  inputValue,
  setInputValue,
  filterType,
  setFilterType,
  isDropdownOpen,
  setIsDropdownOpen,
  searchDivRef,
  dropdownRef,
  isFolderView,
  setIsFolderView,
  inlineRenamingCategory,
  setInlineRenamingCategory,
  inlineRenameValue,
  setInlineRenameValue,
  removePill,
  handleKeyDown,
  confirmInlineRename,
  cancelInlineRename,
  finishedDownloads,
}: OrganizationTableBannerProps) => {
  const { isSmartOrganizeSearchOpen } = useComponentTriggerStore();
  return (
    <div>
      <div className="rounded-md bg-offWhite dark:bg-[#333333] py-3 px-4 justify-start items-start flex-shrink-0">
        <div>
          <div className="flex items-center justify-start align-center gap-2 justify-between flex-1">
            {/* Existing Smart Organize Search */}
            {isSmartOrganizeSearchOpen && activeTab === 'All Videos' && (
              <div className="items-center gap-4 w-full">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold dark:text-white">
                    All Videos
                  </span>
                </div>
              </div>
            )}
            {!isSmartOrganizeSearchOpen &&
              activeTab !== 'All Videos' &&
              !isAllVideosSearchResultsView && (
                <div className="items-center gap-4 line-clamp-1">
                  <div className="flex items-center">
                    <span
                      className={`text-sm font-bold items-center ${
                        isCategorySelected &&
                        viewedGroup !== 'Uncategorized' &&
                        !availableCategories.includes(activeTab)
                          ? 'cursor-pointer text-gray-500 dark:text-gray-100'
                          : ''
                      }`}
                      onClick={() => {
                        // Only allow click if not 'Uncategorized' or 'My Categories'
                        if (
                          viewedGroup !== 'Uncategorized' &&
                          !availableCategories.includes(activeTab) &&
                          isCategorySelected
                        ) {
                          setViewedGroup(null);
                          setActiveTab(null);
                          setIsFolderView(true);
                          setIsCategorySelected(false);
                        }
                      }}
                      // Make it look unclickable for restricted states
                      style={
                        viewedGroup === 'Uncategorized' ||
                        availableCategories.includes(activeTab)
                          ? {
                              pointerEvents: 'none',
                              color: 'inherit',
                              opacity: 0.65,
                            }
                          : {}
                      }
                    >
                      {viewedGroup === 'Uncategorized'
                        ? 'Suggested Categories'
                        : availableCategories.includes(activeTab)
                        ? 'My Categories'
                        : 'Suggested Categories'}
                    </span>
                    {isCategorySelected && (
                      <>
                        <MdChevronRight
                          className="mx-1 text-gray-400"
                          size={16}
                        />
                        <div className="flex items-center gap-1 mr-1">
                          {inlineRenamingCategory === viewedGroup ? (
                            <input
                              type="text"
                              value={inlineRenameValue}
                              onChange={(e) =>
                                setInlineRenameValue(e.target.value)
                              }
                              onBlur={confirmInlineRename}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') confirmInlineRename();
                                else if (e.key === 'Escape')
                                  cancelInlineRename();
                              }}
                              className="text-sm font-bold dark:text-white bg-transparent border-b border-current outline-none min-w-0 flex-1"
                              autoFocus
                              onFocus={(e) => e.target.select()}
                              maxLength={50}
                            />
                          ) : (
                            <span className="text-sm font-bold dark:text-gray-100">
                              {viewedGroup}
                            </span>
                          )}
                          <span className="text-[11px] rounded py-1 px-3 bg-lightGray dark:bg-darkModeBorderColor ml-1 font-bold">
                            {activeTab === 'All Videos'
                              ? Object.values(groups).reduce(
                                  (total, videos) => total + videos.length,
                                  0,
                                )
                              : availableCategories.includes(activeTab)
                              ? finishedDownloads.filter(
                                  (download) =>
                                    download.category?.includes(activeTab),
                                ).length
                              : groups[activeTab]?.length || 0}{' '}
                            video{groups[activeTab]?.length === 1 ? '' : 's'}
                          </span>
                        </div>
                        {viewedGroup !== 'Uncategorized' &&
                          !availableCategories.includes(activeTab) && (
                            <button
                              className="hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                              onClick={(e) =>
                                handleCategoryNavDotsClick(e, viewedGroup)
                              }
                              aria-label={`More options for ${viewedGroup} category`}
                            >
                              <BsThreeDotsVertical size={11} />
                            </button>
                          )}
                      </>
                    )}
                  </div>
                  {categoryContexts[activeTab] &&
                    !availableCategories.includes(activeTab) && (
                      <div className="mt-1 flex items-center gap-1 text-[#808080]">
                        <InfoIcon size={12} />
                        <span className="text-xxs text-gray-500 dark:text-gray-400">
                          {isCategorySelected ? (
                            categoryContexts[activeTab]
                          ) : (
                            <span className="text-xxs text-gray-500 dark:text-gray-400">
                              These videos are recommended categories determined
                              by analyzing format, topic, tone, and subject
                              matter.
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  {availableCategories.includes(activeTab) && (
                    <div className="mt-1 flex items-center gap-1 text-[#808080]">
                      <InfoIcon size={12} />
                      <span className="text-xxs text-gray-500 dark:text-gray-400">
                        {isCategorySelected ? (
                          `Videos in your "${activeTab}" category from your downloads.`
                        ) : (
                          <span className="text-xxs text-gray-500 dark:text-gray-400">
                            These are categories created from your downloaded
                            videos.
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              )}
            <div className="space-x-2">
              <div className="w-fit rounded-lg p-0.5 flex items-center mr-2 gap-1">
                {/* Folder View Tab */}
                <button
                  onClick={() => setIsFolderView(true)}
                  className={`flex items-center gap-1 px-2 py-1.5 text-sm rounded-md transition
      ${
        isFolderView
          ? 'bg-lightModeBorder dark:bg-gray-200 text-gray-700'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
      }`}
                >
                  <HiOutlineSquares2X2 size={16} />
                </button>

                {/* List View Tab */}
                <button
                  onClick={() => {
                    setIsFolderView(false);
                    console.log('activeTab in list view', activeTab);
                  }}
                  className={`flex items-center gap-1 px-2 py-1.5 text-sm rounded-md transition
      ${
        !isFolderView
          ? 'bg-lightModeBorder dark:bg-gray-200 text-gray-700'
          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
      }`}
                >
                  <HiOutlineListBullet size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
        {activeTab &&
          !availableCategories.includes(activeTab) &&
          groups[activeTab]?.length > 0 && (
            <div className="mt-1 flex items-center gap-1 text-[#808080]">
              <GoTag size={12} />
              <span className="text-xxs text-gray-500 dark:text-gray-400">
                Tags in this category:
              </span>
              <span className="text-xxs font-medium text-gray-900 dark:text-gray-400 bg-lightModeBorder dark:bg-darkModeBorderColor rounded-md px-1 py-0.5">
                {activeTab}
              </span>
            </div>
          )}
      </div>
    </div>
  );
};

export { OrganizationTableBanner };
