import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Brain, 
  History, 
  Target, 
  TrendingUp,
  Clock,
  RefreshCw,
  BookOpen,
  Star,
  AlertTriangle
} from 'lucide-react';

interface ContextualMemoryData {
  recentPatterns: Array<{
    theme: string;
    frequency: string;
    lastMentioned: string;
    context: string;
  }>;
  relevantHistory: Array<{
    date: string;
    summary: string;
    significance: 'high' | 'medium' | 'low';
  }>;
  suggestedFocus: string[];
  interventionEffectiveness: Array<{
    intervention: string;
    effectiveness: number;
    timesUsed: number;
    clientFeedback: string;
  }>;
}

interface ContextualMemoryPanelProps {
  clientId: string;
  className?: string;
}

export function ContextualMemoryPanel({ clientId, className = '' }: ContextualMemoryPanelProps) {
  const [selectedActivity, setSelectedActivity] = useState<string>('session_opening');
  const [focusArea, setFocusArea] = useState<string>('');

  // Fetch contextual memory
  const { data: memory, isLoading, error, refetch } = useQuery<ContextualMemoryData>({
    queryKey: ['/api/contextual-memory', clientId, selectedActivity, focusArea],
    enabled: !!clientId,
    staleTime: 3 * 60 * 1000, // 3 minutes
  });

  const activityOptions = [
    { value: 'session_opening', label: 'Session Opening' },
    { value: 'goal_discussion', label: 'Goal Discussion' },
    { value: 'crisis_moment', label: 'Crisis Support' },
    { value: 'session_closing', label: 'Session Closing' },
    { value: 'intervention_planning', label: 'Intervention Planning' },
    { value: 'progress_review', label: 'Progress Review' },
  ];

  const getSignificanceColor = (significance: string) => {
    switch (significance) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-french-blue bg-french-blue/10 border-french-blue/20';
      case 'low': return 'text-sage bg-sage/10 border-sage/20';
      default: return 'text-moss bg-ivory border-moss/20';
    }
  };

  const getFrequencyColor = (frequency: string) => {
    switch (frequency.toLowerCase()) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-french-blue bg-french-blue/10';
      case 'low': return 'text-sage bg-sage/10';
      default: return 'text-moss bg-ivory';
    }
  };

  const formatRelativeDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return `${Math.floor(diffInDays / 30)} months ago`;
  };

  if (isLoading) {
    return (
      <Card className={className} data-testid="memory-loading">
        <CardContent className="py-8">
          <div className="text-center space-y-4">
            <Brain className="h-8 w-8 mx-auto text-sage animate-pulse" />
            <div>
              <h3 className="text-lg font-medium text-evergreen">Retrieving Memory</h3>
              <p className="text-moss text-sm mt-1">
                Accessing contextual therapeutic history...
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className} data-testid="memory-error">
        <CardContent className="py-8">
          <div className="text-center space-y-4">
            <AlertTriangle className="h-8 w-8 mx-auto text-red-500" />
            <div>
              <h3 className="text-lg font-medium text-evergreen">Memory Unavailable</h3>
              <p className="text-moss text-sm mt-1">
                Unable to retrieve contextual memory. Using manual recall.
              </p>
            </div>
            <Button
              onClick={() => refetch()}
              variant="outline"
              className="mt-4"
              data-testid="button-retry-memory"
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
    <Card className={className} data-testid="contextual-memory-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-sage" />
            <div>
              <CardTitle className="text-lg">Contextual Memory</CardTitle>
              <CardDescription>
                Right information at the right time • Clinical recall assistant
              </CardDescription>
            </div>
          </div>
          <Button
            onClick={() => refetch()}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            data-testid="button-refresh-memory"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Activity Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-evergreen">Current Activity</label>
          <Select value={selectedActivity} onValueChange={setSelectedActivity}>
            <SelectTrigger data-testid="select-activity">
              <SelectValue placeholder="Select current activity" />
            </SelectTrigger>
            <SelectContent>
              {activityOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Recent Patterns */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-sage" />
            <h4 className="font-medium text-evergreen">Recent Patterns to Check</h4>
          </div>
          <ScrollArea className="h-32">
            <div className="space-y-2">
              {memory?.recentPatterns.map((pattern, index) => (
                <div
                  key={index}
                  className="p-3 border rounded-lg hover:bg-ivory transition-colors"
                  data-testid={`pattern-${index}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-evergreen">{pattern.theme}</span>
                        <Badge 
                          variant="secondary" 
                          className={`text-xs ${getFrequencyColor(pattern.frequency)}`}
                        >
                          {pattern.frequency} frequency
                        </Badge>
                      </div>
                      <p className="text-sm text-moss">{pattern.context}</p>
                    </div>
                    <div className="text-xs text-moss text-right">
                      <Clock className="h-3 w-3 inline mr-1" />
                      {formatRelativeDate(pattern.lastMentioned)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Relevant History */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-sage" />
            <h4 className="font-medium text-evergreen">Relevant History</h4>
          </div>
          <ScrollArea className="h-40">
            <div className="space-y-2">
              {memory?.relevantHistory.map((item, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${getSignificanceColor(item.significance)}`}
                  data-testid={`history-${index}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge 
                          variant="secondary" 
                          className="text-xs capitalize"
                        >
                          {item.significance} significance
                        </Badge>
                        <span className="text-xs text-moss">
                          {formatRelativeDate(item.date)}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{item.summary}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Suggested Focus Areas */}
        {memory?.suggestedFocus && memory.suggestedFocus.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-sage" />
              <h4 className="font-medium text-evergreen">Suggested Focus</h4>
            </div>
            <div className="space-y-2">
              {memory.suggestedFocus.slice(0, 3).map((focus, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 p-2 rounded-lg bg-french-blue/5 border border-french-blue/20"
                  data-testid={`focus-${index}`}
                >
                  <Target className="h-4 w-4 text-french-blue mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-evergreen">{focus}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Intervention Effectiveness */}
        {memory?.interventionEffectiveness && memory.interventionEffectiveness.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-sage" />
              <h4 className="font-medium text-evergreen">Intervention Effectiveness</h4>
            </div>
            <div className="space-y-3">
              {memory.interventionEffectiveness.map((intervention, index) => (
                <div
                  key={index}
                  className="p-3 border rounded-lg"
                  data-testid={`intervention-${index}`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-evergreen">{intervention.intervention}</span>
                      <Badge variant="secondary" className="text-xs">
                        Used {intervention.timesUsed} times
                      </Badge>
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-moss">Effectiveness</span>
                        <span className="text-evergreen font-medium">
                          {Math.round(intervention.effectiveness * 100)}%
                        </span>
                      </div>
                      <Progress 
                        value={intervention.effectiveness * 100} 
                        className="h-2"
                      />
                    </div>
                    
                    {intervention.clientFeedback && (
                      <div className="text-sm text-moss italic">
                        <BookOpen className="h-3 w-3 inline mr-1" />
                        "{intervention.clientFeedback}"
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}