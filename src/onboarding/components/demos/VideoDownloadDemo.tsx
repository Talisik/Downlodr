import React, { useEffect } from 'react';
import DemoShell from '../shared/DemoShell';
import FakeDownloadRow from '../shared/FakeDownloadRow';
import { useDemoSimulator } from '../../hooks/useDemoSimulator';
import {
  DUMMY_SINGLE_VIDEO,
  OnboardingFeature,
} from '../../types/onboardingTypes';

interface Props {
  started: boolean;
  onReset: () => void;
}

const VideoDownloadDemo: React.FC<Props> = ({ started, onReset }) => {
  const sim = useDemoSimulator(3000);

  useEffect(() => {
    if (started && sim.status === 'idle') sim.start();
  }, [started, sim.start, sim.status]);

  const handleReset = () => {
    sim.reset();
    onReset();
  };

  return (
    <DemoShell
      featureKey={OnboardingFeature.VideoDownload}
      badge="Core Feature"
      title="Download Any Video"
      subtitle="Paste a URL in the toolbar above and click the download icon — format selection, speed control, and queue management handled automatically."
    >
      {sim.status !== 'idle' && (
        <div className="space-y-2">
          <FakeDownloadRow
            title={DUMMY_SINGLE_VIDEO.title}
            channel={DUMMY_SINGLE_VIDEO.channel}
            size={DUMMY_SINGLE_VIDEO.size}
            progress={sim.progress}
            status={sim.status}
          />
          {sim.status === 'complete' && (
            <div className="text-center">
              <button
                onClick={handleReset}
                className="text-xs text-primary hover:underline"
              >
                Reset demo
              </button>
            </div>
          )}
        </div>
      )}

      {sim.status === 'idle' && (
        <div className="flex items-center justify-center h-24 rounded-lg border border-dashed border-divider dark:border-darkModeCompliment text-xs text-gray-400 dark:text-gray-500">
          Click the download icon in the toolbar above to see it in action
        </div>
      )}
    </DemoShell>
  );
};

export default VideoDownloadDemo;
