import { Link } from 'wouter';

export default function HomePage() {
  return (
    <div>
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Welcome to TherapyFlow
          </h1>
          <p className="text-xl text-muted-foreground mb-6">
            Comprehensive clinical management platform with AI-powered document processing
          </p>
          
          {/* Quick Actions Banner */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-foreground mb-3">
              Get Started
            </h3>
            <p className="mb-4 text-sm" style={{color: '#738A6E'}}>
              Begin managing your clinical practice with AI-powered tools
            </p>
            <div className="flex justify-center gap-3">
              <Link href="/dashboard">
                <button className="px-5 py-2.5 rounded-md font-medium transition-colors text-sm" style={{backgroundColor: '#8EA58C', color: '#F2F3F1'}} data-testid="button-get-started-dashboard">
                  View Dashboard
                </button>
              </Link>
              <Link href="/smart">
                <button className="px-5 py-2.5 rounded-md font-medium transition-colors text-sm" style={{backgroundColor: '#88A5BC', color: '#F2F3F1'}} data-testid="button-get-started-upload">
                  Upload Documents
                </button>
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Clinical Management Section */}
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              Clinical Management
            </h2>
            <div className="space-y-3">
              <Link href="/dashboard">
                <div className="p-6 bg-card border border-border rounded-lg hover:bg-muted/50 transition-all cursor-pointer group" data-testid="card-dashboard">
                  <div className="text-3xl mb-3">🏠</div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    Dashboard
                  </h3>
                  <p className="text-sm" style={{color: '#738A6E'}}>
                    Overview of appointments, insights, and clinical metrics
                  </p>
                </div>
              </Link>
              
              <Link href="/calendar">
                <div className="p-6 bg-card border border-border rounded-lg hover:bg-muted/50 transition-all cursor-pointer group" data-testid="card-calendar">
                  <div className="text-3xl mb-3" style={{color: '#88A5BC'}}>📅</div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    Calendar
                  </h3>
                  <p className="text-sm" style={{color: '#738A6E'}}>
                    Schedule and manage appointments with calendar sync
                  </p>
                </div>
              </Link>

              <Link href="/clients">
                <div className="p-6 bg-card border border-border rounded-lg hover:bg-muted/50 transition-all cursor-pointer group" data-testid="card-clients">
                  <div className="text-3xl mb-3">👥</div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    Clients
                  </h3>
                  <p className="text-sm" style={{color: '#738A6E'}}>
                    Manage client roster and comprehensive treatment plans
                  </p>
                </div>
              </Link>

              <Link href="/progress-notes">
                <div className="p-6 bg-card border border-border rounded-lg hover:bg-muted/50 transition-all cursor-pointer group" data-testid="card-progress-notes">
                  <div className="text-3xl mb-3">📝</div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    Progress Notes
                  </h3>
                  <p className="text-sm" style={{color: '#738A6E'}}>
                    Clinical documentation and session tracking
                  </p>
                </div>
              </Link>
            </div>
          </div>

          {/* AI Document Processing Section */}
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              AI Document Processing
            </h2>
            <div className="space-y-3">
              <Link href="/smart">
                <div className="p-6 bg-card border border-border rounded-lg hover:bg-muted/50 transition-all cursor-pointer group" data-testid="card-smart">
                  <div className="text-3xl mb-3" style={{color: '#88A5BC'}}>✨</div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    Smart Upload
                  </h3>
                  <p className="text-sm" style={{color: '#738A6E'}}>
                    AI-powered document analysis with automatic client data extraction
                  </p>
                </div>
              </Link>

              <Link href="/documents">
                <div className="p-6 bg-card border border-border rounded-lg hover:bg-muted/50 transition-all cursor-pointer group" data-testid="card-documents">
                  <div className="text-3xl mb-3">📄</div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    Documents Upload
                  </h3>
                  <p className="text-sm" style={{color: '#738A6E'}}>
                    Upload and process clinical PDFs with advanced AI analysis
                  </p>
                </div>
              </Link>

              <Link href="/results">
                <div className="p-6 bg-card border border-border rounded-lg hover:bg-muted/50 transition-all cursor-pointer group" data-testid="card-results">
                  <div className="text-3xl mb-3">🧠</div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    AI Results
                  </h3>
                  <p className="text-sm" style={{color: '#738A6E'}}>
                    Explore comprehensive AI analysis insights and patterns
                  </p>
                </div>
              </Link>

              <Link href="/interactive-notes">
                <div className="p-6 bg-card border border-border rounded-lg hover:bg-muted/50 transition-all cursor-pointer group" data-testid="card-interactive-notes">
                  <div className="text-3xl mb-3" style={{color: '#88A5BC'}}>🤖</div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    AI Note Assistant
                  </h3>
                  <p className="text-sm" style={{color: '#738A6E'}}>
                    Interactive AI-powered progress note creation and enhancement
                  </p>
                </div>
              </Link>
            </div>
          </div>

          {/* Analysis & Reports Section */}
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              Analysis & Reports
            </h2>
            <div className="space-y-3">
              <Link href="/client">
                <div className="p-6 bg-card border border-border rounded-lg hover:bg-muted/50 transition-all cursor-pointer group" data-testid="card-client">
                  <div className="text-3xl mb-3">🔗</div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    Client Analysis
                  </h3>
                  <p className="text-sm" style={{color: '#738A6E'}}>
                    Semantic connections, recall insights, and client trends
                  </p>
                </div>
              </Link>

              <Link href="/search">
                <div className="p-6 bg-card border border-border rounded-lg hover:bg-muted/50 transition-all cursor-pointer group" data-testid="card-search">
                  <div className="text-3xl mb-3" style={{color: '#88A5BC'}}>🔍</div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    Semantic Search
                  </h3>
                  <p className="text-sm" style={{color: '#738A6E'}}>
                    Advanced search across clinical documents and notes
                  </p>
                </div>
              </Link>

              <Link href="/session-history">
                <div className="p-6 bg-card border border-border rounded-lg hover:bg-muted/50 transition-all cursor-pointer group" data-testid="card-session-history">
                  <div className="text-3xl mb-3">📋</div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    Session History
                  </h3>
                  <p className="text-sm" style={{color: '#738A6E'}}>
                    Complete session tracking and historical clinical data
                  </p>
                </div>
              </Link>

              <Link href="/treatment-plans">
                <div className="p-6 bg-card border border-border rounded-lg hover:bg-muted/50 transition-all cursor-pointer group" data-testid="card-treatment-plans">
                  <div className="text-3xl mb-3">📊</div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    Treatment Plans
                  </h3>
                  <p className="text-sm" style={{color: '#738A6E'}}>
                    Evidence-based treatment planning and progress tracking
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>


      </div>
    </div>
  );
}