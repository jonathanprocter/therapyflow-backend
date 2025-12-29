export interface NoteQualityResult {
  score: number;
  flags: string[];
  missingSections: string[];
}

const SECTION_PATTERNS = {
  subjective: /\b(subjective|^s:)\b/i,
  objective: /\b(objective|^o:)\b/i,
  assessment: /\b(assessment|^a:)\b/i,
  plan: /\b(plan|^p:)\b/i,
};

export function calculateNoteQuality(content?: string | null): NoteQualityResult {
  if (!content || !content.trim()) {
    return {
      score: 0,
      flags: ["missing_content"],
      missingSections: ["subjective", "objective", "assessment", "plan"],
    };
  }

  const normalized = content.replace(/\r/g, "\n");
  const missingSections = Object.entries(SECTION_PATTERNS)
    .filter(([, pattern]) => !pattern.test(normalized))
    .map(([section]) => section);

  const lengthScore = Math.min(25, Math.floor(normalized.length / 200) * 5);
  const sectionScore = 60 - missingSections.length * 15;
  const hasRisk = /\b(risk|suicid|self-harm|si)\b/i.test(normalized) ? 5 : 0;
  const hasIntervention = /\b(intervention|skill|exercise|homework|plan)\b/i.test(normalized) ? 5 : 0;

  const score = Math.max(0, Math.min(100, sectionScore + lengthScore + hasRisk + hasIntervention));

  const flags: string[] = [];
  if (missingSections.length > 0) flags.push("missing_sections");
  if (normalized.length < 200) flags.push("too_short");
  if (!hasIntervention) flags.push("missing_interventions");

  return {
    score,
    flags,
    missingSections,
  };
}
