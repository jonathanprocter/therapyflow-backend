import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Clock, FileText, Users, CheckCircle, AlertCircle } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import type { Session, Client } from "@shared/schema";
import SessionSummaryGenerator from "@/components/sessions/SessionSummaryGenerator";

type SessionWithClient = Session & { client: Client };

export default function SessionHistory() {
  const [filterType, setFilterType] = useState<"all" | "completed" | "scheduled">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedSessionForSummary, setSelectedSessionForSummary] = useState<SessionWithClient | null>(null);
  
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{historicalSessions.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {historicalSessions.filter(s => s.status === "completed").length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(historicalSessions.map(s => s.clientId)).size}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(historicalSessions.reduce((total, s) => total + s.duration, 0) / 60)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Management Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Session Management</CardTitle>
          <CardDescription>
            Actions to organize and manage your historical session records
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => markPastCompletedMutation.mutate()}
              disabled={markPastCompletedMutation.isPending}
              data-testid="button-mark-past-completed"
            >
              {markPastCompletedMutation.isPending ? "Updating..." : "Mark Past Sessions as Completed"}
            </Button>
            
            <Button
              onClick={() => createPlaceholdersMutation.mutate()}
              disabled={createPlaceholdersMutation.isPending}
              variant="outline"
              data-testid="button-create-placeholders"
            >
              {createPlaceholdersMutation.isPending ? "Creating..." : "Create Progress Note Placeholders"}
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground">
            These actions help organize your session history and prepare progress note slots for document uploads.
          </p>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
                <SelectTrigger data-testid="select-status-filter">
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
              <label className="text-sm font-medium">Client</label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger data-testid="select-client-filter">
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
              <label className="text-sm font-medium">Search</label>
              <Input
                placeholder="Search by client name or session type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
            <Card key={yearMonth}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5" />
                  {formatMonthYear(yearMonth)}
                  <Badge variant="secondary">{sessions.length} sessions</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {sessions.map(session => (
                    <div
                      key={session.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      data-testid={`session-card-${session.id}`}
                    >
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
                          </div>
                          <p className="text-sm" style={{ color: '#738A6E' }}>
                            {formatInTimeZone(new Date(session.scheduledAt), 'America/New_York', 'MMM dd, yyyy • h:mm a')} • {session.duration} min • {session.sessionType}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {session.hasProgressNotePlaceholder && (
                          <FileText className="h-4 w-4" style={{ color: '#8EA58C' }} title="Has progress note placeholder" />
                        )}
                        {session.isSimplePracticeEvent && (
                          <Badge variant="outline" className="text-xs">
                            SimplePractice
                          </Badge>
                        )}
                        {session.status === "completed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedSessionForSummary(session)}
                            data-testid={`generate-summary-${session.id}`}
                          >
                            <i className="fas fa-magic mr-2 text-xs"></i>
                            Summary
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      {filteredSessions.length === 0 && (
        <Card>
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
              sessionDate={selectedSessionForSummary.scheduledAt}
              onClose={() => setSelectedSessionForSummary(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}