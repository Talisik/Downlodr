import React, { useState } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Check,
} from 'lucide-react';
import { LuCaptions } from 'react-icons/lu';
import { RiPictureInPictureFill } from 'react-icons/ri';
import { useTranslation } from 'react-i18next';
import { formatDuration } from '@/downlodr/utils/formatDuration';

interface PlayerControlsBarProps {
  isAudioMode: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  captionBlobUrl: string | null;
  isCaptionsEnabled: boolean;
  controlsVisible: boolean;
  isFullscreen?: boolean;
  showPiP?: boolean;
  onPlayPause: () => void;
  onMute: () => void;
  onSeek: (ratio: number) => void;
  onCaptionToggle: () => void;
  onPlaybackRate: (rate: number) => void;
  onFullscreen?: () => void;
  onPiP?: () => void;
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

const PlayerControlsBar: React.FC<PlayerControlsBarProps> = ({
  isAudioMode,
  isPlaying,
  isMuted,
  currentTime,
  duration,
  playbackRate,
  captionBlobUrl,
  isCaptionsEnabled,
  controlsVisible,
  isFullscreen,
  showPiP,
  onPlayPause,
  onMute,
  onSeek,
  onCaptionToggle,
  onPlaybackRate,
  onFullscreen,
  onPiP,
}) => {
  const { t } = useTranslation('downlodr');
  const [showSpeedSubmenu, setShowSpeedSubmenu] = useState(false);

  const handleSeekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(1, ratio)));
  };

  return (
    <div
      className={`absolute ${
        isAudioMode ? 'bottom-10' : 'bottom-4'
      } left-3 right-3 z-10 transition-opacity duration-300 ${
        controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="flex items-center gap-2.5 px-3 py-4 bg-[#4B4B4B]/70 backdrop-blur-sm rounded-full">
        {/* Play / Pause */}
        <button onClick={onPlayPause} className="text-white flex-shrink-0">
          {isPlaying ? (
            <Pause size={14} fill="currentColor" />
          ) : (
            <Play size={14} fill="currentColor" />
          )}
        </button>

        {/* Mute */}
        <button onClick={onMute} className="text-white flex-shrink-0">
          {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>

        {/* Time display */}
        <span className="text-white text-[11px] tabular-nums flex-shrink-0">
          {formatDuration(currentTime)} /{' '}
          {duration > 0 ? formatDuration(duration) : '0:00'}
        </span>

        {/* Seek bar */}
        <div
          className="flex-1 h-1 bg-white/30 rounded-full cursor-pointer"
          onClick={handleSeekClick}
        >
          <div
            className="h-full bg-orange-500 rounded-full pointer-events-none"
            style={{
              width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%',
            }}
          />
        </div>

        {/* Captions */}
        <button
          onClick={() => {
            if (!captionBlobUrl) return;
            onCaptionToggle();
          }}
          className={`flex-shrink-0 ${
            captionBlobUrl && isCaptionsEnabled
              ? 'text-orange-400'
              : captionBlobUrl
              ? 'text-white'
              : 'text-white/30 cursor-not-allowed'
          }`}
          title={t('videoPlayer.menu.captions', 'Captions')}
        >
          <LuCaptions size={14} />
        </button>

        {/* Picture-in-Picture (video only) */}
        {showPiP && (
          <button
            onClick={onPiP}
            className="text-white flex-shrink-0"
            title={t('videoPlayer.menu.pictureInPicture', 'Picture in Picture')}
          >
            <RiPictureInPictureFill size={14} />
          </button>
        )}

        {/* Playback Speed */}
        <div className="relative flex-shrink-0">
          <button
            className="text-white text-[11px] font-medium tabular-nums"
            onClick={() => setShowSpeedSubmenu((v) => !v)}
            title={t('videoPlayer.menu.playbackSpeed', 'Playback Speed')}
          >
            {playbackRate}×
          </button>
          {showSpeedSubmenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowSpeedSubmenu(false)}
              />
              <div className="absolute right-0 bottom-6 z-20 w-24 bg-[#2a2a2a] border border-white/10 rounded-md shadow-lg py-1 text-[12px]">
                {PLAYBACK_RATES.map((rate) => (
                  <button
                    key={rate}
                    className={`w-full flex items-center justify-between px-3 py-1.5 hover:bg-white/10 ${
                      playbackRate === rate ? 'text-orange-400' : 'text-white'
                    }`}
                    onClick={() => {
                      onPlaybackRate(rate);
                      setShowSpeedSubmenu(false);
                    }}
                  >
                    {rate === 1
                      ? t('videoPlayer.menu.normal', 'Normal')
                      : `${rate}×`}
                    {playbackRate === rate && <Check size={11} />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Fullscreen (video only) */}
        {!isAudioMode && (
          <button
            onClick={onFullscreen}
            className="text-white flex-shrink-0"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
          </button>
        )}
      </div>
    </div>
  );
};

export default PlayerControlsBar;
