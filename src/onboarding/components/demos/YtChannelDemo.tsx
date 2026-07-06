import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DemoShell from '../shared/DemoShell';
import { DUMMY_CHANNEL, OnboardingFeature } from '../../types/onboardingTypes';

type SubState = 'idle' | 'resolving' | 'done';

interface Props {
  started: boolean;
  onReset: () => void;
}

const YtChannelDemo: React.FC<Props> = ({ started, onReset }) => {
  const [state, setState] = useState<SubState>('idle');

  useEffect(() => {
    if (started && state === 'idle') {
      setState('resolving');
      setTimeout(() => setState('done'), 1500);
    }
  }, [started, state]);

  const handleReset = () => {
    setState('idle');
    onReset();
  };

  return (
    <DemoShell
      featureKey={OnboardingFeature.YtChannel}
      badge="Channel Subscriptions"
      title="Subscribe to YouTube Channels"
      subtitle="Paste a channel URL in the toolbar — downlodr automatically queues new videos as they're published."
    >
      {state === 'resolving' && (
        <div className="flex items-center justify-center gap-2 h-16 rounded-lg border border-divider dark:border-darkModeCompliment bg-white dark:bg-darkModeTable text-xs text-gray-500 dark:text-gray-400">
          <span className="animate-spin text-primary">⟳</span>
          Resolving channel…
        </div>
      )}

      <AnimatePresence>
        {state === 'done' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-divider dark:border-darkModeCompliment bg-white dark:bg-darkModeTable">
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-darkModeDarkGray flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold dark:text-darkModeLight">
                  {DUMMY_CHANNEL.name}
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {DUMMY_CHANNEL.handle} · {DUMMY_CHANNEL.subscribers}{' '}
                  subscribers
                </p>
              </div>
              <span className="text-[11px] text-green-500 font-medium">
                {DUMMY_CHANNEL.videos.length} new videos found
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {DUMMY_CHANNEL.videos.map((video, i) => (
                <motion.div
                  key={video.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.12 }}
                  className="rounded-lg border border-divider dark:border-darkModeCompliment bg-white dark:bg-darkModeTable overflow-hidden"
                >
                  <div className="w-full h-20 bg-black flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                      <span className="text-white text-xs">▶</span>
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="text-[11px] font-medium dark:text-darkModeLight line-clamp-2">
                      {video.title}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {video.duration}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="text-center">
              <button
                onClick={handleReset}
                className="text-xs text-primary hover:underline"
              >
                Reset demo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {state === 'idle' && (
        <div className="flex items-center justify-center h-24 rounded-lg border border-dashed border-divider dark:border-darkModeCompliment text-xs text-gray-400 dark:text-gray-500">
          Click the download icon in the toolbar above to resolve a channel
        </div>
      )}
    </DemoShell>
  );
};

export default YtChannelDemo;
