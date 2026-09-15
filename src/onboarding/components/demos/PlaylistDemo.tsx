import React, { useEffect } from 'react';
import { FiPlayCircle } from 'react-icons/fi';
import DemoShell from '../shared/DemoShell';
import FakeProgressBar from '../shared/FakeProgressBar';
import { useDemoSimulator } from '../../hooks/useDemoSimulator';
import { DUMMY_PLAYLIST, OnboardingFeature } from '../../types/onboardingTypes';

interface Props {
  started: boolean;
  onReset: () => void;
}

const PlaylistDemo: React.FC<Props> = ({ started, onReset }) => {
  const sim0 = useDemoSimulator(3000);
  const sim1 = useDemoSimulator(3600);
  const sim2 = useDemoSimulator(2800);
  const sim3 = useDemoSimulator(4200);
  const sim4 = useDemoSimulator(3300);

  useEffect(() => {
    if (started) {
      [sim0, sim1, sim2, sim3, sim4].forEach((sim, i) => {
        setTimeout(() => sim.start(), i * 300);
      });
    }
  }, [started]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReset = () => {
    [sim0, sim1, sim2, sim3, sim4].forEach((sim) => sim.reset());
    onReset();
  };

  const allDone = [sim0, sim1, sim2, sim3, sim4].every(
    (s) => s.status === 'complete',
  );
  const sims = [sim0, sim1, sim2, sim3, sim4];

  return (
    <DemoShell
      featureKey={OnboardingFeature.Playlist}
      badge="Batch Downloading"
      title="Download Entire Playlists"
      subtitle="Paste a playlist URL in the toolbar and click download — downlodr queues all videos and handles them in parallel."
    >
      <div className="rounded-lg border border-divider dark:border-darkModeCompliment bg-white dark:bg-darkModeDropdown shadow-sm overflow-hidden">
        <div className="flex gap-0 divide-x divide-divider dark:divide-darkModeCompliment">
          <div className="w-48 flex-shrink-0 p-4 space-y-3">
            <p className="text-xs font-medium dark:text-darkModeLight text-gray-700 mb-2">
              Options
            </p>
            {['Best Quality', 'Audio Only', 'Subtitles'].map((opt) => (
              <label
                key={opt}
                className="flex items-center gap-2 cursor-pointer"
              >
                <span
                  className="w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor:
                      opt === 'Best Quality' ? '#F45513' : '#09090B',
                    borderColor: opt === 'Best Quality' ? '#F45513' : '#52525B',
                  }}
                >
                  {opt === 'Best Quality' && (
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                      <path
                        d="M1 3l2 2 4-4"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span className="text-xs dark:text-darkModeLight text-gray-700">
                  {opt}
                </span>
              </label>
            ))}
            {allDone && (
              <div className="pt-2">
                <button
                  onClick={handleReset}
                  className="w-full text-xs text-primary hover:underline"
                >
                  Reset demo
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 max-h-[220px] overflow-y-auto p-2 space-y-1">
            {DUMMY_PLAYLIST.videos.map((video, i) => (
              <div
                key={video.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-darkModeHover transition-colors"
              >
                <div className="w-24 h-16 rounded flex items-center justify-center flex-shrink-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.6)_0%,transparent_40%),radial-gradient(circle_at_70%_60%,rgba(255,255,255,0.5)_0%,transparent_45%),radial-gradient(circle_at_45%_80%,rgba(255,255,255,0.4)_0%,transparent_35%),linear-gradient(135deg,#ffa42e,#fec77d,#ffa42e,#fec170)]">
                  <FiPlayCircle size={18} color="#F45513" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium dark:text-darkModeLight truncate">
                    {video.title}
                  </p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                    {video.channel}
                  </p>
                  {started && (
                    <div className="mt-1.5">
                      <FakeProgressBar progress={sims[i].progress} />
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-gray-400 flex-shrink-0">
                  {video.duration}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {!started && (
        <div className="flex items-center justify-center h-16 mt-3 rounded-lg border border-dashed border-divider dark:border-darkModeCompliment text-xs text-gray-400 dark:text-gray-500">
          Click the download icon in the toolbar above to queue all videos
        </div>
      )}
    </DemoShell>
  );
};

export default PlaylistDemo;
