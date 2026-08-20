import DownlodrLoader from '@/downlodr/components/audioWaveform/DownlodrLoader.gif';
import Hls from 'hls.js';
import PlayerControlsBar from '@/downlodr/components/panel/PlayerControlsBar';
import { formatDuration } from '@/downlodr/utils/formatDuration';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  blobUrlFromVideoFile,
  resolveVideoSource,
} from '@/downlodr/utils/resolveVideoSource';
import { getExtractorIcon } from '@/downlodr/utils/icons/iconMapper';
import { FaHeart, FaRegHeart } from 'react-icons/fa6';
import type { ChapterInfo, ForDownload } from '@/downlodr/store/download/types';
import { useArticleDownloadStore } from '@/afda/store/articleDownloadStore';
import { Separator } from '@/core-app/components/shadcn/components/ui/separator';
import { FcFolder } from 'react-icons/fc';
import {
  LuFolderOpen,
  LuExternalLink,
  LuShare2,
  LuCaptions,
  LuEllipsisVertical,
} from 'react-icons/lu';
import FormatSelectorModal from '@/downlodr/components/download/FormatSelectorModal';
import { IoMdDownload } from 'react-icons/io';
import ShareButton from '@/downlodr/components/download/ShareButton';
import { redownloadTranscript } from '@/downlodr/utils/transcription/ffmpegWhisperTranscriber';
import { useDownloadStore } from '@/downlodr/store/downloadStore';
import { toast } from '@/core-app/components/shadcn/hooks/use-toast';

import type { SearchableDownload } from '@/downlodr/store/taskbarDownloadStore';

import type { VideoInfo } from '@/downlodr/schema/metadataSchema';
import { TriangleArrow } from '@/assets/icon';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { VscPlayCircle } from 'react-icons/vsc';
import { FiPlayCircle } from 'react-icons/fi';
import { TbClockCheck, TbClockCancel } from 'react-icons/tb';

type PlayerState = 'loading' | 'ready' | 'buffering' | 'error';

const WAVEFORM_HEIGHT = 200;

const AUDIO_ONLY_EXTS = new Set([
  'mp3',
  'm4a',
  'ogg',
  'wav',
  'flac',
  'aac',
  'opus',
  'weba',
]);

function vttTimeToSeconds(ts: string): number {
  const parts = ts.trim().split(':');
  if (parts.length === 3) {
    return (
      parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2])
    );
  }
  return parseFloat(ts);
}

function formatVttTime(ts: string): string {
  const parts = ts.trim().split(':');
  if (parts.length === 3) {
    const h = parseInt(parts[0]);
    const m = parseInt(parts[1]);
    const s = parseInt(parts[2]);
    if (h > 0)
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  return ts;
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-orange-200 text-orange-800 dark:bg-orange-500/30 dark:text-orange-300 rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function parseWordsFromLine(
  line: string,
  cueStart: number,
): { text: string; startSeconds: number }[] {
  const words: { text: string; startSeconds: number }[] = [];
  // Capture the text before the first <c> tag — it starts at the cue's own start time
  const firstTagIndex = line.indexOf('<');
  const prefix =
    firstTagIndex > 0
      ? line
          .slice(0, firstTagIndex)
          .replace(/<[^>]+>/g, '')
          .trim()
      : '';
  if (prefix) words.push({ text: prefix, startSeconds: cueStart });
  const re = /<(\d{2}:\d{2}:\d{2}\.\d{3})><c>([^<]*)<\/c>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const w = m[2];
    if (w.trim()) words.push({ text: w, startSeconds: vttTimeToSeconds(m[1]) });
  }
  return words;
}

function parseVttCues(vtt: string): {
  time: string;
  startSeconds: number;
  text: string;
  words: { text: string; startSeconds: number }[];
}[] {
  if (!vtt.trim().startsWith('WEBVTT')) return [];
  const cues: {
    time: string;
    startSeconds: number;
    text: string;
    words: { text: string; startSeconds: number }[];
  }[] = [];
  for (const block of vtt.split(/\n\n+/)) {
    const lines = block.trim().split('\n');
    const tsLine = lines.find((l) => l.includes('-->'));
    if (!tsLine) continue;
    const textLines = lines.slice(lines.indexOf(tsLine) + 1);
    // YouTube uses a rolling two-line window: line 1 = previous caption (clean),
    // line 2 = new caption with inline tags. Take only the last non-empty line.
    const lastLine = [...textLines].reverse().find((l) => l.trim());
    if (!lastLine) continue;
    const text = lastLine.replace(/<[^>]+>/g, '').trim();
    if (!text) continue;
    const rawStart = tsLine.split('-->')[0];
    const startSeconds = vttTimeToSeconds(rawStart);
    cues.push({
      time: formatVttTime(rawStart),
      startSeconds,
      text,
      words: parseWordsFromLine(lastLine, startSeconds),
    });
  }
  // Deduplicate consecutive identical text (transition cues)
  return cues.filter((cue, i) => i === 0 || cue.text !== cues[i - 1].text);
}

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
  chapters?: ChapterInfo[];
  channelName?: string;
  thumbnail?: string;
  ext?: string;
  duration?: number;
  size?: number;
  extractorKey?: string;
  downloadId?: string;
  allDownloads?: SearchableDownload[];
  thumbnailDataUrls?: Record<string, string>;
  activeDownloadId?: string;
  onSelectDownload?: (download: SearchableDownload) => void;
}

