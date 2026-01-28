import { aiService } from "./aiService";

export type RiskLevel = "none" | "low" | "moderate" | "high" | "acute";

export interface SessionPrepInput {
  client: {
    firstName: string;
    treatmentStartDate?: string | null;
    primaryDiagnosis?: string | null;
    secondaryDiagnoses?: string[];
    treatmentGoals?: string[];
    preferredModalities?: string[];
    clinicalConsiderations?: string[];
    medications?: string[];
  };
  // Pending reminders/notes to follow up on (from quick notes, external events, etc.)
  pendingFollowUps?: Array<{
    content: string;
    dueDate?: string | null;
    category?: string; // e.g., "appointment", "life_event", "homework", "reminder"
    recordedAt?: string;
  }>;
  previousNotes: Array<{
    sessionDate: string;
    sessionNumber?: number | null;
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
    themes?: string[];
    tonalAnalysis?: string;
    significantQuotes?: string[];
    keywords?: string[];
    riskLevel?: RiskLevel;
    riskNotes?: string;
    homeworkAssigned?: string[];
    interventionsUsed?: string[];
    followUpItems?: string[];
  }>;
  upcomingSessionDate: string;
  prepFocus?: string | null;
  includePatternAnalysis?: boolean;
  longitudinalContext?: string | null;
}

const SESSION_PREP_SYSTEM_PROMPT = `You are a clinical documentation assistant supporting a licensed mental health counselor (Ph.D., LMHC) in preparing for an upcoming therapy session. Your role is to synthesize previous session notes into an actionable, clinically-informed prep document that is visually scannable and prioritized for clinical utility.

## Your Approach
- Write from a collegial, clinician-to-clinician perspective
- Be concise but clinically thorough
- PRIORITIZE: Identify 3-5 themes most relevant for the upcoming session based on recency, frequency, or clinical urgency
- Group related themes into clinical categories rather than flat lists
- Frame themes as potential session focus areas or clinical questions when possible
- Flag anything requiring immediate attention
- Offer suggestions, not prescriptions—the clinician knows their client best
- Use the client's first name to maintain therapeutic warmth
- IMPORTANT: Never include unrelated content (video editing notes, non-clinical material, etc.)

## Clinical Frameworks to Consider
When relevant, reference these modalities the clinician uses:
- ACT (Acceptance and Commitment Therapy): Values, psychological flexibility, defusion
- DBT: Distress tolerance, emotion regulation, interpersonal effectiveness
- Narrative Therapy: Externalization, re-authoring, unique outcomes
- Existential: Meaning-making, mortality, freedom/responsibility, isolation
- Sex Therapy: Desire discrepancy, intimacy, sexual functioning

## Theme Categories (use these for grouping)
- Family System & Boundaries
- Identity & Life Transitions
- Emotional Regulation
- Interpersonal Patterns
- Self-Perception & Coping
- Somatic/Body-Based
- Cognitive Patterns
- Relational/Attachment
- Trauma & Safety
- Values & Meaning

## Output Requirements
Generate a structured JSON response designed for quick clinical scanning. Ensure hierarchical organization and actionable framing.`;

