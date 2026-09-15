import React, { useState } from 'react';
import TranscriptModal from './TranscriptModal';
import TooltipWrapper from '../../core-app/components/wrapper/TooltipWrapper';
import { FaArrowsToEye } from 'react-icons/fa6';
import { BsChatLeftText, BsChatRightText } from 'react-icons/bs';
import { LuNotebookPen } from 'react-icons/lu';

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface TabInterfaceProps {
  tabs: Tab[];
  defaultActiveTab?: string;
  className?: string;
  tabClassName?: string;
  contentClassName?: string;
  transcriptLocation?: string;
  videoTitle?: string;
}

const TabInterface: React.FC<TabInterfaceProps> = ({
  tabs,
  defaultActiveTab,
  className = '',
  tabClassName = '',
  contentClassName = '',
  transcriptLocation,
  videoTitle,
}) => {
  const [activeTab, setActiveTab] = useState(
    defaultActiveTab || tabs[0]?.id || '',
  );
  const [isTranscriptModalOpen, setIsTranscriptModalOpen] = useState(false);

  const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content;

  return (
    <div className={`w-full gap-2 bg-[#F2F2F2] dark:bg-[#333333] ${className}`}>
      {/* Tab Headers */}
      <div className="flex items-center justify-between mt-1 pb-2 flex-shrink-0">
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-1 py-1 text-[10px] font-medium transition-colors duration-200 border-b-2 ml-1 dark:text-[#F2F2F2] ${
                activeTab === tab.id
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              } ${tabClassName}`}
            >
              <div className="flex items-center gap-2">
                {tab.id === 'transcript' ? (
                  <>
                    <BsChatLeftText size={12} />
                  </>
                ) : (
                  <>
                    <LuNotebookPen size={12} />
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
        <div>
          <TooltipWrapper content="View Full Transcription" side="bottom">
            <button
              onClick={() => setIsTranscriptModalOpen(true)}
              className={`text-xxxs font-semibold transition-colors duration-200 mr-2 ${
                transcriptLocation
                  ? 'hover:text-primary/80 cursor-pointer'
                  : 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
              }`}
              disabled={!transcriptLocation}
            >
              <FaArrowsToEye size={14} />
            </button>
          </TooltipWrapper>
        </div>
      </div>

      {/* Tab Content */}
      <div className={`bg-white dark:bg-darkModeCompliment ${contentClassName}`}>
        {activeTabContent}
      </div>

      {/* Transcript Modal */}
      <TranscriptModal
        isOpen={isTranscriptModalOpen}
        onClose={() => setIsTranscriptModalOpen(false)}
        transcriptLocation={transcriptLocation}
        videoTitle={videoTitle}
      />
    </div>
  );
};

export default TabInterface;
