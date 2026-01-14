/**
 * Shared text processing utilities
 */

/**
 * Strip markdown code blocks from AI response text before JSON parsing.
 * AI providers sometimes wrap JSON responses in ```json ... ``` markers.
 */
export function stripMarkdownCodeBlocks(text: string): string {
  if (!text) return text;
  // Remove ```json or ``` markers at start and end
  let cleaned = text.trim();
  // Match opening code fence with optional language identifier
  cleaned = cleaned.replace(/^```(?:json|JSON)?\s*\n?/i, '');
  // Match closing code fence
  cleaned = cleaned.replace(/\n?```\s*$/i, '');
  return cleaned.trim();
}

/**
 * Safely parse JSON with error handling
 * Returns the parsed object or a default value on failure
 */
export function safeJsonParse<T>(text: string | null | undefined, defaultValue: T): T {
  if (!text) return defaultValue;
  try {
    const cleaned = stripMarkdownCodeBlocks(text);
    return JSON.parse(cleaned) as T;
  } catch (error) {
    console.warn('[TextUtils] JSON parse failed:', error instanceof Error ? error.message : 'Unknown error');
    return defaultValue;
  }
}

/**
 * Extract JSON object from text that may contain other content
 * Useful for extracting JSON from AI responses that include explanatory text
 */
export function extractJsonFromText<T>(text: string, defaultValue: T): T {
  if (!text) return defaultValue;

  // First try to parse the whole thing
  try {
    const cleaned = stripMarkdownCodeBlocks(text);
    return JSON.parse(cleaned) as T;
  } catch {
    // Try to find JSON in the text
  }

  // Look for JSON object pattern
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]) as T;
    } catch (error) {
      console.warn('[TextUtils] Failed to parse extracted JSON:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  return defaultValue;
}

/**
 * Truncate text to a maximum length, adding ellipsis if truncated
 */
export function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Sanitize text for safe display (basic XSS prevention)
 */
export function sanitizeText(text: string): string {
  if (!text) return text;
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
