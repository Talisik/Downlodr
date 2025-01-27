/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  isBefore,
  isAfter,
} from 'date-fns';

// Replace with Zustand pag may flow na
interface Schedule {
  id: string;
  name: string;
  datetime: Date;
  type: 'Tech Reviews' | 'Cooking Channel' | 'Gaming News';
  frequency?: string;
  time: string;
}

const ScheduleCalendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Replace with Zustand
  // Year - Month(starts from 0 to 11) - Day
  const schedules: Schedule[] = [
    {
      id: '1',
      name: 'Tech Reviews',
      datetime: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
      type: 'Tech Reviews',
      time: '00:00',
    },
    {
      id: '2',
      name: 'Cooking Channel',
      datetime: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
      type: 'Cooking Channel',
      time: '00:00',
    },
    {
      id: '3',
      name: 'Gaming News',
      datetime: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1),
      type: 'Gaming News',
      time: '00:00',
    },
    {
      id: '4',
      name: 'Gaming News 2',
      datetime: new Date(2025, 1, 14),
      type: 'Gaming News',
      time: '00:00',
    },
  ];

  const getSchedulesForDay = (date: Date) => {
    return schedules.filter(
      (schedule) =>
        format(schedule.datetime, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd'),
    );
  };

  // Replace with zustand
  const getScheduleColor = (type: Schedule['type']) => {
    switch (type) {
      case 'Tech Reviews':
        return 'bg-blue-100 dark:bg-blue-200';
      case 'Cooking Channel':
        return 'bg-pink-100 dark:bg-pink-200';
      case 'Gaming News':
        return 'bg-green-100 dark:bg-green-200';
      default:
        return 'bg-gray-100 dark:bg-gray-200';
    }
  };

  // Date Limit
  const minDate = new Date(2024, 0, 1); // Jan 1, 2024
  const maxDate = new Date(2025, 11, 31); // Dec 31, 2025

  // Navigation used for calendar with limits
  const handlePrevMonth = () => {
    const prevMonth = subMonths(currentDate, 1);
    if (!isBefore(prevMonth, minDate)) {
      setCurrentDate(prevMonth);
    }
  };

  const handleNextMonth = () => {
    const nextMonth = addMonths(currentDate, 1);
    if (!isAfter(nextMonth, maxDate)) {
      setCurrentDate(nextMonth);
    }
  };

  return (
    <div className="w-full h-full overflow-x-auto">
      <div className="min-w-[600px] p-4 bg-white dark:bg-darkMode">
        {/* Month Navigation */}
        <div className="flex justify-between items-center mb-4">
          <button
            onClick={handlePrevMonth}
            className={`px-4 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-200 ${
              isBefore(subMonths(currentDate, 1), minDate)
                ? 'opacity-50 cursor-not-allowed dark:opacity-30'
                : ''
            }`}
            disabled={isBefore(subMonths(currentDate, 1), minDate)}
          >
            Previous
          </button>
          <h2 className="text-xl font-semibold dark:text-gray-200">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <button
            onClick={handleNextMonth}
            className={`px-4 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-200 ${
              isAfter(addMonths(currentDate, 1), maxDate)
                ? 'opacity-50 cursor-not-allowed dark:opacity-30'
                : ''
            }`}
            disabled={isAfter(addMonths(currentDate, 1), maxDate)}
          >
            Next
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {['Sun', 'Mon', 'Tues', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div
              key={day}
              className="p-2 text-center font-semibold border-b dark:border-gray-700 dark:text-gray-200"
            >
              {day}
            </div>
          ))}
          {days.map((day: any) => (
            <div
              key={day.toString()}
              className={`min-h-[120px] p-2 border dark:border-gray-700 ${
                !isSameMonth(day, currentDate)
                  ? 'bg-gray-50 dark:bg-darkModeCompliment'
                  : 'dark:bg-darkModeCompliment'
              }`}
            >
              <div className="text-sm mb-1 dark:text-gray-200">
                {format(day, 'd')}
              </div>
              <div className="space-y-1">
                {getSchedulesForDay(day).map((schedule) => (
                  <div
                    key={schedule.id}
                    className={`${getScheduleColor(
                      schedule.type,
                    )} p-1 rounded text-xs border dark:border-gray-700`}
                  >
                    <div className="font-medium dark:text-gray-800">
                      {schedule.name}
                    </div>
                    <div className="dark:text-gray-700">{schedule.time}</div>
                    {schedule.frequency && (
                      <div className="text-gray-500 dark:text-gray-600">
                        {schedule.frequency}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ScheduleCalendar;
