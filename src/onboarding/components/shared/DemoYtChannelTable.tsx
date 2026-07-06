import React, { useEffect, useRef, useState } from 'react';
import { BsHourglassSplit } from 'react-icons/bs';
import { FaCircle, FaRegTimesCircle, FaYoutube } from 'react-icons/fa';
import { FaPlus } from 'react-icons/fa6';
import { FiCalendar, FiChevronDown, FiChevronRight, FiFolder, FiSearch } from 'react-icons/fi';
import { HiChevronUpDown } from 'react-icons/hi2';
import { LuClock4, LuHardDrive, LuHistory } from 'react-icons/lu';
import { MdPlayArrow, MdSubscriptions } from 'react-icons/md';
import { PiPauseBold } from 'react-icons/pi';
import { TbSortAscendingLetters } from 'react-icons/tb';
import { DUMMY_CHANNEL } from '../../types/onboardingTypes';
import DemoSubscribeModal from './DemoSubscribeModal';

interface DemoYtChannelTableProps {
  onInteraction?: () => void;
  onAnalyzed?: () => void;
  onCompleted?: () => void;
  onReset: () => void;
}

const NAV_ITEMS = [
  { label: 'Subscriptions', icon: MdSubscriptions, active: true },
  { label: 'Scheduled', icon: FiCalendar, active: false },
  { label: 'History', icon: LuHistory, active: false },
] as const;

const STATUS_ITEMS = [
  { label: 'All', Icon: FiFolder, color: 'text-primary', active: true },
  { label: 'Active', Icon: MdPlayArrow, color: 'text-green-500', active: false },
  { label: 'Paused', Icon: PiPauseBold, color: 'text-amber-500', active: false },
  { label: 'Needs Attention', Icon: BsHourglassSplit, color: 'text-amber-600', active: false },
  { label: 'Error', Icon: FaRegTimesCircle, color: 'text-red-500', active: false },
] as const;

