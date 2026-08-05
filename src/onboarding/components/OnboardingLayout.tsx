import TitleBar from '@/downlodr/components/base/TitleBar';
import TaskBar from '@/downlodr/components/base/Taskbar';
import DownloadNavigationBar from '@/downlodr/components/navigation/DownloadNavigationBar';
import { useMainStore } from '@/core-app/store/mainStore';
import React, { useEffect, useState } from 'react';
import {
  DUMMY_ARTICLE_URL,
  DUMMY_CHANNEL_URL,
  DUMMY_PLAYLIST,
  DUMMY_SINGLE_URL,
  DUMMY_SUBSCRIPTION_URL,
  FEATURE_ORDER,
  OnboardingFeature,
  DummyVideo,
} from '../types/onboardingTypes';
import DemoStatusTable from './shared/DemoStatusTable';
import DemoToolbar from './shared/DemoToolbar';
import DemoVideoPlayerPanel from './shared/DemoVideoPlayerPanel';
import OnboardingPill from './OnboardingPill';
import OnboardingTour from './OnboardingTour';

interface OnboardingLayoutProps {
  onExit: () => void;
  initialFeature?: OnboardingFeature;
  tourEnabled?: boolean;
}

const FEATURE_URLS: Record<OnboardingFeature, string> = {
  [OnboardingFeature.VideoDownload]: DUMMY_SINGLE_URL,
  [OnboardingFeature.Playlist]: DUMMY_PLAYLIST.url,
  [OnboardingFeature.AfdaSingle]: DUMMY_ARTICLE_URL,
  [OnboardingFeature.AfdaSubscription]: DUMMY_SUBSCRIPTION_URL,
  [OnboardingFeature.YtChannel]: DUMMY_CHANNEL_URL,
  [OnboardingFeature.VideoPlayer]: '',
  [OnboardingFeature.SmartOrganize]: '',
};

const NO_TOOLBAR_FEATURES = [
  OnboardingFeature.YtChannel,
  OnboardingFeature.AfdaSubscription,
  OnboardingFeature.SmartOrganize,
];

const OnboardingLayout: React.FC<OnboardingLayoutProps> = ({
  onExit,
  initialFeature,
  tourEnabled = true,
}) => {
  const [active, setActive] = useState<OnboardingFeature>(
    initialFeature ?? FEATURE_ORDER[0],
  );
  const [visited, setVisited] = useState<Set<OnboardingFeature>>(
    new Set([FEATURE_ORDER[0]]),
  );
  const [demoStarted, setDemoStarted] = useState(false);
  const [demoAnalyzed, setDemoAnalyzed] = useState(false);
  const [demoCompleted, setDemoCompleted] = useState(false);
  const [playerVideo, setPlayerVideo] = useState<DummyVideo | null>(null);
  const { isNavCollapsed, setIsNavCollapsed } = useMainStore();

  // Reset demo state whenever the user switches features
  useEffect(() => {
    setDemoStarted(false);
    setDemoAnalyzed(false);
    setDemoCompleted(false);
    setPlayerVideo(null);
  }, [active]);

  const handleSelect = (f: OnboardingFeature) => {
    setActive(f);
    setVisited((prev) => new Set([...prev, f]));
  };

  const handleReset = () => {
    setDemoStarted(false);
    setDemoAnalyzed(false);
    setDemoCompleted(false);
  };

  return (
    <div className="h-screen flex flex-col bg-[#F9F9F9] dark:bg-darkMode text-gray-900 dark:text-gray-100 p-4 pt-3 gap-2">
      <TitleBar className="h-8 bg-[#F9F9F9] dark:bg-darkMode" />
      <TaskBar className="rounded-md w-full px-6 py-2 pl-[8px] bg-white dark:bg-darkModeTable" />
      <div className="flex flex-1 overflow-hidden h-[calc(100vh-120px)] gap-4">
        {!NO_TOOLBAR_FEATURES.includes(active) && (
          <div
            id="demo-nav-sidebar"
            className={`border-r-2 border-gray-300 dark:border-gray-600 mr-2 ${
              isNavCollapsed ? 'w-[50px]' : 'w-[190px]'
            } h-full flex-shrink-0 transition-all duration-300`}
          >
            <DownloadNavigationBar
              className="rounded-md bg-white dark:bg-darkModeTable overflow-y-auto h-full w-full"
              collapsed={isNavCollapsed}
              toggleCollapse={() => setIsNavCollapsed(!isNavCollapsed)}
            />
          </div>
        )}
        <main className="flex-1 overflow-hidden bg-white dark:bg-darkMode rounded-md">
          <div className="h-full flex flex-col overflow-hidden bg-white dark:bg-darkModeTable rounded-b-md group/scrollarea gap-2">
            {!NO_TOOLBAR_FEATURES.includes(active) && (
              <DemoToolbar
                url={FEATURE_URLS[active]}
                onDownload={() => setDemoStarted(true)}
                disabled={
                  demoStarted && active !== OnboardingFeature.VideoPlayer
                }
                isPlaylist={active === OnboardingFeature.Playlist}
                className="pt-2 pb-1 pr-4 flex-shrink-0"
              />
            )}
            <div className="flex-1 min-h-0 flex flex-row overflow-hidden">
              <DemoStatusTable
                active={active}
                started={demoStarted}
                onReset={handleReset}
                onPlay={setPlayerVideo}
                playerOpen={!!playerVideo}
                activeVideoId={playerVideo?.id}
                onInteraction={() => setDemoStarted(true)}
                onAnalyzed={() => setDemoAnalyzed(true)}
                onCompleted={() => setDemoCompleted(true)}
              />
              {playerVideo && (
                <DemoVideoPlayerPanel
                  video={playerVideo}
                  onClose={() => setPlayerVideo(null)}
                />
              )}
            </div>
          </div>
        </main>
      </div>
      <OnboardingTour
        active={active}
        demoStarted={demoStarted}
        demoAnalyzed={demoAnalyzed}
        demoCompleted={demoCompleted}
        enabled={tourEnabled}
      />
      <OnboardingPill
        active={active}
        visited={visited}
        onSelect={handleSelect}
        onExit={onExit}
      />
    </div>
  );
};

export default OnboardingLayout;
