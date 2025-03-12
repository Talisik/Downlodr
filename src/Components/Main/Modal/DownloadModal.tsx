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
import React, { useState } from 'react';
import { IoMdClose } from 'react-icons/io';
import useDownloadStore from '../../../Store/downloadStore';
import { useMainStore } from '../../../Store/mainStore';
import { toast } from '../../SubComponents/shadcn/hooks/use-toast';
import { Skeleton } from '../../SubComponents/shadcn/components/ui/skeleton';

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
  const { setDownload } = useDownloadStore();
  const { settings } = useMainStore();
  const [downloadFolder, setDownloadFolder] = useState<string>(
    settings.defaultLocation,
  );
  const maxDownload =
    settings.defaultDownloadSpeed === 0
      ? ''
      : `${settings.defaultDownloadSpeed}${settings.defaultDownloadSpeedBit}`;

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
      });
    }
  };

  // Playlist validation and getting metadata
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
        // If link is a YT playlist link, checks if there is atleast one video selected for download
        if (selectedVideosList.length === 0) {
          toast({
            variant: 'destructive',
            title: 'Selection Error',
            description: 'Please select at least one video to download',
          });
          return;
        }

        // Download each selected video
        for (const video of selectedVideosList) {
          //console.log(video.url);
          setDownload(video.url, downloadFolder, maxDownload);
        }
      } else {
        // Single video download
        setDownload(videoUrl, downloadFolder, maxDownload);
      }
      // Cleaning up modal
      resetModal();
      onClose();

      toast({
        title: 'Download Queued',
        description: 'Getting video metadata...',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to Add to Download Queue',
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

  // set download folder location
  const handleDirectory = async () => {
    const path = await window.ytdlp.selectDownloadDirectory();
    setDownloadFolder(path);
  };

  // Close Modal
  const handleClose = () => {
    resetModal();
    onClose();
  };

  // Move the conditional return after all hooks
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-20 dark:bg-opacity-50 flex items-center justify-center h-full z-[8999]"
      onClick={(e) => {
        // Only close if clicking the overlay background
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      {' '}
      <div
        className={`bg-white dark:bg-darkMode rounded-lg pt-6 pr-6 pl-6 pb-4 ${
          isValidUrl && isPlaylist ? 'w-full max-w-[800px]' : 'w-full max-w-xl'
        }`}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold dark:text-gray-200">
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
                  <label className="block dark:text-gray-200">
                    Download link
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Paste link here"
                      disabled={isLoading}
                      value={videoUrl}
                      onChange={(e) => handleUrl(e.target.value)}
                      className="flex-1 border rounded-md px-3 py-2 dark:bg-inputDarkMode dark:text-gray-200 outline-none dark:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block dark:text-gray-200">
                    Save file to
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      // disabled={isValidUrl}
                      value={downloadFolder}
                      onClick={handleDirectory}
                      placeholder="Download Destination Folder"
                      className="flex-1 border rounded-md px-3 py-2 dark:bg-inputDarkMode dark:text-gray-200 outline-none dark:border-transparent"
                      readOnly
                    />
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
                  <div className="sticky top-0 bg-white dark:bg-darkMode pb-4 z-10">
                    <div className="select-all flex items-center">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        className="mr-2"
                      />
                      <label className="dark:text-gray-200 font-medium">
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
                          <h4 className="font-medium dark:text-gray-200 truncate">
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
        <hr className="solid mt-4 mb-2 -mx-6 w-[calc(100%+47px)] border-t-2 border-divider dark:border-gray-700" />

        <div className="flex gap-3">
          <button
            type="button"
            className="bg-primary text-white px-2 py-2 rounded-md hover:bg-primary/90"
            disabled={!isValidUrl}
            onClick={handleDownload}
          >
            Download
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="px-2 py-2 border rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 dark:text-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default DownloadModal;
