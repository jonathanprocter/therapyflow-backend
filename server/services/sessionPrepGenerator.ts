import { aiService } from "./aiService";
import { stripMarkdown } from "../utils/textFormatting";

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

const SESSION_PREP_SYSTEM_PROMPT = `You are a clinical documentation assistant supporting a licensed mental health counselor (Ph.D., LMHC) in preparing for an upcoming therapy session. Your role is to synthesize previous session notes into an actionable, clinically-informed prep document.

Your Approach:
Write from a collegial, clinician-to-clinician perspective. Be concise but clinically thorough. Flag anything requiring immediate attention. Offer suggestions, not prescriptions - the clinician knows their client best. Use the client's first name to maintain therapeutic warmth.

Clinical Frameworks to Consider:
When relevant, reference these modalities the clinician uses:
ACT (Acceptance and Commitment Therapy): Values, psychological flexibility, defusion
DBT: Distress tolerance, emotion regulation, interpersonal effectiveness
Narrative Therapy: Externalization, re-authoring, unique outcomes
Existential: Meaning-making, mortality, freedom/responsibility, isolation
Sex Therapy: Desire discrepancy, intimacy, sexual functioning

CRITICAL FORMATTING REQUIREMENT:
Your response must contain NO markdown syntax. This means:
NO # headers, NO **bold** or *italic*, NO - bullet points, NO backticks, NO links.
All text content must be plain text. Use clear section labels and paragraph breaks for structure.

Output Requirements:
Generate a structured JSON response matching the SessionPrepOutput schema. Ensure all fields are populated with clinically relevant content based on the notes provided. All string values must be plain text without any markdown formatting.`;

export function buildSessionPrepPrompt(request: SessionPrepInput): string {
  const client = request.client;
  const goals = client.treatmentGoals?.length ? client.treatmentGoals : ["Not specified"];
  const modalities = client.preferredModalities?.length ? client.preferredModalities : ["Not specified"];
  const considerations = client.clinicalConsiderations?.length ? client.clinicalConsiderations : ["None noted"];
  const meds = client.medications?.length ? client.medications : ["None listed"];
  const secondaryDx = client.secondaryDiagnoses?.length ? client.secondaryDiagnoses : ["None"];

  const notesSection = request.previousNotes.map((note, idx) => {
    return `Session ${note.sessionNumber ?? "N/A"} - ${note.sessionDate}${idx === 0 ? " (Most Recent)" : ""}

SUBJECTIVE:
${note.subjective || ""}

OBJECTIVE:
${note.objective || ""}

ASSESSMENT:
${note.assessment || ""}

PLAN:
${note.plan || ""}

Key Themes: ${(note.themes || []).join(", ") || "Not documented"}

Tonal Analysis:
${note.tonalAnalysis || "Not documented"}

Significant Quotes:
${(note.significantQuotes || []).map((q) => `"${q}"`).join("; ") || "None captured"}

Homework Assigned: ${(note.homeworkAssigned || []).join(", ") || "None"}

Interventions Used: ${(note.interventionsUsed || []).join(", ") || "Not documented"}

Risk Level: ${note.riskLevel || "none"}
${note.riskNotes ? `Risk Notes: ${note.riskNotes}` : ""}

Follow-Up Items for Next Session:
${(note.followUpItems || []).map((item, i) => `${i + 1}. ${item}`).join("\n") || "None specified"}

Keywords/Tags: ${(note.keywords || []).join(", ") || "None"}
`;
  }).join("\n---\n");

  return `
CLIENT CONTEXT
Name: ${client.firstName}
Treatment Start: ${client.treatmentStartDate || "Not specified"}
Primary Diagnosis: ${client.primaryDiagnosis || "Not specified"}
Secondary Diagnoses: ${secondaryDx.join(", ")}
Treatment Goals:
${goals.map((goal, idx) => `${idx + 1}. ${goal}`).join("\n")}
Preferred Modalities: ${modalities.join(", ")}
Standing Clinical Considerations:
${considerations.map((note, i) => `${i + 1}. ${note}`).join("\n")}
Medications: ${meds.join(", ")}

${request.longitudinalContext ? `LONGITUDINAL CONTEXT (Treatment Arc)\n${request.longitudinalContext}\n` : ""}

PREVIOUS SESSION NOTES
${notesSection || "No prior notes available."}

GENERATION REQUEST
Upcoming Session Date: ${request.upcomingSessionDate}
Include Pattern Analysis: ${request.includePatternAnalysis ? "true" : "false"}
${request.prepFocus ? `Specific Prep Focus: ${request.prepFocus}` : ""}

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

export async function generateSessionPrep(request: SessionPrepInput) {
  const prompt = buildSessionPrepPrompt(request);
  const response = await aiService.processTherapyDocument("", `${SESSION_PREP_SYSTEM_PROMPT}\n\n${prompt}`);
  return JSON.parse(response);
}
