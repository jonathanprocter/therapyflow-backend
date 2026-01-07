import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Brain, Search, Lightbulb, AlertTriangle, CheckCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface AIAnalysisResult {
  insights: Array<{
    content: string;
    confidence: number;
    category: string;
  }>;
  recommendations: Array<{
    intervention: string;
    rationale: string;
    priority: string;
  }>;
  tags: string[];
  summary: string;
  confidence: number;
}

interface AIAnalysisPanelProps {
  clientId?: string;
  initialContent?: string;
  onAnalysisComplete?: (analysis: AIAnalysisResult) => void;
}

export function AIAnalysisPanel({ clientId, initialContent = '', onAnalysisComplete }: AIAnalysisPanelProps) {
  const [content, setContent] = useState(initialContent);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // AI Analysis Mutation
  const analyzeNoteMutation = useMutation({
    mutationFn: async (data: { content: string; clientId?: string; context?: any }) =>
      apiRequest('/api/ai/analyze-note', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (result) => {
      if (onAnalysisComplete && result.analysis) {
        onAnalysisComplete(result.analysis);
      }
    },
  });

  // AI Health Check
  const { data: aiHealth } = useQuery<{ openai: boolean; anthropic: boolean; timestamp: string; services: any }>({
    queryKey: ['/api/ai/health'],
    refetchInterval: 30000, // Check every 30 seconds
  });

  const handleAnalyze = () => {
    if (!content.trim()) return;
    
    analyzeNoteMutation.mutate({
      content: content.trim(),
      clientId,
      context: {
        tags: selectedTags,
        therapeuticGoals: [],
      },
    });
  };

  const analysis = analyzeNoteMutation.data?.analysis;
  const isAnalyzing = analyzeNoteMutation.isPending;

  return (
    <div className="space-y-6" data-testid="ai-analysis-panel">
      {/* AI Service Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5 text-sage" />
              AI Clinical Analysis
            </CardTitle>
            <div className="flex items-center gap-2">
              {aiHealth?.openai && (
                <Badge variant="secondary" className="bg-sage/10 text-sage">
                  OpenAI
                </Badge>
              )}
              {aiHealth?.anthropic && (
                <Badge variant="secondary" className="bg-sage/10 text-sage">
                  Anthropic
                </Badge>
              )}
              {(!aiHealth?.openai && !aiHealth?.anthropic) && (
                <Badge variant="outline" className="text-moss">
                  Manual Mode
                </Badge>
              )}
            </div>
          </div>
          <CardDescription>
            AI-powered analysis of clinical content with comprehensive insights and recommendations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Content Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-evergreen">Clinical Content</label>
            <Textarea
              placeholder="Enter session notes, observations, or clinical content for AI analysis..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[120px] resize-none"
              data-testid="input-analysis-content"
            />
          </div>

          {/* Action Button */}
          <Button
            onClick={handleAnalyze}
            disabled={!content.trim() || isAnalyzing}
            className="w-full bg-sage hover:bg-sage/90 text-white"
            data-testid="button-analyze"
          >
            {isAnalyzing ? (
              <>
                <Brain className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="mr-2 h-4 w-4" />
                Analyze Content
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysis && (
        <Card data-testid="analysis-results">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-sage" />
              Analysis Results
              <Badge variant="outline" className="ml-auto">
                Confidence: {Math.round(analysis.confidence * 100)}%
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary */}
            {analysis.summary && (
              <div className="space-y-2">
                <h4 className="font-medium text-evergreen">Clinical Summary</h4>
                <div className="p-3 bg-ivory rounded-lg border">
                  <p className="text-moss text-sm">{analysis.summary}</p>
                </div>
              </div>
            )}

            {/* Tags */}
            {analysis.tags && analysis.tags.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-evergreen">Clinical Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {analysis.tags.map((tag: string, index: number) => (
                    <Badge key={index} variant="secondary" className="bg-french-blue/10 text-french-blue">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Insights */}
            {analysis.insights && analysis.insights.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-evergreen">Clinical Insights</h4>
                <ScrollArea className="h-32">
                  <div className="space-y-2">
                    {analysis.insights.map((insight: any, index: number) => (
                      <div key={index} className="p-3 bg-ivory rounded-lg border">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-moss text-sm flex-1">{insight.content}</p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Badge 
                              variant={insight.category === 'risk' ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              {insight.category}
                            </Badge>
                            <span className="text-xs text-moss">
                              {Math.round(insight.confidence * 100)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Recommendations */}
            {analysis.recommendations && analysis.recommendations.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-evergreen">Clinical Recommendations</h4>
                <ScrollArea className="h-40">
                  <div className="space-y-3">
                    {analysis.recommendations.map((rec: any, index: number) => (
                      <div key={index} className="p-3 bg-ivory rounded-lg border">
                        <div className="flex items-start gap-2">
                          <Lightbulb className="h-4 w-4 text-sage mt-0.5 flex-shrink-0" />
                          <div className="flex-1 space-y-1">
                            <p className="text-moss text-sm font-medium">{rec.intervention}</p>
                            <p className="text-moss text-xs">{rec.rationale}</p>
                            <Badge 
                              variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {rec.priority} priority
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {analyzeNoteMutation.isError && (
        <Alert data-testid="analysis-error">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Analysis failed: {analyzeNoteMutation.error?.message || 'Unknown error occurred'}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}