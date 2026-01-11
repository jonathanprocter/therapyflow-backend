import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatEDTDate, formatEDTDateTime } from "@/utils/timezone";
import { 
  Calendar, 
  Clock, 
  Users, 
  FileText, 
  TrendingUp, 
  Filter,
  Eye,
  Zap,
  Target,
  Brain,
  Heart,
  Activity,
  ChevronRight,
  ChevronLeft,
  Search,
  BarChart3,
  PieChart,
  GitCommit
} from "lucide-react";

interface SessionTimelineData {
  id: string;
  clientId: string;
  clientName: string;
  sessionDate: Date;
  sessionType: string;
  status: string;
  duration?: number;
  progressNoteId?: string;
  themes?: string[];
  mood?: string;
  progressRating?: number;
  riskLevel?: string;
  interventions?: string[];
  nextSteps?: string[];
}

interface TimelineFilters {
  clientId: string;
  sessionType: string;
  dateRange: string;
  riskLevel: string;
  searchTerm: string;
}

export default function SessionTimeline() {
  const [selectedSession, setSelectedSession] = useState<SessionTimelineData | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'calendar' | 'analytics'>('timeline');
  const [timeScale, setTimeScale] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [filters, setFilters] = useState<TimelineFilters>({
    clientId: 'all',
    sessionType: 'all',
    dateRange: '6months',
    riskLevel: 'all',
    searchTerm: ''
  });

  const { data: sessions, isLoading } = useQuery<SessionTimelineData[]>({
    queryKey: ["/api/sessions/timeline", filters],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all' && value !== '') {
          searchParams.append(key, value);
        }
      });
      
      const response = await fetch(`/api/sessions/timeline?${searchParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch timeline data');
      return response.json();
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["/api/clients"],
  });

  const { data: progressNotes } = useQuery({
    queryKey: ["/api/progress-notes"],
    queryFn: async () => {
      const response = await fetch('/api/progress-notes?recent=true');
      if (!response.ok) throw new Error('Failed to fetch progress notes');
      return response.json();
    },
  });

  // Filter and process sessions data
  const filteredSessions = useMemo(() => {
    if (!sessions) return [];
    
    return sessions.filter(session => {
      if (filters.clientId !== 'all' && session.clientId !== filters.clientId) return false;
      if (filters.sessionType !== 'all' && session.sessionType !== filters.sessionType) return false;
      if (filters.riskLevel !== 'all' && session.riskLevel !== filters.riskLevel) return false;
      if (filters.searchTerm && !session.clientName.toLowerCase().includes(filters.searchTerm.toLowerCase()) &&
          !session.themes?.some(theme => theme.toLowerCase().includes(filters.searchTerm.toLowerCase()))) return false;
      
      // Date range filtering
      const sessionDate = new Date(session.sessionDate);
      const now = new Date();
      const months = filters.dateRange === '3months' ? 3 : filters.dateRange === '6months' ? 6 : 12;
      const cutoffDate = new Date(now.setMonth(now.getMonth() - months));
      
      return sessionDate >= cutoffDate;
    }).sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());
  }, [sessions, filters]);

  // Group sessions by time period
  const groupedSessions = useMemo(() => {
    const groups: { [key: string]: SessionTimelineData[] } = {};
    
    filteredSessions.forEach(session => {
      const date = new Date(session.sessionDate);
      let key: string;
      
      switch (timeScale) {
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = `Week of ${formatEDTDate(weekStart)}`;
          break;
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          break;
        case 'quarter':
          const quarter = Math.floor(date.getMonth() / 3) + 1;
          key = `${date.getFullYear()} Q${quarter}`;
          break;
        case 'year':
          key = date.getFullYear().toString();
          break;
        default:
          key = formatEDTDate(date);
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(session);
    });
    
    return groups;
  }, [filteredSessions, timeScale]);

  // Analytics data
  const analytics = useMemo(() => {
    if (!filteredSessions.length) return {};
    
    const totalSessions = filteredSessions.length;
    const clientDistribution = filteredSessions.reduce((acc, session) => {
      acc[session.clientName] = (acc[session.clientName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const sessionTypeDistribution = filteredSessions.reduce((acc, session) => {
      acc[session.sessionType] = (acc[session.sessionType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const averageProgressRating = filteredSessions
      .filter(s => s.progressRating)
      .reduce((sum, s) => sum + (s.progressRating || 0), 0) / 
      filteredSessions.filter(s => s.progressRating).length;
    
    const riskDistribution = filteredSessions.reduce((acc, session) => {
      const risk = session.riskLevel || 'unknown';
      acc[risk] = (acc[risk] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalSessions,
      clientDistribution,
      sessionTypeDistribution,
      averageProgressRating,
      riskDistribution
    };
  }, [filteredSessions]);

  const getRiskLevelColor = (riskLevel?: string) => {
    switch (riskLevel) {
      case "critical": return "bg-ink/20 text-ink border-ink/30";
      case "high": return "bg-sepia/20 text-sepia border-sepia/30";
      case "moderate": return "bg-teal/20 text-teal border-teal/30";
      case "low": return "bg-teal/20 text-teal border-teal/30";
      default: return "bg-parchment text-sepia border-sepia/20";
    }
  };

  const getProgressRatingColor = (rating?: number) => {
    if (!rating) return "text-sepia";
    if (rating >= 8) return "text-teal";
    if (rating >= 6) return "text-teal";
    if (rating >= 4) return "text-sepia";
    return "text-ink";
  };

  const SessionCard = ({ session }: { session: SessionTimelineData }) => (
    <Card 
      className="bg-white border-sepia/20 hover:border-teal/30 cursor-pointer transition-all duration-200 hover:shadow-md"
      onClick={() => setSelectedSession(session)}
      data-testid={`session-card-${session.id}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="font-semibold text-ink text-sm">{session.clientName}</h3>
              <Badge variant="outline" className="text-xs bg-teal/10 text-teal border-teal/30">
                {session.sessionType}
              </Badge>
              {session.riskLevel && (
                <Badge variant="outline" className={`text-xs ${getRiskLevelColor(session.riskLevel)}`}>
                  {session.riskLevel}
                </Badge>
              )}
            </div>
            
            <div className="flex items-center space-x-4 text-xs text-sepia mb-2">
              <div className="flex items-center space-x-1">
                <Calendar className="h-3 w-3" />
                <span>{formatEDTDate(session.sessionDate)}</span>
              </div>
              {session.duration && (
                <div className="flex items-center space-x-1">
                  <Clock className="h-3 w-3" />
                  <span>{session.duration}min</span>
                </div>
              )}
              {session.progressRating && (
                <div className="flex items-center space-x-1">
                  <TrendingUp className="h-3 w-3" />
                  <span className={getProgressRatingColor(session.progressRating)}>
                    {session.progressRating}/10
                  </span>
                </div>
              )}
            </div>
            
            {session.themes && session.themes.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {session.themes.slice(0, 3).map((theme, index) => (
                  <Badge key={index} variant="outline" className="text-xs bg-parchment text-sepia border-sepia/20">
                    {theme}
                  </Badge>
                ))}
                {session.themes.length > 3 && (
                  <Badge variant="outline" className="text-xs bg-parchment text-sepia border-sepia/20">
                    +{session.themes.length - 3} more
                  </Badge>
                )}
              </div>
            )}
          </div>
          
          <div className="flex flex-col items-end space-y-1">
            {session.progressNoteId && (
              <FileText className="h-4 w-4 text-teal" />
            )}
            <ChevronRight className="h-4 w-4 text-sepia" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const TimelineView = () => (
    <div className="space-y-6">
      {Object.entries(groupedSessions).map(([period, sessions]) => (
        <div key={period} className="space-y-3">
          <div className="flex items-center space-x-2 sticky top-0 bg-parchment/80 backdrop-blur-sm py-2 z-10">
            <div className="w-3 h-3 bg-teal rounded-full"></div>
            <h3 className="font-semibold text-ink text-lg">{period}</h3>
            <Badge variant="outline" className="bg-sepia/10 text-sepia border-sepia/30">
              {sessions.length} sessions
            </Badge>
          </div>
          
          <div className="ml-6 border-l-2 border-teal/20 pl-6 space-y-3">
            {sessions.map((session) => (
              <div key={session.id} className="relative">
                <div className="absolute -left-8 top-4 w-2 h-2 bg-teal rounded-full border-2 border-white"></div>
                <SessionCard session={session} />
              </div>
            ))}
          </div>
        </div>
      ))}
      
      {filteredSessions.length === 0 && (
        <div className="text-center py-12">
          <GitCommit className="h-16 w-16 text-teal/40 mx-auto mb-4" />
          <p className="text-lg text-sepia mb-2">No sessions found</p>
          <p className="text-sm text-sepia/70">Try adjusting your filters to see more sessions</p>
        </div>
      )}
    </div>
  );

  const AnalyticsView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <Card className="bg-white border-sepia/20">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-ink">
            <BarChart3 className="h-5 w-5 text-teal" />
            <span>Session Overview</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sepia">Total Sessions</span>
              <span className="font-semibold text-ink">{analytics.totalSessions}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sepia">Average Rating</span>
              <span className={`font-semibold ${getProgressRatingColor(analytics.averageProgressRating)}`}>
                {analytics.averageProgressRating ? analytics.averageProgressRating.toFixed(1) : 'N/A'}/10
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-sepia/20">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-ink">
            <Users className="h-5 w-5 text-teal" />
            <span>Client Distribution</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {Object.entries(analytics.clientDistribution || {}).map(([client, count]) => (
              <div key={client} className="flex justify-between text-sm">
                <span className="text-sepia truncate">{client}</span>
                <span className="font-medium text-ink">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-sepia/20">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-ink">
            <PieChart className="h-5 w-5 text-teal" />
            <span>Session Types</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(analytics.sessionTypeDistribution || {}).map(([type, count]) => (
              <div key={type} className="flex justify-between text-sm">
                <span className="text-sepia capitalize">{type}</span>
                <span className="font-medium text-ink">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white border-sepia/20">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-ink">
            <Heart className="h-5 w-5 text-teal" />
            <span>Risk Levels</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Object.entries(analytics.riskDistribution || {}).map(([risk, count]) => (
              <div key={risk} className="flex justify-between text-sm">
                <span className="text-sepia capitalize">{risk}</span>
                <span className="font-medium text-ink">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-6" data-testid="session-timeline-page">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink" data-testid="timeline-title">
            Session Timeline
          </h1>
          <p className="text-sepia" data-testid="timeline-subtitle">
            Interactive visualization of therapy sessions and progress over time
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as any)}>
            <TabsList className="bg-white">
              <TabsTrigger value="timeline" className="data-[state=active]:bg-teal data-[state=active]:text-white">
                <GitCommit className="h-4 w-4 mr-1" />
                Timeline
              </TabsTrigger>
              <TabsTrigger value="analytics" className="data-[state=active]:bg-teal data-[state=active]:text-white">
                <BarChart3 className="h-4 w-4 mr-1" />
                Analytics
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-white border-sepia/20 mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2 text-ink">
            <Filter className="h-5 w-5 text-teal" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <Label className="text-ink">Client</Label>
              <Select value={filters.clientId} onValueChange={(value) => setFilters({...filters, clientId: value})}>
                <SelectTrigger className="border-sepia/30 focus:ring-sage focus:border-teal" data-testid="filter-client">
                  <SelectValue placeholder="All clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {Array.isArray(clients) && clients.map((client: any) => (
                    <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-ink">Session Type</Label>
              <Select value={filters.sessionType} onValueChange={(value) => setFilters({...filters, sessionType: value})}>
                <SelectTrigger className="border-sepia/30 focus:ring-sage focus:border-teal" data-testid="filter-session-type">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="couples">Couples</SelectItem>
                  <SelectItem value="session without patient present">Session Without Patient Present</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-ink">Date Range</Label>
              <Select value={filters.dateRange} onValueChange={(value) => setFilters({...filters, dateRange: value})}>
                <SelectTrigger className="border-sepia/30 focus:ring-sage focus:border-teal" data-testid="filter-date-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3months">Last 3 Months</SelectItem>
                  <SelectItem value="6months">Last 6 Months</SelectItem>
                  <SelectItem value="12months">Last 12 Months</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-ink">Risk Level</Label>
              <Select value={filters.riskLevel} onValueChange={(value) => setFilters({...filters, riskLevel: value})}>
                <SelectTrigger className="border-sepia/30 focus:ring-sage focus:border-teal" data-testid="filter-risk-level">
                  <SelectValue placeholder="All levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-ink">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-sepia" />
                <Input
                  placeholder="Search clients, themes..."
                  value={filters.searchTerm}
                  onChange={(e) => setFilters({...filters, searchTerm: e.target.value})}
                  className="pl-9 border-sepia/30 focus:ring-sage focus:border-teal"
                  data-testid="filter-search"
                />
              </div>
            </div>
          </div>

          {viewMode === 'timeline' && (
            <div className="mt-4 flex items-center space-x-4">
              <Label className="text-ink">Time Scale:</Label>
              <Select value={timeScale} onValueChange={(value) => setTimeScale(value as any)}>
                <SelectTrigger className="w-32 border-sepia/30 focus:ring-sage focus:border-teal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="quarter">Quarter</SelectItem>
                  <SelectItem value="year">Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal mx-auto"></div>
          <p className="mt-2 text-sepia">Loading session data...</p>
        </div>
      ) : viewMode === 'timeline' ? (
        <TimelineView />
      ) : (
        <AnalyticsView />
      )}

      {/* Session Detail Dialog */}
      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle className="text-ink">Session Details</DialogTitle>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-ink">Client</Label>
                  <p className="text-sepia">{selectedSession.clientName}</p>
                </div>
                <div>
                  <Label className="text-ink">Date & Time</Label>
                  <p className="text-sepia">{formatEDTDateTime(selectedSession.sessionDate)}</p>
                </div>
                <div>
                  <Label className="text-ink">Session Type</Label>
                  <p className="text-sepia capitalize">{selectedSession.sessionType}</p>
                </div>
                <div>
                  <Label className="text-ink">Duration</Label>
                  <p className="text-sepia">{selectedSession.duration ? `${selectedSession.duration} minutes` : 'Not specified'}</p>
                </div>
              </div>

              {selectedSession.themes && selectedSession.themes.length > 0 && (
                <div>
                  <Label className="text-ink">Themes</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedSession.themes.map((theme, index) => (
                      <Badge key={index} variant="outline" className="bg-parchment text-sepia border-sepia/20">
                        {theme}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {selectedSession.interventions && selectedSession.interventions.length > 0 && (
                <div>
                  <Label className="text-ink">Interventions</Label>
                  <ul className="list-disc list-inside text-sepia text-sm mt-1 space-y-1">
                    {selectedSession.interventions.map((intervention, index) => (
                      <li key={index}>{intervention}</li>
                    ))}
                  </ul>
                </div>
              )}

              {selectedSession.nextSteps && selectedSession.nextSteps.length > 0 && (
                <div>
                  <Label className="text-ink">Next Steps</Label>
                  <ul className="list-disc list-inside text-sepia text-sm mt-1 space-y-1">
                    {selectedSession.nextSteps.map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-between pt-4">
                {selectedSession.progressNoteId && (
                  <Button variant="outline" className="text-teal border-teal/30 hover:bg-teal/10">
                    <FileText className="h-4 w-4 mr-2" />
                    View Progress Note
                  </Button>
                )}
                <Button 
                  onClick={() => setSelectedSession(null)}
                  className="bg-teal hover:bg-teal/80 text-white"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}