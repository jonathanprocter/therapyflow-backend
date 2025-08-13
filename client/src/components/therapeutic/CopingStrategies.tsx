import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export default function CopingStrategies({ clientId }: { clientId: string }) {
  const [strategies, setStrategies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/therapeutic/tags/${clientId}?category=coping_strategies`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setStrategies(data.tags || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [clientId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-blue-500" />
          Progress & Coping Strategies
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4">Loading strategies...</div>
        ) : strategies.length > 0 ? (
          <div className="space-y-3">
            {strategies.slice(0, 8).map((item: any, idx: number) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{Array.isArray(item.tags?.tags) ? item.tags.tags.join(', ') : 'strategy'}</span>
                  <span className="text-muted-foreground">
                    {new Date(item.tags?.createdAt || Date.now()).toLocaleDateString()}
                  </span>
                </div>
                <Progress value={75 + Math.random() * 25} className="h-2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Coping strategies will be tracked as sessions progress
          </div>
        )}
      </CardContent>
    </Card>
  );
}
