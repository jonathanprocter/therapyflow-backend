import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardStats } from "@/types/clinical";

const statsConfig = [
  {
    key: "activeClients" as keyof DashboardStats,
    title: "Active Clients",
    icon: "fas fa-users",
    iconBg: { backgroundColor: 'rgba(136, 165, 188, 0.1)' },
    iconColor: { color: '#88A5BC' },
    suffix: "Currently enrolled in therapy",
    suffixColor: { color: '#738A6E' },
    suffixIcon: ""
  },
  {
    key: "weeklySchedule" as keyof DashboardStats,
    title: "Sessions This Week",
    icon: "fas fa-calendar-alt",
    iconBg: { backgroundColor: 'rgba(142, 165, 140, 0.1)' },
    iconColor: { color: '#8EA58C' },
    suffix: "Scheduled appointments",
    suffixColor: { color: '#738A6E' },
    suffixIcon: ""
  },
  {
    key: "totalNotes" as keyof DashboardStats,
    title: "Progress Notes",
    icon: "fas fa-notes-medical",
    iconBg: { backgroundColor: 'rgba(115, 138, 110, 0.1)' },
    iconColor: { color: '#738A6E' },
    suffix: "Documented sessions",
    suffixColor: { color: '#738A6E' },
    suffixIcon: ""
  },
  {
    key: "aiInsights" as keyof DashboardStats,
    title: "AI Insights",
    icon: "fas fa-robot",
    iconBg: { backgroundColor: 'rgba(52, 76, 61, 0.1)' },
    iconColor: { color: '#344C3D' },
    suffix: "New AI-generated insights",
    suffixColor: { color: '#738A6E' },
    suffixIcon: ""
  }
];

export default function StatsOverview() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card 
            key={i} 
            style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }}
            data-testid={`stats-skeleton-${i}`}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div 
                    className="h-4 w-20 rounded"
                    style={{ backgroundColor: 'rgba(115, 138, 110, 0.2)' }}
                  ></div>
                  <div 
                    className="h-8 w-16 rounded"
                    style={{ backgroundColor: 'rgba(115, 138, 110, 0.15)' }}
                  ></div>
                  <div 
                    className="h-4 w-24 rounded"
                    style={{ backgroundColor: 'rgba(115, 138, 110, 0.1)' }}
                  ></div>
                </div>
                <div 
                  className="h-12 w-12 rounded-lg"
                  style={{ backgroundColor: 'rgba(115, 138, 110, 0.1)' }}
                ></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div 
        className="text-center py-8" 
        style={{ color: '#738A6E' }}
        data-testid="stats-error"
      >
        Failed to load dashboard statistics
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" data-testid="stats-overview">
      {statsConfig.map((config) => (
        <Card 
          key={config.key} 
          className="transition-shadow hover:shadow-md"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p 
                  className="text-base font-semibold" 
                  style={{ color: '#344C3D' }}
                  data-testid={`stat-label-${config.key}`}
                >
                  {config.title}
                </p>
                <p 
                  className="text-xs mt-2" 
                  style={config.suffixColor} 
                  data-testid={`stat-suffix-${config.key}`}
                >
                  <i className={`${config.suffixIcon} mr-1`}></i>
                  {config.suffix}
                </p>
              </div>
              <div 
                className="w-16 h-16 rounded-lg flex items-center justify-center" 
                style={config.iconBg}
              >
                <span 
                  className="text-2xl font-bold" 
                  style={config.iconColor} 
                  data-testid={`stat-box-value-${config.key}`}
                >
                  {stats[config.key]}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
