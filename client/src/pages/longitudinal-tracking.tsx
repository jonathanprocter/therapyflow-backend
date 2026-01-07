import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, LineChart } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface LongitudinalRecord {
  id: string;
  createdAt: string;
  analysis: any;
  record: any;
}

export default function LongitudinalTracking() {
  const queryClient = useQueryClient();
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedHistoryId, setSelectedHistoryId] = useState<string>("");

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
    enabled: true,
  });

  const { data: latestRecord } = useQuery<LongitudinalRecord | null>({
    queryKey: ["/api/clients", selectedClientId, "longitudinal", "latest"],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${selectedClientId}/longitudinal/latest`);
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error("Failed to fetch latest longitudinal analysis");
      }
      return res.json();
    },
    enabled: Boolean(selectedClientId),
  });

  const { data: history = [] } = useQuery<LongitudinalRecord[]>({
    queryKey: ["/api/clients", selectedClientId, "longitudinal", "history"],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${selectedClientId}/longitudinal/history`);
      if (res.status === 404) return [];
      if (!res.ok) {
        throw new Error("Failed to fetch longitudinal history");
      }
      return res.json();
    },
    enabled: Boolean(selectedClientId),
  });

  useEffect(() => {
    if (history.length > 0) {
      setSelectedHistoryId(history[0].id);
    } else {
      setSelectedHistoryId("");
    }
  }, [history]);

  const generateMutation = useMutation({
    mutationFn: () => apiRequest(`/api/clients/${selectedClientId}/longitudinal/generate`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "longitudinal", "latest"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedClientId, "longitudinal", "history"] });
    },
  });

  const activeRecord = useMemo(() => {
    if (!selectedHistoryId) {
      return latestRecord;
    }
    return history.find((item) => item.id === selectedHistoryId) || latestRecord;
  }, [history, latestRecord, selectedHistoryId]);

  const analysis = activeRecord?.analysis || {};
  const record = activeRecord?.record || {};

  const renderList = (items: string[] = [], emptyLabel = "None noted") => (
    items.length > 0 ? (
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item} className="text-sm text-muted-foreground">• {item}</li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-muted-foreground">{emptyLabel}</p>
    )
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-gray-900">Longitudinal Tracking</h1>
        <p className="text-gray-600">Generate longitudinal analyses to track clinical progress across the treatment arc.</p>
      </div>

      <Card className="border-moss/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <LineChart className="h-5 w-5 text-french-blue" />
            Client Selection
          </CardTitle>
          <CardDescription>Select a client to generate and review longitudinal analyses.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
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

          <Button
            onClick={() => generateMutation.mutate()}
            disabled={!selectedClientId || generateMutation.isPending}
            className="w-full md:w-auto"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Analysis
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {selectedClientId && (
        <Card className="border-moss/20">
          <CardHeader>
            <CardTitle className="text-gray-900">Analysis History</CardTitle>
            <CardDescription>Review past longitudinal analyses for this client.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
            <Select value={selectedHistoryId} onValueChange={setSelectedHistoryId} disabled={history.length === 0}>
              <SelectTrigger className="w-full md:w-80">
                <SelectValue placeholder={history.length ? "Select analysis" : "No analyses yet"} />
              </SelectTrigger>
              <SelectContent>
                {history.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {new Date(entry.createdAt).toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {latestRecord && (
              <Badge variant="outline">Latest: {new Date(latestRecord.createdAt).toLocaleDateString()}</Badge>
            )}
          </CardContent>
        </Card>
      )}

      {!activeRecord && selectedClientId && (
        <Card className="border-moss/20">
          <CardContent className="py-10 text-center text-muted-foreground">
            No longitudinal analysis yet. Generate one to see the treatment arc summary.
          </CardContent>
        </Card>
      )}

      {activeRecord && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border-moss/20">
            <CardHeader>
              <CardTitle className="text-gray-900">Treatment Arc Overview</CardTitle>
              <CardDescription>Key context from the latest longitudinal analysis.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Phase: {analysis.treatment_phase || "Unspecified"}</Badge>
                <Badge variant="outline">Sessions: {analysis.total_sessions ?? record.sessions?.total ?? "N/A"}</Badge>
                <Badge variant="outline">Duration: {analysis.treatment_duration_days ?? "N/A"} days</Badge>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900">Theme arc</p>
                <p className="text-sm text-muted-foreground">{analysis.theme_arc || "No summary available."}</p>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">Active themes</p>
                  {renderList(analysis.active_themes)}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Stuck themes</p>
                  {renderList(analysis.stuck_themes, "None flagged")}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-moss/20">
            <CardHeader>
              <CardTitle className="text-gray-900">Quantitative Signals</CardTitle>
              <CardDescription>Trend-level metrics and risk tracking.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Engagement: {analysis.engagement_trend || "Unknown"}</Badge>
                <Badge variant="secondary">Risk: {analysis.risk_trend || "Unknown"}</Badge>
                <Badge variant="outline">Behavioral: {analysis.behavioral_consistency || "Unknown"}</Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Measure trajectories</p>
                <div className="space-y-1">
                  {analysis.quantitative_trends && Object.keys(analysis.quantitative_trends).length > 0 ? (
                    Object.entries(analysis.quantitative_trends).map(([measure, trend]) => (
                      <div key={measure} className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{measure}</span>
                        <Badge variant="outline">{String(trend)}</Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No standardized measures recorded.</p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Reliable change achieved</p>
                {renderList(analysis.reliable_change_achieved, "No reliable change flagged")}
              </div>
            </CardContent>
          </Card>

          <Card className="border-moss/20">
            <CardHeader>
              <CardTitle className="text-gray-900">Narrative & Pattern Tracking</CardTitle>
              <CardDescription>Qualitative shifts and relational patterns.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Narrative: {analysis.narrative_flexibility || "Unknown"}</Badge>
                <Badge variant="outline">Alliance: {analysis.alliance_quality || "Unknown"}</Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Dominant narrative</p>
                <p className="text-sm text-muted-foreground">{analysis.dominant_narrative || "Not specified"}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Counter narratives</p>
                {renderList(analysis.counter_narratives, "None captured")}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Patterns to monitor</p>
                {renderList(analysis.patterns_client_may_not_see, "None captured")}
              </div>
            </CardContent>
          </Card>

          <Card className="border-moss/20">
            <CardHeader>
              <CardTitle className="text-gray-900">Treatment Focus</CardTitle>
              <CardDescription>Priority areas for the next phase of care.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">Goals on track</p>
                  {renderList(analysis.goals_on_track)}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Goals needing attention</p>
                  {renderList(analysis.goals_needing_attention, "None flagged")}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">What's working</p>
                  {renderList(analysis.whats_working)}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">What's not landing</p>
                  {renderList(analysis.whats_not_landing, "None noted")}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Focus recommendations</p>
                {renderList(analysis.focus_recommendations, "No recommendations yet")}
              </div>
            </CardContent>
          </Card>

          <Card className="border-moss/20 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-gray-900">Clinical Hypotheses & Next Steps</CardTitle>
              <CardDescription>Connections and predicted challenges for continued work.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div>
                <p className="text-sm font-medium text-gray-900">Quant + Qual Connections</p>
                {renderList(analysis.quant_qual_connections)}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Predicted challenges</p>
                {renderList(analysis.predicted_challenges, "No challenges flagged")}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Termination considerations</p>
                <p className="text-sm text-muted-foreground">{analysis.termination_considerations || "Not specified"}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
