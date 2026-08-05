import { IoMdDownload } from 'react-icons/io';
import { AnimatedLinearProgressBar } from '@/downlodr/components/download/LinearProgress';
import React, { useEffect, useRef, useState } from 'react';
import DemoAddedSubscriptionModal from './DemoAddedSubscriptionModal';
import DemoAfdaSubscribeModal from './DemoAfdaSubscribeModal';
import DemoSubscribeModal from './DemoSubscribeModal';
import DemoYtChannelTable from './DemoYtChannelTable';
import { AiOutlineFileWord } from 'react-icons/ai';
import { BiLayer } from 'react-icons/bi';
import { BsHourglassSplit } from 'react-icons/bs';
import { FaRegHeart, FaRegTimesCircle, FaYoutube } from 'react-icons/fa';
import {
  FiCalendar,
  FiChevronDown,
  FiChevronRight,
  FiClock,
  FiDownload,
  FiFolder,
  FiList,
  FiPlayCircle,
  FiSearch,
} from 'react-icons/fi';
import { HiChevronUpDown, HiOutlineFolderOpen } from 'react-icons/hi2';
import { LuHardDrive, LuHistory, LuNewspaper } from 'react-icons/lu';
import { MdPlayArrow, MdSubscriptions } from 'react-icons/md';
import { PiPauseBold } from 'react-icons/pi';
import { VscPlayCircle } from 'react-icons/vsc';
import { DemoStatus, useDemoSimulator } from '../../hooks/useDemoSimulator';
import {
  DUMMY_ARTICLES,
  DUMMY_CHANNEL,
  DUMMY_PLAYLIST,
  DUMMY_SINGLE_VIDEO,
  DUMMY_SUBSCRIPTION_URL,
  DUMMY_VIDEOS,
  SO_CATEGORIES,
  DummyArticle,
  DummyVideo,
  OnboardingFeature,
} from '../../types/onboardingTypes';

const FEATURE_IDLE_HINTS: Record<OnboardingFeature, string> = {
  [OnboardingFeature.VideoDownload]:
    'Click the download icon in the toolbar above to see it in action',
  [OnboardingFeature.Playlist]:
    'Click the download icon in the toolbar above to select and queue videos',
  [OnboardingFeature.AfdaSingle]:
    'Click the download icon in the toolbar above to download this article',
  [OnboardingFeature.AfdaSubscription]:
    'Click the download icon in the toolbar above to scan a site',
  [OnboardingFeature.YtChannel]:
    'Click the download icon in the toolbar above to resolve a channel',
  [OnboardingFeature.VideoPlayer]: '',
  [OnboardingFeature.SmartOrganize]: '',
};

// Matches the real THUMB_PLACEHOLDER_CLASS from StatusPageTableRow
const THUMB_CLASS =
  'h-9 w-16 rounded cursor-pointer overflow-hidden flex justify-center items-center bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.6)_0%,transparent_40%),radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.5)_0%,transparent_45%),radial-gradient(circle_at_45%_80%,rgba(255,255,255,0.4)_0%,transparent_35%),linear-gradient(135deg,#ffa42e,#fec77d,#ffa42e,#fec170)] flex-shrink-0';

// --- VideoRow ---

interface VideoRowProps {
  video: DummyVideo;
  status: DemoStatus;
  progress: number;
  onStartDownload?: () => void;
  onPlay?: () => void;
  rowId?: string;
  playBtnId?: string;
}

