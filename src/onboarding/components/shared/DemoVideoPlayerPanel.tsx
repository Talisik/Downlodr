import React, { useEffect, useRef, useState } from 'react';
import { VscClose } from 'react-icons/vsc';
import { FaYoutube } from 'react-icons/fa';
import { FaRegHeart } from 'react-icons/fa6';
import { FcFolder } from 'react-icons/fc';
import { DummyVideo } from '../../types/onboardingTypes';

const SAMPLE_VIDEO_URL =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

const DUMMY_DESCRIPTION =
  "Big Buck Bunny (code-named Peach) is a short computer-animated comedy film by the Blender Institute, part of the Blender Foundation. Like the foundation's previous film, Elephants Dream, the film was made using Blender, a free and open-source 3D creation suite. It was released as an open-source film under the Creative Commons Attribution 3.0 license.";

const DUMMY_TAGS = ['tutorial', 'demo', 'open-source'];
const DUMMY_CATEGORIES = ['Education'];

type Tab = 'description' | 'transcript' | 'chapters';

interface DemoVideoPlayerPanelProps {
  video: DummyVideo;
  onClose: () => void;
}

const DemoVideoPlayerPanel: React.FC<DemoVideoPlayerPanelProps> = ({ video, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeTab, setActiveTab] = useState<Tab>('description');

  // Esc to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Pause when unmounted (feature switch while player is open)
  useEffect(() => {
    return () => {
      videoRef.current?.pause();
    };
  }, []);

  return (
    <div className="flex-shrink-0 h-full bg-white dark:bg-darkModeTable rounded-md shadow-lg flex flex-col overflow-hidden" style={{ width: '55%' }}>
      {/* Header — mirrors VideoPlayerPanel's bg-FooterBg header */}
      <div className="bg-[#F9F9F9] dark:bg-darkModeDropdown px-3 pt-[11px] pb-2 flex items-center justify-between flex-shrink-0 border-b border-gray-200 dark:border-darkModeTableBorder">
        <div className="flex items-center gap-2 mx-2">
          <FaYoutube className="text-red-500" size={16} />
          <span className="text-black dark:text-white font-semibold text-md leading-6 truncate">
            youtube
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-black dark:text-white hover:text-red-500 ml-2 p-1 flex-shrink-0 cursor-pointer"
        >
          <VscClose size={16} />
        </button>
      </div>

      {/* Body: video area + metadata sidebar */}
      <div className="flex-1 flex flex-row overflow-hidden">
        {/* Video area — matches VideoPlayerPanel's m-4 black rounded container */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="m-4 flex-1 flex items-center justify-center bg-black rounded overflow-hidden">
            <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
              <video
                ref={videoRef}
                src={SAMPLE_VIDEO_URL}
                controls
                autoPlay
                className="w-full h-full"
              />
            </div>
          </div>
        </div>

        {/* Metadata sidebar — mirrors VideoPlayerPanel's w-96 right sidebar */}
        <div className="w-80 flex-shrink-0 flex flex-col overflow-hidden bg-white dark:bg-darkModeTable border-l border-gray-100 dark:border-darkModeTableBorder">
          <div className="flex flex-col gap-2 p-4 h-full overflow-hidden">
            {/* Title + favorite */}
            <div className="flex gap-2 items-start justify-between flex-shrink-0">
              <span className="font-bold text-[13px] dark:text-gray-100 line-clamp-2 flex-1">
                {video.title}
              </span>
              <button className="opacity-30 cursor-default flex-shrink-0 mt-0.5" disabled>
                <FaRegHeart size={13} />
              </button>
            </div>

            {/* Channel · date · badges */}
            <div className="flex-shrink-0">
              <div className="flex flex-row gap-1 min-w-0 items-center">
                <span className="text-[12px] font-medium truncate text-gray-500 dark:text-gray-200">
                  {video.channel}
                </span>
                <span className="text-[11px] text-gray-400">•</span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">
                  {new Date().toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex gap-2 text-[11px] flex-wrap mt-1">
                <span className="text-xxs bg-black text-white dark:bg-gray-700 px-2 py-0.5 rounded-lg">
                  MP4
                </span>
                <span className="text-xxs bg-[#E6E6E6] dark:bg-gray-700 px-2 py-0.5 rounded-lg text-gray-600 dark:text-gray-300">
                  {video.duration}
                </span>
                <span className="text-xxs bg-[#E6E6E6] dark:bg-gray-700 px-2 py-0.5 rounded-lg text-gray-600 dark:text-gray-300">
                  {video.size}
                </span>
              </div>
            </div>

            {/* Location row */}
            <div className="flex-shrink-0">
              <div className="border-t border-gray-200 dark:border-gray-700 mb-1" />
              <div className="text-xs text-primary dark:text-gray-500 truncate flex items-center gap-1">
                <FcFolder className="flex-shrink-0" />
                <span>/Downloads/demo</span>
              </div>
            </div>

            {/* Categories + tags */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex-shrink-0">
              <div className="flex flex-wrap gap-1 mb-1">
                <span className="text-[12px] dark:text-gray-200">Categories</span>
                {DUMMY_CATEGORIES.map((c) => (
                  <span
                    key={c}
                    className="px-1.5 py-0.5 text-[10px] rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                  >
                    {c}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                <span className="text-[12px] dark:text-gray-200">Tags</span>
                {DUMMY_TAGS.map((t) => (
                  <span
                    key={t}
                    className="px-1.5 py-0.5 text-[10px] rounded bg-primary/10 text-primary"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* Tab bar — matches VideoPlayerPanel exactly */}
            <div className="flex border-b border-gray-200 dark:border-gray-700 flex-shrink-0 -mx-3">
              {(['description', 'transcript', 'chapters'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`mx-3 py-1.5 text-[11px] border-b-2 transition-colors capitalize ${
                    activeTab === tab
                      ? 'border-primary text-primary font-medium'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:w-0">
              {activeTab === 'description' && (
                <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap leading-relaxed pt-2">
                  {DUMMY_DESCRIPTION}
                </p>
              )}
              {activeTab === 'transcript' && (
                <div className="flex items-center justify-center py-6">
                  <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                    Demo — transcript not available
                  </span>
                </div>
              )}
              {activeTab === 'chapters' && (
                <div className="flex items-center justify-center py-6">
                  <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                    Demo — no chapters
                  </span>
                </div>
              )}
            </div>

            <div className="flex-shrink-0 text-center pb-1">
              <span className="text-[10px] text-gray-400 dark:text-gray-600 italic">
                Demo — sample video (Big Buck Bunny)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DemoVideoPlayerPanel;
