import { useParams } from "wouter";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Clock, User, AlertTriangle, Target, BookOpen } from "lucide-react";
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

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
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
          <p className="text-gray-600">Unable to load session preparation data.</p>
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
            <h1 className="text-2xl font-bold text-gray-900">
              Session Preparation
            </h1>
            <p className="text-gray-600">
              Preparing for session with {client.name}
            </p>
          </div>
        </div>
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
              <p className="text-sm font-medium text-gray-500">Client</p>
              <p className="text-lg font-semibold">{client.name}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Date & Time</p>
              <p className="text-lg">{sessionTime}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Duration</p>
              <p className="text-lg">{session.duration} minutes</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Type</p>
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
                    <span className="text-xs text-gray-500">
                      {formatInTimeZone(new Date(note.createdAt), 'America/New_York', 'MMM dd')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-3">
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
              <p className="text-sm text-gray-500">No recent progress notes available.</p>
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
                  <p className="text-sm text-gray-600">{caseConceptualization.presenting}</p>
                </div>

                <div>
                  <h4 className="font-medium text-sm mb-2">Predisposing Factors</h4>
                  <p className="text-sm text-gray-600">{caseConceptualization.predisposing}</p>
                </div>

                <div>
                  <h4 className="font-medium text-sm mb-2">Protective Factors</h4>
                  <p className="text-sm text-gray-600">{caseConceptualization.protective}</p>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">No case conceptualization available.</p>
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
                        <li key={index} className="text-gray-600">• {goal}</li>
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
                <p className="text-sm text-gray-600">{caseConceptualization.perpetuating}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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