import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardStats } from "@/types/clinical";

const statsConfig = [
  {
    key: "activeClients" as keyof DashboardStats,
    title: "Active Clients",
    icon: "fas fa-users",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    suffix: "Currently enrolled in therapy",
    suffixColor: "text-gray-500",
    suffixIcon: ""
  },
  {
    key: "weeklySchedule" as keyof DashboardStats,
    title: "Sessions This Week",
    icon: "fas fa-calendar-alt",
    iconBg: "bg-secondary/10",
    iconColor: "text-secondary",
    suffix: "Scheduled appointments",
    suffixColor: "text-gray-500",
    suffixIcon: ""
  },
  {
    key: "totalNotes" as keyof DashboardStats,
    title: "Progress Notes",
    icon: "fas fa-notes-medical",
    iconBg: "bg-accent/10",
    iconColor: "text-accent",
    suffix: "Documented sessions",
    suffixColor: "text-gray-500",
    suffixIcon: ""
  },
  {
    key: "aiInsights" as keyof DashboardStats,
    title: "AI Insights",
    icon: "fas fa-robot",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    suffix: "New AI-generated insights",
    suffixColor: "text-gray-500",
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
          <Card key={i} data-testid={`stats-skeleton-${i}`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-12 w-12 rounded-lg" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-8 text-gray-500" data-testid="stats-error">
        Failed to load dashboard statistics
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" data-testid="stats-overview">
      {statsConfig.map((config) => (
        <Card key={config.key} className="transition-shadow hover:shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium" data-testid={`stat-label-${config.key}`}>
                  {config.title}
                </p>
                <p className={`text-sm mt-2 ${config.suffixColor}`} data-testid={`stat-suffix-${config.key}`}>
                  <i className={`${config.suffixIcon} mr-1`}></i>
                  {config.suffix}
                </p>
              </div>
              <div className={`w-16 h-16 ${config.iconBg} rounded-lg flex items-center justify-center`}>
                <span className={`text-2xl font-bold ${config.iconColor}`} data-testid={`stat-box-value-${config.key}`}>
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
