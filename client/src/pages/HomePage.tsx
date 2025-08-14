import { Link } from 'wouter';

export default function HomePage() {
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Welcome to TherapyFlow
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Comprehensive clinical management platform with AI-powered document processing
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Clinical Management Section */}
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-foreground mb-4">
              Clinical Management
            </h2>
            <div className="space-y-4">
              <Link href="/dashboard">
                <div className="p-6 bg-card border border-border rounded-lg hover:bg-muted/50 transition-all cursor-pointer group" data-testid="card-dashboard">
                  <div className="text-3xl mb-3">🏠</div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    Dashboard
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Overview of appointments, insights, and clinical metrics
                  </p>
                </div>
              </Link>
              
              <Link href="/calendar">
                <div className="p-6 bg-card border border-border rounded-lg hover:bg-muted/50 transition-all cursor-pointer group" data-testid="card-calendar">
                  <div className="text-3xl mb-3">📅</div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    Calendar
                  </h3>
                  <p className="text-sm text-muted-foreground">
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
                  <p className="text-sm text-muted-foreground">
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
                  <p className="text-sm text-muted-foreground">
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
            <div className="space-y-4">
              <Link href="/smart">
                <div className="p-6 bg-card border border-border rounded-lg hover:bg-muted/50 transition-all cursor-pointer group" data-testid="card-smart">
                  <div className="text-3xl mb-3">✨</div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    Smart Upload
                  </h3>
                  <p className="text-sm text-muted-foreground">
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
                  <p className="text-sm text-muted-foreground">
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
                  <p className="text-sm text-muted-foreground">
                    Explore comprehensive AI analysis insights and patterns
                  </p>
                </div>
              </Link>

              <Link href="/interactive-notes">
                <div className="p-6 bg-card border border-border rounded-lg hover:bg-muted/50 transition-all cursor-pointer group" data-testid="card-interactive-notes">
                  <div className="text-3xl mb-3">🤖</div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    AI Note Assistant
                  </h3>
                  <p className="text-sm text-muted-foreground">
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
            <div className="space-y-4">
              <Link href="/client">
                <div className="p-6 bg-card border border-border rounded-lg hover:bg-muted/50 transition-all cursor-pointer group" data-testid="card-client">
                  <div className="text-3xl mb-3">🔗</div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    Client Analysis
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Semantic connections, recall insights, and client trends
                  </p>
                </div>
              </Link>

              <Link href="/search">
                <div className="p-6 bg-card border border-border rounded-lg hover:bg-muted/50 transition-all cursor-pointer group" data-testid="card-search">
                  <div className="text-3xl mb-3">🔍</div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                    Semantic Search
                  </h3>
                  <p className="text-sm text-muted-foreground">
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
                  <p className="text-sm text-muted-foreground">
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
                  <p className="text-sm text-muted-foreground">
                    Evidence-based treatment planning and progress tracking
                  </p>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="text-center">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-8">
            <h3 className="text-xl font-semibold text-foreground mb-4">
              Get Started
            </h3>
            <p className="text-muted-foreground mb-6">
              Begin managing your clinical practice with AI-powered tools
            </p>
            <div className="flex justify-center gap-4">
              <Link href="/dashboard">
                <button className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium" data-testid="button-get-started-dashboard">
                  View Dashboard
                </button>
              </Link>
              <Link href="/smart">
                <button className="px-6 py-3 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors font-medium" data-testid="button-get-started-upload">
                  Upload Documents
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}