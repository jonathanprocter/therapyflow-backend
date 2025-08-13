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
    suffix: "+3 this week",
    suffixColor: "text-secondary",
    suffixIcon: "fas fa-arrow-up"
  },
  {
    key: "weeklySchedule" as keyof DashboardStats,
    title: "Sessions This Week",
    icon: "fas fa-calendar-alt",
    iconBg: "bg-secondary/10",
    iconColor: "text-secondary",
    suffix: "5 today",
    suffixColor: "text-secondary",
    suffixIcon: "fas fa-calendar-check"
  },
  {
    key: "totalNotes" as keyof DashboardStats,
    title: "Progress Notes",
    icon: "fas fa-notes-medical",
    iconBg: "bg-accent/10",
    iconColor: "text-accent",
    suffix: "8 pending",
    suffixColor: "text-accent",
    suffixIcon: "fas fa-clock"
  },
  {
    key: "aiInsights" as keyof DashboardStats,
    title: "AI Insights",
    icon: "fas fa-robot",
    iconBg: "bg-primary/10",
    iconColor: "text-primary",
    suffix: "New patterns found",
    suffixColor: "text-primary",
    suffixIcon: "fas fa-lightbulb"
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
                <p className="text-sm text-gray-600" data-testid={`stat-label-${config.key}`}>
                  {config.title}
                </p>
                <p className="text-3xl font-bold text-gray-900" data-testid={`stat-value-${config.key}`}>
                  {stats[config.key]}
                </p>
                <p className={`text-sm mt-1 ${config.suffixColor}`} data-testid={`stat-suffix-${config.key}`}>
                  <i className={`${config.suffixIcon} mr-1`}></i>
                  {config.suffix}
                </p>
              </div>
              <div className={`w-12 h-12 ${config.iconBg} rounded-lg flex items-center justify-center`}>
                <i className={`${config.icon} ${config.iconColor}`}></i>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
