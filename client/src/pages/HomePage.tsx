import { Link } from 'wouter';

export default function HomePage() {
  return (
    <div style={{ backgroundColor: '#F2F3F1', minHeight: '100vh', paddingTop: '30px' }}>
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4" style={{ color: '#344C3D' }}>
            Welcome to TherapyFlow
          </h1>
          <p className="text-xl mb-6" style={{ color: '#738A6E' }}>
            Comprehensive clinical management platform with AI-powered document processing
          </p>

          {/* Quick Actions Banner */}
          <div className="rounded-lg p-6 mb-8" style={{
            backgroundColor: 'rgba(142, 165, 140, 0.08)',
            border: '1px solid rgba(142, 165, 140, 0.2)'
          }}>
            <h3 className="text-lg font-semibold mb-3" style={{ color: '#344C3D' }}>
              Get Started
            </h3>
            <p className="mb-4 text-sm" style={{ color: '#738A6E' }}>
              Begin managing your clinical practice with AI-powered tools
            </p>
            <div className="flex justify-center gap-3">
              <Link href="/dashboard">
                <button 
                  className="px-5 py-2.5 rounded-md font-medium transition-all text-sm hover:shadow-md"
                  style={{ 
                    backgroundColor: '#8EA58C', 
                    color: '#FFFFFF' 
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#7A8F78';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#8EA58C';
                  }}
                >
                  View Dashboard
                </button>
              </Link>
              <Link href="/smart">
                <button 
                  className="px-5 py-2.5 rounded-md font-medium transition-all text-sm hover:shadow-md"
                  style={{ 
                    backgroundColor: 'transparent',
                    color: '#88A5BC',
                    border: '2px solid #88A5BC'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#88A5BC';
                    e.currentTarget.style.color = '#FFFFFF';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#88A5BC';
                  }}
                >
                  Upload Documents
                </button>
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4">
          {/* Clinical Management Section */}
          <div>
            <h2 className="text-2xl font-semibold mb-6 text-center" style={{ color: '#344C3D' }}>
              Clinical Management
            </h2>

            <Link href="/dashboard">
              <div 
                className="p-6 rounded-lg transition-all cursor-pointer h-[180px] flex flex-col justify-between"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid rgba(115, 138, 110, 0.15)',
                  marginBottom: '20px',
                  boxShadow: '0 2px 4px rgba(52, 76, 61, 0.08)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(52, 76, 61, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(52, 76, 61, 0.08)';
                }}
              >
                <div className="text-3xl mb-3">🏠</div>
                <div>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: '#344C3D' }}>
                    Dashboard
                  </h3>
                  <p className="text-sm" style={{ color: '#738A6E' }}>
                    Overview of appointments, insights, and clinical metrics
                  </p>
                </div>
              </div>
            </Link>

            <Link href="/calendar">
              <div 
                className="p-6 rounded-lg transition-all cursor-pointer h-[180px] flex flex-col justify-between"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid rgba(115, 138, 110, 0.15)',
                  marginBottom: '20px',
                  boxShadow: '0 2px 4px rgba(52, 76, 61, 0.08)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(52, 76, 61, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(52, 76, 61, 0.08)';
                }}
              >
                <div className="text-3xl mb-3">
                  <span style={{ color: '#88A5BC', fontSize: '32px' }}>📅</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: '#344C3D' }}>
                    Calendar
                  </h3>
                  <p className="text-sm" style={{ color: '#738A6E' }}>
                    Schedule and manage appointments with calendar sync
                  </p>
                </div>
              </div>
            </Link>

            <Link href="/clients">
              <div 
                className="p-6 rounded-lg transition-all cursor-pointer h-[180px] flex flex-col justify-between"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid rgba(115, 138, 110, 0.15)',
                  marginBottom: '20px',
                  boxShadow: '0 2px 4px rgba(52, 76, 61, 0.08)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(52, 76, 61, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(52, 76, 61, 0.08)';
                }}
              >
                <div className="text-3xl mb-3">👥</div>
                <div>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: '#344C3D' }}>
                    Clients
                  </h3>
                  <p className="text-sm" style={{ color: '#738A6E' }}>
                    Manage client roster and comprehensive treatment plans
                  </p>
                </div>
              </div>
            </Link>

            <Link href="/progress-notes">
              <div 
                className="p-6 rounded-lg transition-all cursor-pointer h-[180px] flex flex-col justify-between"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid rgba(115, 138, 110, 0.15)',
                  marginBottom: '20px',
                  boxShadow: '0 2px 4px rgba(52, 76, 61, 0.08)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(52, 76, 61, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(52, 76, 61, 0.08)';
                }}
              >
                <div className="text-3xl mb-3">📝</div>
                <div>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: '#344C3D' }}>
                    Progress Notes
                  </h3>
                  <p className="text-sm" style={{ color: '#738A6E' }}>
                    Clinical documentation and session tracking
                  </p>
                </div>
              </div>
            </Link>
          </div>

          {/* AI Document Processing Section */}
          <div>
            <h2 className="text-2xl font-semibold mb-6 text-center" style={{ color: '#344C3D' }}>
              AI Document Processing
            </h2>

            <Link href="/smart">
              <div 
                className="p-6 rounded-lg transition-all cursor-pointer h-[180px] flex flex-col justify-between"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid rgba(115, 138, 110, 0.15)',
                  marginBottom: '20px',
                  boxShadow: '0 2px 4px rgba(52, 76, 61, 0.08)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(52, 76, 61, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(52, 76, 61, 0.08)';
                }}
              >
                <div className="text-3xl mb-3">
                  <span style={{ color: '#88A5BC', fontSize: '32px' }}>✨</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold" style={{ color: '#344C3D' }}>
                      Smart Upload
                    </h3>
                    <span className="px-2 py-1 text-xs font-medium rounded" 
                      style={{ backgroundColor: '#88A5BC', color: '#FFFFFF' }}>
                      AI
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: '#738A6E' }}>
                    AI-powered document analysis with automatic client data extraction
                  </p>
                </div>
              </div>
            </Link>

            <Link href="/documents">
              <div 
                className="p-6 rounded-lg transition-all cursor-pointer h-[180px] flex flex-col justify-between"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid rgba(115, 138, 110, 0.15)',
                  marginBottom: '20px',
                  boxShadow: '0 2px 4px rgba(52, 76, 61, 0.08)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(52, 76, 61, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(52, 76, 61, 0.08)';
                }}
              >
                <div className="text-3xl mb-3">📄</div>
                <div>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: '#344C3D' }}>
                    Documents Upload
                  </h3>
                  <p className="text-sm" style={{ color: '#738A6E' }}>
                    Upload and process clinical PDFs with advanced AI analysis
                  </p>
                </div>
              </div>
            </Link>

            <Link href="/results">
              <div 
                className="p-6 rounded-lg transition-all cursor-pointer h-[180px] flex flex-col justify-between"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid rgba(115, 138, 110, 0.15)',
                  marginBottom: '20px',
                  boxShadow: '0 2px 4px rgba(52, 76, 61, 0.08)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(52, 76, 61, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(52, 76, 61, 0.08)';
                }}
              >
                <div className="text-3xl mb-3">🧠</div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold" style={{ color: '#344C3D' }}>
                      AI Results
                    </h3>
                    <span className="px-2 py-1 text-xs font-medium rounded" 
                      style={{ backgroundColor: '#88A5BC', color: '#FFFFFF' }}>
                      AI
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: '#738A6E' }}>
                    Explore comprehensive AI analysis insights and patterns
                  </p>
                </div>
              </div>
            </Link>

            <Link href="/interactive-notes">
              <div 
                className="p-6 rounded-lg transition-all cursor-pointer h-[180px] flex flex-col justify-between"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid rgba(115, 138, 110, 0.15)',
                  marginBottom: '20px',
                  boxShadow: '0 2px 4px rgba(52, 76, 61, 0.08)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(52, 76, 61, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(52, 76, 61, 0.08)';
                }}
              >
                <div className="text-3xl mb-3">
                  <span style={{ color: '#88A5BC', fontSize: '32px' }}>🤖</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold" style={{ color: '#344C3D' }}>
                      AI Note Assistant
                    </h3>
                    <span className="px-2 py-1 text-xs font-medium rounded" 
                      style={{ backgroundColor: '#88A5BC', color: '#FFFFFF' }}>
                      AI
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: '#738A6E' }}>
                    Interactive AI-powered progress note creation and enhancement
                  </p>
                </div>
              </div>
            </Link>
          </div>

          {/* Analysis & Reports Section */}
          <div>
            <h2 className="text-2xl font-semibold mb-6 text-center" style={{ color: '#344C3D' }}>
              Analysis & Reports
            </h2>

            <Link href="/client">
              <div 
                className="p-6 rounded-lg transition-all cursor-pointer h-[180px] flex flex-col justify-between"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid rgba(115, 138, 110, 0.15)',
                  marginBottom: '20px',
                  boxShadow: '0 2px 4px rgba(52, 76, 61, 0.08)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(52, 76, 61, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(52, 76, 61, 0.08)';
                }}
              >
                <div className="text-3xl mb-3">🔗</div>
                <div>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: '#344C3D' }}>
                    Client Analysis
                  </h3>
                  <p className="text-sm" style={{ color: '#738A6E' }}>
                    Semantic connections, recall insights, and client trends
                  </p>
                </div>
              </div>
            </Link>

            <Link href="/search">
              <div 
                className="p-6 rounded-lg transition-all cursor-pointer h-[180px] flex flex-col justify-between"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid rgba(115, 138, 110, 0.15)',
                  marginBottom: '20px',
                  boxShadow: '0 2px 4px rgba(52, 76, 61, 0.08)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(52, 76, 61, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(52, 76, 61, 0.08)';
                }}
              >
                <div className="text-3xl mb-3">
                  <span style={{ color: '#88A5BC', fontSize: '32px' }}>🔍</span>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold" style={{ color: '#344C3D' }}>
                      Semantic Search
                    </h3>
                    <span className="px-2 py-1 text-xs font-medium rounded" 
                      style={{ backgroundColor: '#88A5BC', color: '#FFFFFF' }}>
                      AI
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: '#738A6E' }}>
                    Advanced search across clinical documents and notes
                  </p>
                </div>
              </div>
            </Link>

            <Link href="/session-history">
              <div 
                className="p-6 rounded-lg transition-all cursor-pointer h-[180px] flex flex-col justify-between"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid rgba(115, 138, 110, 0.15)',
                  marginBottom: '20px',
                  boxShadow: '0 2px 4px rgba(52, 76, 61, 0.08)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(52, 76, 61, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(52, 76, 61, 0.08)';
                }}
              >
                <div className="text-3xl mb-3">📋</div>
                <div>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: '#344C3D' }}>
                    Session History
                  </h3>
                  <p className="text-sm" style={{ color: '#738A6E' }}>
                    Complete session tracking and historical clinical data
                  </p>
                </div>
              </div>
            </Link>

            <Link href="/treatment-plans">
              <div 
                className="p-6 rounded-lg transition-all cursor-pointer h-[180px] flex flex-col justify-between"
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid rgba(115, 138, 110, 0.15)',
                  marginBottom: '20px',
                  boxShadow: '0 2px 4px rgba(52, 76, 61, 0.08)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(52, 76, 61, 0.12)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(52, 76, 61, 0.08)';
                }}
              >
                <div className="text-3xl mb-3">📊</div>
                <div>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: '#344C3D' }}>
                    Treatment Plans
                  </h3>
                  <p className="text-sm" style={{ color: '#738A6E' }}>
                    Evidence-based treatment planning and progress tracking
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}