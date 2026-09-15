import { SearchQuery } from '@/smart-organize/schema/organizationTableSchema';
import { FinishedDownloads } from '@/downlodr/store/downloadStore';
import AllVideosSearchResultsView from '../AllVideosSearchResultsView';
import AllVideosView from '../AllVideosView';
import FolderGroupsDisplay from '../FolderGroupsDisplay';
import ListGroupsDisplay from '../ListGroupDisplay';
import MyCategoriesSelectedCategory from '../MyCategoriesSelectedCategory';
import SelectedCategory from '../SelectedCategory';
import { VideoItem } from '../SelectedCategoryTools';

interface OrganizationTableContentProps {
  finishedDownloads: FinishedDownloads[];
  checkedVideos: Set<string>;
  isFolderView: boolean;
  handleVideoCheck: (video: VideoItem, checked: boolean) => void;
  setCheckedVideos: (videos: Set<string>) => void;
  moveVideoToCategory: (
    video: VideoItem,
    fromCategory: string,
    toCategory: string,
  ) => void;
  handleAddNewCategory: () => void;
  moveVideosToCategory: (videoIds: string[], targetCategory: string) => void;
  removeVideosFromCategory: (videoIds: string[], fromCategory: string) => void;
  addVideosToNewCategory: (videoIds: string[], newCategoryName: string) => void;
  isAllVideosSearchResultsView: boolean;
  setIsAllVideosSearchResultsView: (
    isAllVideosSearchResultsView: boolean,
  ) => void;
  isShowSidePlayer: boolean;
  allVideosSearchQuery: string;
  setAllVideosSearchQuery: (allVideosSearchQuery: string) => void;
  allGroups: Record<string, VideoItem[]>;
  allSearchQuery: SearchQuery[];
  isCategorySelected: boolean;
  availableCategories: string[];
  pendingCategoryVideos: Record<string, VideoItem[]>;
  pendingCategoryRemovals: Record<string, string[]>;
  activeTab: string;
  unmergedAISuggestionGroups: Record<string, VideoItem[]>;
  viewedGroup: string;
  setShowSidePlayer: (show: boolean) => void;
  handleGroupClick: (
    groupName: string,
    videos: { video_id: string; video_title: string }[],
  ) => void;
}

const noop = () => {
  /* placeholder handler */
};

