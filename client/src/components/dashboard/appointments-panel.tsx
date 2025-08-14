import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { Link } from "wouter";
import { formatInTimeZone } from "date-fns-tz";
import { cn } from "@/lib/utils";
import type { SessionWithClient } from "@/types/clinical";

export default function AppointmentsPanel() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  const { data: sessions, isLoading } = useQuery<SessionWithClient[]>({
    queryKey: ["/api/sessions", selectedDate.toISOString().split('T')[0]],
    queryFn: () => fetch(`/api/sessions?date=${selectedDate.toISOString().split('T')[0]}`).then(res => res.json()),
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
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-semibold text-gray-900" data-testid="appointments-title">
              {selectedDate.toDateString() === new Date().toDateString() 
                ? "Today's Schedule" 
                : `Schedule for ${formatInTimeZone(selectedDate, 'America/New_York', 'MMM dd, yyyy')}`
              }
            </h3>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
                  data-testid="date-picker-trigger"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? formatInTimeZone(selectedDate, 'America/New_York', 'MMM dd') : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                  data-testid="appointments-calendar"
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
              <i className="fas fa-sync mr-1"></i>
              Google Calendar Synced
            </span>
            <Link href="/calendar">
              <Button variant="ghost" size="sm" data-testid="view-all-appointments">
                View All
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!sessions || sessions.length === 0 ? (
          <div className="text-center py-8 text-gray-500" data-testid="no-appointments">
            <i className="fas fa-calendar-day text-4xl mb-4 opacity-50"></i>
            <p>
              {selectedDate.toDateString() === new Date().toDateString() 
                ? "No appointments scheduled for today"
                : `No appointments scheduled for ${formatInTimeZone(selectedDate, 'America/New_York', 'MMMM dd, yyyy')}`
              }
            </p>
          </div>
        ) : (
          sessions.map((session, index) => {
            // Convert UTC time to EDT for display
            const sessionTime = new Date(session.scheduledAt);
            const endTime = new Date(sessionTime.getTime() + session.duration * 60000);
            
            // Create EDT timezone formatter
            const edtFormatter = new Intl.DateTimeFormat('en-US', {
              timeZone: 'America/New_York',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true
            });
            
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
                  <span className={`text-${color} font-bold text-sm`}>
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
                  <Link href={`/clients/${session.client?.id}`}>
                    <h4 className="font-medium text-gray-900 hover:text-blue-600 cursor-pointer transition-colors" data-testid={`appointment-client-${session.id}`}>
                      {session.client?.name || "Unknown Client"}
                    </h4>
                  </Link>
                  <p className="text-sm text-gray-500" data-testid={`appointment-type-${session.id}`}>
                    {session.sessionType}
                  </p>
                  <div className="flex items-center mt-1 text-xs text-gray-400">
                    <i className="fas fa-clock mr-1"></i>
                    <span data-testid={`appointment-time-${session.id}`}>
                      {edtFormatter.format(sessionTime)} - {edtFormatter.format(endTime)} EDT
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
