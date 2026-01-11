import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Brain, 
  Network, 
  TrendingUp, 
  Lightbulb, 
  AlertTriangle, 
  Target,
  Clock,
  RefreshCw,
  Eye,
  ArrowRight
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface ClinicalEntity {
  id: string;
  type: 'client' | 'goal' | 'intervention' | 'theme' | 'pattern' | 'outcome' | 'emotion' | 'behavior';
  name: string;
  metadata: {
    frequency: number;
    context: string;
    sentiment?: 'positive' | 'negative' | 'neutral';
    sessionIds: string[];
  };
}

interface ClinicalConnection {
  id: string;
  relationshipType: string;
  strength: number;
  frequency: number;
  evidence: string[];
}

interface KnowledgeGraphData {
  entities: ClinicalEntity[];
  connections: ClinicalConnection[];
  insights: string[];
  therapeuticJourney: {
    timeline: any[];
    patterns: any[];
    breakthroughs: any[];
    challenges: any[];
    progressIndicators: any[];
  };
}

interface KnowledgeGraphPanelProps {
  clientId: string;
  onEntitySelect?: (entity: ClinicalEntity) => void;
  className?: string;
}

export function KnowledgeGraphPanel({ clientId, onEntitySelect, className="" }: KnowledgeGraphPanelProps) {
  const [activeView, setActiveView] = useState<'entities' | 'connections' | 'journey'>('entities');
  const [selectedEntityType, setSelectedEntityType] = useState<string>('all');

  // Fetch knowledge graph data
  const { data: graphData, isLoading, error, refetch } = useQuery<KnowledgeGraphData>({
    queryKey: ['/api/knowledge-graph', clientId],
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Build knowledge graph mutation
  const buildGraphMutation = useMutation({
    mutationFn: () => apiRequest(`/api/knowledge-graph/${clientId}`),
    onSuccess: () => {
      refetch();
    },
  });

  const entityTypes = graphData?.entities 
    ? Array.from(new Set(graphData.entities.map(e => e.type)))
    : [];

  const filteredEntities = selectedEntityType === 'all' 
    ? graphData?.entities || []
    : graphData?.entities.filter(e => e.type === selectedEntityType) || [];

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'theme': return <Brain className="h-4 w-4" />;
      case 'emotion': return <Target className="h-4 w-4" />;
      case 'behavior': return <TrendingUp className="h-4 w-4" />;
      case 'intervention': return <Lightbulb className="h-4 w-4" />;
      case 'goal': return <Target className="h-4 w-4" />;
      default: return <Network className="h-4 w-4" />;
    }
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return 'text-teal bg-teal/10';
      case 'negative': return 'text-red-600 bg-red-50';
      case 'neutral': return 'text-sepia bg-parchment';
      default: return 'text-sepia bg-parchment';
    }
  };

  const getConnectionTypeColor = (type: string) => {
    switch (type) {
      case 'leads_to': return 'text-teal bg-teal/10';
      case 'improves': return 'text-teal bg-teal/10';
      case 'worsens': return 'text-red-600 bg-red-50';
      case 'relates_to': return 'text-sepia bg-parchment';
      default: return 'text-sepia bg-parchment';
    }
  };

  if (isLoading) {
    return (
      <Card className={className} data-testid="knowledge-graph-loading">
        <CardContent className="py-8">
          <div className="text-center space-y-4">
            <Brain className="h-8 w-8 mx-auto text-teal animate-pulse" />
            <div>
              <h3 className="text-lg font-medium text-ink">Building Knowledge Graph</h3>
              <p className="text-sepia text-sm mt-1">
                Analyzing therapeutic patterns and connections...
              </p>
            </div>
            <Progress value={75} className="w-48 mx-auto" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className} data-testid="knowledge-graph-error">
        <CardContent className="py-8">
          <div className="text-center space-y-4">
            <AlertTriangle className="h-8 w-8 mx-auto text-red-500" />
            <div>
              <h3 className="text-lg font-medium text-ink">Knowledge Graph Unavailable</h3>
              <p className="text-sepia text-sm mt-1">
                Unable to build knowledge graph. Using manual analysis.
              </p>
            </div>
            <Button
              onClick={() => buildGraphMutation.mutate()}
              disabled={buildGraphMutation.isPending}
              variant="outline"
              className="mt-4"
              data-testid="button-retry-graph"
            >
              {buildGraphMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Retry Building Graph
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className} data-testid="knowledge-graph-panel">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-teal" />
            <div>
              <CardTitle className="text-lg">Clinical Knowledge Graph</CardTitle>
              <CardDescription>
                Intelligent pattern recognition and therapeutic insights
              </CardDescription>
            </div>
          </div>
          <Button
            onClick={() => refetch()}
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            data-testid="button-refresh-graph"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Graph Statistics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-parchment rounded-lg">
            <div className="text-2xl font-bold text-ink">
              {graphData?.entities.length || 0}
            </div>
            <div className="text-sm text-sepia">Entities</div>
          </div>
          <div className="text-center p-3 bg-parchment rounded-lg">
            <div className="text-2xl font-bold text-ink">
              {graphData?.connections.length || 0}
            </div>
            <div className="text-sm text-sepia">Connections</div>
          </div>
          <div className="text-center p-3 bg-parchment rounded-lg">
            <div className="text-2xl font-bold text-ink">
              {graphData?.insights.length || 0}
            </div>
            <div className="text-sm text-sepia">Insights</div>
          </div>
        </div>

        {/* Key Insights */}
        {graphData?.insights && graphData.insights.length > 0 && (
          <Alert className="border-teal/20 bg-teal/5">
            <Lightbulb className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <div className="font-medium text-ink">Key Insights</div>
                {graphData.insights.slice(0, 3).map((insight, index) => (
                  <div key={index} className="text-sm text-sepia">
                    • {insight}
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Navigation Tabs */}
        <Tabs value={activeView} onValueChange={(value) => setActiveView(value as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="entities" data-testid="tab-entities">
              <Network className="h-4 w-4 mr-2" />
              Entities
            </TabsTrigger>
            <TabsTrigger value="connections" data-testid="tab-connections">
              <ArrowRight className="h-4 w-4 mr-2" />
              Connections
            </TabsTrigger>
            <TabsTrigger value="journey" data-testid="tab-journey">
              <TrendingUp className="h-4 w-4 mr-2" />
              Journey
            </TabsTrigger>
          </TabsList>

          {/* Entities View */}
          <TabsContent value="entities" className="space-y-4">
            {/* Entity Type Filter */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedEntityType === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedEntityType('all')}
                className="h-8"
                data-testid="filter-all-entities"
              >
                All ({graphData?.entities.length || 0})
              </Button>
              {entityTypes.map((type) => {
                const count = graphData?.entities.filter(e => e.type === type).length || 0;
                return (
                  <Button
                    key={type}
                    variant={selectedEntityType === type ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedEntityType(type)}
                    className="h-8 capitalize"
                    data-testid={`filter-${type}`}
                  >
                    {type.replace('_', ' ')} ({count})
                  </Button>
                );
              })}
            </div>

            {/* Entities List */}
            <ScrollArea className="h-80">
              <div className="space-y-2">
                {filteredEntities.map((entity) => (
                  <div
                    key={entity.id}
                    className="p-3 border rounded-lg hover:bg-parchment transition-colors cursor-pointer"
                    onClick={() => onEntitySelect?.(entity)}
                    data-testid={`entity-${entity.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          {getEntityIcon(entity.type)}
                          <span className="font-medium text-ink">{entity.name}</span>
                          <Badge variant="secondary" className="text-xs capitalize">
                            {entity.type.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-sm text-sepia">
                          {entity.metadata.context.substring(0, 100)}...
                        </p>
                        <div className="flex items-center gap-2 text-xs text-sepia">
                          <span>Frequency: {entity.metadata.frequency}</span>
                          <span>•</span>
                          <span>Sessions: {entity.metadata.sessionIds.length}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {entity.metadata.sentiment && (
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${getSentimentColor(entity.metadata.sentiment)}`}
                          >
                            {entity.metadata.sentiment}
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          data-testid={`view-entity-${entity.id}`}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Connections View */}
          <TabsContent value="connections" className="space-y-4">
            <ScrollArea className="h-80">
              <div className="space-y-3">
                {graphData?.connections.map((connection) => {
                  const fromEntity = graphData.entities.find(e => e.id === connection.fromEntityId);
                  const toEntity = graphData.entities.find(e => e.id === connection.toEntityId);
                  
                  if (!fromEntity || !toEntity) return null;

                  return (
                    <div
                      key={connection.id}
                      className="p-3 border rounded-lg"
                      data-testid={`connection-${connection.id}`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-ink text-sm">
                              {fromEntity.name}
                            </span>
                            <ArrowRight className="h-4 w-4 text-sepia" />
                            <span className="font-medium text-ink text-sm">
                              {toEntity.name}
                            </span>
                          </div>
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${getConnectionTypeColor(connection.relationshipType)}`}
                          >
                            {connection.relationshipType.replace('_', ' ')}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 text-xs text-sepia">
                          <span>Strength: {Math.round(connection.strength * 100)}%</span>
                          <span>•</span>
                          <span>Frequency: {connection.frequency}</span>
                        </div>
                        
                        {connection.evidence && connection.evidence.length > 0 && (
                          <div className="text-xs text-sepia">
                            Evidence: {connection.evidence[0]}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Therapeutic Journey View */}
          <TabsContent value="journey" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium text-ink">Timeline Events</h4>
                <div className="text-2xl font-bold text-teal">
                  {graphData?.therapeuticJourney.timeline.length || 0}
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-ink">Patterns Identified</h4>
                <div className="text-2xl font-bold text-teal">
                  {graphData?.therapeuticJourney.patterns.length || 0}
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-ink">Breakthroughs</h4>
                <div className="text-2xl font-bold text-teal">
                  {graphData?.therapeuticJourney.breakthroughs.length || 0}
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-ink">Active Challenges</h4>
                <div className="text-2xl font-bold text-teal">
                  {graphData?.therapeuticJourney.challenges.length || 0}
                </div>
              </div>
            </div>

            {/* Progress Indicators */}
            {graphData?.therapeuticJourney.progressIndicators && graphData.therapeuticJourney.progressIndicators.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-ink">Progress Indicators</h4>
                <div className="space-y-2">
                  {graphData.therapeuticJourney.progressIndicators.map((indicator: any, index: number) => (
                    <div key={index} className="p-2 bg-parchment rounded">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-ink">{indicator.metric}</span>
                        <Badge variant={indicator.trend === 'improving' ? 'default' : 'secondary'}>
                          {indicator.trend}
                        </Badge>
                      </div>
                      <Progress 
                        value={indicator.currentValue * 100} 
                        className="mt-1 h-2"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}