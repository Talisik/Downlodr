/**
 * A custom React component
 * A React component that displays a context menu for managing downloads.
 * It provides options to pause, stop, remove, and view downloads, as well as manage tags and categories.
 *
 * @param DownloadContextMenuProps
 *   @param downloadId - The unique identifier for the download.
 *   @param position - An object containing the x and y coordinates for positioning the menu.
 *   @param downloadLocation - The location of the download file.
 *   @param controllerId - The ID of the controller managing the download.
 *   @param downloadStatus - The current status of the download.
 *   @param onClose - A function to call when the menu should be closed.
 *   @param onPause - A function to pause the download.
 *   @param onStop - A function to stop the download.
 *   @param onForceStart - A function to force start the download.
 *   @param onRemove - A function to remove the download.
 *   @param onViewDownload - A function to view the download.
 *   @param onAddTag - A function to add a tag to the download.
 *   @param onRemoveTag - A function to remove a tag from the download.
 *   @param currentTags - An array of current tags for the download.
 *   @param availableTags - An array of all available tags in the system.
 *   @param onAddCategory - A function to add a category to the download.
 *   @param onRemoveCategory - A function to remove a category from the download.
 *   @param currentCategories - An array of current categories for the download.
 *   @param availableCategories - An array of all available categories in the system.
 *   @param onViewFolder - A function to view the folder containing the download.
 *   @param downloadName - The name of the download file.
 *   @param onRename - A function to rename the download.
 *   @param onShowRemoveModal - A function to show the remove confirmation modal.
 *   @param onShowStopModal - A function to show the stop confirmation modal.
 *
 * @returns JSX.Element - The rendered context menu component.
 */

import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { useSelectedDownloadStore } from '@/core-app/store/selectedDownloadStore';
import { BaseDownload, useDownloadStore } from '@/downlodr/store/downloadStore';
import { useArticleDownloadStore } from '@/afda/store/articleDownloadStore';
import { processFileName } from '@/downlodr/utils/download/filterName';
import { usePluginState } from '@/plugins/hook/usePluginState';
import { MenuItem } from '@/plugins/schema/types';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BsArrowCounterclockwise } from 'react-icons/bs';
import { FaTerminal } from 'react-icons/fa';
import { GoPlus } from 'react-icons/go';
import { HiOutlineStopCircle } from 'react-icons/hi2';
import { IoCodeSlashSharp, IoPauseCircleOutline } from 'react-icons/io5';
import { LiaFileVideoSolid, LiaTagsSolid } from 'react-icons/lia';
import { LuFileVideo, LuFolderOpen, LuTrash } from 'react-icons/lu';
import { MdEdit, MdOutlinePlayCircle } from 'react-icons/md';

import { useSettingStore } from '@/core-app/store/settingsStore';
import { PiPuzzlePieceBold } from 'react-icons/pi';
import ContextMenuItem from './ContextMenuItem';
import { useContextMenuAnimation } from '@/core-app/hooks/animation/usePopContextMenu';

interface DownloadContextMenuProps {
  download: BaseDownload;
  position: { x: number; y: number };
  onClose: () => void; // Function to close the context menu
  onPause: (
    id: string,
    downloadLocation?: string,
    controllerId?: string,
    downloadStatus?: string,
  ) => void; // Function to pause the download'
  onRetry: (downloadId: string) => void; // Function to retry the download
  onShowLog: (downloadId: string) => void; // Function to show the log of the download
  onShowActivityTracker: (downloadId: string) => void; // Function to show the activity tracker of the download
  onStop: (
    id: string,
    downloadLocation?: string,
    controllerId?: string,
  ) => void; // Function to stop the download
  onForceStart: (
    id: string,
    downloadLocation?: string,
    controllerId?: string,
  ) => void; // Function to force start the download
  onRemove: (
    downloadLocation?: string,
    id?: string,
    controllerId?: string,
    deleteFolder?: boolean,
  ) => void; // Function to remove the download
  onViewDownload: (downloadLocation?: string, downloadId?: string) => void; // Function to view the download
  onAddTag: (downloadId: string, tag: string) => void; // Function to add a tag to the download
  onRemoveTag: (downloadId: string, tag: string) => void; // Function to remove a tag from the download
  currentTags: string[]; // Array of current tags for the download
  availableTags: string[]; // Array of all available tags in the system
  onAddCategory: (downloadId: string, category: string) => void; // Function to add a category to the download
  onRemoveCategory: (downloadId: string, category: string) => void; // Function to remove a category from the download
  currentCategories: string[]; // Array of current categories for the download
  availableCategories: string[]; // Array of all available categories in the system
  onViewFolder: (downloadLocation?: string, downloadFile?: string) => void; // Function to view the folder containing the download
  onRename: (downloadId: string, currentName: string) => void; //
  onShowRemoveModal: (
    downloadId: string,
    downloadLocation?: string,
    controllerId?: string,
  ) => void;
  onShowStopModal: (
    downloadId: string,
    downloadLocation?: string,
    controllerId?: string,
  ) => void;
  onViewEmbed: (
    videoUrl: string,
    title: string,
    autoCaptionLocation?: string,
    transcriptLocation?: string,
    displayName?: string,
    dateAdded?: string,
    location?: string,
    tags?: string[],
    category?: string[],
    status?: string,
    downloadName?: string,
  ) => void;
}

