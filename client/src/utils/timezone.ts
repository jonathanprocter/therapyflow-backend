// Client-side timezone utilities for consistent EDT handling

/**
 * Format a date as EDT time string
 */
export function formatEDTTime(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = new Date(date);
  const defaultOptions: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/New_York'
  };
  
  return d.toLocaleTimeString('en-US', { ...defaultOptions, ...options });
}

/**
 * Format a date as EDT date string
 */
export function formatEDTDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = new Date(date);
  const defaultOptions: Intl.DateTimeFormatOptions = {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  
  return d.toLocaleDateString('en-US', { ...defaultOptions, ...options });
}

/**
 * Format a date as short EDT date string
 */
export function formatEDTDateShort(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Format date and time together in EDT
 */
export function formatEDTDateTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Get current time in EDT
 */
export function nowInEDT(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
}

/**
 * Check if a date is today in EDT
 */
export function isTodayInEDT(date: Date | string): boolean {
  const d = new Date(date);
  const today = nowInEDT();
  
  const dateEDT = d.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
  const todayEDT = today.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
  
  return dateEDT === todayEDT;
}