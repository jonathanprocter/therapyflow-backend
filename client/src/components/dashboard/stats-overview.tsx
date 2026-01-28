import React, { memo, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock } from "lucide-react";
import { getCurrentTimeEDT, formatToEDT } from "../../../../shared/utils/timezone";
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

// Memoized stat card component for better performance
const StatCard = memo(function StatCard({
  config,
  value
}: {
  config: typeof statsConfig[number];
  value: number | undefined
}) {
  return (
    <Card
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
              {value}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

function StatsOverview() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  // Memoize time display to prevent recalculation on every render
  const timeDisplay = useMemo(() => formatToEDT(new Date(), 'h:mm a EEEE, MMMM do, yyyy'), []);

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
    <div className="space-y-6 mb-8" data-testid="stats-overview">
      {/* EDT Timezone Header */}
      <Card style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(136, 165, 188, 0.15)' }}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div 
                className="h-10 w-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'rgba(136, 165, 188, 0.1)' }}
              >
                <Clock className="h-5 w-5" style={{ color: '#88A5BC' }} />
              </div>
              <div>
                <h3 className="text-lg font-semibold" style={{ color: '#344C3D' }}>
                  Dashboard Overview
                </h3>
                <p className="text-sm" style={{ color: '#738A6E' }}>
                  {timeDisplay} (EDT)
                </p>
              </div>
            </div>
            <span 
              className="inline-flex items-center px-3 py-1 text-xs rounded-full"
              style={{ backgroundColor: 'rgba(142, 165, 140, 0.1)', color: '#8EA58C' }}
            >
              <i className="fas fa-sync mr-1"></i>
              Real-time EDT Sync
            </span>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsConfig.map((config) => (
          <StatCard key={config.key} config={config} value={stats[config.key]} />
        ))}
      </div>
    </div>
  );
}

export default memo(StatsOverview);
