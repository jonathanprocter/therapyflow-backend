import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Search, Filter } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

export default function SemanticSearch() {
  const [query, setQuery] = useState('');
  const [clientId, setClientId] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [riskLevel, setRiskLevel] = useState('all');
  const [tags, setTags] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ['/api/clients'],
    enabled: true,
  });

  const runSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const payload: any = { query };
      if (clientId !== 'all') payload.clientId = clientId;
      if (startDate && endDate) {
        payload.dateRange = { start: startDate, end: endDate };
      }
      if (riskLevel !== 'all') payload.riskLevel = riskLevel;
      if (tags.trim()) payload.tags = tags.split(',').map((tag) => tag.trim()).filter(Boolean);

      const response = await apiRequest('/api/ai/search', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' }
      });
      setResults(response.results || []);
    } catch (error) {
      console.error('Semantic search failed', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-ink">Semantic Search</h1>
        <p className="text-muted-foreground mt-1">Find clinical content with smart filters and relevance scoring.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-teal" />
            Search Query
          </CardTitle>
          <CardDescription>Search across progress notes using semantic + keyword matching.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search for themes, interventions, diagnoses..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="All clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={riskLevel} onValueChange={setRiskLevel}>
              <SelectTrigger>
                <SelectValue placeholder="All risk levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All risk levels</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              placeholder="Start date"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              placeholder="End date"
            />
          </div>
          <Input
            placeholder="Filter by tags (comma-separated)"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
          />
          <div className="flex items-center gap-3">
            <Button onClick={runSearch} disabled={loading || !query.trim()}>
              {loading ? 'Searching...' : 'Run Search'}
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              Filters apply to client, date range, tags, and risk level.
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {results.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">
              No results yet. Run a search to see matches.
            </CardContent>
          </Card>
        ) : (
          results.map((result) => (
            <Card key={result.noteId}>
              <CardHeader>
                <CardTitle className="text-base">{result.clientName}</CardTitle>
                <CardDescription>
                  {new Date(result.sessionDate).toLocaleDateString()} • Match: {result.matchType}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {result.content}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Score {Math.round(result.relevanceScore || 0)}</Badge>
                  {result.matchedTerms?.slice(0, 4).map((term: string) => (
                    <Badge key={term} variant="secondary">{term}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
