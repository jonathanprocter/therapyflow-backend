import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';

export default function QuickRecall({ clientId }: { clientId: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    
    try {
      const response = await fetch(`/api/therapeutic/recall/${clientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      
      const data = await response.json();
      if (data.success) {
        setResults(data.results?.directMatches || []);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Search therapeutic records..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1"
          style={{ borderColor: 'rgba(115, 138, 110, 0.3)' }}
        />
        <Button 
          onClick={handleSearch} 
          disabled={loading} 
          style={{backgroundColor: '#88A5BC', borderColor: '#88A5BC'}} 
          className="hover:opacity-90"
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>
      
      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((result: any) => (
            <Card key={result.id} style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }}>
              <CardContent className="p-3">
                <p className="text-sm" style={{ color: '#738A6E' }}>{result.content}</p>
                <div className="mt-1 text-xs" style={{ color: '#738A6E' }}>
                  {result.type} • {Math.round((result.relevance || 0) * 100)}% match
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {results.length === 0 && query && !loading && (
        <Card style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }}>
          <CardContent className="text-center py-4" style={{ color: '#738A6E' }}>
            No results found for "{query}"
          </CardContent>
        </Card>
      )}
    </div>
  );
}
