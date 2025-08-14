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
  { name: "Calendar", href: "/calendar", icon: Calendar, hasNotification: true },
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
    <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col" data-testid="sidebar">
      {/* Logo and Header */}
      <div className="p-6 border-b border-sidebar-border">
        <Link href="/">
          <div className="flex items-center space-x-3 cursor-pointer">
            <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center">
              <Brain className="w-4 h-4 text-sidebar-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold text-sidebar-foreground">TherapyFlow</h1>
          </div>
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        <div className="mb-6">
          <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Clinical Management
          </p>
          {navigation.map((item) => {
            const isActive = location === item.href;
            const IconComponent = item.icon;
            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={cn(
                    "flex items-center px-4 py-3 rounded-lg font-medium transition-colors cursor-pointer",
                    isActive
                      ? "text-sidebar-primary bg-sidebar-accent"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                  data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <IconComponent className="w-4 h-4 mr-3" />
                  {item.name}
                  {item.badge && (
                    <span className="ml-auto bg-muted text-muted-foreground text-xs px-2 py-1 rounded-full">
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
        <div className="pt-4 border-t border-sidebar-border">
          <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            AI Document Processing
          </p>
          {aiProcessing.map((item) => {
            const isActive = location === item.href;
            const IconComponent = item.icon;
            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={cn(
                    "flex items-center px-4 py-3 rounded-lg font-medium transition-colors cursor-pointer",
                    isActive
                      ? "text-sidebar-primary bg-sidebar-accent"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                  )}
                  data-testid={`ai-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <IconComponent className="w-4 h-4 mr-3" />
                  {item.name}
                  {item.badge && (
                    <span className="ml-auto bg-muted text-muted-foreground text-xs px-2 py-1 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        {/* User Profile */}
        <div className="pt-4 border-t border-sidebar-border mt-6">
          <div className="px-4 py-3">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-sidebar-foreground">Dr. Jonathan Procter</p>
                <p className="text-xs text-muted-foreground">Licensed Therapist</p>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </aside>
  );
}
