/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from 'react';
import useDownloadStore from '../../../Store/downloadStore';
import GetEmbedUrl from '../../../DataFunctions/EmbedVideo';
import { Skeleton } from '../../SubComponents/shadcn/components/ui/skeleton';
import { toast } from '../..//SubComponents/shadcn/hooks/use-toast';
import { useMainStore } from '../../../Store/mainStore';
import { IoMdClose } from 'react-icons/io';

interface PlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Video {
  id: string;
  title: string;
  thumbnail: string;
  channel: string;
  url: string;
}

interface VideoDownloadInfo {
  originalUrl: string;
  title: string;
  formatId: string;
  formats: any[];
  ext: string;
}

const PlaylistModal: React.FC<PlaylistModalProps> = ({ isOpen, onClose }) => {
  const [videoInfo, setVideoInfo] = useState<object | null>(null);
  const [videoTitle, setVideoTitle] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>('');
  const [downloadFolder, setDownloadFolder] = useState<string>('');
  const [downloadName, setDownloadName] = useState<string>('');
  const [downloadQuality, setDownloadQuality] = useState<string>('');
  const [isVideoReady, setIsVideoReady] = useState<boolean>(false);
  const [embedUrl, setEmbedUrl] = useState<string>('');
  const { addDownload, setDownload } = useDownloadStore();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const [isValidUrl, setIsValidUrl] = useState<boolean>(false);
  const [isErrorVisible, setErrorVisible] = useState(false);
  const [availableFormats, setAvailableFormats] = useState([]);
  const [errorTitle, setErrorTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [videoSource, setVideoSource] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedFormatDisplay, setSelectedFormatDisplay] =
    useState('Select Format');
  const [selectedFormatValue, setSelectedFormatValue] = useState('');
  const [playlistVideos, setPlaylistVideos] = useState<Video[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<Set<string>>(new Set());

  // Update selectAll based on selectedVideos
  const selectAll =
    selectedVideos.size === playlistVideos.length && playlistVideos.length > 0;

  const fetchVideoInfo = async (
    videoUrl: string,
    isAudioOnly: boolean,
  ): Promise<VideoDownloadInfo | null> => {
    console.log('Fetching video info...');
    setIsLoading(true);
    try {
      const info = await (window as any).ytdlp.getInfo(videoUrl);
      const formatsArray = info.data.formats || [];
      console.log(info);
      if (isAudioOnly) {
        // Find audio-only format with specific criteria
        const audioOnlyFormat = formatsArray.find(
          (format: any) =>
            format.vcodec === 'none' &&
            format.format.includes('audio only (medium)'),
        );
      } else {
        // For video, use the default format ID and extension from info.data
        console.log(`ext: `, info.data.ext);
        return {
          originalUrl: info.data.original_url,
          title: info.data.title,
          formatId: info.data.format_id,
          formats: formatsArray,
          ext: info.data.ext,
        };
      }

      return null;
    } catch (error) {
      setErrorTitle('Search Error');
      setErrorMessage(`Video not found: Invalid video url`);
      setErrorVisible(true);
      return null;
    } finally {
      console.log('Finished fetching video info.');
      setIsLoading(false);
    }
  };

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

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedVideos(new Set());
    } else {
      setSelectedVideos(new Set(playlistVideos.map((video) => video.id)));
    }
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleSelect = (value: string, display: string) => {
    setSelectedFormatValue(value);
    setSelectedFormatDisplay(display);
    setDownloadQuality(value === 'audio-only' ? 'm4a' : 'mp4');
    toggleDropdown();
  };

  useEffect(() => {
    if (isValidUrl) {
      const fetchPlaylistInfo = async () => {
        console.log('Fetching playlist info...');
        setIsLoading(true);
        try {
          const info = await (window as any).ytdlp.getPlaylistInfo({
            url: videoUrl,
          });
          const folderPath = await window.downlodrFunctions.getDownloadFolder();

          // Set video information and playlist videos
          setVideoInfo(info);
          console.log(info);
          setVideoTitle(info.data.title);
          setDownloadName(info.data.title);

          const videos = info.data.entries.map((video: any) => ({
            url: video.url,
            id: video.id,
            title: video.title,
            thumbnail: video.thumbnails[0]?.url || '', // Handle potential undefined
            channel: video.channel,
          }));
          console.log(videos);
          setPlaylistVideos(videos);

          setDownloadFolder(folderPath);
          setSelectedFormatDisplay('Default Video');
          setDownloadQuality('mp4');
          hideErrorCard();
        } catch (error) {
          // Improved error handling
          setErrorTitle('Search Error');
          setErrorMessage(
            `Playlist not found: ${error.message || 'Invalid url'}`,
          );
          setErrorVisible(true);
        } finally {
          setIsLoading(false);
        }
      };
      fetchPlaylistInfo();
    }
  }, [videoUrl]);

  useEffect(() => {
    const handleOffline = () => {
      onClose(); // Close the modal
    };

    window.addEventListener('offline', handleOffline);

    // Cleanup the event listener on component unmount
    return () => {
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const resetModal = () => {
    setVideoUrl('');
    setDownloadFolder('');
    setDownloadName('');
    setDownloadQuality('mp4');
    setIsVideoReady(false);
    setVideoInfo(null);
    setVideoTitle(null);
    setIsValidUrl(false);
    hideErrorCard();
    setSelectedFormatValue('Select Format');
    setSelectedFormatDisplay('Select Format');
    selectedVideos.clear();
  };

  const handleUrl = (url: string) => {
    setVideoUrl(url);
    setIsValidUrl(false);

    const urlPattern = new RegExp(
      '^(https?:\\/\\/)?' + // protocol
        '((([a-zA-Z\\d]([a-zA-Z\\d-]*[a-zA-Z\\d])*)\\.)+[a-zA-Z]{2,}|' + // domain name
        '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
        '(\\:\\d+)?(\\/[-a-zA-Z\\d%_.~+]*)*' + // port and path
        '(\\?[;&a-zA-Z\\d%_.~+=-]*)?' + // query string
        '(\\#[-a-zA-Z\\d_]*)?$',
      'i',
    );

    if (!urlPattern.test(url)) {
      setErrorTitle('Search Error');
      setErrorMessage('Video not found: Invalid video url sss');
      setErrorVisible(true);
      return false;
    }
    try {
      new URL(url);
      setIsValidUrl(true);
      setIsVideoReady(false); // Reset video ready state when a new URL is entered
    } catch (err) {
      setErrorTitle('Search Error');
      setErrorMessage(`Video not found: Invalid video url`);
      setErrorVisible(true);
      return false;
    }
  };

  const removeInvalidChar = (filename: string) => {
    const invalidChars = /[<>:"/\\|?*]+/g;
    let sanitized = filename.replace(invalidChars, '_').trim();
    sanitized = sanitized.replace(/^\s+|\s+$/g, '');
    sanitized = sanitized.substring(0, 255);
    return sanitized;
  };

  const isValidPath = async (path: string): Promise<boolean> => {
    if (!path || path.includes('undefined')) {
      console.log('undefined path');
      return false;
    }
    try {
      const isValid = await window.downlodrFunctions.validatePath(path);
      return isValid;
    } catch (error) {
      console.error('Error validating path:', error);
      return false;
    }
  };

  const getUniqueFileName = async (
    basePath: string,
    fileName: string,
    extension: string,
  ): Promise<string> => {
    let counter = 1;
    let finalName = fileName;

    // Check if file exists with extension
    while (
      await window.downlodrFunctions.fileExists(
        basePath + finalName + '.' + extension,
      )
    ) {
      finalName = `${fileName}[${counter}]`;
      counter++;
    }

    console.log('finalName: ');
    console.log(finalName);
    return finalName;
  };

  const handleDownload = async () => {
    try {
      const defaultPath = await window.downlodrFunctions.getDownloadFolder();
      const validFolderPath = (await isValidPath(downloadFolder))
        ? downloadFolder
        : defaultPath;

      if (validFolderPath === defaultPath) {
        console.log('def path');
      }

      const selectedVideosList = playlistVideos.filter((video) =>
        selectedVideos.has(video.id),
      );

      if (selectedVideosList.length === 0) {
        setErrorTitle('Selection Error');
        setErrorMessage('Please select at least one video to download');
        setErrorVisible(true);
        return;
      }

      setIsDownloading(true);

      const isAudioOnly = selectedFormatDisplay === 'Audio Only';

      for (const video of selectedVideosList) {
        const videoInfo = await fetchVideoInfo(video.url, isAudioOnly);

        if (videoInfo) {
          const validName = removeInvalidChar(videoInfo.title);
          const combinedName = `${validName}.${videoInfo.ext}`;

          // Then check for duplicates using the validated folder path
          const uniqueFileName = await getUniqueFileName(
            validFolderPath,
            validName,
            videoInfo.ext,
          );
          const finalName = `${uniqueFileName}.${videoInfo.ext}`;
          console.log(`final ext:`, videoInfo.ext);

          setDownload(videoInfo.originalUrl, downloadFolder, '5');
          /*
              videoInfo.ext,
              videoInfo.formatId,
            */
        }
      }

      resetModal();
      onClose();
    } catch (error) {
      setErrorTitle('Download Error');
      setErrorMessage(`Failed to process downloads: ${error.message}`);
      setErrorVisible(true);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDirectory = async () => {
    const path = await window.ytdlp.selectDownloadDirectory();
    setDownloadFolder(path);
  };

  const handleCancel = () => {
    resetModal(); // Reset the state
    onClose(); // Close the modal
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setIsVideoReady(true); // Show video on Enter key press
    }
  };

  if (!isOpen) return null;

  const hideErrorCard = () => {
    setErrorVisible(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-20 dark:bg-opacity-50 flex items-center justify-center h-full z-[9999]">
      <div className="bg-white dark:bg-darkMode rounded-lg p-6 w-full max-w-xl shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold dark:text-gray-200">
            Playlist Download
          </h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <IoMdClose size={16} />
          </button>
        </div>
        {isDownloading ? (
          <div className="loading-screen">Loading...</div>
        ) : (
          <>
            <div className="top-section">
              <div className="inputs space-y-4">
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => handleUrl(e.target.value)}
                  placeholder="Download Link"
                  className="flex-1 border rounded-md px-3 py-2 dark:bg-inputDarkMode dark:text-gray-200 outline-none dark:border-transparent"
                  disabled={isLoading}
                  aria-label="Video URL"
                />
                <input
                  type="text"
                  value={downloadFolder}
                  onClick={handleDirectory}
                  placeholder="Download Destination Folder"
                  className="flex-1 border rounded-md px-3 py-2 dark:bg-inputDarkMode dark:text-gray-200 outline-none dark:border-transparent"
                  readOnly
                  disabled={isLoading}
                  aria-label="Download Folder"
                />
              </div>
              <div className="buttons flex gap-3 mt-4">
                <button
                  className="bg-primary text-white px-4 py-2 rounded-md hover:bg-primary/90 dark:hover:text-black dark:hover:bg-white"
                  onClick={handleDownload}
                  aria-label="Download selected videos"
                >
                  Download
                </button>
                <button
                  className="px-4 py-2 border rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 dark:text-gray-200"
                  onClick={handleCancel}
                  aria-label="Cancel download"
                >
                  Cancel
                </button>
              </div>
            </div>
            <div className={`video-section ${isVideoReady ? 'show' : ''}`}>
              {isLoading ? (
                <Skeleton className="h-4 w-[120px] rounded-[3px]" />
              ) : (
                isValidUrl && (
                  <>
                    <div className="select-all flex items-center">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        className="mr-2"
                        aria-label="Select all videos"
                      />
                      <label className="dark:text-gray-200">{videoTitle}</label>
                    </div>
                    <div className="video-list mt-4">
                      {playlistVideos.map((video) => (
                        <div
                          key={video.id}
                          className="video-item flex items-center mb-2"
                        >
                          <input
                            type="checkbox"
                            checked={selectedVideos.has(video.id)}
                            onChange={() => handleVideoSelect(video.id)}
                            className="mr-2"
                            aria-label={`Select ${video.title}`}
                          />
                          <img
                            src={video.thumbnail}
                            alt={video.title}
                            className="w-16 h-16 rounded-md"
                          />
                          <div className="ml-2">
                            <h4 className="font-semibold dark:text-gray-200">
                              {video.title}
                            </h4>
                            <p className="text-sm dark:text-gray-400">
                              {video.channel}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PlaylistModal;
