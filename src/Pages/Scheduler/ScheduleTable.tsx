import React from 'react';

interface Schedule {
  name: string;
  channels: string[];
  frequencies: string[];
  format: string;
  location: string;
  isActive: boolean;
}

const ToggleSwitch = ({
  isActive,
  onChange,
}: {
  isActive: boolean;
  onChange: () => void;
}) => (
  <button
    onClick={onChange}
    className={`relative inline-flex h-6 w-11 items-center rounded-full ${
      isActive ? 'bg-blue-600' : 'bg-gray-200'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${
        isActive ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

const ScheduleTable = () => {
  const schedules: Schedule[] = [
    {
      name: 'Tech Reviews',
      channels: ['MKBHD', 'LinusTechTips', 'Unbox Therapy', 'Tech Insider'],
      frequencies: ['Every hour', 'Every 6 hours', 'Daily'],
      format: '1080p',
      location: 'C:\\Users\\Downloads\\',
      isActive: true,
    },
    {
      name: 'Gaming News',
      channels: ['IGN', 'GameSpot', 'Polygon', 'Kotaku'],
      frequencies: ['Daily'],
      format: '780p',
      location: 'C:\\Users\\Downloads\\',
      isActive: false,
    },
  ];

  return (
    <div className="w-full">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="p-4 text-left">Schedule Name</th>
            <th className="p-4 text-left">Channels</th>
            <th className="p-4 text-left">Frequencies</th>
            <th className="p-4 text-left">Format</th>
            <th className="p-4 text-left">Location</th>
            <th className="p-4 text-left">Actions</th>
          </tr>
        </thead>
      </table>
    </div>
  );
};

export default ScheduleTable;
