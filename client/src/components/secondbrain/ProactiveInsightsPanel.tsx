import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Lightbulb, 
  TrendingUp, 
  AlertCircle, 
  MessageSquare,
  Target,
  Clock,
  RefreshCw,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';

interface ProactiveInsightsData {
  patterns: Array<{
    name: string;
    description: string;
    confidence: number;
    recommendations: string[];
  }>;
  suggestions: string[];
  alerts: Array<{
    type: 'opportunity' | 'concern' | 'reminder';
    message: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  opportunities: string[];
  questionSuggestions: string[];
}

interface ProactiveInsightsPanelProps {
  clientId: string;
  context?: 'session_opening' | 'goal_discussion' | 'crisis_moment' | 'session_closing';
  className?: string;
}

export function ProactiveInsightsPanel({ 
  clientId, 
  context = 'session_opening', 
  className = '' 
}: ProactiveInsightsPanelProps) {
  const [activeTab, setActiveTab] = useState<'suggestions' | 'patterns' | 'alerts'>('suggestions');

  // Fetch proactive insights
  const { data: insights, isLoading, error, refetch } = useQuery<ProactiveInsightsData>({
    queryKey: ['/api/insights', clientId, context],
    enabled: !!clientId,
    staleTime: 2 * 60 * 1000, // 2 minutes - insights change frequently
  });

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'opportunity': return <Target className="h-4 w-4 text-sage" />;
      case 'concern': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'reminder': return <Clock className="h-4 w-4 text-french-blue" />;
      default: return <AlertCircle className="h-4 w-4 text-moss" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-50 text-red-700 border-red-200';
      case 'medium': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-sage/10 text-sage border-sage/20';
      default: return 'bg-ivory text-moss border-moss/20';
    }
  };

  const getContextDescription = (ctx: string) => {
    switch (ctx) {
      case 'session_opening': return 'Session Opening Insights';
      case 'goal_discussion': return 'Goal Discussion Insights';
      case 'crisis_moment': return 'Crisis Support Insights';
      case 'session_closing': return 'Session Closing Insights';
      default: return 'General Session Insights';
    }
  };

  if (isLoading) {
    return (
      <Card className={className} data-testid="insights-loading">
        <CardContent className="py-8">
          <div className="text-center space-y-4">
            <Lightbulb className="h-8 w-8 mx-auto text-sage animate-pulse" />
            <div>
              <h3 className="text-lg font-medium text-evergreen">Generating Insights</h3>
              <p className="text-moss text-sm mt-1">
                Analyzing patterns and preparing proactive suggestions...
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className} data-testid="insights-error">
        <CardContent className="py-8">
          <div className="text-center space-y-4">
            <AlertTriangle className="h-8 w-8 mx-auto text-red-500" />
            <div>
              <h3 className="text-lg font-medium text-evergreen">Insights Unavailable</h3>
              <p className="text-moss text-sm mt-1">
                Unable to generate insights. Using manual analysis.
              </p>
            </div>
            <Button
              onClick={() => refetch()}
              variant="outline"
              className="mt-4"
              data-testid="button-retry-insights"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className} data-testid="proactive-insights-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-sage" />
            <div>
              <CardTitle className="text-lg">Proactive Insights</CardTitle>
              <CardDescription>
                {getContextDescription(context)} • AI-powered session preparation
              </CardDescription>
            </div>
          </div>
          <Button
            onClick={() => refetch()}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            data-testid="button-refresh-insights"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Insight Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-ivory rounded-lg">
            <div className="text-2xl font-bold text-evergreen">
              {insights?.suggestions.length || 0}
            </div>
            <div className="text-sm text-moss">Suggestions</div>
          </div>
          <div className="text-center p-3 bg-ivory rounded-lg">
            <div className="text-2xl font-bold text-evergreen">
              {insights?.patterns.length || 0}
            </div>
            <div className="text-sm text-moss">Patterns</div>
          </div>
          <div className="text-center p-3 bg-ivory rounded-lg">
            <div className="text-2xl font-bold text-evergreen">
              {insights?.alerts.length || 0}
            </div>
            <div className="text-sm text-moss">Alerts</div>
          </div>
        </div>

        {/* High Priority Alerts */}
        {insights?.alerts && insights.alerts.filter(a => a.priority === 'high').length > 0 && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <div className="font-medium text-red-800">High Priority Alerts</div>
                {insights.alerts
                  .filter(a => a.priority === 'high')
                  .slice(0, 2)
                  .map((alert, index) => (
                    <div key={index} className="text-sm text-red-700">
                      • {alert.message}
                    </div>
                  ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="suggestions" data-testid="tab-suggestions">
              <MessageSquare className="h-4 w-4 mr-2" />
              Suggestions
            </TabsTrigger>
            <TabsTrigger value="patterns" data-testid="tab-patterns">
              <TrendingUp className="h-4 w-4 mr-2" />
              Patterns
            </TabsTrigger>
            <TabsTrigger value="alerts" data-testid="tab-alerts">
              <AlertCircle className="h-4 w-4 mr-2" />
              Alerts
            </TabsTrigger>
          </TabsList>

          {/* Suggestions Tab */}
          <TabsContent value="suggestions" className="space-y-4">
            <div className="space-y-3">
              <h4 className="font-medium text-evergreen">Session Suggestions</h4>
              <ScrollArea className="h-32">
                <div className="space-y-2">
                  {insights?.suggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 p-2 rounded-lg bg-ivory"
                      data-testid={`suggestion-${index}`}
                    >
                      <CheckCircle className="h-4 w-4 text-sage mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-evergreen">{suggestion}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Question Suggestions */}
            {insights?.questionSuggestions && insights.questionSuggestions.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-evergreen">Suggested Questions</h4>
                <ScrollArea className="h-32">
                  <div className="space-y-2">
                    {insights.questionSuggestions.map((question, index) => (
                      <div
                        key={index}
                        className="p-2 rounded-lg bg-french-blue/5 border border-french-blue/20"
                        data-testid={`question-${index}`}
                      >
                        <div className="flex items-start gap-2">
                          <MessageSquare className="h-4 w-4 text-french-blue mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-evergreen italic">"{question}"</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Opportunities */}
            {insights?.opportunities && insights.opportunities.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-evergreen">Therapeutic Opportunities</h4>
                <div className="space-y-2">
                  {insights.opportunities.slice(0, 3).map((opportunity, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 p-2 rounded-lg bg-sage/5 border border-sage/20"
                      data-testid={`opportunity-${index}`}
                    >
                      <Target className="h-4 w-4 text-sage mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-evergreen">{opportunity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Patterns Tab */}
          <TabsContent value="patterns" className="space-y-4">
            <ScrollArea className="h-60">
              <div className="space-y-3">
                {insights?.patterns.map((pattern, index) => (
                  <div
                    key={index}
                    className="p-3 border rounded-lg"
                    data-testid={`pattern-${index}`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h5 className="font-medium text-evergreen">{pattern.name}</h5>
                        <Badge variant="secondary" className="text-xs">
                          {Math.round(pattern.confidence * 100)}% confidence
                        </Badge>
                      </div>
                      <p className="text-sm text-moss">{pattern.description}</p>
                      {pattern.recommendations && pattern.recommendations.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-evergreen">Recommendations:</div>
                          {pattern.recommendations.map((rec, recIndex) => (
                            <div key={recIndex} className="text-xs text-moss">
                              • {rec}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Alerts Tab */}
          <TabsContent value="alerts" className="space-y-4">
            <ScrollArea className="h-60">
              <div className="space-y-3">
                {insights?.alerts.map((alert, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${getPriorityColor(alert.priority)}`}
                    data-testid={`alert-${index}`}
                  >
                    <div className="flex items-start gap-3">
                      {getAlertIcon(alert.type)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge 
                            variant="secondary" 
                            className="text-xs capitalize"
                          >
                            {alert.type}
                          </Badge>
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${
                              alert.priority === 'high' ? 'bg-red-100 text-red-700' :
                              alert.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-sage/10 text-sage'
                            }`}
                          >
                            {alert.priority} priority
                          </Badge>
                        </div>
                        <p className="text-sm">{alert.message}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}