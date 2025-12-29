import { storage } from "../storage";
import { aiService } from "./aiService";
import { ClinicalEncryption } from "../utils/encryption";

const LONGITUDINAL_ANALYSIS_PROMPT = `You are a clinical data analyst supporting a licensed mental health counselor. Your task is to synthesize longitudinal treatment data into actionable clinical insights.

## Your Role
- Identify patterns across sessions that might not be visible session-to-session
- Track quantitative trends and flag clinically significant changes
- Map qualitative evolution of themes, narratives, and patterns
- Highlight what's working and what needs adjustment
- Maintain clinical objectivity while honoring the client's lived experience

## Analysis Framework

### Quantitative Analysis
- Calculate trajectories for standardized measures (note reliable change thresholds)
- Identify behavioral patterns (attendance, homework, engagement)
- Flag any concerning trends (declining scores, increased risk ratings)
- Note positive trends and gains made

### Qualitative Analysis
- Map theme evolution: emergence → active → resolving/resolved
- Track narrative shifts: fused → noticing → questioning → reauthoring
- Identify relationship pattern changes
- Assess modality effectiveness based on observed outcomes

### Integration
- Connect quantitative changes to qualitative shifts
- Identify discrepancies (e.g., scores improving but client reports feeling worse)
- Synthesize overall treatment arc

## Output Requirements
Provide structured analysis that can feed into session prep and treatment planning.`;

const LONGITUDINAL_OUTPUT_SCHEMA = `{
  "client_name": "string",
  "analysis_date": "ISO date",
  "treatment_duration_days": int,
  "total_sessions": int,
  "quantitative_trends": {"measure_name": "improving|stable|declining"},
  "reliable_change_achieved": ["string"],
  "engagement_trend": "string",
  "risk_trend": "string",
  "behavioral_consistency": "string",
  "theme_arc": "string",
  "active_themes": ["string"],
  "resolving_themes": ["string"],
  "stuck_themes": ["string"],
  "narrative_flexibility": "string",
  "dominant_narrative": "string",
  "counter_narratives": ["string"],
  "pattern_status": {"pattern_name": "status"},
  "alliance_quality": "string",
  "treatment_phase": "string",
  "goals_on_track": ["string"],
  "goals_needing_attention": ["string"],
  "whats_working": ["string"],
  "whats_not_landing": ["string"],
  "quant_qual_connections": ["string"],
  "patterns_client_may_not_see": ["string"],
  "predicted_challenges": ["string"],
  "focus_recommendations": ["string"],
  "modality_adjustments": ["string"],
  "goals_to_prioritize": ["string"],
  "termination_considerations": "string"
}`;

const RISK_SCORE: Record<string, number> = {
  none: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
  acute: 4,
};

function safeDecrypt(content: string | null | undefined): string {
  if (!content) return "";
  try {
    return ClinicalEncryption.decrypt(content) || "";
  } catch {
    return content;
  }
}

function computeRiskTrend(riskLevels: string[]): string {
  if (riskLevels.length < 2) return "stable";
  const scores = riskLevels.map((level) => RISK_SCORE[level] ?? 0);
  const recent = scores.slice(0, 5);
  const average = recent.reduce((sum, value) => sum + value, 0) / recent.length;
  const prior = scores.slice(5, 10);
  const priorAverage = prior.length
    ? prior.reduce((sum, value) => sum + value, 0) / prior.length
    : average;

  if (average > priorAverage + 0.3) return "escalating";
  if (average < priorAverage - 0.3) return "improving";
  return "stable";
}

function summarizeThemes(tags: string[], aiTags: string[]) {
  const counts = new Map<string, number>();
  [...tags, ...aiTags].forEach((tag) => {
    if (!tag) return;
    counts.set(tag, (counts.get(tag) || 0) + 1);
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, count]) => ({ name, count }));
}

