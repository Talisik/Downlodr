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
  const [downloadLocation, setDownloadLocation] = useState('C:\\');
  const [downloadName, setFileName] = useState('');
  const [downloadFormat, setDownloadFormat] = useState('MP4 1080');
  const [downloadFormatID, setDownloadFormatID] = useState('');
  const [downloadAudioFormat, setDownloadAudioFormat] = useState('MP4 1080');
  const [downloadAudioFormatID, setDownloadAudioFormatID] = useState('');
  const [videoId, setVideoId] = useState('');

  // Download Data
  const [UrlInfo, setUrlInfo] = useState<object | null>(null);
  const [UrlTitle, setUrlTitle] = useState<string | null>(null);
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

  // Extract YouTube video ID from URL
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
      <div
        className={`bg-white rounded-lg p-6 w-full ${
          downloadUrl && videoId ? 'max-w-[900px] flex gap-6' : 'max-w-lg'
        }`}
      >
        {/* Left side - Form */}
        <div className={downloadUrl && videoId ? 'flex-1' : 'w-full'}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">New Download</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <IoMdClose size={16} />
            </button>
          </div>

          <form onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-4">
              <div>
                <label className="block mb-2">Download link</label>
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
                <label className="block mb-2">Save file to</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={downloadLocation}
                    onChange={(e) => setDownloadLocation(e.target.value)}
                    className="flex-1 border rounded-md px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block mb-2">Name</label>
                  <input
                    type="text"
                    placeholder="Name"
                    value={downloadName}
                    onChange={(e) => setFileName(e.target.value)}
                    className="w-full border rounded-md px-3 py-2"
                  />
                </div>

                <div className="flex-1">
                  <label className="block mb-2">Select Format</label>
                  <select
                    value={downloadFormat}
                    onChange={(e) => {
                      setDownloadFormat(e.target.value);
                      const selectedFormat = availableFormats.find(
                        (format) => format.formatDisplayName === e.target.value,
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
                          {format.formatDisplayName} ({format.formatExtension})
                        </option>
                      ))
                    ) : (
                      <option value="">No formats available</option>
                    )}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                type="submit"
                className="bg-orange-500 text-white px-4 py-2 rounded-md hover:bg-orange-600"
              >
                Download
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        {/* Right side - Video Preview */}
        {downloadUrl && videoId && (
          <div className="flex-1">
            <div className="aspect-video rounded-lg overflow-hidden">
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
    </div>
  );
};

export default DownloadModal;
