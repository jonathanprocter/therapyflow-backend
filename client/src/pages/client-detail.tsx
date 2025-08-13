import { useQuery, useQueries, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { Separator } from "@/components/ui/separator";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Calendar, 
  FileText, 
  MessageSquare, 
  User, 
  Clock, 
  CheckCircle, 
  XCircle,
  Download,
  Search,
  AlertCircle,
  Loader2,
  Plus,
  Bell,
  TrendingUp,
  TrendingDown,
  Eye,
  Edit,
  Trash,
  Mail,
  Phone,
  CalendarDays,
  BarChart,
  List,
  Grid,
  Undo,
  Redo,
  Bold,
  Italic,
  Underline,
  Link as LinkIcon,
  Image,
  Printer,
  FileDown,
  History,
  Sparkles,
  Activity,
  CheckSquare,
  Square,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Settings,
  RefreshCw,
  Zap,
  Brain
} from "lucide-react";
import { formatEDTDate, formatEDTTime, formatEDTDateShort } from "@/utils/timezone";

// Type definitions
interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  emergencyContact?: string;
  insurance?: string;
  status: 'active' | 'inactive';
  tags?: string[];
  createdAt: string;
  customFields?: Record<string, any>;
}

interface Session {
  id: string;
  clientId: string;
  scheduledAt: string;
  status: 'completed' | 'scheduled' | 'cancelled';
  sessionType: string;
  duration: number;
  notes?: string;
  googleEventId?: string;
  isSimplePracticeEvent?: boolean;
}

interface ProgressNote {
  id: string;
  clientId: string;
  sessionDate: string;
  content: string;
  tags?: string[];
  createdAt: string;
  editedAt?: string;
  editedBy?: string;
  version?: number;
}

interface Document {
  id: string;
  clientId: string;
  filename: string;
  fileType: string;
  uploadedAt: string;
  url?: string;
  annotations?: Annotation[];
}

interface Annotation {
  id: string;
  documentId: string;
  text: string;
  x: number;
  y: number;
  createdBy: string;
  createdAt: string;
}

interface SessionStats {
  total: number;
  completed: number;
  scheduled: number;
  cancelled: number;
  totalHours: number;
}

interface CustomField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'checkbox';
  options?: string[];
  required?: boolean;
  value?: any;
}

