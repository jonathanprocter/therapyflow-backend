import { useParams } from "wouter";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Clock, User, AlertTriangle, Target, BookOpen, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { formatInTimeZone } from "date-fns-tz";

interface SessionPrepData {
  session: {
    id: string;
    scheduledAt: Date;
    duration: number;
    sessionType: string;
    status: string;
    client: {
      id: string;
      name: string;
      email?: string;
    };
  };
  client: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
  };
  recentNotes: Array<{
    id: string;
    content: string;
    createdAt: Date;
    aiTags: string[];
  }>;
  caseConceptualization?: {
    presenting: string;
    predisposing: string;
    precipitating: string;
    perpetuating: string;
    protective: string;
    formulation?: string;
  };
  treatmentPlan?: {
    goals: string[];
    interventions: string[];
    objectives: string[];
  };
  recentSessions: Array<{
    id: string;
    scheduledAt: Date;
    sessionType: string;
    status: string;
  }>;
  prepSuggestions: {
    focusAreas: string[];
    interventions: string[];
    riskFactors: string[];
  };
}

export default function SessionPrep() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [location] = useLocation();
  const urlParams = new URLSearchParams(location.split('?')[1] || '');
  const clientId = urlParams.get("clientId");

  const { data: prepData, isLoading, error } = useQuery<SessionPrepData>({
    queryKey: ["/api/sessions", sessionId, "prep", clientId],
    queryFn: () => fetch(`/api/sessions/${sessionId}/prep?clientId=${clientId}`).then(res => res.json()),
    enabled: !!sessionId
  });

  const { data: savedPrep } = useQuery<any>({
    queryKey: ["/api/sessions", sessionId, "prep-ai", "latest"],
    queryFn: () => fetch(`/api/sessions/${sessionId}/prep-ai/latest`).then(res => res.json()),
    enabled: !!sessionId
  });

  const { data: prepHistory = [] } = useQuery<any[]>({
    queryKey: ["/api/sessions", sessionId, "prep-ai", "history"],
    queryFn: () => fetch(`/api/sessions/${sessionId}/prep-ai/history`).then(res => res.json()),
    enabled: !!sessionId
  });

  const [selectedPrepIndex, setSelectedPrepIndex] = useState(0);
  const [compareIndex, setCompareIndex] = useState(1);
  const [showFullDiff, setShowFullDiff] = useState(false);

  const aiPrepMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/sessions/${sessionId}/prep-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        throw new Error("Failed to generate AI prep");
      }
      return response.json();
    }
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-sage/30 rounded w-1/3"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-64 bg-sage/30 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !prepData) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error Loading Session Prep</h1>
          <p className="text-moss">Unable to load session preparation data.</p>
          <Link href="/calendar">
            <Button className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Calendar
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { session, client, recentNotes, caseConceptualization, treatmentPlan, recentSessions } = prepData;

  const historyPrep = prepHistory.length > 0 ? prepHistory[selectedPrepIndex]?.prep : null;
  const comparisonPrep = prepHistory.length > 1 ? prepHistory[compareIndex]?.prep : null;
  const activePrep = aiPrepMutation.data?.prep || historyPrep || savedPrep?.prep;

  const diffList = (current: string[] = [], previous: string[] = []) => {
    const currentSet = new Set(current);
    const previousSet = new Set(previous);
    return {
      added: current.filter(item => !previousSet.has(item)),
      removed: previous.filter(item => !currentSet.has(item))
    };
  };

  const diffWords = (current: string, previous: string) => {
    const currentTokens = current.split(/\s+/).filter(Boolean);
    const previousTokens = previous.split(/\s+/).filter(Boolean);
    const rows = previousTokens.length + 1;
    const cols = currentTokens.length + 1;
    const dp = Array.from({ length: rows }, () => Array(cols).fill(0));

    for (let i = 1; i < rows; i++) {
      for (let j = 1; j < cols; j++) {
        if (previousTokens[i - 1] === currentTokens[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }

    const parts: Array<{ text: string; type: "added" | "removed" | "unchanged" }> = [];
    let i = previousTokens.length;
    let j = currentTokens.length;

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && previousTokens[i - 1] === currentTokens[j - 1]) {
        parts.unshift({ text: currentTokens[j - 1], type: "unchanged" });
        i -= 1;
        j -= 1;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        parts.unshift({ text: currentTokens[j - 1], type: "added" });
        j -= 1;
      } else if (i > 0) {
        parts.unshift({ text: previousTokens[i - 1], type: "removed" });
        i -= 1;
      }
    }

    return parts;
  };

  const sessionTime = formatInTimeZone(new Date(session.scheduledAt), 'America/New_York', 'PPpp');

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="session-prep-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/calendar">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Calendar
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-evergreen">
              Session Preparation
            </h1>
            <p className="text-moss">
              Preparing for session with {client.name}
            </p>
          </div>
        </div>
        <Button
          onClick={() => aiPrepMutation.mutate()}
          disabled={aiPrepMutation.isPending}
          style={{ backgroundColor: '#88A5BC', borderColor: '#88A5BC', color: '#FFFFFF' }}
        >
          <Sparkles className="w-4 h-4 mr-2" />
          {aiPrepMutation.isPending ? "Generating..." : "Generate AI Prep"}
        </Button>
      </div>

      {/* Session Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Clock className="w-5 h-5" />
            <span>Session Details</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm font-medium text-moss/80">Client</p>
              <p className="text-lg font-semibold">{client.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-moss/80">Date & Time</p>
              <p className="text-lg">{sessionTime}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-moss/80">Duration</p>
              <p className="text-lg">{session.duration} minutes</p>
            </div>
            <div>
              <p className="text-sm font-medium text-moss/80">Type</p>
              <Badge variant="outline">{session.sessionType}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Progress Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BookOpen className="w-5 h-5" />
              <span>Recent Notes</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentNotes.length > 0 ? (
              recentNotes.map((note, index) => (
                <div key={note.id} className="space-y-2">
                  <div className="flex justify-between items-start">
                    <h4 className="font-medium text-sm">
                      Session {index + 1} ago
                    </h4>
                    <span className="text-xs text-moss/80">
                      {formatInTimeZone(new Date(note.createdAt), 'America/New_York', 'MMM dd')}
                    </span>
                  </div>
                  <p className="text-sm text-moss line-clamp-3">
                    {note.content?.substring(0, 150)}...
                  </p>
                  {note.aiTags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {note.aiTags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {index < recentNotes.length - 1 && <Separator className="mt-4" />}
                </div>
              ))
            ) : (
              <p className="text-sm text-moss/80">No recent progress notes available.</p>
            )}
          </CardContent>
        </Card>

        {/* Case Conceptualization */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="w-5 h-5" />
              <span>Case Overview</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {caseConceptualization ? (
              <>
                <div>
                  <h4 className="font-medium text-sm mb-2">Presenting Issues</h4>
                  <p className="text-sm text-moss">{caseConceptualization.presenting}</p>
                </div>

                <div>
                  <h4 className="font-medium text-sm mb-2">Predisposing Factors</h4>
                  <p className="text-sm text-moss">{caseConceptualization.predisposing}</p>
                </div>

                <div>
                  <h4 className="font-medium text-sm mb-2">Protective Factors</h4>
                  <p className="text-sm text-moss">{caseConceptualization.protective}</p>
                </div>
              </>
            ) : (
              <p className="text-sm text-moss/80">No case conceptualization available.</p>
            )}
          </CardContent>
        </Card>

        {/* Treatment Plan & Risk Factors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="w-5 h-5" />
              <span>Treatment Focus</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {treatmentPlan && (
              <>
                {treatmentPlan.goals.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">Treatment Goals</h4>
                    <ul className="text-sm space-y-1">
                      {treatmentPlan.goals.slice(0, 3).map((goal, index) => (
                        <li key={index} className="text-moss">• {goal}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {treatmentPlan.interventions.length > 0 && (
                  <div>
                    <h4 className="font-medium text-sm mb-2">Suggested Interventions</h4>
                    <div className="flex flex-wrap gap-1">
                      {treatmentPlan.interventions.slice(0, 4).map((intervention) => (
                        <Badge key={intervention} variant="secondary" className="text-xs">
                          {intervention}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {caseConceptualization && (
              <div>
                <h4 className="font-medium text-sm mb-2 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1 text-sage" />
                  Perpetuating Factors
                </h4>
                <p className="text-sm text-moss">{caseConceptualization.perpetuating}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {activePrep && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              AI Session Prep
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-evergreen/90">
            {prepHistory.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <label htmlFor="prep-history" className="text-moss">Prep history</label>
                <select
                  id="prep-history"
                  className="border rounded px-2 py-1"
                  value={selectedPrepIndex}
                  onChange={(event) => setSelectedPrepIndex(Number(event.target.value))}
                >
                  {prepHistory.map((prep, index) => (
                    <option key={prep.id || index} value={index}>
                      {new Date(prep.createdAt).toLocaleString()}
                    </option>
                  ))}
                </select>
                {prepHistory.length > 1 && (
                  <>
                    <label htmlFor="prep-compare" className="text-moss">Compare to</label>
                    <select
                      id="prep-compare"
                      className="border rounded px-2 py-1"
                      value={compareIndex}
                      onChange={(event) => setCompareIndex(Number(event.target.value))}
                    >
                      {prepHistory.map((prep, index) => (
                        <option key={`compare-${prep.id || index}`} value={index}>
                          {new Date(prep.createdAt).toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            )}
            <div>
              <h4 className="font-semibold text-evergreen">Where We Left Off</h4>
              <p className="text-moss">{activePrep.where_we_left_off.session_ending_note}</p>
              <div className="mt-2">
                <Badge variant="outline">Themes: {(activePrep.where_we_left_off.key_themes || []).join(", ")}</Badge>
              </div>
            </div>
            <Separator />
            <div>
              <h4 className="font-semibold text-evergreen">Homework Follow-Up</h4>
              <ul className="list-disc pl-5">
                {(activePrep.homework_follow_up.assignments || []).map((item: string, index: number) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
            <Separator />
            <div>
              <h4 className="font-semibold text-evergreen">Clinical Flags</h4>
              <p>Risk level: {activePrep.clinical_flags.risk_level}</p>
              <ul className="list-disc pl-5">
                {(activePrep.clinical_flags.requires_assessment || []).map((item: string, index: number) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
            <Separator />
            <div>
              <h4 className="font-semibold text-evergreen">Suggested Openers</h4>
              <ul className="list-disc pl-5">
                {(activePrep.suggested_openers.warm_openers || []).map((item: string, index: number) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {activePrep && comparisonPrep && compareIndex !== selectedPrepIndex && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Prep Comparison
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
            <div className="lg:col-span-2 flex items-center justify-between text-xs">
              <span className="text-moss/80">Diff view</span>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showFullDiff}
                  onChange={(event) => setShowFullDiff(event.target.checked)}
                  data-testid="toggle-full-diff"
                />
                Full text diff
              </label>
            </div>
            {(() => {
              const themeDiff = diffList(activePrep.where_we_left_off.key_themes, comparisonPrep.where_we_left_off.key_themes);
              const focusDiff = diffList(activePrep.session_focus_suggestions, comparisonPrep.session_focus_suggestions);
              const openerDiff = diffList(
                activePrep.suggested_openers.warm_openers,
                comparisonPrep.suggested_openers.warm_openers
              );
              const flagDiff = diffList(
                activePrep.clinical_flags.requires_assessment,
                comparisonPrep.clinical_flags.requires_assessment
              );
              return (
                <div className="lg:col-span-2 rounded border p-3 space-y-2">
                  <div className="text-xs text-moss/80">Diff highlights</div>
                  <div className="flex flex-wrap gap-2">
                    {themeDiff.added.map((item, index) => (
                      <Badge key={`theme-add-${index}`} style={{ backgroundColor: 'rgba(142, 165, 140, 0.2)', color: '#344C3D' }}>
                        + {item}
                      </Badge>
                    ))}
                    {themeDiff.removed.map((item, index) => (
                      <Badge key={`theme-remove-${index}`} style={{ backgroundColor: 'rgba(176, 133, 133, 0.2)', color: '#6B3B3B' }}>
                        - {item}
                      </Badge>
                    ))}
                    {focusDiff.added.map((item, index) => (
                      <Badge key={`focus-add-${index}`} style={{ backgroundColor: 'rgba(136, 165, 188, 0.2)', color: '#2F4B63' }}>
                        + {item}
                      </Badge>
                    ))}
                    {focusDiff.removed.map((item, index) => (
                      <Badge key={`focus-remove-${index}`} style={{ backgroundColor: 'rgba(196, 164, 100, 0.2)', color: '#6B4E1E' }}>
                        - {item}
                      </Badge>
                    ))}
                    {openerDiff.added.map((item, index) => (
                      <Badge key={`opener-add-${index}`} style={{ backgroundColor: 'rgba(136, 165, 188, 0.2)', color: '#2F4B63' }}>
                        + opener: {item}
                      </Badge>
                    ))}
                    {openerDiff.removed.map((item, index) => (
                      <Badge key={`opener-remove-${index}`} style={{ backgroundColor: 'rgba(196, 164, 100, 0.2)', color: '#6B4E1E' }}>
                        - opener: {item}
                      </Badge>
                    ))}
                    {flagDiff.added.map((item, index) => (
                      <Badge key={`flag-add-${index}`} style={{ backgroundColor: 'rgba(176, 133, 133, 0.2)', color: '#6B3B3B' }}>
                        + flag: {item}
                      </Badge>
                    ))}
                    {flagDiff.removed.map((item, index) => (
                      <Badge key={`flag-remove-${index}`} style={{ backgroundColor: 'rgba(142, 165, 140, 0.2)', color: '#344C3D' }}>
                        - flag: {item}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })()}
            {showFullDiff && (
              <div className="lg:col-span-2 rounded border p-3 space-y-3 text-xs text-moss">
                <div className="font-semibold text-evergreen">Inline Text Diff</div>
                {[
                  {
                    label: "Session Ending Note",
                    current: activePrep.where_we_left_off.session_ending_note,
                    previous: comparisonPrep.where_we_left_off.session_ending_note
                  },
                  {
                    label: "Clinical Flags",
                    current: (activePrep.clinical_flags.requires_assessment || []).join(" "),
                    previous: (comparisonPrep.clinical_flags.requires_assessment || []).join(" ")
                  },
                  {
                    label: "Warm Openers",
                    current: (activePrep.suggested_openers.warm_openers || []).join(" "),
                    previous: (comparisonPrep.suggested_openers.warm_openers || []).join(" ")
                  },
                  {
                    label: "Focus Suggestions",
                    current: (activePrep.session_focus_suggestions || []).join(" "),
                    previous: (comparisonPrep.session_focus_suggestions || []).join(" ")
                  }
                ].map((item, index) => (
                  <div key={index} className="space-y-1">
                    <div className="text-moss/80">{item.label}</div>
                    <div className="flex flex-wrap gap-1">
                      {diffWords(item.current || "", item.previous || "").map((part, idx) => (
                        <span
                          key={idx}
                          className="px-1 rounded"
                          style={
                            part.type === "added"
                              ? { backgroundColor: "rgba(142, 165, 140, 0.25)" }
                              : part.type === "removed"
                                ? { backgroundColor: "rgba(176, 133, 133, 0.25)", textDecoration: "line-through" }
                                : {}
                          }
                        >
                          {part.text}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <h4 className="font-semibold text-evergreen">Selected Prep</h4>
              <div className="rounded border p-3 space-y-2">
                <div>
                  <div className="text-xs text-moss/80">Themes</div>
                  <div>{activePrep.where_we_left_off.key_themes.join(", ")}</div>
                </div>
                <div>
                  <div className="text-xs text-moss/80">Risk Level</div>
                  <div>{activePrep.clinical_flags.risk_level}</div>
                </div>
                <div>
                  <div className="text-xs text-moss/80">Focus Suggestions</div>
                  <ul className="list-disc pl-4">
                    {activePrep.session_focus_suggestions.map((item: string, index: number) => (
                      <li key={`focus-a-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-evergreen">Comparison Prep</h4>
              <div className="rounded border p-3 space-y-2">
                <div>
                  <div className="text-xs text-moss/80">Themes</div>
                  <div>{comparisonPrep.where_we_left_off.key_themes.join(", ")}</div>
                </div>
                <div>
                  <div className="text-xs text-moss/80">Risk Level</div>
                  <div>{comparisonPrep.clinical_flags.risk_level}</div>
                </div>
                <div>
                  <div className="text-xs text-moss/80">Focus Suggestions</div>
                  <ul className="list-disc pl-4">
                    {comparisonPrep.session_focus_suggestions.map((item: string, index: number) => (
                      <li key={`focus-b-${index}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end space-x-4">
        <Link href={`/clients/${client.id}`}>
          <Button variant="outline">
            View Full Client Record
          </Button>
        </Link>
        <Link href={`/progress-notes/new?clientId=${client.id}&sessionId=${session.id}`}>
          <Button>
            Start Session Notes
          </Button>
        </Link>
      </div>
    </div>
  );
}
