import { aiService } from "./aiService";

export type RiskLevel = "none" | "low" | "moderate" | "high" | "acute";

// Full interface for AI-enhanced prep (used by /api/sessions/:id/prep-ai)
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

// Simplified interface for basic prep (used by GET/POST /api/sessions/:id/prep)
export interface SimplifiedSessionPrepInput {
  therapistId: string;
  clientId: string;
  clientName: string;
  sessionId: string;
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
  }>;
  treatmentPlan?: {
    goals?: string[];
    objectives?: string[];
    interventions?: string[];
  };
}

// Union type to accept both input formats
export type SessionPrepInputUnion = SessionPrepInput | SimplifiedSessionPrepInput;

const SESSION_PREP_SYSTEM_PROMPT = `You are a clinical documentation assistant supporting a licensed mental health counselor (Ph.D., LMHC) in preparing for an upcoming therapy session. Your role is to synthesize previous session notes into an actionable, clinically-informed prep document.

## Your Approach
- Write from a collegial, clinician-to-clinician perspective
- Be concise but clinically thorough
- Flag anything requiring immediate attention
- Offer suggestions, not prescriptions—the clinician knows their client best
- Use the client's first name to maintain therapeutic warmth

## Clinical Frameworks to Consider
When relevant, reference these modalities the clinician uses:
- ACT (Acceptance and Commitment Therapy): Values, psychological flexibility, defusion
- DBT: Distress tolerance, emotion regulation, interpersonal effectiveness
- Narrative Therapy: Externalization, re-authoring, unique outcomes
- Existential: Meaning-making, mortality, freedom/responsibility, isolation
- Sex Therapy: Desire discrepancy, intimacy, sexual functioning

## Output Requirements
Generate a structured JSON response matching the SessionPrepOutput schema. Ensure all fields are populated with clinically relevant content based on the notes provided.`;

// Type guard to check if input is simplified format
function isSimplifiedInput(request: SessionPrepInputUnion): request is SimplifiedSessionPrepInput {
  return 'clientName' in request && !('client' in request);
}

// Normalize simplified input to full SessionPrepInput format
function normalizeInput(request: SessionPrepInputUnion): SessionPrepInput {
  if (isSimplifiedInput(request)) {
    // Convert simplified input to full format
    const firstName = request.clientName?.split(' ')[0] || 'Client';
    return {
      client: {
        firstName,
        treatmentStartDate: null,
        primaryDiagnosis: null,
        secondaryDiagnoses: [],
        treatmentGoals: request.treatmentPlan?.goals || [],
        preferredModalities: [],
        clinicalConsiderations: [],
        medications: [],
      },
      previousNotes: request.previousNotes.map(note => ({
        ...note,
        homeworkAssigned: [],
        interventionsUsed: [],
        followUpItems: [],
      })),
      upcomingSessionDate: new Date().toISOString().split('T')[0],
      prepFocus: null,
      includePatternAnalysis: true,
      longitudinalContext: null,
    };
  }
  return request;
}

export function buildSessionPrepPrompt(request: SessionPrepInputUnion): string {
  // Normalize input to full format
  const normalizedRequest = normalizeInput(request);
  const client = normalizedRequest.client;
  const goals = client.treatmentGoals?.length ? client.treatmentGoals : ["Not specified"];
  const modalities = client.preferredModalities?.length ? client.preferredModalities : ["Not specified"];
  const considerations = client.clinicalConsiderations?.length ? client.clinicalConsiderations : ["None noted"];
  const meds = client.medications?.length ? client.medications : ["None listed"];
  const secondaryDx = client.secondaryDiagnoses?.length ? client.secondaryDiagnoses : ["None"];

  const notesSection = normalizedRequest.previousNotes.map((note, idx) => {
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

${normalizedRequest.longitudinalContext ? `## Longitudinal Context (Treatment Arc)\n${normalizedRequest.longitudinalContext}\n` : ""}

## Previous Session Notes
${notesSection || "No prior notes available."}

## Generation Request
- **Upcoming Session Date**: ${normalizedRequest.upcomingSessionDate}
- **Include Pattern Analysis**: ${normalizedRequest.includePatternAnalysis ? "true" : "false"}
${normalizedRequest.prepFocus ? `- **Specific Prep Focus**: ${normalizedRequest.prepFocus}` : ""}

Return valid JSON matching this schema:
{
  "client_name": "string",
  "prep_generated": "ISO datetime",
  "upcoming_session": "ISO date",
  "where_we_left_off": {
    "key_themes": ["string"],
    "emotional_tone": "string",
    "unresolved_threads": ["string"],
    "session_ending_note": "string"
  },
  "homework_follow_up": {
    "assignments": ["string"],
    "follow_up_questions": ["string"],
    "days_since_assignment": int
  },
  "treatment_plan_status": {
    "goals_addressed_recently": ["string"],
    "goals_needing_attention": ["string"],
    "progress_indicators": ["string"],
    "setback_indicators": ["string"]
  },
  "clinical_flags": {
    "risk_level": "none|low|moderate|high|acute",
    "risk_factors": ["string"],
    "somatic_complaints": ["string"],
    "sleep_appetite_changes": "string",
    "requires_assessment": ["string"]
  },
  "pattern_analysis": {
    "recurring_themes": ["string"],
    "emotional_trajectory": "string",
    "therapeutic_alliance_notes": "string",
    "modality_effectiveness": {"modality": "observation"}
  },
  "suggested_openers": {
    "warm_openers": ["string"],
    "content_openers": ["string"],
    "homework_openers": ["string"]
  },
  "session_focus_suggestions": ["string"],
  "clinician_reminders": ["string"]
}
`;
}

export async function generateSessionPrep(request: SessionPrepInputUnion) {
  try {
    const prompt = buildSessionPrepPrompt(request);
    const response = await aiService.processTherapyDocument("", `${SESSION_PREP_SYSTEM_PROMPT}\n\n${prompt}`);

    // Safely parse JSON response
    try {
      return JSON.parse(response);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.error('Raw AI response:', response?.substring(0, 500));

      // Return a fallback structure with error info
      return {
        client_name: isSimplifiedInput(request) ? request.clientName : request.client.firstName,
        prep_generated: new Date().toISOString(),
        upcoming_session: isSimplifiedInput(request) ? new Date().toISOString().split('T')[0] : request.upcomingSessionDate,
        error: 'Failed to parse AI response',
        where_we_left_off: {
          key_themes: ['Unable to generate - please try again'],
          emotional_tone: 'Unknown',
          unresolved_threads: [],
          session_ending_note: ''
        },
        homework_follow_up: {
          assignments: [],
          follow_up_questions: [],
          days_since_assignment: 0
        },
        treatment_plan_status: {
          goals_addressed_recently: [],
          goals_needing_attention: [],
          progress_indicators: [],
          setback_indicators: []
        },
        clinical_flags: {
          risk_level: 'none',
          risk_factors: [],
          somatic_complaints: [],
          sleep_appetite_changes: '',
          requires_assessment: []
        },
        pattern_analysis: {
          recurring_themes: [],
          emotional_trajectory: '',
          therapeutic_alliance_notes: '',
          modality_effectiveness: {}
        },
        suggested_openers: {
          warm_openers: ['How have you been since our last session?'],
          content_openers: [],
          homework_openers: []
        },
        session_focus_suggestions: ['Review previous session notes manually'],
        clinician_reminders: ['AI prep generation encountered an error - use clinical judgment']
      };
    }
  } catch (error) {
    console.error('Session prep generation failed:', error);
    throw error;
  }
}
