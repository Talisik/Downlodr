/**
 * A custom React component
 * shows Download Modal for Downlodr, accepts and validates download links
 *
 * - Standard video link
 * Verifies if link has the standard format before sending link to the download store to get metadata and for verificationn
 *
 * - Youtube Playlist link
 * After verification, gets the metadata for the playlist and displays videos under the playlist, allows users to choose playlist videos to download
 * Chosen videos are then sent to downloadStore to get metadata
 *
 * @param isOpen - If modal is open, keeps it open
 * @param onClose - If modal has been closed, closes modal
 * @returns JSX.Element - The rendered component displaying a DownloadModal
 *
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { IoMdClose } from 'react-icons/io';
import useDownloadStore from '../../../Store/downloadStore';
import { useMainStore } from '../../../Store/mainStore';
import { toast } from '../../SubComponents/shadcn/hooks/use-toast';
import { Skeleton } from '../../SubComponents/shadcn/components/ui/skeleton';
import { MdOutlineInfo } from 'react-icons/md';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Expected download video params
interface Video {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
  url: string;
}

const DownloadModal: React.FC<DownloadModalProps> = ({ isOpen, onClose }) => {
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [isValidUrl, setIsValidUrl] = useState<boolean>(false);

  // Store
  const [getTranscript, setGetTranscript] = useState<boolean>(false);
  const [getThumbnail, setGetThumbnail] = useState<boolean>(false);

  const { setDownload } = useDownloadStore();
  const { settings } = useMainStore();
  const [downloadFolder, setDownloadFolder] = useState<string>(
    settings.defaultLocation,
  );
  const maxDownload =
    settings.defaultDownloadSpeed === 0
      ? ''
      : `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`;

  useEffect(() => {
    setDownloadFolder(settings.defaultLocation);
  }, [settings.defaultLocation]);

  // New state for playlist functionality
  const [isPlaylist, setIsPlaylist] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [videoInfo, setVideoInfo] = useState<object | null>(null);
  const [videoTitle, setVideoTitle] = useState<string | null>(null);
  const [playlistVideos, setPlaylistVideos] = useState<Video[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());

  // Calculate selectAll state
  const selectAll =
    selectedVideos.size === playlistVideos.length && playlistVideos.length > 0;

  // Add a debounce timer and URL validation states
  const [validationTimer, setValidationTimer] = useState<NodeJS.Timeout | null>(
    null,
  );
  const [isValidatingUrl, setIsValidatingUrl] = useState<boolean>(false);

  // New state to track if directory selection is in progress
  const [isSelectingDirectory, setIsSelectingDirectory] =
    useState<boolean>(false);

  // set download folder location
  const handleDirectory = async () => {
    // Prevent multiple dialogs from being opened
    if (isSelectingDirectory) return;

    try {
      setIsSelectingDirectory(true);
      const path = await window.ytdlp.selectDownloadDirectory();
      if (path) {
        setDownloadFolder(path);
      }
    } finally {
      setIsSelectingDirectory(false);
    }
  };
  // URL validation with playlist check
  const isYouTubeLink = (url: string): 'playlist' | 'video' | 'invalid' => {
    const videoPattern = /^https:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+/;
    const playlistPattern =
      /^https:\/\/(?:www\.)?youtube\.com\/playlist\?list=[\w-]+$/;

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

  // Function for receiving download url and handling next actions depending if url is a single download link or playlist link
  const handleUrl = async (url: string) => {
    setVideoUrl(url);
    setIsValidUrl(false);
    setIsPlaylist(false);
    setSelectedVideos(new Set());

    // Clear any existing validation timer
    if (validationTimer) {
      clearTimeout(validationTimer);
    }

    // Skip validation for empty URLs
    if (!url.trim()) {
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

  // Separate validation function
  const validateUrl = (url: string) => {
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
  };

  // Playlist validation and fetching metadata
  const fetchPlaylistInfo = async (url: string) => {
    setIsLoading(true);
    try {
      const info = await window.ytdlp.getPlaylistInfo({ url });

      setVideoInfo(info);
      setVideoTitle(info.data.title);

      // Ensure no duplicate videos in the playlist
      const uniqueVideos = new Map();

      // Iterates through each video link inside playlist and saves to unique videos
      info.data.entries.forEach((video: any) => {
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
        title: 'Playlist Error',
        description: 'Failed to fetch playlist information',
        duration: 3000,
      });
    } finally {
      setIsLoading(false);
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

  // Selecting all videos from playlist
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedVideos(new Set());
    } else {
      setSelectedVideos(new Set(playlistVideos.map((video) => video.id)));
    }
  };

  // Sending download link(s) to download store through setDownload
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
      } else {
        // Single video download with user preferences
        setDownload(videoUrl, downloadFolder, maxDownload, {
          getTranscript,
          getThumbnail,
        });
      }
      // Cleaning up modal
      resetModal();
      onClose();

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

  // cleans up states of download modal variable
  const resetModal = () => {
    setVideoUrl('');
    setIsValidUrl(false);
    setIsPlaylist(false);
    setVideoInfo(null);
    setVideoTitle(null);
    setPlaylistVideos([]);
    setSelectedVideos(new Set());
    setDownloadFolder(settings.defaultLocation);
  };

  // Close Modal
  const handleClose = () => {
    resetModal();
    onClose();
  };

  // Make sure to clean up the timer when the component unmounts
  useEffect(() => {
    return () => {
      if (validationTimer) {
        clearTimeout(validationTimer);
      }
    };
  }, [validationTimer]);

  // Move the conditional return after all hooks
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 dark:bg-opacity-50 flex items-center justify-center h-full z-[8999]"
      onClick={(e) => {
        // Only close if clicking the overlay background
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      {/* Directory selection overlay - blocks all app interaction */}
      {isSelectingDirectory && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-[9999] cursor-not-allowed flex items-center justify-center">
          <div className="bg-white dark:bg-darkModeDropdown p-4 rounded-lg shadow-lg max-w-md text-center">
            <h3 className="text-lg font-medium mb-2 dark:text-darkModeLight">
              Directory Selection In Progress
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Please complete the directory selection dialog before continuing.
            </p>
          </div>
        </div>
      )}
      <div
        className={`bg-white dark:bg-darkModeDropdown rounded-lg border border-darkModeCompliment pt-6 pr-6 pl-6 ${
          isValidUrl && isPlaylist ? 'w-full max-w-[800px]' : 'w-full max-w-xl'
        }`}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold dark:text-darkModeLight">
            {isPlaylist ? 'Playlist Download' : 'New Download'}
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <IoMdClose size={16} />
          </button>
        </div>

        <div className="flex gap-6">
          <div className={isPlaylist ? 'w-[350px]' : 'w-full'}>
            <form onSubmit={(e) => e.preventDefault()} className={'w-full'}>
              <div className="space-y-4">
                <div>
                  <label className="block dark:text-darkModeLight font-medium">
                    Download link
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Paste link here"
                      disabled={isLoading}
                      value={videoUrl}
                      onChange={(e) => handleUrl(e.target.value)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        window.downlodrFunctions.showInputContextMenu();
                      }}
                      className="flex-1 border rounded-md px-3 py-2 dark:text-black outline-none dark:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block dark:text-darkModeLight font-medium">
                    Save file to
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      // disabled={isValidUrl}
                      value={downloadFolder}
                      onClick={handleDirectory}
                      placeholder="Download Destination Folder"
                      className="flex-1 border rounded-md px-3 py-2 dark:text-black outline-none dark:border-transparent"
                      readOnly
                    />
                  </div>
                </div>
                <div className="">
                  <div className="flex items-center gap-2">
                    <label className="block dark:text-darkModeLight text-nowrap font-bold">
                      Additional Options
                    </label>
                    <hr className="flex-grow border-t-1 border-divider dark:border-gray-700 ml-2" />
                  </div>
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        id="run-in-background"
                        checked={getTranscript}
                        onChange={(e) => setGetTranscript(e.target.checked)}
                        className="w-4 h-4 text-primary rounded focus:ring-primary"
                      />
                      <label className="font-medium dark:text-darkModeLight ">
                        Get Closed Captions
                      </label>
                    </div>
                    <div className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        id="run-in-background"
                        checked={getThumbnail}
                        onChange={(e) => setGetThumbnail(e.target.checked)}
                        className="w-4 h-4 text-primary rounded focus:ring-primary"
                      />
                      <label className="font-medium dark:text-darkModeLight ">
                        Get Thumbnail
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    <MdOutlineInfo size={20} />
                    <div>
                      <p className="text-xs">
                        Please note that Closed Captions and thumbnails may not
                        be available for all websites.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>

          {isPlaylist && isValidUrl && (
            <div className="w-2/4 border-l border-divider dark:border-gray-700 pl-6">
              {isLoading ? (
                <Skeleton className="h-4 flex-1 rounded-[3px] h-full" />
              ) : (
                <div className="video-section">
                  <div className="sticky top-0 bg-white dark:bg-darkModeDropdown pb-4 z-10">
                    <div className="select-all flex items-center">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        className="mr-2"
                      />
                      <label className="dark:text-darkModeLight font-medium">
                        {videoTitle}
                      </label>
                    </div>
                  </div>
                  <div className="space-y-3 max-h-[180px] overflow-y-auto">
                    {playlistVideos.map((video) => (
                      <div
                        key={video.id}
                        className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg"
                      >
                        <input
                          type="checkbox"
                          checked={selectedVideos.has(video.id)}
                          onChange={() => handleVideoSelect(video.id)}
                          className="flex-none"
                        />
                        <img
                          src={video.thumbnail}
                          alt={video.title}
                          className="w-24 h-16 object-cover rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium dark:text-darkModeLight truncate">
                            {video.title}
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {video.channel}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <hr className="solid mt-4 -mx-6 w-[calc(100%+47px)] border-t-2 border-divider dark:border-darkModeCompliment" />

        <div className="bg-[#FEF9F4] dark:dark:bg-darkMode flex gap-3 justify-end -mx-6 px-4 py-3 rounded-b-md">
          <button
            type="button"
            onClick={handleClose}
            className="px-2 py-2 rounded-md hover:bg-gray-50 dark:bg-darkModeCompliment dark:text-darkModeLight dark:hover:bg-darkModeHover dark:hover:text-white font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            className="bg-primary text-white px-2 py-2 rounded-md hover:bg-primary/90"
            disabled={!isValidUrl}
            onClick={handleDownload}
          >
            Fetch Download
          </button>
        </div>
      </div>
    </div>
  );
};

export default DownloadModal;
