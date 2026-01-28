// client/src/components/SessionCard.tsx
import React from 'react';
import { Clock, User, Calendar, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SessionCardProps {
  client: {
    id: string;
    name: string;
    initials: string;
  };
  sessionType: 'Individual' | 'Group' | 'Family';
  time: string;
  duration: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show' | 'no_show';
  onCaseReview?: () => void;
  onEdit?: () => void;
  onPrep?: () => void;
}

// Avatar component with proper theming
export function Avatar({ name, initials, size = 'md' }: { name: string; initials: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg bg-teal text-white font-semibold",
        sizeClasses[size as keyof typeof sizeClasses]
      )}
      title={name}
    >
      {initials}
    </div>
  );
}

export function SessionCard({
  client,
  sessionType,
  time,
  duration,
  status,
  onCaseReview,
  onEdit,
  onPrep,
}: SessionCardProps) {
  // Normalize status
  const normalizedStatus = status === 'no_show' ? 'no-show' : status;
  const isNoShow = normalizedStatus === 'no-show';
  const isCancelled = normalizedStatus === 'cancelled';

  const statusStyles: Record<string, string> = {
    scheduled: 'bg-teal/20 text-ink border-teal/30',
    completed: 'bg-green-100 text-green-800 border-green-300',
    cancelled: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'no-show': 'bg-red-100 text-red-800 border-red-300',
  };

  const statusLabels: Record<string, string> = {
    scheduled: 'Scheduled',
    completed: 'Completed',
    cancelled: 'Cancelled',
    'no-show': 'No Show',
  };

  // Card border color based on status
  const cardBorderStyle = isNoShow
    ? 'border-2 border-red-300 bg-red-50/30'
    : isCancelled
    ? 'border-2 border-yellow-300 bg-yellow-50/30'
    : 'border border-teal/20 bg-white';

  return (
    <div className={cn("rounded-lg p-4 hover:shadow-md transition-all", cardBorderStyle)}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <Avatar name={client.name} initials={client.initials} />
          <div>
            <h4 className={cn(
              "font-semibold",
              isCancelled ? "line-through text-yellow-700" : isNoShow ? "text-red-700" : "text-ink"
            )}>
              {client.name}
            </h4>
            <p className={cn(
              "text-sm",
              isCancelled ? "line-through text-yellow-600" : "text-sepia"
            )}>
              {sessionType} Session
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "px-2 py-1 rounded-full text-xs font-medium border",
              statusStyles[normalizedStatus] || statusStyles.scheduled
            )}
          >
            {statusLabels[normalizedStatus] || status}
          </span>
          <button className="p-1 hover:bg-teal/10 rounded">
            <MoreVertical className="h-4 w-4 text-sepia/80" />
          </button>
        </div>
      </div>

      <div className={cn(
        "flex items-center gap-4 text-sm mb-3",
        isCancelled ? "line-through text-yellow-600" : "text-sepia"
      )}>
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          {time}
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {duration}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onCaseReview}
          className="flex-1 px-3 py-1.5 text-sm bg-teal/10 text-ink rounded-lg hover:bg-teal/20 transition-colors font-medium"
        >
          Case Review
        </button>
        <button
          onClick={onEdit}
          className="flex-1 px-3 py-1.5 text-sm bg-parchment text-ink rounded-lg hover:bg-teal/10 transition-colors font-medium"
        >
          Edit
        </button>
        <button
          onClick={onPrep}
          className="flex-1 px-3 py-1.5 text-sm bg-parchment text-ink rounded-lg hover:bg-teal/10 transition-colors font-medium"
        >
          Prep
        </button>
      </div>
    </div>
  );
}