function buildRecordSummary(options: {
  client: any;
  sessions: any[];
  notes: any[];
  treatmentPlan: any | undefined;
  allianceScores: any[];
}) {
  const { client, sessions, notes, treatmentPlan, allianceScores } = options;
  const sortedNotes = [...notes].sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());
  const completedSessions = sessions.filter((session) => session.status === "completed");
  const cancelledSessions = sessions.filter((session) => session.status === "cancelled");
  const noShowSessions = sessions.filter((session) => session.status === "no-show");
  const upcomingSessions = sessions.filter((session) => new Date(session.scheduledAt).getTime() > Date.now());

  const riskLevels = sortedNotes.map((note) => note.riskLevel || "none");
  const progressRatings = sortedNotes.map((note) => note.progressRating).filter((value) => typeof value === "number");
  const themeSummary = summarizeThemes(
    sortedNotes.flatMap((note) => note.tags || []),
    sortedNotes.flatMap((note) => note.aiTags || [])
  );

  const noteSummaries = sortedNotes.slice(0, 30).map((note) => ({
    sessionDate: note.sessionDate,
    status: note.status,
    riskLevel: note.riskLevel,
    progressRating: note.progressRating,
    tags: note.tags || [],
    aiTags: note.aiTags || [],
    requiresManualReview: note.requiresManualReview,
    isPlaceholder: note.isPlaceholder,
    contentExcerpt: safeDecrypt(note.content || "").slice(0, 800),
  }));

  const goals = (treatmentPlan?.goals as any[]) || [];

  return {
    client: {
      id: client.id,
      name: client.name,
      status: client.status,
      treatmentStartDate: client.createdAt,
    },
    sessions: {
      total: sessions.length,
      completed: completedSessions.length,
      cancelled: cancelledSessions.length,
      noShow: noShowSessions.length,
      upcoming: upcomingSessions.length,
      attendanceRate: sessions.length ? Number(((completedSessions.length / sessions.length) * 100).toFixed(1)) : null,
      mostRecentSession: completedSessions[0]?.scheduledAt || null,
    },
    notes: {
      total: notes.length,
      placeholders: notes.filter((note) => note.isPlaceholder).length,
      manualReview: notes.filter((note) => note.requiresManualReview).length,
      latestNoteDate: sortedNotes[0]?.sessionDate || null,
    },
    progress: {
      averageRating: progressRatings.length
        ? Number((progressRatings.reduce((sum, value) => sum + value, 0) / progressRatings.length).toFixed(1))
        : null,
      latestRating: progressRatings[0] ?? null,
      riskTrend: computeRiskTrend(riskLevels),
      latestRiskLevel: riskLevels[0] || "none",
    },
    themes: themeSummary,
    treatmentPlan: {
      diagnosis: treatmentPlan?.diagnosis || null,
      goals,
      isActive: treatmentPlan?.isActive ?? null,
    },
    allianceScores: allianceScores.map((score) => ({
      score: score.score,
      assessmentDate: score.assessmentDate,
      factors: score.factors,
    })),
    recentNotes: noteSummaries,
  };
}

export async function generateLongitudinalTracking(clientId: string, therapistId: string) {
  const client = await storage.getClient(clientId);
  if (!client) {
    throw new Error("Client not found");
  }

  const sessions = await storage.getSessions(clientId);
  const notes = await storage.getProgressNotes(clientId);
  const treatmentPlan = await storage.getTreatmentPlan(clientId);
  const allianceScores = await storage.getAllianceScores(clientId);

  const record = buildRecordSummary({
    client,
    sessions,
    notes,
    treatmentPlan,
    allianceScores,
  });

  const prompt = `${LONGITUDINAL_ANALYSIS_PROMPT}\n\n## Client Longitudinal Record (JSON)\n${JSON.stringify(record, null, 2)}\n\n## Output Schema Reference\n${LONGITUDINAL_OUTPUT_SCHEMA}\n\nReturn valid JSON only.`;

  const response = await aiService.processTherapyDocument("", prompt);
  const analysis = JSON.parse(response);

  const saved = await storage.createLongitudinalRecord({
    clientId,
    therapistId,
    record,
    analysis,
  });

  return {
    ...saved,
    record,
    analysis,
  };
}

export function formatLongitudinalContext(analysis: any): string {
  if (!analysis) return "";
  return [
    `Treatment phase: ${analysis.treatment_phase || "unspecified"}`,
    `Engagement trend: ${analysis.engagement_trend || "unknown"}`,
    `Risk trend: ${analysis.risk_trend || "unknown"}`,
    `Active themes: ${(analysis.active_themes || []).join(", ") || "none"}`,
    `Goals needing attention: ${(analysis.goals_needing_attention || []).join(", ") || "none"}`,
    `What's working: ${(analysis.whats_working || []).join(", ") || "none"}`,
    `What's not landing: ${(analysis.whats_not_landing || []).join(", ") || "none"}`,
  ].join("\n");
}
