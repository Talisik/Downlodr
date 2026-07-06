import React, { useEffect, useState } from 'react';
import { FiChevronRight } from 'react-icons/fi';
import { LuNewspaper } from 'react-icons/lu';
import { AiOutlineFileWord } from 'react-icons/ai';
import { VscPlayCircle } from 'react-icons/vsc';
import DemoShell from '../shared/DemoShell';
import {
  DUMMY_ARTICLES,
  DUMMY_SUBSCRIPTION_URL,
  OnboardingFeature,
} from '../../types/onboardingTypes';

type ScanState = 'idle' | 'scanning' | 'done';

interface Props {
  started: boolean;
  onReset: () => void;
}

const AfdaSubscriptionDemo: React.FC<Props> = ({ started, onReset }) => {
  const [state, setScanState] = useState<ScanState>('idle');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (started && state === 'idle') {
      setScanState('scanning');
      setTimeout(() => {
        setScanState('done');
        setTimeout(() => setExpanded(true), 300);
      }, 2000);
    }
  }, [started, state]);

  const handleReset = () => {
    setScanState('idle');
    setExpanded(false);
    onReset();
  };

  return (
    <DemoShell
      featureKey={OnboardingFeature.AfdaSubscription}
      badge="Article Fetcher Add-on"
      title="Subscribe to Any Website"
      subtitle="Paste a site URL in the toolbar — Article Fetcher automatically fetches new articles on your schedule."
    >
      {state === 'scanning' && (
        <div className="flex items-center justify-center gap-2 h-16 rounded-lg border border-divider dark:border-darkModeCompliment bg-white dark:bg-darkModeTable text-xs text-gray-500 dark:text-gray-400">
          <span className="animate-spin text-primary">⟳</span>
          Scanning website for articles…
        </div>
      )}

      {state === 'done' && (
        <div className="rounded-lg border border-divider dark:border-darkModeCompliment bg-white dark:bg-darkModeTable overflow-hidden">
          <div
            className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-darkModeHover transition-colors"
            onClick={() => setExpanded((e) => !e)}
          >
            <FiChevronRight
              size={15}
              className={`transition-transform duration-200 dark:text-gray-400 ${
                expanded ? 'rotate-90' : ''
              }`}
            />
            <div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <LuNewspaper
                size={16}
                className="text-blue-600 dark:text-blue-400"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold dark:text-darkModeLight line-clamp-1">
                  {DUMMY_SUBSCRIPTION_URL}
                </p>
                <span className="bg-primary rounded-xl px-2 py-0.5 text-white text-[10px] font-medium">
                  SUB
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {DUMMY_ARTICLES.length} articles · Last added{' '}
                {DUMMY_ARTICLES[0].date}
              </p>
            </div>
          </div>

          {expanded && (
            <div className="border-t border-divider dark:border-darkModeTableBorder divide-y divide-divider dark:divide-darkModeTableBorder">
              {DUMMY_ARTICLES.map((article, i) => (
                <div
                  key={article.id}
                  className="flex items-center gap-3 px-3 py-2 pl-12 bg-gray-50 dark:bg-darkModeDarkGray/40"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="h-9 w-16 bg-blue-50 dark:bg-blue-900/20 rounded flex items-center justify-center flex-shrink-0">
                    <AiOutlineFileWord
                      size={18}
                      className="text-blue-600 dark:text-blue-400"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold dark:text-darkModeLight line-clamp-1">
                      {article.title}
                    </p>
                    <p className="text-[11px] text-blue-600 dark:text-blue-400">
                      {article.site}
                    </p>
                  </div>
                  <VscPlayCircle
                    size={15}
                    className="text-green-500 flex-shrink-0"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {state === 'done' && (
        <div className="text-center mt-2">
          <button
            onClick={handleReset}
            className="text-xs text-primary hover:underline"
          >
            Reset demo
          </button>
        </div>
      )}

      {state === 'idle' && (
        <div className="flex items-center justify-center h-24 rounded-lg border border-dashed border-divider dark:border-darkModeCompliment text-xs text-gray-400 dark:text-gray-500">
          Click the download icon in the toolbar above to see Article Fetcher scan a site
        </div>
      )}
    </DemoShell>
  );
};

export default AfdaSubscriptionDemo;
