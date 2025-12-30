// Client type will be inferred from usage

/**
 * Patterns that indicate a client entry is actually a calendar event or task
 */
const NON_CLIENT_PATTERNS = [
  /^Call with /i,
  /^Coffee with /i,
  /^Meeting with /i,
  /^Lunch with /i,
  /^Dinner with /i,
  /^Appointment with /i,
  /^TODO:/i,
  /^TASK:/i,
  /^Event:/i,
  /^Reminder:/i,
  /^Note:/i,
  /^Follow-up:/i,
  /^Check-in:/i,
  /^\[.*\]$/i, // Entries that are just brackets
  /^-\s/i, // Entries starting with dash (list items)
];

/**
 * Check if a client name matches non-client patterns
 */
export function isNonClientEntry(clientName: string): boolean {
  if (!clientName || typeof clientName !== 'string') {
    return true;
  }

  const trimmedName = clientName.trim();

  // Empty or very short names
  if (trimmedName.length < 2) {
    return true;
  }

  // Check against patterns
  return NON_CLIENT_PATTERNS.some(pattern => pattern.test(trimmedName));
}

/**
 * Filter out non-client entries from a client list
 */
export function filterActualClients(clients: any[]): any[] {
  return clients.filter(client => {
    if (!client.name) {
      return false;
    }

    return !isNonClientEntry(client.name);
  });
}

/**
 * Validate client name before creation
 */
export function validateClientName(name: string): { valid: boolean; error?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Client name is required' };
  }

  const trimmedName = name.trim();

  if (trimmedName.length < 2) {
    return { valid: false, error: 'Client name must be at least 2 characters' };
  }

  if (isNonClientEntry(trimmedName)) {
    return { 
      valid: false, 
      error: 'Client name appears to be a calendar event or task. Please use a proper client name.' 
    };
  }

  return { valid: true };
}

/**
 * Sanitize client name
 */
export function sanitizeClientName(name: string): string {
  if (!name) return '';
  
  return name
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .replace(/[^\w\s\-'.]/g, ''); // Remove special characters except dash, apostrophe, period
}

/**
 * Check if a client should be flagged for review
 */
export function shouldFlagForReview(client: any): boolean {
  if (!client.name) return true;

  // Flag if name is suspiciously short
  if (client.name.trim().length < 3) return true;

  // Flag if name contains only numbers
  if (/^\d+$/.test(client.name.trim())) return true;

  // Flag if name looks like an email
  if (client.name.includes('@')) return true;

  // Flag if name looks like a phone number
  if (/^\+?[\d\s\-()]+$/.test(client.name.trim())) return true;

  return false;
}