const OrganizationTableContent: React.FC<OrganizationTableContentProps> = ({
  finishedDownloads,
  checkedVideos,
  isFolderView,
  handleAddNewCategory,
  handleVideoCheck,
  setCheckedVideos,
  moveVideoToCategory,
  moveVideosToCategory,
  removeVideosFromCategory,
  addVideosToNewCategory,
  isAllVideosSearchResultsView,
  setIsAllVideosSearchResultsView,
  allVideosSearchQuery,
  setAllVideosSearchQuery,
  allGroups,
  allSearchQuery,
  isCategorySelected,
  availableCategories,
  pendingCategoryVideos,
  pendingCategoryRemovals,
  activeTab,
  unmergedAISuggestionGroups,
  isShowSidePlayer,
  viewedGroup,
  setShowSidePlayer,
  handleGroupClick,
}) => {
  // Shared props for the video-list-style views
  const commonProps = {
    finishedDownloads,
    checkedVideos,
    isShowSidePlayer,
    isFolderView,
    onVideoCheck: handleVideoCheck,
    onRowClick: noop,
    onRightClick: noop,
    onViewFile: noop,
    onViewDownload: noop,
    onSelectAll: (videoIds: string[]) => {
      setCheckedVideos(new Set([...checkedVideos, ...videoIds]));
    },
    onDeselectAll: () => {
      setCheckedVideos(new Set());
    },
    onMoveVideoToCategory: moveVideoToCategory,
    onMoveVideosToCategory: moveVideosToCategory,
    onRemoveVideosFromCategory: removeVideosFromCategory,
    onAddVideosToNewCategory: addVideosToNewCategory,
  };

  const renderContent = () => {
    if (activeTab === 'All Videos') {
      if (isAllVideosSearchResultsView) {
        return (
          <AllVideosSearchResultsView
            checkedVideos={checkedVideos}
            groups={allGroups}
            finishedDownloads={finishedDownloads}
            searchQuery={allVideosSearchQuery}
            onViewFile={commonProps.onViewFile}
            onVideoCheck={commonProps.onVideoCheck}
            onRowClick={commonProps.onRowClick}
            onSelectAll={commonProps.onSelectAll}
            onDeselectAll={commonProps.onDeselectAll}
            onBackToAllVideos={() => {
              setIsAllVideosSearchResultsView(false);
              setAllVideosSearchQuery('');
            }}
          />
        );
      }

      return (
        <AllVideosView
          {...commonProps}
          groups={allGroups}
          externalSearchQueries={allSearchQuery}
          onCategoryClick={handleGroupClick}
        />
      );
    }

    if (isCategorySelected) {
      // UNCATEGORIZED_NAME is handled as an AI suggestion, not a My Categories tab
      const isMyCategoriesTab = availableCategories.includes(activeTab);

      if (isMyCategoriesTab) {
        return (
          <MyCategoriesSelectedCategory
            activeTab={activeTab}
            checkedVideos={checkedVideos}
            isFolderView={isFolderView}
            isShowSidePlayer={isShowSidePlayer}
            setShowSidePlayer={setShowSidePlayer}
            onVideoCheck={commonProps.onVideoCheck}
            onRowClick={commonProps.onRowClick}
            onRightClick={commonProps.onRightClick}
            onViewFile={commonProps.onViewFile}
            onViewDownload={commonProps.onViewDownload}
            onSelectAll={commonProps.onSelectAll}
            onDeselectAll={commonProps.onDeselectAll}
            onMoveVideoToCategory={commonProps.onMoveVideoToCategory}
            onMoveVideosToCategory={commonProps.onMoveVideosToCategory}
            onRemoveVideosFromCategory={commonProps.onRemoveVideosFromCategory}
            onAddVideosToNewCategory={commonProps.onAddVideosToNewCategory}
            pendingCategoryVideos={pendingCategoryVideos}
            pendingCategoryRemovals={pendingCategoryRemovals}
            availableCategories={availableCategories}
          />
        );
      }

      return (
        <SelectedCategory
          {...commonProps}
          setShowSidePlayer={setShowSidePlayer}
          isShowSidePlayer={isShowSidePlayer}
          activeTab={activeTab}
          groups={unmergedAISuggestionGroups}
          availableCategories={availableCategories}
        />
      );
    }

    // Fallback: no AI suggestion groups means there's nothing to group by folder/list
    const hasSuggestionGroups =
      Object.keys(unmergedAISuggestionGroups).length > 0;

    if (!hasSuggestionGroups) {
      return (
        <MyCategoriesSelectedCategory
          activeTab={activeTab}
          checkedVideos={checkedVideos}
          isFolderView={isFolderView}
          isShowSidePlayer={false}
          setShowSidePlayer={setShowSidePlayer}
          onVideoCheck={commonProps.onVideoCheck}
          onRowClick={commonProps.onRowClick}
          onRightClick={commonProps.onRightClick}
          onViewFile={commonProps.onViewFile}
          onViewDownload={commonProps.onViewDownload}
          onSelectAll={commonProps.onSelectAll}
          onDeselectAll={commonProps.onDeselectAll}
          onMoveVideoToCategory={commonProps.onMoveVideoToCategory}
          pendingCategoryVideos={pendingCategoryVideos}
          pendingCategoryRemovals={pendingCategoryRemovals}
        />
      );
    }

    if (isFolderView) {
      return (
        <FolderGroupsDisplay
          groups={unmergedAISuggestionGroups}
          finishedDownloads={finishedDownloads}
          onGroupClick={handleGroupClick}
          viewedGroup={viewedGroup}
          handleAddNewCategory={handleAddNewCategory}
          className="flex-1 overflow-y-auto"
        />
      );
    }

    return (
      <ListGroupsDisplay
        groups={unmergedAISuggestionGroups}
        finishedDownloads={finishedDownloads}
        onGroupClick={handleGroupClick}
        viewedGroup={viewedGroup}
        className="flex-1 overflow-y-auto"
      />
    );
  };

  return (
    <div className="flex-1 overflow-hidden bg-white dark:bg-darkMode">
      {renderContent()}
    </div>
  );
};

export default OrganizationTableContent;
