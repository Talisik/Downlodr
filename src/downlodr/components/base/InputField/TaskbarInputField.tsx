import { Copy, Download, Folder as FolderIcon, Settings } from '@/assets/icon';
import { useAfdaStore } from '@/afda/store/afdaStore';
import { isArticleSiteUrl } from '@/afda/utils/articleSiteDetection';
import { useArticleDownloadStore } from '@/afda/store/articleDownloadStore';
import {
  fetchAsDataUrl,
  generateArticleDocx,
  sanitizeFilename,
} from '@/afda/utils/articleDocxGenerator';
import Input from '@/core-app/components/shadcn/components/ui/input';
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';
import { cn } from '@/core-app/components/shadcn/lib/utils';
import { waitForStoreRehydration } from '@/core-app/hooks/useStoreRehydration';
import { useSettingStore } from '@/core-app/store/settingsStore';
import { cleanRawLink } from '@/core-app/utils/urlValidation';
import { useDownloadStore } from '@/downlodr/store/downloadStore';
import { processFileName } from '@/downlodr/utils/download/filterName';
import {
  mapArticleToSearchable,
  SearchableDownload,
  useTaskbarDownloadStore,
  Video,
} from '@/downlodr/store/taskbarDownloadStore';
import type { PlaylistInfoEntry } from '@/global';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSkedulosaStore } from '@/skedulosa/store/skedulosaStore';
import { useDropdownAnimation } from '@/core-app/hooks/animation/useDropdownAnimation';
import AdditionalOptions from './AdditionalOptions';
import FolderDirectory from './FolderDirectory';