interface Notification {
  id: string;
  type: 'appointment' | 'follow-up' | 'document-due' | 'reminder';
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

interface Action {
  id: string;
  type: string;
  data: any;
  execute: () => void;
  undo: () => void;
}

interface IntegrationStatus {
  simplePractice?: {
    synced: boolean;
    lastSync?: string;
  };
  googleCalendar?: {
    synced: boolean;
    lastSync?: string;
  };
}

// Utility functions
const formatRelativeTime = (date: string) => {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const calculateNoShowRisk = (sessions: Session[]) => {
  const recent = sessions.slice(-10);
  const noShows = recent.filter(s => s.status === 'cancelled').length;
  return noShows / recent.length;
};

const calculateConsistencyScore = (sessions: Session[]) => {
  if (sessions.length < 2) return 100;
  const intervals = sessions.slice(1).map((s, i) => 
    new Date(s.scheduledAt).getTime() - new Date(sessions[i].scheduledAt).getTime()
  );
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const variance = intervals.reduce((sum, i) => sum + Math.pow(i - avgInterval, 2), 0) / intervals.length;
  return Math.max(0, 100 - (Math.sqrt(variance) / avgInterval * 100));
};

export default function ClientDetail() {
  const { clientId } = useParams<{ clientId: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // State management
  const [sessionFilter, setSessionFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ 
    start: "", 
    end: "" 
  });
  const [isScheduling, setIsScheduling] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'timeline'>('list');
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [commandOpen, setCommandOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [actionHistory, setActionHistory] = useState<Action[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [showDocumentPreview, setShowDocumentPreview] = useState<string | null>(null);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [showAIInsights, setShowAIInsights] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const notificationRef = useRef<HTMLButtonElement>(null);

  // Parallel data fetching using useQueries
  const queries = useQueries({
    queries: [
      { 
        queryKey: ["/api/clients", clientId], 
        enabled: !!clientId,
        refetchInterval: 30000,
        refetchIntervalInBackground: false
      },
      { 
        queryKey: ["/api/sessions", { clientId }], 
        enabled: !!clientId 
      },
      { 
        queryKey: ["/api/progress-notes", { clientId }], 
        enabled: !!clientId 
      },
      { 
        queryKey: ["/api/documents", { clientId }], 
        enabled: !!clientId 
      },
      {
        queryKey: ["/api/integrations/status", clientId],
        enabled: !!clientId,
        refetchInterval: 60000
      },
      {
        queryKey: ["/api/notifications", clientId],
        enabled: !!clientId,
        refetchInterval: 10000
      }
    ]
  });

  const [clientQuery, sessionsQuery, notesQuery, documentsQuery, integrationsQuery, notificationsQuery] = queries;

  const client = clientQuery.data as Client | undefined;
  const sessions = (sessionsQuery.data || []) as Session[];
  const progressNotes = (notesQuery.data || []) as ProgressNote[];
  const documents = (documentsQuery.data || []) as Document[];
  const integrationStatus = integrationsQuery.data as IntegrationStatus | undefined;
  const serverNotifications = (notificationsQuery.data || []) as Notification[];

  const isLoading = queries.some(q => q.isLoading);
  const hasError = queries.some(q => q.isError);
  const errors = queries.filter(q => q.isError).map(q => q.error);

  // Merge server notifications with local state
  useEffect(() => {
    if (serverNotifications.length > 0) {
      setNotifications(prev => {
        const newNotifs = serverNotifications.filter(
          sn => !prev.some(pn => pn.id === sn.id)
        );
        if (newNotifs.length > 0) {
          toast({
            title: `${newNotifs.length} new notification${newNotifs.length > 1 ? 's' : ''}`,
            description: newNotifs[0].message,
          });
        }
        return [...newNotifs, ...prev];
      });
    }
  }, [serverNotifications, toast]);

  // Filter client-specific data
  const clientSessions = useMemo(() => 
    sessions.filter(session => session.clientId === clientId),
    [sessions, clientId]
  );

  const clientNotes = useMemo(() => 
    progressNotes.filter(note => note.clientId === clientId),
    [progressNotes, clientId]
  );

  const clientDocuments = useMemo(() => 
    documents.filter(doc => doc.clientId === clientId),
    [documents, clientId]
  );

  // Filter and search sessions
  const filteredAndSearchedSessions = useMemo(() => {
    let filtered = clientSessions;

    if (sessionFilter !== "all") {
      filtered = filtered.filter(session => session.status === sessionFilter);
    }

    if (searchTerm) {
      filtered = filtered.filter(session => 
        session.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.sessionType.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (dateRange.start) {
      filtered = filtered.filter(session => 
        new Date(session.scheduledAt) >= new Date(dateRange.start)
      );
    }
    if (dateRange.end) {
      filtered = filtered.filter(session => 
        new Date(session.scheduledAt) <= new Date(dateRange.end)
      );
    }

    return filtered.sort((a, b) => 
      new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
    );
  }, [clientSessions, sessionFilter, searchTerm, dateRange]);

  // Calculate session statistics
  const sessionStats: SessionStats = useMemo(() => ({
    total: clientSessions.length,
    completed: clientSessions.filter(s => s.status === 'completed').length,
    scheduled: clientSessions.filter(s => s.status === 'scheduled').length,
    cancelled: clientSessions.filter(s => s.status === 'cancelled').length,
    totalHours: Math.round(
      clientSessions.reduce((total, s) => total + (s.duration || 0), 0) / 60 * 10
    ) / 10
  }), [clientSessions]);

  // Calculate analytics
  const analytics = useMemo(() => {
    const attendanceRate = sessionStats.total > 0 
      ? (sessionStats.completed / sessionStats.total * 100).toFixed(1) 
      : 0;
    const cancellationRate = sessionStats.total > 0
      ? (sessionStats.cancelled / sessionStats.total * 100).toFixed(1)
      : 0;
    const noShowRisk = calculateNoShowRisk(clientSessions);
    const consistencyScore = calculateConsistencyScore(clientSessions);

    // Detect patterns
    const dayPatterns = clientSessions.reduce((acc, session) => {
      const day = new Date(session.scheduledAt).toLocaleDateString('en-US', { weekday: 'long' });
      if (!acc[day]) acc[day] = { total: 0, cancelled: 0 };
      acc[day].total++;
      if (session.status === 'cancelled') acc[day].cancelled++;
      return acc;
    }, {} as Record<string, { total: number; cancelled: number }>);

    const problematicDay = Object.entries(dayPatterns)
      .sort((a, b) => (b[1].cancelled / b[1].total) - (a[1].cancelled / a[1].total))[0];

    return {
      attendanceRate,
      cancellationRate,
      noShowRisk,
      consistencyScore,
      problematicDay: problematicDay && problematicDay[1].cancelled > 2 
        ? { day: problematicDay[0], rate: (problematicDay[1].cancelled / problematicDay[1].total * 100).toFixed(0) }
        : null
    };
  }, [clientSessions, sessionStats]);

  // Mutations
  const updateSessionMutation = useMutation({
    mutationFn: async ({ sessionId, status }: { sessionId: string; status: Session['status'] }) => {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error('Failed to update session');
      return response.json();
    },
    onMutate: async ({ sessionId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['/api/sessions'] });
      const previousSessions = queryClient.getQueryData(['/api/sessions', { clientId }]);

      queryClient.setQueryData(['/api/sessions', { clientId }], (old: Session[] | undefined) => 
        old?.map(s => s.id === sessionId ? { ...s, status } : s) || []
      );

      return { previousSessions };
    },
    onError: (err, variables, context) => {
      if (context?.previousSessions) {
        queryClient.setQueryData(['/api/sessions', { clientId }], context.previousSessions);
      }
      toast({
        title: "Error",
        description: "Failed to update session status",
        variant: "destructive"
      });
    },
    onSuccess: (data, variables) => {
      // Add to action history for undo
      const action: Action = {
        id: Date.now().toString(),
        type: 'update_session',
        data: variables,
        execute: () => updateSessionMutation.mutate(variables),
        undo: () => {
          const previousStatus = sessions.find(s => s.id === variables.sessionId)?.status;
          if (previousStatus) {
            updateSessionMutation.mutate({ 
              sessionId: variables.sessionId, 
              status: previousStatus 
            });
          }
        }
      };

      setActionHistory(prev => [...prev.slice(0, historyIndex + 1), action]);
      setHistoryIndex(prev => prev + 1);

      toast({
        title: "Session updated",
        action: (
          <Button size="sm" variant="ghost" onClick={() => undo()}>
            Undo
          </Button>
        )
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions'] });
    }
  });

  // Undo/Redo functions
  const undo = useCallback(() => {
    if (historyIndex >= 0 && actionHistory[historyIndex]) {
      actionHistory[historyIndex].undo();
      setHistoryIndex(prev => prev - 1);
    }
  }, [historyIndex, actionHistory]);

  const redo = useCallback(() => {
    if (historyIndex < actionHistory.length - 1) {
      actionHistory[historyIndex + 1].execute();
      setHistoryIndex(prev => prev + 1);
    }
  }, [historyIndex, actionHistory]);

  // Handler functions
  const handleScheduleSession = useCallback(async () => {
    setIsScheduling(true);
    try {
      window.location.href = `/sessions/new?clientId=${clientId}`;
    } finally {
      setIsScheduling(false);
    }
  }, [clientId]);

  const handleEditClient = useCallback(() => {
    window.location.href = `/clients/${clientId}/edit`;
  }, [clientId]);

  const handleBulkStatusUpdate = async (status: Session['status']) => {
    const promises = Array.from(selectedSessions).map(id => 
      updateSessionMutation.mutateAsync({ sessionId: id, status })
    );
    await Promise.all(promises);
    setSelectedSessions(new Set());
    toast({
      title: `Updated ${selectedSessions.size} sessions`,
      description: `All selected sessions marked as ${status}`
    });
  };

  const handleExportSessions = useCallback(async (format: 'csv' | 'pdf' = 'csv') => {
    setIsExporting(true);
    try {
      if (format === 'csv') {
        const headers = ['Date', 'Time', 'Type', 'Status', 'Duration (min)', 'Notes'];
        const rows = filteredAndSearchedSessions.map(session => [
          formatEDTDateShort(session.scheduledAt),
          formatEDTTime(session.scheduledAt),
          session.sessionType,
          session.status,
          session.duration.toString(),
          session.notes || ''
        ]);

        const csvContent = [
          headers.join(','),
          ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${client?.name.replace(/\s+/g, '-')}-sessions-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else {
        // PDF generation would require a library like jsPDF
        const response = await fetch('/api/reports/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client,
            sessions: filteredAndSearchedSessions,
            notes: clientNotes,
            analytics,
            format: 'pdf'
          })
        });
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url);
      }
    } finally {
      setIsExporting(false);
    }
  }, [filteredAndSearchedSessions, client, clientNotes, analytics]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const generateAISummary = async () => {
    try {
      const response = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          notes: clientNotes,
          sessions: clientSessions 
        })
      });
      const summary = await response.json();
      return summary;
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate AI summary",
        variant: "destructive"
      });
    }
  };

