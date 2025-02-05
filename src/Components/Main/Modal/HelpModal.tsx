import React, { useState } from 'react';
import { IoMdClose } from 'react-icons/io';
import { IoChevronDownOutline } from 'react-icons/io5';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '../../SubComponents/shadcn/components/ui/tabs';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

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
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
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

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  // Determine default value based on current path
  const defaultTab = location.pathname.includes('guide')
    ? 'guide'
    : location.pathname.includes('common')
    ? 'common'
    : 'advanced';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-darkMode rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <h2 className="text-xl font-semibold dark:text-white">Help Guide</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <IoMdClose size={24} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-6">
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="dark:bg-gray-700">
              <TabsTrigger
                value="guide"
                className="dark:data-[state=active]:bg-gray-600 dark:text-gray-300"
              >
                Downloading Guide
              </TabsTrigger>
              <TabsTrigger
                value="common"
                className="dark:data-[state=active]:bg-gray-600 dark:text-gray-300"
              >
                Frequently Asked Questions
              </TabsTrigger>
              <TabsTrigger
                value="advanced"
                className="dark:data-[state=active]:bg-gray-600 dark:text-gray-300"
              >
                Troubleshooting & Advanced Tips
              </TabsTrigger>
            </TabsList>

            <TabsContent value="guide" className="mt-6">
              <div className="space-y-4">
                <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                  {/* First Accordion */}
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
                          Click on a row to view detailed information about your
                          download.
                        </li>
                        <li>
                          Your download logs will be saved for future reference
                          in the history.
                        </li>
                      </ul>
                    }
                  />
                </div>

                <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                  {/* Second Accordion */}
                  <AccordionSection
                    title="Pausing, Stopping and Starting downloads"
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
                          Click on a row to view detailed information about your
                          download.
                        </li>
                        <li>
                          Your download logs will be saved for future reference
                          in the history.
                        </li>
                      </ul>
                    }
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="common" className="mt-6">
              {/* Calendar View Help Content */}
              <div className="space-y-4">
                <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                  {/* First Accordion */}
                  <AccordionSection
                    title="What is History"
                    content={
                      <ul className="list-decimal pl-6 space-y-3 dark:text-gray-300 text-sm">
                        <li>
                          History is different from Finished Pages and
                          AllDownloads in a way that it only store logs of the
                          downloads and has no physical access to the donwload
                          stored in your drive
                        </li>
                      </ul>
                    }
                  />
                </div>

                <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                  {/* Second Accordion */}
                  <AccordionSection
                    title="How to view videos"
                    content={
                      <ul className="list-decimal pl-6 space-y-3 dark:text-gray-300 text-sm">
                        <li>right-click video row in all status pages</li>
                      </ul>
                    }
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="advanced" className="mt-6">
              {/* Table View Help Content */}
              <div className="space-y-4">
                <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                  {/* First Accordion */}
                  <AccordionSection
                    title="Download is stuck in initializing"
                    content={
                      <ul className="list-decimal pl-6 space-y-3 dark:text-gray-300 text-sm">
                        <li>Initializing</li>
                      </ul>
                    }
                  />
                </div>

                <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                  {/* First Accordion */}
                  <AccordionSection
                    title="Failed to delete video"
                    content={
                      <ul className="list-decimal pl-6 space-y-3 dark:text-gray-300 text-sm">
                        <li>Initializing</li>
                      </ul>
                    }
                  />
                </div>

                <div className="border dark:border-gray-700 rounded-lg overflow-hidden">
                  {/* Second Accordion */}
                  <AccordionSection
                    title="EPERM Error"
                    content={
                      <ul className="list-decimal pl-6 space-y-3 dark:text-gray-300 text-sm">
                        <li>allow admin access</li>
                      </ul>
                    }
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="py-2 px-6 border-t dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-2 py-2 bg-primary text-white rounded-md hover:black transition-colors"
          >
            Report Issue
          </button>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