const TaskbarInputField = () => {
  const { t } = useTranslation('downlodr');
  const navigate = useNavigate();
  const setPendingSubscribeUrl = useSkedulosaStore(
    (s) => s.setPendingSubscribeUrl,
  );
  const setPendingExtensionSubscribe = useSkedulosaStore(
    (s) => s.setPendingExtensionSubscribe,
  );
  const scheduledChannels = useSkedulosaStore((s) => s.scheduledChannels);
  const downloadFolder = useTaskbarDownloadStore(
    (state) => state.downloadFolder,
  );
  const getTranscript = useTaskbarDownloadStore((state) => state.getTranscript);
  const getThumbnail = useTaskbarDownloadStore((state) => state.getThumbnail);
  const setDownloadFolder = useTaskbarDownloadStore(
    (state) => state.setDownloadFolder,
  );
  const pendingInputUrl = useTaskbarDownloadStore(
    (state) => state.pendingInputUrl,
  );
  const setPendingInputUrl = useTaskbarDownloadStore(
    (state) => state.setPendingInputUrl,
  );
  const pendingExtensionDownload = useTaskbarDownloadStore(
    (state) => state.pendingExtensionDownload,
  );
  const setPendingExtensionDownload = useTaskbarDownloadStore(
    (state) => state.setPendingExtensionDownload,
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
  const settings = useSettingStore((state) => state.settings);
  const setDownload = useDownloadStore((state) => state.setDownload);
  const addQueue = useDownloadStore((state) => state.addQueue);
  const removeFromForDownloads = useDownloadStore(
    (state) => state.removeFromForDownloads,
  );
  const forDownloads = useDownloadStore((state) => state.forDownloads);
  const downloading = useDownloadStore((state) => state.downloading);
  const finishedDownloads = useDownloadStore(
    (state) => state.finishedDownloads,
  );
  const historyDownloads = useDownloadStore((state) => state.historyDownloads);
  const queuedDownloads = useDownloadStore((state) => state.queuedDownloads);
  const fetchAndOpenArticle = useAfdaStore((state) => state.fetchAndOpen);
  const fetchState = useAfdaStore((state) => state.fetchState);
  const articleData = useAfdaStore((state) => state.articleData);
  const articleError = useAfdaStore((state) => state.articleError);
  const articleDownloads = useArticleDownloadStore(
    (state) => state.articleDownloads,
  );
  const addArticleDownload = useArticleDownloadStore(
    (state) => state.addArticleDownload,
  );
  const updateArticleDownload = useArticleDownloadStore(
    (state) => state.updateArticleDownload,
  );
  const pendingArticleIdRef = useRef<string | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [videoTitle, setVideoTitle] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>(
    searchState.isSearchActive ? searchState.searchQuery : '',
  );
  const [isValidUrl, setIsValidUrl] = useState<boolean>(false);
  const [isArticle, setIsArticle] = useState<boolean>(false);
  const [isPlaylist, setIsPlaylist] = useState<boolean>(false);
  const [playlistVideos, setPlaylistVideos] = useState<Video[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());
  const [isAdditionalOptionsOpen, setIsAdditionalOptionsOpen] =
    useState<boolean>(false);

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
  const shouldAutoDownload = useRef(false);
  const pendingFormatId = useRef<string | null>(null);
  const silentDownloadUrlRef = useRef<string | null>(null);

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
      const info = await window.ytdlp.getPlaylistInfo(url);

      setVideoTitle(info.data.title);

      // Ensure no duplicate videos in the playlist
      const uniqueVideos = new Map();

      // Iterates through each video link inside playlist and saves to unique videos
      info.data.entries.forEach((video: PlaylistInfoEntry) => {
        if (!uniqueVideos.has(video.id)) {
          uniqueVideos.set(video.id, {
            url: video.url,
            id: video.id,
            title: video.title,
            thumbnail: video.thumbnails[0]?.url || '',
            channel: video.channel,
          });
        }
      });

      const videos = Array.from(uniqueVideos.values());
      setPlaylistVideos(videos);

      // Start with no videos selected when loading new playlist
      setSelectedVideos(new Set());
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('taskbarInput.toast.playlistErrorTitle'),
        description: t('taskbarInput.toast.playlistErrorDesc'),
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
    const channelPattern =
      /^https:\/\/(?:www\.)?youtube\.com\/(?:@[\w.-]+|c\/[\w.-]+|user\/[\w.-]+|channel\/[\w-]+)(?:\/[^?]*)?(?:\?.*)?$/;

    if (RAW_YOUTUBE_PATTERN.test(url)) {
      const cleanedUrl = cleanRawLink(url);
      setVideoUrl(cleanedUrl);
      return 'video';
    }
    // Reject YouTube channel URLs — yt-dlp cannot handle them as single downloads
    if (channelPattern.test(url)) {
      return 'invalid';
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
      ...articleDownloads.map(mapArticleToSearchable),
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
      // Article site URL detected — light up the download icon, don't open panel yet
      if (isArticleSiteUrl(url)) {
        setIsArticle(true);
        clearSearch();
        return;
      }

      if (!urlPattern.test(url)) {
        toast({
          variant: 'destructive',
          title: t('taskbarInput.toast.invalidUrlTitle'),
          description: t('taskbarInput.toast.invalidUrlDesc'),
          duration: 3000,
        });
        return;
      }

      try {
        new URL(url);
        const linkType = isYouTubeLink(url);

        if (linkType === 'invalid') {
          setPendingSubscribeUrl(url);
          navigate(
            scheduledChannels.length > 0
              ? '/skedulosa/subscription'
              : '/skedulosa/no-schedule',
          );
          toast({
            title: t('taskbarInput.toast.channelDetectedTitle'),
            description: t('taskbarInput.toast.channelDetectedDesc'),
            duration: 4000,
          });
          setVideoUrl('');
          setIsValidUrl(false);
        } else if (linkType === 'playlist') {
          toast({
            title: t('taskbarInput.toast.playlistDetectedTitle'),
            description: t('taskbarInput.toast.playlistDetectedDesc'),
            duration: 4000,
          });
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
          title: t('taskbarInput.toast.invalidUrlFormatTitle'),
          description: t('taskbarInput.toast.invalidUrlFormatDesc'),
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
  // Pass { silent: true } to validate without showing the URL in the input (used for extension-injected URLs)
  const handleUrl = (url: string, { fromChromeExtension = false } = {}) => {
    if (fromChromeExtension) {
      silentDownloadUrlRef.current = url;
    } else {
      setVideoUrl(url);
    }

    setIsValidUrl(false);
    setIsArticle(false);
    setIsPlaylist(false);
    setSelectedVideos(new Set());

    if (
      !fromChromeExtension &&
      !url.startsWith('http://') &&
      !url.startsWith('https://')
    ) {
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
      if (!fromChromeExtension) clearSearch();
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

    // Article keyword — treat download icon click as the trigger, not Enter key alone
    if (isArticle) {
      handleDownload();
      return;
    }

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

  const { ref: additionalOptionsRef, mounted: additionalOptionsMounted } =
    useDropdownAnimation(activeButton === 'settings' && isAdditionalOptionsOpen);

  const { ref: folderRef, mounted: folderMounted } =
    useDropdownAnimation(activeButton === 'folder');

  // Centralized function to close additional options
  const closeAdditionalOptions = useCallback(() => {
    setActiveButton(null);
    setIsAdditionalOptionsOpen(false);
  }, []);

  // Cleans up states of download modal variable
  const resetModal = () => {
    setVideoUrl('');
    setIsValidUrl(false);
    setIsArticle(false);
    setIsPlaylist(false);
    setVideoTitle(null);
    setPlaylistVideos([]);
    setSelectedVideos(new Set());
    setDownloadFolder(settings.defaultLocation);
    closeAdditionalOptions();
  };

  const handleDownload = async (
    autoQueueFormatId?: string,
    autoDownload?: boolean,
  ) => {
    // Article flow — add to store in for_download state, open side panel for preview
    if (isArticle) {
      const id = crypto.randomUUID();
      const articleUrl = silentDownloadUrlRef.current ?? videoUrl;
      addArticleDownload(id, articleUrl.trim());
      fetchAndOpenArticle(articleUrl.trim());
      silentDownloadUrlRef.current = null;
      resetModal();
      return;
    }

    try {
      // Wait for store rehydration before processing downloads
      // This prevents the first URL registration issue during app startup
      await waitForStoreRehydration();

      console.log('handleDownload');
      if (isPlaylist) {
        const selectedVideosList = playlistVideos.filter((video) =>
          selectedVideos.has(video.id),
        );
        // If link is a YT playlist link, checks if there is at least one video selected for download
        if (selectedVideosList.length === 0) {
          toast({
            variant: 'destructive',
            title: t('taskbarInput.toast.selectionErrorTitle'),
            description: t('taskbarInput.toast.selectionErrorDesc'),
            duration: 3000,
          });
          return;
        }

        // Generate a unique batch ID for this playlist download
        const playlistBatchId = `playlist_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`;

        // Download each selected video with user preferences and playlist tracking
        for (const video of selectedVideosList) {
          setDownload(video.url, downloadFolder, maxDownload, {
            getTranscript,
            getThumbnail,
            isFromPlaylist: true,
            playlistBatchId,
          });
        }
      } else {
        console.log('single video download');
        // Single video download with user preferences
        const urlToDownload = silentDownloadUrlRef.current ?? videoUrl;
        silentDownloadUrlRef.current = null;
        setDownload(urlToDownload, downloadFolder, maxDownload, {
          getTranscript,
          getThumbnail,
          autoQueueFormatId,
          autoDownload,
        });
      }

      resetModal();

      toast({
        title: t('taskbarInput.toast.downloadQueuedTitle'),
        description: t('taskbarInput.toast.downloadQueuedDesc'),
        duration: 3000,
      });
    } catch (error) {
      const hasInternetConnection =
        await window.downlodrFunctions.checkInternetConnection();
      if (!hasInternetConnection) {
        toast({
          variant: 'destructive',
          title: t('taskbarInput.toast.noInternetTitle'),
          description: t('taskbarInput.toast.noInternetDesc'),
          duration: 3000,
        });
        return;
      } else {
        toast({
          variant: 'destructive',
          title: t('taskbarInput.toast.errorTitle'),
          description: t('taskbarInput.toast.errorDesc'),
          duration: 3000,
        });
      }
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

  // Consume a URL redirected from another page (e.g. Skedulosa video link detection)
  useEffect(() => {
    if (pendingInputUrl) {
      handleUrl(pendingInputUrl);
      setPendingInputUrl(null);
    }
  }, [pendingInputUrl]);

  // Consume a download triggered while the user was on a skedulosa page
  // (TaskbarInputField was not mounted then, so it was deferred via the store)
  useEffect(() => {
    if (!pendingExtensionDownload) return;
    shouldAutoDownload.current = true;
    pendingFormatId.current = pendingExtensionDownload.format_id ?? null;
    handleUrl(pendingExtensionDownload.url, { fromChromeExtension: true });
    setPendingExtensionDownload(null);
  }, [pendingExtensionDownload]);

  // Receive URL from browser extension via IPC
  useEffect(() => {
    window.extensionDownloadBridge?.onDownload(
      ({ url, format_id, autoDownload }) => {
        if (autoDownload) {
          shouldAutoDownload.current = true;
          console.log("sent format id", format_id)
          pendingFormatId.current = format_id ?? null;
        } else {
          setPendingExtensionSubscribe(true);
        }
        handleUrl(url, { fromChromeExtension: true });
      },
    );
    return () => {
      window.extensionDownloadBridge?.offDownload();
    };
  }, []);

  // Auto-trigger download when URL validation completes (from /download endpoint)
  useEffect(() => {
    if (shouldAutoDownload.current && (isValidUrl || isArticle)) {
      console.log('inside auto download');
      shouldAutoDownload.current = false;
      handleDownload(pendingFormatId.current ?? undefined, true);
      pendingFormatId.current = null;
    }
  }, [isValidUrl, isArticle]);

  // Auto-queue watcher: fires when setDownload marks an entry pendingAutoQueue=true
  // (extension /download flow). Runs the exact same logic as DownloadButton.handleDownloadClick.
  useEffect(() => {
    const pending = forDownloads.filter((d) => d.pendingAutoQueue);
    if (pending.length === 0) return;

    pending.forEach(async (download) => {
      // Clear the flag immediately to prevent double-firing
      useDownloadStore.setState((state) => ({
        forDownloads: state.forDownloads.map((d) =>
          d.id === download.id ? { ...d, pendingAutoQueue: false } : d,
        ),
      }));

      const processedName = await processFileName(
        download.location,
        download.name,
        download.ext || download.audioExt,
      );

      console.log("format", download)
      addQueue({
        videoUrl: download.videoUrl ?? '',
        name: `${processedName}.${download.ext}`,
        downloadName: `${processedName}.${download.ext}`,
        displayName: download.displayName ?? `${processedName}.${download.ext}`,
        size: download.size,
        speed: download.speed,
        channelName: download.channelName ?? '',
        timeLeft: download.timeLeft ?? '',
        DateAdded: new Date().toISOString(),
        progress: 0,
        location: download.location ?? '',
        status: 'queued',
        ext: download.ext,
        formatId: download.formatId,
        audioExt: download.audioExt,
        audioFormatId: download.audioFormatId,
        extractorKey: download.extractorKey,
        limitRate: maxDownload,
        automaticCaption: download.automaticCaption,
        thumbnails: download.thumbnails,
        getTranscript: download.getTranscript ?? false,
        getThumbnail: download.getThumbnail ?? false,
        duration: download.duration ?? 60,
        isCreateFolder: true,
        description: download.description,
        chapters: download.chapters,
        autoCaptionLocation: download.autoCaptionLocation,
        thumnailsLocation: download.thumnailsLocation,
        transcriptLocation: download.transcriptLocation,
      });

      removeFromForDownloads(download.id);
    });
  }, [forDownloads]);

  // Clear input when search is cleared externally (e.g. via toolbar chip × button)
  useEffect(() => {
    if (
      !searchState.isSearchActive &&
      videoUrl &&
      !videoUrl.startsWith('http')
    ) {
      setVideoUrl('');
    }
  }, [searchState.isSearchActive]);

  // Sync taskbar downloadFolder with main store defaultLocation
  useEffect(() => {
    if (
      settings.defaultLocation &&
      settings.defaultLocation !== downloadFolder
    ) {
      setDownloadFolder(settings.defaultLocation);
    }
  }, [settings.defaultLocation, downloadFolder, setDownloadFolder]);

  // Close additional options and folder directory modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        !target.closest('#additional-options-modal') &&
        !target.closest('#folder-directory-modal') &&
        !target.closest('#taskbar-input-field')
      ) {
        closeAdditionalOptions();
      }
    };

    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [closeAdditionalOptions]);

  // Opens additional options when playlist is valid
  useEffect(() => {
    if (isPlaylist && isValidUrl) {
      setActiveButton('settings');
      setIsAdditionalOptionsOpen(true);
    }
  }, [isPlaylist, isValidUrl]);

  useEffect(() => {
    if (!pendingArticleIdRef.current) return;

    if (fetchState === 'success' && articleData) {
      const id = pendingArticleIdRef.current;
      pendingArticleIdRef.current = null;
      const currentDownloadFolder =
        useTaskbarDownloadStore.getState().downloadFolder;

      (async () => {
        try {
          const buffer = await generateArticleDocx(articleData);
          const filename = sanitizeFilename(articleData.article_title);
          const filePath = await window.downlodrFunctions.joinDownloadPath(
            currentDownloadFolder,
            `${filename}.docx`,
          );

          const result = await window.downlodrFunctions.saveBufferToFile(
            Array.from(buffer),
            filePath,
          );

          const fileSize = result.success
            ? ((await window.downlodrFunctions.getFileSize(filePath)) ?? 0)
            : 0;

          const thumbUrl = articleData.article_images[0]?.url ?? null;
          const thumbnailDataUrl = thumbUrl
            ? await fetchAsDataUrl(thumbUrl)
            : null;

          updateArticleDownload(id, {
            status: result.success ? 'finished' : 'failed',
            filePath: result.success ? filePath : null,
            fileSize: result.success ? fileSize : null,
            title: articleData.article_title ?? 'Article',
            articleData,
            thumbnailDataUrl,
            ...(result.success ? {} : { errorMessage: result.error }),
          });
        } catch (err) {
          updateArticleDownload(id, {
            status: 'failed',
            errorMessage:
              err instanceof Error ? err.message : 'Unknown error',
          });
        }
      })();
    } else if (fetchState === 'error' && articleError) {
      const id = pendingArticleIdRef.current;
      pendingArticleIdRef.current = null;
      updateArticleDownload(id, {
        status: 'failed',
        errorMessage:
          articleError.article_error_status ?? 'Failed to fetch article',
      });
    }
  }, [fetchState, articleData, articleError]);

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
      className="flex-shrink flex-grow-0 w-full max-w-[538px] min-w-[200px] relative ml-2"
    >
      <Input
        ref={inputRef}
        maxLength={searchState.isSearchActive ? 50 : undefined}
        placeholder={t('taskbarInput.placeholder')}
        className="text-xs py-4 pr-10"
        leftIcons={[
          {
            icon: (
              <Copy className="text-darkModeHover dark:text-darkModeLight" />
            ),
            onClick: () => {
              navigator.clipboard
                .writeText(videoUrl)
                .then(() => {
                  toast({
                    title: t('taskbarInput.toast.copiedTitle'),
                    description: t('taskbarInput.toast.copiedDesc'),
                    duration: 3000,
                  });
                })
                .catch(() => {
                  toast({
                    variant: 'destructive',
                    title: t('taskbarInput.toast.copyFailedTitle'),
                    description: t('taskbarInput.toast.copyFailedDesc'),
                    duration: 3000,
                  });
                });
            },
            disabled: !videoUrl.trim(),
            tooltip: videoUrl.trim() && t('taskbarInput.tooltip.copy'),
          },
        ]}
        rightIcons={[
          {
            icon: (
              <Settings
                className={cn(
                  'text-darkModeHover dark:text-darkModeLight',
                  activeButton === 'settings' && 'text-primary',
                )}
              />
            ),
            onClick: () => {
              setActiveButton(activeButton === 'settings' ? null : 'settings');
              setIsAdditionalOptionsOpen(
                activeButton === 'settings' ? false : true,
              );
            },
            tooltip: t('taskbarInput.tooltip.settings'),
          },
          {
            icon: (
              <FolderIcon
                className={cn(
                  'text-darkModeHover dark:text-darkModeLight',
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
                  (!isPlaylist && isValidUrl) ||
                  isArticle) &&
                  'text-primary',
              )}
            />
          ),
          onClick: handleDownload,
          tooltip: isArticle
            ? t('taskbarInput.tooltip.openArticle')
            : t('taskbarInput.tooltip.download'),
          disabled:
            (!isValidUrl && !isArticle) ||
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

      {additionalOptionsMounted && (
        <div ref={additionalOptionsRef} className="relative z-[100]">
          <AdditionalOptions
            // isOpenOptions={isAdditionalOptionsOpen}
            isPlaylist={isPlaylist}
            isLoading={isLoading}
            selectAll={selectAll}
            handleSelectAll={handleSelectAll}
            videoTitle={videoTitle}
            playlistVideos={playlistVideos}
            selectedVideos={selectedVideos}
            handleVideoSelect={handleVideoSelect}
          />
        </div>
      )}
      {folderMounted && (
        <div ref={folderRef} className="relative z-[100]">
          <FolderDirectory />
        </div>
      )}
    </div>
  );
};

export default TaskbarInputField;
