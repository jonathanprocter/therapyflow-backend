/**
 * Text Formatting Utilities
 *
 * Provides functions to clean and format text for clinical documentation.
 * Ensures no markdown syntax appears in output while maintaining semantic structure.
 */

/**
 * Removes all markdown syntax from text while preserving the content.
 * This ensures notes are properly formatted for display in iOS without raw markdown.
 */
export function stripMarkdown(text: string): string {
  if (!text) return '';

  let cleaned = text;

  // Remove headers (# ## ### #### ##### ######)
  cleaned = cleaned.replace(/^#{1,6}\s+(.*)$/gm, '$1');

  // Remove bold and italic formatting (**text**, *text*, __text__, _text_)
  cleaned = cleaned.replace(/\*\*\*([^*]+)\*\*\*/g, '$1'); // Bold italic
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1'); // Bold
  cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1'); // Italic
  cleaned = cleaned.replace(/___([^_]+)___/g, '$1'); // Bold italic
  cleaned = cleaned.replace(/__([^_]+)__/g, '$1'); // Bold
  cleaned = cleaned.replace(/_([^_]+)_/g, '$1'); // Italic

  // Remove strikethrough (~~text~~)
  cleaned = cleaned.replace(/~~([^~]+)~~/g, '$1');

  // Remove code blocks (```code``` and `code`)
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

  // Remove links ([text](url) and [text]: url)
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  cleaned = cleaned.replace(/\[([^\]]+)\]:\s*[^\s]+/g, '$1');

  // Remove images (![alt](url))
  cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');

  // Remove horizontal rules (--- or *** or ___)
  cleaned = cleaned.replace(/^[-*_]{3,}\s*$/gm, '');

  // Remove blockquotes (> text) - keep the text
  cleaned = cleaned.replace(/^[\s]*>\s*/gm, '');

  // Remove list markers but keep content
  // Unordered: - + *
  cleaned = cleaned.replace(/^[\s]*[-+*]\s+/gm, '  ');
  // Ordered: 1. 2. etc
  cleaned = cleaned.replace(/^[\s]*\d+\.\s+/gm, '  ');

  // Remove tables (| cell | cell |)
  cleaned = cleaned.replace(/^\|.*\|$/gm, '');
  cleaned = cleaned.replace(/^[\s]*\|?[\s]*:?-+:?[\s]*\|?.*$/gm, '');

  // Remove footnotes ([^1])
  cleaned = cleaned.replace(/\[\^[^\]]+\]/g, '');

  // Remove HTML comments (<!-- comment -->)
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // Remove common HTML tags
  cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');
  cleaned = cleaned.replace(/<p>/gi, '\n');
  cleaned = cleaned.replace(/<\/p>/gi, '\n');
  cleaned = cleaned.replace(/<[^>]+>/g, '');

  // Clean up extra whitespace
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * Formats text for clinical display with proper section structure.
 * Converts markdown-style sections to plain text with clear labels.
 */
export function formatClinicalText(text: string): string {
  if (!text) return '';

  let formatted = stripMarkdown(text);

  // Ensure section headers are properly capitalized and followed by newlines
  const sectionHeaders = [
    'SUBJECTIVE', 'OBJECTIVE', 'ASSESSMENT', 'PLAN',
    'Subjective', 'Objective', 'Assessment', 'Plan',
    'Key Points', 'Significant Quotes', 'Tonal Analysis',
    'Thematic Analysis', 'Sentiment Analysis', 'Summary'
  ];

  for (const header of sectionHeaders) {
    // Ensure headers are on their own line with proper spacing
    const regex = new RegExp(`(?:^|\\n)\\s*(${header})[:\\s]*(?:\\n|$)`, 'gi');
    formatted = formatted.replace(regex, `\n\n${header.toUpperCase()}\n`);
  }

  // Clean up any remaining multiple newlines
  formatted = formatted.replace(/\n{3,}/g, '\n\n');

  return formatted.trim();
}

/**
 * Extracts and formats SOAP sections from a progress note.
 */
export function formatSOAPNote(content: string): {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
} {
  const cleaned = stripMarkdown(content);

  const extractSection = (sectionName: string, nextSections: string[]): string => {
    const startPattern = new RegExp(`(?:^|\\n)\\s*${sectionName}[:\\s]*\\n?`, 'i');
    const startMatch = cleaned.match(startPattern);

    if (!startMatch) return '';

    const startIndex = (startMatch.index || 0) + startMatch[0].length;

    // Find the next section
    let endIndex = cleaned.length;
    for (const next of nextSections) {
      const nextPattern = new RegExp(`(?:^|\\n)\\s*${next}[:\\s]*\\n?`, 'i');
      const nextMatch = cleaned.substring(startIndex).match(nextPattern);
      if (nextMatch && nextMatch.index !== undefined) {
        const potentialEnd = startIndex + nextMatch.index;
        if (potentialEnd < endIndex) {
          endIndex = potentialEnd;
        }
      }
    }

    return cleaned.substring(startIndex, endIndex).trim();
  };

  return {
    subjective: extractSection('SUBJECTIVE', ['OBJECTIVE', 'ASSESSMENT', 'PLAN']),
    objective: extractSection('OBJECTIVE', ['ASSESSMENT', 'PLAN']),
    assessment: extractSection('ASSESSMENT', ['PLAN']),
    plan: extractSection('PLAN', ['KEY POINTS', 'SIGNIFICANT QUOTES', 'SUMMARY', 'TONAL ANALYSIS'])
  };
}

/**
 * System prompt addition to prevent markdown in AI outputs.
 */
export const NO_MARKDOWN_INSTRUCTION = `

CRITICAL FORMATTING REQUIREMENT:
Your response must NOT contain any markdown syntax. This includes:
- NO # headers (use plain text labels followed by newlines)
- NO **bold** or *italic* markers (the text will be formatted programmatically)
- NO - or * bullet points (use plain text or numbered lists without markers)
- NO \`code\` backticks
- NO [links](url)
- NO > blockquotes

Instead, use plain text with clear section labels on their own lines.
Example of correct format:
SUBJECTIVE
The client reported feeling anxious about...

OBJECTIVE
Client appeared well-groomed and alert...

Use clear paragraph breaks and indentation for readability.
`;

/**
 * Cleans AI response by stripping any markdown that slipped through.
 */
export function cleanAIResponse(response: string): string {
  // First strip markdown
  let cleaned = stripMarkdown(response);

  // Fix common AI formatting issues
  // Convert "**Section:**" to "SECTION"
  cleaned = cleaned.replace(/([A-Za-z\s]+):\s*\n/g, (match, section) => {
    const upper = section.trim().toUpperCase();
    if (['SUBJECTIVE', 'OBJECTIVE', 'ASSESSMENT', 'PLAN', 'KEY POINTS',
         'SIGNIFICANT QUOTES', 'SUMMARY', 'TONAL ANALYSIS', 'THEMATIC ANALYSIS',
         'SENTIMENT ANALYSIS', 'COMPREHENSIVE NARRATIVE SUMMARY'].includes(upper)) {
      return `${upper}\n`;
    }
    return match;
  });

  return cleaned.trim();
}
