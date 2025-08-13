#!/bin/bash

echo "🎨 Creating all therapeutic components..."

mkdir -p client/src/components/therapeutic

# Create each component file directly
echo "Creating InsightsPanel..."
cat > client/src/components/therapeutic/InsightsPanel.tsx << 'ENDFILE'
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Calendar } from 'lucide-react';

export default function InsightsPanel({ clientId }: { clientId: string }) {
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/therapeutic/insights/${clientId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setInsights(data.insights);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [clientId]);

  if (loading) return <div>Loading insights...</div>;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-yellow-500" />
        Key Insights ({insights.length})
      </h3>
      {insights.map((insight: any) => (
        <Card key={insight.id}>
          <CardContent className="p-4">
            <p className="text-sm">{insight.insight}</p>
            <div className="flex gap-2 mt-2">
              <Badge variant="secondary">{insight.insightType}</Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(insight.createdAt).toLocaleDateString()}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
ENDFILE

echo "Creating EmotionalTrajectory..."
cat > client/src/components/therapeutic/EmotionalTrajectory.tsx << 'ENDFILE'
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Heart } from 'lucide-react';

export default function EmotionalTrajectory({ clientId }: { clientId: string }) {
  const [emotionData, setEmotionData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/therapeutic/tags/${clientId}?category=emotions`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setEmotionData(data.tags);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [clientId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-red-500" />
          Emotional Journey
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div>Loading emotional data...</div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Tracking {emotionData.length} emotional markers
            </p>
            <div className="flex flex-wrap gap-2">
              {emotionData.slice(0, 10).map((item: any, idx: number) => (
                <span key={idx} className="px-2 py-1 bg-secondary rounded text-xs">
                  {item.tags.tags?.join(', ')}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
ENDFILE

echo "Creating ThemeCloud..."
cat > client/src/components/therapeutic/ThemeCloud.tsx << 'ENDFILE'
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target } from 'lucide-react';

export default function ThemeCloud({ clientId }: { clientId: string }) {
  const [themes, setThemes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/therapeutic/tags/${clientId}?category=themes`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setThemes(data.tags);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [clientId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-purple-500" />
          Recurring Themes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div>Loading themes...</div>
        ) : (
          <div className="flex flex-wrap gap-3 justify-center min-h-[200px] items-center">
            {themes.length > 0 ? (
              themes.slice(0, 8).map((item: any, idx: number) => (
                <span 
                  key={idx} 
                  className="text-lg font-semibold text-purple-600 hover:text-purple-800"
                >
                  {item.tags.tags?.join(', ')}
                </span>
              ))
            ) : (
              <p className="text-muted-foreground">Themes will appear here</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
ENDFILE

echo "Creating CopingStrategies..."
cat > client/src/components/therapeutic/CopingStrategies.tsx << 'ENDFILE'
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';

export default function CopingStrategies({ clientId }: { clientId: string }) {
  const [strategies, setStrategies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/therapeutic/tags/${clientId}?category=coping_strategies`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setStrategies(data.tags);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [clientId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-500" />
          Coping Strategies
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div>Loading strategies...</div>
        ) : (
          <div className="space-y-3">
            {strategies.length > 0 ? (
              strategies.slice(0, 5).map((item: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center">
                  <span className="text-sm">{item.tags.tags?.join(', ')}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(item.tags.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">Strategies will appear here</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
ENDFILE

echo "Creating QuickRecall..."
cat > client/src/components/therapeutic/QuickRecall.tsx << 'ENDFILE'
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
        setResults(data.results.directMatches || []);
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
        />
        <Button onClick={handleSearch} disabled={loading}>
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((result: any) => (
            <Card key={result.id}>
              <CardContent className="p-3">
                <p className="text-sm">{result.content}</p>
                <span className="text-xs text-muted-foreground">
                  {result.type} • {Math.round(result.relevance * 100)}% match
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
ENDFILE

echo "Creating JourneySynthesis..."
cat > client/src/components/therapeutic/JourneySynthesis.tsx << 'ENDFILE'
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, TrendingUp, Heart, Target } from 'lucide-react';

interface JourneySynthesisProps {
  clientId: string;
  synthesisData: any;
  onRegenerate: () => void;
  loading: boolean;
}

export default function JourneySynthesis({ 
  synthesisData, 
  onRegenerate, 
  loading 
}: JourneySynthesisProps) {
  if (!synthesisData) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="mb-4">Generate a comprehensive journey analysis</p>
          <Button onClick={onRegenerate}>Generate Analysis</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Journey Overview</h3>
        <Button variant="outline" size="sm" onClick={onRegenerate} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Regenerate
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {synthesisData.progressIndicators?.breakthroughCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">Breakthroughs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-500" />
              Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {synthesisData.emotionalTrajectory?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Tracked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-purple-500" />
              Themes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.keys(synthesisData.dominantThemes?.frequency || {}).length}
            </div>
            <p className="text-xs text-muted-foreground">Identified</p>
          </CardContent>
        </Card>
      </div>

      {synthesisData.recommendations && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {synthesisData.recommendations.map((rec: string, idx: number) => (
                <li key={idx} className="text-sm">• {rec}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
ENDFILE

echo "Creating index export file..."
cat > client/src/components/therapeutic/index.ts << 'ENDFILE'
export { default as TherapeuticJourneyDashboard } from './TherapeuticJourneyDashboard';
export { default as InsightsPanel } from './InsightsPanel';
export { default as EmotionalTrajectory } from './EmotionalTrajectory';
export { default as ThemeCloud } from './ThemeCloud';
export { default as CopingStrategies } from './CopingStrategies';
export { default as QuickRecall } from './QuickRecall';
export { default as JourneySynthesis } from './JourneySynthesis';
ENDFILE

echo ""
echo "✅ All therapeutic components created successfully!"
echo ""
echo "📁 Components created in: client/src/components/therapeutic/"
echo ""
echo "🚀 To use, add to any client page:"
echo "   import { TherapeuticJourneyDashboard } from '@/components/therapeutic';"
echo "   <TherapeuticJourneyDashboard clientId={clientId} />"
echo ""
echo "🎉 Therapeutic Journey UI is ready!"
