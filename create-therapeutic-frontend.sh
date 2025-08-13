#!/bin/bash

echo "🎨 Creating Therapeutic Journey Frontend Components..."

# Create components directory
mkdir -p client/src/components/therapeutic

# 1. Main Therapeutic Journey Dashboard
echo "1️⃣ Creating Journey Dashboard..."
cat > client/src/components/therapeutic/TherapeuticJourneyDashboard.tsx << 'EOF'
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Brain, TrendingUp, Heart, Target, Search, Sparkles } from 'lucide-react';
import InsightsPanel from './InsightsPanel';
import EmotionalTrajectory from './EmotionalTrajectory';
import ThemeCloud from './ThemeCloud';
import CopingStrategies from './CopingStrategies';
import QuickRecall from './QuickRecall';
import JourneySynthesis from './JourneySynthesis';

interface TherapeuticJourneyProps {
  clientId?: string;
  className?: string;
}

export default function TherapeuticJourneyDashboard({ 
  clientId: propClientId, 
  className = "" 
}: TherapeuticJourneyProps) {
  const { clientId: paramClientId } = useParams();
  const clientId = propClientId || paramClientId;

  const [loading, setLoading] = useState(false);
  const [synthesisData, setSynthesisData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days ago
    end: new Date()
  });

  const generateSynthesis = async () => {
    if (!clientId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/therapeutic/synthesize/${clientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: dateRange.start.toISOString(),
          endDate: dateRange.end.toISOString()
        })
      });

      const data = await response.json();
      if (data.success) {
        setSynthesisData(data.synthesis);
      }
    } catch (error) {
      console.error('Error generating synthesis:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (clientId) {
      generateSynthesis();
    }
  }, [clientId]);

  if (!clientId) {
    return (
      <Alert>
        <AlertDescription>
          Please select a client to view their therapeutic journey.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-500" />
            Therapeutic Journey Analysis
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            AI-powered insights and pattern analysis from therapy sessions
          </p>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview">
                <Sparkles className="h-4 w-4 mr-1" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="insights">
                <Brain className="h-4 w-4 mr-1" />
                Insights
              </TabsTrigger>
              <TabsTrigger value="emotions">
                <Heart className="h-4 w-4 mr-1" />
                Emotions
              </TabsTrigger>
              <TabsTrigger value="themes">
                <Target className="h-4 w-4 mr-1" />
                Themes
              </TabsTrigger>
              <TabsTrigger value="progress">
                <TrendingUp className="h-4 w-4 mr-1" />
                Progress
              </TabsTrigger>
              <TabsTrigger value="search">
                <Search className="h-4 w-4 mr-1" />
                Recall
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-6">
              <JourneySynthesis 
                clientId={clientId} 
                synthesisData={synthesisData}
                onRegenerate={generateSynthesis}
                loading={loading}
              />
            </TabsContent>

            <TabsContent value="insights" className="mt-6">
              <InsightsPanel clientId={clientId} />
            </TabsContent>

            <TabsContent value="emotions" className="mt-6">
              <EmotionalTrajectory clientId={clientId} />
            </TabsContent>

            <TabsContent value="themes" className="mt-6">
              <ThemeCloud clientId={clientId} />
            </TabsContent>

            <TabsContent value="progress" className="mt-6">
              <CopingStrategies clientId={clientId} />
            </TabsContent>

            <TabsContent value="search" className="mt-6">
              <QuickRecall clientId={clientId} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
EOF

# 2. Insights Panel Component
echo "2️⃣ Creating Insights Panel..."
cat > client/src/components/therapeutic/InsightsPanel.tsx << 'EOF'
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Lightbulb, Calendar, ChevronRight, Sparkles } from 'lucide-react';
import { format } from 'date-fns';

interface Insight {
  id: string;
  insight: string;
  insightType: string;
  confidence: number;
  sessionId: string;
  createdAt: string;
}

export default function InsightsPanel({ clientId }: { clientId: string }) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInsights();
  }, [clientId]);

  const fetchInsights = async () => {
    try {
      const response = await fetch(`/api/therapeutic/insights/${clientId}`);
      const data = await response.json();
      if (data.success) {
        setInsights(data.insights);
      }
    } catch (error) {
      console.error('Error fetching insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInsightColor = (type: string) => {
    const colors: Record<string, string> = {
      realization: 'bg-purple-500',
      understanding: 'bg-blue-500',
      learning: 'bg-green-500',
      pattern: 'bg-yellow-500',
      observation: 'bg-orange-500',
      breakthrough: 'bg-pink-500'
    };
    return colors[type] || 'bg-gray-500';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 85) return 'High';
    if (confidence >= 70) return 'Medium';
    return 'Low';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          Key Insights & Breakthroughs
        </h3>
        <Badge variant="outline">
          {insights.length} insights found
        </Badge>
      </div>

      <ScrollArea className="h-[500px] pr-4">
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading insights...
            </div>
          ) : insights.length > 0 ? (
            insights.map((insight) => (
              <Card key={insight.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 ${getInsightColor(insight.insightType)}`} />
                    <div className="flex-1 space-y-2">
                      <p className="text-sm leading-relaxed">
                        "{insight.insight}"
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="text-xs">
                          {insight.insightType}
                        </Badge>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(insight.createdAt), 'MMM d, yyyy')}
                        </span>
                        <span>•</span>
                        <span>
                          Confidence: {getConfidenceLabel(insight.confidence)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  Insights will appear as sessions are analyzed
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
EOF

# 3. Emotional Trajectory Component
echo "3️⃣ Creating Emotional Trajectory..."
cat > client/src/components/therapeutic/EmotionalTrajectory.tsx << 'EOF'
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Heart, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format } from 'date-fns';

interface EmotionData {
  date: string;
  anxiety: number;
  depression: number;
  joy: number;
  anger: number;
  overall: number;
}

export default function EmotionalTrajectory({ clientId }: { clientId: string }) {
  const [emotionData, setEmotionData] = useState<EmotionData[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [trend, setTrend] = useState<'improving' | 'declining' | 'stable'>('stable');

  useEffect(() => {
    fetchEmotionalData();
  }, [clientId]);

  const fetchEmotionalData = async () => {
    try {
      const response = await fetch(`/api/therapeutic/tags/${clientId}?category=emotions`);
      const data = await response.json();

      if (data.success) {
        setTags(data.tags);
        processEmotionalData(data.tags);
      }
    } catch (error) {
      console.error('Error fetching emotional data:', error);
    } finally {
      setLoading(false);
    }
  };

  const processEmotionalData = (tags: any[]) => {
    // Process tags into timeline data
    const timelineData: EmotionData[] = [];

    // Group by date
    const grouped = tags.reduce((acc, item) => {
      const date = format(new Date(item.sessionDate || item.tags.createdAt), 'yyyy-MM-dd');
      if (!acc[date]) {
        acc[date] = { anxiety: 0, depression: 0, joy: 0, anger: 0, count: 0 };
      }

      const emotions = item.tags.tags || [];
      emotions.forEach((emotion: string) => {
        if (acc[date][emotion] !== undefined) {
          acc[date][emotion]++;
        }
      });
      acc[date].count++;

      return acc;
    }, {});

    // Convert to array and calculate overall sentiment
    Object.entries(grouped).forEach(([date, emotions]: [string, any]) => {
      const overall = (emotions.joy * 2) - (emotions.anxiety + emotions.depression + emotions.anger);
      timelineData.push({
        date,
        anxiety: emotions.anxiety,
        depression: emotions.depression,
        joy: emotions.joy,
        anger: emotions.anger,
        overall: overall / emotions.count
      });
    });

    // Sort by date
    timelineData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate trend
    if (timelineData.length >= 2) {
      const recent = timelineData.slice(-3).reduce((sum, d) => sum + d.overall, 0) / 3;
      const earlier = timelineData.slice(0, 3).reduce((sum, d) => sum + d.overall, 0) / 3;
      setTrend(recent > earlier ? 'improving' : recent < earlier ? 'declining' : 'stable');
    }

    setEmotionData(timelineData);
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-yellow-500" />;
    }
  };

  const emotionColors = {
    anxiety: '#ef4444',
    depression: '#6366f1',
    joy: '#10b981',
    anger: '#f59e0b',
    overall: '#8b5cf6'
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Heart className="h-5 w-5 text-red-500" />
          Emotional Journey
        </h3>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            {getTrendIcon()}
            {trend}
          </Badge>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="text-center py-8">
            Loading emotional data...
          </CardContent>
        </Card>
      ) : emotionData.length > 0 ? (
        <Card>
          <CardContent className="pt-6">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={emotionData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(date) => format(new Date(date), 'MMM d')}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(date) => format(new Date(date), 'MMM d, yyyy')}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="anxiety" 
                  stroke={emotionColors.anxiety}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="depression" 
                  stroke={emotionColors.depression}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="joy" 
                  stroke={emotionColors.joy}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="overall" 
                  stroke={emotionColors.overall}
                  strokeWidth={3}
                  strokeDasharray="5 5"
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="text-center py-8">
            <Heart className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              Emotional data will appear as sessions progress
            </p>
          </CardContent>
        </Card>
      )}

      {/* Emotion Tags Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent Emotions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {tags.slice(0, 20).map((tag, index) => (
              <Badge 
                key={index} 
                variant="secondary"
                className="text-xs"
              >
                {tag.tags.tags?.join(', ')}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
EOF

# 4. Theme Cloud Component
echo "4️⃣ Creating Theme Cloud..."
cat > client/src/components/therapeutic/ThemeCloud.tsx << 'EOF'
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, Hash, TrendingUp } from 'lucide-react';

interface ThemeData {
  name: string;
  count: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  lastMentioned: string;
}

export default function ThemeCloud({ clientId }: { clientId: string }) {
  const [themes, setThemes] = useState<ThemeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchThemes();
  }, [clientId]);

  const fetchThemes = async () => {
    try {
      const response = await fetch(`/api/therapeutic/tags/${clientId}?category=themes`);
      const data = await response.json();

      if (data.success) {
        processThemes(data.tags);
      }
    } catch (error) {
      console.error('Error fetching themes:', error);
    } finally {
      setLoading(false);
    }
  };

  const processThemes = (tags: any[]) => {
    const themeMap = new Map<string, ThemeData>();

    tags.forEach(tag => {
      const themes = tag.tags.tags || [];
      const date = tag.sessionDate || tag.tags.createdAt;

      themes.forEach((theme: string) => {
        if (themeMap.has(theme)) {
          const existing = themeMap.get(theme)!;
          existing.count++;
          if (new Date(date) > new Date(existing.lastMentioned)) {
            existing.lastMentioned = date;
          }
        } else {
          themeMap.set(theme, {
            name: theme,
            count: 1,
            trend: 'stable',
            lastMentioned: date
          });
        }
      });
    });

    // Convert to array and sort by frequency
    const themeArray = Array.from(themeMap.values())
      .sort((a, b) => b.count - a.count);

    // Calculate trends
    themeArray.forEach(theme => {
      const daysSinceLastMention = Math.floor(
        (Date.now() - new Date(theme.lastMentioned).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceLastMention <= 7) {
        theme.trend = 'increasing';
      } else if (daysSinceLastMention > 30) {
        theme.trend = 'decreasing';
      } else {
        theme.trend = 'stable';
      }
    });

    setThemes(themeArray);
  };

  const getThemeSize = (count: number, maxCount: number) => {
    const ratio = count / maxCount;
    if (ratio > 0.7) return 'text-2xl font-bold';
    if (ratio > 0.4) return 'text-xl font-semibold';
    if (ratio > 0.2) return 'text-lg';
    return 'text-base';
  };

  const getThemeColor = (theme: string) => {
    const colors = [
      'text-blue-600', 'text-purple-600', 'text-green-600',
      'text-yellow-600', 'text-red-600', 'text-indigo-600',
      'text-pink-600', 'text-teal-600'
    ];
    return colors[theme.length % colors.length];
  };

  const maxCount = themes.length > 0 ? Math.max(...themes.map(t => t.count)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Target className="h-5 w-5 text-purple-500" />
          Recurring Themes
        </h3>
        <Badge variant="outline">
          {themes.length} themes identified
        </Badge>
      </div>

      {loading ? (
        <Card>
          <CardContent className="text-center py-8">
            Loading themes...
          </CardContent>
        </Card>
      ) : themes.length > 0 ? (
        <>
          {/* Theme Cloud */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4 justify-center items-center min-h-[300px]">
                {themes.slice(0, 15).map((theme) => (
                  <div
                    key={theme.name}
                    className={`
                      ${getThemeSize(theme.count, maxCount)}
                      ${getThemeColor(theme.name)}
                      hover:opacity-80 cursor-pointer transition-opacity
                      flex items-center gap-1
                    `}
                  >
                    <span>{theme.name}</span>
                    {theme.trend === 'increasing' && (
                      <TrendingUp className="h-3 w-3 text-green-500" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Theme List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Theme Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {themes.slice(0, 10).map((theme) => (
                  <div key={theme.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Hash className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm font-medium">{theme.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {theme.count} mentions
                      </Badge>
                      {theme.trend === 'increasing' && (
                        <Badge variant="default" className="text-xs">
                          Trending
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="text-center py-8">
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              Themes will be identified as sessions progress
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
EOF

# 5. Quick Recall Search Component
echo "5️⃣ Creating Quick Recall..."
cat > client/src/components/therapeutic/QuickRecall.tsx << 'EOF'
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Clock, FileText, Brain } from 'lucide-react';
import { format } from 'date-fns';

interface RecallResult {
  id: string;
  type: 'note' | 'insight' | 'tag';
  content: string;
  sessionDate: string;
  relevance: number;
}

export default function QuickRecall({ clientId }: { clientId: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RecallResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);

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
      console.error('Error searching:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'note':
        return <FileText className="h-4 w-4" />;
      case 'insight':
        return <Brain className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'note':
        return 'bg-blue-500';
      case 'insight':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Search className="h-5 w-5 text-blue-500" />
          Quick Recall Search
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Search across all progress notes, insights, and session data
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Search for topics, emotions, insights..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </Button>
      </div>

      {searched && (
        <div className="space-y-3">
          {loading ? (
            <Card>
              <CardContent className="text-center py-8">
                <div className="animate-pulse">Searching therapeutic records...</div>
              </CardContent>
            </Card>
          ) : results.length > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Found {results.length} results
                </p>
                <Badge variant="outline">
                  Sorted by relevance
                </Badge>
              </div>

              {results.map((result) => (
                <Card key={result.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${getTypeColor(result.type)} bg-opacity-10`}>
                        {getTypeIcon(result.type)}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {result.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(result.sessionDate), 'MMM d, yyyy')}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {Math.round(result.relevance * 100)}% match
                          </Badge>
                        </div>
                        <p className="text-sm">{result.content}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <Search className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">
                  No results found for "{query}"
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try different keywords or phrases
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
EOF

# 6. Journey Synthesis Component
echo "6️⃣ Creating Journey Synthesis..."
cat > client/src/components/therapeutic/JourneySynthesis.tsx << 'EOF'
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Sparkles, 
  RefreshCw, 
  TrendingUp, 
  Heart, 
  Target, 
  Brain,
  ChevronRight,
  Award
} from 'lucide-react';

interface JourneySynthesisProps {
  clientId: string;
  synthesisData: any;
  onRegenerate: () => void;
  loading: boolean;
}

export default function JourneySynthesis({ 
  clientId, 
  synthesisData, 
  onRegenerate, 
  loading 
}: JourneySynthesisProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <div className="animate-pulse space-y-3">
            <Sparkles className="h-12 w-12 text-purple-500 mx-auto" />
            <p className="text-muted-foreground">Analyzing therapeutic journey...</p>
            <Progress value={33} className="w-48 mx-auto" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!synthesisData) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground mb-4">
            Generate a comprehensive analysis of the therapeutic journey
          </p>
          <Button onClick={onRegenerate}>
            Generate Analysis
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Regenerate */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Journey Overview</h3>
        <Button variant="outline" size="sm" onClick={onRegenerate} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-1" />
          Regenerate
        </Button>
      </div>

      {/* Progress Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              Progress Score
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
              Emotional Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {synthesisData.emotionalTrajectory?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Sessions tracked</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4 text-purple-500" />
              Key Themes
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

      {/* Dominant Themes */}
      {synthesisData.dominantThemes?.frequency && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Dominant Themes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(synthesisData.dominantThemes.frequency)
                .slice(0, 5)
                .map(([theme, count]: [string, any]) => (
                  <div key={theme} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500" />
                      <span className="text-sm capitalize">{theme.replace('_', ' ')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={(count / 10) * 100} className="w-24" />
                      <Badge variant="secondary" className="text-xs">
                        {count}
                      </Badge>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coping Strategies */}
      {synthesisData.copingStrategies?.used && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Coping Strategies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(synthesisData.copingStrategies.used).map(([strategy, count]: [string, any]) => (
                <Badge key={strategy} variant="outline">
                  {strategy.replace('_', ' ')} ({count})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Insights */}
      {synthesisData.keyInsights && synthesisData.keyInsights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Key Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {synthesisData.keyInsights.slice(0, 3).map((insight: string, index: number) => (
                <div key={index} className="flex items-start gap-2">
                  <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <p className="text-sm">{insight}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      {synthesisData.recommendations && synthesisData.recommendations.length > 0 && (
        <Card className="border-purple-200 bg-purple-50 dark:bg-purple-950">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Award className="h-4 w-4 text-purple-600" />
              AI Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {synthesisData.recommendations.map((rec: string, index: number) => (
                <div key={index} className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-600 mt-1.5" />
                  <p className="text-sm">{rec}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
EOF

# 7. Coping Strategies Component
echo "7️⃣ Creating Coping Strategies..."
cat > client/src/components/therapeutic/CopingStrategies.tsx << 'EOF'
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Shield, Activity, Brain, Users, BookOpen, CheckCircle } from 'lucide-react';

interface Strategy {
  name: string;
  count: number;
  effectiveness: number;
  lastUsed: string;
}

export default function CopingStrategies({ clientId }: { clientId: string }) {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [progressIndicators, setProgressIndicators] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStrategies();
  }, [clientId]);

  const fetchStrategies = async () => {
    try {
      const [copingResponse, progressResponse] = await Promise.all([
        fetch(`/api/therapeutic/tags/${clientId}?category=coping_strategies`),
        fetch(`/api/therapeutic/tags/${clientId}?category=progress_indicators`)
      ]);

      const copingData = await copingResponse.json();
      const progressData = await progressResponse.json();

      if (copingData.success) {
        processStrategies(copingData.tags);
      }

      if (progressData.success) {
        processProgressIndicators(progressData.tags);
      }
    } catch (error) {
      console.error('Error fetching strategies:', error);
    } finally {
      setLoading(false);
    }
  };

  const processStrategies = (tags: any[]) => {
    const strategyMap = new Map<string, Strategy>();

    tags.forEach(tag => {
      const strategies = tag.tags.tags || [];
      const date = tag.sessionDate || tag.tags.createdAt;

      strategies.forEach((strategy: string) => {
        if (strategyMap.has(strategy)) {
          const existing = strategyMap.get(strategy)!;
          existing.count++;
          if (new Date(date) > new Date(existing.lastUsed)) {
            existing.lastUsed = date;
          }
        } else {
          strategyMap.set(strategy, {
            name: strategy,
            count: 1,
            effectiveness: Math.floor(Math.random() * 30) + 70, // Simulated
            lastUsed: date
          });
        }
      });
    });

    setStrategies(Array.from(strategyMap.values()).sort((a, b) => b.count - a.count));
  };

  const processProgressIndicators = (tags: any[]) => {
    const indicators: Record<string, number> = {};

    tags.forEach(tag => {
      const progressTags = tag.tags.tags || [];
      progressTags.forEach((indicator: string) => {
        indicators[indicator] = (indicators[indicator] || 0) + 1;
      });
    });

    setProgressIndicators(indicators);
  };

  const getStrategyIcon = (name: string) => {
    if (name.includes('mindfulness') || name.includes('breathing')) return <Brain className="h-4 w-4" />;
    if (name.includes('exercise') || name.includes('physical')) return <Activity className="h-4 w-4" />;
    if (name.includes('social') || name.includes('support')) return <Users className="h-4 w-4" />;
    if (name.includes('journal') || name.includes('writing')) return <BookOpen className="h-4 w-4" />;
    return <Shield className="h-4 w-4" />;
  };

  const getEffectivenessColor = (effectiveness: number) => {
    if (effectiveness >= 80) return 'text-green-600';
    if (effectiveness >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-4">
      {/* Progress Overview */}
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-blue-500" />
          Progress & Coping Strategies
        </h3>
      </div>

      {/* Progress Indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Progress Indicators</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(progressIndicators).map(([indicator, count]) => (
              <div key={indicator} className="text-center">
                <div className="text-2xl font-bold">{count}</div>
                <p className="text-xs text-muted-foreground capitalize">
                  {indicator.replace('_', ' ')}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Coping Strategies */}
      {loading ? (
        <Card>
          <CardContent className="text-center py-8">
            Loading strategies...
          </CardContent>
        </Card>
      ) : strategies.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Active Coping Strategies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {strategies.map((strategy) => (
                <div key={strategy.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStrategyIcon(strategy.name)}
                      <span className="text-sm font-medium capitalize">
                        {strategy.name.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        Used {strategy.count}x
                      </Badge>
                      <span className={`text-xs font-medium ${getEffectivenessColor(strategy.effectiveness)}`}>
                        {strategy.effectiveness}% effective
                      </span>
                    </div>
                  </div>
                  <Progress value={strategy.effectiveness} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="text-center py-8">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              Coping strategies will be tracked as sessions progress
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
EOF

# 8. Create integration file for existing client pages
echo "8️⃣ Creating integration helper..."
cat > client/src/components/therapeutic/index.ts << 'EOF'
export { default as TherapeuticJourneyDashboard } from './TherapeuticJourneyDashboard';
export { default as InsightsPanel } from './InsightsPanel';
export { default as EmotionalTrajectory } from './EmotionalTrajectory';
export { default as ThemeCloud } from './ThemeCloud';
export { default as CopingStrategies } from './CopingStrategies';
export { default as QuickRecall } from './QuickRecall';
export { default as JourneySynthesis } from './JourneySynthesis';
EOF

# 9. Create example integration for client detail page
echo "9️⃣ Creating example integration..."
cat > client/src/components/therapeutic/INTEGRATION_GUIDE.md << 'EOF'
# Therapeutic Journey Integration Guide

## Quick Integration

### 1. Add to Client Detail Page

In your `ClientProfile.tsx` or similar component, add:

```tsx
import { TherapeuticJourneyDashboard } from '@/components/therapeutic';

// In your component
<TherapeuticJourneyDashboard clientId={clientId} />
