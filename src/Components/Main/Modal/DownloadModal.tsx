/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { IoMdClose } from 'react-icons/io';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface UrlFormat {
  formatDisplayName: string;
  formatID: string;
  formatExtension: string;
}

const DownloadModal: React.FC<DownloadModalProps> = ({ isOpen, onClose }) => {
  // Download Submission Data
  const [downloadUrl, setDownloadLink] = useState('');
  const [downloadLocation, setDownloadLocation] = useState('');
  const [downloadName, setFileName] = useState('');
  const [downloadFormat, setDownloadFormat] = useState('MP4 1080');
  const [downloadFormatID, setDownloadFormatID] = useState('');
  const [downloadAudioFormat, setDownloadAudioFormat] = useState('MP4 1080');
  const [downloadAudioFormatID, setDownloadAudioFormatID] = useState('');
  const [videoId, setVideoId] = useState('');

  // Download Data
  const [UrlThumbnail, setUrlThumbnail] = useState('');
  const [urlExtractorKey, setUrlExtractorKey] = useState<string>('');

  //Validation Data
  const [isLoading, setIsLoading] = useState<boolean>(false); //loadings screen
  const [isDownloading, setIsDownloading] = useState<boolean>(false); //loadings screen
  const [isValidUrl, setIsValidUrl] = useState<boolean>(false); //checks if url is correct

  //Misc
  const [availableFormats, setAvailableFormats] = useState<UrlFormat[]>([]); //format and resolution from video info
  const [downloadStart, setDownloadStart] = useState<boolean>(false);

  //Store

  const resetDownloadModal = () => {
    // Reset Download Submission Data
    setDownloadLink('');
    setDownloadLocation('C:\\');
    setFileName('');
    setDownloadFormat('MP4 1080');
    setDownloadFormatID('');
    setDownloadAudioFormat('MP4 1080');
    setDownloadAudioFormatID('');
    setVideoId('');

    // Reset Download Data
    setUrlThumbnail('');
    setUrlExtractorKey('');

    // Reset Validation Data
    setIsLoading(false);
    setIsDownloading(false);
    setIsValidUrl(false);

    // Reset Misc
    setAvailableFormats([]);
    setDownloadStart(false);
  };

  // You can call this function when closing the modal
  const handleClose = () => {
    resetDownloadModal();
    onClose();
  };

  // First useEffect for video ID extraction
  useEffect(() => {
    const extractVideoId = (url: string) => {
      const regExp =
        /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = url.match(regExp);
      return match && match[2].length === 11 ? match[2] : null;
    };

    if (downloadUrl) {
      const id = extractVideoId(downloadUrl);
      setVideoId(id || '');
    }
  }, [downloadUrl]);

  // Second useEffect for video info fetching
  useEffect(() => {
    if (downloadUrl) {
      const fetchVideoInfo = async () => {
        setIsLoading(true);
        try {
          const info = await (window as any).ytdlp.getInfo(downloadUrl);
          const folderPath = await window.downlodrFunctions.getDownloadFolder();

          // Update state with fetched info
          setUrlExtractorKey(info.data.extractor_key);
          setFileName(info.data.title);
          setUrlThumbnail(info.data.thumbnail);
          setDownloadLocation(folderPath);

          const formatsArray = info.data.formats || [];
          const formatMap = new Map();
          const seenCombinations = new Set();

          // Process formats based on extractor key
          if (info.data.extractor_key === 'Youtube') {
            formatMap.clear();

            formatsArray.forEach((format: any) => {
              const resolution = format.resolution;
              const formatId = format.format_id;
              let video_ext = format.video_ext;
              const url = format.url;
              const format_note = format.format_note;

              if (
                !resolution ||
                !video_ext ||
                video_ext === 'none' ||
                !url ||
                !url.startsWith('https://rr')
              )
                return;

              if (video_ext === 'webm') video_ext = 'mkv';

              const combinationKey = `${video_ext}-${format_note}`;

              if (!seenCombinations.has(combinationKey)) {
                seenCombinations.add(combinationKey);
                const urlFormat: UrlFormat = {
                  formatDisplayName: `${format_note}`,
                  formatID: formatId,
                  formatExtension: video_ext,
                };
                formatMap.set(formatId, urlFormat);
              }
            });

            // Add audio-only formats
            const audioOnlyFormat = formatsArray.find(
              (format: any) =>
                format.vcodec === 'none' &&
                format.format.includes('audio only (medium)'),
            );

            if (audioOnlyFormat) {
              const mp3Format: UrlFormat = {
                formatDisplayName: 'Audio Only (MP3)',
                formatID: audioOnlyFormat.format_id,
                formatExtension: 'mp3',
              };
              formatMap.set('audio-mp3', mp3Format);
            }

            // Convert map to array and set available formats
            const formats = Array.from(formatMap.values());
            setAvailableFormats(formats);

            // Set default format if available
            if (formats.length > 0) {
              setDownloadFormat(formats[0].formatDisplayName);
              setDownloadFormatID(formats[0].formatID);
            }
          }
          // Daily Motion
          else if (info.data.extractor_key === 'Dailymotion') {
            console.log('Processing Dailymotion formats:', formatsArray);
            formatMap.clear();
            seenCombinations.clear();

            formatsArray.forEach((format: any) => {
              const resolution = format.resolution;
              const formatId = format.format_id;
              const video_ext = format.ext;
              const url = format.url;
              const format_note = format.format || resolution || formatId;

              if (!video_ext || !url) {
                console.log('Skipping format due to missing fields:', formatId);
                return;
              }

              const combinationKey = `${video_ext}-${resolution}`;

              if (!seenCombinations.has(combinationKey)) {
                seenCombinations.add(combinationKey);
                const urlFormat: UrlFormat = {
                  formatDisplayName: `${format_note}`,
                  formatID: formatId,
                  formatExtension: video_ext,
                };
                formatMap.set(formatId, urlFormat);
              }
            });

            // Add audio-only option
            const mp3Format: UrlFormat = {
              formatDisplayName: 'Audio Only (MP3)',
              formatID: '0',
              formatExtension: 'mp3',
            };
            formatMap.set('audio-mp3', mp3Format);

            // Convert map to array and set available formats
            const formats = Array.from(formatMap.values());
            setAvailableFormats(formats);

            // Set default format if available
            if (formats.length > 0) {
              setDownloadFormat(formats[0].formatDisplayName);
              setDownloadFormatID(formats[0].formatID);
            }
          } else if (
            info.data.extractor_key === 'Vimeo' ||
            info.data.extractor_key === 'BiliBili' ||
            info.data.extractor_key === 'CNN'
          ) {
            console.log('Processing Other formats');
            formatMap.clear();
            seenCombinations.clear();

            // Find audio-only format
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
              const format_note = format.format_note || resolution || formatId;

              if (!video_ext || !url || format_note.includes('DASH')) {
                console.log('Skipping format due to missing fields:', formatId);
                return;
              }

              const combinationKey = `${video_ext}-${resolution}`;

              if (!seenCombinations.has(combinationKey)) {
                seenCombinations.add(combinationKey);
                const urlFormat: UrlFormat = {
                  formatDisplayName: `${resolution}`,
                  formatID: `${audioFormatId}+${formatId}`,
                  formatExtension: video_ext,
                };
                formatMap.set(formatId, urlFormat);
              }
            });

            // Add audio-only option
            const mp3Format: UrlFormat = {
              formatDisplayName: 'Audio Only (MP3)',
              formatID: '0',
              formatExtension: 'mp3',
            };
            formatMap.set('audio-mp3', mp3Format);

            // Convert map to array and set available formats
            const formats = Array.from(formatMap.values());
            setAvailableFormats(formats);

            // Set default format if available
            if (formats.length > 0) {
              setDownloadFormat(formats[0].formatDisplayName);
              setDownloadFormatID(formats[0].formatID);
            }
          } else {
            // Generic handler for other platforms
            console.log('Processing Other formats');
            formatMap.clear();
            seenCombinations.clear();

            formatsArray.forEach((format: any) => {
              const resolution = format.resolution || format.format_id;
              const formatId = format.format_id;
              const video_ext = format.ext;
              const url = format.url;
              const format_note = format.format_note || resolution || formatId;

              if (!video_ext || !url) {
                console.log('Skipping format due to missing fields:', formatId);
                return;
              }

              const combinationKey = `${video_ext}-${resolution}`;

              if (!seenCombinations.has(combinationKey)) {
                seenCombinations.add(combinationKey);
                const urlFormat: UrlFormat = {
                  formatDisplayName: `${format_note}`,
                  formatID: formatId,
                  formatExtension: video_ext,
                };
                formatMap.set(formatId, urlFormat);
              }
            });

            // Add audio-only option
            const mp3Format: UrlFormat = {
              formatDisplayName: 'Audio Only (MP3)',
              formatID: '0',
              formatExtension: 'mp3',
            };
            formatMap.set('audio-mp3', mp3Format);

            // Convert map to array and set available formats
            const formats = Array.from(formatMap.values());
            setAvailableFormats(formats);

            // Set default format if available
            if (formats.length > 0) {
              setDownloadFormat(formats[0].formatDisplayName);
              setDownloadFormatID(formats[0].formatID);
            }
          }

          setIsValidUrl(true);
        } catch (error) {
          console.error('Error fetching video info:', error);
          setIsValidUrl(false);
          // You might want to add error handling UI here
        } finally {
          setIsLoading(false);
        }
      };

      fetchVideoInfo();
    }
  }, [downloadUrl]);

  const handleDirectory = async () => {
    const path = await window.ytdlp.selectDownloadDirectory();
    setDownloadLocation(path);
  };
  // Move the conditional return after all hooks
  if (!isOpen) return null;

  // Return the JSX
  return (
    <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center h-full">
      <div
        className={`bg-white rounded-lg pt-6 pr-6 pl-6 pb-4 ${
          downloadUrl && videoId
            ? 'w-4/5 max-w-[1000px] flex gap-6'
            : 'w-full max-w-xl'
        }`}
      >
        <div className={downloadUrl && videoId ? 'flex-1' : 'w-full'}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">New Download</h2>
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <IoMdClose size={16} />
            </button>
          </div>

          <div className="flex gap-6">
            {/* Left side - Form */}
            <form
              onSubmit={(e) => e.preventDefault()}
              className={downloadUrl && videoId ? 'w-2/3' : 'flex-1'}
            >
              <div className="space-y-4">
                <div>
                  <label className="block">Download link</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Paste link here"
                      value={downloadUrl}
                      onChange={(e) => setDownloadLink(e.target.value)}
                      className="flex-1 border rounded-md px-3 py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block">Save file to</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={downloadLocation}
                      onClick={handleDirectory}
                      placeholder="Download Destination Folder"
                      className="flex-1 border rounded-md px-3 py-2"
                    />
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block">Name</label>
                    <input
                      type="text"
                      placeholder="Name"
                      value={downloadName}
                      onChange={(e) => setFileName(e.target.value)}
                      className="w-full border rounded-md px-3 py-2"
                    />
                  </div>

                  <div className="flex-1">
                    <label className="block">Select Format</label>
                    <select
                      value={downloadFormat}
                      onChange={(e) => {
                        setDownloadFormat(e.target.value);
                        const selectedFormat = availableFormats.find(
                          (format) =>
                            format.formatDisplayName === e.target.value,
                        );
                        if (selectedFormat) {
                          setDownloadFormatID(selectedFormat.formatID);
                        }
                      }}
                      className="w-full border rounded-md px-3 py-2"
                    >
                      {availableFormats.length > 0 ? (
                        availableFormats.map((format) => (
                          <option
                            key={format.formatID}
                            value={format.formatDisplayName}
                          >
                            {format.formatDisplayName} ({format.formatExtension}
                            )
                          </option>
                        ))
                      ) : (
                        <option value="">No formats available</option>
                      )}
                    </select>
                  </div>
                </div>
              </div>
            </form>

            {/* Right side - Video Preview */}
            {downloadUrl && videoId && (
              <div className="w-2/3 flex items-center">
                <div className="aspect-video rounded-lg overflow-hidden w-full">
                  <iframe
                    width="100%"
                    height="100%"
                    src={`https://www.youtube.com/embed/${videoId}`}
                    title="YouTube video preview"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>
              </div>
            )}
          </div>
          <hr className="solid mt-4 mb-2 -mx-6 w-[calc(100%+47px)] border-t-2 border-divider" />

          <div className="flex gap-3">
            <button
              type="submit"
              className="bg-primary text-white px-2 py-2 rounded-md hover:bg-primary"
            >
              Download
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="px-2 py-2 border rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DownloadModal;
