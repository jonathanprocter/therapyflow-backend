import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarSession {
  date: Date;
  clientId: string;
}

interface CalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  sessions?: CalendarSession[];
  className?: string;
}

export function Calendar({ selectedDate, onDateSelect, sessions = [], className }: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(selectedDate);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();

    return { daysInMonth, startingDay };
  };

  const { daysInMonth, startingDay } = getDaysInMonth(currentMonth);

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      day === today.getDate() &&
      currentMonth.getMonth() === today.getMonth() &&
      currentMonth.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (day: number) => {
    return (
      day === selectedDate.getDate() &&
      currentMonth.getMonth() === selectedDate.getMonth() &&
      currentMonth.getFullYear() === selectedDate.getFullYear()
    );
  };

  const hasSession = (day: number) => {
    return sessions.some((session) => {
      const sessionDate = new Date(session.date);
      return (
        sessionDate.getDate() === day &&
        sessionDate.getMonth() === currentMonth.getMonth() &&
        sessionDate.getFullYear() === currentMonth.getFullYear()
      );
    });
  };

  const handleDayClick = (day: number) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    onDateSelect(newDate);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const days = [];
  for (let i = 0; i < startingDay; i++) {
    days.push(<div key={`empty-${i}`} className="h-9 w-9" />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(
      <button
        key={day}
        onClick={() => handleDayClick(day)}
        className={cn(
          'h-9 w-9 rounded-full text-sm font-medium transition-colors relative',
          'hover:bg-sage/10',
          isToday(day) && !isSelected(day) && 'bg-sage/20 text-evergreen',
          isSelected(day) && 'bg-sage text-white hover:bg-moss',
          !isToday(day) && !isSelected(day) && 'text-evergreen'
        )}
      >
        {day}
        {hasSession(day) && (
          <span className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full bg-french-blue" />
        )}
      </button>
    );
  }

  return (
    <div className={cn('bg-white rounded-lg border border-sage/20 p-4', className)}>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          className="p-1.5 hover:bg-sage/10 rounded-lg transition-colors"
        >
          <ChevronLeft className="h-5 w-5 text-evergreen" />
        </button>
        <h3 className="font-semibold text-evergreen">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        <button
          onClick={nextMonth}
          className="p-1.5 hover:bg-sage/10 rounded-lg transition-colors"
        >
          <ChevronRight className="h-5 w-5 text-evergreen" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((day) => (
          <div
            key={day}
            className="h-9 w-9 flex items-center justify-center text-xs font-medium text-gray-500"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">{days}</div>
    </div>
  );
}
