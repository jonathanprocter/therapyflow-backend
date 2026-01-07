import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function TreatmentPlans() {
  const [clientId, setClientId] = useState<string>('');

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ['/api/clients'],
    enabled: true,
  });

  const { data: plan } = useQuery<any>({
    queryKey: ['/api/treatment-plan', clientId],
    queryFn: () => fetch(`/api/treatment-plan/${clientId}`).then((res) => res.json()),
    enabled: Boolean(clientId),
  });

  const { data: signals } = useQuery<any>({
    queryKey: ['/api/clients', clientId, 'goal-signals'],
    queryFn: () => fetch(`/api/clients/${clientId}/goal-signals`).then((res) => res.json()),
    enabled: Boolean(clientId),
  });

  const goalSignals = signals?.signals || [];

  const getTrendIcon = (trend: string) => {
    if (trend === 'up') return <TrendingUp className="h-4 w-4 text-emerald-500" />;
    if (trend === 'down') return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-evergreen">Treatment Plans</h1>
        <p className="text-muted-foreground mt-1">Track goals with dynamic signals from recent notes.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select Client</CardTitle>
          <CardDescription>Choose a client to view their treatment goals and trends.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="w-full md:w-80">
              <SelectValue placeholder="Select a client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {!clientId && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Select a client to view their treatment plan.
          </CardContent>
        </Card>
      )}

      {clientId && (
        <Card>
          <CardHeader>
            <CardTitle>Goal Signals</CardTitle>
            <CardDescription>Auto-tracked goal mentions and progress trends.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {plan?.goals?.length ? (
              plan.goals.map((goal: any, index: number) => {
                const signal = goalSignals.find((item: any) => item.id === goal.id || item.text === goal.description) || {};
                return (
                  <div key={goal.id || index} className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{goal.description || goal.text || `Goal ${index + 1}`}</div>
                      <div className="flex items-center gap-2">
                        {getTrendIcon(signal.trend)}
                        <Badge variant="outline">{signal.trend || 'flat'}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                      <span>Mentions: {signal.mentionCount ?? 0}</span>
                      <span>Avg Progress: {signal.avgProgress ?? 'N/A'}</span>
                      <span>Last Mention: {signal.lastMentionDate ? new Date(signal.lastMentionDate).toLocaleDateString() : 'N/A'}</span>
                    </div>
                    {signal.keywords?.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {signal.keywords.slice(0, 6).map((keyword: string) => (
                          <Badge key={keyword} variant="secondary">{keyword}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-muted-foreground">No treatment plan goals found for this client.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
