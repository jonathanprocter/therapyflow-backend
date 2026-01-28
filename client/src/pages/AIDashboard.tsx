import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Brain, Search, TrendingUp, Shield, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';

// Import AI Components
import { AIAnalysisPanel } from '@/components/ai/AIAnalysisPanel';
import { SemanticSearchPanel } from '@/components/ai/SemanticSearchPanel';
import { ProgressPatternsPanel } from '@/components/ai/ProgressPatternsPanel';

// Import Clinical Second Brain Components
import { KnowledgeGraphPanel } from '@/components/secondbrain/KnowledgeGraphPanel';
import { ProactiveInsightsPanel } from '@/components/secondbrain/ProactiveInsightsPanel';
import { ContextualMemoryPanel } from '@/components/secondbrain/ContextualMemoryPanel';

interface Client {
  id: string;
  name: string;
  therapistId: string;
  email?: string;
  phone?: string;
  status: string;
}

export default function AIDashboard() {
  const [selectedClientId, setSelectedClientId] = useState<string>('all-clients');
  const [activeTab, setActiveTab] = useState('analysis');

  // Fetch clients for dropdown
  const { data: clients } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  // AI Health Check
  const { data: aiHealth, refetch: refetchHealth } = useQuery<{ 
    openai: boolean; 
    anthropic: boolean; 
    timestamp: string; 
    services: { analysis: string; search: string; validation: string } 
  }>({
    queryKey: ['/api/ai/health'],
    refetchInterval: 30000, // Check every 30 seconds
  });

  const selectedClient = selectedClientId !== 'all-clients' ? clients?.find(client => client.id === selectedClientId) : null;

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="ai-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink">AI Clinical Dashboard</h1>
          <p className="text-sepia mt-2">
            Comprehensive AI-powered clinical analysis, search, and pattern recognition
          </p>
        </div>
        
        {/* AI Status Overview */}
        <Card className="w-80">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="h-5 w-5 text-teal" />
                AI Services Status
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchHealth()}
                className="h-8 w-8 p-0"
                data-testid="button-refresh-status"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                {aiHealth?.openai ? (
                  <CheckCircle className="h-4 w-4 text-teal" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm text-sepia">OpenAI</span>
              </div>
              <div className="flex items-center gap-2">
                {aiHealth?.anthropic ? (
                  <CheckCircle className="h-4 w-4 text-teal" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm text-sepia">Anthropic</span>
              </div>
            </div>
            
            {aiHealth?.services && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-sepia">Analysis:</span>
                  <Badge variant="secondary" className="text-xs">
                    {aiHealth.services.analysis}
                  </Badge>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-sepia">Search:</span>
                  <Badge variant="secondary" className="text-xs">
                    {aiHealth.services.search}
                  </Badge>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-sepia">Validation:</span>
                  <Badge variant="secondary" className="text-xs">
                    {aiHealth.services.validation}
                  </Badge>
                </div>
              </div>
            )}

            {(!aiHealth?.openai && !aiHealth?.anthropic) && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  All AI services using manual fallbacks
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Client Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Client Selection</CardTitle>
          <CardDescription>
            Select a client to analyze their specific data, or leave blank for system-wide analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger data-testid="select-client">
                  <SelectValue placeholder="Select a client (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-clients">All Clients</SelectItem>
                  {clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedClient && (
              <Badge variant="secondary" className="bg-teal/10 text-teal">
                {selectedClient.name}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* AI Tools Tabs - Enhanced with Clinical Second Brain */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="analysis" className="flex items-center gap-2" data-testid="tab-analysis">
            <Brain className="h-4 w-4" />
            AI Analysis
          </TabsTrigger>
          <TabsTrigger value="search" className="flex items-center gap-2" data-testid="tab-search">
            <Search className="h-4 w-4" />
            Semantic Search
          </TabsTrigger>
          <TabsTrigger value="patterns" className="flex items-center gap-2" data-testid="tab-patterns">
            <TrendingUp className="h-4 w-4" />
            Progress Patterns
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="flex items-center gap-2" data-testid="tab-knowledge">
            <Brain className="h-4 w-4" />
            Knowledge Graph
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-2" data-testid="tab-insights">
            <Shield className="h-4 w-4" />
            Proactive Insights
          </TabsTrigger>
          <TabsTrigger value="memory" className="flex items-center gap-2" data-testid="tab-memory">
            <Brain className="h-4 w-4" />
            Contextual Memory
          </TabsTrigger>
        </TabsList>

        {/* AI Analysis Tab */}
        <TabsContent value="analysis" className="space-y-6">
          <AIAnalysisPanel
            clientId={selectedClientId !== 'all-clients' ? selectedClientId : undefined}
            onAnalysisComplete={() => {
              // Analysis complete - panel handles display internally
            }}
          />
        </TabsContent>

        {/* Semantic Search Tab */}
        <TabsContent value="search" className="space-y-6">
          <SemanticSearchPanel
            clientId={selectedClientId !== 'all-clients' ? selectedClientId : undefined}
            onResultSelect={(result) => {
              // Navigate to the selected progress note
              if (result?.noteId) {
                window.location.href = `/progress-notes/${result.noteId}`;
              }
            }}
          />
        </TabsContent>

        {/* Progress Patterns Tab */}
        <TabsContent value="patterns" className="space-y-6">
          {selectedClientId !== 'all-clients' ? (
            <ProgressPatternsPanel clientId={selectedClientId} />
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center space-y-4">
                  <TrendingUp className="h-12 w-12 mx-auto text-sepia opacity-50" />
                  <div>
                    <h3 className="text-lg font-medium text-ink">Select a Client</h3>
                    <p className="text-sepia text-sm mt-1">
                      Progress patterns analysis requires a specific client to be selected.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Clinical Second Brain Tabs */}
        
        {/* Knowledge Graph Tab */}
        <TabsContent value="knowledge" className="space-y-6">
          {selectedClientId !== 'all-clients' ? (
            <KnowledgeGraphPanel
              clientId={selectedClientId}
              onEntitySelect={() => {
                // Entity selection handled by panel's internal state
              }}
            />
          ) : (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <Brain className="h-12 w-12 mx-auto text-sepia mb-4" />
                  <h3 className="text-lg font-medium text-ink mb-2">Knowledge Graph</h3>
                  <p className="text-sepia text-sm">
                    Select a specific client to build their clinical knowledge graph and explore therapeutic connections.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Proactive Insights Tab */}
        <TabsContent value="insights" className="space-y-6">
          {selectedClientId !== 'all-clients' ? (
            <ProactiveInsightsPanel 
              clientId={selectedClientId}
              context="session_opening"
            />
          ) : (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <Shield className="h-12 w-12 mx-auto text-sepia mb-4" />
                  <h3 className="text-lg font-medium text-ink mb-2">Proactive Insights</h3>
                  <p className="text-sepia text-sm">
                    Select a specific client to generate proactive insights and session preparation suggestions.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Contextual Memory Tab */}
        <TabsContent value="memory" className="space-y-6">
          {selectedClientId !== 'all-clients' ? (
            <ContextualMemoryPanel 
              clientId={selectedClientId}
            />
          ) : (
            <Card>
              <CardContent className="py-8">
                <div className="text-center">
                  <Brain className="h-12 w-12 mx-auto text-sepia mb-4" />
                  <h3 className="text-lg font-medium text-ink mb-2">Contextual Memory</h3>
                  <p className="text-sepia text-sm">
                    Select a specific client to access their contextual memory and relevant therapeutic history.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Security Notice */}
      <Card className="border-teal/20 bg-teal/5">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-teal mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <h4 className="text-sm font-medium text-ink">HIPAA Compliance & Security</h4>
              <p className="text-xs text-sepia leading-relaxed">
                All AI interactions are encrypted, audited, and comply with HIPAA regulations. 
                No PHI is transmitted to external services without proper safeguards. 
                Audit logs are maintained for all AI operations and data access.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}