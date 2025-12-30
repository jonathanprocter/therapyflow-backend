import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CalendarSession {
  // Support both old format (date, clientId) and new API format (scheduledAt, clientId)
  date?: Date | string;
  scheduledAt?: Date | string;
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
      // Support both 'date' and 'scheduledAt' properties
      const sessionDateValue = session.scheduledAt || session.date;
      if (!sessionDateValue) return false;
      
      const sessionDate = new Date(sessionDateValue);
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
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < startingDay; i++) {
    days.push(
      <div 
        key={`empty-${i}`} 
        className="aspect-square" 
        aria-hidden="true"
      />
    );
  }
  
  // Add cells for each day of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const hasSessionIndicator = hasSession(day);
    const isTodayDate = isToday(day);
    const isSelectedDate = isSelected(day);
    
    days.push(
      <button
        key={day}
        onClick={() => handleDayClick(day)}
        aria-label={`${monthNames[currentMonth.getMonth()]} ${day}, ${currentMonth.getFullYear()}`}
        aria-current={isTodayDate ? 'date' : undefined}
        aria-pressed={isSelectedDate}
        className={cn(
          'aspect-square w-full rounded-full text-sm font-medium transition-all duration-200',
          'hover:bg-sage/10 hover:scale-105 active:scale-95',
          'focus:outline-none focus:ring-2 focus:ring-sage focus:ring-offset-2',
          'flex items-center justify-center relative',
          // Minimum touch target size for mobile (44x44px recommended)
          'min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px]',
          isTodayDate && !isSelectedDate && 'bg-sage/20 text-evergreen font-semibold',
          isSelectedDate && 'bg-sage text-white hover:bg-moss shadow-md',
          !isTodayDate && !isSelectedDate && 'text-evergreen'
        )}
      >
        <span className="z-10">{day}</span>
        {hasSessionIndicator && (
          <span 
            className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-french-blue z-0"
            aria-label="Has scheduled session"
          />
        )}
      </button>
    );
  }

  return (
    <div className={cn('bg-white rounded-lg border border-sage/20 p-3 sm:p-4', className)}>
      {/* Calendar Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={prevMonth}
          aria-label="Previous month"
          className="p-1.5 hover:bg-sage/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-sage"
        >
          <ChevronLeft className="h-5 w-5 text-evergreen" />
        </button>
        <h3 className="font-semibold text-evergreen text-sm sm:text-base">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h3>
        <button
          onClick={nextMonth}
          aria-label="Next month"
          className="p-1.5 hover:bg-sage/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-sage"
        >
          <ChevronRight className="h-5 w-5 text-evergreen" />
        </button>
      </div>

      {/* Day Names Header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((day) => (
          <div
            key={day}
            className="aspect-square flex items-center justify-center text-xs font-medium text-gray-500"
            aria-label={day}
          >
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{day.charAt(0)}</span>
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1" role="grid">
        {days}
      </div>

      {/* Legend for mobile users */}
      <div className="mt-4 pt-3 border-t border-sage/10 flex items-center justify-center gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-sage/20"></div>
          <span>Today</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-french-blue"></div>
          <span>Session</span>
        </div>
      </div>
    </div>
  );
}