const VideoRow: React.FC<VideoRowProps> = ({
  video,
  status,
  progress,
  onStartDownload,
  onPlay,
  rowId,
  playBtnId,
}) => {
  const isIdle = status === 'idle';
  const isRunning = status === 'running';
  const isDone = status === 'complete';

  return (
    <tr
      id={rowId}
      className="border-b hover:bg-gray-50 dark:border-darkModeTableBorder dark:hover:bg-darkModeHover cursor-pointer bg-white dark:bg-darkModeTable"
    >
      {/* Checkbox */}
      <td className="w-8 p-2">
        <input
          type="checkbox"
          disabled
          className="ml-2 mt-1 rounded border-gray-300 dark:border-gray-600 dark:bg-gray-700 opacity-40"
        />
      </td>

      {/* Name */}
      <td className="p-2 dark:text-gray-200 flex justify-start items-center">
        <div className="flex items-start gap-3 w-full">
          <div className={THUMB_CLASS}>
            <FiPlayCircle size={20} color="#F45513" />
          </div>
          <div className="line-clamp-2 break-words flex justify-start items-start min-w-0 flex-1">
            <div className="w-full">
              <span className="line-clamp-1 break-words break-all font-semibold">
                {video.title}
              </span>
              <div>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {video.channel}
                </span>
              </div>
            </div>
          </div>
        </div>
      </td>

      {/* Size */}
      <td
        className="px-2 py-2 dark:text-gray-200 text-left"
        style={{ width: 50 }}
      >
        <span className="whitespace-nowrap overflow-hidden text-sm">
          {isIdle ? '0 MB' : video.size}
        </span>
      </td>

      {/* Format */}
      <td
        id="demo-format-cell"
        className="p-2 text-center align-middle"
        style={{ width: 90 }}
      >
        {isDone ? (
          <div className="font-medium text-sm text-gray-600 dark:text-gray-300 text-center">
            mp4
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1 px-2 py-0.5 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-500 dark:text-gray-400 cursor-default w-fit mx-auto">
            Best
            <HiChevronUpDown size={10} className="text-gray-400" />
          </div>
        )}
      </td>

      {/* Status */}
      <td className="p-1 ml-1" style={{ width: 90 }}>
        {isIdle && (
          <div className="ml-1 flex items-center space-x-2 justify-center">
            <div className="flex items-center text-sm">
              <VscPlayCircle
                size={20}
                className="text-green-600 hover:text-green-400 transition-colors duration-200 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onPlay?.();
                }}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStartDownload?.();
                }}
                className="ml-1 text-center items-center relative"
                style={{ color: '#FF9800' }}
                title="Start download"
              >
                <IoMdDownload size={22} />
              </button>
            </div>
          </div>
        )}
        {isRunning && (
          <button
            onClick={(e) => e.stopPropagation()}
            className="ml-2 hover:bg-gray-100 dark:hover:bg-darkModeHover w-full flex items-center justify-center"
          >
            <AnimatedLinearProgressBar
              status="downloading"
              max={100}
              min={0}
              value={progress}
              gaugePrimaryColor="#4CAF50"
              gaugeSecondaryColor="#EEEEEE"
              width={80}
            />
          </button>
        )}
        {isDone && (
          <div className="ml-3 flex items-center space-x-2 justify-center">
            <VscPlayCircle
              id={playBtnId}
              size={20}
              className="text-green-600 hover:text-green-400 transition-colors duration-200 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onPlay?.();
              }}
            />
            <HiOutlineFolderOpen
              size={20}
              className="mr-3 text-green-600 hover:text-green-400 transition-colors duration-200"
            />
          </div>
        )}
      </td>

      {/* Speed */}
      <td
        className="pl-2 py-2 dark:text-gray-200 flex justify-center items-center"
        style={{ width: 60 }}
      >
        {isRunning ? (
          <span className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
            2.4 MB/s
          </span>
        ) : (
          <div className="flex justify-center w-full">
            <span>—</span>
          </div>
        )}
      </td>

      {/* Date Added */}
      <td
        className="p-2 dark:text-gray-200 ml-2 justify-center text-center"
        style={{ width: 70 }}
      >
        <div className="text-xs">just now</div>
      </td>

      {/* Transcript */}
      <td className="p-2 dark:text-gray-200 text-center" style={{ width: 60 }}>
        <span className="text-gray-400 dark:text-gray-500">—</span>
      </td>

      {/* Source */}
      <td className="p-2 dark:text-gray-200 text-center" style={{ width: 55 }}>
        <div className="line-clamp-2 break-words flex justify-center items-center text-lg">
          <FaYoutube className="text-red-500 opacity-70" size={18} />
        </div>
      </td>

      {/* Action */}
      <td className="p-2 dark:text-gray-200 text-center" style={{ width: 55 }}>
        <div className="flex items-center justify-center gap-1">
          <button className="p-1 opacity-40 cursor-not-allowed">
            <FaRegHeart
              size={14}
              className="text-gray-400 dark:text-gray-500"
            />
          </button>
        </div>
      </td>
    </tr>
  );
};

// --- ArticleRow ---

interface ArticleRowProps {
  article: DummyArticle;
  state: 'idle' | 'analyzing' | 'done';
  indent?: boolean;
  onStartDownload?: () => void;
}

