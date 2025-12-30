/**
 * Keyboard Shortcuts Hook
 * Global keyboard shortcuts for AI assistant and other features
 */

import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  action: () => void;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
}

/**
 * Detect if user is on Mac
 */
const isMac = () => {
  return typeof window !== 'undefined' && /Mac|iPhone|iPod|iPad/.test(navigator.platform);
};

/**
 * Get modifier key name for display
 */
export const getModifierKeyName = (modifier: 'ctrl' | 'shift' | 'alt' | 'meta'): string => {
  if (modifier === 'meta') {
    return isMac() ? '⌘' : 'Ctrl';
  }
  if (modifier === 'ctrl') {
    return isMac() ? '⌃' : 'Ctrl';
  }
  if (modifier === 'shift') {
    return '⇧';
  }
  if (modifier === 'alt') {
    return isMac() ? '⌥' : 'Alt';
  }
  return '';
};

/**
 * Format shortcut for display
 */
export const formatShortcut = (shortcut: KeyboardShortcut): string => {
  const parts: string[] = [];
  
  if (shortcut.meta) parts.push(getModifierKeyName('meta'));
  if (shortcut.ctrl) parts.push(getModifierKeyName('ctrl'));
  if (shortcut.shift) parts.push(getModifierKeyName('shift'));
  if (shortcut.alt) parts.push(getModifierKeyName('alt'));
  
  parts.push(shortcut.key.toUpperCase());
  
  return parts.join(isMac() ? '' : '+');
};

/**
 * Check if keyboard event matches shortcut
 */
const matchesShortcut = (event: KeyboardEvent, shortcut: KeyboardShortcut): boolean => {
  const key = event.key.toLowerCase();
  const shortcutKey = shortcut.key.toLowerCase();
  
  if (key !== shortcutKey) return false;
  
  // Check modifiers
  if (shortcut.ctrl && !event.ctrlKey) return false;
  if (!shortcut.ctrl && event.ctrlKey) return false;
  
  if (shortcut.shift && !event.shiftKey) return false;
  if (!shortcut.shift && event.shiftKey) return false;
  
  if (shortcut.alt && !event.altKey) return false;
  if (!shortcut.alt && event.altKey) return false;
  
  if (shortcut.meta && !event.metaKey) return false;
  if (!shortcut.meta && event.metaKey) return false;
  
  return true;
};

/**
 * Check if element should ignore keyboard shortcuts
 */
const shouldIgnoreShortcut = (target: EventTarget | null): boolean => {
  if (!target || !(target instanceof HTMLElement)) return false;
  
  const tagName = target.tagName.toLowerCase();
  const isInput = ['input', 'textarea', 'select'].includes(tagName);
  const isContentEditable = target.isContentEditable;
  
  return isInput || isContentEditable;
};

/**
 * Hook for managing keyboard shortcuts
 */
export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[],
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true } = options;

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;
      
      // Don't trigger shortcuts when typing in inputs
      if (shouldIgnoreShortcut(event.target)) return;
      
      // Find matching shortcut
      const matchedShortcut = shortcuts.find(shortcut => 
        matchesShortcut(event, shortcut)
      );
      
      if (matchedShortcut) {
        event.preventDefault();
        event.stopPropagation();
        matchedShortcut.action();
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    if (!enabled) return;
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown, enabled]);

  return {
    formatShortcut,
    getModifierKeyName,
    isMac: isMac()
  };
}

/**
 * Default AI Assistant shortcuts
 */
export const createAIAssistantShortcuts = (callbacks: {
  openChat: () => void;
  startVoiceRecording: () => void;
  createVoiceNote: () => void;
  showDailySummary: () => void;
  toggleAssistant: () => void;
  showShortcuts: () => void;
}): KeyboardShortcut[] => {
  return [
    {
      key: 'k',
      meta: true,
      description: 'Open AI chat',
      action: callbacks.openChat
    },
    {
      key: 'v',
      meta: true,
      shift: true,
      description: 'Start voice recording',
      action: callbacks.startVoiceRecording
    },
    {
      key: 'n',
      meta: true,
      shift: true,
      description: 'Create voice note',
      action: callbacks.createVoiceNote
    },
    {
      key: 's',
      meta: true,
      shift: true,
      description: 'Show daily summary',
      action: callbacks.showDailySummary
    },
    {
      key: 'escape',
      description: 'Close AI assistant',
      action: callbacks.toggleAssistant
    },
    {
      key: '/',
      meta: true,
      description: 'Show keyboard shortcuts',
      action: callbacks.showShortcuts
    }
  ];
};
