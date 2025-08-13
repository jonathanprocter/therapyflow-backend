import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SessionWithClient } from "@/types/clinical";

export default function AppointmentsPanel() {
  const { data: sessions, isLoading } = useQuery<SessionWithClient[]>({
    queryKey: ["/api/sessions?today=true"],
  });

  if (isLoading) {
    return (
      <Card className="xl:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Today's Schedule</h3>
            <div className="flex items-center space-x-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-16" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
              <Skeleton className="h-12 w-12 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-3 w-40" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-5 w-24" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="xl:col-span-2" data-testid="appointments-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900" data-testid="appointments-title">
            Today's Schedule
          </h3>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
              <i className="fas fa-sync mr-1"></i>
              Google Calendar Synced
            </span>
            <Button variant="ghost" size="sm" data-testid="view-all-appointments">
              View All
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!sessions || sessions.length === 0 ? (
          <div className="text-center py-8 text-gray-500" data-testid="no-appointments">
            <i className="fas fa-calendar-day text-4xl mb-4 opacity-50"></i>
            <p>No appointments scheduled for today</p>
          </div>
        ) : (
          sessions.map((session, index) => {
            const sessionTime = new Date(session.scheduledAt);
            const endTime = new Date(sessionTime.getTime() + session.duration * 60000);
            
            const getSessionColor = (index: number) => {
              const colors = ['primary', 'secondary', 'accent'];
              return colors[index % colors.length];
            };
            
            const color = getSessionColor(index);
            
            return (
              <div
                key={session.id}
                className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg transition-colors hover:bg-gray-100"
                data-testid={`appointment-${session.id}`}
              >
                <div className={`flex-shrink-0 w-12 h-12 bg-${color}/10 rounded-lg flex items-center justify-center`}>
                  <i className={`fas fa-user-circle text-${color}`}></i>
                </div>
                
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900" data-testid={`appointment-client-${session.id}`}>
                    {session.client?.name || "Unknown Client"}
                  </h4>
                  <p className="text-sm text-gray-500" data-testid={`appointment-type-${session.id}`}>
                    {session.sessionType}
                  </p>
                  <div className="flex items-center mt-1 text-xs text-gray-400">
                    <i className="fas fa-clock mr-1"></i>
                    <span data-testid={`appointment-time-${session.id}`}>
                      {sessionTime.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })} - {endTime.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </span>
                  </div>
                </div>
                
                <div className="flex flex-col space-y-2">
                  <Button
                    size="sm"
                    className="text-xs"
                    data-testid={`prep-session-${session.id}`}
                  >
                    Prep Session
                  </Button>
                  <span className={`inline-flex items-center px-2 py-1 text-xs bg-${color}/10 text-${color} rounded`}>
                    <i className="fas fa-chart-line mr-1"></i>
                    {session.status === 'scheduled' ? 'Scheduled' : session.status}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