export function buildSessionPrepPrompt(request: SessionPrepInput): string {
  const client = request.client;
  const goals = client.treatmentGoals?.length ? client.treatmentGoals : ["Not specified"];
  const modalities = client.preferredModalities?.length ? client.preferredModalities : ["Not specified"];
  const considerations = client.clinicalConsiderations?.length ? client.clinicalConsiderations : ["None noted"];
  const meds = client.medications?.length ? client.medications : ["None listed"];
  const secondaryDx = client.secondaryDiagnoses?.length ? client.secondaryDiagnoses : ["None"];

  const notesSection = request.previousNotes.map((note, idx) => {
    return `### Session ${note.sessionNumber ?? "N/A"} — ${note.sessionDate}${idx === 0 ? " (Most Recent)" : ""}

**SUBJECTIVE:**
${note.subjective || ""}

**OBJECTIVE:**
${note.objective || ""}

**ASSESSMENT:**
${note.assessment || ""}

**PLAN:**
${note.plan || ""}

**Key Themes:** ${(note.themes || []).join(", ") || "Not documented"}

**Tonal Analysis:**
${note.tonalAnalysis || "Not documented"}

**Significant Quotes:**
${(note.significantQuotes || []).map((q) => `- "${q}"`).join("\n") || "None captured"}

**Homework Assigned:** ${(note.homeworkAssigned || []).join(", ") || "None"}

**Interventions Used:** ${(note.interventionsUsed || []).join(", ") || "Not documented"}

**Risk Level:** ${note.riskLevel || "none"}
${note.riskNotes ? `**Risk Notes:** ${note.riskNotes}` : ""}

**Follow-Up Items for Next Session:**
${(note.followUpItems || []).map((item) => `- ${item}`).join("\n") || "None specified"}

**Keywords/Tags:** ${(note.keywords || []).join(", ") || "None"}
`;
  }).join("\n---\n");

  return `
## Client Context
- **Name**: ${client.firstName}
- **Treatment Start**: ${client.treatmentStartDate || "Not specified"}
- **Primary Diagnosis**: ${client.primaryDiagnosis || "Not specified"}
- **Secondary Diagnoses**: ${secondaryDx.join(", ")}
- **Treatment Goals**:
${goals.map((goal, idx) => `  ${idx + 1}. ${goal}`).join("\n")}
- **Preferred Modalities**: ${modalities.join(", ")}
- **Standing Clinical Considerations**:
${considerations.map((note) => `  - ${note}`).join("\n")}
- **Medications**: ${meds.join(", ")}

${request.longitudinalContext ? `## Longitudinal Context (Treatment Arc)\n${request.longitudinalContext}\n` : ""}

${request.pendingFollowUps?.length ? `## Pending Follow-Ups & Reminders
These items were noted by the clinician and should be addressed in this session:
${request.pendingFollowUps.map((item, idx) => {
  let line = `${idx + 1}. ${item.content}`;
  if (item.category) line += ` [${item.category}]`;
  if (item.dueDate) line += ` (due: ${item.dueDate})`;
  if (item.recordedAt) line += ` (noted: ${item.recordedAt})`;
  return line;
}).join('\n')}

**Important**: Include these follow-up items in the "clinician_reminders" section and consider them when suggesting session openers.
` : ""}

## Previous Session Notes
${notesSection || "No prior notes available."}

## Generation Request
- **Upcoming Session Date**: ${request.upcomingSessionDate}
- **Include Pattern Analysis**: ${request.includePatternAnalysis ? "true" : "false"}
${request.prepFocus ? `- **Specific Prep Focus**: ${request.prepFocus}` : ""}

Return valid JSON matching this schema (designed for quick clinical scanning):
{
  "client_name": "string (client's first name)",
  "session_info": {
    "date": "string (formatted date)",
    "session_type": "Individual|Couples|Family|Group",
    "duration": 60,
    "session_number": int,
    "client_status": "Active|Maintenance|Terminating"
  },
  "priority_focus_areas": [
    {
      "title": "string (concise theme, e.g., 'Fear of abandonment through authentic self-expression')",
      "clinical_question": "string (actionable question, e.g., 'How might this show up in the therapeutic relationship?')",
      "rationale": "string (brief explanation of why this is priority, e.g., 'Mentioned in last 2 sessions, connected to presenting concern')"
    }
  ],
  "last_session_summary": {
    "summary": "string (2-4 sentences of what happened)",
    "where_we_left_off": "string (specific point where session ended)",
    "homework_assigned": ["string (any between-session tasks)"],
    "unfinished_threads": ["string (topics to revisit)"]
  },
  "theme_clusters": [
    {
      "category": "string (e.g., 'Family System & Boundaries', 'Identity & Life Transitions', 'Emotional Regulation', 'Interpersonal Patterns', 'Self-Perception & Coping')",
      "themes": ["string (specific theme within category)"]
    }
  ],
  "clinical_considerations": [
    "string (clinical notes, e.g., 'Client may benefit from slower pacing given introversion')",
    "string (e.g., 'Watch for: defensiveness or withdrawal as protective responses')"
  ],
  "risk_factors": ["string (if any active risk factors)"],
  "recommended_interventions": ["string (suggested techniques or approaches)"]
}
`;
}

export async function generateSessionPrep(request: SessionPrepInput) {
  const prompt = buildSessionPrepPrompt(request);
  const response = await aiService.processTherapyDocument("", `${SESSION_PREP_SYSTEM_PROMPT}\n\n${prompt}`);

  try {
    return JSON.parse(response);
  } catch (parseError) {
    console.error('[SessionPrep] Failed to parse AI response:', parseError);
    // Return a safe default structure instead of crashing
    return {
      keyThemes: [],
      suggestedApproaches: [],
      riskConsiderations: [],
      questionPrompts: [],
      previousSessionSummary: 'Unable to generate - AI response format error'
    };
  }
}
