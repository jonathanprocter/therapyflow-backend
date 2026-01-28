import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Clock, FileText, Users, CheckCircle, AlertCircle, Eye, ExternalLink, X } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import type { Session, Client, Document, ProgressNote } from "@shared/schema";
import SessionSummaryGenerator from "@/components/sessions/SessionSummaryGenerator";

type SessionWithClient = Session & { client: Client };
type ProgressNoteWithSession = ProgressNote & { sessionId?: string };

export default function SessionHistory() {
  const [filterType, setFilterType] = useState<"all" | "completed" | "scheduled">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedSessionForSummary, setSelectedSessionForSummary] = useState<SessionWithClient | null>(null);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all historical sessions
  const { data: historicalSessions = [], isLoading: loadingSessions } = useQuery<SessionWithClient[]>({
    queryKey: ["/api/sessions/historical"],
    queryFn: async () => {
      const response = await fetch("/api/sessions/historical?includeCompleted=true");
      if (!response.ok) throw new Error("Failed to fetch historical sessions");
      return response.json();
    }
  });

  // Fetch clients for filtering
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients");
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    }
  });

  // Fetch all documents for linking to sessions
  const { data: allDocuments = [] } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
    queryFn: async () => {
      const response = await fetch("/api/documents");
      if (!response.ok) throw new Error("Failed to fetch documents");
      return response.json();
    }
  });

  // Fetch all progress notes for linking to sessions
  const { data: allProgressNotes = [] } = useQuery<ProgressNoteWithSession[]>({
    queryKey: ["/api/progress-notes"],
    queryFn: async () => {
      const response = await fetch("/api/progress-notes");
      if (!response.ok) throw new Error("Failed to fetch progress notes");
      return response.json();
    }
  });

  // Create maps for efficient document-session lookup
  const documentsBySessionId = useMemo(() => {
    const map = new Map<string, Document[]>();
    allDocuments.forEach(doc => {
      const metadata = doc.metadata as Record<string, any> | null;
      const sessionId = metadata?.sessionId || metadata?.linkedSessionId;
      if (sessionId) {
        const existing = map.get(sessionId) || [];
        existing.push(doc);
        map.set(sessionId, existing);
      }
    });
    return map;
  }, [allDocuments]);

  const documentsByDate = useMemo(() => {
    const map = new Map<string, Document[]>();
    allDocuments.forEach(doc => {
      const metadata = doc.metadata as Record<string, any> | null;
      const sessionDate = metadata?.sessionDate;
      if (sessionDate) {
        const dateKey = new Date(sessionDate).toISOString().split('T')[0];
        const existing = map.get(dateKey) || [];
        existing.push(doc);
        map.set(dateKey, existing);
      }
    });
    return map;
  }, [allDocuments]);

  // Create maps for progress notes by session ID and by date
  const progressNotesBySessionId = useMemo(() => {
    const map = new Map<string, ProgressNoteWithSession[]>();
    allProgressNotes.forEach(note => {
      if (note.sessionId) {
        const existing = map.get(note.sessionId) || [];
        existing.push(note);
        map.set(note.sessionId, existing);
      }
    });
    return map;
  }, [allProgressNotes]);

  const progressNotesByDate = useMemo(() => {
    const map = new Map<string, ProgressNoteWithSession[]>();
    allProgressNotes.forEach(note => {
      if (note.sessionDate) {
        const dateKey = new Date(note.sessionDate).toISOString().split('T')[0];
        const existing = map.get(dateKey) || [];
        existing.push(note);
        map.set(dateKey, existing);
      }
    });
    return map;
  }, [allProgressNotes]);

  // Get documents linked to a specific session
  const getDocumentsForSession = useCallback((session: SessionWithClient) => {
    const docs: Document[] = [];

    // Get documents directly linked by session ID
    const bySession = documentsBySessionId.get(session.id) || [];

    // Get documents linked by date
    const dateKey = new Date(session.scheduledAt).toISOString().split('T')[0];
    const byDate = documentsByDate.get(dateKey) || [];

    // Merge and deduplicate, filtering by client match
    for (const doc of [...bySession, ...byDate]) {
      if (doc.clientId === session.clientId && !docs.some(existing => existing.id === doc.id)) {
        docs.push(doc);
      }
    }

    return docs;
  }, [documentsBySessionId, documentsByDate]);

  // Get progress notes linked to a specific session
  const getProgressNotesForSession = useCallback((session: SessionWithClient) => {
    const notes: ProgressNoteWithSession[] = [];

    // Get notes directly linked by session ID
    const bySession = progressNotesBySessionId.get(session.id) || [];

    // Get notes linked by date (for orphaned notes)
    const dateKey = new Date(session.scheduledAt).toISOString().split('T')[0];
    const byDate = progressNotesByDate.get(dateKey) || [];

    // Merge and deduplicate, filtering by client match
    for (const note of [...bySession, ...byDate]) {
      if (note.clientId === session.clientId && !notes.some(existing => existing.id === note.id)) {
        // Skip placeholder notes with no content
        if (!note.isPlaceholder || note.content) {
          notes.push(note);
        }
      }
    }

    return notes;
  }, [progressNotesBySessionId, progressNotesByDate]);

  // Mark past sessions as completed
  const markPastCompletedMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/sessions/mark-past-completed", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!response.ok) throw new Error("Failed to mark past sessions as completed");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sessions Updated",
        description: data.message
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sessions/historical"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update past sessions",
        variant: "destructive"
      });
    }
  });

  // Create progress note placeholders
  const createPlaceholdersMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/sessions/create-progress-placeholders", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      if (!response.ok) throw new Error("Failed to create progress note placeholders");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Progress Notes Created",
        description: data.message
      });
      queryClient.invalidateQueries({ queryKey: ["/api/progress-notes"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create progress note placeholders",
        variant: "destructive"
      });
    }
  });

  // Filter sessions based on current filters
  const filteredSessions = historicalSessions.filter(session => {
    const matchesType = filterType === "all" || session.status === filterType;
    const matchesSearch = !searchTerm || 
      session.client?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.sessionType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClient = selectedClient === "all" || session.clientId === selectedClient;
    
    return matchesType && matchesSearch && matchesClient;
  });

  // Group sessions by year and month for better organization
  const groupedSessions = filteredSessions.reduce((groups, session) => {
    const date = new Date(session.scheduledAt);
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!groups[yearMonth]) {
      groups[yearMonth] = [];
    }
    groups[yearMonth].push(session);
    return groups;
  }, {} as Record<string, SessionWithClient[]>);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return { backgroundColor: 'rgba(142, 165, 140, 0.1)', color: '#8EA58C' };
      case "scheduled": return { backgroundColor: 'rgba(136, 165, 188, 0.1)', color: '#88A5BC' };
      case "cancelled": return { backgroundColor: 'rgba(115, 138, 110, 0.15)', color: '#738A6E' };
      case "no-show": return { backgroundColor: 'rgba(52, 76, 61, 0.1)', color: '#344C3D' };
      default: return { backgroundColor: 'rgba(115, 138, 110, 0.05)', color: '#738A6E' };
    }
  };

  const formatMonthYear = (yearMonth: string) => {
    const [year, month] = yearMonth.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return formatInTimeZone(date, 'America/New_York', 'MMMM yyyy');
  };

  if (loadingSessions) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-64 rounded" style={{ backgroundColor: 'rgba(115, 138, 110, 0.2)' }}></div>
          <div className="h-4 w-96 rounded" style={{ backgroundColor: 'rgba(115, 138, 110, 0.15)' }}></div>
        </div>
        <div className="grid gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 w-full rounded" style={{ backgroundColor: 'rgba(115, 138, 110, 0.1)' }}></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#344C3D' }}>Session History</h1>
        <p style={{ color: '#738A6E' }}>
          View and manage all historical therapy sessions and progress notes
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium" style={{ color: '#344C3D' }}>Total Sessions</CardTitle>
            <CalendarDays className="h-4 w-4" style={{ color: '#88A5BC' }} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: '#344C3D' }}>{historicalSessions.length}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium" style={{ color: '#344C3D' }}>Completed</CardTitle>
            <CheckCircle className="h-4 w-4" style={{ color: '#8EA58C' }} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: '#344C3D' }}>
              {historicalSessions.filter(s => s.status === "completed").length}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium" style={{ color: '#344C3D' }}>Active Clients</CardTitle>
            <Users className="h-4 w-4" style={{ color: '#88A5BC' }} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: '#344C3D' }}>
              {new Set(historicalSessions.map(s => s.clientId)).size}
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium" style={{ color: '#344C3D' }}>Total Hours</CardTitle>
            <Clock className="h-4 w-4" style={{ color: '#88A5BC' }} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: '#344C3D' }}>
              {Math.round(historicalSessions.reduce((total, s) => total + s.duration, 0) / 60)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Management Actions */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle style={{ color: '#344C3D' }}>Session Management</CardTitle>
          <CardDescription style={{ color: '#738A6E' }}>
            Actions to organize and manage your historical session records
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => markPastCompletedMutation.mutate()}
              disabled={markPastCompletedMutation.isPending}
              style={{ backgroundColor: '#8EA58C', borderColor: '#8EA58C', color: '#FFFFFF' }}
              className="hover:bg-opacity-90"
              data-testid="button-mark-past-completed"
            >
              {markPastCompletedMutation.isPending ? "Updating..." : "Mark Past Sessions as Completed"}
            </Button>
            
            <Button
              onClick={() => createPlaceholdersMutation.mutate()}
              disabled={createPlaceholdersMutation.isPending}
              variant="outline"
              style={{ borderColor: '#8EA58C', color: '#8EA58C' }}
              data-testid="button-create-placeholders"
            >
              {createPlaceholdersMutation.isPending ? "Creating..." : "Create Progress Note Placeholders"}
            </Button>
          </div>
          
          <p className="text-sm" style={{ color: '#738A6E' }}>
            These actions help organize your session history and prepare progress note slots for document uploads.
          </p>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="bg-white">
        <CardHeader>
          <CardTitle style={{ color: '#344C3D' }}>Filter Sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium" style={{ color: '#344C3D' }}>Status</label>
              <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                <SelectTrigger 
                  className="bg-white border focus:border-[#88A5BC] focus:ring-[#88A5BC] focus:ring-1"
                  style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(115, 138, 110, 0.3)', color: '#344C3D' }}
                  data-testid="select-status-filter"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sessions</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium" style={{ color: '#344C3D' }}>Client</label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger 
                  className="bg-white border focus:border-[#88A5BC] focus:ring-[#88A5BC] focus:ring-1"
                  style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(115, 138, 110, 0.3)', color: '#344C3D' }}
                  data-testid="select-client-filter"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium" style={{ color: '#344C3D' }}>Search</label>
              <Input
                placeholder="Search by client name or session type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white border focus:border-[#88A5BC] focus:ring-[#88A5BC] focus:ring-1"
                style={{ backgroundColor: '#FFFFFF', borderColor: 'rgba(115, 138, 110, 0.3)', color: '#344C3D' }}
                data-testid="input-search-sessions"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Session Groups */}
      <div className="space-y-6">
        {Object.entries(groupedSessions)
          .sort(([a], [b]) => b.localeCompare(a)) // Sort by date descending
          .map(([yearMonth, sessions]) => (
            <Card key={yearMonth} className="bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2" style={{ color: '#344C3D' }}>
                  <CalendarDays className="h-5 w-5" style={{ color: '#88A5BC' }} />
                  {formatMonthYear(yearMonth)}
                  <Badge variant="secondary" style={{ backgroundColor: '#8EA58C', color: '#FFFFFF' }}>{sessions.length} sessions</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {sessions.map(session => {
                    const linkedDocs = getDocumentsForSession(session);
                    const linkedNotes = getProgressNotesForSession(session);
                    return (
                      <div
                        key={session.id}
                        className="p-3 rounded-lg border transition-colors"
                        style={{
                          backgroundColor: '#FFFFFF',
                          borderColor: 'rgba(115, 138, 110, 0.2)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(242, 243, 241, 0.5)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#FFFFFF'}
                        data-testid={`session-card-${session.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium" style={{ color: '#344C3D' }}>{session.client?.name || "Unknown Client"}</h4>
                                <Badge
                                  className="rounded"
                                  style={getStatusColor(session.status)}
                                >
                                  {session.status}
                                </Badge>
                                {linkedNotes.length > 0 && (
                                  <Badge variant="secondary" className="text-xs" style={{ backgroundColor: 'rgba(142, 165, 140, 0.2)', color: '#8EA58C' }}>
                                    {linkedNotes.length} note{linkedNotes.length !== 1 ? 's' : ''}
                                  </Badge>
                                )}
                                {linkedDocs.length > 0 && (
                                  <Badge variant="secondary" className="text-xs" style={{ backgroundColor: 'rgba(136, 165, 188, 0.2)', color: '#88A5BC' }}>
                                    {linkedDocs.length} doc{linkedDocs.length !== 1 ? 's' : ''}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm" style={{ color: '#738A6E' }}>
                                {formatInTimeZone(new Date(session.scheduledAt), 'America/New_York', 'MMM dd, yyyy • h:mm a')} • {session.duration} min • {session.sessionType}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {session.hasProgressNotePlaceholder && (
                              <FileText className="h-4 w-4" style={{ color: '#8EA58C' }} />
                            )}
                            {session.isSimplePracticeEvent && (
                              <Badge variant="outline" className="text-xs" style={{ borderColor: '#88A5BC', color: '#88A5BC' }}>
                                SimplePractice
                              </Badge>
                            )}
                            {session.status === "completed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedSessionForSummary(session)}
                                style={{ borderColor: '#8EA58C', color: '#8EA58C' }}
                                data-testid={`generate-summary-${session.id}`}
                              >
                                <i className="fas fa-magic mr-2 text-xs"></i>
                                Summary
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Linked Progress Notes Section */}
                        {linkedNotes.length > 0 && (
                          <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(115, 138, 110, 0.15)' }}>
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="h-4 w-4" style={{ color: '#8EA58C' }} />
                              <span className="text-sm font-medium" style={{ color: '#344C3D' }}>Progress Notes</span>
                            </div>
                            <div className="space-y-2">
                              {linkedNotes.map(note => (
                                <div
                                  key={note.id}
                                  className="p-3 rounded-md border cursor-pointer hover:bg-gray-50"
                                  style={{
                                    backgroundColor: 'rgba(142, 165, 140, 0.05)',
                                    borderColor: 'rgba(142, 165, 140, 0.2)'
                                  }}
                                  onClick={() => window.location.href = `/progress-notes?noteId=${note.id}`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium" style={{ color: '#344C3D' }}>
                                        {formatInTimeZone(new Date(note.sessionDate), 'America/New_York', 'MMM dd, yyyy')}
                                      </span>
                                      {note.riskLevel && note.riskLevel !== 'low' && (
                                        <Badge
                                          variant="secondary"
                                          className="text-xs"
                                          style={{
                                            backgroundColor: note.riskLevel === 'high' || note.riskLevel === 'critical'
                                              ? 'rgba(239, 68, 68, 0.1)'
                                              : 'rgba(234, 179, 8, 0.1)',
                                            color: note.riskLevel === 'high' || note.riskLevel === 'critical'
                                              ? '#dc2626'
                                              : '#ca8a04'
                                          }}
                                        >
                                          {note.riskLevel} risk
                                        </Badge>
                                      )}
                                      {note.progressRating && (
                                        <span className="text-xs" style={{ color: '#738A6E' }}>
                                          Progress: {note.progressRating}/10
                                        </span>
                                      )}
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(`/progress-notes?noteId=${note.id}`, '_blank');
                                      }}
                                      title="Open note in new tab"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" style={{ color: '#8EA58C' }} />
                                    </Button>
                                  </div>
                                  {note.content && (
                                    <p className="text-sm line-clamp-2" style={{ color: '#738A6E' }}>
                                      {note.content.substring(0, 200)}{note.content.length > 200 ? '...' : ''}
                                    </p>
                                  )}
                                  {note.aiTags && note.aiTags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {note.aiTags.slice(0, 3).map((tag, idx) => (
                                        <span
                                          key={idx}
                                          className="text-xs px-2 py-0.5 rounded"
                                          style={{ backgroundColor: 'rgba(136, 165, 188, 0.1)', color: '#88A5BC' }}
                                        >
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Linked Documents Section */}
                        {linkedDocs.length > 0 && (
                          <div className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(115, 138, 110, 0.15)' }}>
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="h-4 w-4" style={{ color: '#88A5BC' }} />
                              <span className="text-sm font-medium" style={{ color: '#344C3D' }}>Linked Documents</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {linkedDocs.map(doc => (
                                <div
                                  key={doc.id}
                                  className="flex items-center gap-2 px-3 py-1.5 rounded-md border"
                                  style={{
                                    backgroundColor: 'rgba(136, 165, 188, 0.08)',
                                    borderColor: 'rgba(136, 165, 188, 0.2)'
                                  }}
                                >
                                  <span className="text-sm" style={{ color: '#344C3D' }}>
                                    {doc.fileName}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0"
                                      onClick={() => setPreviewDocument(doc)}
                                      title="Preview document"
                                    >
                                      <Eye className="h-3.5 w-3.5" style={{ color: '#88A5BC' }} />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 w-6 p-0"
                                      onClick={() => window.open(`/documents/${doc.id}`, '_blank')}
                                      title="Open document"
                                    >
                                      <ExternalLink className="h-3.5 w-3.5" style={{ color: '#8EA58C' }} />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      {filteredSessions.length === 0 && (
        <Card className="bg-white">
          <CardContent className="text-center py-8">
            <AlertCircle className="h-12 w-12 mx-auto mb-4" style={{ color: 'rgba(115, 138, 110, 0.3)' }} />
            <h3 className="text-lg font-medium mb-2" style={{ color: '#344C3D' }}>No sessions found</h3>
            <p style={{ color: '#738A6E' }}>
              Try adjusting your filters or check if sessions have been imported from your calendar.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Session Summary Modal */}
      {selectedSessionForSummary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <SessionSummaryGenerator
              sessionId={selectedSessionForSummary.id}
              clientId={selectedSessionForSummary.clientId}
              clientName={selectedSessionForSummary.client?.name || "Unknown Client"}
              sessionDate={new Date(selectedSessionForSummary.scheduledAt).toISOString()}
              onClose={() => setSelectedSessionForSummary(null)}
            />
          </div>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewDocument && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto bg-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle style={{ color: '#344C3D' }}>
                  {previewDocument.fileName}
                </CardTitle>
                <CardDescription style={{ color: '#738A6E' }}>
                  {previewDocument.fileType} • Uploaded {formatInTimeZone(new Date(previewDocument.uploadedAt), 'America/New_York', 'MMM dd, yyyy')}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPreviewDocument(null)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" style={{ color: '#738A6E' }} />
              </Button>
            </CardHeader>
            <CardContent>
              {previewDocument.extractedText ? (
                <div
                  className="prose prose-sm max-w-none p-4 rounded-lg border"
                  style={{
                    backgroundColor: 'rgba(242, 243, 241, 0.5)',
                    borderColor: 'rgba(115, 138, 110, 0.2)',
                    color: '#344C3D'
                  }}
                >
                  <pre className="whitespace-pre-wrap font-sans text-sm" style={{ color: '#344C3D' }}>
                    {previewDocument.extractedText}
                  </pre>
                </div>
              ) : (
                <div className="text-center py-8" style={{ color: '#738A6E' }}>
                  <FileText className="h-12 w-12 mx-auto mb-4" style={{ color: 'rgba(115, 138, 110, 0.3)' }} />
                  <p>No preview available for this document.</p>
                  <Button
                    className="mt-4"
                    onClick={() => window.open(`/documents/${previewDocument.id}`, '_blank')}
                    style={{ backgroundColor: '#8EA58C', color: '#FFFFFF' }}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Document
                  </Button>
                </div>
              )}
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setPreviewDocument(null)}
                  style={{ borderColor: '#738A6E', color: '#738A6E' }}
                >
                  Close
                </Button>
                <Button
                  onClick={() => window.open(`/documents/${previewDocument.id}`, '_blank')}
                  style={{ backgroundColor: '#8EA58C', color: '#FFFFFF' }}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Full Document
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}