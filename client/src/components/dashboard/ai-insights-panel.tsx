import React, { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { AiInsight } from "@/types/clinical";

// Pre-created skeleton array to avoid recreation on each render
const SKELETON_ITEMS = [0, 1, 2, 3];

const insightConfig = {
  pattern_recognition: {
    color: "#88A5BC",
    icon: "fas fa-lightbulb",
    bgColor: "rgba(136, 165, 188, 0.1)",
    borderColor: "#88A5BC"
  },
  progress_milestone: {
    color: "#8EA58C", 
    icon: "fas fa-chart-line",
    bgColor: "rgba(142, 165, 140, 0.1)",
    borderColor: "#8EA58C"
  },
  risk_alert: {
    color: "#738A6E",
    icon: "fas fa-exclamation-triangle", 
    bgColor: "rgba(115, 138, 110, 0.1)",
    borderColor: "#738A6E"
  },
  resource_match: {
    color: "#344C3D",
    icon: "fas fa-book",
    bgColor: "rgba(52, 76, 61, 0.1)",
    borderColor: "#344C3D"
  }
};

// Memoized insight card to prevent re-renders
const InsightCard = memo(function InsightCard({ insight }: { insight: AiInsight }) {
  const config = insightConfig[insight.type] || insightConfig.pattern_recognition;

  return (
    <div
      className="p-4 rounded-lg border-l-4 transition-all hover:shadow-sm"
      style={{
        backgroundColor: config.bgColor,
        borderLeftColor: config.borderColor
      }}
      data-testid={`insight-${insight.id}`}
    >
      <div className="flex items-start space-x-3">
        <i className={`${config.icon} mt-1`} style={{ color: config.color }} aria-hidden="true"></i>
        <div className="flex-1">
          <h4 className="font-medium" style={{ color: '#344C3D' }} data-testid={`insight-title-${insight.id}`}>
            {insight.title}
          </h4>
          <p className="text-sm mt-1" style={{ color: '#738A6E' }} data-testid={`insight-description-${insight.id}`}>
            {insight.description}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs mt-2 p-0 h-auto font-medium"
            style={{ color: config.color }}
            data-testid={`insight-action-${insight.id}`}
          >
            View Details →
          </Button>
        </div>
      </div>
    </div>
  );
});

function AIInsightsPanel() {
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
      <Card style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2" style={{color: '#344C3D'}}>
            <span className="w-2 h-2 rounded-full" style={{backgroundColor: '#88A5BC'}}></span>
            AI Clinical Insights
          </h3>
            <div 
              className="h-5 w-5 rounded"
              style={{ backgroundColor: 'rgba(115, 138, 110, 0.2)' }}
            ></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {SKELETON_ITEMS.map((i) => (
            <div key={i} className="p-4 rounded-lg border-l-4" style={{ backgroundColor: 'rgba(242, 243, 241, 0.5)', borderLeftColor: 'rgba(115, 138, 110, 0.3)' }}>
              <div className="flex items-start space-x-3">
                <div 
                  className="h-5 w-5 mt-1 rounded"
                  style={{ backgroundColor: 'rgba(115, 138, 110, 0.2)' }}
                ></div>
                <div className="flex-1 space-y-2">
                  <div 
                    className="h-4 w-32 rounded"
                    style={{ backgroundColor: 'rgba(115, 138, 110, 0.2)' }}
                  ></div>
                  <div 
                    className="h-16 w-full rounded"
                    style={{ backgroundColor: 'rgba(115, 138, 110, 0.15)' }}
                  ></div>
                  <div 
                    className="h-3 w-24 rounded"
                    style={{ backgroundColor: 'rgba(115, 138, 110, 0.1)' }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }} data-testid="ai-insights-panel">
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
          <div className="text-center py-8" style={{ color: '#738A6E' }} data-testid="no-insights">
            <i className="fas fa-robot text-4xl mb-4 opacity-50" style={{ color: '#88A5BC' }}></i>
            <p>No new insights available</p>
          </div>
        ) : (
          insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default memo(AIInsightsPanel);