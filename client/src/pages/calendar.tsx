import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { SessionWithClient } from "@/types/clinical";

export default function Calendar() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: todaySessions, isLoading } = useQuery<SessionWithClient[]>({
    queryKey: ["/api/sessions", { upcoming: true }],
  });

  const { data: allSessions } = useQuery<SessionWithClient[]>({
    queryKey: ["/api/sessions", { date: selectedDate.toISOString() }],
  });

  const getSessionTypeColor = (sessionType: string, index: number) => {
    const colorMap: { [key: string]: string } = {
      "individual": "primary",
      "couples": "secondary", 
      "family": "accent",
      "group": "sage"
    };
    const colors = ["primary", "secondary", "accent", "sage"];
    return colorMap[sessionType.toLowerCase()] || colors[index % colors.length];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "text-white";
      case "scheduled": return "text-white"; 
      case "cancelled": return "text-white";
      case "no-show": return "text-white";
      default: return "text-white";
    }
  };

  const formatSessionTime = (scheduledAt: Date, duration: number) => {
    const start = new Date(scheduledAt);
    const end = new Date(start.getTime() + duration * 60000);
    
    // Format times in EDT timezone
    const edtOptions: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York'
    };
    
    return {
      startTime: start.toLocaleTimeString('en-US', edtOptions),
      endTime: end.toLocaleTimeString('en-US', edtOptions),
      timeRange: `${start.toLocaleTimeString('en-US', edtOptions)} - ${end.toLocaleTimeString('en-US', edtOptions)}`
    };
  };

  return (
    <div className="space-y-6" data-testid="calendar-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#344C3D' }} data-testid="calendar-title">
            Calendar & Scheduling
          </h1>
          <p style={{ color: '#738A6E' }} data-testid="calendar-subtitle">
            Manage appointments with Google Calendar integration
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-sm" style={{ color: '#8EA58C' }}>
            <i className="fas fa-sync"></i>
            <span>Google Calendar Synced</span>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                style={{ backgroundColor: '#8EA58C', borderColor: '#8EA58C', color: '#FFFFFF' }}
                className="hover:bg-opacity-90"
                data-testid="create-session-button"
              >
                <i className="fas fa-plus mr-2"></i>
                Schedule Session
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Schedule New Session</DialogTitle>
              </DialogHeader>
              <div className="p-4 text-center text-gray-500">
                Session scheduling form would be implemented here
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Component */}
        <Card className="lg:col-span-1" style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }} data-testid="calendar-widget">
          <CardHeader>
            <h3 className="text-lg font-semibold" style={{ color: '#344C3D' }}>Calendar</h3>
          </CardHeader>
          <CardContent>
            <CalendarComponent
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border"
              data-testid="date-picker"
            />
                
            <div className="mt-4 pt-4 border-t" style={{ borderColor: 'rgba(115, 138, 110, 0.15)' }}>
              <h4 className="text-sm font-medium mb-2" style={{ color: '#344C3D' }}>
                Quick Stats
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: '#738A6E' }}>Today's Sessions</span>
                  <span className="font-medium" style={{ color: '#344C3D' }} data-testid="today-sessions-count">
                    {todaySessions?.length || 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: '#738A6E' }}>This Week</span>
                  <span className="font-medium" style={{ color: '#344C3D' }}>18</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: '#738A6E' }}>This Month</span>
                  <span className="font-medium" style={{ color: '#344C3D' }}>72</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sessions List */}
        <Card className="lg:col-span-2" style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }} data-testid="sessions-list">
          <CardHeader>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold" style={{ color: '#344C3D' }}>
                {selectedDate.toDateString() === new Date().toDateString() 
                  ? "Today's Sessions" 
                  : `Sessions for ${selectedDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long', 
                      day: 'numeric',
                      year: 'numeric'
                    })}`
                }
              </h3>
              <Button 
                variant="outline" 
                size="sm" 
                style={{ borderColor: '#8EA58C', color: '#8EA58C' }}
                data-testid="calendar-view-button"
              >
                <i className="fas fa-calendar-week mr-2"></i>
                Week View
              </Button>
            </div>
          </CardHeader>
          
          <CardContent className="max-h-[600px] overflow-y-auto">
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                        <div 
                          className="flex items-center space-x-4 p-4 rounded-lg"
                          style={{ backgroundColor: 'rgba(242, 243, 241, 0.5)' }}
                        >
                          <div 
                            className="h-12 w-12 rounded-lg"
                            style={{ backgroundColor: 'rgba(115, 138, 110, 0.2)' }}
                          ></div>
                          <div className="flex-1 space-y-2">
                            <div 
                              className="h-4 rounded w-1/3"
                              style={{ backgroundColor: 'rgba(115, 138, 110, 0.2)' }}
                            ></div>
                            <div 
                              className="h-3 rounded w-1/2"
                              style={{ backgroundColor: 'rgba(115, 138, 110, 0.15)' }}
                            ></div>
                            <div 
                              className="h-3 rounded w-1/4"
                              style={{ backgroundColor: 'rgba(115, 138, 110, 0.1)' }}
                            ></div>
                          </div>
                          <div className="space-y-2">
                            <div 
                              className="h-6 rounded w-20"
                              style={{ backgroundColor: 'rgba(115, 138, 110, 0.2)' }}
                            ></div>
                            <div 
                              className="h-5 rounded w-16"
                              style={{ backgroundColor: 'rgba(115, 138, 110, 0.15)' }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : !allSessions || allSessions.length === 0 ? (
                  <div className="text-center py-12" data-testid="no-sessions">
                    <i className="fas fa-calendar-day text-6xl mb-4" style={{ color: 'rgba(115, 138, 110, 0.3)' }}></i>
                    <h3 className="text-lg font-medium mb-2" style={{ color: '#344C3D' }}>
                      No sessions scheduled
                    </h3>
                    <p className="mb-4" style={{ color: '#738A6E' }}>
                      Schedule your first therapy session to get started
                    </p>
                    <Button 
                      onClick={() => setIsCreateDialogOpen(true)}
                      style={{ backgroundColor: '#8EA58C', borderColor: '#8EA58C', color: '#FFFFFF' }}
                      className="hover:bg-opacity-90"
                      data-testid="schedule-first-session"
                    >
                      <i className="fas fa-plus mr-2"></i>
                      Schedule First Session
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {allSessions.map((session, index) => {
                      const times = formatSessionTime(session.scheduledAt, session.duration);
                      const color = getSessionTypeColor(session.sessionType, index);
                      
                      return (
                        <div
                          key={session.id}
                          className="flex items-center space-x-4 p-4 rounded-lg transition-colors"
                          style={{ 
                            backgroundColor: 'rgba(242, 243, 241, 0.5)', 
                            border: '1px solid rgba(115, 138, 110, 0.1)' 
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(115, 138, 110, 0.05)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(242, 243, 241, 0.5)';
                          }}
                          data-testid={`session-${session.id}`}
                        >
                          <div 
                            className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center" 
                            style={{ backgroundColor: '#88A5BC' }}
                            data-testid={`client-initials-${session.id}`}
                          >
                            <span className="font-bold text-sm" style={{ color: '#FFFFFF' }}>
                              {session.client?.name 
                                ? session.client.name
                                    .split(' ')
                                    .map(name => name.trim().charAt(0))
                                    .join('')
                                    .toUpperCase()
                                : 'UK'
                              }
                            </span>
                          </div>
                          
                          <div className="flex-1">
                            <h4 className="font-medium" style={{ color: '#344C3D' }} data-testid={`session-client-${session.id}`}>
                              {session.client?.name || "Unknown Client"}
                            </h4>
                            <p className="text-sm" style={{ color: '#738A6E' }} data-testid={`session-type-${session.id}`}>
                              {session.sessionType} Session
                            </p>
                            <div className="flex items-center mt-1 text-xs" style={{ color: 'rgba(115, 138, 110, 0.7)' }}>
                              <i className="fas fa-clock mr-1"></i>
                              <span data-testid={`session-time-${session.id}`}>
                                {times.timeRange}
                              </span>
                              <span className="mx-2">•</span>
                              <span>{session.duration} minutes</span>
                            </div>
                          </div>
                          
                          <div className="flex flex-col space-y-2">
                            <Badge 
                              className={getStatusColor(session.status)}
                              style={{ backgroundColor: '#8EA58C' }}
                              data-testid={`session-status-${session.id}`}
                            >
                              {session.status}
                            </Badge>
                            <div className="flex space-x-1">
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-xs px-2"
                                style={{ borderColor: '#8EA58C', color: '#8EA58C' }}
                                onClick={() => window.open(`/clients/${session.client?.id}`, '_blank')}
                                data-testid={`case-review-${session.id}`}
                              >
                                Case Review
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-xs px-2"
                                style={{ borderColor: '#8EA58C', color: '#8EA58C' }}
                                onClick={() => {
                                  // Navigate to session edit/details page
                                  window.location.href = `/sessions/${session.id}/edit`;
                                }}
                                data-testid={`edit-session-${session.id}`}
                              >
                                Edit
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="text-xs px-2"
                                style={{ borderColor: '#8EA58C', color: '#8EA58C' }}
                                onClick={() => {
                                  // Navigate to session prep page with client context
                                  window.location.href = `/sessions/${session.id}/prep?clientId=${session.client?.id}`;
                                }}
                                data-testid={`prep-session-${session.id}`}
                              >
                                Prep
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
      </div>

      {/* Calendar Integration Status */}
      <Card style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }} data-testid="calendar-integration">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'rgba(142, 165, 140, 0.1)' }}
              >
                <i className="fas fa-google" style={{ color: '#8EA58C' }}></i>
              </div>
              <div>
                <h4 className="font-medium" style={{ color: '#344C3D' }}>Google Calendar Integration</h4>
                <p className="text-sm" style={{ color: '#738A6E' }}>
                  All sessions are automatically synced with your Google Calendar
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2" style={{ color: '#8EA58C' }}>
                <i className="fas fa-check-circle"></i>
                <span className="text-sm">Connected</span>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                style={{ borderColor: '#8EA58C', color: '#8EA58C' }}
                data-testid="calendar-settings"
              >
                <i className="fas fa-cog mr-2"></i>
                Settings
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
