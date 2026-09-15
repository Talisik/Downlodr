import React from 'react';
import { OnboardingFeature } from '../types/onboardingTypes';

const TOUR_CARDS: {
  id: OnboardingFeature;
  emoji: string;
  title: string;
  summary: string;
}[] = [
  {
    id: OnboardingFeature.VideoDownload,
    emoji: '⬇️',
    title: 'Download a video',
    summary: 'Paste a link and save any video in a few clicks.',
  },
  {
    id: OnboardingFeature.YtChannel,
    emoji: '🔔',
    title: 'Subscribe to a channel',
    summary: 'Auto-download new uploads from channels and playlists.',
  },
  {
    id: OnboardingFeature.AfdaSingle,
    emoji: '📄',
    title: 'Download an article',
    summary: 'Save web articles and read them in a clean built-in reader.',
  },
  {
    id: OnboardingFeature.AfdaSubscription,
    emoji: '📰',
    title: 'Subscribe to an article website',
    summary: 'Auto-download new articles from news sites and blogs.',
  },
  // {
  //   id: OnboardingFeature.SmartOrganize,
  //   emoji: '🗂️',
  //   title: 'Smart Organize',
  //   summary: 'Auto-sort your library into categories — all on-device.',
  // },
];

interface TourPickerModalProps {
  onSelect: (feature: OnboardingFeature) => void;
  onSkip: () => void;
}

const TourPickerModal: React.FC<TourPickerModalProps> = ({
  onSelect,
  onSkip,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/60">
      <div className="bg-[#F5F5F5] dark:bg-darkMode border border-gray-200 dark:border-darkModeCompliment rounded-xl w-full max-w-md mx-4 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <p className="text-sm font-bold dark:text-gray-100">
            Welcome to Downlodr
          </p>
          <button
            onClick={onSkip}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none"
          >
            ×
          </button>
        </div>

        <p className="px-5 pb-4 text-[13px] text-gray-600 dark:text-gray-300">
          Here's what Downlodr can do. Pick a quick tour to get started — each
          one takes under a minute.
        </p>

        <div className="px-5 pb-4 flex flex-col gap-2">
          {TOUR_CARDS.map((card) => (
            <button
              key={card.id}
              onClick={() => onSelect(card.id)}
              className="group flex items-center gap-3 w-full text-left rounded-lg border border-gray-200 dark:border-darkModeCompliment bg-white dark:bg-darkModeTable px-3 py-3 hover:border-primary hover:bg-titleBar dark:hover:bg-darkModeCompliment transition-colors"
            >
              <span className="text-xl leading-none shrink-0">
                {card.emoji}
              </span>
              <span className="flex flex-col min-w-0">
                <span className="text-[13px] font-semibold dark:text-gray-200 group-hover:text-primary transition-colors">
                  {card.title}
                </span>
                <span className="text-[12px] text-gray-500 dark:text-gray-400 truncate">
                  {card.summary}
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="px-5 pb-5">
          <button
            onClick={onSkip}
            className="w-full text-center text-[12px] font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 py-1 transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
};

export default TourPickerModal;
