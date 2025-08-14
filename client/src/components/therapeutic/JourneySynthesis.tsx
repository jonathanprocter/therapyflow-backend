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
          <p className="mb-4 text-muted-foreground">
            Generate a comprehensive journey analysis
          </p>
          <Button onClick={onRegenerate} disabled={loading}>
            {loading ? 'Generating...' : 'Generate Analysis'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Journey Overview</h3>
        <Button variant="outline" size="sm" onClick={onRegenerate} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
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
              <Target className="h-4 w-4" style={{color: '#88A5BC'}} />
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

      {synthesisData.recommendations && synthesisData.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{backgroundColor: '#88A5BC'}}></span>
              AI Recommendations
            </CardTitle>
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
