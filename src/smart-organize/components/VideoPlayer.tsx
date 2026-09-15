import { useEffect, useState } from 'react';

const VideoPlayer = ({ selectedDownload }: { selectedDownload: any }) => {
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);

  console.log('selected download', selectedDownload);
  useEffect(() => {
    if (!selectedDownload?.location) {
      setIsVideoLoading(false);
      return;
    }

    setIsVideoLoading(true);
    setVideoSrc(null); // Clear previous video immediately

    const loadVideo = async () => {
      const videoPath = await window.downlodrFunctions.joinDownloadPath(
        selectedDownload.location,
        selectedDownload.downloadName,
      );
      if (!videoPath) {
        setIsVideoLoading(false);
        return;
      }
      try {
        const result = await window.downlodrFunctions.getVideoBlob(videoPath);
        if (!result) {
          setIsVideoLoading(false);
          return;
        }

        // Handle different response types
        if (typeof result === 'string') {
          // Legacy base64 string response (for backward compatibility)
          const bytes = Uint8Array.from(atob(result), (c) => c.charCodeAt(0));
          const blob = new Blob([bytes], { type: 'video/mp4' });
          const url = URL.createObjectURL(blob);
          setVideoSrc(url);
          setIsVideoLoading(false);
        } else if (result.type === 'buffer') {
          // New buffer response - direct binary data
          const uint8Array = new Uint8Array(result.data);
          const blob = new Blob([uint8Array], {
            type: result.mimeType || 'video/mp4',
          });
          const url = URL.createObjectURL(blob);
          setVideoSrc(url);
          setIsVideoLoading(false);
          console.log(
            `Video blob created successfully (${(
              result.size /
              1024 /
              1024
            ).toFixed(2)}MB)`,
          );
        } else if (result.type === 'stream') {
          // Large file streaming approach
          await loadVideoStream(result);
        } else if (result.type === 'base64') {
          // Base64 object response (fallback)
          const bytes = Uint8Array.from(atob(result.data), (c) =>
            c.charCodeAt(0),
          );
          const blob = new Blob([bytes], { type: 'video/mp4' });
          const url = URL.createObjectURL(blob);
          setVideoSrc(url);
          setIsVideoLoading(false);
        }
      } catch (error) {
        console.error('Error loading video:', error);
        // Optionally set a fallback or show an error state
        setVideoSrc('');
        setIsVideoLoading(false);
      }
    };

    const loadVideoStream = async (streamInfo: {
      filePath: string;
      size: number;
      mimeType: string;
    }) => {
      try {
        console.log(
          `Loading large video file (${(
            streamInfo.size /
            1024 /
            1024 /
            1024
          ).toFixed(2)}GB) via streaming...`,
        );

        const chunkSize = 50 * 1024 * 1024; // 50MB chunks
        const chunks: Uint8Array[] = [];
        let totalLoaded = 0;

        for (let start = 0; start < streamInfo.size; start += chunkSize) {
          const end = Math.min(start + chunkSize, streamInfo.size);
          const chunkResult = await window.downlodrFunctions.getVideoChunk(
            streamInfo.filePath,
            start,
            end,
          );

          if (!chunkResult) {
            throw new Error('Failed to load video chunk');
          }

          // Create a new Uint8Array to ensure proper ArrayBuffer
          const chunk = new Uint8Array(chunkResult.bytesRead);
          chunk.set(new Uint8Array(chunkResult.data));
          chunks.push(chunk);
          totalLoaded += chunkResult.bytesRead;

          // Log progress
          const progress = ((totalLoaded / streamInfo.size) * 100).toFixed(1);
          console.log(
            `Loading progress: ${progress}% (${totalLoaded}/${streamInfo.size} bytes)`,
          );
        }

        // Combine all chunks into a single blob
        const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const combined = new Uint8Array(totalBytes);
        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }
        const blob = new Blob([combined], { type: streamInfo.mimeType });
        const url = URL.createObjectURL(blob);
        setVideoSrc(url);
        setIsVideoLoading(false);

        console.log(
          `Large video loaded successfully (${(
            streamInfo.size /
            1024 /
            1024 /
            1024
          ).toFixed(2)}GB)`,
        );
      } catch (error) {
        console.error('Error loading video stream:', error);
        setVideoSrc('');
        setIsVideoLoading(false);
      }
    };

    loadVideo();

    // Cleanup function to revoke blob URLs when component unmounts or selectedDownload changes
    return () => {
      if (videoSrc && videoSrc.startsWith('blob:')) {
        URL.revokeObjectURL(videoSrc);
      }
    };
  }, [selectedDownload]);
  return (
    <video
      src={videoSrc}
      controls
      autoPlay
      className="w-full h-full object-contain"
      style={{ display: 'block' }}
    />
  );
};

export default VideoPlayer;
