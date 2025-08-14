import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AiInsight } from "@/types/clinical";

const insightConfig = {
  pattern_recognition: {
    color: "primary",
    icon: "fas fa-lightbulb",
    bgColor: "bg-blue-50",
    borderColor: "border-primary"
  },
  progress_milestone: {
    color: "secondary", 
    icon: "fas fa-chart-line",
    bgColor: "bg-green-50",
    borderColor: "border-secondary"
  },
  risk_alert: {
    color: "accent",
    icon: "fas fa-exclamation-triangle", 
    bgColor: "bg-amber-50",
    borderColor: "border-accent"
  },
  resource_match: {
    color: "purple-600",
    icon: "fas fa-book",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-500"
  }
};

export default function AIInsightsPanel() {
  const { data: insights, isLoading } = useQuery<AiInsight[]>({
    queryKey: ["/api/ai/insights"],
  });

  // Added error handling and logging for therapeutic insights
  const { data: therapeuticInsights, error: therapeuticError } = useQuery({
    queryKey: ['/api/therapeutic/insights/recent'],
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    retryDelay: 1000,
  });

  // Log therapeutic insights errors for debugging
  if (therapeuticError) {
    console.warn('Therapeutic insights query failed:', therapeuticError);
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2" style={{color: '#344C3D'}}>
            <span className="w-2 h-2 rounded-full" style={{backgroundColor: '#88A5BC'}}></span>
            AI Clinical Insights
          </h3>
            <Skeleton className="h-5 w-5" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-4 bg-gray-50 rounded-lg border-l-4 border-gray-300">
              <div className="flex items-start space-x-3">
                <Skeleton className="h-5 w-5 mt-1" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="ai-insights-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2" style={{color: '#344C3D'}} data-testid="insights-title">
            <span className="w-2 h-2 rounded-full" style={{backgroundColor: '#88A5BC'}}></span>
            AI Clinical Insights
          </h3>
          <i className="fas fa-robot" style={{color: '#88A5BC'}}></i>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!insights || insights.length === 0 ? (
          <div className="text-center py-8 text-gray-500" data-testid="no-insights">
            <i className="fas fa-robot text-4xl mb-4 opacity-50"></i>
            <p>No new insights available</p>
          </div>
        ) : (
          insights.map((insight) => {
            const config = insightConfig[insight.type] || insightConfig.pattern_recognition;

            return (
              <div
                key={insight.id}
                className={`p-4 ${config.bgColor} rounded-lg border-l-4 ${config.borderColor} transition-all hover:shadow-sm`}
                data-testid={`insight-${insight.id}`}
              >
                <div className="flex items-start space-x-3">
                  <i className={`${config.icon} text-${config.color} mt-1`}></i>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900" data-testid={`insight-title-${insight.id}`}>
                      {insight.title}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1" data-testid={`insight-description-${insight.id}`}>
                      {insight.description}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`text-xs text-${config.color} hover:text-${config.color} mt-2 p-0 h-auto font-medium`}
                      data-testid={`insight-action-${insight.id}`}
                    >
                      View Details →
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}