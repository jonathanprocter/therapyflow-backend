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
      <Card className="xl:col-span-2" style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold" style={{ color: '#344C3D' }}>Today's Schedule</h3>
            <div className="flex items-center space-x-2">
              <div 
                className="h-6 w-32 rounded"
                style={{ backgroundColor: 'rgba(115, 138, 110, 0.2)' }}
              ></div>
              <div 
                className="h-6 w-16 rounded"
                style={{ backgroundColor: 'rgba(115, 138, 110, 0.15)' }}
              ></div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4 p-4 rounded-lg" style={{ backgroundColor: 'rgba(242, 243, 241, 0.5)' }}>
              <div 
                className="h-12 w-12 rounded-lg"
                style={{ backgroundColor: 'rgba(115, 138, 110, 0.2)' }}
              ></div>
              <div className="flex-1 space-y-2">
                <div 
                  className="h-4 w-32 rounded"
                  style={{ backgroundColor: 'rgba(115, 138, 110, 0.2)' }}
                ></div>
                <div 
                  className="h-3 w-48 rounded"
                  style={{ backgroundColor: 'rgba(115, 138, 110, 0.15)' }}
                ></div>
                <div 
                  className="h-3 w-40 rounded"
                  style={{ backgroundColor: 'rgba(115, 138, 110, 0.1)' }}
                ></div>
              </div>
              <div className="space-y-2">
                <div 
                  className="h-6 w-20 rounded"
                  style={{ backgroundColor: 'rgba(115, 138, 110, 0.2)' }}
                ></div>
                <div 
                  className="h-5 w-24 rounded"
                  style={{ backgroundColor: 'rgba(115, 138, 110, 0.15)' }}
                ></div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="xl:col-span-2" style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }} data-testid="appointments-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-semibold" style={{ color: '#344C3D' }} data-testid="appointments-title">
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
                  style={{ borderColor: '#8EA58C', color: '#8EA58C' }}
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
            <span 
              className="inline-flex items-center px-2 py-1 text-xs rounded-full"
              style={{ backgroundColor: 'rgba(142, 165, 140, 0.1)', color: '#8EA58C' }}
            >
              <i className="fas fa-sync mr-1"></i>
              Google Calendar Synced
            </span>
            <Link href="/calendar">
              <Button variant="ghost" size="sm" style={{ color: '#88A5BC' }} data-testid="view-all-appointments">
                View All
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!sessions || sessions.length === 0 ? (
          <div className="text-center py-8" style={{ color: '#738A6E' }} data-testid="no-appointments">
            <i className="fas fa-calendar-day text-4xl mb-4 opacity-50" style={{ color: '#88A5BC' }}></i>
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
              const colors = [
                { bg: 'rgba(136, 165, 188, 0.1)', text: '#88A5BC' },
                { bg: 'rgba(142, 165, 140, 0.1)', text: '#8EA58C' },
                { bg: 'rgba(115, 138, 110, 0.1)', text: '#738A6E' }
              ];
              return colors[index % colors.length];
            };
            
            const color = getSessionColor(index);
            
            return (
              <div
                key={session.id}
                className="flex items-center space-x-4 p-4 rounded-lg transition-colors hover:bg-opacity-70"
                style={{ backgroundColor: 'rgba(242, 243, 241, 0.5)' }}
                data-testid={`appointment-${session.id}`}
              >
                <div 
                  className="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: color.bg }}
                >
                  <span className="font-bold text-sm" style={{ color: color.text }}>
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
                    <h4 className="font-medium cursor-pointer transition-colors" style={{ color: '#344C3D' }} data-testid={`appointment-client-${session.id}`}>
                      {session.client?.name || "Unknown Client"}
                    </h4>
                  </Link>
                  <p className="text-sm" style={{ color: '#738A6E' }} data-testid={`appointment-type-${session.id}`}>
                    {session.sessionType}
                  </p>
                  <div className="flex items-center mt-1 text-xs" style={{ color: '#738A6E' }}>
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
                    style={{ backgroundColor: '#8EA58C', color: '#FFFFFF' }}
                    data-testid={`prep-session-${session.id}`}
                  >
                    Prep Session
                  </Button>
                  <span 
                    className="inline-flex items-center px-2 py-1 text-xs rounded"
                    style={{ backgroundColor: color.bg, color: color.text }}
                  >
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
