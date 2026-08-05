import React, { useEffect, useState } from 'react';
import { AiOutlineFileWord } from 'react-icons/ai';
import { IoMdDownload } from 'react-icons/io';
import { VscPlayCircle } from 'react-icons/vsc';
import DemoShell from '../shared/DemoShell';
import { DUMMY_ARTICLES, OnboardingFeature } from '../../types/onboardingTypes';

type FetchState = 'idle' | 'analyzing' | 'done';

interface Props {
  started: boolean;
  onReset: () => void;
}

const AfdaSingleDemo: React.FC<Props> = ({ started, onReset }) => {
  const [state, setState] = useState<FetchState>('idle');
  const article = DUMMY_ARTICLES[0];

  useEffect(() => {
    if (started && state === 'idle') {
      setState('analyzing');
      setTimeout(() => setState('done'), 1500);
    }
  }, [started, state]);

  const handleReset = () => {
    setState('idle');
    onReset();
  };

  return (
    <DemoShell
      featureKey={OnboardingFeature.AfdaSingle}
      badge="Article Fetcher Add-on"
      title="Download Any Article"
      subtitle="Paste an article URL in the toolbar — Article Fetcher extracts the full content into a clean, readable document."
    >
      {state === 'analyzing' && (
        <div className="flex items-center justify-center gap-2 h-16 rounded-lg border border-divider dark:border-darkModeCompliment bg-white dark:bg-darkModeTable text-xs text-gray-500 dark:text-gray-400">
          <span className="animate-spin text-primary">⟳</span>
          Analyzing article…
        </div>
      )}

      {state === 'done' && (
        <div className="rounded-lg border border-divider dark:border-darkModeCompliment bg-white dark:bg-darkModeTable overflow-hidden">
          <div className="flex items-center gap-3 px-3 py-2 border-b border-divider dark:border-darkModeTableBorder">
            <div className="h-9 w-16 bg-blue-50 dark:bg-blue-900/20 rounded flex items-center justify-center flex-shrink-0">
              <AiOutlineFileWord
                size={20}
                className="text-blue-600 dark:text-blue-400"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold dark:text-darkModeLight line-clamp-1">
                {article.title}
              </p>
              <p className="text-[11px] text-blue-600 dark:text-blue-400 truncate">
                {article.site}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <VscPlayCircle size={16} className="text-green-500" />
              <span className="text-[11px] text-green-500">Ready</span>
            </div>
          </div>
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              {article.date}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                DOCX
              </span>
              <IoMdDownload size={16} style={{ color: '#FF9800' }} />
            </div>
          </div>
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
          Click the download icon in the toolbar above to see Article Fetcher in action
        </div>
      )}
    </DemoShell>
  );
};

export default AfdaSingleDemo;
