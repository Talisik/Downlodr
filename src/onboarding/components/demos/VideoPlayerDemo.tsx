import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Volume2 } from 'lucide-react';
import { FiPlayCircle } from 'react-icons/fi';
import DemoShell from '../shared/DemoShell';
import { DUMMY_VIDEOS, OnboardingFeature } from '../../types/onboardingTypes';

const VideoPlayerDemo: React.FC = () => {
  const [playing, setPlaying] = useState(false);
  const [activeVideo, setActiveVideo] = useState(0);
  const [activeTab, setActiveTab] = useState<'info' | 'captions'>('info');

  const video = DUMMY_VIDEOS[activeVideo];

  return (
    <DemoShell
      featureKey={OnboardingFeature.VideoPlayer}
      badge="Built-in Player"
      title="Watch Downloaded Videos"
      subtitle="Play any downloaded video directly in downlodr — no external player needed."
    >
      <div
        className="rounded-lg border border-divider dark:border-darkModeCompliment bg-white dark:bg-darkModeTable shadow-sm overflow-hidden flex"
        style={{ height: 320 }}
      >
        {/* Left sidebar: video list */}
        <div className="w-52 flex-shrink-0 overflow-y-auto bg-white dark:bg-darkModeTable border-r border-divider dark:border-darkModeCompliment">
          {DUMMY_VIDEOS.slice(0, 3).map((v, i) => (
            <div
              key={v.id}
              onClick={() => setActiveVideo(i)}
              className={`flex items-start gap-2 p-2 cursor-pointer transition-colors ${
                i === activeVideo
                  ? 'bg-blue-50 dark:bg-darkModeTableBorder border-l-2 border-primary'
                  : 'hover:bg-gray-50 dark:hover:bg-darkModeHover border-l-2 border-transparent'
              }`}
            >
              <div className="w-20 h-14 rounded flex items-center justify-center flex-shrink-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.6)_0%,transparent_40%),radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.5)_0%,transparent_45%),radial-gradient(circle_at_45%_80%,rgba(255,255,255,0.4)_0%,transparent_35%),linear-gradient(135deg,#ffa42e,#fec77d,#ffa42e,#fec170)]">
                <FiPlayCircle size={18} color="#F45513" />
              </div>
              <div className="flex-1 min-w-0 pt-0.5">
                <p className="text-[11px] font-medium dark:text-gray-200 line-clamp-2">
                  {v.title}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                  {v.channel}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Center: player */}
        <div className="flex-1 flex flex-col bg-black min-w-0">
          <div className="px-3 py-1 bg-gray-900 flex items-center justify-between">
            <span className="text-[11px] text-gray-400 truncate">
              {video.title}
            </span>
          </div>
          <div className="flex-1 flex items-center justify-center relative bg-black">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <span className="text-white/50 text-sm">▶</span>
            </div>
          </div>
          <div className="px-3 py-2 bg-gray-900 space-y-1.5">
            <div className="w-full h-1 rounded-full bg-gray-700">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: playing ? '35%' : '20%' }}
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPlaying((p) => !p)}
                className="text-white hover:text-primary transition-colors"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {playing ? (
                    <motion.span
                      key="pause"
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0.8 }}
                    >
                      <Pause size={16} />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="play"
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0.8 }}
                    >
                      <Play size={16} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
              <Volume2 size={14} className="text-gray-400" />
              <span className="text-[10px] text-gray-400 ml-auto">
                {playing ? '0:42' : '0:00'} / {video.duration}
              </span>
            </div>
          </div>
        </div>

        {/* Right sidebar: metadata */}
        <div className="w-56 flex-shrink-0 bg-white dark:bg-darkModeTable border-l border-divider dark:border-darkModeCompliment flex flex-col">
          <div className="flex border-b border-divider dark:border-darkModeCompliment">
            {(['info', 'captions'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs font-medium capitalize transition-colors border-b-2 ${
                  activeTab === tab
                    ? 'text-primary border-primary'
                    : 'text-gray-500 dark:text-gray-400 border-transparent'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="p-3 flex-1 overflow-y-auto">
            {activeTab === 'info' ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold dark:text-darkModeLight">
                  {video.title}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {video.channel}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-gray-400">
                    {video.duration}
                  </span>
                  <span className="text-[11px] text-gray-400">·</span>
                  <span className="text-[11px] text-gray-400">
                    {video.size}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                No captions available for this demo.
              </p>
            )}
          </div>
        </div>
      </div>
    </DemoShell>
  );
};

export default VideoPlayerDemo;
