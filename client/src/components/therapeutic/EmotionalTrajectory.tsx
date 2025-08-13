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
        if (data.success) setEmotionData(data.tags || []);
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
          <div className="text-center py-4">Loading emotional data...</div>
        ) : emotionData.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-3">
              Tracking {emotionData.length} emotional markers
            </p>
            <div className="flex flex-wrap gap-2">
              {emotionData.slice(0, 20).map((item: any, idx: number) => (
                <span key={idx} className="px-3 py-1 bg-secondary rounded-full text-xs">
                  {Array.isArray(item.tags?.tags) ? item.tags.tags.join(', ') : 'emotion'}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Emotional data will appear as sessions progress
          </div>
        )}
      </CardContent>
    </Card>
  );
}
