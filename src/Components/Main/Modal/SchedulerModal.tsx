/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { IoMdClose } from 'react-icons/io';
import { FiUpload } from 'react-icons/fi';

interface SchedulerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ScheduleDay {
  dayDisplayName: string;
  dayVal: string;
}

interface ScheduleFrequency {
  dayDisplayName: string;
  dayVal: string;
}

const SchedulerModal: React.FC<SchedulerModalProps> = ({ isOpen, onClose }) => {
  // Form submission
  const [scheduleName, setScheduleName] = useState('');
  const [scheduleDay, setScheduleDay] = useState('');
  const [scheduleDayVal, setScheduleDayVal] = useState('');
  const [channelUrls, setChannelUrls] = useState('');

  const [scheduleFrequency, setScheduleFrequency] = useState('');
  const [scheduleFrequencVal, setScheduleFrequencVal] = useState('');
  const resetSchedulerModal = () => {
    // reset everything
  };

  // Close Modal
  const handleClose = () => {
    resetSchedulerModal();
    onClose();
  };

  const dayOptions = [
    { dayDisplayName: 'Monday', dayVal: '1' },
    { dayDisplayName: 'Tuesday', dayVal: '2' },
    { dayDisplayName: 'Wednesday', dayVal: '3' },
    { dayDisplayName: 'Thursday', dayVal: '4' },
    { dayDisplayName: 'Friday', dayVal: '5' },
    { dayDisplayName: 'Saturday', dayVal: '6' },
    { dayDisplayName: 'Sunday', dayVal: '7' },
  ];

  const frequencyOptions = [
    { frequencyDisplayName: '7:00am', frequencyVal: '1' },
    { frequencyDisplayName: '7:30am', frequencyVal: '2' },
    { frequencyDisplayName: '8:00am', frequencyVal: '3' },
    { frequencyDisplayName: '8:30am', frequencyVal: '4' },
    { frequencyDisplayName: '9:00am', frequencyVal: '5' },
    { frequencyDisplayName: '9:30am', frequencyVal: '6' },
    { frequencyDisplayName: '10:00am', frequencyVal: '7' },
  ];

  // Move conditional return here, after hooks but before render
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center h-full">
      <div className="bg-white rounded-lg pt-6 pr-6 pl-6 pb-4 max-w-xl w-full mx-4">
        {/* Left side - Form */}
        <div className="w-full">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Create New Schedule</h2>
            <button
              onClick={handleClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <IoMdClose size={16} />
            </button>
          </div>

          <form onSubmit={(e) => e.preventDefault()}>
            {/* Schedule Name */}
            <div className="space-y-4">
              <div>
                <label className="block mb-2">Schedule Name</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g Tech Daily News"
                    value={scheduleName}
                    onChange={(e) => setScheduleName(e.target.value)}
                    className="flex-1 border rounded-md px-3 py-2"
                  />
                </div>
              </div>
              {/* End of Schedule Name */}
              {/* Uploud Button */}
              <div className="space-y-4 flex justify-end">
                <div className="flex gap-3">
                  <a
                    href="https://www.w3schools.com/"
                    target="_blank"
                    className="mt-2 text-xs underline underline-offset-2 text-primary"
                  >
                    CSV Format
                  </a>
                  <button className="bg-secondary text-white px-2 py-2 rounded-md text-sm hover:bg-orange-600">
                    <div className="flex items-center gap-2">
                      <FiUpload size={14} />
                      <span>Upload CSV</span>
                    </div>
                  </button>
                </div>
              </div>
              {/* End of Uploud Button */}
              {/* Schedule Name */}
              <div className="flex gap-4 pt-4">
                <div className="flex-1">
                  <label className="block mb-2">Name</label>
                  <input
                    type="text"
                    placeholder="Name"
                    value={channelUrls}
                    onChange={(e) => setChannelUrls(e.target.value)}
                    className="w-full border rounded-md px-3 py-2"
                  />
                </div>

                <div className="">
                  <label className="block mb-2">Day</label>
                  <select
                    value={scheduleDay}
                    onChange={(e) => {
                      setScheduleDay(e.target.value);
                      const selectedDay = dayOptions.find(
                        (day) => day.dayDisplayName === e.target.value,
                      );
                      if (selectedDay) {
                        setScheduleDayVal(selectedDay.dayVal);
                      }
                    }}
                    className="w-full border rounded-md px-3 py-2"
                  >
                    {dayOptions.map((day) => (
                      <option key={day.dayVal} value={day.dayDisplayName}>
                        {day.dayDisplayName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="">
                  <label className="block mb-2">Check Frequency</label>
                  <select
                    value={scheduleFrequency}
                    onChange={(e) => {
                      setScheduleFrequency(e.target.value);
                      const selectedFrequency = frequencyOptions.find(
                        (frequency) =>
                          frequency.frequencyDisplayName === e.target.value,
                      );
                      if (selectedFrequency) {
                        setScheduleDayVal(selectedFrequency.frequencyVal);
                      }
                    }}
                    className="w-full border rounded-md px-3 py-2"
                  >
                    {frequencyOptions.map((frequency) => (
                      <option
                        key={frequency.frequencyVal}
                        value={frequency.frequencyDisplayName}
                      >
                        {frequency.frequencyDisplayName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {/* End of Schedule Name */}
              {/* Download Location Name */}
              <div className="flex gap-4 pt-4">
                <div className="flex-1">
                  <label className="block mb-2">Name</label>
                  <input
                    type="text"
                    placeholder="Name"
                    value={channelUrls}
                    onChange={(e) => setChannelUrls(e.target.value)}
                    className="w-full border rounded-md px-3 py-2"
                  />
                </div>

                <div className="">
                  <label className="block mb-2">Day</label>
                  <select
                    value={scheduleDay}
                    onChange={(e) => {
                      setScheduleDay(e.target.value);
                      const selectedDay = dayOptions.find(
                        (day) => day.dayDisplayName === e.target.value,
                      );
                      if (selectedDay) {
                        setScheduleDayVal(selectedDay.dayVal);
                      }
                    }}
                    className="w-full border rounded-md px-3 py-2"
                  >
                    {dayOptions.map((day) => (
                      <option key={day.dayVal} value={day.dayDisplayName}>
                        {day.dayDisplayName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {/* End of Download Location Name */}
            </div>
          </form>
        </div>

        {/* Button commands */}

        <hr className="solid mt-4 mb-2 -mx-6 w-[calc(100%+47px)] border-t-2 border-divider" />

        <div className="flex gap-3">
          <button
            type="submit"
            className="bg-primary text-white px-2 py-2 rounded-md hover:bg-orange-600"
          >
            Schedule
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="px-2 py-2 border rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
        {/* End of Button commands */}
      </div>
    </div>
  );
};

export default SchedulerModal;
