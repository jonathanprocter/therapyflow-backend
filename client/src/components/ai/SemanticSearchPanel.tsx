import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, FileText, Calendar, User, AlertTriangle, Brain } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { formatDistanceToNow } from 'date-fns';

interface SearchResult {
  id: string;
  content: string;
  clientName?: string;
  sessionDate?: string;
  tags?: string[];
  relevanceScore: number;
  snippet: string;
}

interface SemanticSearchPanelProps {
  clientId?: string;
  onResultSelect?: (result: SearchResult) => void;
}

export function SemanticSearchPanel({ clientId, onResultSelect }: SemanticSearchPanelProps) {
  const [query, setQuery] = useState('');
  const [dateRange, setDateRange] = useState<string>('all');
  const [riskLevel, setRiskLevel] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Semantic Search Mutation
  const searchMutation = useMutation({
    mutationFn: async (searchData: {
      query: string;
      clientId?: string;
      dateRange?: any;
      tags?: string[];
      riskLevel?: string;
    }) =>
      apiRequest('/api/ai/search', {
        method: 'POST',
        body: JSON.stringify(searchData),
      }),
  });

  // Get related notes for a specific note
  const getRelatedNotes = useMutation({
    mutationFn: async (noteId: string) =>
      apiRequest(`/api/ai/related-notes/${noteId}?limit=5`),
  });

  // AI Health Check
  const { data: aiHealth } = useQuery<{ openai: boolean; anthropic: boolean; timestamp: string; services: any }>({
    queryKey: ['/api/ai/health'],
  });

  const handleSearch = () => {
    if (!query.trim()) return;

    const searchData: any = {
      query: query.trim(),
      clientId,
    };

    if (dateRange !== 'all') {
      searchData.dateRange = dateRange;
    }

    if (riskLevel !== 'all') {
      searchData.riskLevel = riskLevel;
    }

    if (selectedTags.length > 0) {
      searchData.tags = selectedTags;
    }

    searchMutation.mutate(searchData);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const results = searchMutation.data?.results || [];
  const isSearching = searchMutation.isPending;

  return (
    <div className="space-y-6" data-testid="semantic-search-panel">
      {/* Search Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-sage" />
            Semantic Search
          </CardTitle>
          <CardDescription>
            Search through clinical notes using AI-powered semantic understanding
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Query */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-evergreen">Search Query</label>
            <div className="flex gap-2">
              <Input
                placeholder="Search for themes, interventions, patterns, or specific content..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1"
                data-testid="input-search-query"
              />
              <Button
                onClick={handleSearch}
                disabled={!query.trim() || isSearching}
                className="bg-sage hover:bg-sage/90 text-white"
                data-testid="button-search"
              >
                {isSearching ? (
                  <>
                    <Brain className="mr-2 h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Search
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Search Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-evergreen">Date Range</label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger data-testid="select-date-range">
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="last-week">Last Week</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="last-3-months">Last 3 Months</SelectItem>
                  <SelectItem value="last-year">Last Year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-evergreen">Risk Level</label>
              <Select value={riskLevel} onValueChange={setRiskLevel}>
                <SelectTrigger data-testid="select-risk-level">
                  <SelectValue placeholder="Select risk level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="low">Low Risk</SelectItem>
                  <SelectItem value="medium">Medium Risk</SelectItem>
                  <SelectItem value="high">High Risk</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* AI Service Status */}
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm text-moss">
              Search powered by {aiHealth?.openai && aiHealth?.anthropic ? 'AI providers' : 'keyword matching'}
            </span>
            <div className="flex items-center gap-2">
              {aiHealth?.openai && (
                <Badge variant="secondary" className="bg-sage/10 text-sage text-xs">
                  OpenAI
                </Badge>
              )}
              {aiHealth?.anthropic && (
                <Badge variant="secondary" className="bg-sage/10 text-sage text-xs">
                  Anthropic
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchMutation.data && (
        <Card data-testid="search-results">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Search Results</span>
              <Badge variant="outline">
                {results.length} {results.length === 1 ? 'result' : 'results'}
              </Badge>
            </CardTitle>
            {searchMutation.data.metadata && (
              <CardDescription>
                Search type: {searchMutation.data.metadata.searchType}
                {searchMutation.data.metadata.processingTime && (
                  <span className="ml-2">
                    • {searchMutation.data.metadata.processingTime}ms
                  </span>
                )}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {results.length > 0 ? (
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {results.map((result: SearchResult, index: number) => (
                    <div
                      key={result.id || index}
                      className="p-4 bg-ivory rounded-lg border hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => onResultSelect?.(result)}
                      data-testid={`search-result-${index}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-french-blue" />
                            {result.clientName && (
                              <>
                                <User className="h-3 w-3 text-moss" />
                                <span className="text-sm font-medium text-evergreen">
                                  {result.clientName}
                                </span>
                              </>
                            )}
                            {result.sessionDate && (
                              <>
                                <Calendar className="h-3 w-3 text-moss" />
                                <span className="text-sm text-moss">
                                  {formatDistanceToNow(new Date(result.sessionDate), { addSuffix: true })}
                                </span>
                              </>
                            )}
                          </div>
                          
                          <p className="text-moss text-sm leading-relaxed">
                            {result.snippet || result.content}
                          </p>
                          
                          {result.tags && result.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {result.tags.slice(0, 4).map((tag, tagIndex) => (
                                <Badge key={tagIndex} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {result.tags.length > 4 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{result.tags.length - 4} more
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex-shrink-0">
                          <Badge 
                            variant="outline" 
                            className="text-xs"
                          >
                            {Math.round((result.relevanceScore || 0) * 100)}% match
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-moss">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No results found for your search query.</p>
                <p className="text-sm mt-1">Try different keywords or adjust your filters.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {searchMutation.isError && (
        <Alert data-testid="search-error">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Search failed: {searchMutation.error?.message || 'Unknown error occurred'}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}