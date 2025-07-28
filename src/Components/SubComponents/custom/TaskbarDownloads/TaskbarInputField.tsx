import { Copy, Download, Folder as FolderIcon, Settings } from '@/Assets/Icons';
import Input from '@/Components/SubComponents/shadcn/components/ui/input';
import { toast } from '@/Components/SubComponents/shadcn/hooks/use-toast';
import { cn } from '@/Components/SubComponents/shadcn/lib/utils';
import { cleanRawLink } from '@/DataFunctions/urlValidation';
import useDownloadStore from '@/Store/downloadStore';
import { useMainStore } from '@/Store/mainStore';
import {
  SearchableDownload,
  useTaskbarDownloadStore,
  Video,
} from '@/Store/taskbarDownloadStore';
import { useEffect, useRef, useState } from 'react';
import AdditionalOptions from './AdditionalOptions';
import FolderDirectory from './FolderDirectory';

const TaskbarInputField = () => {
  const downloadFolder = useTaskbarDownloadStore(
    (state) => state.downloadFolder,
  );
  const getTranscript = useTaskbarDownloadStore((state) => state.getTranscript);
  const getThumbnail = useTaskbarDownloadStore((state) => state.getThumbnail);
  const setDownloadFolder = useTaskbarDownloadStore(
    (state) => state.setDownloadFolder,
  );
  const clearSearch = useTaskbarDownloadStore((state) => state.clearSearch);
  const setSearchState = useTaskbarDownloadStore(
    (state) => state.setSearchState,
  );
  const searchState = useTaskbarDownloadStore((state) => state.searchState);
  const activeButton = useTaskbarDownloadStore((state) => state.activeButton);
  const setActiveButton = useTaskbarDownloadStore(
    (state) => state.setActiveButton,
  );
  const settings = useMainStore((state) => state.settings);
  const setDownload = useDownloadStore((state) => state.setDownload);
  const forDownloads = useDownloadStore((state) => state.forDownloads);
  const downloading = useDownloadStore((state) => state.downloading);
  const finishedDownloads = useDownloadStore(
    (state) => state.finishedDownloads,
  );
  const historyDownloads = useDownloadStore((state) => state.historyDownloads);
  const queuedDownloads = useDownloadStore((state) => state.queuedDownloads);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [videoTitle, setVideoTitle] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isValidUrl, setIsValidUrl] = useState<boolean>(false);
  const [isPlaylist, setIsPlaylist] = useState<boolean>(false);
  const [playlistVideos, setPlaylistVideos] = useState<Video[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());

  //  constant near the top of the component after other constants
  const RAW_YOUTUBE_PATTERN = /^https:\/\/youtu\.be\/[\w-]+(?:\?.*)?$/;

  // Calculate selectAll state
  const selectAll =
    selectedVideos.size === playlistVideos.length && playlistVideos.length > 0;

  // full debounce timer and URL validation states
  const [validationTimer, setValidationTimer] = useState<NodeJS.Timeout | null>(
    null,
  );
  const [, setIsValidatingUrl] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Validates link if it follows the standard format
  const urlPattern = new RegExp(
    '^(https?:\\/\\/)?' +
      '(' +
      '((([a-zA-Z\\d]([a-zA-Z\\d-]*[a-zA-Z\\d])*)\\.)+[a-zA-Z]{2,}|' +
      '((\\d{1,3}\\.){3}\\d{1,3}))' +
      '(\\:\\d+)?(\\/[-a-zA-Z\\d%_.~+@]*)*' +
      '(\\?[;&a-zA-Z\\d%_.~+@=-]*)?' +
      '(\\#[-a-zA-Z\\d_]*)?' +
      ')$',
    'i',
  );

  // Sets the max download speed
  const maxDownload =
    settings.defaultDownloadSpeed === 0
      ? ''
      : `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`;

  // Playlist validation and fetching metadata
  const fetchPlaylistInfo = async (url: string) => {
    setIsLoading(true);
    try {
      const info = await window.ytdlp.getPlaylistInfo({ url });

      setVideoTitle(info.data.title);

      // Ensure no duplicate videos in the playlist
      const uniqueVideos = new Map();

      // Iterates through each video link inside playlist and saves to unique videos
      info.data.entries.forEach(
        (video: {
          id: string;
          url: string;
          title: string;
          thumbnails: { url: string }[];
          channel: string;
        }) => {
          if (!uniqueVideos.has(video.id)) {
            uniqueVideos.set(video.id, {
              url: video.url,
              id: video.id,
              title: video.title,
              thumbnail: video.thumbnails[0]?.url || '',
              channel: video.channel,
            });
          }
        },
      );

      const videos = Array.from(uniqueVideos.values());
      setPlaylistVideos(videos);

      // Start with no videos selected when loading new playlist
      setSelectedVideos(new Set());
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Playlist Error',
        description: 'Failed to fetch playlist information',
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // URL validation with playlist check
  const isYouTubeLink = (url: string): 'playlist' | 'video' | 'invalid' => {
    const videoPattern = /^https:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+/;
    const playlistPattern =
      /^https:\/\/(?:www\.)?youtube\.com\/playlist\?list=[\w-]+$/;

    if (RAW_YOUTUBE_PATTERN.test(url)) {
      const cleanedUrl = cleanRawLink(url);
      setVideoUrl(cleanedUrl);
      return 'video';
    }
    // If the URL matches a video URL and has a "list" query, it's part of a playlist
    if (videoPattern.test(url) && url.includes('list=')) {
      return 'playlist';
    }
    // If it's a direct playlist URL
    else if (playlistPattern.test(url)) {
      return 'playlist';
    }
    return 'video';
  };

  // Handles search downloads by name, extractorKey, status, tags, and category
  const handleSearchDownloads = (searchQuery: string) => {
    if (!searchQuery.trim()) {
      clearSearch();
      return;
    }

    const combined: SearchableDownload[] = [
      ...forDownloads,
      ...downloading,
      ...finishedDownloads,
      ...historyDownloads,
      ...queuedDownloads,
    ];

    // Remove duplicates based on ID
    const uniqueDownloads = combined.filter(
      (download, index, self) =>
        index === self.findIndex((d) => d.id === download.id),
    );

    // Perform search with multiple criteria
    const searchResults: SearchableDownload[] = uniqueDownloads.filter(
      (download) => {
        const query = searchQuery.toLowerCase();
        return (
          download.name.toLowerCase().includes(query) ||
          download.extractorKey?.toLowerCase().includes(query) ||
          download.status.toLowerCase().includes(query) ||
          download.tags?.some((tag) => tag.toLowerCase().includes(query)) ||
          download.category?.some((cat) => cat.toLowerCase().includes(query))
        );
      },
    );

    // Update search state
    setSearchState({
      isSearchActive: true,
      searchQuery: searchQuery.trim(),
      searchResults: searchResults,
    });
  };

  // Separate validation function
  const validateUrl = (url: string) => {
    // Check if the URL starts with http or https to determine if it's a valid URL
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (!urlPattern.test(url)) {
        toast({
          variant: 'destructive',
          title: 'Invalid URL',
          description: 'Please enter a valid URL',
          duration: 3000,
        });
        return;
      }

      try {
        new URL(url);
        const linkType = isYouTubeLink(url);

        if (linkType === 'playlist') {
          setIsPlaylist(true);
          setIsValidUrl(true);
          fetchPlaylistInfo(url);
        } else if (linkType === 'video') {
          setIsPlaylist(false);
          setIsValidUrl(true);
        }
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Invalid URL Format',
          description: 'The URL format is not valid',
          duration: 3000,
        });
      }
    } else {
      // Trigger search downloads if the URL is not a valid URL pattern
      setSearchState({
        ...searchState,
        isSearchActive: true,
      });
      handleSearchDownloads(url);
    }
  };

  // Function for receiving download url and handling next actions depending if url is a single download link or playlist link
  const handleUrl = async (url: string) => {
    setVideoUrl(url);
    setIsValidUrl(false);
    setIsPlaylist(false);
    setSelectedVideos(new Set());

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setSearchState({
        ...searchState,
        isSearchActive: true,
      });
    }

    // Clear any existing validation timer
    if (validationTimer) {
      clearTimeout(validationTimer);
    }

    // Skip validation for empty URLs
    if (!url.trim()) {
      setActiveButton(null);
      clearSearch();
      return;
    }

    // Set a new validation timer (500ms delay)
    setIsValidatingUrl(true);
    const timer = setTimeout(() => {
      validateUrl(url);
      setIsValidatingUrl(false);
    }, 500);

    setValidationTimer(timer);
  };

  // Keydown handler that determines whether to search or download
  const handleKeyDown = () => {
    const trimmedUrl = videoUrl.trim();

    // Early return for empty input
    if (!trimmedUrl) {
      if (searchState.isSearchActive) {
        clearSearch();
      }
      return;
    }

    // Check if input is a URL (http/https) or search query
    const isUrlInput =
      trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://');

    if (!isUrlInput) {
      // Non-URL input should trigger search
      setSearchState({
        ...searchState,
        isSearchActive: true,
      });
      handleSearchDownloads(trimmedUrl);
      return;
    }

    // For URL inputs, check if it's been validated and ready for download
    const isValidYouTubeShort = RAW_YOUTUBE_PATTERN.test(trimmedUrl);
    const isValidStandardUrl = urlPattern.test(trimmedUrl);

    if ((isValidStandardUrl || isValidYouTubeShort) && isValidUrl) {
      handleDownload();
    } else if (isValidStandardUrl || isValidYouTubeShort) {
      // URL format is valid but not yet validated - trigger immediate validation
      // Clear any existing validation timer and validate immediately
      if (validationTimer) {
        clearTimeout(validationTimer);
        setValidationTimer(null);
      }
      validateUrl(trimmedUrl);
    } else {
      // Invalid URL format - treat as search
      handleSearchDownloads(trimmedUrl);
    }
  };

  // Cleans up states of download modal variable
  const resetModal = () => {
    setVideoUrl('');
    setIsValidUrl(false);
    setIsPlaylist(false);
    setVideoTitle(null);
    setPlaylistVideos([]);
    setSelectedVideos(new Set());
    setDownloadFolder(settings.defaultLocation);
  };

  const handleDownload = async () => {
    try {
      if (isPlaylist) {
        const selectedVideosList = playlistVideos.filter((video) =>
          selectedVideos.has(video.id),
        );
        // If link is a YT playlist link, checks if there is at least one video selected for download
        if (selectedVideosList.length === 0) {
          toast({
            variant: 'destructive',
            title: 'Selection Error',
            description: 'Please select at least one video to download',
            duration: 3000,
          });
          return;
        }

        // Download each selected video with user preferences
        for (const video of selectedVideosList) {
          setDownload(video.url, downloadFolder, maxDownload, {
            getTranscript,
            getThumbnail,
          });
        }

        setActiveButton(null);
      } else {
        // Single video download with user preferences
        setDownload(videoUrl, downloadFolder, maxDownload, {
          getTranscript,
          getThumbnail,
        });
      }

      resetModal();

      toast({
        title: 'Download Queued',
        description: 'Getting video metadata...',
        duration: 3000,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to Add to Download Queue',
        duration: 3000,
      });
    }
  };

  // Selecting all videos from playlist
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedVideos(new Set());
    } else {
      setSelectedVideos(new Set(playlistVideos.map((video) => video.id)));
    }
  };

  // Selecting videos from playlist
  const handleVideoSelect = (id: string) => {
    setSelectedVideos((prevSelected) => {
      const newSelected = new Set(prevSelected);
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
      return newSelected;
    });
  };

  // Close additional options and folder directory modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        !target.closest('#additional-options-modal') &&
        !target.closest('#folder-directory-modal') &&
        !target.closest('#taskbar-input-field')
      ) {
        setActiveButton(null);
      }
    };

    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Opens additional options when playlist is valid
  useEffect(() => {
    if (isPlaylist && isValidUrl) {
      setActiveButton('settings');
    }
  }, [isPlaylist, isValidUrl]);

  // Removes focus from input field when window is blurred or mouse leaves the window
  // This is to prevent the input field from being focused so automatic download will still be triggered
  useEffect(() => {
    const handleWindowBlur = () => {
      if (inputRef.current && !videoUrl.trim()) {
        inputRef.current.blur();
      }
    };

    const handleMouseLeave = () => {
      if (inputRef.current && !videoUrl.trim()) {
        inputRef.current.blur();
      }
    };

    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <div
      id="taskbar-input-field"
      className="flex-shrink flex-grow-0 w-full max-w-[538px] min-w-[200px] relative"
    >
      <Input
        ref={inputRef}
        maxLength={searchState.isSearchActive ? 50 : undefined}
        placeholder="Search downloads or type a URL"
        className="text-xs py-4 pr-10"
        leftIcons={[
          {
            icon: <Copy className="text-darkModeHover" />,
            onClick: () => {
              navigator.clipboard
                .writeText(videoUrl)
                .then(() => {
                  toast({
                    title: 'Copied to clipboard',
                    description: 'The URL has been copied to your clipboard',
                    duration: 3000,
                  });
                })
                .catch(() => {
                  toast({
                    variant: 'destructive',
                    title: 'Copy URL Failed',
                    description: 'Unable to copy URL to clipboard',
                    duration: 3000,
                  });
                });
            },
            disabled: !videoUrl.trim(),
            tooltip: videoUrl.trim() && 'Copy',
          },
        ]}
        rightIcons={[
          {
            icon: (
              <Settings
                className={cn(
                  'text-darkModeHover',
                  activeButton === 'settings' && 'text-primary',
                )}
              />
            ),
            onClick: () => {
              setActiveButton(activeButton === 'settings' ? null : 'settings');
            },
            tooltip:
              'Get the transcript and Thumbnail along with your download.',
          },
          {
            icon: (
              <FolderIcon
                className={cn(
                  'text-darkModeHover',
                  activeButton === 'folder' && 'text-primary',
                )}
              />
            ),
            onClick: () => {
              setActiveButton(activeButton === 'folder' ? null : 'folder');
            },
            tooltip: downloadFolder,
          },
        ]}
        actionIcon={{
          icon: (
            <Download
              className={cn(
                'text-darkModeHover',
                ((isPlaylist && selectedVideos.size > 0) ||
                  (!isPlaylist && isValidUrl)) &&
                  'text-primary',
              )}
            />
          ),
          onClick: handleDownload,
          tooltip: 'Download',
          disabled:
            !isValidUrl ||
            isLoading ||
            (isPlaylist && selectedVideos.size === 0),
        }}
        disabled={isLoading}
        value={videoUrl}
        onChange={(e) => handleUrl(e.target.value)}
        onContextMenu={(e) => {
          e.preventDefault();
          window.downlodrFunctions.showInputContextMenu();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            handleKeyDown();
          }
        }}
      />

      {activeButton === 'settings' && (
        <AdditionalOptions
          isPlaylist={isPlaylist}
          isLoading={isLoading}
          selectAll={selectAll}
          handleSelectAll={handleSelectAll}
          videoTitle={videoTitle}
          playlistVideos={playlistVideos}
          selectedVideos={selectedVideos}
          handleVideoSelect={handleVideoSelect}
        />
      )}
      {activeButton === 'folder' && <FolderDirectory />}
    </div>
  );
};

export default TaskbarInputField;
