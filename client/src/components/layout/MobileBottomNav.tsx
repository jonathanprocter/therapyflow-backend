import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, Calendar, Brain, Search } from "lucide-react";

const tabs = [
  { name: "Home", href: "/dashboard", icon: LayoutDashboard },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Calendar", href: "/calendar", icon: Calendar },
  { name: "AI", href: "/ai-dashboard", icon: Brain },
  { name: "Search", href: "/search", icon: Search },
];

export default function MobileBottomNav() {
  const [location] = useLocation();

  return (
    <nav 
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-2 pb-safe"
      style={{ 
        backgroundColor: '#FFFFFF',
        borderTop: '1px solid rgba(115, 138, 110, 0.15)',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))'
      }}
    >
      <div className="flex justify-around items-center h-16">
        {tabs.map((tab) => {
          const isActive = location === tab.href || 
            (tab.href === '/dashboard' && location === '/');
          const IconComponent = tab.icon;

          return (
            <Link key={tab.name} href={tab.href}>
              <div className="flex flex-col items-center justify-center px-3 py-2 cursor-pointer">
                <IconComponent 
                  className="w-6 h-6 mb-1"
                  style={{ 
                    color: isActive ? '#88A5BC' : '#738A6E',
                    strokeWidth: isActive ? 2.5 : 2
                  }}
                />
                <span 
                  className="text-xs font-medium"
                  style={{ color: isActive ? '#88A5BC' : '#738A6E' }}
                >
                  {tab.name}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
