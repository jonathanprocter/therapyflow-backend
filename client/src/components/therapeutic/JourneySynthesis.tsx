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
      <Card style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }}>
        <CardContent className="text-center py-8">
          <p className="mb-4" style={{ color: '#738A6E' }}>
            Generate a comprehensive journey analysis
          </p>
          <Button 
            onClick={onRegenerate} 
            disabled={loading}
            style={{ backgroundColor: '#8EA58C', color: '#FFFFFF' }}
          >
            {loading ? 'Generating...' : 'Generate Analysis'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold" style={{ color: '#344C3D' }}>Journey Overview</h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onRegenerate} 
          disabled={loading}
          style={{ borderColor: '#8EA58C', color: '#8EA58C' }}
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2" style={{ color: '#344C3D' }}>
              <TrendingUp className="h-4 w-4" style={{ color: '#8EA58C' }} />
              Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: '#344C3D' }}>
              {synthesisData.progressIndicators?.breakthroughCount || 0}
            </div>
            <p className="text-xs" style={{ color: '#738A6E' }}>Breakthroughs</p>
          </CardContent>
        </Card>

        <Card style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2" style={{ color: '#344C3D' }}>
              <Heart className="h-4 w-4" style={{ color: '#88A5BC' }} />
              Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: '#344C3D' }}>
              {synthesisData.emotionalTrajectory?.length || 0}
            </div>
            <p className="text-xs" style={{ color: '#738A6E' }}>Tracked</p>
          </CardContent>
        </Card>

        <Card style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2" style={{ color: '#344C3D' }}>
              <Target className="h-4 w-4" style={{color: '#738A6E'}} />
              Themes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: '#344C3D' }}>
              {Object.keys(synthesisData.dominantThemes?.frequency || {}).length}
            </div>
            <p className="text-xs" style={{ color: '#738A6E' }}>Identified</p>
          </CardContent>
        </Card>
      </div>

      {synthesisData.recommendations && synthesisData.recommendations.length > 0 && (
        <Card style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }}>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2" style={{ color: '#344C3D' }}>
              <span className="w-2 h-2 rounded-full" style={{backgroundColor: '#88A5BC'}}></span>
              AI Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {synthesisData.recommendations.map((rec: string, idx: number) => (
                <li key={idx} className="text-sm" style={{ color: '#738A6E' }}>• {rec}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
