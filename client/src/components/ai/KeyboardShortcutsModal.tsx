/**
 * Keyboard Shortcuts Help Modal
 * Display available keyboard shortcuts
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Keyboard, Command } from 'lucide-react';
import { formatShortcut, type KeyboardShortcut } from '@/hooks/useKeyboardShortcuts';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: KeyboardShortcut[];
}

interface ShortcutGroup {
  title: string;
  shortcuts: KeyboardShortcut[];
}

export function KeyboardShortcutsModal({ isOpen, onClose, shortcuts }: KeyboardShortcutsModalProps) {
  // Group shortcuts by category
  const groupedShortcuts: ShortcutGroup[] = [
    {
      title: 'AI Assistant',
      shortcuts: shortcuts.filter(s => 
        s.description.toLowerCase().includes('ai') ||
        s.description.toLowerCase().includes('chat') ||
        s.description.toLowerCase().includes('assistant')
      )
    },
    {
      title: 'Voice & Recording',
      shortcuts: shortcuts.filter(s => 
        s.description.toLowerCase().includes('voice') ||
        s.description.toLowerCase().includes('recording') ||
        s.description.toLowerCase().includes('note')
      )
    },
    {
      title: 'Navigation',
      shortcuts: shortcuts.filter(s => 
        s.description.toLowerCase().includes('close') ||
        s.description.toLowerCase().includes('show') ||
        s.description.toLowerCase().includes('open')
      )
    }
  ].filter(group => group.shortcuts.length > 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-evergreen">
            <Keyboard className="w-5 h-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Speed up your workflow with these keyboard shortcuts
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {groupedShortcuts.map((group, groupIndex) => (
            <div key={groupIndex}>
              <h3 className="text-sm font-semibold text-moss mb-3">{group.title}</h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg bg-ivory/50 hover:bg-ivory transition-colors"
                  >
                    <span className="text-sm text-evergreen">{shortcut.description}</span>
                    <Badge variant="outline" className="font-mono text-xs bg-white">
                      {formatShortcut(shortcut)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Tips Section */}
          <div className="mt-6 p-4 rounded-lg bg-french-blue/10 border border-french-blue/20">
            <h3 className="text-sm font-semibold text-french-blue mb-2 flex items-center gap-2">
              <Command className="w-4 h-4" />
              Pro Tips
            </h3>
            <ul className="text-xs text-moss space-y-1 list-disc list-inside">
              <li>Press <kbd className="px-1 py-0.5 bg-white rounded border text-xs">Cmd/Ctrl + /</kbd> anytime to see this help</li>
              <li>Shortcuts work from anywhere in the app (except when typing)</li>
              <li>Use <kbd className="px-1 py-0.5 bg-white rounded border text-xs">Escape</kbd> to quickly close modals and panels</li>
              <li>Voice shortcuts work even when AI assistant is minimized</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
