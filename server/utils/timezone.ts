// Timezone utilities for consistent EDT handling

/**
 * Convert a date to EDT timezone
 */
export function toEDT(date: Date | string): Date {
  const d = new Date(date);
  return new Date(d.toLocaleString("en-US", { timeZone: "America/New_York" }));
}

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
export function formatEDTDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
}

/**
 * Get current time in EDT
 */
export function nowInEDT(): Date {
  return toEDT(new Date());
}

/**
 * Check if a date is today in EDT
 */
export function isTodayInEDT(date: Date | string): boolean {
  const d = toEDT(date);
  const today = nowInEDT();
  
  return d.toDateString() === today.toDateString();
}