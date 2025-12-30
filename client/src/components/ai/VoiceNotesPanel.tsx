/**
 * Voice Notes Panel Component
 * Quick voice recording and management for client sessions
 */

import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Mic,
  MicOff,
  Play,
  Pause,
  Trash2,
  Check,
  Clock,
  AlertCircle,
  Loader2,
  User
} from 'lucide-react';
import { triggerHaptic } from '@/hooks/useMobileGestures';

interface VoiceNote {
  id: string;
  clientId: string;
  clientName?: string;
  sessionId?: string;
  transcription: string;
  noteType: 'follow_up' | 'reminder' | 'observation' | 'general';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'reviewed' | 'completed' | 'archived';
  durationSeconds?: number;
  createdAt: string;
}

interface VoiceNotesPanelProps {
  clientId?: string;
  sessionId?: string;
  onClose?: () => void;
}

export function VoiceNotesPanel({ clientId, sessionId, onClose }: VoiceNotesPanelProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [selectedClient, setSelectedClient] = useState<string>(clientId || '');
  const [selectedPriority, setSelectedPriority] = useState<string>('normal');
  const [selectedType, setSelectedType] = useState<string>('follow_up');
  const [playingNoteId, setPlayingNoteId] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch clients for selection
  const { data: clientsData } = useQuery<{ clients: Array<{ id: string; name: string }> }>({
    queryKey: ['/api/clients'],
  });

  // Fetch voice notes
  const { data: notesData, refetch: refetchNotes } = useQuery<{ notes: VoiceNote[] }>({
    queryKey: clientId ? [`/api/voice-notes/client/${clientId}`] : ['/api/voice-notes/recent'],
  });

  // Create voice note mutation
  const createNoteMutation = useMutation({
    mutationFn: async (audioBlob: Blob) => {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(
        String.fromCharCode(...new Uint8Array(arrayBuffer))
      );

      const response = await fetch('/api/voice-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: selectedClient,
          sessionId,
          audio: base64Audio,
          noteType: selectedType,
          priority: selectedPriority
        })
      });

      if (!response.ok) throw new Error('Failed to create voice note');
      return response.json();
    },
    onSuccess: () => {
      refetchNotes();
      triggerHaptic('medium');
    }
  });

  // Update note status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ noteId, status }: { noteId: string; status: string }) => {
      const response = await fetch(`/api/voice-notes/${noteId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (!response.ok) throw new Error('Failed to update status');
      return response.json();
    },
    onSuccess: () => {
      refetchNotes();
      triggerHaptic('light');
    }
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const response = await fetch(`/api/voice-notes/${noteId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete note');
      return response.json();
    },
    onSuccess: () => {
      refetchNotes();
      triggerHaptic('medium');
    }
  });

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        createNoteMutation.mutate(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      triggerHaptic('light');

      // Start duration timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      triggerHaptic('medium');

      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  // Format duration
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get priority badge color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'normal': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get priority icon
  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return '🚨';
      case 'high': return '⚠️';
      case 'normal': return '📋';
      case 'low': return '📝';
      default: return '📝';
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
      }
    };
  }, [isRecording]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-sage/10">
        <h3 className="text-lg font-semibold text-evergreen mb-2">Voice Notes</h3>
        <p className="text-sm text-moss">Quick voice memos for client sessions</p>
      </div>

      {/* Recording Controls */}
      <div className="p-4 border-b border-sage/10 bg-ivory/30">
        <div className="space-y-3">
          {/* Client Selection */}
          {!clientId && (
            <div>
              <label className="text-xs font-medium text-moss mb-1 block">Client</label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clientsData?.clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Priority and Type */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-moss mb-1 block">Priority</label>
              <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-moss mb-1 block">Type</label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                  <SelectItem value="reminder">Reminder</SelectItem>
                  <SelectItem value="observation">Observation</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Record Button */}
          <Button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={createNoteMutation.isPending || (!selectedClient && !clientId)}
            className={`w-full ${
              isRecording
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-french-blue hover:bg-french-blue/90'
            }`}
            size="lg"
          >
            {createNoteMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Transcribing...
              </>
            ) : isRecording ? (
              <>
                <MicOff className="w-4 h-4 mr-2" />
                Stop Recording ({formatDuration(recordingDuration)})
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 mr-2" />
                Start Recording
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Voice Notes List */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {notesData?.notes.length === 0 ? (
            <div className="text-center py-8 text-moss">
              <Mic className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No voice notes yet</p>
              <p className="text-xs mt-1">Record your first note above</p>
            </div>
          ) : (
            notesData?.notes.map((note) => (
              <div
                key={note.id}
                className="p-3 rounded-lg bg-white border border-sage/10 hover:border-sage/30 transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <User className="w-4 h-4 text-moss flex-shrink-0" />
                    <span className="text-sm font-medium text-evergreen truncate">
                      {note.clientName || 'Unknown Client'}
                    </span>
                  </div>
                  <Badge className={`text-xs ${getPriorityColor(note.priority)}`}>
                    {getPriorityIcon(note.priority)} {note.priority}
                  </Badge>
                </div>

                {/* Transcription */}
                <p className="text-sm text-moss leading-relaxed mb-2">
                  {note.transcription}
                </p>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-moss/70">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(note.createdAt).toLocaleTimeString()}
                    </span>
                    {note.durationSeconds && (
                      <span>{formatDuration(note.durationSeconds)}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {note.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => updateStatusMutation.mutate({
                          noteId: note.id,
                          status: 'completed'
                        })}
                      >
                        <Check className="w-3 h-3 mr-1" />
                        Complete
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
                      onClick={() => {
                        if (confirm('Delete this voice note?')) {
                          deleteNoteMutation.mutate(note.id);
                        }
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
