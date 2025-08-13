import React, { useState, useEffect } from 'react';
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

export default function TherapeuticJourneyDashboard({ 
  clientId, 
  className = "" 
}: TherapeuticJourneyProps) {
  const [loading, setLoading] = useState(false);
  const [synthesisData, setSynthesisData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const generateSynthesis = async () => {
    if (!clientId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/therapeutic/synthesize/${clientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
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
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
              <TabsTrigger value="emotions">Emotions</TabsTrigger>
              <TabsTrigger value="themes">Themes</TabsTrigger>
              <TabsTrigger value="progress">Progress</TabsTrigger>
              <TabsTrigger value="search">Search</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6">
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
