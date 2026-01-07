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
    <Card style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2" style={{ color: '#344C3D' }}>
          <Heart className="h-5 w-5" style={{ color: '#8EA58C' }} />
          Emotional Journey
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-4" style={{ color: '#738A6E' }}>Loading emotional data...</div>
        ) : emotionData.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm mb-3" style={{ color: '#738A6E' }}>
              Tracking {emotionData.length} emotional markers
            </p>
            <div className="flex flex-wrap gap-2">
              {emotionData.slice(0, 20).map((item: any, idx: number) => (
                <span 
                  key={idx} 
                  className="px-3 py-1 rounded-full text-xs"
                  style={{ backgroundColor: 'rgba(136, 165, 188, 0.1)', color: '#88A5BC' }}
                >
                  {Array.isArray(item.tags?.tags) ? item.tags.tags.join(', ') : 'emotion'}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8" style={{ color: '#738A6E' }}>
            Emotional data will appear as sessions progress
          </div>
        )}
      </CardContent>
    </Card>
  );
}
