import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Calendar, 
  History, 
  Upload,
  Brain,
  Search,
  Clipboard,
  Bot,
  RefreshCw,
  Sparkles,
  FileUp
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Calendar", href: "/calendar", icon: Calendar, hasNotification: true, isSpecialIcon: true },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Progress Notes", href: "/progress-notes", icon: FileText },
  { name: "Session History", href: "/session-history", icon: History },
  { name: "AI Note Assistant", href: "/interactive-notes", icon: Bot },
  { name: "Calendar Sync", href: "/calendar-sync", icon: RefreshCw, badge: "OAuth2" },
  { name: "Semantic Search", href: "/search", icon: Search },
  { name: "Treatment Plans", href: "/treatment-plans", icon: Clipboard },
];

const aiProcessing = [
  { name: "Smart Upload", href: "/smart", icon: Sparkles, badge: "AI" },
  { name: "Documents Upload", href: "/documents", icon: FileUp },
  { name: "AI Results", href: "/results", icon: Brain },
  { name: "Client Analysis", href: "/client", icon: Search },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="w-64 flex flex-col" style={{backgroundColor: '#F2F3F1', borderRight: '1px solid #8EA58C'}} data-testid="sidebar">
      {/* Logo and Header */}
      <div className="h-16 px-6 flex items-center" style={{borderBottom: '1px solid #8EA58C'}}>
        <Link href="/">
          <div className="flex items-center space-x-3 cursor-pointer">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{backgroundColor: '#88A5BC'}}>
              <Brain className="w-4 h-4" style={{color: '#F2F3F1'}} />
            </div>
            <h1 className="text-xl font-bold" style={{color: '#344C3D'}}>TherapyFlow</h1>
          </div>
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-4 pt-8 pb-6 space-y-2 overflow-y-auto">
        <div className="mb-6">
          <p className="px-4 text-xs font-semibold uppercase tracking-wider mb-3" style={{color: '#738A6E'}}>
            Clinical Management
          </p>
          {navigation.map((item) => {
            const isActive = location === item.href;
            const IconComponent = item.icon;
            return (
              <Link key={item.name} href={item.href}>
                <div
                  className="flex items-center px-4 py-3 rounded-lg font-medium transition-colors cursor-pointer hover-nav-item"
                  style={isActive 
                    ? {color: '#F2F3F1', backgroundColor: '#8EA58C'} 
                    : {color: '#738A6E', backgroundColor: 'transparent'}}
                  data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = '#88A5BC';
                      e.currentTarget.style.color = '#F2F3F1';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#738A6E';
                    }
                  }}
                >
                  <IconComponent className="w-4 h-4 mr-3" style={{color: (item.name === 'Calendar') ? '#88A5BC' : 'inherit'}} />
                  {item.name}
                  {item.badge && (
                    <span className="ml-auto text-xs px-2 py-1 rounded-full" style={{backgroundColor: '#88A5BC', color: '#F2F3F1'}}>
                      {item.badge}
                    </span>
                  )}
                  {item.hasNotification && (
                    <span className="ml-auto w-2 h-2 bg-accent rounded-full"></span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* AI Document Processing Section */}
        <div className="pt-4" style={{borderTop: '1px solid #8EA58C'}}>
          <p className="px-4 text-xs font-semibold uppercase tracking-wider mb-3" style={{color: '#738A6E'}}>
            AI Document Processing
          </p>
          {aiProcessing.map((item) => {
            const isActive = location === item.href;
            const IconComponent = item.icon;
            return (
              <Link key={item.name} href={item.href}>
                <div
                  className="flex items-center px-4 py-3 rounded-lg font-medium transition-colors cursor-pointer"
                  style={isActive 
                    ? {color: '#F2F3F1', backgroundColor: '#8EA58C'} 
                    : {color: '#738A6E', backgroundColor: 'transparent'}}
                  data-testid={`ai-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = '#88A5BC';
                      e.currentTarget.style.color = '#F2F3F1';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = '#738A6E';
                    }
                  }}
                >
                  <IconComponent className="w-4 h-4 mr-3" style={{color: (item.name.includes('AI') || item.name.includes('Smart') || item.name.includes('Sparkles')) ? '#88A5BC' : 'inherit'}} />
                  {item.name}
                  {item.badge && (
                    <span className="ml-auto text-xs px-2 py-1 rounded-full" style={{backgroundColor: '#88A5BC', color: '#F2F3F1'}}>
                      {item.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* User Profile */}
        <div className="pt-4 mt-6" style={{borderTop: '1px solid #8EA58C'}}>
          <div className="px-4 py-3">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{backgroundColor: '#88A5BC'}}>
                <Users className="w-4 h-4" style={{color: '#F2F3F1'}} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium" style={{color: '#344C3D'}}>Dr. Jonathan Procter</p>
                <p className="text-xs" style={{color: '#738A6E'}}>Licensed Therapist</p>
              </div>

            </div>
          </div>
        </div>
      </nav>
    </aside>
  );
}
