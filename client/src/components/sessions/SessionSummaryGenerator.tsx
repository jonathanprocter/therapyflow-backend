import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface SessionSummaryGeneratorProps {
  sessionId: string;
  clientId: string;
  clientName: string;
  sessionDate: string;
  onClose?: () => void;
}

interface SessionSummary {
  sessionOverview: string;
  keyThemes: string[];
  clinicalObservations: string[];
  interventionsUsed: string[];
  clientProgress: {
    rating: number;
    description: string;
    progressIndicators: string[];
  };
  riskAssessment: {
    level: 'low' | 'moderate' | 'high' | 'critical';
    factors: string[];
    recommendations: string[];
  };
  nextSteps: string[];
  treatmentPlanUpdates: string[];
  sessionMetrics: {
    duration: string;
    engagement: number;
    adherence: number;
  };
}

export default function SessionSummaryGenerator({ 
  sessionId, 
  clientId, 
  clientName, 
  sessionDate, 
  onClose 
}: SessionSummaryGeneratorProps) {
  const [summaryType, setSummaryType] = useState<'brief' | 'comprehensive' | 'clinical' | 'treatment-planning'>('comprehensive');
  const [includeProgressNotes, setIncludeProgressNotes] = useState(true);
  const [includePreviousSessions, setIncludePreviousSessions] = useState(true);
  const queryClient = useQueryClient();

  // Generate session summary mutation
  const generateSummaryMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/sessions/${sessionId}/generate-summary`, {
        method: 'POST',
        body: JSON.stringify({
          clientId,
          summaryType,
          includeProgressNotes,
          includePreviousSessions
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'summary'] });
    }
  });

  // Quick insights query
  const { data: quickInsights } = useQuery({
    queryKey: ['/api/sessions', sessionId, 'quick-insights'],
    queryFn: () => apiRequest(`/api/sessions/${sessionId}/quick-insights?clientId=${clientId}`),
    enabled: !!sessionId && !!clientId
  });

  const handleGenerateSummary = () => {
    generateSummaryMutation.mutate();
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'moderate': return 'bg-french-blue-light text-evergreen';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getProgressColor = (rating: number) => {
    if (rating >= 8) return 'bg-green-500';
    if (rating >= 6) return 'bg-sage';
    if (rating >= 4) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <Card className="w-full max-w-4xl mx-auto" data-testid="session-summary-generator">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              One-Click Session Summary
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {clientName} • {new Date(sessionDate).toLocaleDateString()}
            </p>
          </div>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose} data-testid="close-summary">
              <i className="fas fa-times mr-2"></i>
              Close
            </Button>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Configuration Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
              Summary Type
            </label>
            <Select value={summaryType} onValueChange={(value: "brief" | "comprehensive" | "clinical" | "treatment-planning") => setSummaryType(value)}>
              <SelectTrigger data-testid="summary-type-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="brief">Brief Summary</SelectItem>
                <SelectItem value="comprehensive">Comprehensive</SelectItem>
                <SelectItem value="clinical">Clinical Focus</SelectItem>
                <SelectItem value="treatment-planning">Treatment Planning</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={includeProgressNotes}
                onChange={(e) => setIncludeProgressNotes(e.target.checked)}
                className="mr-2"
                data-testid="include-progress-notes"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Include Progress Notes</span>
            </label>
          </div>
          
          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={includePreviousSessions}
                onChange={(e) => setIncludePreviousSessions(e.target.checked)}
                className="mr-2"
                data-testid="include-previous-sessions"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Include Context</span>
            </label>
          </div>
        </div>

        {/* Quick Insights Preview */}
        {quickInsights?.success && (
          <Card className="border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
                <i className="fas fa-lightbulb mr-2"></i>
                Quick Insights Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Key Takeaways</h4>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    {quickInsights.insights.keyTakeaways?.slice(0, 3).map((takeaway: string, idx: number) => (
                      <li key={idx} className="flex items-start">
                        <i className="fas fa-circle text-xs mt-2 mr-2 text-blue-500"></i>
                        {takeaway}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Immediate Actions</h4>
                  <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                    {quickInsights.insights.immediateActions?.slice(0, 2).map((action: string, idx: number) => (
                      <li key={idx} className="flex items-start">
                        <i className="fas fa-arrow-right text-xs mt-2 mr-2 text-green-500"></i>
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Risk Flags</h4>
                  {quickInsights.insights.riskFlags?.length > 0 ? (
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      {quickInsights.insights.riskFlags.slice(0, 2).map((flag: string, idx: number) => (
                        <li key={idx} className="flex items-start">
                          <i className="fas fa-exclamation-triangle text-xs mt-2 mr-2 text-orange-500"></i>
                          {flag}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-green-600 dark:text-green-400">
                      <i className="fas fa-check-circle mr-2"></i>
                      No immediate risk concerns identified
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Generate Summary Button */}
        <div className="flex justify-center">
          <Button
            onClick={handleGenerateSummary}
            disabled={generateSummaryMutation.isPending}
            size="lg"
            className="px-8"
            data-testid="generate-summary-button"
          >
            {generateSummaryMutation.isPending ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                Generating Summary...
              </>
            ) : (
              <>
                <i className="fas fa-magic mr-2"></i>
                Generate {summaryType.charAt(0).toUpperCase() + summaryType.slice(1)} Summary
              </>
            )}
          </Button>
        </div>

        {/* Summary Results */}
        {generateSummaryMutation.data?.success && (
          <Card className="border-green-200 dark:border-green-800" data-testid="summary-results">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="text-green-700 dark:text-green-300">
                  <i className="fas fa-check-circle mr-2"></i>
                  Session Summary Generated
                </span>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline">
                    {generateSummaryMutation.data.confidence}% Confidence
                  </Badge>
                  <Badge variant="outline">
                    {new Date(generateSummaryMutation.data.generatedAt).toLocaleTimeString()}
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="clinical">Clinical</TabsTrigger>
                  <TabsTrigger value="progress">Progress</TabsTrigger>
                  <TabsTrigger value="risk">Risk</TabsTrigger>
                  <TabsTrigger value="next-steps">Next Steps</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Session Overview</h3>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      {generateSummaryMutation.data.summary.sessionOverview}
                    </p>
                  </div>
                  
                  <Separator />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Key Themes</h4>
                      <div className="flex flex-wrap gap-2">
                        {generateSummaryMutation.data.summary.keyThemes.map((theme: string, idx: number) => (
                          <Badge key={idx} variant="secondary">
                            {theme}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Interventions Used</h4>
                      <div className="flex flex-wrap gap-2">
                        {generateSummaryMutation.data.summary.interventionsUsed.map((intervention: string, idx: number) => (
                          <Badge key={idx} variant="outline">
                            {intervention}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="clinical" className="space-y-4">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Clinical Observations</h3>
                    <ul className="space-y-2">
                      {generateSummaryMutation.data.summary.clinicalObservations.map((observation: string, idx: number) => (
                        <li key={idx} className="flex items-start">
                          <i className="fas fa-circle text-xs mt-2 mr-3 text-blue-500"></i>
                          <span className="text-gray-700 dark:text-gray-300">{observation}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Session Metrics</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {generateSummaryMutation.data.summary.sessionMetrics.duration}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Duration</div>
                      </div>
                      
                      <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {generateSummaryMutation.data.summary.sessionMetrics.engagement}/10
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Engagement</div>
                        <Progress 
                          value={generateSummaryMutation.data.summary.sessionMetrics.engagement * 10} 
                          className="mt-2 h-2"
                        />
                      </div>
                      
                      <div className="text-center p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {generateSummaryMutation.data.summary.sessionMetrics.adherence}/10
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">Adherence</div>
                        <Progress 
                          value={generateSummaryMutation.data.summary.sessionMetrics.adherence * 10} 
                          className="mt-2 h-2"
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="progress" className="space-y-4">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Client Progress Assessment</h3>
                    <div className="flex items-center space-x-4 mb-4">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Progress Rating:</span>
                        <div className="flex items-center space-x-2">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                            getProgressColor(generateSummaryMutation.data.summary.clientProgress.rating)
                          }`}>
                            {generateSummaryMutation.data.summary.clientProgress.rating}
                          </div>
                          <span className="text-sm text-gray-500 dark:text-gray-400">/ 10</span>
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                      {generateSummaryMutation.data.summary.clientProgress.description}
                    </p>
                    
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Progress Indicators</h4>
                      <ul className="space-y-1">
                        {generateSummaryMutation.data.summary.clientProgress.progressIndicators.map((indicator: string, idx: number) => (
                          <li key={idx} className="flex items-start">
                            <i className="fas fa-arrow-up text-xs mt-2 mr-3 text-green-500"></i>
                            <span className="text-gray-700 dark:text-gray-300">{indicator}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Treatment Plan Updates</h3>
                    <ul className="space-y-2">
                      {generateSummaryMutation.data.summary.treatmentPlanUpdates.map((update: string, idx: number) => (
                        <li key={idx} className="flex items-start">
                          <i className="fas fa-edit text-xs mt-2 mr-3" style={{ color: '#88A5BC' }}></i>
                          <span className="text-gray-700 dark:text-gray-300">{update}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </TabsContent>

                <TabsContent value="risk" className="space-y-4">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Risk Assessment</h3>
                    <div className="flex items-center space-x-3 mb-4">
                      <Badge className={getRiskLevelColor(generateSummaryMutation.data.summary.riskAssessment.level)}>
                        {generateSummaryMutation.data.summary.riskAssessment.level.toUpperCase()} RISK
                      </Badge>
                    </div>
                    
                    {generateSummaryMutation.data.summary.riskAssessment.factors.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Risk Factors</h4>
                        <ul className="space-y-1">
                          {generateSummaryMutation.data.summary.riskAssessment.factors.map((factor: string, idx: number) => (
                            <li key={idx} className="flex items-start">
                              <i className="fas fa-exclamation-triangle text-xs mt-2 mr-3 text-orange-500"></i>
                              <span className="text-gray-700 dark:text-gray-300">{factor}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Risk Management Recommendations</h4>
                      <ul className="space-y-1">
                        {generateSummaryMutation.data.summary.riskAssessment.recommendations.map((recommendation: string, idx: number) => (
                          <li key={idx} className="flex items-start">
                            <i className="fas fa-shield-alt text-xs mt-2 mr-3 text-blue-500"></i>
                            <span className="text-gray-700 dark:text-gray-300">{recommendation}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="next-steps" className="space-y-4">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Next Steps & Action Items</h3>
                    <ul className="space-y-3">
                      {generateSummaryMutation.data.summary.nextSteps.map((step: string, idx: number) => (
                        <li key={idx} className="flex items-start p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                          <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold mr-3 mt-0.5">
                            {idx + 1}
                          </div>
                          <span className="text-gray-700 dark:text-gray-300">{step}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Error Display */}
        {generateSummaryMutation.isError && (
          <Card className="border-red-200 dark:border-red-800">
            <CardContent className="pt-6">
              <div className="flex items-center text-red-700 dark:text-red-300">
                <i className="fas fa-exclamation-circle mr-2"></i>
                Failed to generate summary. Please try again.
              </div>
            </CardContent>
          </Card>
        )}
      </CardContent>
    </Card>
  );
}