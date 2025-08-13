/**
 * Therapeutic Journey Integration for Client Pages
 * 
 * This file provides best-practice integration patterns for adding
 * therapeutic journey features to your existing client pages.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { 
  TherapeuticJourneyDashboard,
  InsightsPanel,
  EmotionalTrajectory,
  ThemeCloud,
  QuickRecall
} from '@/components/therapeutic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  Brain, 
  FileText, 
  Calendar, 
  User, 
  Activity,
  Sparkles,
  ChevronRight,
  Eye
} from 'lucide-react';

/**
 * OPTION 1: Enhanced Client Detail Page
 * Integrates therapeutic journey as a primary tab
 */
export function EnhancedClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: client } = useQuery({
    queryKey: ['/api/clients', clientId],
    enabled: !!clientId
  });

  const { data: insightsData } = useQuery({
    queryKey: ['/api/therapeutic/insights', clientId],
    enabled: !!clientId
  });

  const insightCount = insightsData?.insights?.length || 0;

  if (!client) return <div>Loading...</div>;

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="enhanced-client-detail">
      {/* Client Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-client-name">
            {client.firstName} {client.lastName}
          </h1>
          <p className="text-muted-foreground" data-testid="text-client-email">{client.email}</p>
        </div>
        <div className="flex gap-2">
          {insightCount > 0 && (
            <Badge variant="secondary" className="flex items-center gap-1" data-testid="badge-insights">
              <Brain className="h-3 w-3" />
              {insightCount} insights
            </Badge>
          )}
          <Button 
            variant="outline"
            onClick={() => navigate(`/clients/${clientId}/sessions/new`)}
            data-testid="button-new-session"
          >
            New Session
          </Button>
        </div>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4" data-testid="tabs-client-detail">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2" data-testid="tab-overview">
            <User className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="sessions" className="flex items-center gap-2" data-testid="tab-sessions">
            <Calendar className="h-4 w-4" />
            Sessions
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex items-center gap-2" data-testid="tab-notes">
            <FileText className="h-4 w-4" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="journey" className="flex items-center gap-2" data-testid="tab-journey">
            <Brain className="h-4 w-4" />
            Journey
            {insightCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1" data-testid="badge-journey-count">
                {insightCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="metrics" className="flex items-center gap-2" data-testid="tab-metrics">
            <Activity className="h-4 w-4" />
            Metrics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4" data-testid="content-overview">
          {/* Client Information Card */}
          <Card>
            <CardHeader>
              <CardTitle>Client Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p data-testid="text-overview-email">{client.email || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p data-testid="text-overview-phone">{client.phone || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge variant={client.status === 'active' ? 'default' : 'secondary'} data-testid="badge-status">
                    {client.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Date of Birth</p>
                  <p data-testid="text-overview-dob">{client.dateOfBirth || 'Not provided'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Insights Preview */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-500" />
                Recent Insights
              </CardTitle>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setActiveTab('journey')}
                data-testid="button-view-all-insights"
              >
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <InsightsPreview clientId={clientId!} limit={3} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" data-testid="content-sessions">
          <div className="text-center text-muted-foreground py-8">
            Sessions content will be integrated with existing session management
          </div>
        </TabsContent>

        <TabsContent value="notes" data-testid="content-notes">
          <div className="text-center text-muted-foreground py-8">
            Progress notes content will be integrated with existing notes management
          </div>
        </TabsContent>

        <TabsContent value="journey" data-testid="content-journey">
          <TherapeuticJourneyDashboard clientId={clientId!} />
        </TabsContent>

        <TabsContent value="metrics" data-testid="content-metrics">
          <div className="text-center text-muted-foreground py-8">
            Metrics and reports content will be integrated
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * OPTION 2: Sidebar Integration
 * Adds therapeutic insights to existing client page sidebar
 */
export function ClientPageWithTherapeuticSidebar({ clientId }: { clientId: string }) {
  return (
    <div className="flex gap-6" data-testid="client-sidebar-layout">
      {/* Main Content Area */}
      <div className="flex-1 space-y-6">
        {/* Your existing client content */}
      </div>

      {/* Therapeutic Insights Sidebar */}
      <div className="w-96 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Therapeutic Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InsightsPanel clientId={clientId} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Quick Search</CardTitle>
          </CardHeader>
          <CardContent>
            <QuickRecall clientId={clientId} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * OPTION 3: Progress Note Enhancement
 * Adds therapeutic insights to progress note view
 */
export function EnhancedProgressNoteView({ 
  noteId, 
  clientId 
}: { 
  noteId: string; 
  clientId: string;
}) {
  const { data: noteData } = useQuery({
    queryKey: ['/api/progress-notes', noteId],
    enabled: !!noteId
  });

  const { data: tagsData } = useQuery({
    queryKey: ['/api/therapeutic/tags', clientId],
    queryFn: () => apiRequest(`/api/therapeutic/tags/${clientId}?sessionId=${noteId}`),
    enabled: !!clientId && !!noteId
  });

  const { data: insightsData } = useQuery({
    queryKey: ['/api/therapeutic/insights', clientId, noteId],
    queryFn: () => apiRequest(`/api/therapeutic/insights/${clientId}?sessionId=${noteId}`),
    enabled: !!clientId && !!noteId
  });

  const note = noteData?.note;
  const tags = tagsData?.tags || [];
  const insights = insightsData?.insights || [];

  if (!note) return <div>Loading...</div>;

  return (
    <div className="space-y-6" data-testid="enhanced-progress-note">
      {/* Original Note Content */}
      <Card>
        <CardHeader>
          <CardTitle>Progress Note</CardTitle>
          <p className="text-sm text-muted-foreground" data-testid="text-note-date">
            {new Date(note.sessionDate).toLocaleDateString()}
          </p>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap" data-testid="text-note-content">{note.content}</p>
        </CardContent>
      </Card>

      {/* AI-Extracted Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Extracted Themes & Emotions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2" data-testid="container-themes">
              {tags.map((tag: any, idx: number) => (
                <div key={idx} className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-xs" data-testid={`badge-category-${idx}`}>
                    {tag.category}
                  </Badge>
                  {tag.tags?.map((t: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs" data-testid={`badge-tag-${idx}-${i}`}>
                      {t}
                    </Badge>
                  ))}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Key Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2" data-testid="container-insights">
              {insights.map((insight: any, idx: number) => (
                <div key={idx} className="text-sm p-2 bg-secondary rounded" data-testid={`text-insight-${idx}`}>
                  {insight.insight}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * OPTION 4: Dashboard Widget
 * Adds therapeutic summary to main dashboard
 */
export function TherapeuticDashboardWidget() {
  const [, navigate] = useLocation();

  const { data: recentInsightsData } = useQuery({
    queryKey: ['/api/therapeutic/insights/recent']
  });

  const recentInsights = recentInsightsData?.insights || [];

  return (
    <Card data-testid="therapeutic-dashboard-widget">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-500" />
          Therapeutic Insights
        </CardTitle>
        <Badge variant="outline">AI-Powered</Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recentInsights.slice(0, 5).map((insight: any) => (
            <div 
              key={insight.id}
              className="p-3 bg-secondary rounded-lg cursor-pointer hover:bg-secondary/80 transition-colors"
              onClick={() => navigate(`/clients/${insight.clientId}/journey`)}
              data-testid={`card-insight-${insight.id}`}
            >
              <div className="flex items-start justify-between mb-1">
                <span className="text-sm font-medium" data-testid="text-insight-client">
                  {insight.clientName}
                </span>
                <Badge variant="secondary" className="text-xs" data-testid="badge-insight-type">
                  {insight.insightType}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2" data-testid="text-insight-content">
                {insight.insight}
              </p>
            </div>
          ))}
        </div>
        
        {recentInsights.length === 0 && (
          <p className="text-center text-muted-foreground py-4" data-testid="text-no-insights">
            Insights will appear as sessions are analyzed
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Helper Component: Insights Preview
 */
function InsightsPreview({ clientId, limit = 3 }: { clientId: string; limit?: number }) {
  const { data: insightsData } = useQuery({
    queryKey: ['/api/therapeutic/insights', clientId],
    queryFn: () => apiRequest(`/api/therapeutic/insights/${clientId}?limit=${limit}`),
    enabled: !!clientId
  });

  const insights = insightsData?.insights || [];

  if (insights.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="text-no-insights-preview">
        No insights yet. They'll appear as sessions progress.
      </p>
    );
  }

  return (
    <div className="space-y-2" data-testid="container-insights-preview">
      {insights.map((insight: any) => (
        <div key={insight.id} className="flex items-start gap-2" data-testid={`insight-item-${insight.id}`}>
          <div className="w-2 h-2 rounded-full bg-purple-500 mt-1.5" />
          <p className="text-sm" data-testid="text-insight-preview">{insight.insight}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * OPTION 5: Floating Action Button
 * Quick access to therapeutic insights from any client page
 */
export function TherapeuticFloatingButton({ clientId }: { clientId: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        className="fixed bottom-6 right-6 rounded-full h-14 w-14 shadow-lg"
        onClick={() => setIsOpen(true)}
        data-testid="button-floating-therapeutic"
      >
        <Brain className="h-6 w-6" />
      </Button>

      {isOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50" data-testid="overlay-therapeutic">
          <div className="fixed right-0 top-0 h-full w-[600px] bg-background border-l shadow-xl">
            <div className="p-6 h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Therapeutic Journey</h2>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsOpen(false)}
                  data-testid="button-close-therapeutic"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-auto">
                <TherapeuticJourneyDashboard clientId={clientId} />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}