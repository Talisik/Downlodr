import React, { useState } from 'react';
import {
  Play,
  Pause,
  Volume1,
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
  volume: number;
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
  onVolumeChange: (volume: number) => void;
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
  volume,
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
  onVolumeChange,
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

        {/* Mute + volume slider (slider expands on hover / focus) */}
        <div className="group/volume flex items-center flex-shrink-0">
          <button
            onClick={onMute}
            className="text-white flex-shrink-0"
            title={
              isMuted
                ? t('videoPlayer.menu.unmute', 'Unmute')
                : t('videoPlayer.menu.mute', 'Mute')
            }
          >
            {isMuted || volume === 0 ? (
              <VolumeX size={14} />
            ) : volume < 0.5 ? (
              <Volume1 size={14} />
            ) : (
              <Volume2 size={14} />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            aria-label={t('videoPlayer.menu.volume', 'Volume')}
            title={t('videoPlayer.menu.volume', 'Volume')}
            className="h-1 min-w-0 w-0 opacity-0 cursor-pointer accent-orange-500 transition-all duration-200 group-hover/volume:w-16 group-hover/volume:opacity-100 group-hover/volume:ml-2 focus:w-16 focus:opacity-100 focus:ml-2"
          />
        </div>

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
