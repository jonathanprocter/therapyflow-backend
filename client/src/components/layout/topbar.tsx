import React from 'react';
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

function useApiHealth(pollMs = 10000) {
  const [healthy, setHealthy] = React.useState<boolean | null>(null);
  const [version, setVersion] = React.useState("dev");

  const check = React.useCallback(async () => {
    try {
      const r = await fetch("/api/health", { method: "GET" });
      if (!r.ok) throw new Error(`health ${r.status}`);
      const j = await r.json();
      setHealthy(!!j.ok);
      setVersion(j.version || "dev");
    } catch {
      setHealthy(false);
    }
  }, []);

  React.useEffect(() => {
    check();
    const t = setInterval(check, pollMs);
    return () => clearInterval(t);
  }, [check, pollMs]);

  return { healthy, version, check };
}

export default function TopBar() {
  const [location] = useLocation();
  const { healthy, version } = useApiHealth();

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const pageTitle = pageNames[location] || 'TherapyFlow';

  return (
    <div 
      className="h-16 px-6 flex items-center justify-between"
      style={{
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid rgba(115, 138, 110, 0.15)'
      }}
      data-testid="topbar"
    >
      <div className="flex items-center space-x-4">
        <h1 
          className="text-xl font-semibold"
          style={{ color: '#344C3D' }}
          data-testid="page-title"
        >
          {pageTitle}
        </h1>
        <div 
          className="flex items-center text-sm"
          style={{ color: '#738A6E' }}
          data-testid="current-date"
        >
          <Calendar 
            className="w-4 h-4 mr-2" 
            style={{ color: '#88A5BC' }} 
          />
          {currentDate}
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* API Health Indicator */}
        <div className="flex items-center gap-2 text-xs">
          <div 
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: 
                healthy === true ? '#8EA58C' : 
                healthy === false ? '#344C3D' : 
                'rgba(115, 138, 110, 0.5)'
            }}
          />
          <span style={{ color: '#738A6E', fontSize: '11px' }}>
            {version}
          </span>
        </div>

        {/* Notifications Button */}
        <button 
          className="relative p-2 rounded-md transition-all"
          style={{
            color: '#738A6E',
            backgroundColor: 'transparent'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(136, 165, 188, 0.1)';
            e.currentTarget.style.color = '#88A5BC';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#738A6E';
          }}
          data-testid="notifications-button"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span 
            className="absolute -top-1 -right-1 w-2 h-2 rounded-full"
            style={{ backgroundColor: '#88A5BC' }}
          ></span>
        </button>
      </div>
    </div>
  );
}