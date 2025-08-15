import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Calendar, 
  History, 
  TrendingUp,
  Bot,
  RefreshCw,
  Search,
  Clipboard,
  Sparkles,
  FileUp,
  Brain
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Calendar", href: "/calendar", icon: Calendar, isSpecial: true },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Progress Notes", href: "/progress-notes", icon: FileText },
  { name: "Session History", href: "/session-history", icon: History },
  { name: "Session Timeline", href: "/session-timeline", icon: TrendingUp, badge: "NEW", isSpecial: true },
  { name: "AI Note Assistant", href: "/interactive-notes", icon: Bot, badge: "AI" },
  { name: "Calendar Sync", href: "/calendar-sync", icon: RefreshCw, badge: "OAuth2" },
  { name: "Semantic Search", href: "/search", icon: Search, isSpecial: true },
  { name: "Treatment Plans", href: "/treatment-plans", icon: Clipboard },
];

const aiProcessing = [
  { name: "Bulk Transcripts", href: "/bulk-transcripts", icon: FileUp, badge: "NEW", isSpecial: true },
  { name: "Smart Upload", href: "/smart", icon: Sparkles, badge: "AI", isSpecial: true },
  { name: "Documents Upload", href: "/documents", icon: FileUp },
  { name: "AI Results", href: "/results", icon: Brain, badge: "AI" },
  { name: "Client Analysis", href: "/client", icon: Search },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="sidebar w-64 flex flex-col">
      {/* Logo and Header */}
      <div className="h-16 px-6 flex items-center border-b border-moss/15">
        <Link href="/">
          <div className="flex items-center space-x-3 cursor-pointer">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-french-blue">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-bold text-evergreen">
              TherapyFlow
            </h1>
          </div>
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-4 pt-8 pb-6 overflow-y-auto">
        <div className="mb-6">
          <p 
            className="px-4 text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: '#738A6E' }}
          >
            Clinical Management
          </p>
          {navigation.map((item) => {
            const isActive = location === item.href;
            const IconComponent = item.icon;

            return (
              <Link key={item.name} href={item.href}>
                <div
                  className="flex items-center px-4 py-3 rounded-lg font-medium transition-all cursor-pointer mb-2"
                  style={{
                    color: isActive ? '#FFFFFF' : '#738A6E',
                    backgroundColor: isActive ? '#8EA58C' : 'transparent',
                    borderLeft: isActive ? '3px solid #88A5BC' : '3px solid transparent'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'rgba(136, 165, 188, 0.1)';
                      e.currentTarget.style.color = '#88A5BC';
                      e.currentTarget.style.borderLeft = '3px solid #88A5BC';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#738A6E';
                      e.currentTarget.style.borderLeft = '3px solid transparent';
                    }
                  }}
                >
                  <IconComponent 
                    className="w-4 h-4 mr-3" 
                    style={{ 
                      color: item.isSpecial ? '#88A5BC' : 'inherit' 
                    }} 
                  />
                  {item.name}
                  {item.badge && (
                    <span 
                      className="ml-auto text-xs px-2 py-1 rounded-full"
                      style={{ 
                        backgroundColor: '#88A5BC', 
                        color: '#FFFFFF' 
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* AI Document Processing Section */}
        <div 
          className="pt-4"
          style={{ borderTop: '1px solid rgba(142, 165, 140, 0.3)' }}
        >
          <p 
            className="px-4 text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: '#738A6E' }}
          >
            AI Document Processing
          </p>
          {aiProcessing.map((item) => {
            const isActive = location === item.href;
            const IconComponent = item.icon;

            return (
              <Link key={item.name} href={item.href}>
                <div
                  className="flex items-center px-4 py-3 rounded-lg font-medium transition-all cursor-pointer mb-2"
                  style={{
                    color: isActive ? '#FFFFFF' : '#738A6E',
                    backgroundColor: isActive ? '#8EA58C' : 'transparent',
                    borderLeft: isActive ? '3px solid #88A5BC' : '3px solid transparent'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'rgba(136, 165, 188, 0.1)';
                      e.currentTarget.style.color = '#88A5BC';
                      e.currentTarget.style.borderLeft = '3px solid #88A5BC';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#738A6E';
                      e.currentTarget.style.borderLeft = '3px solid transparent';
                    }
                  }}
                >
                  <IconComponent 
                    className="w-4 h-4 mr-3"
                    style={{ 
                      color: item.isSpecial ? '#88A5BC' : 'inherit' 
                    }}
                  />
                  {item.name}
                  {item.badge && (
                    <span 
                      className="ml-auto text-xs px-2 py-1 rounded-full"
                      style={{ 
                        backgroundColor: '#88A5BC', 
                        color: '#FFFFFF' 
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* User Profile */}
        <div 
          className="pt-4 mt-6"
          style={{ borderTop: '1px solid rgba(142, 165, 140, 0.3)' }}
        >
          <div className="px-4 py-3">
            <div className="flex items-center space-x-3">
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#88A5BC' }}
              >
                <Users className="w-4 h-4" style={{ color: '#FFFFFF' }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: '#344C3D' }}>
                  Dr. Jonathan Procter
                </p>
                <p className="text-xs" style={{ color: '#738A6E' }}>
                  Licensed Therapist
                </p>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </aside>
  );
}