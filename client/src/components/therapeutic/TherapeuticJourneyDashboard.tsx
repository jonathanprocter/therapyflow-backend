import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Brain, TrendingUp, Heart, Target, Search, Sparkles } from 'lucide-react';
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

// Memoized tab content components to prevent re-renders when switching tabs
const MemoizedInsightsPanel = memo(InsightsPanel);
const MemoizedEmotionalTrajectory = memo(EmotionalTrajectory);
const MemoizedThemeCloud = memo(ThemeCloud);
const MemoizedCopingStrategies = memo(CopingStrategies);
const MemoizedQuickRecall = memo(QuickRecall);
const MemoizedJourneySynthesis = memo(JourneySynthesis);

export default function TherapeuticJourneyDashboard({
  clientId,
  className=""
}: TherapeuticJourneyProps) {
  const [loading, setLoading] = useState(false);
  const [synthesisData, setSynthesisData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Memoized synthesis generator with AbortController support
  const generateSynthesis = useCallback(async (signal?: AbortSignal) => {
    if (!clientId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/therapeutic/synthesize/${clientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        }),
        signal
      });

      const data = await response.json();
      if (data.success) {
        setSynthesisData(data.synthesis);
      }
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error generating synthesis:', error);
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [clientId]);

  // Auto-generate synthesis on client change with cleanup
  useEffect(() => {
    if (!clientId) return;

    const abortController = new AbortController();
    generateSynthesis(abortController.signal);

    return () => abortController.abort();
  }, [clientId, generateSynthesis]);

  // Manual regenerate handler (without abort signal for user-initiated actions)
  const handleRegenerate = useCallback(() => {
    generateSynthesis();
  }, [generateSynthesis]);

  if (!clientId) {
    return (
      <Alert style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }}>
        <AlertDescription style={{ color: '#738A6E' }}>
          Please select a client to view their therapeutic journey.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <Card style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(115, 138, 110, 0.15)' }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: '#344C3D' }}>
            <Brain className="h-6 w-6" style={{color: '#88A5BC'}} />
            Therapeutic Journey Analysis
          </CardTitle>
          <p className="text-sm" style={{ color: '#738A6E' }}>
            AI-powered insights and pattern analysis from therapy sessions
          </p>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview" className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" style={{color: '#88A5BC'}} />
                Overview
              </TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
              <TabsTrigger value="emotions">Emotions</TabsTrigger>
              <TabsTrigger value="themes">Themes</TabsTrigger>
              <TabsTrigger value="progress">Progress</TabsTrigger>
              <TabsTrigger value="search">Search</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6">
              <MemoizedJourneySynthesis
                clientId={clientId}
                synthesisData={synthesisData}
                onRegenerate={handleRegenerate}
                loading={loading}
              />
            </TabsContent>

            <TabsContent value="insights" className="mt-6">
              <MemoizedInsightsPanel clientId={clientId} />
            </TabsContent>

            <TabsContent value="emotions" className="mt-6">
              <MemoizedEmotionalTrajectory clientId={clientId} />
            </TabsContent>

            <TabsContent value="themes" className="mt-6">
              <MemoizedThemeCloud clientId={clientId} />
            </TabsContent>

            <TabsContent value="progress" className="mt-6">
              <MemoizedCopingStrategies clientId={clientId} />
            </TabsContent>

            <TabsContent value="search" className="mt-6">
              <MemoizedQuickRecall clientId={clientId} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