const ArticleRow: React.FC<ArticleRowProps> = ({
  article,
  state,
  indent = false,
  onStartDownload,
}) => (
  <tr className="border-b hover:bg-gray-50 dark:border-darkModeTableBorder dark:hover:bg-darkModeHover cursor-pointer bg-white dark:bg-darkModeTable">
    <td className="w-8 p-2">
      <input
        type="checkbox"
        disabled
        className="ml-2 mt-1 rounded border-gray-300 dark:border-gray-600 opacity-40"
      />
    </td>
    <td
      className={`p-2 dark:text-gray-200 flex justify-start items-center ${
        indent ? 'pl-10' : ''
      }`}
    >
      <div className="flex items-start gap-3 w-full">
        {state === 'analyzing' ? (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="animate-spin text-primary">⟳</span>
            Analyzing…
          </div>
        ) : (
          <>
            <div className="h-9 w-16 rounded bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
              <AiOutlineFileWord
                size={18}
                className="text-blue-600 dark:text-blue-400"
              />
            </div>
            <div className="min-w-0 flex-1">
              <span className="line-clamp-1 font-semibold text-sm dark:text-gray-200">
                {article.title}
              </span>
              <div className="text-xs text-blue-600 dark:text-blue-400">
                {article.site}
              </div>
            </div>
          </>
        )}
      </div>
    </td>
    {/* Size */}
    <td className="px-2 py-2 dark:text-gray-200 text-sm" style={{ width: 50 }}>
      —
    </td>
    {/* Format */}
    <td className="p-2 text-center align-middle" style={{ width: 90 }}>
      {state === 'done' ? (
        <div className="font-medium text-sm text-gray-600 dark:text-gray-300">
          DOCX
        </div>
      ) : null}
    </td>
    {/* Status */}
    <td className="p-1 ml-1" style={{ width: 90 }}>
      {state === 'idle' && (
        <div className="ml-1 flex items-center space-x-2 justify-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStartDownload?.();
            }}
            className="text-center items-center relative"
            style={{ color: '#FF9800' }}
            title="Start download"
          >
            <IoMdDownload size={22} />
          </button>
        </div>
      )}
      {state === 'analyzing' && (
        <div className="ml-3 flex items-center space-x-2 justify-center">
          <span className="animate-spin text-primary text-base">⟳</span>
        </div>
      )}
      {state === 'done' && (
        <div className="ml-3 flex items-center space-x-2 justify-center">
          <VscPlayCircle size={20} className="text-green-600" />
          <span className="text-xs text-green-600 mr-3">Ready</span>
        </div>
      )}
    </td>
    {/* Speed */}
    <td
      className="pl-2 py-2 dark:text-gray-200 flex justify-center items-center"
      style={{ width: 60 }}
    >
      <span>—</span>
    </td>
    {/* Date Added */}
    <td className="p-2 text-center" style={{ width: 70 }}>
      <div className="text-xs dark:text-gray-200">just now</div>
    </td>
    {/* Transcript */}
    <td className="p-2 text-center" style={{ width: 60 }}>
      <span className="text-gray-400 dark:text-gray-500">—</span>
    </td>
    {/* Source */}
    <td className="p-2 text-center" style={{ width: 55 }}>
      —
    </td>
    {/* Action */}
    <td className="p-2 text-center" style={{ width: 55 }}>
      <div className="flex items-center justify-center">
        <button className="p-1 opacity-40 cursor-not-allowed">
          <FaRegHeart size={14} className="text-gray-400" />
        </button>
      </div>
    </td>
  </tr>
);

// --- Subscription group header row ---

const SubGroupRow: React.FC<{ url: string; count: number }> = ({
  url,
  count,
}) => (
  <tr className="border-b dark:border-darkModeTableBorder bg-white dark:bg-darkModeTable">
    <td className="w-8 p-2">
      <input
        type="checkbox"
        disabled
        className="ml-2 mt-1 rounded opacity-40"
      />
    </td>
    <td colSpan={8} className="px-3 py-2">
      <div className="flex items-center gap-2">
        <FiChevronRight size={14} className="text-gray-400" />
        <LuNewspaper size={14} className="text-blue-500" />
        <span className="text-xs font-bold dark:text-darkModeLight line-clamp-1">
          {url}
        </span>
        <span className="bg-primary rounded-xl px-2 py-0.5 text-white text-[10px] font-medium">
          SUB
        </span>
        <span className="text-[11px] text-gray-400">{count} articles</span>
      </div>
    </td>
  </tr>
);

// --- Table header (matches real StatusPage column order) ---

const TABLE_COLS = [
  { label: 'Name' },
  { label: 'Size', width: 50 },
  { label: 'Format', width: 90 },
  { label: 'Status', width: 90 },
  { label: 'Speed', width: 60 },
  { label: 'Date Added', width: 70 },
  { label: 'Transcript', width: 60 },
  { label: 'Source', width: 55 },
  { label: 'Action', width: 55 },
];

const TableHead: React.FC = () => (
  <thead className="sticky top-0 z-20 bg-white dark:bg-darkModeTable border-b dark:border-darkModeTableBorder">
    <tr className="text-left">
      <th className="w-8 px-2 py-1">
        <input
          type="checkbox"
          disabled
          className="ml-2 mt-2 rounded border-gray-300 dark:border-gray-600 opacity-40"
        />
      </th>
      {TABLE_COLS.map((col) => (
        <th
          key={col.label}
          style={col.width ? { width: col.width } : undefined}
          className="px-2 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap"
        >
          <div className="flex items-center gap-1">
            {col.label}
            <HiChevronUpDown size={11} className="text-gray-400" />
          </div>
        </th>
      ))}
    </tr>
    <tr className="pointer-events-none">
      <th
        colSpan={999}
        className="p-0 h-[1px] bg-gray-200 dark:bg-darkModeCompliment"
      />
    </tr>
  </thead>
);

// --- Main component ---

