
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
import InteractiveNoteCreator from './pages/InteractiveNoteCreator';
import CalendarSync from './pages/calendar-sync';
import SemanticSearch from './pages/semantic-search';
import TreatmentPlans from './pages/treatment-plans';
import Sidebar from './components/layout/sidebar';
import TopBar from './components/layout/topbar';
import HomePage from './pages/HomePage';

function useApiHealth(pollMs = 10000) {
  const [healthy, setHealthy] = React.useState<boolean | null>(null);
  const [version, setVersion] = React.useState("–");
  const [lastChecked, setLastChecked] = React.useState("–");

  const check = React.useCallback(async () => {
    try {
      const r = await fetch("/api/health", { method: "GET" });
      if (!r.ok) throw new Error(`health ${r.status}`);
      const j = await r.json();
      setHealthy(!!j.ok);
      setVersion(j.version || "dev");
      setLastChecked(new Date().toLocaleTimeString());
    } catch {
      setHealthy(false);
      setLastChecked(new Date().toLocaleTimeString());
    }
  }, []);

  React.useEffect(() => {
    check();
    const t = setInterval(check, pollMs);
    return () => clearInterval(t);
  }, [check, pollMs]);

  return { healthy, version, lastChecked, check };
}

function useDeepHealth() {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);

  const fetchDeep = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/health/deep", { method: "GET" });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setData(j);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
      setOpen(true);
    }
  }, []);

  return { open, setOpen, loading, data, error, fetchDeep };
}

function Header() {
  const ENV = (import.meta as any).env?.VITE_APP_ENV || "development";
  const { healthy, version, lastChecked, check } = useApiHealth();
  const deep = useDeepHealth();

  return (
    <>
      <header className="border-b bg-background">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">CareNotesAI</h1>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800">
                {ENV}
              </span>
              <span className="text-xs text-muted-foreground">
                v{version}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${
                healthy === true ? 'bg-green-500' : 
                healthy === false ? 'bg-red-500' : 'bg-gray-400'
              }`} />
              <span className="text-xs text-muted-foreground">
                API checked {lastChecked}
              </span>
            </div>
            <button
              onClick={check}
              className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
              data-testid="button-refresh-health"
            >
              Refresh
            </button>
            <button
              onClick={deep.fetchDeep}
              className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
              disabled={deep.loading}
              data-testid="button-deep-check"
            >
              {deep.loading ? "Deep…" : "Deep Check"}
            </button>
          </div>
        </div>
      </header>

      {/* Deep health popover */}
      {deep.open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">System Status</h3>
              <button
                onClick={() => deep.setOpen(false)}
                className="rounded px-2 py-1 text-xs hover:bg-gray-100"
                data-testid="button-close-deep-check"
              >
                Close
              </button>
            </div>
            {deep.error && (
              <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                <p className="text-red-800 text-sm">Error: {deep.error}</p>
              </div>
            )}
            {!deep.error && deep.data && (
              <div className="space-y-3">
                <div className="text-sm space-y-1">
                  <div>Time: {deep.data?.time || "—"}</div>
                  <div>DB Time: {deep.data?.dbTime || "—"}</div>
                  <div>Took: {deep.data?.took_ms ?? "—"} ms</div>
                </div>
                <div className="border-t pt-3">
                  <h4 className="font-medium text-sm mb-2">CareNotesAI Metrics</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Documents: {deep.data?.metrics?.documents ?? 0}</div>
                    <div>AI Results: {deep.data?.metrics?.aiResults ?? 0}</div>
                    <div>Edges: {deep.data?.metrics?.edges ?? 0}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}



export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1">
            <TopBar />
            <div className="p-4">
              <Switch>
                <Route path="/dashboard" component={Dashboard} />
                <Route path="/calendar" component={Calendar} />
                <Route path="/clients" component={Clients} />
                <Route path="/progress-notes" component={ProgressNotes} />
                <Route path="/session-history" component={SessionHistory} />
                <Route path="/interactive-notes" component={InteractiveNoteCreator} />
                <Route path="/calendar-sync" component={CalendarSync} />
                <Route path="/search" component={SemanticSearch} />
                <Route path="/treatment-plans" component={TreatmentPlans} />
                <Route path="/smart" component={SmartUpload} />
                <Route path="/documents" component={DocumentsUpload} />
                <Route path="/results" component={CareNotesResults} />
                <Route path="/client" component={ClientDetail} />
                <Route path="/" component={HomePage} />
                <Route>
                  <div className="p-8 text-center">
                    <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
                    <p className="text-muted-foreground">The page you requested does not exist.</p>
                  </div>
                </Route>
              </Switch>
            </div>
          </main>
        </div>
      </div>
      <Toaster />
    </QueryClientProvider>
  );
}