const DemoYtChannelTable: React.FC<DemoYtChannelTableProps> = ({
  onInteraction,
  onAnalyzed,
  onCompleted,
  onReset,
}) => {
  const [channelState, setChannelState] = useState<'idle' | 'resolving' | 'done'>('idle');
  const [subscribeModalOpen, setSubscribeModalOpen] = useState(false);
  const channelDoneCalledRef = useRef(false);

  useEffect(() => {
    if (channelState === 'done' && !channelDoneCalledRef.current) {
      channelDoneCalledRef.current = true;
      onCompleted?.();
    }
    if (channelState !== 'done') channelDoneCalledRef.current = false;
  }, [channelState]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReset = () => {
    setChannelState('idle');
    setSubscribeModalOpen(false);
    channelDoneCalledRef.current = false;
    onReset();
  };

  const handleChannelSubscribe = () => {
    if (channelState === 'idle') {
      setChannelState('resolving');
      setTimeout(() => setChannelState('done'), 1500);
    }
  };

  const channelUrl = `https://www.youtube.com/@${DUMMY_CHANNEL.name.replace(/\s+/g, '')}`;

  return (
    <div className="flex flex-1 overflow-hidden min-w-0">
      {/* Left sidebar — mirrors SkedulosaNavigation */}
      <div className="w-[205px] flex-shrink-0 bg-white dark:bg-darkModeTable border-r border-gray-100 dark:border-darkModeTableBorder overflow-y-auto overflow-x-hidden relative">
        <div className="py-2 px-3 mt-7 flex flex-col gap-3">

          {/* Main nav links */}
          <div className="flex flex-col gap-2">
            {NAV_ITEMS.map(({ label, icon: Icon, active }) => (
              <button
                key={label}
                className={`flex flex-nowrap items-center h-7 rounded dark:text-gray-200 cursor-default w-full ${
                  active ? 'bg-titleBar dark:bg-[#3D3D3D]' : ''
                }`}
              >
                <span className="flex items-center justify-center w-[46px] flex-shrink-0">
                  <Icon size={16} className="text-primary" />
                </span>
                <span className="text-[12px] whitespace-nowrap overflow-hidden min-w-0">{label}</span>
              </button>
            ))}
          </div>

          {/* Status section */}
          <div>
            <button className="w-full flex items-center h-7 rounded dark:text-gray-200 cursor-default">
              <span className="flex items-center gap-1 whitespace-nowrap overflow-hidden min-w-0 pl-1">
                <FiChevronDown size={16} className="flex-shrink-0" />
                <span className="text-sm font-semibold">Status</span>
              </span>
            </button>
            <div className="flex flex-col gap-[6px]">
              {STATUS_ITEMS.map(({ label, Icon, color, active }) => (
                <button
                  key={label}
                  className={`flex flex-nowrap items-center h-7 w-full rounded dark:text-gray-200 cursor-default ${
                    active ? 'bg-titleBar dark:bg-[#3D3D3D]' : ''
                  }`}
                >
                  <span className="flex items-center justify-center w-[46px] flex-shrink-0">
                    <Icon size={16} className={color} />
                  </span>
                  <span className="text-[12px] whitespace-nowrap overflow-hidden min-w-0">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Categories section (collapsed) */}
          <div>
            <button className="w-full flex items-center h-7 rounded dark:text-gray-200 cursor-default">
              <span className="flex items-center gap-1 whitespace-nowrap overflow-hidden min-w-0 pl-1">
                <FiChevronRight size={16} className="flex-shrink-0" />
                <span className="text-sm font-semibold">Categories</span>
              </span>
            </button>
          </div>
        </div>

        {/* Reset button */}
        {channelState === 'done' && (
          <div className="absolute bottom-3 right-3">
            <button onClick={handleReset} className="text-[10px] text-primary hover:underline">
              Reset
            </button>
          </div>
        )}
      </div>

      {/* Right: main content */}
      <div className="flex-1 overflow-hidden flex flex-col min-w-0">
        {/* Taskbar — mirrors SkedulosaTableTaskbar */}
        <div className="flex-shrink-0 flex items-center justify-between w-full px-2 py-2 pl-[8px] bg-[#F9F9F9] dark:bg-darkMode">
          {channelState === 'done' ? (
            <div className="flex flex-row gap-4 text-[12px] px-2">
              <div className="flex flex-row gap-1 items-center">
                <LuHardDrive size={13} className="text-gray-500" />
                <span className="font-bold dark:text-gray-200">1</span>
                <span className="text-gray-500 dark:text-gray-400">today /</span>
                <span className="font-bold text-primary">{DUMMY_CHANNEL.videos.length}</span>
                <span className="text-gray-500 dark:text-gray-400">this week</span>
              </div>
              <div className="flex flex-row gap-1 items-center">
                <LuHardDrive size={13} className="text-gray-500" />
                <span className="font-bold dark:text-gray-200">120 MB</span>
                <span className="text-gray-500 dark:text-gray-400">used</span>
              </div>
              <div className="flex flex-row gap-1 items-center">
                <LuClock4 size={13} className="text-gray-500" />
                <span className="text-gray-500 dark:text-gray-400">Next check in</span>
                <span className="font-bold dark:text-gray-200">Sat 12:00 AM</span>
              </div>
            </div>
          ) : (
            <div className="text-[12px] px-2 text-gray-400 dark:text-gray-500">
              0 subscriptions
            </div>
          )}
          <div className="flex flex-row gap-1 items-center">
            <button className="p-1.5 rounded text-gray-400 dark:text-gray-500 cursor-default">
              <FiSearch size={14} />
            </button>
            <button className="p-1.5 rounded text-gray-400 dark:text-gray-500 cursor-default">
              <TbSortAscendingLetters size={14} />
            </button>
            {channelState === 'done' ? (
              <button className="flex items-center justify-center gap-1 bg-primary text-white px-4 py-1 rounded-md text-[12px] opacity-50 cursor-default">
                <FaPlus size={11} />
                Subscribe
              </button>
            ) : (
              <button
                id="demo-subscribe-btn"
                onClick={() => {
                  setSubscribeModalOpen(true);
                  setTimeout(() => onInteraction?.(), 50);
                }}
                disabled={channelState !== 'idle'}
                className={`flex items-center justify-center gap-1 px-4 py-1 rounded-md text-[12px] transition-colors ${
                  channelState === 'idle'
                    ? 'bg-primary text-white hover:opacity-90 cursor-pointer'
                    : 'bg-primary/50 text-white cursor-not-allowed'
                }`}
              >
                <FaPlus size={11} />
                Subscribe
              </button>
            )}
          </div>
        </div>

        {/* Empty state */}
        {channelState === 'idle' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
            <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
              <FaYoutube size={32} className="text-red-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">No subscriptions yet</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-[280px]">
                Subscribe to a YouTube channel to automatically download new videos as they're published
              </p>
            </div>
          </div>
        )}

        {/* Resolving spinner */}
        {channelState === 'resolving' && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="animate-spin text-primary text-base leading-none">⟳</span>
              Resolving channel…
            </div>
          </div>
        )}

        {/* Subscription table */}
        {channelState === 'done' && (
          <div className="flex-1 overflow-auto min-w-0">
            <table className="w-full">
              <thead>
                <tr className="sticky top-0 z-10">
                  <th className="bg-toggleGroupBaseColor dark:bg-darkModeCompliment" style={{ width: 44, minWidth: 44 }}>
                    <div className="flex items-center justify-end pr-2 py-2">
                      <div className="w-[18px] h-[18px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-transparent opacity-40" />
                    </div>
                  </th>
                  {[
                    { id: 'subscription', label: 'Subscription', width: 220 },
                    { id: 'status', label: 'Status', width: 100 },
                    { id: 'checked', label: 'Checked', width: 120 },
                    { id: 'downloads', label: 'Downloads', width: 110 },
                    { id: 'source', label: 'Source', width: 110 },
                    { id: 'storage', label: 'Storage', width: 110 },
                  ].map((col) => (
                    <th
                      key={col.id}
                      className="bg-toggleGroupBaseColor dark:bg-darkModeCompliment"
                      style={{ width: col.width }}
                    >
                      <div className="flex flex-row gap-1 items-center justify-start font-semibold text-[13.5px] py-2 px-4 dark:text-gray-200">
                        <span>{col.label}</span>
                        <HiChevronUpDown size={14} className="flex-shrink-0 text-gray-400" />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr
                  id="demo-new-sub-row"
                  className="bg-gray-50 dark:bg-darkMode hover:bg-gray-100 dark:hover:bg-darkModeCompliment/50 cursor-pointer"
                >
                  <td style={{ width: 44, minWidth: 44 }}>
                    <div className="flex items-center justify-end pr-2 py-3">
                      <div className="w-[18px] h-[18px] rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-transparent" />
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ width: 220 }}>
                    <div className="flex flex-row gap-2 items-center">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">{DUMMY_CHANNEL.name[0]}</span>
                      </div>
                      <div className="min-w-0 flex flex-col">
                        <span className="font-semibold text-[13px] text-gray-900 dark:text-gray-100 truncate">
                          {DUMMY_CHANNEL.name}
                        </span>
                        <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                          {channelUrl}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ width: 100 }}>
                    <div className="flex flex-row gap-2 items-center text-[13px]">
                      <FaCircle size={8} className="text-green-500 flex-shrink-0" />
                      <span className="text-green-600 dark:text-green-400 font-medium">Active</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-gray-600 dark:text-gray-300" style={{ width: 120 }}>
                    just now
                  </td>
                  <td className="px-4 py-3 text-[13px] text-gray-600 dark:text-gray-300 font-medium" style={{ width: 110 }}>
                    {DUMMY_CHANNEL.videos.length}
                  </td>
                  <td className="px-4 py-3" style={{ width: 110 }}>
                    <div className="flex items-center gap-1.5 text-[13px] text-gray-600 dark:text-gray-300">
                      <FaYoutube size={14} className="text-red-500 flex-shrink-0" />
                      <span>YouTube</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-gray-600 dark:text-gray-300" style={{ width: 110 }}>
                    120 MB
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DemoSubscribeModal
        isOpen={subscribeModalOpen}
        onClose={() => setSubscribeModalOpen(false)}
        onSubscribe={handleChannelSubscribe}
        onAnalyzed={onAnalyzed}
        variant="youtube"
      />
    </div>
  );
};

export default DemoYtChannelTable;