const DownloadContextMenu: React.FC<DownloadContextMenuProps> = ({
  download,
  position,
  onClose,
  onPause,
  onRetry,
  onShowLog,
  onShowActivityTracker,
  onViewDownload,
  onAddTag,
  onRemoveTag,
  currentTags = [],
  availableTags = [],
  onAddCategory,
  onRemoveCategory,
  currentCategories = [],
  availableCategories = [],
  onViewFolder,
  onRename,
  onShowRemoveModal,
  onShowStopModal,
  onViewEmbed,
}) => {
  const { t } = useTranslation('downlodr');
  const tagButtonRef = React.useRef<HTMLButtonElement>(null);
  const categoryButtonRef = React.useRef<HTMLButtonElement>(null);
  const pluginButtonRef = React.useRef<HTMLButtonElement>(null);
  const tagSubmenuRef = React.useRef<HTMLDivElement>(null);
  const categorySubmenuRef = React.useRef<HTMLDivElement>(null);
  const pluginSubmenuRef = React.useRef<HTMLDivElement>(null);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [showPluginMenu, setShowPluginMenu] = useState(false);
  const [submenuPosition, setSubmenuPosition] = useState({ x: 0, y: 0 });
  const setSelectedRowIds = useSelectedDownloadStore(
    (state) => state.setSelectedRowIds,
  );
  const setSelectedDownloads = useSelectedDownloadStore(
    (state) => state.setSelectedDownloads,
  );
  const { settings } = useSettingStore();
  const {
    downloading,
    addQueue,
    removeFromForDownloads,
    forDownloads,
    finishedDownloads,
  } = useDownloadStore();
  const allDownloads = [...forDownloads, ...downloading, ...finishedDownloads]; //Plugins

  const articleDownloads = useArticleDownloadStore((s) => s.articleDownloads);
  const mergedAvailableTags = useMemo(
    () =>
      Array.from(
        new Set([
          ...availableTags,
          ...articleDownloads.flatMap((a) => a.tags ?? []),
        ]),
      ),
    [availableTags, articleDownloads],
  );
  const mergedAvailableCategories = useMemo(
    () =>
      Array.from(
        new Set([
          ...availableCategories,
          ...articleDownloads.flatMap((a) => a.category ?? []),
        ]),
      ),
    [availableCategories, articleDownloads],
  );
  const [pluginMenuItems, setPluginMenuItems] = useState<MenuItem[]>([]);
  const enabledPlugins = usePluginState();

  const { menuRef } = useContextMenuAnimation();

  const fetchPluginMenuItems = async () => {
    try {
      const items = await window.plugins.getMenuItems('download');
      const filteredItems = (items || []).filter(
        (item) => !item.pluginId || enabledPlugins[item.pluginId] !== false,
      ) as MenuItem[];
      setPluginMenuItems(filteredItems);
    } catch (error) {
      console.error('Failed to fetch plugin menu items:', error);
      setPluginMenuItems([]);
    }
  };

  // Listen for plugins ready event
  useEffect(() => {
    const handlePluginsReady = () => {
      fetchPluginMenuItems();
    };

    window.addEventListener('pluginsReady', handlePluginsReady);

    // Initial fetch
    fetchPluginMenuItems();

    return () => {
      window.removeEventListener('pluginsReady', handlePluginsReady);
    };
  }, []);

  // Handle plugin state changes
  useEffect(() => {
    fetchPluginMenuItems();
  }, [enabledPlugins]);

  // Close menu on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideMenu = menuRef.current?.contains(target);
      const insideTagSubmenu = tagSubmenuRef.current?.contains(target);
      const insideCategorySubmenu =
        categorySubmenuRef.current?.contains(target);
      const insidePluginSubmenu = pluginSubmenuRef.current?.contains(target);
      if (
        !insideMenu &&
        !insideTagSubmenu &&
        !insideCategorySubmenu &&
        !insidePluginSubmenu
      ) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  // Function to recalculate submenu position
  const recalculateSubmenuPosition = (
    buttonRef: React.RefObject<HTMLButtonElement>,
    itemCount: number,
    menuType: 'tag' | 'category' | 'plugin',
  ) => {
    if (buttonRef.current && menuRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const menuRect = menuRef.current.getBoundingClientRect();

      let submenuX = menuRect.right + 1;
      let submenuY = buttonRect.top;

      // Calculate the height of the submenu based on type
      let submenuHeight;
      if (menuType === 'plugin') {
        submenuHeight = Math.min(itemCount * 40, 300);
      } else {
        const inputAreaHeight = 80; // approximate height of input area + divider
        const maxListHeight = 192; // max-h-48 = 192px
        const actualListHeight = Math.min(itemCount * 40, maxListHeight);
        submenuHeight = inputAreaHeight + actualListHeight;
      }

      // If the submenu would overflow the bottom, shift up
      if (submenuY + submenuHeight > window.innerHeight - 10) {
        submenuY = Math.max(10, window.innerHeight - submenuHeight - 10);
      }
      // If the submenu would overflow the top, shift down
      if (submenuY < 10) {
        submenuY = 10;
      }

      // Check if submenu would overflow viewport horizontally and adjust if needed
      const submenuWidth = 200; // approximate width
      if (submenuX + submenuWidth > window.innerWidth) {
        submenuX = menuRect.left - submenuWidth - 1; // Position to the left instead
      }

      setSubmenuPosition({ x: submenuX, y: submenuY });
    }
  };

  // Recalculate tag submenu position when available tags change
  useEffect(() => {
    if (showTagMenu) {
      recalculateSubmenuPosition(tagButtonRef, mergedAvailableTags.length, 'tag');
    }
  }, [mergedAvailableTags.length, showTagMenu]);

  // Recalculate category submenu position when available categories change
  useEffect(() => {
    if (showCategoryMenu) {
      recalculateSubmenuPosition(
        categoryButtonRef,
        mergedAvailableCategories.length,
        'category',
      );
    }
  }, [mergedAvailableCategories.length, showCategoryMenu]);

  // Recalculate plugin submenu position when plugin items change
  useEffect(() => {
    if (showPluginMenu) {
      recalculateSubmenuPosition(
        pluginButtonRef,
        pluginMenuItems.length,
        'plugin',
      );
    }
  }, [pluginMenuItems.length, showPluginMenu]);

  // Helper function to check if a string is an SVG
  const isSvgString = (str: string): boolean => {
    return str.trim().startsWith('<svg') && str.trim().endsWith('</svg>');
  };

  useEffect(() => {
    if (menuRef.current) {
      const checkAndAdjustPosition = () => {
        if (menuRef.current) {
          const menuRect = menuRef.current.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const viewportWidth = window.innerWidth;
          const margin = 10;
          let needsAdjustment = false;
          let newX = position.x;
          let newY = position.y;

          // Calculate approximate menu height based on number of items
          const itemHeight = 40; // approximate height of each menu item
          const baseMenuHeight = itemHeight * 7; // All download statuses have 6 base menu items (including Tags and Category)
          const pluginItemsHeight =
            pluginMenuItems.length <= 4
              ? pluginMenuItems.length * itemHeight +
                (pluginMenuItems.length > 0 ? 10 : 0) // show all plugin items + divider height
              : itemHeight + 10; // show just the Plugins button + divider height
          const totalMenuHeight = baseMenuHeight + pluginItemsHeight;

          // Only adjust if menu is actually overflowing
          if (menuRect.bottom > viewportHeight - margin) {
            newY = Math.max(margin, viewportHeight - totalMenuHeight - margin);
            needsAdjustment = true;
          }

          if (menuRect.right > viewportWidth - margin) {
            newX = Math.max(margin, viewportWidth - menuRect.width - margin);
            needsAdjustment = true;
          }

          if (menuRect.left < margin) {
            newX = margin;
            needsAdjustment = true;
          }

          if (menuRect.top < margin) {
            newY = margin;
            needsAdjustment = true;
          }

          if (needsAdjustment) {
            menuRef.current.style.left = `${newX}px`;
            menuRef.current.style.top = `${newY}px`;
          }
        }
      };

      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(checkAndAdjustPosition);
    }
  }, [position, pluginMenuItems.length, download.status]);

  // Function to handle opening tag menu
  const handleTagMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    setShowCategoryMenu(false); // Close category menu
    setShowPluginMenu(false); // Close plugin menu
    const newShowTagMenu = !showTagMenu;
    setShowTagMenu(newShowTagMenu);

    // Calculate position for submenu
    if (newShowTagMenu) {
      recalculateSubmenuPosition(tagButtonRef, mergedAvailableTags.length, 'tag');
    }
  };

  // Function to handle opening category menu
  const handleCategoryMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    setShowTagMenu(false); // Close tag menu
    setShowPluginMenu(false); // Close plugin menu
    const newShowCategoryMenu = !showCategoryMenu;
    setShowCategoryMenu(newShowCategoryMenu);

    // Calculate position for submenu
    if (newShowCategoryMenu) {
      recalculateSubmenuPosition(
        categoryButtonRef,
        mergedAvailableCategories.length,
        'category',
      );
    }
  };

  // Function to handle opening plugin menu
  const handlePluginMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    setShowTagMenu(false);
    setShowCategoryMenu(false);
    const newShowPluginMenu = !showPluginMenu;
    setShowPluginMenu(newShowPluginMenu);

    // Calculate position for submenu
    if (newShowPluginMenu) {
      recalculateSubmenuPosition(
        pluginButtonRef,
        pluginMenuItems.length,
        'plugin',
      );
    }
  };

  // Function to start the download
  const handleStartDownload = async () => {
    // Process the filename first
    const processedName = await processFileName(
      download.location || '',
      download.name || '',
      download.ext || download.audioExt,
    );

    setSelectedRowIds([]);
    setSelectedDownloads([]);

    if (downloading.length >= settings.maxDownloadNum) {
      toast({
        variant: 'destructive',
        title: 'Download limit reached',
        description: `Maximum download limit (${settings.maxDownloadNum}) reached. Please wait for current downloads to complete or increase limit via settings.`,
        duration: 3000,
      });
      return;
    }

    // Add to queue - let the download controller handle starting it
    addQueue({
      subscriptionId: download.subscriptionId,
      videoUrl: download.videoUrl ?? download.videoUrl ?? '',
      name: `${processedName}.${download.ext}`,
      downloadName: `${processedName}.${download.ext}`,
      displayName: download.displayName ?? `${processedName}.${download.ext}`,
      size: download.size,
      speed: download.speed,
      channelName: download.channelName ?? '',
      timeLeft: download.timeLeft ?? '',
      DateAdded: new Date().toISOString(),
      progress: download.progress ?? 0,
      location: download.location ?? download.location ?? '',
      status: 'queued',
      ext: download.ext,
      formatId: download.formatId,
      audioExt: download.audioExt,
      audioFormatId: download.audioFormatId,
      extractorKey: download.extractorKey,
      limitRate:
        settings.defaultDownloadSpeed === 0
          ? ''
          : `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`,
      automaticCaption: download.automaticCaption,
      thumbnails: download.thumbnails,
      getTranscript: download.getTranscript ?? false,
      getThumbnail: download.getThumbnail ?? false,
      duration: download.duration ?? 60,
      isCreateFolder: true,
    });
    // Remove from forDownloads
    removeFromForDownloads(download.id || '');

    toast({
      title: 'Download Added to Queue',
      description: `"${processedName}" added to queue. The download controller will start it automatically.`,
      duration: 3000,
    });

    onClose();
  };

  // Function to render menu options based on download status
  const renderMenuOptions = () => {
    const viewFolderOption = (
      <ContextMenuItem
        icon={<LuFolderOpen size={18} />}
        label={t('contextMenu.viewFolder')}
        onClick={() => {
          onViewFolder(download.location, download.name);
          onClose();
        }}
      />
    );

    const commonOptions = (
      <>
        <ContextMenuItem
          buttonRef={tagButtonRef}
          icon={<LiaTagsSolid size={18} />}
          label={t('contextMenu.tags')}
          chevron
          onClick={handleTagMenuClick}
        />
        <ContextMenuItem
          buttonRef={categoryButtonRef}
          icon={<LiaTagsSolid size={18} />}
          label={t('contextMenu.categories')}
          chevron
          onClick={handleCategoryMenuClick}
        />
      </>
    );

    const activityTrackerOption = (
      <ContextMenuItem
        icon={<FaTerminal size={13} />}
        label={t('contextMenu.activityTracker')}
        onClick={() => {
          onShowActivityTracker(download.id || '');
          onClose();
        }}
      />
    );

    const pausedOptions = (
      <ContextMenuItem
        icon={<IoPauseCircleOutline size={18} />}
        label={t('contextMenu.pause')}
        onClick={() => {
          onPause(
            download.id || '',
            download.location,
            download.controllerId,
            download.status,
          );
          onClose();
        }}
      />
    );

    const stopOptions = (
      <ContextMenuItem
        icon={<HiOutlineStopCircle size={18} />}
        label={t('contextMenu.stop')}
        onClick={(e) => {
          e.stopPropagation();
          onShowStopModal(
            download.id || '',
            download.location,
            download.controllerId,
          );
          onClose();
        }}
      />
    );

    const removeOptions = (
      <ContextMenuItem
        icon={<LuTrash size={16} />}
        label={t('contextMenu.remove')}
        onClick={(e) => {
          e.stopPropagation();
          onShowRemoveModal(
            download.id || '',
            download.location,
            download.controllerId,
          );
          onClose();
        }}
      />
    );

    const showLogOption = (
      <ContextMenuItem
        icon={<IoCodeSlashSharp size={16} />}
        label={t('contextMenu.showLog')}
        onClick={() => {
          onShowLog(download.id || '');
          onClose();
        }}
      />
    );

    const startOption = (
      <ContextMenuItem
        icon={<MdOutlinePlayCircle size={18} />}
        label={t('contextMenu.start')}
        onClick={handleStartDownload}
      />
    );

    const startFromPausedOption = (
      <ContextMenuItem
        icon={<MdOutlinePlayCircle size={18} />}
        label={t('contextMenu.start')}
        onClick={() => {
          onPause(
            download.id || '',
            download.location,
            download.controllerId,
            download.status,
          );
          onClose();
        }}
      />
    );

    const viewViaEmbedOption = download.videoUrl ? (
      <ContextMenuItem
        icon={<MdOutlinePlayCircle size={18} />}
        label={t('contextMenu.viewEmbedded')}
        onClick={() => {
          onViewEmbed(
            download.videoUrl ?? '',
            download.displayName ?? download.name ?? '',
            download.autoCaptionLocation,
            download.transcriptLocation,
          );
          onClose();
        }}
      />
    ) : null;

    if (download.status === 'failed') {
      return (
        <>
          {viewFolderOption}
          <ContextMenuItem
            icon={<BsArrowCounterclockwise size={18} />}
            label={t('contextMenu.retry')}
            onClick={() => {
              onRetry(download.id || '');
              onClose();
            }}
          />
          {removeOptions}
          {showLogOption}
          {activityTrackerOption}
        </>
      );
    }

    if (download.status === 'finished') {
      return (
        <>
          {viewFolderOption}
          <ContextMenuItem
            icon={<LuFileVideo size={18} />}
            label="Open with External Player"
            onClick={() => {
              onViewDownload(download.location, download.id);
              onClose();
            }}
          />
          {removeOptions}
          {showLogOption}
          {activityTrackerOption}
          {commonOptions}
          {renderPluginMenuItems()}
        </>
      );
    }

    if (download.status === 'initializing') {
      return (
        <>
          {viewFolderOption}
          {pausedOptions}
          {stopOptions}
          {showLogOption}
          {activityTrackerOption}
        </>
      );
    }

    if (download.status === 'paused') {
      return (
        <>
          {viewFolderOption}
          {startFromPausedOption}
          {stopOptions}
          {showLogOption}
          {activityTrackerOption}
        </>
      );
    }

    if (download.status === 'to download') {
      return (
        <>
          {viewFolderOption}
          {startOption}
          <ContextMenuItem
            icon={<MdEdit size={18} />}
            label={t('contextMenu.rename')}
            onClick={(e) => {
              e.stopPropagation();
              onRename(download.id || '', download.name || '');
              onClose();
            }}
          />
          {removeOptions}
          {activityTrackerOption}
        </>
      );
    }

    if (download.status === 'downloading') {
      return (
        <>
          {viewFolderOption}
          {pausedOptions}
          {stopOptions}
          {showLogOption}
          {activityTrackerOption}
          {commonOptions}
        </>
      );
    }

    return <>{viewFolderOption}</>;
  };

  const renderPluginMenuItems = () => {
    if (!pluginMenuItems || pluginMenuItems.length === 0) return null;

    // If 4 or fewer plugins, show them directly
    if (pluginMenuItems.length <= 4) {
      return (
        <>
          {/* Divider if there are other menu items */}
          <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>

          {/* Plugin menu items */}
          {pluginMenuItems.map((item) => (
            <ContextMenuItem
              key={item.id || item.label}
              icon={
                item.icon ? (
                  typeof item.icon === 'string' && isSvgString(item.icon) ? (
                    <span
                      dangerouslySetInnerHTML={{ __html: item.icon }}
                      className="text-black dark:text-white inline-flex w-4 h-4"
                    />
                  ) : (
                    <span>{item.icon}</span>
                  )
                ) : (
                  <span className="w-4 h-4" />
                )
              }
              label={item.label}
              onClick={async () => {
                const contextData = {
                  name: download.name || '',
                  downloadId: download.id || '',
                  videoUrl: allDownloads.find((d) => d.id === download.id)
                    ?.videoUrl,
                  location: download.location,
                  status: download.status,
                  duration: allDownloads.find((d) => d.id === download.id)
                    ?.duration,
                  size: allDownloads.find((d) => d.id === download.id)?.size,
                  ext: allDownloads.find((d) => d.id === download.id)?.ext,
                  captionLocation:
                    allDownloads.find((d) => d.id === download.id)
                      ?.transcriptLocation ||
                    allDownloads.find((d) => d.id === download.id)
                      ?.autoCaptionLocation,
                  transcriptLocation:
                    allDownloads.find((d) => d.id === download.id)
                      ?.transcriptLocation ||
                    allDownloads.find((d) => d.id === download.id)
                      ?.autoCaptionLocation,
                  thumbnailLocation: allDownloads.find(
                    (d) => d.id === download.id,
                  )?.thumnailsLocation,
                  extractorKey: allDownloads.find((d) => d.id === download.id)
                    ?.extractorKey,
                  getThumbnail: allDownloads.find((d) => d.id === download.id)
                    ?.getThumbnail,
                  getTranscript: allDownloads.find((d) => d.id === download.id)
                    ?.getTranscript,
                  thumbnails: allDownloads.find((d) => d.id === download.id)
                    ?.thumbnails,
                  automaticCaption: allDownloads.find((d) => d.id === download.id)
                    ?.automaticCaption,
                  osType: await window.downlodrFunctions.getOSType(),
                  seperatorType: window.downlodrFunctions.getPathSeparator(),
                };

                if (
                  item.handlerId &&
                  window.PluginHandlers &&
                  window.PluginHandlers[item.handlerId]
                ) {
                  window.PluginHandlers[item.handlerId](contextData);
                } else {
                  window.plugins.executeMenuItem(item.id || '', contextData);
                }

                onClose();
              }}
            />
          ))}
        </>
      );
    }

    // If more than 4 plugins, show a Plugin button
    return (
      <>
        {/* Divider if there are other menu items */}
        <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>

        <ContextMenuItem
          buttonRef={pluginButtonRef}
          icon={<PiPuzzlePieceBold size={17} />}
          label={`${t('contextMenu.plugins')} (${pluginMenuItems.length})`}
          chevron
          onClick={handlePluginMenuClick}
        />
      </>
    );
  };

  return (
    <>
      <div
        ref={menuRef}
        className="fixed bg-white dark:bg-darkMode border rounded-md shadow-lg py-1 z-50 dark:border-gray-700 min-w-[175px]"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        {renderMenuOptions()}
      </div>

      {/* Render submenus outside of main menu container */}
      {showTagMenu && (
        <div
          ref={tagSubmenuRef}
          className="fixed bg-white dark:bg-darkMode border rounded-md shadow-lg py-1 min-w-[180px] z-50 dark:border-gray-700"
          style={{
            left: `${submenuPosition.x}px`,
            top: `${submenuPosition.y}px`,
            maxHeight: '80vh',
            overflowY: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="m-2 px-3 py-2 flex flex-row border rounded dark:border-gray-700">
            <GoPlus size={22} className="ml-[-10px] mr-2 dark:text-gray-200" />
            <div className="flex-1">
              <input
                type="text"
                placeholder="Add new tag..."
                maxLength={120}
                onKeyDown={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (
                    e.key === 'Enter' &&
                    target.value.trim() &&
                    target.value.trim().length <= 120
                  ) {
                    const newTag = target.value.trim();

                    // Check for duplicates (case-insensitive)
                    const isDuplicate = mergedAvailableTags.some(
                      (existingTag) =>
                        existingTag.toLowerCase() === newTag.toLowerCase(),
                    );

                    if (isDuplicate) {
                      toast({
                        variant: 'destructive',
                        title: 'Duplicate Tag',
                        description: `Tag "${newTag}" already exists.`,
                        duration: 2000,
                      });
                    } else {
                      onAddTag(download.id || '', newTag);
                      toast({
                        title: 'Tag Added',
                        description: `Tag "${newTag}" has been added.`,
                        duration: 2000,
                      });
                    }
                    target.value = '';
                  }
                }}
                className="w-full outline-none dark:bg-darkMode dark:text-gray-200"
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Max 120 characters
              </div>
            </div>
          </div>
          <hr className="solid mt-2 mb-1 mx-2 w-[calc(100%-20px)] border-t-2 border-divider dark:border-gray-700" />
          <div className="max-h-48 overflow-y-auto">
            {mergedAvailableTags.map((tag) => (
              <button
                key={tag}
                className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-darkModeHover flex items-center gap-2 dark:text-gray-200"
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentTags.includes(tag)) {
                    onRemoveTag(download.id || '', tag);
                  } else {
                    onAddTag(download.id || '', tag);
                  }
                }}
              >
                <span className="dark:text-gray-200">
                  {currentTags.includes(tag) ? '✓' : ''}
                </span>
                <span>{tag}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showCategoryMenu && (
        <div
          ref={categorySubmenuRef}
          className="fixed bg-white dark:bg-darkMode border rounded-md shadow-lg py-1 min-w-[185px] z-50 dark:border-gray-700"
          style={{
            left: `${submenuPosition.x}px`,
            top: `${submenuPosition.y}px`,
            maxHeight: '80vh',
            overflowY: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="m-2 px-3 py-2 flex flex-row border rounded dark:border-gray-700">
            <GoPlus size={22} className="ml-[-10px] mr-2 dark:text-gray-200" />
            <div className="flex-1">
              <input
                type="text"
                placeholder="Add new category..."
                maxLength={120}
                onKeyDown={(e) => {
                  const target = e.target as HTMLInputElement;
                  if (
                    e.key === 'Enter' &&
                    target.value.trim() &&
                    target.value.trim().length <= 120
                  ) {
                    const newCategory = target.value.trim();

                    // Check for duplicates (case-insensitive)
                    const isDuplicate = mergedAvailableCategories.some(
                      (existingCategory) =>
                        existingCategory.toLowerCase() ===
                        newCategory.toLowerCase(),
                    );

                    if (isDuplicate) {
                      toast({
                        variant: 'destructive',
                        title: 'Duplicate Category',
                        description: `Category "${newCategory}" already exists.`,
                        duration: 2000,
                      });
                    } else {
                      // Remove current category first (single category per download)
                      if (currentCategories.length > 0) {
                        onRemoveCategory(download.id, currentCategories[0]);
                      }
                      onAddCategory(download.id, newCategory);
                      toast({
                        title: 'Category Added',
                        description: `Category "${newCategory}" has been added.`,
                        duration: 2000,
                      });
                    }
                    target.value = '';
                  }
                }}
                className="w-full outline-none dark:bg-darkMode dark:text-gray-200"
              />
            </div>
          </div>
          <hr className="solid mt-2 mb-1 mx-2 w-[calc(100%-20px)] border-t-2 border-divider dark:border-gray-700" />
          <div className="max-h-48 overflow-y-auto">
            {mergedAvailableCategories.map((category) => (
              <button
                key={category}
                className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-darkModeHover flex items-center gap-2 dark:text-gray-200"
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentCategories.includes(category)) {
                    onRemoveCategory(download.id, category);
                  } else {
                    if (currentCategories.length > 0) {
                      onRemoveCategory(download.id, currentCategories[0]);
                    }
                    onAddCategory(download.id, category);
                  }
                }}
              >
                <span className="dark:text-gray-200">
                  {currentCategories.includes(category) ? '✓' : ''}
                </span>
                <span>{category}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showPluginMenu && (
        <div
          ref={pluginSubmenuRef}
          className="fixed bg-white dark:bg-darkMode border rounded-md shadow-lg py-1 min-w-[200px] z-50 dark:border-gray-700"
          style={{
            left: `${submenuPosition.x}px`,
            top: `${submenuPosition.y}px`,
            maxHeight: '80vh',
            overflowY: 'auto',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {pluginMenuItems.map((item) => (
            <ContextMenuItem
              key={item.id || item.label}
              icon={
                item.icon ? (
                  typeof item.icon === 'string' && isSvgString(item.icon) ? (
                    <span
                      dangerouslySetInnerHTML={{ __html: item.icon }}
                      className="text-black dark:text-white inline-flex w-4 h-4"
                    />
                  ) : (
                    <span>{item.icon}</span>
                  )
                ) : (
                  <span className="w-4 h-4" />
                )
              }
              label={item.label}
              onClick={() => {
                const contextData = {
                  name: download.name,
                  downloadId: download.id,
                  videoUrl: allDownloads.find((d) => d.id === download.id)
                    ?.videoUrl,
                  location: download.location,
                  status: download.status,
                  duration: allDownloads.find((d) => d.id === download.id)
                    ?.duration,
                  size: allDownloads.find((d) => d.id === download.id)?.size,
                  ext: allDownloads.find((d) => d.id === download.id)?.ext,
                  captionLocation:
                    allDownloads.find((d) => d.id === download.id)
                      ?.transcriptLocation ||
                    allDownloads.find((d) => d.id === download.id)
                      ?.autoCaptionLocation,
                  transcriptLocation:
                    allDownloads.find((d) => d.id === download.id)
                      ?.transcriptLocation ||
                    allDownloads.find((d) => d.id === download.id)
                      ?.autoCaptionLocation,
                  thumbnailLocation: allDownloads.find(
                    (d) => d.id === download.id,
                  )?.thumnailsLocation,
                  extractorKey: allDownloads.find((d) => d.id === download.id)
                    ?.extractorKey,
                  getThumbnail: allDownloads.find((d) => d.id === download.id)
                    ?.getThumbnail,
                  getTranscript: allDownloads.find((d) => d.id === download.id)
                    ?.getTranscript,
                  thumbnails: allDownloads.find((d) => d.id === download.id)
                    ?.thumbnails,
                  automaticCaption: allDownloads.find((d) => d.id === download.id)
                    ?.automaticCaption,
                };

                if (
                  item.handlerId &&
                  window.PluginHandlers &&
                  window.PluginHandlers[item.handlerId]
                ) {
                  window.PluginHandlers[item.handlerId](contextData);
                } else {
                  window.plugins.executeMenuItem(item.id || '', contextData);
                }

                onClose();
              }}
            />
          ))}
        </div>
      )}
    </>
  );
};

export default DownloadContextMenu;
