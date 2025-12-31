import React, { useState } from 'react';
import { Route, Switch } from 'wouter';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Toaster } from '@/components/ui/toaster';
import ErrorBoundary from './components/error-boundary';
import DocumentsUpload from './pages/DocumentsUpload';
import CareNotesResults from './pages/CareNotesResults';
import ClientDetail from './pages/ClientDetail';
import SmartUpload from './pages/SmartUpload';
import Dashboard from './pages/dashboard';
import Calendar from './pages/calendar';
import Clients from './pages/clients';
import ProgressNotes from './pages/progress-notes';
import SessionHistory from './pages/session-history';
import SessionTimeline from './pages/session-timeline';
import InteractiveNoteCreator from './pages/InteractiveNoteCreator';
import CalendarSync from './pages/calendar-sync';
import SemanticSearch from './pages/semantic-search';
import TreatmentPlans from './pages/treatment-plans';
import BulkTranscripts from './pages/bulk-transcripts';
import AIDashboard from './pages/AIDashboard';
import DropZone from './pages/DropZone';
import Sidebar from './components/layout/sidebar';
import TopBar from './components/layout/topbar';
import HomePage from './pages/HomePage';
import MobileBottomNav from './components/layout/MobileBottomNav';
import { AIContextualHelper } from './components/ai/AIContextualHelper';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <Switch>
          {/* Drop Zone - standalone page */}
          <Route path="/drop-zone">
            <DropZone />
            <Toaster />
          </Route>
          
          <Route>
            {/* Main app layout */}
            <div className="min-h-screen flex" style={{backgroundColor: '#F2F3F1'}}>
              <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
              
              <div className="flex-1 flex flex-col min-w-0">
                <TopBar 
                  onMenuToggle={() => setSidebarOpen(!sidebarOpen)} 
                  isMenuOpen={sidebarOpen}
                />
                
                <main className="flex-1 overflow-auto px-4 md:px-6 pt-4 md:pt-8 pb-20 md:pb-6" style={{backgroundColor: '#F2F3F1'}}>
                  <Switch>
                    <Route path="/dashboard" component={Dashboard} />
                    <Route path="/calendar" component={Calendar} />
                    <Route path="/client" component={Clients} />
                    <Route path="/clients" component={Clients} />
                    <Route path="/progress-notes" component={ProgressNotes} />
                    <Route path="/session-history" component={SessionHistory} />
                    <Route path="/session-timeline" component={SessionTimeline} />
                    <Route path="/interactive-notes" component={InteractiveNoteCreator} />
                    <Route path="/calendar-sync" component={CalendarSync} />
                    <Route path="/search" component={SemanticSearch} />
                    <Route path="/treatment-plans" component={TreatmentPlans} />
                    <Route path="/bulk-transcripts" component={BulkTranscripts} />
                    <Route path="/ai-dashboard" component={AIDashboard} />
                    <Route path="/smart" component={SmartUpload} />
                    <Route path="/documents" component={DocumentsUpload} />
                    <Route path="/results" component={CareNotesResults} />
                    <Route path="/clients/:clientId" component={ClientDetail} />
                    <Route path="/" component={HomePage} />
                    <Route>
                      <div className="p-8 text-center">
                        <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
                        <p className="text-muted-foreground">The page you requested does not exist.</p>
                      </div>
                    </Route>
                  </Switch>
                </main>
                
                {/* Mobile Bottom Navigation */}
                <MobileBottomNav />
              </div>
            </div>
            <Toaster />
            <AIContextualHelper defaultExpanded={false} />
          </Route>
        </Switch>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
