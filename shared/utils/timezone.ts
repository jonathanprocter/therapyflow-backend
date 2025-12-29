import { formatInTimeZone } from 'date-fns-tz';
import { format, parseISO, isValid } from 'date-fns';

/**
 * Centralized timezone utilities for consistent Eastern Daylight Time handling
 * across all dashboard components and the entire application
 */

export const APP_TIMEZONE = 'America/New_York';

/**
 * Get current date/time in EDT timezone
 */
export function getCurrentEDT(): Date {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: APP_TIMEZONE }));
}

/**
 * Format date to EDT timezone with specified format
 */
export function formatToEDT(date: Date | string, formatStr: string = 'yyyy-MM-dd'): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(dateObj)) {
    console.warn('Invalid date provided to formatToEDT:', date);
    return 'Invalid Date';
  }
  return formatInTimeZone(dateObj, APP_TIMEZONE, formatStr);
}

/**
 * Get today's date in EDT as YYYY-MM-DD string
 */
export function getTodayEDT(): string {
  return formatToEDT(getCurrentEDT(), 'yyyy-MM-dd');
}

/**
 * Get current time in EDT as formatted string
 */
export function getCurrentTimeEDT(formatStr: string = 'h:mm a'): string {
  return formatToEDT(getCurrentEDT(), formatStr);
}

/**
 * Check if a date is today in EDT timezone
 */
export function isToday(date: Date | string): boolean {
  const today = getTodayEDT();
  const dateStr = formatToEDT(date, 'yyyy-MM-dd');
  return today === dateStr;
}

/**
 * Check if a date is yesterday in EDT timezone
 */
export function isYesterday(date: Date | string): boolean {
  const yesterday = formatToEDT(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
  const dateStr = formatToEDT(date, 'yyyy-MM-dd');
  return yesterday === dateStr;
}

/**
 * Check if a date is tomorrow in EDT timezone
 */
export function isTomorrow(date: Date | string): boolean {
  const tomorrow = formatToEDT(new Date(Date.now() + 86400000), 'yyyy-MM-dd');
  const dateStr = formatToEDT(date, 'yyyy-MM-dd');
  return tomorrow === dateStr;
}

/**
 * Get relative date display (Today, Yesterday, Tomorrow, or formatted date)
 */
export function getRelativeDateDisplay(date: Date | string): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isTomorrow(date)) return 'Tomorrow';
  return formatToEDT(date, 'MMM dd, yyyy');
}

/**
 * Convert UTC date to EDT for database storage
 */
export function utcToEDT(utcDate: Date | string): Date {
  const dateObj = typeof utcDate === 'string' ? parseISO(utcDate) : utcDate;
  return new Date(dateObj.toLocaleString("en-US", { timeZone: APP_TIMEZONE }));
}

/**
 * Convert EDT date to UTC for database storage
 */
export function edtToUTC(edtDate: Date): Date {
  // Create a date string in EDT timezone
  const edtString = edtDate.toLocaleString("en-US", { timeZone: APP_TIMEZONE });
  return new Date(edtString);
}

/**
 * Format session time range in EDT
 */
export function formatSessionTimeRange(startTime: Date | string, duration: number): {
  startTime: string;
  endTime: string;
  timeRange: string;
  duration: string;
} {
  const start = typeof startTime === 'string' ? parseISO(startTime) : startTime;
  const end = new Date(start.getTime() + duration * 60000);
  
  const startFormatted = formatToEDT(start, 'h:mm a');
  const endFormatted = formatToEDT(end, 'h:mm a');
  
  return {
    startTime: startFormatted,
    endTime: endFormatted,
    timeRange: `${startFormatted} - ${endFormatted} EDT`,
    duration: `${duration} minutes`
  };
}

/**
 * Get start and end of day in EDT timezone for database queries
 */
export function getEDTDayBounds(date: Date | string = new Date()): {
  startOfDay: Date;
  endOfDay: Date;
} {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const edtDate = new Date(dateObj.toLocaleString("en-US", { timeZone: APP_TIMEZONE }));
  
  // Set to start of day in EDT
  const startOfDay = new Date(edtDate);
  startOfDay.setHours(0, 0, 0, 0);
  
  // Set to end of day in EDT
  const endOfDay = new Date(edtDate);
  endOfDay.setHours(23, 59, 59, 999);
  
  return {
    startOfDay,
    endOfDay
  };
}

/**
 * Get dashboard date display with timezone awareness
 */
export function getDashboardDateDisplay(selectedDate: Date): {
  title: string;
  subtitle: string;
  isToday: boolean;
} {
  const isSelectedToday = isToday(selectedDate);
  
  return {
    title: isSelectedToday ? "Today's Schedule" : `Schedule for ${getRelativeDateDisplay(selectedDate)}`,
    subtitle: `${formatToEDT(selectedDate, 'EEEE, MMMM dd, yyyy')} • ${getCurrentTimeEDT()} EDT`,
    isToday: isSelectedToday
  };
}

/**
 * Timezone-aware date initialization for dashboard components
 */
export function initializeDashboardDate(): Date {
  return getCurrentEDT();
}

/**
 * Get week bounds in EDT for weekly views
 */
export function getEDTWeekBounds(date: Date | string = new Date()): {
  weekStart: Date;
  weekEnd: Date;
} {
  const dateObj = typeof date === 'string' ? parseISO(date) : date;
  const edtDate = new Date(dateObj.toLocaleString("en-US", { timeZone: APP_TIMEZONE }));
  
  // Get start of week (Sunday)
  const weekStart = new Date(edtDate);
  weekStart.setDate(edtDate.getDate() - edtDate.getDay());
  weekStart.setHours(0, 0, 0, 0);
  
  // Get end of week (Saturday)
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  return {
    weekStart,
    weekEnd
  };
}