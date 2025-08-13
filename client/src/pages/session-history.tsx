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

type SessionWithClient = Session & { client: Client };

export default function SessionHistory() {
  const [filterType, setFilterType] = useState<"all" | "completed" | "scheduled">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  
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
      case "completed": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "scheduled": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "cancelled": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "no-show": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
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
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid gap-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Session History</h1>
        <p className="text-muted-foreground">
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
                            <h4 className="font-medium">{session.client?.name || "Unknown Client"}</h4>
                            <Badge className={getStatusColor(session.status)}>
                              {session.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {formatInTimeZone(new Date(session.scheduledAt), 'America/New_York', 'MMM dd, yyyy • h:mm a')} • {session.duration} min • {session.sessionType}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {session.hasProgressNotePlaceholder && (
                          <FileText className="h-4 w-4 text-green-600" title="Has progress note placeholder" />
                        )}
                        {session.isSimplePracticeEvent && (
                          <Badge variant="outline" className="text-xs">
                            SimplePractice
                          </Badge>
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
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No sessions found</h3>
            <p className="text-muted-foreground">
              Try adjusting your filters or check if sessions have been imported from your calendar.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}