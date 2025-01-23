/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { IoMdClose } from 'react-icons/io';
import useDownloadStore from '../../../Store/downloadStore';
import GetEmbedUrl from '../../..//DataFunctions/EmbedVideo';
import { Skeleton } from '../../SubComponents/shadcn/components/ui/skeleton';
interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DownloadModal: React.FC<DownloadModalProps> = ({ isOpen, onClose }) => {
  // Download Submission Data
  const [videoUrl, setVideoUrl] = useState<string>(''); //video url
  const [downloadFolder, setDownloadFolder] = useState<string>(''); //dpwnload destination folder
  const [downloadName, setDownloadName] = useState<string>(''); //download name
  const [downloadVideoExt, setdownloadVideoExt] = useState<string>('mp4'); //download extension
  const [downloadVideoFormatId, setdownloadVideoExtID] = useState<string>(''); //download quality
  const [selectedFormatValue, setSelectedFormatValue] = useState('');

  // Misc
  const [videoInfo, setVideoInfo] = useState<object | null>(null); //info regarding video
  const [availableFormats, setAvailableFormats] = useState([]); //format and resolution from video info
  const [videoSource, setVideoSource] = useState(''); //displays embed link
  const [selectedFormatDisplay, setSelectedFormatDisplay] =
    useState('Select Format'); //chosen audio, video and quality format

  // Validation
  const [isVideoReady, setIsVideoReady] = useState<boolean>(false); //is for checking embed
  const [isLoading, setIsLoading] = useState<boolean>(false); //loadings screen
  const [isDownloading, setIsDownloading] = useState<boolean>(false); //loadings screen
  const [isValidUrl, setIsValidUrl] = useState<boolean>(false); //checks if url is correct
  const [downloadStart, setDownloadStart] = useState<boolean>(false); //for setting for downloads
  const [extractorKey, setExtractorKey] = useState<string>(''); //checks download site source

  // Embed URL
  const [embedUrl, setEmbedUrl] = useState<string>(''); //embed video url
  const [thumbnailUrl, setThumbnailUrl] = useState(''); //embed image url

  //Store
  const { addDownload, setDownload } = useDownloadStore(); //download store

  // eslint-disable-next-line prettier/prettier

  // FUNCTIONS:

  // for automatically fetching url information
  useEffect(() => {
    if (videoUrl) {
      setEmbedUrl(GetEmbedUrl(videoUrl));
      const fetchVideoInfo = async () => {
        console.log('Fetching video info...');
        setIsLoading(true);
        try {
          const info = await (window as any).ytdlp.getInfo(videoUrl);
          const folderPath = await window.downlodrFunctions.getDownloadFolder();

          console.log('Video info fetched:', info);
          setVideoInfo(info);
          setExtractorKey(info.data.extractor_key);
          setDownloadName(info.data.title);
          setThumbnailUrl(info.data.thumbnail);
          const videoSourceUrl = ['Instagram', 'twitch', 'CNN'].includes(
            extractorKey,
          )
            ? info.data.url
            : GetEmbedUrl(videoUrl);
          setVideoSource(videoSourceUrl);
          setDownloadFolder(folderPath);
          setSelectedFormatDisplay('Select Format');
          setdownloadVideoExt('mp4');

          const formatsArray = info.data.formats || [];
          const formatMap = new Map();
          const seenCombinations = new Set();

          if (info.data.extractor_key === 'Youtube') {
            formatMap.clear();

            formatsArray.forEach((format: any) => {
              const resolution = format.resolution;
              const formatId = format.format_id;
              let video_ext = format.video_ext;
              const url = format.url;
              const format_note = format.format_note;

              // Skip if missing required fields or URL doesn't match pattern
              if (
                !resolution ||
                !video_ext ||
                !(video_ext != 'none') ||
                !url ||
                !url.startsWith('https://rr')
              )
                return;

              if (video_ext == 'webm') {
                video_ext = 'mkv';
              }

              // Create a unique key for the combination
              const combinationKey = `${video_ext}-${format_note}`;

              // Only add if we haven't seen this combination before
              if (!seenCombinations.has(combinationKey)) {
                seenCombinations.add(combinationKey);
                formatMap.set(formatId, { formatId, video_ext, format_note });
              }
            });
            // Add audio-only formats with specific criteria
            const audioOnlyFormat = formatsArray.find(
              (format: any) =>
                format.vcodec === 'none' &&
                format.format.includes('audio only (medium)'),
            );

            const audioOptions = audioOnlyFormat
              ? [
                  {
                    value: `audio-${audioOnlyFormat.format_id}-${audioOnlyFormat.audio_ext}`,
                    label: `Audio Only (${audioOnlyFormat.audio_ext}) - ${
                      audioOnlyFormat.format_note || audioOnlyFormat.ext
                    }`,
                    formatId: audioOnlyFormat.format_id,
                    fileExtension: audioOnlyFormat.audio_ext,
                  },
                  {
                    value: `audio-${audioOnlyFormat.format_id}-mp3`,
                    label: `Audio Only (mp3) - ${
                      audioOnlyFormat.format_note || audioOnlyFormat.ext
                    }`,
                    formatId: audioOnlyFormat.format_id,
                    fileExtension: 'mp3',
                  },
                ]
              : [];

            // Create options for each resolution in mp4, m4a, and webm
            const formatOptions = Array.from(formatMap.entries())
              .flatMap(([resolution, formatInfo]) => [
                {
                  value: `${formatInfo.video_ext}-${resolution}`,
                  label: `${formatInfo.video_ext} - ${formatInfo.format_note}`,
                  formatId: `${audioOptions[0].formatId}+${formatInfo.formatId}`,
                  fileExtension: `${formatInfo.video_ext}`,
                },
              ])
              .reverse(); // Reverse the array to invert the order
            setdownloadVideoExtID(formatOptions[0].formatId);
            setAvailableFormats([...formatOptions, ...audioOptions]);
          } // end of Youtube if
          else if (info.data.extractor_key === 'Dailymotion') {
            console.log('Processing Dailymotion formats:', formatsArray);

            // Clear existing formats
            formatMap.clear();
            seenCombinations.clear();

            formatsArray.forEach((format: any) => {
              const resolution = format.resolution;
              const formatId = format.format_id;
              const video_ext = format.ext;
              const url = format.url;
              const format_note = format.format || resolution || formatId;

              // Skip if missing required fields
              if (!video_ext || !url) {
                console.log('Skipping format due to missing fields:', formatId);
                return;
              }

              // Create a unique key for the combination
              const combinationKey = `${video_ext}-${resolution}`;

              // Only add if we haven't seen this combination before
              if (!seenCombinations.has(combinationKey)) {
                seenCombinations.add(combinationKey);
                formatMap.set(formatId, {
                  formatId,
                  video_ext,
                  format_note,
                  resolution,
                });
                console.log('Added format:', {
                  formatId,
                  video_ext,
                  format_note,
                  resolution,
                });
              }
            });

            const audioOptions = [
              {
                value: `audio-0-mp3`,
                label: `Audio Only (mp3)`,
                formatId: '0',
                fileExtension: 'mp3',
              },
            ];

            // Create options for each resolution in mp4, m4a, and webm
            const formatOptions = Array.from(formatMap.entries())
              .flatMap(([_, formatInfo]) => [
                {
                  value: `mkv-${formatInfo.resolution}`,
                  label: `mkv - ${formatInfo.resolution}`,
                  formatId: formatInfo.formatId,
                  fileExtension: 'mkv',
                },
                {
                  value: `${formatInfo.video_ext}-${formatInfo.resolution}`,
                  label: `${formatInfo.video_ext} - ${formatInfo.resolution}`,
                  formatId: formatInfo.formatId,
                  fileExtension: formatInfo.video_ext,
                },
              ])
              .reverse();

            if (formatOptions.length > 0) {
              setdownloadVideoExtID(formatOptions[0].formatId);
              setAvailableFormats([...formatOptions, ...audioOptions]);
              // Ensure dropdown is closed when new formats are set
              // Set a default format display
              setSelectedFormatDisplay(formatOptions[0].label);
            } else {
              console.warn('No valid formats found for Dailymotion video');
              // Set some default values when no formats are found
              setAvailableFormats([]);
              setSelectedFormatDisplay('No formats available');
            }
          } else if (
            info.data.extractor_key === 'Vimeo' ||
            info.data.extractor_key === 'BiliBili' ||
            info.data.extractor_key === 'CNN'
          ) {
            console.log('Processing Other formats:');

            // Clear existing formats
            formatMap.clear();
            seenCombinations.clear();

            // Find the first audio-only format at the start of your format processing
            const audioOnlyFormat = formatsArray.find(
              (format: any) =>
                format.resolution === 'audio only' ||
                format.vcodec === 'none' ||
                (format.format &&
                  format.format.toLowerCase().includes('audio only')),
            );

            const audioFormatId = audioOnlyFormat
              ? audioOnlyFormat.format_id
              : '0';

            formatsArray.forEach((format: any) => {
              const resolution = format.resolution || format.format_id;
              const formatId = format.format_id;
              const video_ext = format.ext;
              const url = format.url;
              const format_noteU = format.format_note || resolution || formatId;

              const containsDash = format_noteU.includes('DASH');

              // Skip if missing required fields
              if (!video_ext || !url || containsDash) {
                console.log('Skipping format due to missing fields:', formatId);
                return;
              }

              // Create a unique key for the combination
              const combinationKey = `${video_ext}-${resolution}`;

              // Only add if we haven't seen this combination before
              if (!seenCombinations.has(combinationKey)) {
                seenCombinations.add(combinationKey);
                formatMap.set(formatId, {
                  formatId,
                  video_ext,
                  format,
                  resolution,
                });
              }
            });

            const audioOptions = [
              {
                value: `audio-0-mp3`,
                label: `Audio Only (mp3)`,
                formatId: '0',
                fileExtension: 'mp3',
              },
            ];

            // Create options for each resolution in mp4, m4a, and webm
            const formatOptions = Array.from(formatMap.entries())
              .flatMap(([_, formatInfo]) => [
                {
                  value: `${formatInfo.video_ext}-${formatInfo.resolution}`,
                  label: `${formatInfo.video_ext} - ${formatInfo.resolution}`,
                  formatId: `${audioFormatId}+${formatInfo.formatId}`, // formatId: `hls-fastly_skyfire-audio-high-English+${formatInfo.formatId}`,
                  fileExtension: formatInfo.video_ext,
                },
              ])
              .reverse();

            if (formatOptions.length > 0) {
              setdownloadVideoExtID(formatOptions[0].formatId);
              setAvailableFormats([...formatOptions, ...audioOptions]);
              // Ensure dropdown is closed when new formats are set
              // Set a default format display
              setSelectedFormatDisplay(formatOptions[0].label);
            } else {
              console.warn('No valid formats found for d video');
              // Set some default values when no formats are found
              setAvailableFormats([]);
              setSelectedFormatDisplay('No formats available');
            }
          } else {
            console.log('Processing Other formats:');

            // Clear existing formats
            formatMap.clear();
            seenCombinations.clear();

            formatsArray.forEach((format: any) => {
              const resolution = format.resolution || format.format_id;
              const formatId = format.format_id;
              const video_ext = format.ext;
              const url = format.url;
              const format_noteU = format.format_note || resolution || formatId;

              const containsDash = format_noteU.includes('DASH');

              // Skip if missing required fields
              if (!video_ext || !url || containsDash) {
                console.log('Skipping format due to missing fields:', formatId);
                return;
              }

              // Create a unique key for the combination
              const combinationKey = `${video_ext}-${resolution}`;

              // Only add if we haven't seen this combination before
              if (!seenCombinations.has(combinationKey)) {
                seenCombinations.add(combinationKey);
                formatMap.set(formatId, {
                  formatId,
                  video_ext,
                  format,
                  resolution,
                });
              }
            });

            const audioOptions = [
              {
                value: `audio-0-mp3`,
                label: `Audio Only (mp3)`,
                formatId: '0',
                fileExtension: 'mp3',
              },
            ];

            // Create options for each resolution in mp4, m4a, and webm
            const formatOptions = Array.from(formatMap.entries())
              .flatMap(([_, formatInfo]) => [
                {
                  value: `mkv-${formatInfo.resolution}`,
                  label: `mkv - ${formatInfo.resolution}`,
                  formatId: formatInfo.formatId,
                  fileExtension: 'mkv',
                },
                {
                  value: `${formatInfo.video_ext}-${formatInfo.resolution}`,
                  label: `${formatInfo.video_ext} - ${formatInfo.resolution}`,
                  formatId: formatInfo.formatId, // formatId: `hls-fastly_skyfire-audio-high-English+${formatInfo.formatId}`,
                  fileExtension: formatInfo.video_ext,
                },
              ])
              .reverse();

            if (formatOptions.length > 0) {
              setdownloadVideoExtID(formatOptions[0].formatId);
              setAvailableFormats([...formatOptions, ...audioOptions]);
              // Ensure dropdown is closed when new formats are set
              // Set a default format display
              setSelectedFormatDisplay(formatOptions[0].label);
            } else {
              console.warn('No valid formats found for d video');
              // Set some default values when no formats are found
              setAvailableFormats([]);
              setSelectedFormatDisplay('No formats available');
            }
          }
          // console.log(formatOptions);
        } catch (error) {
          console.log('Error', error);
        } finally {
          console.log('Finished fetching video info.');
          setIsLoading(false);
        }
      };
      fetchVideoInfo();
    }
  }, [videoUrl]);

  // Checks if the user is online
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

  // Reset all values
  const resetModal = () => {
    setVideoUrl('');
    setDownloadFolder('');
    setDownloadName('');
    setdownloadVideoExt('mp4');
    setIsVideoReady(false);
    setIsValidUrl(false);
    setSelectedFormatValue('Select Format');
    setSelectedFormatDisplay('Select Format');
    setExtractorKey('');
    setIsLoading(false);
  };

  // Remove invalid characters from download name
  const removeInvalidChar = (filename: string) => {
    const invalidChars = /[<>:"/\\|?*]+/g;
    let sanitized = filename.replace(invalidChars, '_').trim();
    sanitized = sanitized.replace(/^\s+|\s+$/g, '');
    sanitized = sanitized.substring(0, 255);
    return sanitized;
  };

  // checks if file location is correct
  const isValidPath = async (path: string): Promise<boolean> => {
    // Check for undefined or empty path
    if (!path || path.includes('undefined')) {
      console.log('undefined path');
      return false;
    }
    try {
      // Call the validatePath method from the preload script
      const isValid = await window.downlodrFunctions.validatePath(path);
      return isValid;
    } catch (error) {
      console.error('Error validating path:', error);
      return false;
    }
  };

  // automatically adjust name for duplicate names
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

  // Download Name
  const handleDownload = async () => {
    const validName = removeInvalidChar(downloadName);
    setIsDownloading(true);
    try {
      const info = await (window as any).ytdlp.getInfo(videoUrl);
      const defaultPath = await window.downlodrFunctions.getDownloadFolder();
      const validFolderPath = (await isValidPath(downloadFolder))
        ? downloadFolder
        : defaultPath;

      if (validFolderPath === defaultPath) {
        console.log('error path');
      }

      let uniqueFileName = await getUniqueFileName(
        validFolderPath,
        validName,
        downloadVideoExt,
      );
      const finalName = `${uniqueFileName}.${downloadVideoExt}`;

      setVideoInfo(info);
      const isAudioOnly = selectedFormatDisplay.startsWith('Audio');

      // Set download parameters based on the file type
      let audioExt = isAudioOnly ? downloadVideoExt : '';
      let audioQualityId = isAudioOnly ? '0' : '';
      let videoExt = isAudioOnly ? '' : downloadVideoExt;
      let videoQualityID = isAudioOnly ? '' : downloadVideoFormatId;

      if (extractorKey !== 'Youtube') {
        uniqueFileName = finalName;
        const isAudioOnly = selectedFormatDisplay.startsWith('Audio');
        audioExt = isAudioOnly ? downloadVideoExt : '';
        audioQualityId = isAudioOnly ? '0' : '';
        videoExt = isAudioOnly ? '' : '';
        videoQualityID = isAudioOnly ? '' : `${downloadVideoFormatId}`;
      }

      addDownload(
        videoUrl, // videoUrl
        finalName, // name
        uniqueFileName, // downloadName
        0, // size
        '', // speed (empty initially)
        '', // timeLeft (empty initially)
        new Date().toISOString(), // DateAdded
        0, // progress (starts at 0)
        validFolderPath, // location
        'downloading', // status
        videoExt, // ext
        videoQualityID, // formatId
        audioExt, // audioExt
        audioQualityId, // audioFormatId
      );

      resetModal();
      onClose();
    } catch (error) {
      console.log('Error');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleUrl = (url: string) => {
    setVideoUrl(url);
    setIsValidUrl(false);

    const urlPattern = new RegExp(
      '^(https?:\\/\\/)?' + // protocol
        '(' +
        // Standard domain names
        '((([a-zA-Z\\d]([a-zA-Z\\d-]*[a-zA-Z\\d])*)\\.)+[a-zA-Z]{2,}|' +
        // IP (v4) address
        '((\\d{1,3}\\.){3}\\d{1,3}))' +
        // Port and path (adjusted to explicitly allow @ symbol for TikTok usernames)
        '(\\:\\d+)?(\\/[-a-zA-Z\\d%_.~+@]*)*' +
        // Query string
        '(\\?[;&a-zA-Z\\d%_.~+@=-]*)?' +
        // Fragment
        '(\\#[-a-zA-Z\\d_]*)?' +
        ')$',
      'i',
    );

    if (!urlPattern.test(url)) {
      return false;
    }
    try {
      new URL(url);
      setIsValidUrl(true);
      setIsVideoReady(false); // Reset video ready state when a new URL is entered
    } catch (err) {
      return false;
    }
  };

  // Cancel button
  const handleCancel = () => {
    resetModal(); // Reset the state
    onClose(); // Close the modal
  };

  // Find location
  const handleDirectory = async () => {
    const path = await window.ytdlp.selectDownloadDirectory();
    setDownloadFolder(path);
  };

  // Move the conditional return after all hooks
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-20 dark:bg-opacity-50 flex items-center justify-center h-full">
      <div
        className={`bg-white dark:bg-darkMode rounded-lg pt-6 pr-6 pl-6 pb-4 ${
          videoUrl && isValidUrl
            ? 'w-4/5 max-w-[1000px] flex gap-6'
            : 'w-full max-w-xl'
        }`}
      >
        <div className={videoUrl && isValidUrl ? 'flex-1' : 'w-full'}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold dark:text-gray-200">
              New Download
            </h2>
            <button
              onClick={handleCancel}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <IoMdClose size={16} />
            </button>
          </div>

          {isDownloading ? (
            <div className="w-full h-[250px] flex items-center justify-center">
              <Skeleton className="w-full h-full dark:bg-gray-700" />
            </div>
          ) : (
            <>
              <div className="flex gap-6">
                <form
                  onSubmit={(e) => e.preventDefault()}
                  className={videoUrl && isValidUrl ? 'w-2/3' : 'flex-1'}
                >
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
                          disabled={isLoading}
                          value={downloadFolder}
                          onClick={handleDirectory}
                          placeholder="Download Destination Folder"
                          className="flex-1 border rounded-md px-3 py-2 dark:bg-inputDarkMode dark:text-gray-200 outline-none dark:border-transparent"
                          readOnly
                        />
                      </div>
                    </div>

                    <div className="flex gap-4">
                      <div className="flex-1">
                        <label className="block dark:text-gray-200">Name</label>
                        <input
                          type="text"
                          placeholder="Name"
                          disabled={isLoading}
                          value={downloadName}
                          onChange={(e) => setDownloadName(e.target.value)}
                          className="w-full border rounded-md px-3 py-2 dark:bg-inputDarkMode dark:text-gray-200 outline-none dark:border-transparent"
                        />
                      </div>

                      <div className="flex-1">
                        <label className="block dark:text-gray-200">
                          Select Format
                        </label>
                        <select
                          value={selectedFormatValue}
                          disabled={isLoading}
                          onChange={(e) => {
                            const selectedFormat = availableFormats.find(
                              (format) => format.value === e.target.value,
                            );
                            if (selectedFormat) {
                              setSelectedFormatValue(selectedFormat.value);
                              setdownloadVideoExt(selectedFormat.fileExtension);
                              setSelectedFormatDisplay(selectedFormat.label);
                              setdownloadVideoExtID(selectedFormat.formatId);
                            }
                          }}
                          className="w-full border rounded-md px-3 py-2 dark:bg-inputDarkMode dark:text-gray-200 outline-none dark:border-transparent [&>option]:dark:bg-darkMode"
                        >
                          <option
                            value=""
                            className="dark:bg-darkMode dark:text-gray-200"
                          >
                            Select Format
                          </option>
                          {availableFormats.length > 0 ? (
                            availableFormats.map((format) => (
                              <option
                                key={format.value}
                                value={format.value}
                                className="dark:bg-darkMode dark:text-gray-200"
                              >
                                {format.label}
                              </option>
                            ))
                          ) : (
                            <option
                              value=""
                              className="dark:bg-darkMode dark:text-gray-200"
                            >
                              No formats available
                            </option>
                          )}
                        </select>
                      </div>
                    </div>
                  </div>
                </form>

                {videoUrl && isValidUrl && (
                  <div className="w-2/3 flex items-center">
                    <div className="aspect-video rounded-lg overflow-hidden w-full">
                      {isLoading ? (
                        <div className="w-full h-full bg-gray-200 dark:bg-gray-700 animate-pulse">
                          <div className="flex items-center justify-center h-full">
                            <svg
                              className="w-12 h-12 text-gray-300 dark:text-gray-600"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <path
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                              />
                            </svg>
                          </div>
                        </div>
                      ) : (
                        <iframe
                          width="100%"
                          height="100%"
                          src={videoSource}
                          title="YouTube video preview"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="dark:border-gray-700"
                        ></iframe>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <hr className="solid mt-4 mb-2 -mx-6 w-[calc(100%+47px)] border-t-2 border-divider dark:border-gray-700" />

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="bg-primary text-white px-2 py-2 rounded-md hover:bg-primary/90"
                  onClick={handleDownload}
                >
                  Download
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleCancel}
                  className="px-2 py-2 border rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700 dark:text-gray-200"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DownloadModal;
