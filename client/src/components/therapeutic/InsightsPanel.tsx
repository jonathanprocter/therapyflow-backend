import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb } from 'lucide-react';

export default function InsightsPanel({ clientId }: { clientId: string }) {
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/therapeutic/insights/${clientId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setInsights(data.insights || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [clientId]);

  if (loading) return <div className="text-center py-4">Loading insights...</div>;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-yellow-500" />
        Key Insights ({insights.length})
      </h3>
      
      {insights.length > 0 ? (
        insights.map((insight: any) => (
          <Card key={insight.id}>
            <CardContent className="p-4">
              <p className="text-sm mb-2">{insight.insight}</p>
              <div className="flex gap-2">
                <Badge variant="secondary">{insight.insightType || 'insight'}</Badge>
                <span className="text-xs text-muted-foreground">
                  {new Date(insight.createdAt).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="text-center py-8 text-muted-foreground">
            Insights will appear as sessions are analyzed
          </CardContent>
        </Card>
      )}
    </div>
  );
}
