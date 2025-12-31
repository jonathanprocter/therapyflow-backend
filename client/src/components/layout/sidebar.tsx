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
  Brain,
  CloudUpload,
  X
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "AI Dashboard", href: "/ai-dashboard", icon: Brain, badge: "AI", isSpecial: true },
  { name: "Calendar", href: "/calendar", icon: Calendar, isSpecial: true },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Progress Notes", href: "/progress-notes", icon: FileText },
  { name: "Session History", href: "/session-history", icon: History },
  { name: "Session Timeline", href: "/session-timeline", icon: TrendingUp, badge: "NEW", isSpecial: true },
  { name: "AI Note Assistant", href: "/interactive-notes", icon: Bot, badge: "AI" },
  { name: "Calendar Sync", href: "/calendar-sync", icon: RefreshCw },
  { name: "Semantic Search", href: "/search", icon: Search, isSpecial: true },
  { name: "Treatment Plans", href: "/treatment-plans", icon: Clipboard },
];

const aiProcessing = [
  { name: "Drop Zone", href: "/drop-zone", icon: CloudUpload, badge: "NEW", isSpecial: true },
  { name: "Bulk Transcripts", href: "/bulk-transcripts", icon: FileUp, badge: "NEW", isSpecial: true },
  { name: "Smart Upload", href: "/smart", icon: Sparkles, badge: "AI", isSpecial: true },
  { name: "Documents", href: "/documents", icon: FileUp },
  { name: "AI Results", href: "/results", icon: Brain, badge: "AI" },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const [location] = useLocation();

  const handleLinkClick = () => {
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`
          fixed md:static inset-y-0 left-0 z-50
          w-72 md:w-64 flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{ backgroundColor: '#FFFFFF', borderRight: '1px solid rgba(115, 138, 110, 0.15)' }}
      >
        {/* Header */}
        <div className="h-14 md:h-16 px-4 md:px-6 flex items-center justify-between border-b border-moss/15">
          <Link href="/" onClick={handleLinkClick}>
            <div className="flex items-center space-x-3 cursor-pointer">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-french-blue">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-xl font-bold text-evergreen">TherapyFlow</h1>
            </div>
          </Link>
          
          {/* Close button - Mobile Only */}
          <button 
            onClick={onClose}
            className="md:hidden p-2 rounded-lg"
            style={{ color: '#738A6E' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 md:px-4 pt-6 pb-4 overflow-y-auto">
          <div className="mb-6">
            <p className="px-3 text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#738A6E' }}>
              Clinical Management
            </p>
            {navigation.map((item) => {
              const isActive = location === item.href;
              const IconComponent = item.icon;

              return (
                <Link key={item.name} href={item.href} onClick={handleLinkClick}>
                  <div
                    className="flex items-center px-3 py-3 rounded-lg font-medium transition-all cursor-pointer mb-1"
                    style={{
                      color: isActive ? '#FFFFFF' : '#738A6E',
                      backgroundColor: isActive ? '#8EA58C' : 'transparent',
                    }}
                  >
                    <IconComponent 
                      className="w-5 h-5 mr-3" 
                      style={{ color: isActive ? '#FFFFFF' : item.isSpecial ? '#88A5BC' : '#738A6E' }} 
                    />
                    <span className="flex-1">{item.name}</span>
                    {item.badge && (
                      <span 
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: '#88A5BC', color: '#FFFFFF' }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {/* AI Processing */}
          <div className="pt-4" style={{ borderTop: '1px solid rgba(142, 165, 140, 0.3)' }}>
            <p className="px-3 text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#738A6E' }}>
              AI Processing
            </p>
            {aiProcessing.map((item) => {
              const isActive = location === item.href;
              const IconComponent = item.icon;

              return (
                <Link key={item.name} href={item.href} onClick={handleLinkClick}>
                  <div
                    className="flex items-center px-3 py-3 rounded-lg font-medium transition-all cursor-pointer mb-1"
                    style={{
                      color: isActive ? '#FFFFFF' : '#738A6E',
                      backgroundColor: isActive ? '#8EA58C' : 'transparent',
                    }}
                  >
                    <IconComponent 
                      className="w-5 h-5 mr-3"
                      style={{ color: isActive ? '#FFFFFF' : item.isSpecial ? '#88A5BC' : '#738A6E' }}
                    />
                    <span className="flex-1">{item.name}</span>
                    {item.badge && (
                      <span 
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: '#88A5BC', color: '#FFFFFF' }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t" style={{ borderColor: 'rgba(142, 165, 140, 0.3)' }}>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#88A5BC' }}>
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: '#344C3D' }}>Dr. Jonathan Procter</p>
              <p className="text-xs" style={{ color: '#738A6E' }}>Licensed Therapist</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
