import React, { useCallback, useEffect, useRef, useState } from 'react';
import { resolveVideoSource } from '@/downlodr/utils/resolveVideoSource';
import { getExtractorIcon } from '@/downlodr/utils/icons/iconMapper';
import { HiMiniBars3 } from 'react-icons/hi2';
import { FaHeart, FaRegHeart } from 'react-icons/fa6';
import { useFavoritesStore } from '@/downlodr/store/favoritesStore';
import { Separator } from '@/core-app/components/shadcn/components/ui/separator';
import { FcFolder } from 'react-icons/fc';
import Toolbar from '../base/Toolbar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/core-app/components/shadcn/components/ui/tooltip';

type PlayerState = 'loading' | 'ready' | 'buffering' | 'error';

interface VideoPlayerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  title: string;
  autoCaptionLocation?: string;
  transcriptLocation?: string;
  width: number;
  onWidthChange: (w: number) => void;
  status?: string;
  downloadName?: string;
  displayName?: string;
  dateAdded?: string;
  location?: string;
  tags?: string[];
  category?: string[];
  description?: string;
  channelName?: string;
  thumbnail?: string;
  ext?: string;
  duration?: number;
  size?: number;
  extractorKey?: string;
  downloadId?: string;
}

const VideoPlayerPanel: React.FC<VideoPlayerPanelProps> = ({
  isOpen,
  onClose,
  videoUrl,
  title,
  autoCaptionLocation,
  transcriptLocation,
  width,
  onWidthChange,
  status,
  downloadName,
  displayName,
  dateAdded,
  location,
  tags,
  category,
  description,
  channelName,
  thumbnail,
  ext,
  duration,
  size,
  extractorKey,
  downloadId,
}) => {
  const [playerState, setPlayerState] = useState<PlayerState>('loading');
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  const [captionBlobUrl, setCaptionBlobUrl] = useState<string | null>(null);
  const [isFloating, setIsFloating] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [transcriptText, setTranscriptText] = useState<string | null>(null);
  const generationRef = useRef(0);
  const localBlobRef = useRef<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isFavorited = useFavoritesStore((s) =>
    downloadId ? s.isFavorited(downloadId) : false,
  );
  const addFavorite = useFavoritesStore((s) => s.addFavorite);
  const removeFavorite = useFavoritesStore((s) => s.removeFavorite);

  const handleToggleFavorite = () => {
    if (!downloadId) return;
    if (isFavorited) {
      removeFavorite(downloadId);
    } else {
      addFavorite({
        downloadId,
        videoUrl: videoUrl ?? '',
        title: title ?? '',
        displayName,
        downloadName: downloadName ?? '',
        location: location ?? '',
        channelName: channelName ?? '',
        thumbnail,
        ext: ext ?? '',
        duration: duration ?? 0,
        size: size ?? 0,
        extractorKey: extractorKey ?? '',
        tags: tags ?? [],
        category: category ?? [],
        description,
        status: status ?? '',
        autoCaptionLocation,
        transcriptLocation,
        dateAdded: dateAdded ?? '',
      });
    }
  };

  const revokeLocalBlob = () => {
    if (localBlobRef.current) {
      URL.revokeObjectURL(localBlobRef.current);
      localBlobRef.current = null;
    }
  };

  const fetchUrl = useCallback(() => {
    if (!videoUrl && !location) return;
    generationRef.current += 1;
    const gen = generationRef.current;
    setPlayerState('loading');
    setDirectUrl(null);
    revokeLocalBlob();
    resolveVideoSource({ status, location, downloadName, videoUrl })
      .then(({ url, isLocalBlob }) => {
        if (gen !== generationRef.current) {
          if (isLocalBlob) URL.revokeObjectURL(url);
          return;
        }
        if (isLocalBlob) localBlobRef.current = url;
        setDirectUrl(url);
        setPlayerState('ready');
      })
      .catch(() => {
        if (gen !== generationRef.current) return;
        setPlayerState('error');
      });
  }, [videoUrl, status, location, downloadName]);

  useEffect(() => {
    if (!isOpen || (!videoUrl && !location)) return;
    fetchUrl();
    return () => {
      generationRef.current += 1;
      revokeLocalBlob();
    };
  }, [isOpen, videoUrl, location, status, fetchUrl]);

  useEffect(() => {
    const captionPath = transcriptLocation ?? autoCaptionLocation ?? null;
    if (!isOpen || !captionPath) {
      setCaptionBlobUrl(null);
      setTranscriptText(null);
      setShowTranscript(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    window.ytdlp
      .readCaptionFile(captionPath)
      .then((content) => {
        if (cancelled) return;
        setTranscriptText(content);
        const vttContent = captionPath.endsWith('.srt')
          ? `WEBVTT\n\n${content.replace(
              /(\d{2}:\d{2}:\d{2}),(\d{3})/g,
              '$1.$2',
            )}`
          : content;
        const blob = new Blob([vttContent], { type: 'text/vtt' });
        objectUrl = URL.createObjectURL(blob);
        setCaptionBlobUrl(objectUrl);
      })
      .catch(() => {
        // captions are optional — silently skip on error
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setCaptionBlobUrl(null);
    };
  }, [isOpen, autoCaptionLocation, transcriptLocation]);

  useEffect(() => {
    if (!isOpen) setIsFloating(false);
  }, [isOpen]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const handleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  const handleRetry = () => {
    fetchUrl();
  };

  const handleFloat = async () => {
    if (videoRef.current && document.pictureInPictureEnabled) {
      try {
        videoRef.current.addEventListener(
          'leavepictureinpicture',
          () => setIsFloating(false),
          { once: true },
        );
        await videoRef.current.requestPictureInPicture();
        setIsFloating(true);
      } catch {
        // PiP request failed (e.g. video paused) — stay in panel
      }
    } else {
      onClose();
    }
  };

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const onMouseMove = (ev: MouseEvent) => {
      const panel = panelRef.current;
      if (!panel || !panel.parentElement) return;
      const parentRect = panel.parentElement.getBoundingClientRect();
      const newWidth =
        ((parentRect.right - ev.clientX) / parentRect.width) * 100;
      onWidthChange(Math.min(70, Math.max(40, newWidth)));
    };

    const onMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  if (!isOpen) return null;

  return (
    <div
      className="flex-shrink-0 h-full self-start bg-white dark:bg-darkMode rounded-md shadow-lg flex-col overflow-hidden"
      style={{
        width: `${width}%`,
        transition: isResizing ? 'none' : 'width 200ms ease',
      }}
    >
      <div ref={panelRef} className="relative flex flex-col w-full h-full">
        {/* Drag handle */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-primary/30"
          onMouseDown={handleDragStart}
        />

        {/* Header */}
        <div className="bg-titleBar dark:bg-darkModeDropdown px-2 py-1 pt-[11px] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 mx-2">
            <span>{getExtractorIcon(extractorKey || 'youtube')}</span>
            <span className="text-black dark:text-white font-semibold text-md leading-6 truncate">
              {extractorKey || 'Video'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-black dark:text-white hover:text-red-500 ml-2 p-1 flex-shrink-0"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="m18 6-12 12M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 flex flex-row md:flex-row overflow-hidden">
          {/* Video area */}
          <div className="m-4 w-3/5 flex-1 flex items-center justify-center bg-black overflow-hidden rounded">
            <div
              ref={containerRef}
              className="relative w-full"
              style={{ aspectRatio: '16/9' }}
            >
              <div className="absolute top-2 right-2 z-20 flex gap-1">
                {document.pictureInPictureEnabled &&
                  playerState === 'ready' && (
                    <button
                      onClick={handleFloat}
                      className="px-3 py-1 bg-black/60 text-white text-xs rounded hover:bg-black/80"
                      title="Float window"
                    >
                      Float
                    </button>
                  )}
              </div>

              {playerState === 'loading' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-3" />
                  <p className="text-white text-sm">Fetching stream URL…</p>
                </div>
              )}

              {playerState === 'buffering' && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
                  <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {playerState === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10 gap-3">
                  <p className="text-white text-sm">
                    Could not load video stream.
                  </p>
                  <button
                    onClick={handleRetry}
                    className="px-4 py-1.5 bg-primary text-white text-sm rounded-md hover:opacity-90"
                  >
                    Retry
                  </button>
                </div>
              )}

              {isFloating && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10 gap-2">
                  <p className="text-white text-sm">
                    Playing in floating window
                  </p>
                  <button
                    onClick={() => document.exitPictureInPicture()}
                    className="px-4 py-1.5 bg-primary text-white text-sm rounded-md hover:opacity-90"
                  >
                    Return to panel
                  </button>
                </div>
              )}

              {directUrl && (
                <video
                  ref={videoRef}
                  src={directUrl}
                  controls
                  autoPlay
                  className="w-full h-full"
                  onWaiting={() => setPlayerState('buffering')}
                  onPlaying={() => setPlayerState('ready')}
                  onCanPlay={() => setPlayerState('ready')}
                  onError={() => setPlayerState('error')}
                >
                  {captionBlobUrl && (
                    <track
                      key={captionBlobUrl}
                      kind="subtitles"
                      src={captionBlobUrl}
                      srcLang="en"
                      label="Captions"
                      default
                    />
                  )}
                </video>
              )}
            </div>
          </div>

          <div className="flex self-stretch w-2/5 p-4 overflow-hidden bg-white dark:bg-darkMode flex-col gap-2">
            {dateAdded && (
              <div className="flex items-baseline gap-2 items-center justify-between">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-[13px]">
                    {title || 'Video Preview'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                  <button
                    onClick={handleToggleFavorite}
                    className={`transition-colors ${
                      downloadId
                        ? 'hover:opacity-80'
                        : 'opacity-30 cursor-default'
                    }`}
                    title={
                      isFavorited ? 'Remove from favorites' : 'Add to favorites'
                    }
                  >
                    {isFavorited ? (
                      <FaHeart className="text-red-400" />
                    ) : (
                      <FaRegHeart />
                    )}
                  </button>
                  {transcriptText && (
                    <Tooltip>
                      <TooltipContent>
                        <p>
                          {showTranscript
                            ? 'Hide transcript'
                            : 'Show transcript'}
                        </p>
                      </TooltipContent>
                      <TooltipTrigger>
                        <button
                          onClick={() => setShowTranscript((v) => !v)}
                          className={showTranscript ? 'text-primary' : ''}
                        >
                          <HiMiniBars3 />
                        </button>
                      </TooltipTrigger>
                    </Tooltip>
                  )}
                </div>
              </div>
            )}
            {showTranscript ? (
              <div className="flex flex-col gap-1 flex-1 min-h-0">
                <span className="text-[12px] text-gray-500 dark:text-gray-400 flex-shrink-0">
                  Transcript
                </span>
                <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed overflow-y-auto flex-1">
                  {transcriptText}
                </p>
              </div>
            ) : (
              <>
                <div className="flex gap-4 items-start space-y-2">
                  <div className="flex flex-col gap-2 min-w-0">
                    <div className="flex flex-row gap-1 min-w-0 items-center">
                      {thumbnail && thumbnail !== '—' && (
                        <img
                          src={thumbnail}
                          alt="thumbnail"
                          className="w-6 h-6 object-cover rounded-full flex-shrink-0"
                        />
                      )}
                      {channelName && (
                        <span className="text-[12px] font-medium truncate  text-gray-500 dark:text-gray-200">
                          {channelName}
                        </span>
                      )}
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        •
                      </span>
                      {dateAdded && (
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">
                          {new Date(dateAdded).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 text-[11px] text-gray-500 dark:text-gray-400 flex-wrap">
                      {ext && (
                        <span className="text-xxs bg-[#000000] text-white dark:bg-gray-700 px-2 py-0.5 rounded-lg text-gray-600 dark:text-gray-300">
                          {ext.toUpperCase()}
                        </span>
                      )}
                      {duration != null && duration > 0 && (
                        <span className="text-xxs bg-[#E6E6E6] dark:bg-gray-700 px-2 py-0.5 rounded-lg text-gray-600 dark:text-gray-300">
                          {Math.floor(duration / 3600) > 0
                            ? `${Math.floor(duration / 3600)}:${String(
                                Math.floor((duration % 3600) / 60),
                              ).padStart(2, '0')}:${String(
                                Math.floor(duration % 60),
                              ).padStart(2, '0')}`
                            : `${Math.floor(duration / 60)}:${String(
                                Math.floor(duration % 60),
                              ).padStart(2, '0')}`}
                        </span>
                      )}
                      {size != null && size > -1 && (
                        <span className="text-xxs bg-[#E6E6E6] dark:bg-gray-700 px-2 py-0.5 rounded-lg text-gray-600 dark:text-gray-300">
                          {size >= 1073741824
                            ? `${(size / 1073741824).toFixed(1)} GB`
                            : size >= 1048576
                            ? `${(size / 1048576).toFixed(1)} MB`
                            : `${(size / 1024).toFixed(0)} KB`}
                        </span>
                      )}
                      {location && (
                        <span className="text-xxs bg-[#E6E6E6] dark:bg-gray-700 px-2 py-0.5 rounded-lg text-gray-600 dark:text-gray-300">
                          Open With
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <Separator />
                <div>
                  {location && (
                    <div className="text-xs text-primary dark:text-gray-500 truncate gap-1">
                      <span>
                        <FcFolder />
                      </span>
                      <span title={location}>{location}</span>
                    </div>
                  )}
                </div>
                <Separator />

                <div>
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[12px]">Categories:</span>
                    {category && category.length > 0 && (
                      <div>
                        {category.map((cat) => (
                          <span
                            key={cat}
                            className="px-1.5 py-0.5 text-[10px] rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[12px]">Tags:</span>
                    {tags && tags.length > 0 && (
                      <div>
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="px-1.5 py-0.5 text-[10px] rounded bg-primary/10 text-primary"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <Separator />

                {description ? (
                  <div className="flex flex-col gap-1 h-full">
                    <span className="text-[12px]">Description</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap leading-relaxed max-h-[70%] overflow-y-auto">
                      {description}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      No description available
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayerPanel;
