/**
 * A custom React component
 * Shows the Help modal for Downlodr, provides guide for using the Downlodr app as well as answers for commonly asked questions
 *
 * @param isOpen - If modal is open, keeps it open
 * @param onClose - If modal has been closed, closes modal
 * @returns JSX.Element - The rendered component displaying a AboutModal
 *
 */

import React, { useEffect, useRef, useState } from 'react';
import { IoMdClose } from 'react-icons/io';
import { IoChevronDownOutline } from 'react-icons/io5';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Accordion params and component
interface AccordionSectionProps {
  title: string;
  content: React.ReactNode;
}

const AccordionSection: React.FC<AccordionSectionProps> = ({
  title,
  content,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="w-full p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-darkModeHover/50 transition-colors"
      >
        <span className="text-md dark:text-gray-300">{title}</span>
        <IoChevronDownOutline
          className={`transform transition-transform duration-200 dark:text-gray-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? 'max-h-[1000px] p-4' : 'max-h-0'
        }`}
      >
        {content}
      </div>
    </div>
  );
};

// Help Modal
const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  const navRef = useRef<HTMLDivElement>(null);

  // Custom tab state management
  const [activeTab, setActiveTab] = useState<string>('guide');

  // Close Modal
  const handleClose = () => {
    onClose();
  };

  // Handle tab change
  const handleTabChange = (tabValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveTab(tabValue);
  };

  // Set initial tab based on URL path
  useEffect(() => {
    if (isOpen) {
      const defaultTab = location.pathname.includes('common')
        ? 'common'
        : location.pathname.includes('advanced')
        ? 'advanced'
        : 'guide';
      setActiveTab(defaultTab);
    }
  }, [isOpen]);

  // Handles event when user clicks outside modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        ref={navRef}
        className="dark:bg-darkModeDropdown bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-darkModeDropdown z-10">
          <h2 className="text-xl font-semibold dark:text-white pl-2 pt-1">
            Help Guide
          </h2>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <IoMdClose size={16} />
          </button>
        </div>

        <div
          className="px-6 py-4 space-y-6 dark:bg-darkModeDropdown"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Custom Tab Implementation */}
          <div className="w-full dark:bg-darkModeDropdown ">
            {/* Tab List */}
            <div className="dark:bg-darkModeBorderColor inline-flex h-8 items-center justify-center rounded-lg bg-tabs p-1 text-gray-500 dark:text-gray-400">
              <button
                onClick={(e) => handleTabChange('guide', e)}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg px-2 py-1 font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 ${
                  activeTab === 'guide'
                    ? 'dark:bg-darkModeCompliment bg-[#fcf0e3] text-gray-950 shadow-sm  dark:text-gray-50'
                    : 'dark:text-gray-300'
                }`}
              >
                Downloading Guide
              </button>
              <button
                onClick={(e) => handleTabChange('common', e)}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg px-2 py-1 font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 ${
                  activeTab === 'common'
                    ? 'dark:bg-darkModeCompliment bg-[#fcf0e3] text-gray-950 shadow-sm  dark:text-gray-50'
                    : 'dark:text-gray-300'
                }`}
              >
                Frequently Asked Questions
              </button>
              <button
                onClick={(e) => handleTabChange('advanced', e)}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg px-2 py-1 font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-950 focus-visible:ring-offset-2 ${
                  activeTab === 'advanced'
                    ? 'dark:bg-darkModeCompliment bg-[#fcf0e3] text-gray-950 shadow-sm  dark:text-gray-50'
                    : 'dark:text-gray-300'
                }`}
              >
                Troubleshooting & Advanced Tips
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'guide' && (
              <div className="mt-6">
                <div className="space-y-4">
                  <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                    <AccordionSection
                      title="Download Steps"
                      content={
                        <ul className="list-decimal pl-6 space-y-3 dark:text-gray-300 text-sm">
                          <li>Open the "Add URL" section.</li>
                          <li>
                            Paste a valid video URL and select the download
                            destination.
                          </li>
                          <li>Click the "Download" button.</li>
                          <li>
                            Navigate to the "Downloading" or "All Downloads"
                            status page.
                          </li>
                          <li>Wait for the video metadata to be processed.</li>
                          <li>
                            Once ready, click the play button in the status
                            section.
                          </li>
                          <li>Allow the download to finish.</li>
                          <li>
                            After completion, right-click on the entry for
                            additional options. You can:
                          </li>
                          <ul className="list-inside list-disc pl-4 space-y-1 dark:text-gray-300 text-sm">
                            <li>View the download details</li>
                            <li>Open the download folder</li>
                            <li>Delete the download</li>
                            <li>Adjust tags and categories</li>
                          </ul>
                          <li>
                            Click on a row to view detailed information about
                            your download.
                          </li>
                          <li>
                            Your download logs will be saved for future
                            reference in the history.
                          </li>
                        </ul>
                      }
                    />
                  </div>

                  <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                    <AccordionSection
                      title="Pausing, Stopping, Removing and Starting downloads"
                      content={
                        <ul className="list-decimal pl-6 space-y-3 dark:text-gray-300 text-sm">
                          <li>
                            Each download has control buttons on the status
                            columns and the context menu
                          </li>
                          <ul className="list-inside list-disc pl-4 space-y-1 dark:text-gray-300 text-sm">
                            <li>
                              Play button (▶️) - Starts or resumes the download
                            </li>
                            <li>
                              Pause button (⏸️) - Temporarily pauses the
                              download
                            </li>
                            <li>
                              Stop button (⏹️) - Completely stops and removes
                              the download
                            </li>
                          </ul>
                          <li>
                            Download control buttons are also available within
                            the task bar and task dropdown
                          </li>
                          <ul className="list-inside list-disc pl-4 space-y-1 dark:text-gray-300 text-sm">
                            <li>
                              Users would able to select multiple downloads to
                              either play or stop
                            </li>
                            <li>
                              Users may also simply use the all option, to
                              control all currently downloading videos
                            </li>
                          </ul>
                          <li>Removing Downloads</li>
                          <ul className="list-inside list-disc pl-4 space-y-1 dark:text-gray-300 text-sm">
                            <li>
                              Removing downloads affects currently finished
                              downloads. This action deletes the downloaded file
                              from your device's drive and removes the download
                              record from the app's history.
                            </li>
                            <li>
                              For pending downloads, only the download record is
                              saved; no file has been saved to the drive yet.
                            </li>
                          </ul>
                        </ul>
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'common' && (
              <div className="mt-6">
                <div className="space-y-4">
                  <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                    <AccordionSection
                      title="What is History"
                      content={
                        <ul className="list-disc pl-6 space-y-3 dark:text-gray-300 text-sm">
                          <li>
                            History is a record of all your past downloads
                          </li>
                          <li>Unlike status pages, History:</li>
                          <ul className="list-inside list-disc pl-4 space-y-1 dark:text-gray-300 text-sm">
                            <li>Doesn't show download progress or controls</li>
                            <li>Only keeps track of what you've downloaded</li>
                            <li>Shows if files still exist on your device</li>
                          </ul>
                          <li>
                            You can use History to redownload videos or check
                            your past downloads
                          </li>
                        </ul>
                      }
                    />
                  </div>

                  <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                    <AccordionSection
                      title="How to view videos"
                      content={
                        <ul className="list-disc pl-6 space-y-3 dark:text-gray-300 text-sm">
                          <li>
                            Right-click video row in status pages to open
                            context menu and access the video view from there
                          </li>
                        </ul>
                      }
                    />
                  </div>

                  <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                    <AccordionSection
                      title="How to use context menus"
                      content={
                        <ul className="list-disc pl-6 space-y-3 dark:text-gray-300 text-sm">
                          <li>
                            Right-click any download to access additional
                            options:
                          </li>
                          <ul className="list-inside list-disc pl-4 space-y-1 dark:text-gray-300 text-sm">
                            <li>View downloaded video</li>
                            <li>Open containing folder</li>
                            <li>Control download status</li>
                            <li>Remove from list</li>
                          </ul>
                        </ul>
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'advanced' && (
              <div className="mt-6">
                <div className="space-y-4">
                  <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                    <AccordionSection
                      title="Download is stuck in initializing"
                      content={
                        <ul className="list-disc pl-6 space-y-3 dark:text-gray-300 text-sm">
                          <li>Check your internet connection</li>
                          <li>Verify the video URL is still valid</li>
                          <li>
                            Restart the download:
                            <ul className="list-inside list-disc pl-4 space-y-1 dark:text-gray-300 text-sm">
                              <li>Pause Download</li>
                              <li>
                                Go to folder and delete any lingering part file
                              </li>
                              <li>Resume download</li>
                            </ul>
                          </li>
                        </ul>
                      }
                    />
                  </div>

                  <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                    <AccordionSection
                      title="Failed to delete video"
                      content={
                        <ul className="list-disc pl-6 space-y-3 dark:text-gray-300 text-sm">
                          <li>If you can't delete a video:</li>
                          <ul className="list-inside list-disc pl-4 space-y-1 dark:text-gray-300 text-sm">
                            <li>Close any applications using the video file</li>
                            <li>Restart the application</li>
                            <li>
                              Check if you have permission to delete files in
                              that location
                            </li>
                          </ul>
                        </ul>
                      }
                    />
                  </div>

                  <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                    <AccordionSection
                      title="Download speed is slow"
                      content={
                        <ul className="list-disc pl-6 space-y-3 dark:text-gray-300 text-sm">
                          <li>To improve download speed:</li>
                          <ul className="list-inside list-disc pl-4 space-y-1 dark:text-gray-300 text-sm">
                            <li>Check your internet connection</li>
                            <li>Reduce number of simultaneous downloads</li>
                            <li>Adjust speed limit in settings if enabled</li>
                          </ul>
                        </ul>
                      }
                    />
                  </div>

                  <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                    <AccordionSection
                      title="Permission (EPERM) errors"
                      content={
                        <ul className="list-disc pl-6 space-y-3 dark:text-gray-300 text-sm">
                          <li>If you see permission errors:</li>
                          <ul className="list-inside list-disc pl-4 space-y-1 dark:text-gray-300 text-sm">
                            <li>Run the application as administrator</li>
                            <li>Check folder permissions</li>
                            <li>Choose a different download location</li>
                          </ul>
                        </ul>
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="py-2 px-6 border-t dark:border-gray-700"></div>
      </div>
    </div>
  );
};

export default HelpModal;
