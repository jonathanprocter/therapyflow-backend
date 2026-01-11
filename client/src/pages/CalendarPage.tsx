// client/src/pages/CalendarPage.tsx
import React, { useState } from 'react';
import { Calendar } from '@/components/Calendar';
import { SessionCard } from '@/components/SessionCard';
import { Settings, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

// Mock data - replace with real data
const todaysSessions = [
  {
    id: '1',
    client: { id: '1', name: 'Calvin Hill', initials: 'CH' },
    sessionType: 'Individual' as const,
    time: '10:00 AM - 11:00 AM',
    duration: '60 minutes',
    status: 'scheduled' as const,
  },
  {
    id: '2',
    client: { id: '2', name: 'Sarah Johnson', initials: 'SJ' },
    sessionType: 'Family' as const,
    time: '2:00 PM - 3:30 PM',
    duration: '90 minutes',
    status: 'scheduled' as const,
  },
];

const stats = {
  today: 2,
  thisWeek: 18,
  thisMonth: 72,
};

export function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');

  return (
    <div className="min-h-screen bg-parchment">
      {/* Header */}
      <div className="bg-white border-b border-teal/20 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-ink">Calendar & Scheduling</h1>
            <p className="text-sm text-sepia mt-1">
              Manage appointments with Google Calendar integration
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-sepia/80 bg-teal/10 px-3 py-1 rounded-lg">
              Google Calendar Synced
            </span>
            <button className="px-4 py-2 bg-teal text-white rounded-lg hover:bg-sepia transition-colors flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Schedule Session
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 p-6">
        {/* Left Column - Calendar & Stats */}
        <div className="col-span-4 space-y-6">
          {/* Calendar Widget */}
          <Calendar
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            sessions={todaysSessions.map(s => ({
              date: new Date(),
              clientId: s.client.id,
            }))}
          />

          {/* Quick Stats */}
          <div className="bg-white rounded-lg border border-teal/20 p-4">
            <h3 className="font-semibold text-ink mb-4">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-sepia">Today's Sessions</span>
                <span className="font-semibold text-ink">{stats.today}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-sepia">This Week</span>
                <span className="font-semibold text-ink">{stats.thisWeek}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-sepia">This Month</span>
                <span className="font-semibold text-ink">{stats.thisMonth}</span>
              </div>
            </div>
          </div>

          {/* Google Calendar Integration */}
          <div className="bg-white rounded-lg border border-teal/20 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-ink">Google Calendar Integration</h3>
              <button className="p-1.5 hover:bg-teal/10 rounded-lg transition-colors">
                <Settings className="h-4 w-4 text-sepia/80" />
              </button>
            </div>
            <p className="text-sm text-sepia mb-3">
              All sessions are automatically synced with your Google Calendar
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-sepia font-medium">Connected</span>
              <button className="text-sm text-teal hover:text-sepia transition-colors">
                Settings
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Today's Sessions */}
        <div className="col-span-8">
          <div className="bg-white rounded-lg border border-teal/20">
            <div className="p-4 border-b border-teal/10 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-ink">Today's Sessions</h2>
              <div className="flex items-center gap-2">
                {['Month', 'Week', 'Day'].map((view) => (
                  <button
                    key={view}
                    onClick={() => setViewMode(view.toLowerCase() as any)}
                    className={cn(
                      "px-3 py-1 text-sm rounded-lg transition-colors",
                      viewMode === view.toLowerCase()
                        ? "bg-teal text-white"
                        : "bg-parchment text-ink hover:bg-teal/10"
                    )}
                  >
                    {view} View
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 space-y-4">
              {todaysSessions.length > 0 ? (
                todaysSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    {...session}
                    onCaseReview={() => console.log('Case review')}
                    onEdit={() => console.log('Edit')}
                    onPrep={() => console.log('Prep')}
                  />
                ))
              ) : (
                <div className="text-center py-12 text-sepia/80">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-3 text-teal/30" />
                  <p>No sessions scheduled for today</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}