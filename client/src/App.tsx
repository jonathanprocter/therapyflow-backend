import React, { Suspense, lazy } from 'react';
import { Route, Switch } from 'wouter';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Toaster } from '@/components/ui/toaster';
import ErrorBoundary from './components/error-boundary';
import Sidebar from './components/layout/sidebar';
import TopBar from './components/layout/topbar';

// Lazy-loaded page components for code splitting
const DocumentsUpload = lazy(() => import('./pages/DocumentsUpload'));
const CareNotesResults = lazy(() => import('./pages/CareNotesResults'));
const ClientDetail = lazy(() => import('./pages/ClientDetail'));
const SmartUpload = lazy(() => import('./pages/SmartUpload'));
const Dashboard = lazy(() => import('./pages/dashboard'));
const Calendar = lazy(() => import('./pages/calendar'));
const Clients = lazy(() => import('./pages/clients'));
const ProgressNotes = lazy(() => import('./pages/progress-notes'));
const SessionHistory = lazy(() => import('./pages/session-history'));
const SessionTimeline = lazy(() => import('./pages/session-timeline'));
const InteractiveNoteCreator = lazy(() => import('./pages/InteractiveNoteCreator'));
const CalendarSync = lazy(() => import('./pages/calendar-sync'));
const SemanticSearch = lazy(() => import('./pages/semantic-search'));
const TreatmentPlans = lazy(() => import('./pages/treatment-plans'));
const BulkTranscripts = lazy(() => import('./pages/bulk-transcripts'));
const AIDashboard = lazy(() => import('./pages/AIDashboard'));
const HomePage = lazy(() => import('./pages/HomePage'));
const LongitudinalTracking = lazy(() => import('./pages/longitudinal-tracking'));
const DataSettings = lazy(() => import('./pages/data-settings'));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600"></div>
  </div>
);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <div className="min-h-screen flex" style={{backgroundColor: '#F2F3F1'}}>
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <TopBar />
            <main className="flex-1 overflow-auto px-6 pt-8 pb-6" style={{backgroundColor: '#F2F3F1', color: '#738A6E'}}>
              <Suspense fallback={<PageLoader />}>
                <Switch>
                <Route path="/dashboard" component={Dashboard} />
                <Route path="/calendar" component={Calendar} />
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
                <Route path="/longitudinal" component={LongitudinalTracking} />
                <Route path="/settings" component={DataSettings} />
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
              </Suspense>
            </main>
          </div>
        </div>
        <Toaster />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