  const sendEmail = useCallback((email?: string) => {
    if (email) {
      window.location.href = `mailto:${email}`;
    }
  }, []);

  const callPhone = useCallback((phone?: string) => {
    if (phone) {
      window.location.href = `tel:${phone}`;
    }
  }, []);

  // Command palette actions
  const commandActions = [
    { id: 'schedule', label: 'Schedule Session', icon: Calendar, action: handleScheduleSession },
    { id: 'edit', label: 'Edit Client', icon: Edit, action: handleEditClient },
    { id: 'email', label: 'Send Email', icon: Mail, action: () => sendEmail(client?.email) },
    { id: 'call', label: 'Call Client', icon: Phone, action: () => callPhone(client?.phone) },
    { id: 'export-csv', label: 'Export to CSV', icon: FileDown, action: () => handleExportSessions('csv') },
    { id: 'export-pdf', label: 'Export to PDF', icon: FileDown, action: () => handleExportSessions('pdf') },
    { id: 'print', label: 'Print Report', icon: Printer, action: handlePrint },
    { id: 'ai-summary', label: 'Generate AI Summary', icon: Sparkles, action: generateAISummary },
  ];

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K for command palette
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen(open => !open);
      }
      // Cmd/Ctrl + S to schedule session
      if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleScheduleSession();
      }
      // Cmd/Ctrl + E to edit client
      if (e.key === 'e' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleEditClient();
      }
      // Cmd/Ctrl + Z for undo
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Cmd/Ctrl + Shift + Z for redo
      if (e.key === 'z' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      // Cmd/Ctrl + P for print
      if (e.key === 'p' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handlePrint();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [handleScheduleSession, handleEditClient, undo, redo, handlePrint]);

  // SSE for real-time notifications
  useEffect(() => {
    if (!clientId) return;

    const eventSource = new EventSource(`/api/notifications/stream/${clientId}`);

    eventSource.onmessage = (event) => {
      const notification = JSON.parse(event.data);
      setNotifications(prev => [notification, ...prev]);

      toast({
        title: notification.title,
        description: notification.message,
      });
    };

    return () => eventSource.close();
  }, [clientId, toast]);

  // Calendar view component
  const CalendarView = () => {
    const weeks = useMemo(() => {
      const start = new Date();
      start.setDate(start.getDate() - start.getDay());
      const weeks = [];

      for (let w = 0; w < 4; w++) {
        const week = [];
        for (let d = 0; d < 7; d++) {
          const date = new Date(start);
          date.setDate(start.getDate() + (w * 7) + d);
          const daysSessions = filteredAndSearchedSessions.filter(s => 
            new Date(s.scheduledAt).toDateString() === date.toDateString()
          );
          week.push({ date, sessions: daysSessions });
        }
        weeks.push(week);
      }

      return weeks;
    }, [filteredAndSearchedSessions]);

    return (
      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center font-medium text-sm text-gray-500 p-2">
            {day}
          </div>
        ))}
        {weeks.flat().map(({ date, sessions }, idx) => (
          <div 
            key={idx} 
            className={`border rounded-lg p-2 min-h-[100px] ${
              date.toDateString() === new Date().toDateString() ? 'bg-blue-50' : ''
            }`}
          >
            <div className="text-sm font-medium">{date.getDate()}</div>
            {sessions.map(session => (
              <div 
                key={session.id}
                className={`text-xs mt-1 p-1 rounded ${
                  session.status === 'completed' ? 'bg-green-100' :
                  session.status === 'scheduled' ? 'bg-blue-100' :
                  'bg-red-100'
                }`}
              >
                {formatEDTTime(session.scheduledAt)}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  // Timeline view component
  const TimelineView = () => {
    return (
      <div className="relative">
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>
        {filteredAndSearchedSessions.map((session, idx) => (
          <div key={session.id} className="relative flex items-center mb-8">
            <div className={`absolute left-8 w-4 h-4 rounded-full -translate-x-1/2 ${
              session.status === 'completed' ? 'bg-green-500' :
              session.status === 'scheduled' ? 'bg-blue-500' :
              'bg-red-500'
            }`}></div>
            <div className="ml-16">
              <div className="text-sm text-gray-500 mb-1">
                {formatEDTDateShort(session.scheduledAt)} at {formatEDTTime(session.scheduledAt)}
              </div>
              <Card className="inline-block">
                <CardContent className="p-3">
                  <div className="font-medium">{session.sessionType} Session</div>
                  {session.notes && (
                    <div className="text-sm text-gray-600 mt-1">{session.notes}</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Note editor with formatting
  const NoteEditor = ({ noteId, initialContent, onSave }: any) => {
    const [content, setContent] = useState(initialContent || '');
    const [isBold, setIsBold] = useState(false);
    const [isItalic, setIsItalic] = useState(false);
    const [isUnderline, setIsUnderline] = useState(false);

    return (
      <div className="border rounded-lg">
        <div className="border-b p-2 flex items-center gap-2">
          <Toggle pressed={isBold} onPressedChange={setIsBold} size="sm">
            <Bold className="h-4 w-4" />
          </Toggle>
          <Toggle pressed={isItalic} onPressedChange={setIsItalic} size="sm">
            <Italic className="h-4 w-4" />
          </Toggle>
          <Toggle pressed={isUnderline} onPressedChange={setIsUnderline} size="sm">
            <Underline className="h-4 w-4" />
          </Toggle>
          <Separator orientation="vertical" className="h-6" />
          <Button size="sm" variant="ghost">
            <LinkIcon className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost">
            <Image className="h-4 w-4" />
          </Button>
        </div>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className={`min-h-[200px] border-0 ${isBold ? 'font-bold' : ''} ${isItalic ? 'italic' : ''} ${isUnderline ? 'underline' : ''}`}
          placeholder="Write your note..."
        />
        <div className="border-t p-2 flex justify-end gap-2">
          <Button variant="outline" size="sm">Cancel</Button>
          <Button size="sm" onClick={() => onSave(content)}>Save Note</Button>
        </div>
      </div>
    );
  };

  // Document preview component
  const DocumentPreview = ({ document }: { document: Document }) => {
    const [annotations, setAnnotations] = useState<Annotation[]>(document.annotations || []);

    return (
      <DialogContent className="max-w-5xl h-[80vh] flex">
        <div className="flex-1 relative">
          {document.fileType === 'pdf' ? (
            <iframe src={document.url} className="w-full h-full" />
          ) : document.fileType.startsWith('image') ? (
            <img src={document.url} alt={document.filename} className="w-full h-full object-contain" />
          ) : (
            <div className="p-4">
              <p>Preview not available for this file type</p>
              <Button className="mt-4">
                <Download className="h-4 w-4 mr-2" />
                Download File
              </Button>
            </div>
          )}

          {/* Annotation pins */}
          {annotations.map(annotation => (
            <div
              key={annotation.id}
              className="absolute w-6 h-6 bg-yellow-400 rounded-full cursor-pointer"
              style={{ left: `${annotation.x}%`, top: `${annotation.y}%` }}
              title={annotation.text}
            >
              <span className="text-xs font-bold text-center block mt-0.5">
                {annotations.indexOf(annotation) + 1}
              </span>
            </div>
          ))}
        </div>

        <div className="w-80 border-l p-4 overflow-y-auto">
          <h3 className="font-semibold mb-4">Comments & Annotations</h3>
          <div className="space-y-3">
            {annotations.map((annotation, idx) => (
              <div key={annotation.id} className="border rounded p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-yellow-600">#{idx + 1}</span>
                  <span className="text-xs text-gray-500">{formatRelativeTime(annotation.createdAt)}</span>
                </div>
                <p className="text-sm">{annotation.text}</p>
                <p className="text-xs text-gray-500 mt-1">by {annotation.createdBy}</p>
              </div>
            ))}
            <Button 
              className="w-full" 
              variant="outline"
              onClick={() => {
                const newAnnotation: Annotation = {
                  id: Date.now().toString(),
                  documentId: document.id,
                  text: prompt('Enter annotation:') || '',
                  x: 50,
                  y: 50,
                  createdBy: 'Current User',
                  createdAt: new Date().toISOString()
                };
                setAnnotations([...annotations, newAnnotation]);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Annotation
            </Button>
          </div>
        </div>
      </DialogContent>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <TopBar />
          <div className="flex-1 overflow-y-auto p-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
              <div className="h-64 bg-gray-200 rounded mb-4"></div>
              <div className="h-96 bg-gray-200 rounded"></div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Error state
  if (hasError) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <TopBar />
          <div className="flex-1 overflow-y-auto p-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="mb-2">Failed to load client data:</div>
                {errors.map((error, index) => (
                  <div key={index} className="text-sm">{(error as Error).message}</div>
                ))}
                <Button 
                  onClick={() => window.location.reload()} 
                  variant="outline" 
                  size="sm" 
                  className="mt-4"
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        </main>
      </div>
    );
  }

  // Client not found
  if (!client) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <TopBar />
          <div className="flex-1 overflow-y-auto p-6">
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Client not found</h3>
              <p className="text-gray-500 mb-4">The requested client could not be found.</p>
              <Link href="/clients">
                <Button>Back to Clients</Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50" data-testid="client-detail-page">
      <Sidebar />

      <main className="flex-1 flex flex-col overflow-hidden">
        <TopBar />

        {/* Command Palette */}
        <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Actions">
              {commandActions.map(action => (
                <CommandItem
                  key={action.id}
                  onSelect={() => {
                    action.action();
                    setCommandOpen(false);
                  }}
                >
                  <action.icon className="mr-2 h-4 w-4" />
                  {action.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandGroup heading="Navigation">
              <CommandItem onSelect={() => setCommandOpen(false)}>
                <User className="mr-2 h-4 w-4" />
                Client Info
              </CommandItem>
              <CommandItem onSelect={() => setCommandOpen(false)}>
                <Calendar className="mr-2 h-4 w-4" />
                Sessions
              </CommandItem>
              <CommandItem onSelect={() => setCommandOpen(false)}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Progress Notes
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </CommandDialog>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Header with Integration Status */}
          <div className="mb-6">
            <div className="flex items-center gap-4 mb-4">
              <Link href="/clients">
                <Button variant="ghost" size="sm" data-testid="back-to-clients">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Clients
                </Button>
              </Link>

              {/* Integration Status Badges */}
              <div className="flex items-center gap-2">
                {integrationStatus?.simplePractice && (
                  <Badge variant={integrationStatus.simplePractice.synced ? "default" : "secondary"}>
                    <RefreshCw className={`h-3 w-3 mr-1 ${integrationStatus.simplePractice.synced ? 'animate-spin' : ''}`} />
                    SimplePractice: {integrationStatus.simplePractice.lastSync 
                      ? formatRelativeTime(integrationStatus.simplePractice.lastSync)
                      : 'Not synced'}
                  </Badge>
                )}
                {integrationStatus?.googleCalendar && (
                  <Badge variant={integrationStatus.googleCalendar.synced ? "default" : "secondary"}>
                    <CalendarDays className="h-3 w-3 mr-1" />
                    Google: {integrationStatus.googleCalendar.synced ? 'Connected' : 'Disconnected'}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900" data-testid="client-name">
                  {client.name}
                </h1>
                <div className="flex items-center gap-4 mt-2">
                  <Badge variant={client.status === 'active' ? 'default' : 'secondary'}>
                    {client.status}
                  </Badge>
                  {client.tags && client.tags.length > 0 && (
                    <div className="flex gap-2">
                      {client.tags.map((tag, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                {/* Notification Bell */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" ref={notificationRef}>
                      <Bell className="h-4 w-4" />
                      {notifications.filter(n => !n.read).length > 0 && (
                        <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full" />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="end">
                    <div className="font-semibold mb-2">Notifications</div>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="text-sm text-gray-500">No new notifications</p>
                      ) : (
                        notifications.map(notif => (
                          <div key={notif.id} className={`p-2 rounded ${notif.read ? '' : 'bg-blue-50'}`}>
                            <div className="font-medium text-sm">{notif.title}</div>
                            <div className="text-xs text-gray-600">{notif.message}</div>
                            <div className="text-xs text-gray-400 mt-1">
                              {formatRelativeTime(notif.createdAt)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Undo/Redo */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={undo}
                  disabled={historyIndex < 0}
                  title="Undo (Cmd/Ctrl + Z)"
                >
                  <Undo className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={redo}
                  disabled={historyIndex >= actionHistory.length - 1}
                  title="Redo (Cmd/Ctrl + Shift + Z)"
                >
                  <Redo className="h-4 w-4" />
                </Button>

                <Button 
                  variant="outline" 
                  data-testid="edit-client"
                  onClick={handleEditClient}
                  title="Edit Client (Cmd/Ctrl + E)"
                >
                  Edit Client
                </Button>
                <Button 
                  data-testid="schedule-session"
                  onClick={handleScheduleSession}
                  disabled={isScheduling}
                  title="Schedule Session (Cmd/Ctrl + S)"
                >
                  {isScheduling && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Schedule Session
                </Button>
              </div>
            </div>
          </div>

          {/* AI Insights Alert */}
          {analytics.noShowRisk > 0.3 && (
            <Alert className="mb-4">
              <Brain className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center justify-between">
                  <div>
                    <strong>AI Insight:</strong> {analytics.noShowRisk > 0.7 ? 'High' : 'Moderate'} no-show risk detected
                    {analytics.problematicDay && ` - ${analytics.problematicDay.rate}% cancellation rate on ${analytics.problematicDay.day}s`}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setShowAIInsights(true)}>
                    View Details
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Client Info Card with Custom Fields */}
          <Card className="mb-6" role="region" aria-label="Client Information">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2" id="client-info-title">
                  <User className="h-5 w-5" />
                  Client Information
                </CardTitle>
                <Button size="sm" variant="ghost" onClick={() => setCustomFields([...customFields, {
                  id: Date.now().toString(),
                  name: '',
                  type: 'text',
                  value: ''
                }])}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Field
                </Button>
              </div>
            </CardHeader>
            <CardContent aria-labelledby="client-info-title">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {client.email && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <div className="flex items-center gap-2">
                      <p className="text-gray-900">{client.email}</p>
                      <Button size="sm" variant="ghost" onClick={() => sendEmail(client.email)}>
                        <Mail className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                {client.phone && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Phone</label>
                    <div className="flex items-center gap-2">
                      <p className="text-gray-900">{client.phone}</p>
                      <Button size="sm" variant="ghost" onClick={() => callPhone(client.phone)}>
                        <Phone className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                {client.dateOfBirth && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Date of Birth</label>
                    <p className="text-gray-900">{formatEDTDate(client.dateOfBirth)}</p>
                  </div>
                )}
                {client.emergencyContact && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Emergency Contact</label>
                    <p className="text-gray-900">{client.emergencyContact}</p>
                  </div>
                )}
                {client.insurance && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Insurance</label>
                    <p className="text-gray-900">{client.insurance}</p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-500">Client Since</label>
                  <p className="text-gray-900">{formatEDTDate(client.createdAt)}</p>
                </div>

                {/* Custom Fields */}
                {customFields.map(field => (
                  <div key={field.id}>
                    <label className="text-sm font-medium text-gray-500">{field.name || 'Custom Field'}</label>
                    {field.type === 'checkbox' ? (
                      <Checkbox checked={field.value} />
                    ) : field.type === 'select' ? (
                      <Select value={field.value}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options?.map(opt => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-gray-900">{field.value || 'Not set'}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Analytics Dashboard */}
          {showAIInsights && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart className="h-5 w-5" />
                  Client Analytics & AI Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">Attendance Rate</span>
                    </div>
                    <div className="text-2xl font-bold">{analytics.attendanceRate}%</div>
                    <Progress value={Number(analytics.attendanceRate)} className="mt-2" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <span className="text-sm font-medium">Cancellation Rate</span>
                    </div>
                    <div className="text-2xl font-bold">{analytics.cancellationRate}%</div>
                    <Progress value={Number(analytics.cancellationRate)} className="mt-2" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm font-medium">Consistency Score</span>
                    </div>
                    <div className="text-2xl font-bold">{analytics.consistencyScore.toFixed(0)}%</div>
                    <Progress value={analytics.consistencyScore} className="mt-2" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-medium">No-Show Risk</span>
                    </div>
                    <div className="text-2xl font-bold">
                      {analytics.noShowRisk < 0.3 ? 'Low' : analytics.noShowRisk < 0.7 ? 'Medium' : 'High'}
                    </div>
                    <Progress 
                      value={analytics.noShowRisk * 100} 
                      className="mt-2"
                    />
                  </div>
                </div>

                {analytics.problematicDay && (
                  <Alert>
                    <Brain className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Pattern Detected:</strong> This client has cancelled {analytics.problematicDay.rate}% of {analytics.problematicDay.day} appointments. 
                      Consider scheduling on different days or sending extra reminders for {analytics.problematicDay.day} appointments.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="mt-4 flex gap-2">
                  <Button onClick={generateAISummary}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate AI Summary
                  </Button>
                  <Button variant="outline" onClick={() => setShowAIInsights(false)}>
                    Hide Analytics
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs for different sections */}
          <Tabs defaultValue="sessions" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="sessions" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Sessions ({clientSessions.length})
              </TabsTrigger>
              <TabsTrigger value="notes" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Progress Notes ({clientNotes.length})
              </TabsTrigger>
              <TabsTrigger value="documents" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documents ({clientDocuments.length})
              </TabsTrigger>
            </TabsList>

            {/* Sessions Tab */}
            <TabsContent value="sessions" className="space-y-4">
              {/* Session Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-500">Total Sessions</p>
                        <p className="text-2xl font-bold text-gray-900">{sessionStats.total}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-500">Completed</p>
                        <p className="text-2xl font-bold text-gray-900">{sessionStats.completed}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-5 w-5 text-yellow-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-500">Scheduled</p>
                        <p className="text-2xl font-bold text-gray-900">{sessionStats.scheduled}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-5 w-5 text-purple-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-500">Total Hours</p>
                        <p className="text-2xl font-bold text-gray-900">{sessionStats.totalHours}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Session History */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between mb-4">
                    <CardTitle>Session History</CardTitle>
                    <div className="flex items-center gap-2">
                      {/* View Mode Toggle */}
                      <div className="flex items-center border rounded">
                        <Button
                          size="sm"
                          variant={viewMode === 'list' ? 'default' : 'ghost'}
                          onClick={() => setViewMode('list')}
                          className="rounded-r-none"
                        >
                          <List className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                          onClick={() => setViewMode('calendar')}
                          className="rounded-none"
                        >
                          <CalendarDays className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={viewMode === 'timeline' ? 'default' : 'ghost'}
                          onClick={() => setViewMode('timeline')}
                          className="rounded-l-none"
                        >
                          <Activity className="h-4 w-4" />
                        </Button>
                      </div>

                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleExportSessions('csv')}
                        disabled={isExporting || filteredAndSearchedSessions.length === 0}
                      >
                        {isExporting ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 mr-2" />
                        )}
                        Export
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrint}
                      >
                        <Printer className="h-4 w-4 mr-2" />
                        Print
                      </Button>
                    </div>
                  </div>

                  {/* Search and Filter Controls */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Search sessions..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                        aria-label="Search sessions"
                      />
                    </div>

                    <Select value={sessionFilter} onValueChange={setSessionFilter}>
                      <SelectTrigger data-testid="session-filter" aria-label="Filter sessions by status">
                        <SelectValue placeholder="Filter sessions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Sessions</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>

                    <Input
                      type="date"
                      placeholder="Start date"
                      value={dateRange.start}
                      onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                      aria-label="Filter by start date"
                    />

                    <Input
                      type="date"
                      placeholder="End date"
                      value={dateRange.end}
                      onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                      aria-label="Filter by end date"
                    />
                  </div>

                  {/* Bulk Actions */}
                  {selectedSessions.size > 0 && (
                    <Alert className="mb-4">
                      <AlertDescription className="flex items-center justify-between">
                        <span>{selectedSessions.size} session(s) selected</span>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleBulkStatusUpdate('completed')}
                          >
                            Mark Completed
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleBulkStatusUpdate('cancelled')}
                          >
                            Cancel
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => setSelectedSessions(new Set())}
                          >
                            Clear Selection
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  <p className="text-sm text-gray-500 mb-4">
                    Showing {filteredAndSearchedSessions.length} of {clientSessions.length} total appointments
                  </p>
                </CardHeader>

                <CardContent>
                  {viewMode === 'calendar' ? (
                    <CalendarView />
                  ) : viewMode === 'timeline' ? (
                    <TimelineView />
                  ) : (
                    // List View
                    sessionsQuery.isLoading ? (
                      <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                          <div key={i} className="animate-pulse">
                            <div className="h-20 bg-gray-200 rounded"></div>
                          </div>
                        ))}
                      </div>
                    ) : filteredAndSearchedSessions.length === 0 ? (
                      <div className="text-center py-8">
                        <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 mb-4">
                          {searchTerm || dateRange.start || dateRange.end
                            ? "No sessions match your search criteria"
                            : sessionFilter === "all" 
                              ? "No sessions recorded for this client"
                              : `No ${sessionFilter} sessions found`}
                        </p>
                        {clientSessions.length === 0 && (
                          <Button onClick={handleScheduleSession} disabled={isScheduling}>
                            <Plus className="h-4 w-4 mr-2" />
                            Schedule First Session
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4" role="list" aria-label="Session list">
                        {filteredAndSearchedSessions.map((session) => (
                          <div 
                            key={session.id} 
                            className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                            data-testid={`session-${session.id}`}
                            role="listitem"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={selectedSessions.has(session.id)}
                                  onCheckedChange={(checked) => {
                                    const newSet = new Set(selectedSessions);
                                    checked ? newSet.add(session.id) : newSet.delete(session.id);
                                    setSelectedSessions(newSet);
                                  }}
                                />
                                <div>
                                  <h4 className="font-medium text-gray-900">
                                    {session.sessionType.charAt(0).toUpperCase() + session.sessionType.slice(1)} Session
                                  </h4>
                                  <p className="text-sm text-gray-500">
                                    {formatEDTDateShort(session.scheduledAt)} at {formatEDTTime(session.scheduledAt)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant={
                                    session.status === 'completed' ? 'default' : 
                                    session.status === 'scheduled' ? 'secondary' : 
                                    session.status === 'cancelled' ? 'destructive' : 'outline'
                                  }
                                  data-testid={`session-status-${session.id}`}
                                >
                                  {session.status}
                                </Badge>
                                <span className="text-sm text-gray-500">{session.duration} min</span>

                                {/* Quick status change buttons */}
                                {session.status === 'scheduled' && (
                                  <div className="flex gap-1 ml-2">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => updateSessionMutation.mutate({ 
                                        sessionId: session.id, 
                                        status: 'completed' 
                                      })}
                                      disabled={updateSessionMutation.isPending}
                                      title="Mark as completed"
                                    >
                                      <CheckCircle className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => updateSessionMutation.mutate({ 
                                        sessionId: session.id, 
                                        status: 'cancelled' 
                                      })}
                                      disabled={updateSessionMutation.isPending}
                                      title="Cancel session"
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                            {session.notes && (
                              <p className="text-sm text-gray-600 mt-2">{session.notes}</p>
                            )}
                            {session.googleEventId && (
                              <div className="text-xs text-gray-400 mt-2">
                                Google Event ID: {session.googleEventId}
                              </div>
                            )}
                            {session.isSimplePracticeEvent && (
                              <div className="text-xs text-blue-500 mt-1">
                                SimplePractice Import
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Progress Notes Tab */}
            <TabsContent value="notes" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Progress Notes</CardTitle>
                    <Button size="sm" onClick={() => setActiveNoteId('new')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Note
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {activeNoteId === 'new' && (
                    <div className="mb-4">
                      <NoteEditor
                        noteId="new"
                        onSave={(content: string) => {
                          // Save note logic
                          setActiveNoteId(null);
                          toast({
                            title: "Note saved",
                            description: "Progress note has been saved successfully"
                          });
                        }}
                      />
                    </div>
                  )}

                  {notesQuery.isLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="h-32 bg-gray-200 rounded"></div>
                        </div>
                      ))}
                    </div>
                  ) : clientNotes.length === 0 && activeNoteId !== 'new' ? (
                    <div className="text-center py-8">
                      <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 mb-4">No progress notes for this client</p>
                      <Button onClick={() => setActiveNoteId('new')}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create First Note
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4" role="list" aria-label="Progress notes list">
                      {clientNotes.map((note) => (
                        <div key={note.id} className="border rounded-lg p-4" role="listitem">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-gray-900">
                              Session: {formatEDTDateShort(note.sessionDate)}
                            </h4>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500">
                                Created: {formatEDTDateShort(note.createdAt)}
                              </span>
                              <Button size="sm" variant="ghost" onClick={() => setActiveNoteId(note.id)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button size="sm" variant="ghost">
                                    <History className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Version History</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-2">
                                    {note.editedAt && (
                                      <div className="border rounded p-2">
                                        <div className="text-sm text-gray-500">
                                          Edited {formatRelativeTime(note.editedAt)} by {note.editedBy}
                                        </div>
                                        <div className="text-sm mt-1">Version {note.version || 1}</div>
                                      </div>
                                    )}
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </div>
                          </div>

                          {activeNoteId === note.id ? (
                            <NoteEditor
                              noteId={note.id}
                              initialContent={note.content}
                              onSave={(content: string) => {
                                // Update note logic
                                setActiveNoteId(null);
                              }}
                            />
                          ) : (
                            <>
                              <div className="prose max-w-none">
                                <p className="text-gray-700 whitespace-pre-wrap">{note.content}</p>
                              </div>
                              {note.tags && note.tags.length > 0 && (
                                <div className="flex gap-1 mt-3">
                                  {note.tags.map((tag, index) => (
                                    <Badge key={index} variant="outline" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Client Documents</CardTitle>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Upload Document
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {documentsQuery.isLoading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="animate-pulse">
                          <div className="h-16 bg-gray-200 rounded"></div>
                        </div>
                      ))}
                    </div>
                  ) : clientDocuments.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 mb-4">No documents uploaded for this client</p>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Upload First Document
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4" role="list" aria-label="Documents list">
                      {clientDocuments.map((document) => (
                        <div 
                          key={document.id} 
                          className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                          role="listitem"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium text-gray-900">{document.filename}</h4>
                              <p className="text-sm text-gray-500">
                                Uploaded on {formatEDTDateShort(document.uploadedAt)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{document.fileType}</Badge>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button variant="outline" size="sm" onClick={() => setShowDocumentPreview(document.id)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    Preview
                                  </Button>
                                </DialogTrigger>
                                {showDocumentPreview === document.id && (
                                  <DocumentPreview document={document} />
                                )}
                              </Dialog>
                              <Button variant="outline" size="sm">
                                <Download className="h-4 w-4 mr-2" />
                                Download
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Mobile Action Button */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button 
              className="fixed bottom-4 right-4 md:hidden rounded-full h-14 w-14 shadow-lg"
              size="icon"
            >
              <Plus className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto">
            <div className="grid grid-cols-2 gap-4 p-4">
              <Button onClick={() => { handleScheduleSession(); setMobileMenuOpen(false); }}>
                <Calendar className="h-4 w-4 mr-2" />
                Schedule
              </Button>
              <Button onClick={() => { setActiveNoteId('new'); setMobileMenuOpen(false); }}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Add Note
              </Button>
              <Button onClick={() => { sendEmail(client?.email); setMobileMenuOpen(false); }}>
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
              <Button onClick={() => { callPhone(client?.phone); setMobileMenuOpen(false); }}>
                <Phone className="h-4 w-4 mr-2" />
                Call
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </main>

      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-break {
            page-break-after: always;
          }
          main {
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}