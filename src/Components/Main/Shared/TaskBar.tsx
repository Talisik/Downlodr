import React, { useState } from 'react';
import { GoDownload } from 'react-icons/go';
import { VscPlayCircle } from 'react-icons/vsc';
import { PiStopCircle } from 'react-icons/pi';
import DownloadModal from '../Modal/DownloadModal';
import { useLocation, NavLink } from 'react-router-dom';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '../../SubComponents/shadcn/components/ui/tabs';
import { RiTable3, RiCalendarLine } from 'react-icons/ri';
import SchedulerModal from '../Modal/SchedulerModal';
import useDownloadStore from '../../../Store/downloadStore';
import { useMainStore } from '../../../Store/mainStore';
import { useToast } from '../../SubComponents/shadcn/hooks/use-toast';

interface TaskBarProps {
  className?: string;
}

const TaskBar: React.FC<TaskBarProps> = ({ className }) => {
  const [isDownloadModalOpen, setDownloadModalOpen] = useState(false);
  const [isSchedulerModalOpen, setSchedulerModalOpen] = useState(false);
  const location = useLocation();
  const { toast } = useToast();

  // Get the max download limit and current downloads from stores
  const { settings } = useMainStore();
  const { downloading } = useDownloadStore();
  const selectedDownloads = useMainStore((state) => state.selectedDownloads);
  const clearSelectedDownloads = useMainStore(
    (state) => state.clearSelectedDownloads,
  );
  const clearSelectedRows = useMainStore((state) => state.clearSelectedRows);

  const handleStopAll = async () => {
    console.log('Stopping all downloads');
    const { deleteDownloading } = useDownloadStore.getState();

    if (downloading && downloading.length > 0) {
      for (const download of downloading) {
        console.log(`Attempting to stop download: ${download.id}`);

        if (download.controllerId) {
          try {
            const success = await window.ytdlp.killController(
              download.controllerId,
            );
            if (success) {
              deleteDownloading(download.id);
              console.log(
                `Controller with ID ${download.controllerId} has been terminated.`,
              );
            } else {
              toast({
                variant: 'destructive',
                title: 'Stop Download Error',
                description: `Could not stop current download with controller ${download.controllerId}`,
              });
              // setCurrentDownloadId(download.id);
            }
          } catch (error) {
            toast({
              variant: 'destructive',
              title: 'Stop Download Error',
              description: `Could not stop current download with controller ${download.controllerId}`,
            });
          }
        } else {
          toast({
            variant: 'destructive',
            title: 'Stop Download Error',
            description: `Could not stop current download with controller ${download.controllerId}`,
          });
        }
      }
      // Clear selected downloads after stopping all
      // setSelectedDownloading([]);
    } else {
      toast({
        variant: 'destructive',
        title: 'No Downloads Found',
        description: `No current downloads to delete`,
      });
    }
    // setSelectedDownloading([]);
  };

  const handleStopSelected = async () => {
    if (selectedDownloads.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Downloads Selected',
        description: 'Please select downloads to stop',
      });
      return;
    }

    // Store selected downloads in a temporary variable and clear selections immediately
    const downloadsToStop = [...selectedDownloads];
    clearSelectedDownloads();
    clearSelectedRows();

    const { deleteDownloading } = useDownloadStore.getState();

    for (const download of downloadsToStop) {
      if (download.controllerId) {
        try {
          const success = await window.ytdlp.killController(
            download.controllerId,
          );
          if (success) {
            deleteDownloading(download.id);
            console.log(
              `Controller with ID ${download.controllerId} has been terminated.`,
            );
          } else {
            toast({
              variant: 'destructive',
              title: 'Stop Download Error',
              description: `Could not stop download with controller ${download.controllerId}`,
            });
          }
        } catch (error) {
          toast({
            variant: 'destructive',
            title: 'Stop Download Error',
            description: `Error stopping download with controller ${download.controllerId}`,
          });
        }
      }
    }
  };

  const isSchedulePage = ['/scheduleTable', '/scheduleCalendar'].includes(
    location.pathname,
  );

  // Determine default value based on current path
  const defaultTab = location.pathname.includes('Calendar')
    ? 'calendar'
    : 'table';

  const handleOpenDownloadModal = () => {
    // Check if connection limits are enabled
    if (settings.permitConnectionLimit) {
      // Check if current downloads are at or above the limit
      if (downloading.length >= settings.maxDownloadNum) {
        toast({
          variant: 'destructive',
          title: 'Download limit reached',
          description: `Maximum download limit (${settings.maxDownloadNum}) reached. Please wait for current downloads to complete.`,
        });
        return;
      }
    }

    // If we pass the checks, open the modal
    setDownloadModalOpen(true);
  };

  return (
    <>
      <div className={`${className} flex items-center justify-between`}>
        <div className="flex items-center h-full px-4 space-x-2">
          <button
            className="primary-custom-btn px-[6px] py-[8px] sm:px-[8px] sm:py-[8px] mr-2 sm:mr-4 flex items-center gap-1 sm:gap-2 text-sm sm:text-sm whitespace-nowrap dark:hover:text-black dark:hover:bg-white"
            onClick={handleOpenDownloadModal}
          >
            <GoDownload size={12} className="sm:w-[14px] sm:h-[14px]" />
            <span className="hidden sm:inline">Add URL</span>
            <span className="sm:hidden"> Add URL</span>
          </button>
          <button className="hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-1 rounded flex gap-1 font-semibold dark:text-gray-200">
            {' '}
            <VscPlayCircle size={18} className="mt-[0.9px]" /> Play
          </button>

          <button
            className="hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-1 rounded flex gap-1 font-semibold dark:text-gray-200"
            onClick={handleStopSelected}
          >
            <PiStopCircle size={18} className="mt-[0.9px]" /> Stop
            {/*{selectedDownloads.length > 0 && ` (${selectedDownloads.length})`}*/}
          </button>
          <button
            className="hover:bg-gray-100 dark:hover:bg-gray-700 px-3 py-1 rounded flex gap-1 font-semibold dark:text-gray-200"
            onClick={() => handleStopAll()}
          >
            {' '}
            <PiStopCircle size={18} className="mt-[0.9px]" /> Stop All
          </button>
        </div>
        {/* Right side button */}
        {isSchedulePage && (
          <Tabs defaultValue={defaultTab} className="w-[100px]">
            <TabsList className="dark:bg-gray-700">
              <TabsTrigger
                value="table"
                asChild
                className="dark:data-[state=active]:bg-gray-600 dark:text-gray-200"
              >
                <NavLink to="/scheduleTable" className="w-full">
                  <RiTable3 size={18} />
                </NavLink>
              </TabsTrigger>
              <TabsTrigger
                value="calendar"
                asChild
                className="dark:data-[state=active]:bg-gray-600 dark:text-gray-200"
              >
                <NavLink to="/scheduleCalendar" className="w-full">
                  <RiCalendarLine size={18} />
                </NavLink>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      <SchedulerModal
        isOpen={isSchedulerModalOpen}
        onClose={() => setSchedulerModalOpen(false)}
      />
      <DownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
      />
    </>
  );
};

export default TaskBar;
