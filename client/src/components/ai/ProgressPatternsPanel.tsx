import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TrendingUp, TrendingDown, Calendar, Target, AlertTriangle, Brain, BarChart3 } from 'lucide-react';

interface ProgressPattern {
  metric: string;
  trend: 'improving' | 'declining' | 'stable';
  confidence: number;
  description: string;
  timespan: string;
  significance: number;
}

interface TherapeuticGoal {
  goal: string;
  progress: number;
  status: 'on-track' | 'at-risk' | 'achieved';
  lastUpdate: string;
  insights: string[];
}

interface ProgressPatternsData {
  patterns: ProgressPattern[];
  goals: TherapeuticGoal[];
  overallTrend: {
    direction: 'improving' | 'declining' | 'stable';
    confidence: number;
    summary: string;
  };
  recommendations: Array<{
    action: string;
    rationale: string;
    priority: 'high' | 'medium' | 'low';
  }>;
}

interface ProgressPatternsPanelProps {
  clientId: string;
}

export function ProgressPatternsPanel({ clientId }: ProgressPatternsPanelProps) {
  const { data: patternsData, isLoading, error } = useQuery<{ patterns: ProgressPatternsData }>({
    queryKey: ['/api/ai/progress-patterns', clientId],
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const patterns = patternsData?.patterns;

  if (isLoading) {
    return (
      <Card data-testid="progress-patterns-loading">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-sage animate-pulse" />
            Loading Progress Patterns...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-ivory rounded-lg animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert data-testid="progress-patterns-error">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Failed to load progress patterns: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!patterns) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-sage" />
            Progress Patterns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-moss">
            <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No progress patterns available yet.</p>
            <p className="text-sm mt-1">Analysis will appear after more sessions are recorded.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-sage" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <BarChart3 className="h-4 w-4 text-moss" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving':
        return 'text-sage';
      case 'declining':
        return 'text-red-500';
      default:
        return 'text-moss';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on-track':
        return 'bg-sage/10 text-sage';
      case 'achieved':
        return 'bg-green-100 text-green-800';
      case 'at-risk':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-moss/10 text-moss';
    }
  };

  return (
    <div className="space-y-6" data-testid="progress-patterns-panel">
      {/* Overall Progress Summary */}
      {patterns.overallTrend && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-sage" />
              Overall Progress Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {getTrendIcon(patterns.overallTrend.direction)}
                <span className={`font-medium capitalize ${getTrendColor(patterns.overallTrend.direction)}`}>
                  {patterns.overallTrend.direction}
                </span>
              </div>
              <Badge variant="outline" className="text-xs">
                {Math.round(patterns.overallTrend.confidence * 100)}% confidence
              </Badge>
            </div>
            <p className="text-moss text-sm leading-relaxed">
              {patterns.overallTrend.summary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Progress Patterns */}
      {patterns.patterns && patterns.patterns.length > 0 && (
        <Card data-testid="progress-patterns-list">
          <CardHeader>
            <CardTitle>Progress Patterns</CardTitle>
            <CardDescription>
              AI-identified patterns in client progress over time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-4">
                {patterns.patterns.map((pattern, index) => (
                  <div key={index} className="p-4 bg-ivory rounded-lg border" data-testid={`pattern-${index}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          {getTrendIcon(pattern.trend)}
                          <h4 className="font-medium text-evergreen">{pattern.metric}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {pattern.timespan}
                          </Badge>
                        </div>
                        <p className="text-moss text-sm">{pattern.description}</p>
                        <div className="flex items-center gap-4 text-xs text-moss">
                          <span>Confidence: {Math.round(pattern.confidence * 100)}%</span>
                          <span>Significance: {Math.round(pattern.significance * 100)}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Therapeutic Goals */}
      {patterns.goals && patterns.goals.length > 0 && (
        <Card data-testid="therapeutic-goals">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-sage" />
              Therapeutic Goals Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {patterns.goals.map((goal, index) => (
                <div key={index} className="p-4 bg-ivory rounded-lg border" data-testid={`goal-${index}`}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-evergreen">{goal.goal}</h4>
                      <Badge className={getStatusColor(goal.status)}>
                        {goal.status.replace('-', ' ')}
                      </Badge>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-moss">Progress</span>
                        <span className="font-medium text-evergreen">{goal.progress}%</span>
                      </div>
                      <Progress value={goal.progress} className="h-2" />
                    </div>

                    {goal.insights && goal.insights.length > 0 && (
                      <div className="space-y-1">
                        <h5 className="text-sm font-medium text-evergreen">Recent Insights</h5>
                        <ul className="space-y-1">
                          {goal.insights.slice(0, 2).map((insight, insightIndex) => (
                            <li key={insightIndex} className="text-xs text-moss ml-4 list-disc">
                              {insight}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-xs text-moss">
                      <Calendar className="h-3 w-3" />
                      <span>Last updated: {goal.lastUpdate}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {patterns.recommendations && patterns.recommendations.length > 0 && (
        <Card data-testid="progress-recommendations">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-sage" />
              AI Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {patterns.recommendations.map((rec, index) => (
                <div key={index} className="p-3 bg-ivory rounded-lg border" data-testid={`recommendation-${index}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-moss text-sm font-medium">{rec.action}</p>
                        <Badge 
                          variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {rec.priority}
                        </Badge>
                      </div>
                      <p className="text-moss text-xs">{rec.rationale}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}