import React from 'react';
import { Bell, Calendar, Menu, X } from "lucide-react";
import { useLocation } from "wouter";

const pageNames: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/calendar': 'Calendar',
  '/clients': 'Clients',
  '/progress-notes': 'Progress Notes',
  '/session-history': 'Session History',
  '/session-timeline': 'Session Timeline',
  '/interactive-notes': 'AI Note Assistant',
  '/calendar-sync': 'Calendar Sync',
  '/search': 'Semantic Search',
  '/treatment-plans': 'Treatment Plans',
  '/ai-dashboard': 'AI Dashboard',
  '/smart': 'Smart Upload',
  '/documents': 'Documents Upload',
  '/results': 'AI Results',
  '/client': 'Client Analysis',
  '/bulk-transcripts': 'Bulk Transcripts',
  '/drop-zone': 'Drop Zone',
  '/': 'Home',
};

function useApiHealth(pollMs = 10000) {
  const [healthy, setHealthy] = React.useState<boolean | null>(null);
  const [version, setVersion] = React.useState("dev");

  const check = React.useCallback(async () => {
    try {
      const r = await fetch("/api/health", { 
        method: "GET",
        signal: AbortSignal.timeout(5000)
      });
      if (!r.ok) throw new Error(`health ${r.status}`);
      const j = await r.json();
      setHealthy(!!j.ok);
      setVersion(j.version || "dev");
    } catch (error) {
      setHealthy(false);
      setVersion("offline");
    }
  }, []);

  React.useEffect(() => {
    check();
    const t = setInterval(check, pollMs);
    return () => clearInterval(t);
  }, [check, pollMs]);

  return { healthy, version, check };
}

interface TopBarProps {
  onMenuToggle?: () => void;
  isMenuOpen?: boolean;
}

export default function TopBar({ onMenuToggle, isMenuOpen }: TopBarProps) {
  const [location] = useLocation();
  const { healthy } = useApiHealth();

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  const pageTitle = pageNames[location] || 'TherapyFlow';

  return (
    <div 
      className="h-14 md:h-16 px-4 md:px-6 flex items-center justify-between sticky top-0 z-40"
      style={{
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid rgba(115, 138, 110, 0.15)'
      }}
    >
      <div className="flex items-center space-x-3">
        {/* Hamburger Menu - Mobile Only */}
        <button 
          onClick={onMenuToggle}
          className="md:hidden p-2 -ml-2 rounded-lg"
          style={{ color: '#344C3D' }}
        >
          {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        <h1 
          className="text-lg md:text-xl font-semibold truncate max-w-[150px] md:max-w-none"
          style={{ color: '#344C3D' }}
        >
          {pageTitle}
        </h1>
        
        {/* Date - Hidden on very small screens */}
        <div 
          className="hidden sm:flex items-center text-sm"
          style={{ color: '#738A6E' }}
        >
          <Calendar className="w-4 h-4 mr-2" style={{ color: '#88A5BC' }} />
          {currentDate}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        {/* API Health */}
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
        </div>

        {/* Notifications */}
        <button 
          className="relative p-2 rounded-md"
          style={{ color: '#738A6E' }}
        >
          <Bell className="w-5 h-5" />
          <span 
            className="absolute top-1 right-1 w-2 h-2 rounded-full"
            style={{ backgroundColor: '#88A5BC' }}
          />
        </button>
      </div>
    </div>
  );
}
