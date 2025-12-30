/**
 * Markdown Formatter Utility
 * Converts markdown syntax to clean HTML for proper text rendering
 */

export interface FormattedResponse {
  html: string;
  plainText: string;
}

/**
 * Convert markdown to HTML with proper formatting
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';

  let html = markdown;

  // Headers (h1-h6)
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold (**text** or __text__)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic (*text* or _text_)
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Strikethrough (~~text~~)
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Code blocks (```code```)
  html = html.replace(/```([^`]+)```/g, '<pre><code>$1</code></pre>');

  // Inline code (`code`)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Links ([text](url))
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Unordered lists
  html = html.replace(/^\* (.+)$/gim, '<li>$1</li>');
  html = html.replace(/^- (.+)$/gim, '<li>$1</li>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gim, '<li>$1</li>');

  // Wrap consecutive <li> tags in <ul> or <ol>
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
    return `<ul>${match}</ul>`;
  });

  // Blockquotes (> text)
  html = html.replace(/^> (.+)$/gim, '<blockquote>$1</blockquote>');

  // Horizontal rules (--- or ***)
  html = html.replace(/^---$/gim, '<hr>');
  html = html.replace(/^\*\*\*$/gim, '<hr>');

  // Line breaks
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');

  // Wrap in paragraph tags if not already wrapped
  if (!html.startsWith('<')) {
    html = `<p>${html}</p>`;
  }

  return html;
}

/**
 * Strip all markdown syntax and return plain text
 */
export function stripMarkdown(markdown: string): string {
  if (!markdown) return '';

  let text = markdown;

  // Remove headers
  text = text.replace(/^#{1,6}\s+/gim, '');

  // Remove bold/italic
  text = text.replace(/\*\*(.+?)\*\*/g, '$1');
  text = text.replace(/__(.+?)__/g, '$1');
  text = text.replace(/\*(.+?)\*/g, '$1');
  text = text.replace(/_(.+?)_/g, '$1');

  // Remove strikethrough
  text = text.replace(/~~(.+?)~~/g, '$1');

  // Remove code blocks
  text = text.replace(/```[^`]*```/g, '');
  text = text.replace(/`([^`]+)`/g, '$1');

  // Remove links (keep text only)
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Remove list markers
  text = text.replace(/^\* /gim, '');
  text = text.replace(/^- /gim, '');
  text = text.replace(/^\d+\. /gim, '');

  // Remove blockquotes
  text = text.replace(/^> /gim, '');

  // Remove horizontal rules
  text = text.replace(/^---$/gim, '');
  text = text.replace(/^\*\*\*$/gim, '');

  // Clean up extra whitespace
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

  return text;
}

/**
 * Format AI response for clean display
 */
export function formatAIResponse(response: string, format: 'html' | 'text' = 'html'): FormattedResponse {
  const html = markdownToHtml(response);
  const plainText = stripMarkdown(response);

  return {
    html: format === 'html' ? html : plainText,
    plainText
  };
}

/**
 * Convert markdown to rich text with proper formatting
 * This version preserves structure but removes markdown symbols
 */
export function markdownToRichText(markdown: string): string {
  if (!markdown) return '';

  let text = markdown;

  // Convert headers to plain text with proper spacing
  text = text.replace(/^### (.+)$/gim, '\n$1\n');
  text = text.replace(/^## (.+)$/gim, '\n$1\n');
  text = text.replace(/^# (.+)$/gim, '\n$1\n');

  // Remove bold markers (keep text)
  text = text.replace(/\*\*(.+?)\*\*/g, '$1');
  text = text.replace(/__(.+?)__/g, '$1');

  // Remove italic markers (keep text)
  text = text.replace(/\*(.+?)\*/g, '$1');
  text = text.replace(/_(.+?)_/g, '$1');

  // Remove strikethrough
  text = text.replace(/~~(.+?)~~/g, '$1');

  // Remove code formatting
  text = text.replace(/```([^`]+)```/g, '$1');
  text = text.replace(/`([^`]+)`/g, '$1');

  // Convert links to text with URL
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');

  // Convert list items
  text = text.replace(/^\* (.+)$/gim, '• $1');
  text = text.replace(/^- (.+)$/gim, '• $1');
  text = text.replace(/^\d+\. (.+)$/gim, '$1');

  // Remove blockquote markers
  text = text.replace(/^> /gim, '');

  // Remove horizontal rules
  text = text.replace(/^---$/gim, '');
  text = text.replace(/^\*\*\*$/gim, '');

  // Clean up extra whitespace
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

  return text;
}

/**
 * Detect if text contains markdown syntax
 */
export function hasMarkdownSyntax(text: string): boolean {
  const markdownPatterns = [
    /\*\*.*\*\*/,  // Bold
    /__.*__/,      // Bold
    /\*.*\*/,      // Italic
    /_.*_/,        // Italic
    /^#{1,6}\s/m,  // Headers
    /```.*```/,    // Code blocks
    /`.*`/,        // Inline code
    /\[.*\]\(.*\)/, // Links
    /^[\*\-]\s/m,  // Lists
    /^>\s/m        // Blockquotes
  ];

  return markdownPatterns.some(pattern => pattern.test(text));
}

/**
 * Smart format - auto-detect and convert if needed
 */
export function smartFormat(text: string, outputFormat: 'html' | 'text' | 'auto' = 'auto'): string {
  if (!text) return '';

  // If no markdown detected, return as-is
  if (!hasMarkdownSyntax(text)) {
    return text;
  }

  // Auto-detect best format
  if (outputFormat === 'auto') {
    // Default to HTML for web display
    outputFormat = 'html';
  }

  if (outputFormat === 'html') {
    return markdownToHtml(text);
  } else {
    return markdownToRichText(text);
  }
}
