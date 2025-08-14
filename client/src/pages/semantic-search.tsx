import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Search, Clock, Tag, FileText, User, AlertCircle } from 'lucide-react';

interface RecallResult {
  directMatches: Array<{
    id: string;
    type: 'note' | 'insight' | 'tag';
    content: string;
    sessionDate: string;
    relevance: number;
  }>;
  relatedInsights: string[];
  patterns: string[];
}

export default function SemanticSearch() {
  const [query, setQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [searchResults, setSearchResults] = useState<RecallResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Get clients for dropdown
  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ['/api/clients'],
  });

  const performSearch = async () => {
    if (!query.trim() || !selectedClient) return;
    
    setIsSearching(true);
    try {
      const response = await fetch(`/api/therapeutic/recall/${selectedClient}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query.trim() }),
      });
      
      const data = await response.json();
      if (data.success) {
        setSearchResults(data.results);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'note': return <FileText className="h-4 w-4" />;
      case 'insight': return <AlertCircle className="h-4 w-4" />;
      case 'tag': return <Tag className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getRelevanceColor = (relevance: number) => {
    if (relevance > 0.8) return 'bg-green-500';
    if (relevance > 0.6) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6" data-testid="semantic-search-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Semantic Search</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-2">
            Search across client sessions, notes, and insights using AI-powered semantic recall
          </p>
        </div>
      </div>

      {/* Search Interface */}
      <Card data-testid="search-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Semantic Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Enter your search query (e.g., 'anxiety management', 'relationship issues', 'breakthrough moments')"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && performSearch()}
                data-testid="input-search-query"
              />
            </div>
            <div className="w-48">
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger data-testid="select-client">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client: any) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={performSearch}
              disabled={isSearching || !query.trim() || !selectedClient}
              data-testid="button-search"
            >
              {isSearching ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResults && (
        <Tabs defaultValue="matches" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="matches">
              Direct Matches ({searchResults.directMatches.length})
            </TabsTrigger>
            <TabsTrigger value="insights">
              Related Insights ({searchResults.relatedInsights.length})
            </TabsTrigger>
            <TabsTrigger value="patterns">
              Patterns ({searchResults.patterns.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="matches" className="space-y-4">
            {searchResults.directMatches.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-gray-500">
                  No direct matches found for your search query.
                </CardContent>
              </Card>
            ) : (
              searchResults.directMatches.map((match) => (
                <Card key={match.id} data-testid={`match-${match.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="mt-1">
                          {getTypeIcon(match.type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary" className="capitalize">
                              {match.type}
                            </Badge>
                            <div className="flex items-center gap-1 text-sm text-gray-500">
                              <Clock className="h-3 w-3" />
                              {new Date(match.sessionDate).toLocaleDateString()}
                            </div>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                            {match.content}
                          </p>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Relevance:</span>
                          <div className="flex items-center gap-1">
                            <div 
                              className={`w-2 h-2 rounded-full ${getRelevanceColor(match.relevance)}`}
                            />
                            <span className="text-xs font-medium">
                              {Math.round(match.relevance * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            {searchResults.relatedInsights.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-gray-500">
                  No related insights found.
                </CardContent>
              </Card>
            ) : (
              searchResults.relatedInsights.map((insight, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-4 w-4 mt-1 text-blue-500" />
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                        {insight}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="patterns" className="space-y-4">
            {searchResults.patterns.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-gray-500">
                  No patterns identified.
                </CardContent>
              </Card>
            ) : (
              searchResults.patterns.map((pattern, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Tag className="h-4 w-4 mt-1 text-purple-500" />
                      <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                        {pattern}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Help Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium mb-2">Effective Search Queries:</h4>
              <ul className="space-y-1 text-gray-600 dark:text-gray-300">
                <li>• "anxiety management techniques"</li>
                <li>• "breakthrough moments"</li>
                <li>• "relationship dynamics"</li>
                <li>• "coping mechanisms discussed"</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Search Features:</h4>
              <ul className="space-y-1 text-gray-600 dark:text-gray-300">
                <li>• Semantic understanding of therapeutic concepts</li>
                <li>• Cross-session pattern recognition</li>
                <li>• Relevance scoring for results</li>
                <li>• Context-aware insights</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}