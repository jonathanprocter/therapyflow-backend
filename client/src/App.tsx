import React from 'react';
import { Route, Switch, Link, useLocation } from 'wouter';
import DocumentsUpload from './pages/DocumentsUpload';
import CareNotesResults from './pages/CareNotesResults';
import ClientDetail from './pages/ClientDetail';
import SmartUpload from './pages/SmartUpload';

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

function Sidebar() {
  const [location] = useLocation();
  
  const isActive = (path: string) => location === path;
  
  return (
    <aside className="w-64 border-r bg-muted/30 p-4">
      <div className="space-y-2">
        <div className="mb-4">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
            Clinical AI Pipeline
          </h2>
        </div>
        <nav className="space-y-1">
          <Link href="/smart" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
            isActive("/smart") 
              ? "bg-primary text-primary-foreground" 
              : "hover:bg-muted"
          }`} data-testid="link-smart">
            ✨ Smart Upload
          </Link>
          <Link href="/documents" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
            isActive("/documents") 
              ? "bg-primary text-primary-foreground" 
              : "hover:bg-muted"
          }`} data-testid="link-documents">
            📄 Documents Upload
          </Link>
          <Link href="/results" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
            isActive("/results") 
              ? "bg-primary text-primary-foreground" 
              : "hover:bg-muted"
          }`} data-testid="link-results">
            🧠 AI Results
          </Link>
          <Link href="/client" className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
            isActive("/client") 
              ? "bg-primary text-primary-foreground" 
              : "hover:bg-muted"
          }`} data-testid="link-client">
            🔗 Client Detail
          </Link>
        </nav>
      </div>
    </aside>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1">
          <Switch>
            <Route path="/smart" component={SmartUpload} />
            <Route path="/documents" component={DocumentsUpload} />
            <Route path="/results" component={CareNotesResults} />
            <Route path="/client" component={ClientDetail} />
            <Route path="/">
              <div className="p-8 text-center">
                <h2 className="text-2xl font-bold mb-4">Welcome to CareNotesAI</h2>
                <p className="text-muted-foreground mb-6">
                  Clinical document processing with AI-powered analysis and semantic search
                </p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
                  <Link href="/smart" className="block p-4 border rounded-lg hover:bg-muted transition-colors" data-testid="card-smart">
                    <div className="text-2xl mb-2">✨</div>
                    <h3 className="font-semibold">Smart Upload</h3>
                    <p className="text-sm text-muted-foreground">AI extracts client data automatically</p>
                  </Link>
                  <Link href="/documents" className="block p-4 border rounded-lg hover:bg-muted transition-colors" data-testid="card-documents">
                    <div className="text-2xl mb-2">📄</div>
                    <h3 className="font-semibold">Upload Documents</h3>
                    <p className="text-sm text-muted-foreground">Upload and process clinical PDFs</p>
                  </Link>
                  <Link href="/results" className="block p-4 border rounded-lg hover:bg-muted transition-colors" data-testid="card-results">
                    <div className="text-2xl mb-2">🧠</div>
                    <h3 className="font-semibold">View AI Results</h3>
                    <p className="text-sm text-muted-foreground">Explore AI analysis insights</p>
                  </Link>
                  <Link href="/client" className="block p-4 border rounded-lg hover:bg-muted transition-colors" data-testid="card-client">
                    <div className="text-2xl mb-2">🔗</div>
                    <h3 className="font-semibold">Client Analysis</h3>
                    <p className="text-sm text-muted-foreground">Semantic connections & recall</p>
                  </Link>
                </div>
              </div>
            </Route>
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
  );
}