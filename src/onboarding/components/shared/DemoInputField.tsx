import { Copy, Download, Folder as FolderIcon, Settings } from '@/assets/icon';
import Input from '@/core-app/components/shadcn/components/ui/input';
import { cn } from '@/core-app/components/shadcn/lib/utils';
import React, { useEffect, useRef, useState } from 'react';
import { FaYoutube } from 'react-icons/fa';
import { FiPlayCircle } from 'react-icons/fi';
import { LuNewspaper } from 'react-icons/lu';
import { MdOutlineInfo } from 'react-icons/md';
import { DUMMY_PLAYLIST } from '../../types/onboardingTypes';

interface DemoInputFieldProps {
  url: string;
  onDownload: () => void;
  disabled?: boolean;
  isPlaylist?: boolean;
  isSubscription?: boolean;
  subscriptionVariant?: 'youtube' | 'website';
}

const ALL_IDS = new Set(DUMMY_PLAYLIST.videos.map((v) => v.id));

const DemoInputField: React.FC<DemoInputFieldProps> = ({
  url,
  onDownload,
  disabled,
  isPlaylist = false,
  isSubscription = false,
  subscriptionVariant = 'youtube',
}) => {
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(
    new Set(ALL_IDS),
  );

  const containerRef = useRef<HTMLDivElement>(null);

  // Close panel and reset selections when the demo is reset (disabled flips back to false)
  useEffect(() => {
    if (!disabled) {
      setPanelOpen(false);
      setSelectedVideos(new Set(ALL_IDS));
    }
  }, [disabled]);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target.closest('#demo-additional-options-modal') &&
        !target.closest('#taskbar-input-field')
      ) {
        setPanelOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const selectAll = selectedVideos.size === DUMMY_PLAYLIST.videos.length;

  const handleSelectAll = () => {
    setSelectedVideos(selectAll ? new Set() : new Set(ALL_IDS));
  };

  const handleVideoSelect = (id: string) => {
    setSelectedVideos((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleDownloadClick = () => {
    if (isPlaylist) {
      setPanelOpen((prev) => !prev);
    } else {
      onDownload();
    }
  };

  const handleConfirmDownload = () => {
    if (selectedVideos.size === 0) return;
    setPanelOpen(false);
    onDownload();
  };

  const actionEnabled = isPlaylist
    ? Boolean(url) && !disabled
    : Boolean(url) && !disabled;

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex items-center flex-shrink flex-grow-0 min-w-[200px] relative ml-2',
        isSubscription ? 'gap-2 w-full max-w-[620px]' : 'w-full max-w-[538px]',
      )}
    >
      <div id="taskbar-input-field" className={cn(!isSubscription && 'flex-1')}>
        <Input
          readOnly
          placeholder="Paste a URL to get started…"
          className="text-xs py-4 pr-10 pointer-events-none"
          leftIcons={[
            {
              icon: (
                <Copy className="text-darkModeHover dark:text-darkModeLight" />
              ),
              disabled: true,
            },
          ]}
          rightIcons={[
            {
              icon: (
                <span
                  id="demo-settings-btn"
                  className="flex items-center gap-1.5 p-2"
                >
                  <Settings
                    className={cn(
                      'text-darkModeHover dark:text-darkModeLight',
                      panelOpen && 'text-primary',
                    )}
                  />
                </span>
              ),
              disabled: true,
            },
            {
              icon: (
                <FolderIcon className="text-darkModeHover dark:text-darkModeLight" />
              ),
              disabled: true,
            },
          ]}
          value={url}
        />
      </div>

      {!isSubscription && (
        <>
          <div className="h-7 w-px bg-[#D1D5DB] dark:bg-gray-600 mx-1" />
          <button
            id="demo-download-btn"
            type="button"
            onClick={handleDownloadClick}
            disabled={!url || disabled}
            className={cn(
              'flex items-center justify-center w-5 h-5',
              (!url || disabled) && 'opacity-50 cursor-not-allowed',
            )}
          >
            <Download
              className={cn(
                'text-darkModeHover',
                actionEnabled && 'text-primary',
              )}
            />
          </button>
        </>
      )}

      {isSubscription && (
        <button
          onClick={handleDownloadClick}
          disabled={!url || disabled}
          className={cn(
            'flex-shrink-0 flex items-center gap-1.5 px-3 py-[7px] rounded-md text-xs font-semibold transition-colors',
            !url || disabled
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-darkModeHover dark:text-gray-500'
              : 'bg-primary text-white hover:bg-primary/90 cursor-pointer',
          )}
        >
          {subscriptionVariant === 'website' ? (
            <LuNewspaper size={14} />
          ) : (
            <FaYoutube size={14} />
          )}
          {subscriptionVariant === 'website' ? 'Add Website' : 'Subscribe'}
        </button>
      )}

      {isPlaylist && panelOpen && (
        <div
          id="demo-additional-options-modal"
          className="absolute top-full right-10 mt-1 max-w-[1000px] min-w-0 h-fit z-50 bg-white dark:bg-darkModeDropdown border border-divider dark:border-darkModeCompliment rounded-lg shadow-lg p-4 flex gap-4"
        >
          {/* Left: options */}
          <div className="flex flex-col gap-2 w-fit">
            <p className="dark:text-darkModeLight font-semibold text-sm text-nowrap">
              Additional Options
            </p>
            <p className="text-xxs text-gray-500 dark:text-darkModeLight">
              Configure per-video settings
            </p>
            <div className="flex items-center gap-4 mt-1">
              <div className="flex items-center gap-1">
                <input
                  type="checkbox"
                  id="demo-opt-transcript"
                  disabled
                  className="size-4 opacity-40 cursor-not-allowed"
                />
                <label
                  htmlFor="demo-opt-transcript"
                  className="font-medium text-xs dark:text-darkModeLight"
                >
                  Get Closed Captions
                </label>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="checkbox"
                  id="demo-opt-thumbnail"
                  disabled
                  className="size-4 opacity-40 cursor-not-allowed"
                />
                <label
                  htmlFor="demo-opt-thumbnail"
                  className="font-medium text-xs dark:text-darkModeLight"
                >
                  Get Thumbnail
                </label>
              </div>
            </div>
            <hr className="border-t border-divider dark:border-gray-700 my-2 flex-grow" />
            <div className="flex items-center gap-1.5">
              <MdOutlineInfo className="size-4 text-gray-400 dark:text-darkModeLight" />
              <p className="text-[10px] text-gray-500 dark:text-darkModeLight italic">
                Captions and thumbnails are downloaded alongside each video
              </p>
            </div>
          </div>

          {/* Right: playlist video list */}
          <div className="w-3/5 border-l border-divider dark:border-gray-700 pl-4 flex flex-col">
            <div className="sticky top-0 bg-white dark:bg-darkModeDropdown pb-4 z-10 mt-1">
              <div className="select-all flex items-center justify-between">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="demo-panel-select-all"
                    checked={selectAll}
                    onChange={handleSelectAll}
                    className="mr-2"
                  />
                  <label htmlFor="demo-panel-select-all">
                    <p className="dark:text-darkModeLight font-medium px-2 text-xs">
                      {DUMMY_PLAYLIST.title.length > 50
                        ? `${DUMMY_PLAYLIST.title.slice(0, 50)}…`
                        : DUMMY_PLAYLIST.title}
                    </p>
                  </label>
                </div>
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  {selectedVideos.size} selected
                </span>
              </div>
            </div>

            <div className="space-y-3 max-h-[180px] overflow-y-auto">
              {DUMMY_PLAYLIST.videos.map((video) => (
                <div
                  key={video.id}
                  className="flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-darkModeHover rounded-lg"
                >
                  <input
                    type="checkbox"
                    id={`demo-panel-${video.id}`}
                    checked={selectedVideos.has(video.id)}
                    onChange={() => handleVideoSelect(video.id)}
                    className="flex-none"
                  />
                  <div className="w-24 h-16 bg-black rounded flex items-center justify-center flex-shrink-0">
                    <FiPlayCircle size={16} className="text-white/60" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-xs font-medium dark:text-darkModeLight truncate break-all">
                      {video.title}
                    </h1>
                    <p className="text-xxs text-gray-500 dark:text-gray-400">
                      {video.channel}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 flex justify-end">
              <button
                onClick={handleConfirmDownload}
                disabled={selectedVideos.size === 0}
                className={cn(
                  'text-xs font-medium px-3 py-1.5 rounded-md transition-colors',
                  selectedVideos.size > 0
                    ? 'bg-primary text-white hover:bg-primary/90 cursor-pointer'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-darkModeHover dark:text-gray-500',
                )}
              >
                Download{' '}
                {selectedVideos.size > 0
                  ? `${selectedVideos.size} video${
                      selectedVideos.size > 1 ? 's' : ''
                    }`
                  : 'Selected'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DemoInputField;
