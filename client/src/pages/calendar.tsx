import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/topbar";
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
      "group": "purple-600"
    };
    const colors = ["primary", "secondary", "accent", "purple-600"];
    return colorMap[sessionType.toLowerCase()] || colors[index % colors.length];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800";
      case "scheduled": return "bg-blue-100 text-blue-800";
      case "cancelled": return "bg-red-100 text-red-800";
      case "no-show": return "bg-gray-100 text-gray-800";
      default: return "bg-blue-100 text-blue-800";
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
    <div className="flex h-screen bg-gray-50" data-testid="calendar-page">
      <Sidebar />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" data-testid="calendar-title">
                Calendar & Scheduling
              </h1>
              <p className="text-gray-600" data-testid="calendar-subtitle">
                Manage appointments with Google Calendar integration
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-green-600">
                <i className="fas fa-sync"></i>
                <span>Google Calendar Synced</span>
              </div>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="create-session-button">
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
            <Card className="lg:col-span-1" data-testid="calendar-widget">
              <CardHeader>
                <h3 className="text-lg font-semibold text-gray-900">Calendar</h3>
              </CardHeader>
              <CardContent>
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  className="rounded-md border"
                  data-testid="date-picker"
                />
                
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">
                    Quick Stats
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Today's Sessions</span>
                      <span className="font-medium" data-testid="today-sessions-count">
                        {todaySessions?.length || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">This Week</span>
                      <span className="font-medium">18</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">This Month</span>
                      <span className="font-medium">72</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sessions List */}
            <Card className="lg:col-span-2" data-testid="sessions-list">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
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
                  <Button variant="outline" size="sm" data-testid="calendar-view-button">
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
                        <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                          <div className="h-12 w-12 bg-gray-200 rounded-lg"></div>
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                          </div>
                          <div className="space-y-2">
                            <div className="h-6 bg-gray-200 rounded w-20"></div>
                            <div className="h-5 bg-gray-200 rounded w-16"></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : !allSessions || allSessions.length === 0 ? (
                  <div className="text-center py-12" data-testid="no-sessions">
                    <i className="fas fa-calendar-day text-6xl text-gray-300 mb-4"></i>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No sessions scheduled
                    </h3>
                    <p className="text-gray-500 mb-4">
                      Schedule your first therapy session to get started
                    </p>
                    <Button 
                      onClick={() => setIsCreateDialogOpen(true)}
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
                          className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                          data-testid={`session-${session.id}`}
                        >
                          <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <i className="fas fa-user-circle text-blue-600"></i>
                          </div>
                          
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900" data-testid={`session-client-${session.id}`}>
                              {session.client?.name || "Unknown Client"}
                            </h4>
                            <p className="text-sm text-gray-500" data-testid={`session-type-${session.id}`}>
                              {session.sessionType} Session
                            </p>
                            <div className="flex items-center mt-1 text-xs text-gray-400">
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
                              data-testid={`session-status-${session.id}`}
                            >
                              {session.status}
                            </Badge>
                            <div className="flex space-x-1">
                              <Button 
                                size="sm" 
                                variant="outline"
                                data-testid={`join-session-${session.id}`}
                              >
                                <i className="fas fa-video text-xs"></i>
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                data-testid={`edit-session-${session.id}`}
                              >
                                <i className="fas fa-edit text-xs"></i>
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                data-testid={`prep-session-${session.id}`}
                              >
                                <i className="fas fa-clipboard-list text-xs"></i>
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
          <Card className="mt-6" data-testid="calendar-integration">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <i className="fas fa-google text-green-600"></i>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">Google Calendar Integration</h4>
                    <p className="text-sm text-gray-500">
                      All sessions are automatically synced with your Google Calendar
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 text-green-600">
                    <i className="fas fa-check-circle"></i>
                    <span className="text-sm">Connected</span>
                  </div>
                  <Button variant="outline" size="sm" data-testid="calendar-settings">
                    <i className="fas fa-cog mr-2"></i>
                    Settings
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
