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
        if (data.success) setThemes(data.tags || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [clientId]);

  const getThemeSize = (index: number) => {
    if (index === 0) return 'text-2xl font-bold';
    if (index < 3) return 'text-xl font-semibold';
    if (index < 6) return 'text-lg';
    return 'text-base';
  };

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
          <div className="text-center py-4">Loading themes...</div>
        ) : themes.length > 0 ? (
          <div className="flex flex-wrap gap-4 justify-center min-h-[200px] items-center">
            {themes.slice(0, 12).map((item: any, idx: number) => (
              <span 
                key={idx} 
                className={`${getThemeSize(idx)} text-purple-600 hover:text-purple-800 cursor-pointer transition-colors`}
              >
                {Array.isArray(item.tags?.tags) ? item.tags.tags.join(', ') : 'theme'}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Themes will be identified as sessions progress
          </div>
        )}
      </CardContent>
    </Card>
  );
}