interface DemoStatusTableProps {
  active: OnboardingFeature;
  started: boolean;
  onReset: () => void;
  onPlay?: (video: DummyVideo) => void;
  playerOpen?: boolean;
  activeVideoId?: string;
  onInteraction?: () => void;
  onAnalyzed?: () => void;
  onCompleted?: () => void;
}

const DemoStatusTable: React.FC<DemoStatusTableProps> = ({
  active,
  started,
  onReset,
  onPlay,
  playerOpen = false,
  activeVideoId,
  onInteraction,
  onAnalyzed,
  onCompleted,
}) => {
  const videoSim = useDemoSimulator(3000);
  const pSim0 = useDemoSimulator(3000);
  const pSim1 = useDemoSimulator(3600);
  const pSim2 = useDemoSimulator(2800);
  const pSim3 = useDemoSimulator(4200);
  const pSim4 = useDemoSimulator(3300);
  const playlistSims = [pSim0, pSim1, pSim2, pSim3, pSim4];

  const [afdaState, setAfdaState] = useState<'idle' | 'analyzing' | 'done'>(
    'idle',
  );
  const [subState, setSubState] = useState<'idle' | 'done'>('idle');
  const [channelState, setChannelState] = useState<
    'idle' | 'resolving' | 'done'
  >('idle');
  const [subscribeModalOpen, setSubscribeModalOpen] = useState(false);
  const [afdaModal, setAfdaModal] = useState<null | 'subscribe-flow' | 'added'>(
    null,
  );
  const [soState, setSoState] = useState<'idle' | 'running' | 'done'>('idle');

  const resetAll = () => {
    videoSim.reset();
    playlistSims.forEach((s) => s.reset());
    setAfdaState('idle');
    setSubState('idle');
    setChannelState('idle');
    setSubscribeModalOpen(false);
    setAfdaModal(null);
    setSoState('idle');
  };

  // Reset everything when feature switches
  useEffect(() => {
    resetAll();
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  // When started changes: video/playlist rows appear as "to download" (sims stay idle).
  // AFDA/channel features auto-trigger their own state machines.
  useEffect(() => {
    if (!started) {
      resetAll();
      return;
    }
    switch (active) {
      case OnboardingFeature.AfdaSingle:
        setAfdaState('analyzing');
        setTimeout(() => {
          setAfdaState('done');
          onAnalyzed?.();
        }, 1500);
        break;
      case OnboardingFeature.AfdaSubscription:
        // Flow is driven by DemoAfdaSubscribeModal → DemoAddedSubscriptionModal
        break;
      case OnboardingFeature.YtChannel:
        // Channel subscription is driven by the subscribe modal flow, not by demoStarted
        break;
      case OnboardingFeature.SmartOrganize:
        break;
      // VideoDownload and Playlist: sims remain idle until user clicks row
    }
  }, [started]); // eslint-disable-line react-hooks/exhaustive-deps

  // Signal onCompleted when AfdaSubscription section picker opens (auto-advances tour past Subscribe button)
  const afdaSubDoneCalledRef = useRef(false);
  useEffect(() => {
    if (
      active === OnboardingFeature.AfdaSubscription &&
      afdaModal === 'subscribe-flow' &&
      !afdaSubDoneCalledRef.current
    ) {
      afdaSubDoneCalledRef.current = true;
      onCompleted?.();
    }
    if (afdaModal !== 'subscribe-flow') afdaSubDoneCalledRef.current = false;
  }, [afdaModal, active]); // eslint-disable-line react-hooks/exhaustive-deps

  // Signal onCompleted when YtChannel subscription finishes (after DOM updates)
  const channelDoneCalledRef = useRef(false);
  useEffect(() => {
    if (
      active === OnboardingFeature.YtChannel &&
      channelState === 'done' &&
      !channelDoneCalledRef.current
    ) {
      channelDoneCalledRef.current = true;
      onCompleted?.();
    }
    if (channelState !== 'done') channelDoneCalledRef.current = false;
  }, [channelState, active]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReset = () => {
    resetAll();
    onReset();
  };

  const handleChannelSubscribe = () => {
    if (channelState === 'idle') {
      setChannelState('resolving');
      setTimeout(() => setChannelState('done'), 1500);
    }
  };

  const handleWebsiteSubscribe = () => {
    if (subState === 'idle') {
      setSubscribeModalOpen(false);
      setAfdaModal('subscribe-flow');
    }
  };

  const handleAfdaSectionSubscribe = () => {
    setAfdaModal('added');
  };

  const handleViewSubscription = () => {
    setAfdaModal(null);
    setSubState('done');
  };

  // Compact card list — mirrors VideoPlayerPanel's allDownloads sidebar
  const getCompactVideos = (): DummyVideo[] => {
    switch (active) {
      case OnboardingFeature.VideoDownload:
        return started ? [DUMMY_SINGLE_VIDEO] : [];
      case OnboardingFeature.Playlist:
        return started ? DUMMY_PLAYLIST.videos : [];
      case OnboardingFeature.VideoPlayer:
        return DUMMY_VIDEOS.slice(0, 3);
      default:
        return [];
    }
  };

  const renderCompactList = () => {
    const videos = getCompactVideos();
    if (videos.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-xs text-gray-400 dark:text-gray-500 px-4 text-center">
          No videos yet
        </div>
      );
    }
    return (
      <>
        {videos.map((v, i) => {
          const sim =
            active === OnboardingFeature.Playlist
              ? playlistSims[i]
              : active === OnboardingFeature.VideoDownload
              ? videoSim
              : null;
          const isActive = v.id === activeVideoId;
          const isDownloading = sim?.status === 'running';
          const isDone =
            sim?.status === 'complete' ||
            active === OnboardingFeature.VideoPlayer;
          return (
            <div
              key={v.id}
              onClick={() => (isDone || isDownloading) && onPlay?.(v)}
              className={`flex flex-col gap-1 p-2 transition-colors cursor-pointer ${
                isActive
                  ? 'bg-blue-50 dark:bg-darkModeTableBorder border-l-2 border-primary'
                  : 'hover:bg-gray-100 dark:hover:bg-darkModeHover border-l-2 border-transparent'
              }`}
            >
              <div className="flex gap-2">
                <div className="flex-shrink-0 w-20 h-14 rounded overflow-hidden flex items-center justify-center bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.6)_0%,transparent_40%),radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.5)_0%,transparent_45%),radial-gradient(circle_at_45%_80%,rgba(255,255,255,0.4)_0%,transparent_35%),linear-gradient(135deg,#ffa42e,#fec77d,#ffa42e,#fec170)]">
                  <FiPlayCircle size={16} color="#F45513" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] mb-1 font-medium line-clamp-2 dark:text-gray-200 leading-tight">
                    {v.title}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                    {v.channel}
                  </div>
                </div>
              </div>
              {isDownloading && sim && (
                <div className="flex items-center gap-2 px-0.5">
                  <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#5BC083] rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, Math.max(0, sim.progress))}%`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 flex-shrink-0 w-7 text-right">
                    {Math.round(sim.progress)}%
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </>
    );
  };

  const isComplete = (): boolean => {
    switch (active) {
      case OnboardingFeature.VideoDownload:
        return videoSim.status === 'complete';
      case OnboardingFeature.Playlist:
        return playlistSims.every((s) => s.status === 'complete');
      case OnboardingFeature.AfdaSingle:
        return afdaState === 'done';
      case OnboardingFeature.AfdaSubscription:
        return subState === 'done';
      case OnboardingFeature.YtChannel:
        return channelState === 'done';
      case OnboardingFeature.VideoPlayer:
        return false;
      case OnboardingFeature.SmartOrganize:
        return soState === 'done';
    }
  };

  const renderRows = () => {
    const idleHint = FEATURE_IDLE_HINTS[active];

    if (!started && active !== OnboardingFeature.VideoPlayer) {
      return (
        <tr>
          <td
            colSpan={999}
            className="py-16 text-center text-xs text-gray-400 dark:text-gray-500"
          >
            {idleHint}
          </td>
        </tr>
      );
    }

    switch (active) {
      case OnboardingFeature.VideoDownload:
        return (
          <VideoRow
            video={DUMMY_SINGLE_VIDEO}
            status={videoSim.status}
            progress={videoSim.progress}
            onStartDownload={videoSim.start}
            onPlay={() => onPlay?.(DUMMY_SINGLE_VIDEO)}
            rowId="demo-download-row"
            playBtnId="demo-play-btn"
          />
        );

      case OnboardingFeature.Playlist:
        return (
          <>
            {DUMMY_PLAYLIST.videos.map((video, i) => (
              <VideoRow
                key={video.id}
                video={video}
                status={playlistSims[i].status}
                progress={playlistSims[i].progress}
                onStartDownload={playlistSims[i].start}
                onPlay={() => onPlay?.(video)}
              />
            ))}
          </>
        );

      case OnboardingFeature.AfdaSingle:
        return (
          <ArticleRow
            article={DUMMY_ARTICLES[0]}
            state={afdaState}
            onStartDownload={() => {
              if (afdaState === 'idle') {
                setAfdaState('analyzing');
                setTimeout(() => setAfdaState('done'), 1500);
              }
            }}
          />
        );

      case OnboardingFeature.AfdaSubscription:
        if (subState === 'done') {
          return (
            <>
              <SubGroupRow
                url={DUMMY_SUBSCRIPTION_URL}
                count={DUMMY_ARTICLES.length}
              />
              {DUMMY_ARTICLES.map((article) => (
                <ArticleRow
                  key={article.id}
                  article={article}
                  state="done"
                  indent
                />
              ))}
            </>
          );
        }
        return (
          <tr>
            <td
              colSpan={999}
              className="py-16 text-center text-xs text-gray-400 dark:text-gray-500"
            >
              {idleHint}
            </td>
          </tr>
        );

      case OnboardingFeature.YtChannel:
        if (channelState === 'resolving') {
          return (
            <tr>
              <td colSpan={999} className="py-8 text-center">
                <div className="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className="animate-spin text-primary">⟳</span>
                  Resolving channel…
                </div>
              </td>
            </tr>
          );
        }
        if (channelState === 'done') {
          return (
            <>
              {DUMMY_CHANNEL.videos.map((v) => {
                const dv: DummyVideo = {
                  id: v.id,
                  title: v.title,
                  channel: DUMMY_CHANNEL.name,
                  duration: v.duration,
                  size: '—',
                };
                return (
                  <VideoRow
                    key={v.id}
                    video={dv}
                    status="complete"
                    progress={100}
                    onPlay={() => onPlay?.(dv)}
                  />
                );
              })}
            </>
          );
        }
        return (
          <tr>
            <td
              colSpan={999}
              className="py-16 text-center text-xs text-gray-400 dark:text-gray-500"
            >
              {idleHint}
            </td>
          </tr>
        );

      case OnboardingFeature.VideoPlayer:
        return (
          <>
            {DUMMY_VIDEOS.slice(0, 3).map((v) => (
              <VideoRow
                key={v.id}
                video={v}
                status="complete"
                progress={100}
                onPlay={() => onPlay?.(v)}
              />
            ))}
          </>
        );
    }
  };

  const SubscriptionTableHead = () => (
    <thead>
      <tr className="border-b border-gray-100 dark:border-darkModeTableBorder bg-[#F9F9F9] dark:bg-darkModeDropdown">
        <th className="w-8 p-2 pl-4">
          <input type="checkbox" disabled className="opacity-30 rounded" />
        </th>
        {[
          'Subscriptions',
          'Status',
          'Checked',
          'Downloads',
          'Source',
          'Size',
        ].map((col) => (
          <th key={col} className="p-2 text-left">
            <span className="flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300 select-none">
              {col}
              <HiChevronUpDown size={12} className="text-gray-400" />
            </span>
          </th>
        ))}
      </tr>
    </thead>
  );

  // SmartOrganize: placeholder demo
  if (active === OnboardingFeature.SmartOrganize) {
    const handleRunSO = () => {
      setSoState('running');
      setTimeout(() => setSoState('done'), 2500);
    };

    return (
      <div className="flex-1 overflow-hidden flex flex-col min-w-0">
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-darkModeTableBorder">
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
            Smart Organize
          </span>
          {soState === 'done' && (
            <button
              onClick={handleReset}
              className="text-[11px] text-primary hover:underline"
            >
              Reset demo
            </button>
          )}
        </div>

        {soState === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-2xl">🗂️</span>
            </div>
            <div>
              <p className="text-sm font-semibold dark:text-gray-200">
                Organize your library automatically
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-[280px]">
                Smart Organize reads your downloads and sorts them into
                categories using local AI — nothing leaves your device.
              </p>
            </div>
            <button
              id="so-run-btn"
              onClick={() => {
                handleRunSO();
                onInteraction?.();
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-md hover:bg-primary/90"
            >
              ✨ Run Smart Organize
            </button>
          </div>
        )}

        {soState === 'running' && (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-full max-w-sm space-y-3 px-8">
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                <span className="animate-spin text-primary">⟳</span>
                Analyzing your library locally…
              </div>
              <div className="w-full h-1.5 rounded-full bg-gray-200 dark:bg-darkModeCompliment overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: '65%' }}
                />
              </div>
              <p className="text-[11px] text-gray-400 text-center">
                Nothing leaves your device
              </p>
            </div>
          </div>
        )}

        {soState === 'done' && (
          <div id="so-results" className="flex-1 overflow-auto p-4 space-y-5">
            {SO_CATEGORIES.map((cat) => (
              <div key={cat.name} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold dark:text-gray-200">
                    {cat.name}
                  </span>
                  <span className="text-[11px] text-gray-500 bg-gray-100 dark:bg-darkModeCompliment px-1.5 py-0.5 rounded">
                    {cat.count} videos
                  </span>
                </div>
                <div className="space-y-1.5">
                  {cat.videos.map((title) => (
                    <div
                      key={title}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg border border-divider dark:border-darkModeCompliment bg-white dark:bg-darkModeTable"
                    >
                      <div className={THUMB_CLASS}>
                        <FiPlayCircle size={16} color="#F45513" />
                      </div>
                      <span className="text-xs dark:text-gray-200 truncate">
                        {title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // YtChannel: dedicated component with proper Skedulosa UI
  if (active === OnboardingFeature.YtChannel) {
    return (
      <DemoYtChannelTable
        onInteraction={onInteraction}
        onAnalyzed={onAnalyzed}
        onCompleted={onCompleted}
        onReset={onReset}
      />
    );
  }

  // AfdaSubscription: full SkedulosaLayout-style split (left nav + main with taskbar) for all states
  if (active === OnboardingFeature.AfdaSubscription) {
    const websiteDomain = DUMMY_SUBSCRIPTION_URL.replace(
      /^https?:\/\//,
      '',
    ).replace(/\/$/, '');
    return (
      <div className="flex flex-1 overflow-hidden min-w-0">
        {/* Left sidebar — mirrors SkedulosaNavigation */}
        <div className="w-[205px] flex-shrink-0 bg-white dark:bg-darkModeTable border-r border-gray-100 dark:border-darkModeTableBorder overflow-y-auto overflow-x-hidden relative">
          <div className="py-2 px-3 mt-7 flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              {(
                [
                  {
                    label: 'Subscriptions',
                    Icon: MdSubscriptions,
                    active: true,
                  },
                  { label: 'Scheduled', Icon: FiCalendar, active: false },
                  { label: 'History', Icon: LuHistory, active: false },
                ] as const
              ).map(({ label, Icon, active: isActive }) => (
                <button
                  key={label}
                  className={`flex flex-nowrap items-center h-7 rounded dark:text-gray-200 cursor-default w-full ${
                    isActive ? 'bg-titleBar dark:bg-[#3D3D3D]' : ''
                  }`}
                >
                  <span className="flex items-center justify-center w-[46px] flex-shrink-0">
                    <Icon size={16} className="text-primary" />
                  </span>
                  <span className="text-[12px] whitespace-nowrap overflow-hidden min-w-0">
                    {label}
                  </span>
                </button>
              ))}
            </div>
            <div>
              <button className="w-full flex items-center h-7 rounded dark:text-gray-200 cursor-default">
                <span className="flex items-center gap-1 whitespace-nowrap overflow-hidden min-w-0 pl-1">
                  <FiChevronDown size={16} className="flex-shrink-0" />
                  <span className="text-sm font-semibold">Status</span>
                </span>
              </button>
              <div className="flex flex-col gap-[6px]">
                {(
                  [
                    {
                      label: 'All',
                      Icon: FiFolder,
                      color: 'text-primary',
                      active: true,
                    },
                    {
                      label: 'Active',
                      Icon: MdPlayArrow,
                      color: 'text-green-500',
                      active: false,
                    },
                    {
                      label: 'Paused',
                      Icon: PiPauseBold,
                      color: 'text-amber-500',
                      active: false,
                    },
                    {
                      label: 'Needs Attention',
                      Icon: BsHourglassSplit,
                      color: 'text-amber-600',
                      active: false,
                    },
                    {
                      label: 'Error',
                      Icon: FaRegTimesCircle,
                      color: 'text-red-500',
                      active: false,
                    },
                  ] as const
                ).map(({ label, Icon, color, active: isActive }) => (
                  <button
                    key={label}
                    className={`flex flex-nowrap items-center h-7 w-full rounded dark:text-gray-200 cursor-default ${
                      isActive ? 'bg-titleBar dark:bg-[#3D3D3D]' : ''
                    }`}
                  >
                    <span className="flex items-center justify-center w-[46px] flex-shrink-0">
                      <Icon size={16} className={color} />
                    </span>
                    <span className="text-[12px] whitespace-nowrap overflow-hidden min-w-0">
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <button className="w-full flex items-center h-7 rounded dark:text-gray-200 cursor-default">
                <span className="flex items-center gap-1 whitespace-nowrap overflow-hidden min-w-0 pl-1">
                  <FiChevronDown size={16} className="flex-shrink-0" />
                  <span className="text-sm font-semibold">Categories</span>
                </span>
              </button>
              <div className="flex flex-col gap-[6px]">
                {(
                  [
                    {
                      label: 'all',
                      Icon: BiLayer,
                      color: 'text-orange-500',
                      active: false,
                    },
                    {
                      label: 'youtube',
                      Icon: MdPlayArrow,
                      color: 'text-green-500',
                      active: false,
                    },
                    {
                      label: 'afda',
                      Icon: LuNewspaper,
                      color: 'text-blue-500',
                      active: true,
                    },
                  ] as const
                ).map(({ label, Icon, color, active: isActive }) => (
                  <button
                    key={label}
                    className={`flex flex-nowrap items-center h-7 w-full rounded dark:text-gray-200 cursor-default ${
                      isActive ? 'bg-titleBar dark:bg-[#3D3D3D]' : ''
                    }`}
                  >
                    <span className="flex items-center justify-center w-[46px] flex-shrink-0">
                      <Icon size={16} className={color} />
                    </span>
                    <span className="text-[12px] whitespace-nowrap overflow-hidden min-w-0">
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          {subState === 'done' && (
            <div className="absolute bottom-3 right-3">
              <button
                onClick={handleReset}
                className="text-[10px] text-primary hover:underline"
              >
                Reset
              </button>
            </div>
          )}
        </div>

        {/* Right: main content — mirrors SkedulosaHome */}
        <div className="flex-1 overflow-hidden flex flex-col min-w-0">
          {/* Taskbar */}
          {subState === 'done' ? (
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-darkModeTableBorder">
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <FiDownload size={12} className="text-primary" />
                  <span className="font-semibold text-gray-700 dark:text-gray-200">
                    {DUMMY_ARTICLES.length}
                  </span>
                  &nbsp;today&nbsp;/&nbsp;
                  <span className="font-semibold text-primary">
                    {DUMMY_ARTICLES.length}
                  </span>
                  &nbsp;this week
                </span>
                <span className="flex items-center gap-1">
                  <LuHardDrive size={12} />
                  2.4 MB used
                </span>
                <span className="flex items-center gap-1">
                  <FiClock size={12} />
                  Next check in Sat 12:00 AM
                </span>
              </div>
              <div className="flex items-center gap-2">
                <FiSearch size={13} className="text-gray-400 cursor-default" />
                <HiChevronUpDown
                  size={13}
                  className="text-gray-400 cursor-default"
                />
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-primary text-white opacity-50 cursor-default">
                  + Add Website
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-darkModeTableBorder">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                Article Websites
              </span>
              <button
                id="demo-afda-add-btn"
                onClick={() => {
                  setSubscribeModalOpen(true);
                  onInteraction?.();
                }}
                disabled={subState !== 'idle' || afdaModal !== null}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  subState === 'idle' && afdaModal === null
                    ? 'bg-primary text-white hover:bg-primary/90 cursor-pointer'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-darkModeHover dark:text-gray-500'
                }`}
              >
                <LuNewspaper size={13} />
                Add Website
              </button>
            </div>
          )}

          {/* Empty state */}
          {subState === 'idle' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <LuNewspaper size={32} className="text-primary/60" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  No websites yet
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-[280px]">
                  Add a website to automatically download new articles as
                  they're published
                </p>
              </div>
              <button
                onClick={() => setSubscribeModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-semibold rounded-md hover:bg-primary/90 cursor-pointer"
              >
                <LuNewspaper size={14} />
                Add Website
              </button>
            </div>
          )}

          {subState === 'done' && (
            <div className="flex-1 overflow-auto min-w-0">
              <table className="w-full">
                <SubscriptionTableHead />
                <tbody>
                  <tr
                    id="demo-afda-sub-row"
                    className="border-b border-gray-100 dark:border-darkModeTableBorder hover:bg-gray-50 dark:hover:bg-darkModeHover bg-white dark:bg-darkModeTable cursor-pointer"
                  >
                    <td className="w-8 p-2 pl-4">
                      <input
                        type="checkbox"
                        disabled
                        className="opacity-40 rounded"
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/60 to-primary flex items-center justify-center flex-shrink-0">
                          <LuNewspaper size={14} className="text-white" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                            {websiteDomain}
                          </p>
                          <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                            {DUMMY_SUBSCRIPTION_URL}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-2">
                      <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                        Active
                      </span>
                    </td>
                    <td className="p-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      just now
                    </td>
                    <td className="p-2 text-xs text-gray-700 dark:text-gray-300">
                      {DUMMY_ARTICLES.length}
                    </td>
                    <td className="p-2">
                      <span className="flex items-center justify-center w-7 h-5 bg-primary text-white rounded text-[9px] font-bold">
                        afda
                      </span>
                    </td>
                    <td className="p-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      2.4 MB
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
        <DemoSubscribeModal
          isOpen={subscribeModalOpen}
          onClose={() => setSubscribeModalOpen(false)}
          onSubscribe={handleWebsiteSubscribe}
          onAnalyzed={onAnalyzed}
          variant="website"
        />
        <DemoAfdaSubscribeModal
          isOpen={afdaModal === 'subscribe-flow'}
          onClose={() => setAfdaModal(null)}
          onSubscribe={handleAfdaSectionSubscribe}
        />
        <DemoAddedSubscriptionModal
          isOpen={afdaModal === 'added'}
          onViewSubscription={handleViewSubscription}
        />
      </div>
    );
  }

  if (
    playerOpen &&
    [
      OnboardingFeature.VideoDownload,
      OnboardingFeature.Playlist,
      OnboardingFeature.VideoPlayer,
    ].includes(active)
  ) {
    return (
      <div className="flex-1 min-w-0 overflow-y-auto bg-white dark:bg-darkModeTable [&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-600">
        {renderCompactList()}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto min-w-0">
      <table className="w-full">
        <TableHead />
        <tbody>
          {renderRows()}
          {isComplete() && (
            <tr>
              <td colSpan={999} className="py-2 text-center">
                <button
                  onClick={handleReset}
                  className="text-xs text-primary hover:underline"
                >
                  Reset demo
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default DemoStatusTable;
