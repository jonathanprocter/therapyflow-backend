import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: "fas fa-chart-line" },
  { name: "Clients", href: "/clients", icon: "fas fa-users", badge: "24" },
  { name: "Progress Notes", href: "/progress-notes", icon: "fas fa-notes-medical" },
  { name: "Calendar", href: "/calendar", icon: "fas fa-calendar-alt", hasNotification: true },
];

const clinicalTools = [
  { name: "Case Conceptualization", href: "/case-conceptualization", icon: "fas fa-project-diagram" },
  { name: "Treatment Planning", href: "/treatment-planning", icon: "fas fa-chart-area" },
  { name: "Risk Assessment", href: "/risk-assessment", icon: "fas fa-exclamation-triangle" },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="w-64 bg-white shadow-lg border-r border-gray-200 flex flex-col" data-testid="sidebar">
      {/* Logo and Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <i className="fas fa-brain text-white text-sm"></i>
          </div>
          <h1 className="text-xl font-bold text-gray-900">TherapyFlow</h1>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.name} href={item.href}>
              <a
                className={cn(
                  "flex items-center px-4 py-3 rounded-lg font-medium transition-colors",
                  isActive
                    ? "text-primary bg-primary/10"
                    : "text-gray-700 hover:bg-gray-50"
                )}
                data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <i className={`${item.icon} mr-3`}></i>
                {item.name}
                {item.badge && (
                  <span className="ml-auto bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full">
                    {item.badge}
                  </span>
                )}
                {item.hasNotification && (
                  <span className="ml-auto w-2 h-2 bg-accent rounded-full"></span>
                )}
              </a>
            </Link>
          );
        })}

        {/* Clinical Tools Section */}
        <div className="pt-4 border-t border-gray-200 mt-6">
          <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Clinical Tools
          </p>
          {clinicalTools.map((item) => (
            <Link key={item.name} href={item.href}>
              <a
                className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-lg text-sm transition-colors"
                data-testid={`tool-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <i className={`${item.icon} mr-3`}></i>
                {item.name}
              </a>
            </Link>
          ))}
        </div>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-semibold text-sm">JP</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900" data-testid="user-name">
              Dr. Jonathan Procter
            </p>
            <p className="text-xs text-gray-500" data-testid="user-role">
              Licensed Therapist
            </p>
          </div>
          <button 
            className="text-gray-400 hover:text-gray-600 transition-colors"
            data-testid="settings-button"
          >
            <i className="fas fa-cog"></i>
          </button>
        </div>
      </div>
    </aside>
  );
}
