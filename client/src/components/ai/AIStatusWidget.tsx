import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Brain, CheckCircle, AlertTriangle, RefreshCw, Shield } from 'lucide-react';

interface AIStatusWidgetProps {
  compact?: boolean;
  showRefresh?: boolean;
  className?: string;
}

export function AIStatusWidget({ compact = false, showRefresh = true, className="" }: AIStatusWidgetProps) {
  const { data: aiHealth, refetch, isLoading } = useQuery<{ 
    openai: boolean; 
    anthropic: boolean; 
    timestamp: string; 
    services: { analysis: string; search: string; validation: string } 
  }>({
    queryKey: ['/api/ai/health'],
    refetchInterval: 60000, // Check every minute
    staleTime: 30000, // Consider stale after 30 seconds
  });

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`} data-testid="ai-status-compact">
        <Brain className="h-4 w-4 text-teal" />
        <div className="flex items-center gap-1">
          {aiHealth?.openai && (
            <Badge variant="secondary" className="bg-teal/10 text-teal text-xs px-1 py-0">
              OpenAI
            </Badge>
          )}
          {aiHealth?.anthropic && (
            <Badge variant="secondary" className="bg-teal/10 text-teal text-xs px-1 py-0">
              Anthropic
            </Badge>
          )}
          {(!aiHealth?.openai && !aiHealth?.anthropic) && (
            <Badge variant="outline" className="text-sepia text-xs px-1 py-0">
              Manual
            </Badge>
          )}
        </div>
        {showRefresh && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            className="h-6 w-6 p-0"
            data-testid="button-refresh-compact"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className={className} data-testid="ai-status-widget">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4 text-teal" />
            AI Services
          </CardTitle>
          {showRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="h-8 w-8 p-0"
              data-testid="button-refresh-widget"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Provider Status */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-ink">AI Providers</h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-parchment">
              {aiHealth?.openai ? (
                <CheckCircle className="h-4 w-4 text-teal" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm font-medium text-sepia">OpenAI</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-parchment">
              {aiHealth?.anthropic ? (
                <CheckCircle className="h-4 w-4 text-teal" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm font-medium text-sepia">Anthropic</span>
            </div>
          </div>
        </div>

        {/* Service Status */}
        {aiHealth?.services && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-ink">Services</h4>
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-sepia">Analysis:</span>
                <Badge 
                  variant={aiHealth.services.analysis === 'available' ? 'secondary' : 'outline'}
                  className="text-xs"
                >
                  {aiHealth.services.analysis}
                </Badge>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-sepia">Search:</span>
                <Badge 
                  variant={aiHealth.services.search === 'available' ? 'secondary' : 'outline'}
                  className="text-xs"
                >
                  {aiHealth.services.search}
                </Badge>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-sepia">Validation:</span>
                <Badge 
                  variant={aiHealth.services.validation === 'available' ? 'secondary' : 'outline'}
                  className="text-xs"
                >
                  {aiHealth.services.validation}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Fallback Notice */}
        {(!aiHealth?.openai && !aiHealth?.anthropic) && (
          <Alert className="border-teal/20 bg-teal/5">
            <Shield className="h-4 w-4" />
            <AlertDescription className="text-xs">
              AI services using secure manual fallbacks. All operations remain HIPAA compliant.
            </AlertDescription>
          </Alert>
        )}

        {/* Last Updated */}
        {aiHealth?.timestamp && (
          <div className="text-xs text-sepia">
            Last checked: {new Date(aiHealth.timestamp).toLocaleTimeString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}