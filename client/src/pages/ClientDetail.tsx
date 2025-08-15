import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Network, Brain, ArrowRight, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SemanticEdge {
  id: string;
  documentId: string;
  from: string;
  to: string;
  relation: string;
  weight?: number;
  createdAt: string;
}

export default function ClientDetail() {
  const [clientId, setClientId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [loadingRecall, setLoadingRecall] = useState(false);
  const [graphEdges, setGraphEdges] = useState<SemanticEdge[]>([]);
  const [recallResults, setRecallResults] = useState<SemanticEdge[]>([]);
  const { toast } = useToast();

  const handleLoadGraph = async () => {
    if (!clientId) {
      toast({
        title: "Missing Client ID",
        description: "Please enter a client ID",
        variant: "destructive"
      });
      return;
    }

    setLoadingGraph(true);
    try {
      const response = await fetch(`/api/semantic/graph?clientId=${encodeURIComponent(clientId)}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load graph: ${response.status}`);
      }

      const data = await response.json();
      setGraphEdges(data.edges || []);
      
      toast({
        title: "Graph Loaded",
        description: `Found ${data.edges?.length || 0} semantic connections`
      });

    } catch (error) {
      console.error('Graph load error:', error);
      toast({
        title: "Graph Load Failed",
        description: String(error),
        variant: "destructive"
      });
    } finally {
      setLoadingGraph(false);
    }
  };

  const handleRecall = async () => {
    if (!clientId || !searchQuery) {
      toast({
        title: "Missing Information",
        description: "Please enter both client ID and search query",
        variant: "destructive"
      });
      return;
    }

    setLoadingRecall(true);
    try {
      const response = await fetch(`/api/semantic/recall?clientId=${encodeURIComponent(clientId)}&q=${encodeURIComponent(searchQuery)}`);
      
      if (!response.ok) {
        throw new Error(`Recall failed: ${response.status}`);
      }

      const data = await response.json();
      setRecallResults(data.edges || []);
      
      toast({
        title: "Recall Complete",
        description: `Found ${data.edges?.length || 0} relevant connections for "${searchQuery}"`
      });

    } catch (error) {
      console.error('Recall error:', error);
      toast({
        title: "Recall Failed",
        description: String(error),
        variant: "destructive"
      });
    } finally {
      setLoadingRecall(false);
    }
  };

  const getRelationColor = (relation: string) => {
    switch (relation.toLowerCase()) {
      case 'treats':
      case 'improves':
        return "bg-sage text-ivory";
      case 'causes':
      case 'worsens':
        return "bg-moss text-ivory";
      case 'relates':
      case 'connects':
        return "bg-french-blue text-ivory";
      default:
        return "bg-evergreen text-ivory";
    }
  };

  const renderEdgeList = (edges: SemanticEdge[], titlePrefix: string) => (
    <div className="space-y-3">
      {edges.map((edge) => (
        <Card key={edge.id} className="p-4" style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }} data-testid={`card-edge-${edge.id}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <Badge variant="outline" className="font-mono text-xs">
                {edge.from}
              </Badge>
              <div className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge className={getRelationColor(edge.relation)}>
                  {edge.relation}
                </Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {edge.to}
              </Badge>
            </div>
            <div className="text-right text-sm" style={{ color: '#738A6E' }}>
              {edge.weight && (
                <div>Weight: {edge.weight}</div>
              )}
              <div>Doc: {edge.documentId.substring(0, 8)}...</div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold" style={{ color: '#344C3D' }}>Client Semantic Analysis</h1>
        <p className="mt-2" style={{ color: '#738A6E' }}>
          Explore semantic connections and recall relevant clinical information
        </p>
      </div>

      <Card style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }}>
        <CardHeader>
          <CardTitle style={{ color: '#344C3D' }}>Client Selection</CardTitle>
          <CardDescription style={{ color: '#738A6E' }}>
            Enter a client ID to view their semantic graph and search their clinical data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="clientIdInput">Client ID</Label>
              <Input
                id="clientIdInput"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="Enter client ID"
                data-testid="input-client-id"
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleLoadGraph} 
                disabled={loadingGraph || !clientId}
                data-testid="button-load-graph"
              >
                {loadingGraph ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Network className="h-4 w-4 mr-2" />
                    Load Graph
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: '#344C3D' }}>
            <Search className="h-5 w-5" style={{ color: '#88A5BC' }} />
            Semantic Recall
          </CardTitle>
          <CardDescription style={{ color: '#738A6E' }}>
            Search for specific concepts within the client's clinical data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="searchInput">Search Query</Label>
              <Input
                id="searchInput"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g., anxiety, medication, therapy"
                data-testid="input-search-query"
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={handleRecall} 
                disabled={loadingRecall || !clientId || !searchQuery}
                data-testid="button-recall"
              >
                {loadingRecall ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    Recall
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {graphEdges.length > 0 && (
        <Card style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: '#344C3D' }}>
              <Network className="h-5 w-5" style={{ color: '#88A5BC' }} />
              Semantic Graph
            </CardTitle>
            <CardDescription style={{ color: '#738A6E' }}>
              All semantic connections for client "{clientId}" ({graphEdges.length} edges)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {renderEdgeList(graphEdges, "graph")}
          </CardContent>
        </Card>
      )}

      {recallResults.length > 0 && (
        <Card style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: '#344C3D' }}>
              <Brain className="h-5 w-5" style={{ color: '#88A5BC' }} />
              Recall Results
            </CardTitle>
            <CardDescription style={{ color: '#738A6E' }}>
              Semantic connections matching "{searchQuery}" ({recallResults.length} results)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {renderEdgeList(recallResults, "recall")}
          </CardContent>
        </Card>
      )}

      {clientId && !loadingGraph && graphEdges.length === 0 && (
        <Card style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }}>
          <CardContent className="text-center py-8">
            <Network className="h-12 w-12 mx-auto mb-4" style={{ color: '#88A5BC', opacity: 0.5 }} />
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#344C3D' }}>No Semantic Graph Found</h3>
            <p style={{ color: '#738A6E' }}>
              No semantic connections found for client "{clientId}". 
              Upload and process documents first to build the semantic graph.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}