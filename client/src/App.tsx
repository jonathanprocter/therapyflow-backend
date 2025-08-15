import React from 'react';
import { Route, Switch } from 'wouter';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Toaster } from '@/components/ui/toaster';
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
import Sidebar from './components/layout/sidebar';
import TopBar from './components/layout/topbar';
import HomePage from './pages/HomePage';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen flex" style={{backgroundColor: '#F2F3F1'}}>
        <Sidebar />
        <div className="flex-1 flex flex-col">
          <TopBar />
          <main className="flex-1 overflow-auto px-6 pt-8 pb-6" style={{backgroundColor: '#F2F3F1', color: '#738A6E'}}>
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
        </div>
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}