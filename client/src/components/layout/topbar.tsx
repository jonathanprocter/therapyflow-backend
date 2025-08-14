import { Bell, Calendar } from "lucide-react";
import { useLocation } from "wouter";

const pageNames: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/calendar': 'Calendar',
  '/clients': 'Clients',
  '/progress-notes': 'Progress Notes',
  '/session-history': 'Session History',
  '/interactive-notes': 'AI Note Assistant',
  '/calendar-sync': 'Calendar Sync',
  '/search': 'Semantic Search',
  '/treatment-plans': 'Treatment Plans',
  '/smart': 'Smart Upload',
  '/documents': 'Documents Upload',
  '/results': 'AI Results',
  '/client': 'Client Analysis',
  '/': 'Home',
};

export default function TopBar() {
  const [location] = useLocation();
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const pageTitle = pageNames[location] || 'TherapyFlow';

  return (
    <div className="h-14 bg-background border-b border-border px-6 flex items-center justify-between" data-testid="topbar">
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-semibold text-foreground" data-testid="page-title">
          {pageTitle}
        </h1>
        <div className="flex items-center text-sm text-muted-foreground" data-testid="current-date">
          <Calendar className="w-4 h-4 mr-2" />
          {currentDate}
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <button 
          className="relative p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
          data-testid="notifications-button"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-accent rounded-full"></span>
        </button>
      </div>
    </div>
  );
}
