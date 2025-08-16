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
  status: 'scheduled' | 'completed' | 'cancelled';
  onCaseReview?: () => void;
  onEdit?: () => void;
  onPrep?: () => void;
}

// Avatar component with proper theming
export function Avatar({ name, initials, size = 'md' }) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg bg-sage text-white font-semibold",
        sizeClasses[size]
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
  const statusStyles = {
    scheduled: 'bg-sage/20 text-evergreen border-sage/30',
    completed: 'bg-moss/20 text-evergreen border-moss/30',
    cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  };

  return (
    <div className="bg-white rounded-lg border border-sage/20 p-4 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <Avatar name={client.name} initials={client.initials} />
          <div>
            <h4 className="font-semibold text-evergreen">{client.name}</h4>
            <p className="text-sm text-gray-600">{sessionType} Session</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "px-2 py-1 rounded-full text-xs font-medium border",
              statusStyles[status]
            )}
          >
            {status}
          </span>
          <button className="p-1 hover:bg-sage/10 rounded">
            <MoreVertical className="h-4 w-4 text-gray-500" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
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
          className="flex-1 px-3 py-1.5 text-sm bg-sage/10 text-evergreen rounded-lg hover:bg-sage/20 transition-colors font-medium"
        >
          Case Review
        </button>
        <button
          onClick={onEdit}
          className="flex-1 px-3 py-1.5 text-sm bg-ivory text-evergreen rounded-lg hover:bg-sage/10 transition-colors font-medium"
        >
          Edit
        </button>
        <button
          onClick={onPrep}
          className="flex-1 px-3 py-1.5 text-sm bg-ivory text-evergreen rounded-lg hover:bg-sage/10 transition-colors font-medium"
        >
          Prep
        </button>
      </div>
    </div>
  );
}