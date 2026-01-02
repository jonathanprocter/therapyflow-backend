import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Calendar,
  Clock,
  User,
  FileText,
  ChevronRight,
  Brain,
  Video,
  Users
} from 'lucide-react';

interface Session {
  id: string;
  clientId: string;
  scheduledAt: string;
  duration: number;
  sessionType: string;
  status: string;
  client?: {
    id: string;
    name: string;
  };
}

interface WeeklySessionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WeeklySessionsModal({ open, onOpenChange }: WeeklySessionsModalProps) {
  const [selectedDay, setSelectedDay] = useState<string>('all');

  // Fetch weekly sessions
  const { data: sessions, isLoading } = useQuery<Session[]>({
    queryKey: ['/api/sessions/weekly'],
    enabled: open,
  });

  // Group sessions by day
  const groupedSessions = sessions?.reduce((acc, session) => {
    const date = new Date(session.scheduledAt);
    const dayKey = date.toISOString().split('T')[0];
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });

    if (!acc[dayKey]) {
      acc[dayKey] = { dayName, date, sessions: [] };
    }
    acc[dayKey].sessions.push(session);
    return acc;
  }, {} as Record<string, { dayName: string; date: Date; sessions: Session[] }>) || {};

  const sortedDays = Object.entries(groupedSessions).sort(
    ([a], [b]) => {
      const dateA = a ? new Date(a).getTime() : 0;
      const dateB = b ? new Date(b).getTime() : 0;
      return dateA - dateB;
    }
  );

  const getSessionTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'telehealth':
      case 'video':
        return <Video className="h-4 w-4" />;
      case 'couples':
      case 'family':
        return <Users className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      scheduled: 'bg-sage/10 text-sage',
      confirmed: 'bg-french-blue/10 text-french-blue',
      completed: 'bg-moss/10 text-moss',
      cancelled: 'bg-red-100 text-red-700',
      'no-show': 'bg-amber-100 text-amber-700',
    };
    return styles[status] || styles.scheduled;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York'
    });
  };

  const filteredSessions = selectedDay === 'all'
    ? sortedDays
    : sortedDays.filter(([key]) => key === selectedDay);

  const totalSessions = sessions?.length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-evergreen">
            <Calendar className="h-5 w-5 text-sage" />
            This Week's Sessions
            <Badge className="bg-sage/10 text-sage ml-2">
              {totalSessions} scheduled
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="all" onValueChange={setSelectedDay}>
          <TabsList className="grid w-full grid-cols-6 mb-4">
            <TabsTrigger value="all" className="text-xs">
              All ({totalSessions})
            </TabsTrigger>
            {sortedDays.slice(0, 5).map(([key, { dayName, sessions: daySessions }]) => (
              <TabsTrigger key={key} value={key} className="text-xs">
                {dayName.slice(0, 3)} ({daySessions.length})
              </TabsTrigger>
            ))}
          </TabsList>

          <ScrollArea className="h-[50vh]">
            {isLoading ? (
              <div className="space-y-4 p-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-20 bg-sage/10 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 mx-auto text-sage/30 mb-4" />
                <h3 className="text-lg font-medium text-evergreen mb-2">
                  No sessions this week
                </h3>
                <p className="text-moss text-sm">
                  Your schedule is clear for the selected period
                </p>
              </div>
            ) : (
              <div className="space-y-6 p-2">
                {filteredSessions.map(([dayKey, { dayName, date, sessions: daySessions }]) => (
                  <div key={dayKey}>
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="text-sm font-semibold text-evergreen">
                        {dayName}
                      </h3>
                      <span className="text-xs text-moss">
                        {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {daySessions.length} session{daySessions.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      {daySessions
                        .sort((a, b) => {
                          const dateA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
                          const dateB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
                          return dateA - dateB;
                        })
                        .map((session) => (
                          <Card
                            key={session.id}
                            className="hover:shadow-md transition-shadow cursor-pointer border-sage/10"
                            onClick={() => {
                              window.location.href = `/session-prep/${session.id}?clientId=${session.clientId}`;
                            }}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <div className="h-10 w-10 rounded-full bg-french-blue/10 flex items-center justify-center">
                                    {getSessionTypeIcon(session.sessionType)}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-evergreen">
                                        {session.client?.name || 'Unknown Client'}
                                      </span>
                                      <Badge className={`text-xs ${getStatusBadge(session.status)}`}>
                                        {session.status}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-moss mt-1">
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {formatTime(session.scheduledAt)}
                                      </span>
                                      <span>{session.duration} min</span>
                                      <span className="capitalize">{session.sessionType}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-sage hover:text-evergreen"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.location.href = `/clients/${session.clientId}`;
                                    }}
                                  >
                                    <FileText className="h-4 w-4 mr-1" />
                                    Notes
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-french-blue hover:text-evergreen"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.location.href = `/api/sessions/${session.id}/prep`;
                                    }}
                                  >
                                    <Brain className="h-4 w-4 mr-1" />
                                    AI Prep
                                  </Button>
                                  <ChevronRight className="h-4 w-4 text-moss" />
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </Tabs>

        <div className="flex justify-between items-center pt-4 border-t border-sage/10">
          <span className="text-xs text-moss">
            Showing sessions for the current week (EDT)
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onOpenChange(false);
              window.location.href = '/calendar';
            }}
          >
            <Calendar className="h-4 w-4 mr-1" />
            Full Calendar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default WeeklySessionsModal;