async function getAudioPeaks(
  url: string,
  numPeaks = 500,
): Promise<{ peaks: number[][]; duration: number }> {
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioContext = new AudioContext({ sampleRate: 3000 });
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  audioContext.close();

  const peaks: number[][] = [];
  for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
    const channelData = audioBuffer.getChannelData(c);
    const blockSize = Math.floor(channelData.length / numPeaks);
    const channelPeaks: number[] = [];
    for (let i = 0; i < numPeaks; i++) {
      let max = 0;
      for (let j = 0; j < blockSize; j++) {
        const abs = Math.abs(channelData[i * blockSize + j]);
        if (abs > max) max = abs;
      }
      channelPeaks.push(max);
    }
    peaks.push(channelPeaks);
  }

  return { peaks, duration: audioBuffer.duration };
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
  chapters,
  channelName,
  thumbnail,
  ext,
  duration,
  size,
  extractorKey,
  downloadId,
  allDownloads,
  thumbnailDataUrls,
  activeDownloadId,
  onSelectDownload,
}) => {
  const [playerState, setPlayerState] = useState<PlayerState>('loading');
  const [isWaveSurferReady, setIsWaveSurferReady] = useState(false);
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  const [captionBlobUrl, setCaptionBlobUrl] = useState<string | null>(null);
  const [isFloating, setIsFloating] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    'description' | 'transcript' | 'chapters'
  >('description');
  const [transcriptText, setTranscriptText] = useState<string | null>(null);
  const [transcriptCues, setTranscriptCues] = useState<
    ReturnType<typeof parseVttCues>
  >([]);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const activeCueIndex = useMemo(() => {
    if (!transcriptCues.length || currentTime === 0) return -1;
    let idx = -1;
    for (let i = 0; i < transcriptCues.length; i++) {
      if (transcriptCues[i].startSeconds <= currentTime) idx = i;
      else break;
    }
    return idx;
  }, [transcriptCues, currentTime]);
  const [transcriptSearch, setTranscriptSearch] = useState('');
  const [chapterSearch, setChapterSearch] = useState('');
  const activeChapterIndex = useMemo(() => {
    if (!chapters?.length || currentTime === 0) return -1;
    let idx = -1;
    for (let i = 0; i < chapters.length; i++) {
      if (chapters[i].start_time <= currentTime) idx = i;
      else break;
    }
    return idx;
  }, [chapters, currentTime]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [shareDownloadId, setShareDownloadId] = useState<string | null>(null);
  const [pendingDownload, setPendingDownload] = useState<ForDownload | null>(
    null,
  );
  const [transcriptCopied, setTranscriptCopied] = useState(false);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const generationRef = useRef(0);
  const panelIdRef = useRef(crypto.randomUUID());
  const localBlobRef = useRef<string | null>(null);
  // Tracks the in-flight temp-file fallback download (used when a site's CDN
  // rejects direct-URL playback, e.g. TikTok) so a fast video switch can
  // cancel it instead of leaving it running for a video no longer shown.
  // The downloaded file itself is read into localBlobRef (below) and
  // deleted immediately — no separate temp-file cleanup needed.
  const previewRequestIdRef = useRef<string | null>(null);
  const usedPreviewFallbackRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const transcriptListRef = useRef<HTMLUListElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoWrapperRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const scrollInactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveContainerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<import('wavesurfer.js').default | null>(null);
  const hoverWsRef = useRef<import('wavesurfer.js').default | null>(null);
  const waveOuterRef = useRef<HTMLDivElement>(null);
  const hoverWsContainerRef = useRef<HTMLDivElement>(null);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const hoverCleanupRef = useRef<(() => void) | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [audioVolume, setAudioVolume] = useState(1);
  const [audioPlaybackRate, setAudioPlaybackRate] = useState(1);

  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [videoVolume, setVideoVolume] = useState(1);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoPlaybackRate, setVideoPlaybackRate] = useState(1);
  const [isCaptionsEnabled, setIsCaptionsEnabled] = useState(true);
  const [captionPos, setCaptionPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideControlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const isAudioMode = Boolean(ext && AUDIO_ONLY_EXTS.has(ext.toLowerCase()));
  const { t } = useTranslation('downlodr');

  const isArticle = extractorKey === 'Article';
  const videoFavorited = useDownloadStore((s) => {
    if (!downloadId || isArticle) return false;
    const all = [
      ...s.downloading,
      ...s.finishedDownloads,
      ...s.historyDownloads,
      ...s.forDownloads,
      ...s.queuedDownloads,
    ];
    return !!all.find((d) => d.id === downloadId)?.favorited;
  });
  const articleFavorited = useArticleDownloadStore((s) => {
    if (!downloadId || !isArticle) return false;
    return !!s.articleDownloads.find((d) => d.id === downloadId)?.favorited;
  });
  const isFavorited = isArticle ? articleFavorited : videoFavorited;
  const toggleFavorite = useDownloadStore((s) => s.toggleFavorite);
  const toggleArticleFavorite = useArticleDownloadStore(
    (s) => s.toggleArticleFavorite,
  );

  const openFolderWithFallback = async (
    folderPath: string,
    filePathArg?: string | null,
  ) => {
    if (filePathArg) {
      const fileExists = await window.downlodrFunctions.fileExists(filePathArg);
      if (fileExists) {
        const success = await window.downlodrFunctions.openFolder(
          folderPath,
          filePathArg,
        );
        if (success) return;
      }
    }
    const folderExists = await window.downlodrFunctions.fileExists(folderPath);
    if (folderExists) {
      await window.downlodrFunctions.openFolder(folderPath, null);
    }
  };

  const handleGenerateCaption = async (d: SearchableDownload) => {
    const inputLocation = await window.downlodrFunctions.joinDownloadPath(
      d.location,
      d.downloadName,
    );
    const outputLocation = await window.downlodrFunctions.joinDownloadPath(
      d.location,
      d.downloadName.replace(/\.[^/.]+$/, '.srt'),
    );

    useDownloadStore.setState((state) => {
      const mark = <
        T extends {
          id: string;
          transcriptionStatus?: string;
          transcriptionProgress?: number;
          getTranscript?: boolean;
        },
      >(
        item: T,
      ): T =>
        item.id === d.id
          ? {
              ...item,
              transcriptionStatus: 'transcribing',
              getTranscript: true,
              transcriptionProgress: 0,
            }
          : item;
      return {
        forDownloads: state.forDownloads.map(mark),
        downloading: state.downloading.map(mark),
        finishedDownloads: state.finishedDownloads.map(mark),
        historyDownloads: state.historyDownloads.map(mark),
        queuedDownloads: state.queuedDownloads.map(mark),
      };
    });

    const result = await redownloadTranscript(
      {
        inputFile: inputLocation,
        outputFile: outputLocation,
        modelPath: 'ggml-small.bin',
        // 'auto', not 'en': forcing English makes Whisper *translate* non-English
        // audio into English rather than transcribe it in its own language.
        language: 'auto',
        format: 'srt',
      },
      {
        onProgressPercent: (percent) => {
          useDownloadStore.setState((state) => {
            const withProgress = <
              T extends { id: string; transcriptionProgress?: number },
            >(
              item: T,
            ): T =>
              item.id === d.id
                ? { ...item, transcriptionProgress: percent }
                : item;
            return {
              forDownloads: state.forDownloads.map(withProgress),
              downloading: state.downloading.map(withProgress),
              finishedDownloads: state.finishedDownloads.map(withProgress),
              historyDownloads: state.historyDownloads.map(withProgress),
              queuedDownloads: state.queuedDownloads.map(withProgress),
            };
          });
        },
      },
    );

    if (result.success && result.outputFile) {
      useDownloadStore.setState((state) => {
        const markDone = <
          T extends {
            id: string;
            transcriptionStatus?: string;
            transcriptionProgress?: number;
          },
        >(
          item: T,
        ): T =>
          item.id === d.id
            ? {
                ...item,
                transcriptionStatus: 'completed',
                transcriptionProgress: 100,
              }
            : item;
        return {
          forDownloads: state.forDownloads.map(markDone),
          downloading: state.downloading.map(markDone),
          finishedDownloads: state.finishedDownloads.map(markDone),
          historyDownloads: state.historyDownloads.map(markDone),
          queuedDownloads: state.queuedDownloads.map(markDone),
        };
      });
      useDownloadStore
        .getState()
        .updateDownloadTranscript(d.id, result.outputFile);
    } else {
      useDownloadStore.setState((state) => {
        const markFailed = <
          T extends { id: string; transcriptionStatus?: string },
        >(
          item: T,
        ): T =>
          item.id === d.id ? { ...item, transcriptionStatus: 'failed' } : item;
        return {
          forDownloads: state.forDownloads.map(markFailed),
          downloading: state.downloading.map(markFailed),
          finishedDownloads: state.finishedDownloads.map(markFailed),
          historyDownloads: state.historyDownloads.map(markFailed),
          queuedDownloads: state.queuedDownloads.map(markFailed),
        };
      });
      toast({
        variant: 'destructive',
        title: t('videoPlayer.transcription.failed'),
        description: result.error ?? t('videoPlayer.transcription.failedDesc'),
        duration: 5000,
      });
    }
  };

  const handleOpenWith = async () => {
    console.log('location', location);
    if (!location) return;
    const fullPath = await window.downlodrFunctions.joinDownloadPath(
      location,
      downloadName ?? '',
    );
    const exists = await window.downlodrFunctions.fileExists(fullPath);
    if (exists) {
      window.downlodrFunctions.openVideo(fullPath);
    }
  };

  const handleToggleFavorite = () => {
    if (!downloadId) return;
    if (isArticle) {
      toggleArticleFavorite(downloadId);
    } else {
      toggleFavorite(downloadId);
    }
  };

  const revokeLocalBlob = () => {
    if (localBlobRef.current) {
      URL.revokeObjectURL(localBlobRef.current);
      localBlobRef.current = null;
    }
  };

  // HLS manifests (e.g. Twitch VODs) can't be played natively by Chromium's
  // <video> element — attach them through hls.js (MediaSource) instead.
  const isHlsSource = useMemo(
    () => !!directUrl && /\.m3u8(\?|$)/.test(directUrl),
    [directUrl],
  );

  useEffect(() => {
    if (!isHlsSource || !directUrl || isAudioMode) return;
    const video = videoRef.current;
    if (!video) return;
    if (!Hls.isSupported()) {
      setPlayerState('error');
      return;
    }
    const hls = new Hls();
    hls.loadSource(directUrl);
    hls.attachMedia(video);
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;
      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          hls.startLoad();
          break;
        case Hls.ErrorTypes.MEDIA_ERROR:
          hls.recoverMediaError();
          break;
        default:
          hls.destroy();
          setPlayerState('error');
      }
    });
    return () => {
      hls.destroy();
    };
  }, [directUrl, isHlsSource, isAudioMode]);

  // Cancels an in-flight temp-file fallback download. Called whenever the
  // selected video changes (or the panel closes) so switching quickly
  // between videos never leaves a download running for a video no longer
  // shown. The downloaded file itself (once complete) is read into a blob
  // and deleted immediately — see attemptPreviewFallback — so there's no
  // separate temp-file state to release here.
  const releasePreviewResources = useCallback(() => {
    if (previewRequestIdRef.current) {
      window.ytdlp.cancelPreviewDownload(previewRequestIdRef.current);
      previewRequestIdRef.current = null;
    }
  }, []);

  // Fallback for when direct-URL playback fails (e.g. TikTok's CDN 403s
  // even with correct cookies/headers — see ytdlpHandler.ts). `file://` URLs
  // are blocked by Electron's webSecurity, so instead of pointing <video> at
  // the temp file directly, this reads it into a blob: URL the same way the
  // existing "finished download" playback path already does.
  const attemptPreviewFallback = useCallback(
    (gen: number) => {
      if (gen !== generationRef.current || !videoUrl) return;
      const requestId = `${panelIdRef.current}-${gen}`;
      previewRequestIdRef.current = requestId;
      setPlayerState('loading');
      window.ytdlp
        .downloadPreview(requestId, videoUrl)
        .then(async (tempPath) => {
          previewRequestIdRef.current = null;
          try {
            if (gen !== generationRef.current) return;
            const blobUrl = await blobUrlFromVideoFile(tempPath);
            if (gen !== generationRef.current) {
              if (blobUrl) URL.revokeObjectURL(blobUrl);
              return;
            }
            if (!blobUrl) {
              // null covers both read failures and getVideoBlob's 'stream'
              // shape for files ≥ 2GB, which blob playback can't consume.
              throw new Error(
                'Preview download produced no readable data (file may exceed the 2GB blob playback limit)',
              );
            }
            revokeLocalBlob();
            localBlobRef.current = blobUrl;
            setDirectUrl(localBlobRef.current);
            setPlayerState('ready');
          } finally {
            window.ytdlp.releasePreviewFile(tempPath);
          }
        })
        .catch((err) => {
          console.error(
            '[VideoPlayerPanel] preview download fallback failed:',
            err,
          );
          previewRequestIdRef.current = null;
          if (gen !== generationRef.current) return;
          setPlayerState('error');
        });
    },
    [videoUrl],
  );

  const fetchUrl = useCallback(() => {
    if (!videoUrl && !location) return;
    generationRef.current += 1;
    const gen = generationRef.current;
    usedPreviewFallbackRef.current = false;
    releasePreviewResources();
    setPlayerState('loading');
    setIsWaveSurferReady(false);
    setDirectUrl(null);
    setCurrentTime(0);
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
      .catch((err) => {
        console.error('[VideoPlayerPanel] resolveVideoSource failed:', err);
        if (gen !== generationRef.current) return;
        setPlayerState('error');
      });
  }, [videoUrl, status, location, downloadName, releasePreviewResources]);

  useEffect(() => {
    if (!isOpen || (!videoUrl && !location)) return;
    fetchUrl();
    return () => {
      generationRef.current += 1;
      revokeLocalBlob();
      releasePreviewResources();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isOpen, videoUrl, location, status, fetchUrl, releasePreviewResources]);

  useEffect(() => {
    const captionPath = transcriptLocation ?? autoCaptionLocation ?? null;

    setCaptionBlobUrl(null);
    setTranscriptText(null);
    setTranscriptCues([]);
    setTranscriptError(null);

    if (!isOpen) return;

    let cancelled = false;
    let objectUrl: string | null = null;

    if (captionPath) {
      window.ytdlp
        .readCaptionFile(captionPath)
        .then((content) => {
          if (cancelled) return;
          const vttContent = captionPath.endsWith('.srt')
            ? `WEBVTT\n\n${content.replace(
                /(\d{2}:\d{2}:\d{2}),(\d{3})/g,
                '$1.$2',
              )}`
            : content;
          const cues = parseVttCues(vttContent);
          setTranscriptCues(cues);
          setTranscriptText(cues.length === 0 ? vttContent : null);
          const blob = new Blob([vttContent], { type: 'text/vtt' });
          objectUrl = URL.createObjectURL(blob);
          setCaptionBlobUrl(objectUrl);
        })
        .catch(() => undefined);
    } else if (videoUrl) {
      (window.ytdlp.getInfo(videoUrl) as unknown as Promise<VideoInfo>)
        .then((info) => {
          if (cancelled) return;
          const langMap =
            info.data.automatic_captions ?? info.data.subtitles ?? {};
          const entries = (langMap['en'] ??
            Object.values(langMap)[0] ??
            []) as {
            url: string;
            ext: string;
          }[];
          const preferred = ['vtt', 'srt', 'ttml'];
          const pick = preferred
            .map((f) => entries.find((e) => e.ext === f))
            .find(Boolean);
          if (!pick) return;
          fetch(pick.url)
            .then((r) => r.text())
            .then((text) => {
              if (cancelled) return;
              const cues = parseVttCues(text);
              setTranscriptCues(cues);
              const trimmed = text.trimStart();
              if (
                trimmed.startsWith('<!') ||
                trimmed.startsWith('<html') ||
                trimmed.startsWith('<HTML')
              ) {
                setTranscriptError(
                  'Transcript unavailable — YouTube blocked the request due to bot activity. Please try again later.',
                );
                toast({
                  variant: 'destructive',
                  title: 'Transcript Unavailable',
                  description:
                    'YouTube blocked the transcript request due to bot activity. Please try again later.',
                  duration: 5000,
                });
                return;
              }
              setTranscriptText(cues.length === 0 ? text : null);
              const blob = new Blob([text], { type: 'text/vtt' });
              objectUrl = URL.createObjectURL(blob);
              setCaptionBlobUrl(objectUrl);
            });
        })
        .catch(() => undefined);
    }

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setCaptionBlobUrl(null);
      setTranscriptText(null);
    };
  }, [isOpen, autoCaptionLocation, transcriptLocation, videoUrl]);

  useEffect(() => {
    if (!isOpen) setIsFloating(false);
  }, [isOpen]);

  useEffect(() => {
    if (activeCueIndex < 0 || !transcriptListRef.current) return;
    if (userScrolledRef.current) return;
    const li = transcriptListRef.current.querySelector(
      '[data-active="true"]',
    ) as HTMLElement | null;
    li?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeCueIndex]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = audioPlaybackRate;
    }
  }, [audioPlaybackRate]);

  // Re-apply volume whenever the media element is (re)created for a new source.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = audioVolume;
  }, [audioVolume, directUrl, isAudioMode]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = videoVolume;
  }, [videoVolume, directUrl, isAudioMode]);

  useEffect(() => {
    if (
      !isAudioMode ||
      !directUrl ||
      !waveContainerRef.current ||
      !hoverWsContainerRef.current ||
      !waveOuterRef.current ||
      !audioRef.current
    )
      return;

    let cancelled = false;

    const run = async () => {
      const [{ default: WaveSurfer }, { peaks, duration }] = await Promise.all([
        import('wavesurfer.js'),
        getAudioPeaks(directUrl),
      ]);

      if (
        cancelled ||
        !waveContainerRef.current ||
        !hoverWsContainerRef.current ||
        !waveOuterRef.current ||
        !audioRef.current
      )
        return;

      wavesurferRef.current?.destroy();
      hoverWsRef.current?.destroy();

      setIsWaveSurferReady(false);

      const ws = WaveSurfer.create({
        container: waveContainerRef.current,
        waveColor: 'rgba(106, 42, 16, 1)',
        progressColor: 'rgb(249, 115, 22)',
        cursorWidth: 1,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        height: WAVEFORM_HEIGHT,
        barHeight: 0.6,
        normalize: true,
        interact: true,
        media: audioRef.current,
        peaks,
        duration,
      });

      const hoverWs = WaveSurfer.create({
        container: hoverWsContainerRef.current,
        waveColor: 'rgba(255, 165, 60, 0.95)',
        progressColor: 'rgba(255, 165, 60, 0.95)',
        cursorWidth: 0,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        height: WAVEFORM_HEIGHT,
        barHeight: 0.6,
        normalize: true,
        interact: false,
        peaks,
        duration,
      });

      hoverWsRef.current = hoverWs;
      wavesurferRef.current = ws;

      ws.on('ready', () => {
        if (cancelled || !waveOuterRef.current) return;
        setIsWaveSurferReady(true);

        const cursor = ws
          .getWrapper()
          .querySelector<HTMLElement>('[part="cursor"]');
        if (cursor) {
          cursor.style.height = '80%';
          cursor.style.top = '10%';
        }

        audioRef.current?.play();

        const outer = waveOuterRef.current;

        const onMouseMove = (e: MouseEvent) => {
          const rect = outer.getBoundingClientRect();
          const hoverX = Math.max(
            0,
            Math.min(e.clientX - rect.left, rect.width),
          );
          const dur = durationRef.current;
          const cur = currentTimeRef.current;
          const currentX = dur > 0 ? (cur / dur) * rect.width : 0;

          const startPx = Math.min(currentX, hoverX);
          const endPx = Math.max(currentX, hoverX);

          const leftPct = (startPx / rect.width) * 100;
          const rightPct = ((rect.width - endPx) / rect.width) * 100;

          const hoverContainer = hoverWsContainerRef.current;
          if (!hoverContainer) return;

          hoverContainer.style.clipPath = `inset(0 ${rightPct}% 0 ${leftPct}%)`;
          hoverContainer.style.opacity = '1';
        };

        const onMouseLeave = () => {
          if (hoverWsContainerRef.current) {
            hoverWsContainerRef.current.style.opacity = '0';
          }
        };

        outer.addEventListener('mousemove', onMouseMove);
        outer.addEventListener('mouseleave', onMouseLeave);

        hoverCleanupRef.current = () => {
          outer.removeEventListener('mousemove', onMouseMove);
          outer.removeEventListener('mouseleave', onMouseLeave);
        };
      });
    };

    run();

    return () => {
      cancelled = true;
      hoverCleanupRef.current?.();
      hoverCleanupRef.current = null;
      wavesurferRef.current?.destroy();
      wavesurferRef.current = null;
      hoverWsRef.current?.destroy();
      hoverWsRef.current = null;
    };
  }, [isAudioMode, directUrl]);

  // const handleFullscreen = async () => {
  //   if (!document.fullscreenElement) {
  //     await containerRef.current?.requestFullscreen();
  //   } else {
  //     await document.exitFullscreen();
  //   }
  // };

  const handleRetry = () => {
    fetchUrl();
  };

  const handleEnded = useCallback(() => {
    if (!allDownloads || !onSelectDownload) return;
    const idx = allDownloads.findIndex((d) => d.id === activeDownloadId);
    const next = allDownloads[idx + 1];
    if (next && next.status !== 'fetching metadata') onSelectDownload(next);
  }, [allDownloads, activeDownloadId, onSelectDownload]);

  const handleFloat = async () => {
    if (!isAudioMode && videoRef.current && document.pictureInPictureEnabled) {
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

  const handleVideoPlayPause = () => {
    if (!videoRef.current) return;
    isVideoPlaying ? videoRef.current.pause() : videoRef.current.play();
  };

  const handleAudioPlayPause = () => {
    if (!audioRef.current) return;
    isAudioPlaying ? audioRef.current.pause() : audioRef.current.play();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (isAudioMode) handleAudioPlayPause();
        else handleVideoPlayPause();
      } else if (e.code === 'KeyF' && !isAudioMode) {
        e.preventDefault();
        handleFullscreen();
      } else if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        e.preventDefault();
        const delta = e.code === 'ArrowUp' ? 0.05 : -0.05;
        if (isAudioMode) handleAudioVolume(audioVolume + delta);
        else handleVideoVolume(videoVolume + delta);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isAudioMode,
    isVideoPlaying,
    isAudioPlaying,
    audioVolume,
    videoVolume,
    isAudioMuted,
    isVideoMuted,
  ]);

  const handleVideoMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isVideoMuted;
    // Unmuting at zero volume would stay silent — restore an audible level.
    if (!nextMuted && videoVolume === 0) setVideoVolume(0.5);
    videoRef.current.muted = nextMuted;
    setIsVideoMuted(nextMuted);
  };

  const handleVideoVolume = (volume: number) => {
    const next = Math.max(0, Math.min(1, volume));
    setVideoVolume(next);
    // Dragging the slider off zero implies "unmute".
    if (next > 0 && isVideoMuted) {
      if (videoRef.current) videoRef.current.muted = false;
      setIsVideoMuted(false);
    }
  };

  const handleVideoSeek = (ratio: number) => {
    if (!videoRef.current || !videoDuration) return;
    videoRef.current.currentTime = ratio * videoDuration;
  };

  const handleAudioMute = () => {
    if (!audioRef.current) return;
    const nextMuted = !isAudioMuted;
    if (!nextMuted && audioVolume === 0) setAudioVolume(0.5);
    audioRef.current.muted = nextMuted;
    setIsAudioMuted(nextMuted);
  };

  const handleAudioVolume = (volume: number) => {
    const next = Math.max(0, Math.min(1, volume));
    setAudioVolume(next);
    if (next > 0 && isAudioMuted) {
      if (audioRef.current) audioRef.current.muted = false;
      setIsAudioMuted(false);
    }
  };

  const handleAudioSeek = (ratio: number) => {
    if (!audioRef.current || !audioDuration) return;
    audioRef.current.currentTime = ratio * audioDuration;
  };

  const handleAudioPlaybackRate = (rate: number) => {
    setAudioPlaybackRate(rate);
    // audioRef.current.playbackRate is synced via existing useEffect
  };

  const handleFullscreen = () => {
    if (!videoWrapperRef.current) return;
    if (!document.fullscreenElement) {
      videoWrapperRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleVideoPlaybackRate = (rate: number) => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
    setVideoPlaybackRate(rate);
  };

  const handleCaptionToggle = () => {
    setIsCaptionsEnabled(!isCaptionsEnabled);
  };

  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideControlsTimerRef.current)
      clearTimeout(hideControlsTimerRef.current);
    hideControlsTimerRef.current = setTimeout(
      () => setControlsVisible(false),
      3000,
    );
  }, []);

  // Always show controls when paused; clear timer on unmount
  useEffect(() => {
    const isPlaying = isVideoPlaying || isAudioPlaying;
    if (!isPlaying) {
      setControlsVisible(true);
      if (hideControlsTimerRef.current)
        clearTimeout(hideControlsTimerRef.current);
    }
    return () => {
      if (hideControlsTimerRef.current)
        clearTimeout(hideControlsTimerRef.current);
    };
  }, [isVideoPlaying, isAudioPlaying]);

  const handleCaptionDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;
    const captionRect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - (captionRect.left + captionRect.width / 2);
    const offsetY = e.clientY - (captionRect.top + captionRect.height / 2);
    const onMouseMove = (ev: MouseEvent) => {
      const r = container.getBoundingClientRect();
      setCaptionPos({
        x: ev.clientX - r.left - offsetX,
        y: ev.clientY - r.top - offsetY,
      });
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
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

  const backArrow = (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M19 12H5M12 5l-7 7 7 7" />
    </svg>
  );

  const searchIcon = (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="text-gray-400 flex-shrink-0"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );

  const durationTags = (
    <>
      {duration != null && duration > 0 && (
        <span className="px-2 py-0.5 bg-grayTag dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] rounded-full">
          {formatDuration(duration)} {t('videoPlayer.duration.total')}
        </span>
      )}
      <span className="px-2 py-0.5 bg-grayTag dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] rounded-full">
        {currentTime > 0 ? formatDuration(currentTime) : '0:00'}{' '}
        {t('videoPlayer.duration.current')}
      </span>
    </>
  );

  return (
    <div
      className="flex-shrink-0 h-full bg-white dark:bg-darkModeTable shadow-lg flex flex-col overflow-hidden pt-2"
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

        <div className="flex-1 flex flex-row overflow-hidden gap-1.5 group">
          {/* Left video list */}
          {allDownloads &&
            allDownloads.filter((d) => !('type' in d && d.type === 'article'))
              .length > 0 && (
              <div className="h-full w-64 flex-shrink-0 overflow-y-scroll bg-white dark:bg-darkModeTable [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-transparent group-hover:[&::-webkit-scrollbar-thumb]:bg-gray-300 dark:group-hover:[&::-webkit-scrollbar-thumb]:bg-gray-600">
                {allDownloads
                  .filter((d) => !('type' in d && d.type === 'article'))
                  .map((d) => (
                    <div
                      key={d.id}
                      onClick={() =>
                        d.status !== 'fetching metadata' &&
                        onSelectDownload?.(d)
                      }
                      className={`flex flex-col gap-1 p-2 transition-colors ${
                        d.status === 'fetching metadata'
                          ? 'cursor-default'
                          : `cursor-pointer hover:bg-gray-100 dark:hover:bg-darkModeHover ${
                              d.id === activeDownloadId
                                ? 'bg-blue-50 dark:bg-darkModeTableBorder border-l-2 border-primary'
                                : ''
                            }`
                      }`}
                    >
                      {d.status === 'fetching metadata' ? (
                        <div className="flex gap-2 animate-pulse">
                          <div className="flex-shrink-0 w-20 h-14 bg-gray-200 dark:bg-gray-700 rounded" />
                          <div className="flex-1 min-w-0 flex flex-col gap-2 pt-1">
                            <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                            <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mt-1" />
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex gap-2">
                            <div className="flex-shrink-0 w-20 h-14 overflow-hidden flex items-center justify-center rounded-md">
                              {thumbnailDataUrls?.[d.id] ? (
                                <img
                                  src={thumbnailDataUrls[d.id]}
                                  alt=""
                                  className="w-full h-full object-cover rounded-md"
                                />
                              ) : (
                                <div className="w-full h-full rounded-md overflow-hidden flex items-center justify-center bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.6)_0%,transparent_40%),radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.5)_0%,transparent_45%),radial-gradient(circle_at_45%_80%,rgba(255,255,255,0.4)_0%,transparent_35%),linear-gradient(135deg,#ffa42e,#fec77d,#ffa42e,#fec170)]">
                                  <FiPlayCircle size={20} color="#F45513" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 flex items-start gap-1">
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] mb-1 font-medium line-clamp-2 dark:text-gray-200 leading-tight">
                                  {('displayName' in d && d.displayName) ||
                                    d.name}
                                </div>
                                {'channelName' in d && d.channelName && (
                                  <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                    {d.channelName}
                                  </div>
                                )}
                              </div>
                              <div className="relative flex-shrink-0 flex flex-col items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(
                                      openMenuId === d.id ? null : d.id,
                                    );
                                  }}
                                  className="p-0.5 text-gray-800 hover:text-gray-600 dark:hover:text-gray-200 rounded"
                                >
                                  <LuEllipsisVertical size={14} />
                                </button>
                                {openMenuId === d.id && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-10"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenMenuId(null);
                                      }}
                                    />
                                    <div className="absolute right-0 top-5 z-20 w-44 bg-white dark:bg-darkModeDropdown border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-1 text-[12px]">
                                      {[
                                        {
                                          icon: <LuFolderOpen size={13} />,
                                          label: t(
                                            'videoPlayer.menu.openFolder',
                                          ),
                                          action: async () => {
                                            if (!d.location) return;
                                            const fullPath = d.name
                                              ? await window.downlodrFunctions.joinDownloadPath(
                                                  d.location,
                                                  d.name,
                                                )
                                              : null;
                                            await openFolderWithFallback(
                                              d.location,
                                              fullPath,
                                            );
                                          },
                                        },
                                        {
                                          icon: <LuExternalLink size={13} />,
                                          label: t(
                                            'videoPlayer.menu.viewSource',
                                          ),
                                          action: () =>
                                            window.downlodrFunctions.openExternalLink(
                                              d.videoUrl,
                                            ),
                                        },
                                        {
                                          icon: <LuShare2 size={13} />,
                                          label: t(
                                            'videoPlayer.menu.shareVideo',
                                          ),
                                          action: () =>
                                            setShareDownloadId(d.id),
                                        },
                                        {
                                          icon: <LuCaptions size={13} />,
                                          label: t(
                                            'videoPlayer.menu.generateCaption',
                                          ),
                                          action: () =>
                                            handleGenerateCaption(d),
                                          disabled: (() => {
                                            const loc =
                                              typeof d.transcriptLocation ===
                                              'string'
                                                ? d.transcriptLocation
                                                : d.autoCaptionLocation;
                                            return (
                                              !!loc &&
                                              loc.trim() !== '' &&
                                              loc !== 'iu' &&
                                              loc !== 'fu'
                                            );
                                          })(),
                                        },
                                      ].map(
                                        ({ icon, label, action, disabled }) => (
                                          <button
                                            key={label}
                                            disabled={disabled}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (disabled) return;
                                              setOpenMenuId(null);
                                              action?.();
                                            }}
                                            className={`w-full flex items-center gap-2 px-3 py-2 text-gray-700 dark:text-gray-200 ${
                                              disabled
                                                ? 'opacity-40 cursor-not-allowed'
                                                : 'hover:bg-gray-100 dark:hover:bg-darkModeHover'
                                            }`}
                                          >
                                            {icon}
                                            {label}
                                          </button>
                                        ),
                                      )}
                                    </div>
                                  </>
                                )}
                                {'downloadStart' in d && (
                                  <button
                                    title={t('videoPlayer.downloadButtonTitle')}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPendingDownload(d as ForDownload);
                                    }}
                                    className="text-center items-center relative"
                                  >
                                    <IoMdDownload
                                      size={18}
                                      className="mt-3"
                                      style={{ color: '#FF9800' }}
                                    />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                          {d.status === 'downloading' && (
                            <div className="flex items-center gap-2 px-0.5">
                              <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#5BC083] rounded-full transition-all duration-300"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      Math.max(0, d.progress),
                                    )}%`,
                                  }}
                                />
                              </div>
                              <span className="text-[10px] text-gray-500 dark:text-gray-400 flex-shrink-0 w-7 text-right">
                                {Math.round(d.progress)}%
                              </span>
                            </div>
                          )}
                          {d.transcriptionStatus === 'transcribing' && (
                            <div className="flex items-center gap-2 px-0.5">
                              <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all duration-300"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      Math.max(0, d.transcriptionProgress ?? 0),
                                    )}%`,
                                  }}
                                />
                              </div>
                              <span className="text-[10px] text-gray-500 flex-shrink-0 w-7 text-right">
                                {Math.round(d.transcriptionProgress ?? 0)}%
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
              </div>
            )}
          {shareDownloadId &&
            allDownloads &&
            (() => {
              const d = allDownloads.find((dl) => dl.id === shareDownloadId);
              if (!d) return null;
              return (
                <ShareButton
                  videoUrl={d.videoUrl}
                  name={('displayName' in d && d.displayName) || d.name}
                  status={d.status}
                  thumbnailLocation={thumbnailDataUrls?.[d.id]}
                  format={d.ext}
                  size={d.size}
                  open={true}
                  onOpenChange={(open) => {
                    if (!open) setShareDownloadId(null);
                  }}
                />
              );
            })()}

          {/* Video player + metadata */}
          <div className="flex-1 flex flex-col overflow-hidden border-r border-l border-[#F3F3F3] dark:border-darkMode">
            {/* Header */}
            <div className="bg-FooterBg dark:bg-neutral-700 px-2 py-2 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2 mx-2">
                <span>{getExtractorIcon(extractorKey || 'youtube')}</span>
                <span className="text-black dark:text-white font-semibold text-md leading-6 truncate">
                  {extractorKey || t('videoPlayer.fallbackTitle')}
                </span>
              </div>
              <button
                onClick={onClose}
                className="text-black dark:text-white hover:text-red-500 ml-2 p-1 flex-shrink-0 cursor-pointer"
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
            <div className="flex-1 flex flex-row overflow-hidden">
              {/* Video area */}
              <div
                ref={videoWrapperRef}
                className={`m-4 flex-1 flex items-center justify-center bg-black overflow-hidden rounded-xl relative ${
                  !controlsVisible ? 'cursor-none' : ''
                }`}
                onMouseMove={resetHideTimer}
                onMouseEnter={resetHideTimer}
                onMouseLeave={() => setControlsVisible(false)}
              >
                <div
                  ref={containerRef}
                  className="relative w-full"
                  style={{ aspectRatio: '16/9' }}
                >
                  {(playerState === 'loading' ||
                    (isAudioMode && !isWaveSurferReady)) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10 gap-3">
                      <img
                        src={DownlodrLoader}
                        alt="Loading..."
                        className="w-80"
                      />
                      <div className="text-center animate-pulse">
                        <p className="text-white text-sm font-medium">
                          {isAudioMode
                            ? 'Preparing your audio'
                            : 'Preparing your video'}
                        </p>
                        <p className="text-gray-400 text-xs mt-1">
                          Tuning in. Your track is almost ready to play.
                        </p>
                      </div>
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
                        {t('videoPlayer.error.couldNotLoadStream')}
                      </p>
                      <button
                        onClick={handleRetry}
                        className="px-4 py-1.5 bg-primary text-white text-sm rounded-md hover:opacity-90"
                      >
                        {t('videoPlayer.error.retry')}
                      </button>
                    </div>
                  )}

                  {isFloating && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-10 gap-2">
                      <p className="text-white text-sm">
                        {t('videoPlayer.floating.message')}
                      </p>
                      <button
                        onClick={() => document.exitPictureInPicture()}
                        className="px-4 py-1.5 bg-primary text-white text-sm rounded-md hover:opacity-90"
                      >
                        {t('videoPlayer.floating.returnToPanel')}
                      </button>
                    </div>
                  )}

                  {directUrl && isAudioMode && (
                    <>
                      <audio
                        key={directUrl}
                        ref={audioRef}
                        src={directUrl}
                        crossOrigin="anonymous"
                        className="hidden"
                        onWaiting={() => setPlayerState('buffering')}
                        onPlaying={() => {
                          setPlayerState('ready');
                          setIsAudioPlaying(true);
                        }}
                        onCanPlay={() => setPlayerState('ready')}
                        onError={() => setPlayerState('error')}
                        onPlay={() => setIsAudioPlaying(true)}
                        onPause={() => setIsAudioPlaying(false)}
                        onDurationChange={(e) => {
                          const d = e.currentTarget.duration || 0;
                          durationRef.current = d;
                          setAudioDuration(d);
                        }}
                        onTimeUpdate={(e) => {
                          currentTimeRef.current = e.currentTarget.currentTime;
                          if (rafRef.current === null) {
                            rafRef.current = requestAnimationFrame(() => {
                              setCurrentTime(currentTimeRef.current);
                              rafRef.current = null;
                            });
                          }
                        }}
                        onEnded={handleEnded}
                      />
                      <div
                        ref={waveOuterRef}
                        className="absolute left-7 right-8 -translate-y-1/2"
                        style={{
                          height: `${WAVEFORM_HEIGHT}px`,
                          top: 'calc(50% - 26px)',
                        }}
                      >
                        <div
                          ref={waveContainerRef}
                          className="absolute inset-0"
                        />
                        <div
                          ref={hoverWsContainerRef}
                          className="absolute inset-0 pointer-events-none"
                          style={{
                            opacity: 0,
                            transition: 'opacity 0.15s ease',
                          }}
                        />
                      </div>
                      {isCaptionsEnabled &&
                        activeCueIndex >= 0 &&
                        transcriptCues[activeCueIndex] && (
                          <div
                            className="absolute z-20 cursor-grab active:cursor-grabbing w-[95%]"
                            style={
                              captionPos
                                ? {
                                    left: captionPos.x,
                                    top: captionPos.y,
                                    transform: 'translate(-50%, -50%)',
                                  }
                                : {
                                    bottom: '3rem',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                  }
                            }
                            onMouseDown={handleCaptionDragStart}
                          >
                            <span className="block w-full bg-black/70 text-[16px] leading-snug px-3 py-1 rounded text-center select-none whitespace-normal">
                              {(() => {
                                const cue = transcriptCues[activeCueIndex];
                                if (cue.words.length > 0) {
                                  return cue.words.map((word, wi) => {
                                    const nextWord = cue.words[wi + 1];
                                    const isActiveWord =
                                      word.startSeconds <= currentTime &&
                                      (!nextWord ||
                                        nextWord.startSeconds > currentTime);
                                    return (
                                      <span
                                        key={wi}
                                        className={
                                          isActiveWord
                                            ? 'text-orange-400'
                                            : 'text-white'
                                        }
                                      >
                                        {word.text}{' '}
                                      </span>
                                    );
                                  });
                                }
                                // No inline word timestamps (e.g. SRT) — approximate
                                // by distributing the cue duration evenly across words
                                const nextCue =
                                  transcriptCues[activeCueIndex + 1];
                                const cueDuration = nextCue
                                  ? nextCue.startSeconds - cue.startSeconds
                                  : 3;
                                const splitWords = cue.text
                                  .split(' ')
                                  .filter(Boolean);
                                const wordDuration =
                                  cueDuration / splitWords.length;
                                return splitWords.map((w, wi) => {
                                  const wordStart =
                                    cue.startSeconds + wi * wordDuration;
                                  const isActiveWord =
                                    currentTime >= wordStart &&
                                    currentTime < wordStart + wordDuration;
                                  return (
                                    <span
                                      key={wi}
                                      className={
                                        isActiveWord
                                          ? 'text-orange-400'
                                          : 'text-white'
                                      }
                                    >
                                      {w}{' '}
                                    </span>
                                  );
                                });
                              })()}
                            </span>
                          </div>
                        )}
                    </>
                  )}

                  {directUrl && !isAudioMode && (
                    <>
                      <video
                        ref={videoRef}
                        src={isHlsSource ? undefined : directUrl}
                        autoPlay
                        className="w-full h-full"
                        onWaiting={() => setPlayerState('buffering')}
                        onPlaying={() => {
                          setPlayerState('ready');
                          setIsVideoPlaying(true);
                        }}
                        onCanPlay={() => setPlayerState('ready')}
                        onError={(e) => {
                          const err = e.currentTarget.error;
                          console.error(
                            '[VideoPlayerPanel] <video> error:',
                            err?.code,
                            err?.message,
                            'src:',
                            directUrl,
                          );
                          // A CDN rejecting the direct URL (e.g. TikTok's
                          // TLS-fingerprinting 403) surfaces as a demux/
                          // format failure on load — DECODE or
                          // SRC_NOT_SUPPORTED. Aborts and network blips are
                          // transient; re-downloading the video can't fix
                          // those, so don't burn a full yt-dlp download on
                          // them. HLS errors are handled by hls.js's own
                          // recovery path, not this fallback.
                          const isCdnRejectionShape =
                            err?.code === MediaError.MEDIA_ERR_DECODE ||
                            err?.code ===
                              MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED;
                          const canFallback =
                            isCdnRejectionShape &&
                            !isHlsSource &&
                            !usedPreviewFallbackRef.current &&
                            status !== 'finished';
                          if (canFallback) {
                            usedPreviewFallbackRef.current = true;
                            attemptPreviewFallback(generationRef.current);
                            return;
                          }
                          setPlayerState('error');
                        }}
                        onPlay={() => setIsVideoPlaying(true)}
                        onPause={() => setIsVideoPlaying(false)}
                        onEnded={() => {
                          setIsVideoPlaying(false);
                          handleEnded();
                        }}
                        onTimeUpdate={(e) => {
                          currentTimeRef.current = e.currentTarget.currentTime;
                          if (rafRef.current === null) {
                            rafRef.current = requestAnimationFrame(() => {
                              setCurrentTime(currentTimeRef.current);
                              rafRef.current = null;
                            });
                          }
                        }}
                        onLoadedMetadata={(e) => {
                          setVideoDuration(e.currentTarget.duration || 0);
                          if (videoRef.current)
                            videoRef.current.playbackRate = videoPlaybackRate;
                        }}
                        onClick={handleVideoPlayPause}
                      >
                        {captionBlobUrl && (
                          <track
                            key={captionBlobUrl}
                            kind="subtitles"
                            src={captionBlobUrl}
                            srcLang="en"
                            label="Captions"
                          />
                        )}
                      </video>
                      {isCaptionsEnabled &&
                        activeCueIndex >= 0 &&
                        transcriptCues[activeCueIndex] && (
                          <div
                            className="absolute z-20 cursor-grab active:cursor-grabbing w-[95%]"
                            style={
                              captionPos
                                ? {
                                    left: captionPos.x,
                                    top: captionPos.y,
                                    transform: 'translate(-50%, -50%)',
                                  }
                                : {
                                    bottom: '4rem',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                  }
                            }
                            onMouseDown={handleCaptionDragStart}
                          >
                            <span className="block w-full bg-black/70 text-[16px] leading-snug px-3 py-1 rounded text-center select-none whitespace-normal">
                              {(() => {
                                const cue = transcriptCues[activeCueIndex];
                                if (cue.words.length > 0) {
                                  return cue.words.map((word, wi) => {
                                    const nextWord = cue.words[wi + 1];
                                    const isActiveWord =
                                      word.startSeconds <= currentTime &&
                                      (!nextWord ||
                                        nextWord.startSeconds > currentTime);
                                    return (
                                      <span
                                        key={wi}
                                        className={
                                          isActiveWord
                                            ? 'text-orange-400'
                                            : 'text-white'
                                        }
                                      >
                                        {word.text}{' '}
                                      </span>
                                    );
                                  });
                                }
                                // No inline word timestamps (e.g. SRT) — approximate
                                // by distributing the cue duration evenly across words
                                const nextCue =
                                  transcriptCues[activeCueIndex + 1];
                                const cueDuration = nextCue
                                  ? nextCue.startSeconds - cue.startSeconds
                                  : 3;
                                const splitWords = cue.text
                                  .split(' ')
                                  .filter(Boolean);
                                const wordDuration =
                                  cueDuration / splitWords.length;
                                return splitWords.map((w, wi) => {
                                  const wordStart =
                                    cue.startSeconds + wi * wordDuration;
                                  const isActiveWord =
                                    currentTime >= wordStart &&
                                    currentTime < wordStart + wordDuration;
                                  return (
                                    <span
                                      key={wi}
                                      className={
                                        isActiveWord
                                          ? 'text-orange-400'
                                          : 'text-white'
                                      }
                                    >
                                      {w}{' '}
                                    </span>
                                  );
                                });
                              })()}
                            </span>
                          </div>
                        )}
                    </>
                  )}
                </div>

                {/* Audio controls bar */}
                {directUrl && isAudioMode && (
                  <PlayerControlsBar
                    isAudioMode={true}
                    isPlaying={isAudioPlaying}
                    isMuted={isAudioMuted}
                    volume={audioVolume}
                    currentTime={currentTime}
                    duration={audioDuration}
                    playbackRate={audioPlaybackRate}
                    captionBlobUrl={captionBlobUrl}
                    isCaptionsEnabled={isCaptionsEnabled}
                    controlsVisible={controlsVisible}
                    onPlayPause={handleAudioPlayPause}
                    onMute={handleAudioMute}
                    onVolumeChange={handleAudioVolume}
                    onSeek={handleAudioSeek}
                    onCaptionToggle={handleCaptionToggle}
                    onPlaybackRate={handleAudioPlaybackRate}
                  />
                )}
                {/* Video controls bar */}
                {directUrl && !isAudioMode && (
                  <PlayerControlsBar
                    isAudioMode={false}
                    isPlaying={isVideoPlaying}
                    isMuted={isVideoMuted}
                    volume={videoVolume}
                    currentTime={currentTime}
                    duration={videoDuration}
                    playbackRate={videoPlaybackRate}
                    captionBlobUrl={captionBlobUrl}
                    isCaptionsEnabled={isCaptionsEnabled}
                    isFullscreen={isFullscreen}
                    showPiP={document.pictureInPictureEnabled}
                    controlsVisible={controlsVisible}
                    onPlayPause={handleVideoPlayPause}
                    onMute={handleVideoMute}
                    onVolumeChange={handleVideoVolume}
                    onSeek={handleVideoSeek}
                    onCaptionToggle={handleCaptionToggle}
                    onPlaybackRate={handleVideoPlaybackRate}
                    onFullscreen={handleFullscreen}
                    onPiP={handleFloat}
                  />
                )}
              </div>

              {/* Metadata sidebar — single wrapper, contents swap by activeTab */}
              <div className="flex self-stretch w-96 flex-shrink-0 overflow-hidden bg-white dark:bg-darkModeTable flex-col">
                {/* === TRANSCRIPT === */}
                {activeTab === 'transcript' && (
                  <>
                    <div className="flex items-center justify-between px-3 py-2.5 pb-4 flex-shrink-0">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setActiveTab('description')}
                          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white p-0.5"
                          title={t('videoPlayer.backTitle')}
                        >
                          {backArrow}
                        </button>
                        <span className="font-semibold text-[13px] dark:text-white">
                          {t('videoPlayer.transcript.title')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                        <button
                          title={
                            showTimestamps
                              ? t('videoPlayer.transcript.hideTimestampsTitle')
                              : t('videoPlayer.transcript.showTimestampsTitle')
                          }
                          onClick={() =>
                            setShowTimestamps((prev) => {
                              const next = !prev;
                              toast({
                                description: next
                                  ? t('videoPlayer.transcript.timestampsShown')
                                  : t(
                                      'videoPlayer.transcript.timestampsHidden',
                                    ),
                                duration: 5000,
                              });
                              return next;
                            })
                          }
                          className="hover:text-gray-700 dark:hover:text-gray-200"
                        >
                          {showTimestamps ? (
                            <TbClockCheck size={15} />
                          ) : (
                            <TbClockCancel size={15} />
                          )}
                        </button>
                        <button
                          title={t('videoPlayer.transcript.copyTitle')}
                          onClick={() => {
                            const text = transcriptCues
                              .map((c) =>
                                showTimestamps
                                  ? `${c.time}  ${c.text}`
                                  : c.text,
                              )
                              .join('\n');
                            navigator.clipboard.writeText(text).then(() => {
                              setTranscriptCopied(true);
                              setTimeout(
                                () => setTranscriptCopied(false),
                                2000,
                              );
                            });
                          }}
                          className="hover:text-gray-700 dark:hover:text-gray-200"
                        >
                          <span className="relative flex items-center justify-center w-[15px] h-[15px]">
                            <Copy
                              size={15}
                              className={`absolute transition-all duration-200 ${
                                transcriptCopied
                                  ? 'opacity-0 scale-50'
                                  : 'opacity-100 scale-100'
                              }`}
                            />
                            <Check
                              size={15}
                              className={`absolute transition-all duration-200 ${
                                transcriptCopied
                                  ? 'opacity-100 scale-100'
                                  : 'opacity-0 scale-50'
                              }`}
                            />
                          </span>
                        </button>
                        <button
                          title={t('videoPlayer.transcript.downloadTitle')}
                          onClick={() => {
                            const text = transcriptCues
                              .map((c) =>
                                showTimestamps
                                  ? `${c.time}  ${c.text}`
                                  : c.text,
                              )
                              .join('\n');
                            const blob = new Blob([text], {
                              type: 'text/plain',
                            });
                            const a = document.createElement('a');
                            a.href = URL.createObjectURL(blob);
                            a.download = `${title || 'transcript'}.txt`;
                            a.click();
                            URL.revokeObjectURL(a.href);
                          }}
                          className="hover:text-gray-700 dark:hover:text-gray-200"
                        >
                          <svg
                            width="15"
                            height="15"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-1.5 px-3 pb-2 flex-wrap flex-shrink-0">
                      <span className="px-2 py-0.5 bg-gray-900 dark:bg-gray-700 text-white text-[10px] rounded-full">
                        {autoCaptionLocation
                          ? t('videoPlayer.transcript.auto')
                          : t('videoPlayer.transcript.manual')}{' '}
                        {'·'}{' '}
                        {extractorKey ||
                          t('videoPlayer.transcript.platformFallback')}{' '}
                        {'·'} en
                      </span>
                      {transcriptCues.length > 0 && (
                        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] rounded-full">
                          {transcriptCues.length} lines
                        </span>
                      )}
                      {durationTags}
                    </div>
                    <div className="px-3 pb-2 flex-shrink-0">
                      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-gray-300 dark:bg-gray-700">
                        {searchIcon}
                        <input
                          type="text"
                          placeholder={t(
                            'videoPlayer.transcript.searchPlaceholder',
                          )}
                          value={transcriptSearch}
                          onChange={(e) => setTranscriptSearch(e.target.value)}
                          className="flex-1 bg-transparent text-[11px] text-gray-700 dark:text-gray-200 placeholder-gray-400 outline-none"
                        />
                      </div>
                    </div>
                    <div
                      className="flex-1 min-h-0 overflow-y-auto px-3 [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600"
                      onScroll={() => {
                        userScrolledRef.current = true;
                        if (scrollInactivityTimer.current)
                          clearTimeout(scrollInactivityTimer.current);
                        scrollInactivityTimer.current = setTimeout(() => {
                          userScrolledRef.current = false;
                        }, 2000);
                      }}
                    >
                      {transcriptCues.length > 0 ? (
                        <ul
                          ref={transcriptListRef}
                          className="flex flex-col gap-0.5 pb-4"
                        >
                          {transcriptCues
                            .filter((cue) =>
                              transcriptSearch
                                ? cue.text
                                    .toLowerCase()
                                    .includes(transcriptSearch.toLowerCase())
                                : true,
                            )
                            .map((cue, i) => {
                              const originalIndex = transcriptCues.indexOf(cue);
                              const isActive = originalIndex === activeCueIndex;
                              return (
                                <li
                                  key={i}
                                  data-active={isActive ? 'true' : undefined}
                                  className={`flex gap-3 items-center rounded-md px-2 py-1.5 transition-colors cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                                    isActive
                                      ? 'bg-lightOrangeTag dark:bg-orange-900/40'
                                      : ''
                                  }`}
                                  onClick={() => {
                                    if (!isAudioMode && videoRef.current)
                                      videoRef.current.currentTime =
                                        cue.startSeconds;
                                    if (isAudioMode && audioRef.current)
                                      audioRef.current.currentTime =
                                        cue.startSeconds;
                                  }}
                                >
                                  <TriangleArrow
                                    className={
                                      isActive
                                        ? 'text-black dark:text-gray-300'
                                        : 'text-black/60 dark:text-gray-300/60'
                                    }
                                  />
                                  <span
                                    className={`text-[10px] text-black flex-shrink-0 w-9 pt-0.5 tabular-nums ${
                                      isActive
                                        ? 'text-black dark:text-gray-300 font-semibold'
                                        : 'text-gray-500'
                                    }`}
                                  >
                                    {cue.time}
                                  </span>
                                  <span
                                    className={`text-[11px] leading-relaxed ${
                                      isActive
                                        ? 'font-semibold'
                                        : 'text-gray-500 dark:text-gray-300'
                                    }`}
                                  >
                                    {isActive && cue.words.length > 0
                                      ? cue.words.map((word, wi) => {
                                          const nextWord = cue.words[wi + 1];
                                          const isActiveWord =
                                            word.startSeconds <= currentTime &&
                                            (!nextWord ||
                                              nextWord.startSeconds >
                                                currentTime);
                                          return (
                                            <span
                                              key={wi}
                                              className={
                                                isActiveWord
                                                  ? 'text-orange-500'
                                                  : 'text-gray-500 dark:text-gray-300'
                                              }
                                            >
                                              {word.text}{' '}
                                            </span>
                                          );
                                        })
                                      : highlightMatch(
                                          cue.text,
                                          transcriptSearch,
                                        )}
                                  </span>
                                </li>
                              );
                            })}
                        </ul>
                      ) : transcriptText ? (
                        <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed pt-2">
                          {transcriptText}
                        </p>
                      ) : transcriptError ? (
                        <div className="flex items-center justify-center py-6">
                          <span className="text-xs text-gray-500 dark:text-gray-400 text-center">
                            {transcriptError}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center py-6">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {t('videoPlayer.transcript.noTranscript')}
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* === CHAPTERS === */}
                {activeTab === 'chapters' && (
                  <>
                    <div className="flex items-center justify-between px-3 py-2.5 flex-shrink-0">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setActiveTab('description')}
                          className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white p-0.5"
                          title={t('videoPlayer.backTitle')}
                        >
                          {backArrow}
                        </button>
                        <span className="font-semibold text-[13px] dark:text-white">
                          {t('videoPlayer.chapters.title')}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1.5 px-3 pb-3 flex-wrap flex-shrink-0">
                      {chapters && chapters.length > 0 && (
                        <span className="px-2 py-0.5 bg-grayTag dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] rounded-full">
                          {t('videoPlayer.chapters.count', {
                            count: chapters.length,
                          })}
                        </span>
                      )}
                      {durationTags}
                    </div>
                    <div className="px-3 pb-4 flex-shrink-0">
                      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-gray-300 dark:bg-gray-700">
                        {searchIcon}
                        <input
                          type="text"
                          placeholder={t(
                            'videoPlayer.chapters.searchPlaceholder',
                          )}
                          value={chapterSearch}
                          onChange={(e) => setChapterSearch(e.target.value)}
                          className="flex-1 bg-transparent text-[11px] text-gray-700 dark:text-gray-200 placeholder-gray-400 outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto px-3 [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600">
                      {chapters && chapters.length > 0 ? (
                        <ul className="flex flex-col gap-0.5 pb-4">
                          {chapters
                            .filter((ch) =>
                              chapterSearch
                                ? ch.title
                                    .toLowerCase()
                                    .includes(chapterSearch.toLowerCase())
                                : true,
                            )
                            .map((ch, i) => {
                              const originalIndex = chapters.indexOf(ch);
                              const isActive =
                                originalIndex === activeChapterIndex;
                              return (
                                <li
                                  key={i}
                                  className={`flex gap-3 items-center rounded-md px-2 py-2 transition-colors cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                                    isActive ? 'bg-lightOrangeTag' : ''
                                  }`}
                                  onClick={() => {
                                    if (!isAudioMode && videoRef.current)
                                      videoRef.current.currentTime =
                                        ch.start_time;
                                    if (isAudioMode && audioRef.current)
                                      audioRef.current.currentTime =
                                        ch.start_time;
                                  }}
                                >
                                  <span
                                    className={`text-[10px] w-4 rounded-sm flex-shrink-0 tabular-nums text-center ${
                                      isActive
                                        ? 'text-black font-medium bg-white'
                                        : 'text-gray-500 bg-[#F3F3F3]'
                                    }`}
                                  >
                                    {originalIndex + 1}
                                  </span>
                                  <TriangleArrow
                                    className={
                                      isActive
                                        ? 'text-black dark:text-gray-300'
                                        : 'text-black/60 dark:text-gray-300/60'
                                    }
                                  />
                                  <span
                                    className={`text-[10px] flex-shrink-0 tabular-nums ${
                                      isActive
                                        ? 'text-black font-semibold'
                                        : 'text-gray-500'
                                    }`}
                                  >
                                    {formatDuration(ch.start_time)}
                                  </span>
                                  <span
                                    className={`text-[11px] leading-relaxed truncate ${
                                      isActive
                                        ? 'text-black dark:text-white font-semibold'
                                        : 'text-gray-500 dark:text-gray-300'
                                    }`}
                                  >
                                    {highlightMatch(ch.title, chapterSearch)}
                                  </span>
                                </li>
                              );
                            })}
                        </ul>
                      ) : (
                        <div className="flex items-center justify-center py-6">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {t('videoPlayer.chapters.noChapters')}
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* === DESCRIPTION (normal metadata view) === */}
                {activeTab === 'description' && (
                  <div className="flex flex-col gap-2 p-4 h-full overflow-hidden">
                    {dateAdded && (
                      <div className="flex gap-2 items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-1">
                          <span className="font-bold text-[13px]">
                            {title || t('videoPlayer.fallbackVideoPreview')}
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
                              isFavorited
                                ? t('videoPlayer.favorites.remove')
                                : t('videoPlayer.favorites.add')
                            }
                          >
                            {isFavorited ? (
                              <FaHeart className="text-red-400" />
                            ) : (
                              <FaRegHeart />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="flex-shrink-0">
                      <div className="flex flex-row gap-1 min-w-0 items-center">
                        {thumbnail && thumbnail !== '—' && (
                          <img
                            src={thumbnail}
                            alt="thumbnail"
                            className="w-6 h-6 object-cover rounded-full flex-shrink-0"
                          />
                        )}
                        {channelName && (
                          <span className="text-[12px] font-medium truncate text-gray-500 dark:text-gray-200">
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
                      <div className="flex gap-2 text-[11px] text-gray-500 dark:text-gray-400 flex-wrap mt-1">
                        {ext && (
                          <span className="text-xxs bg-[#000000] text-white dark:bg-gray-700 px-2 py-0.5 rounded-lg dark:text-gray-300">
                            {ext.toUpperCase()}
                          </span>
                        )}
                        {duration != null && duration > 0 && (
                          <span className="text-xxs bg-[#E6E6E6] dark:bg-gray-700 px-2 py-0.5 rounded-lg text-gray-600 dark:text-gray-300">
                            {formatDuration(duration)}
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
                        {(() => {
                          const isFileLocation =
                            !!location &&
                            !location.endsWith('\\') &&
                            !location.endsWith('/');
                          return (
                            <span
                              className={`text-xxs bg-[#E6E6E6] dark:bg-gray-700 px-2 py-0.5 rounded-lg flex items-center gap-0.5 ${
                                isFileLocation
                                  ? 'text-gray-600 dark:text-gray-300 cursor-pointer hover:bg-gray-300 dark:hover:bg-gray-600'
                                  : 'text-gray-400 dark:text-gray-500 opacity-50 cursor-not-allowed'
                              }`}
                              onClick={
                                isFileLocation ? handleOpenWith : undefined
                              }
                            >
                              <ExternalLink className="flex-shrink-0 w-3 h-3" />
                              {t('videoPlayer.description.openWith')}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    {location && (
                      <>
                        <Separator className="flex-shrink-0" />
                        <div className="text-xs text-primary dark:text-gray-500 truncate flex items-center gap-1 flex-shrink-0">
                          <FcFolder className="flex-shrink-0" />
                          <span title={location}>{location}</span>
                        </div>
                      </>
                    )}
                    <Separator className="flex-shrink-0" />
                    <div className="flex-shrink-0">
                      <div className="flex flex-wrap gap-1">
                        <span className="text-[12px]">
                          {t('videoPlayer.description.categories')}
                        </span>
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
                        <span className="text-[12px]">
                          {t('videoPlayer.description.tags')}
                        </span>
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
                    <div className="flex border-b border-gray-200 dark:border-gray-700 flex-shrink-0 -mx-3">
                      {(['description', 'transcript', 'chapters'] as const).map(
                        (tab) => (
                          <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`mx-3 py-1.5 text-[11px] border-b-2 transition-colors capitalize ${
                              activeTab === tab
                                ? 'border-primary text-primary font-medium'
                                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                            }`}
                          >
                            {t(`videoPlayer.tabs.${tab}`)}
                          </button>
                        ),
                      )}
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600">
                      {activeTab === 'description' &&
                        (description ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap leading-relaxed pt-2">
                            {description}
                          </p>
                        ) : (
                          <div className="flex items-center justify-center py-6">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {t('videoPlayer.description.noDescription')}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <FormatSelectorModal
        download={pendingDownload}
        onClose={() => setPendingDownload(null)}
      />
    </div>
  );
};

export default VideoPlayerPanel;
