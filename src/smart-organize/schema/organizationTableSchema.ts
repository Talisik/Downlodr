/* eslint-disable prettier/prettier */
// SearchQuery type matching AllVideosView
import { FinishedDownloads } from '@/downlodr/store/download/types';
import React from 'react';

interface SearchQuery {
  searchQuery: string;
  filterType: 'Title' | 'Category';
}

interface SelectedDownload {
  id: string;
  controllerId?: string;
  location?: string;
  videoUrl?: string;
  name?: string;
  downloadName?: string;
  status?: string;
  ext?: string;
  extractorKey?: string;
  download?: {
    location?: string;
    DateAdded?: string;
    name?: string;
    ext?: string;
    size?: number;
    speed?: string;
    channelName?: string;
    downloadName?: string;
    timeLeft?: string;
    progress?: number;
    formatId?: string;
    audioExt?: string;
    audioFormatId?: string;
    extractorKey?: string;
    automaticCaption?: boolean;
    thumbnails?: string;
    thumbnailsLocation?: string;
    autoCaptionLocation?: string;
    transcriptLocation?: string;
    getTranscript?: boolean;
    getThumbnail?: boolean;
    duration?: number;
    category?: string[];
    status?: string;
  };
}

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

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  video: {
    video_id: string;
    video_title: string;
    thumbnails?: string;
    channelName?: string;
    tags?: string[];
  };
  currentCategory: string;
}

interface UndoOperation {
  type: 'move_video';
  video: {
    video_id: string;
    video_title: string;
    thumbnails?: string;
    channelName?: string;
    tags?: string[];
  };
  fromCategory: string;
  toCategory: string;
}

interface Position {
  x: number;
  y: number;
}

interface OrganizationTableBannerProps {
  unmergedAISuggestionGroups: Record<
    string,
    {
      video_id: string;
      video_title: string;
      thumbnails?: string;
      channelName?: string;
      tags?: string[];
    }[]
  >;
  initialGroups: Record<
    string,
    {
      video_id: string;
      video_title: string;
      thumbnails?: string;
      channelName?: string;
      tags?: string[];
    }[]
  > | null;
  isAllVideosSearchResultsView: boolean;
  isCategorySelected: boolean;
  setViewedGroup: (group: string) => void;
  setIsCategorySelected: (isCategorySelected: boolean) => void;
  viewedGroup: string;
  availableCategories: string[];
  categoryContexts: Record<string, string>;
  setIsAllVideosSearchResultsView: (isAllVideosSearchResultsView: boolean) => void;
  setIsAllVideosSearchMode: (isAllVideosSearchMode: boolean) => void;
  setAllVideosSearchQuery: (query: string) => void;
  setAllSearchMode: (mode: boolean) => void;
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
  finishedDownloads: FinishedDownloads[];
  addCategory: (downloadId: string, categoryName: string) => void;
  removeCategory: (downloadId: string, categoryName: string) => void;
  isApplying: boolean;
  setIsApplying: (applying: boolean) => void;
  setGroups: (groups: Record<
    string,
    {
      video_id: string;
      video_title: string;
      thumbnails?: string;
      channelName?: string;
      tags?: string[];
    }[]
  >) => void;
  setLastRenameOperation: (lastRenameOperation: {
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
  }) => void;
  handleCategoryNavDotsClick: (e: React.MouseEvent, categoryName: string) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isAllSearchMode: boolean;
  setIsAllSearchMode: (mode: boolean) => void;
  allSearchQuery: SearchQuery[];
  setAllSearchQuery: (query: SearchQuery[]) => void;
  inputValue: string;
  setInputValue: (value: string) => void;
  filterType: 'Title' | 'Category';
  setFilterType: (type: 'Title' | 'Category') => void;
  isDropdownOpen: boolean;
  setIsDropdownOpen: (open: boolean) => void;
  searchDivRef: React.RefObject<HTMLDivElement>;
  dropdownRef: React.RefObject<HTMLDivElement>;
  isFolderView: boolean;
  setIsFolderView: (isFolderView: boolean) => void;
  inlineRenamingCategory: string | null;
  setInlineRenamingCategory: (category: string | null) => void;
  inlineRenameValue: string;
  setInlineRenameValue: (value: string) => void;
  removePill: (index: number) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  confirmInlineRename: () => void;
  cancelInlineRename: () => void;
}
export {
  ContextMenuState,
  OrganizationTableBannerProps,
  Position,
  SearchQuery,
  SelectedDownload,
  UndoOperation,
  VideoGroup
};

