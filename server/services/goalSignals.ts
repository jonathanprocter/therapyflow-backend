import { storage } from "../storage";
import { ClinicalEncryption } from "../utils/encryption";

function extractKeywords(goalText: string): string[] {
  return goalText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3);
}

export async function buildGoalSignals(clientId: string, therapistId?: string) {
  const treatmentPlan = await storage.getTreatmentPlan(clientId);
  if (!treatmentPlan || !(treatmentPlan.goals as any[])?.length) {
    return [];
  }

  // SECURITY: Pass therapistId for tenant isolation
  const notes = await storage.getProgressNotes(clientId, therapistId);
  const recentNotes = notes.slice(0, 12);
  const previousNotes = notes.slice(12, 24);

  return (treatmentPlan.goals as any[]).map((goal: any) => {
    const goalText = goal.description || goal.text || String(goal);
    const keywords = extractKeywords(goalText);

    const matches = (note: any) => {
      const tags = [...(note.tags || []), ...(note.aiTags || [])].map((tag: string) => tag.toLowerCase());
      const content = note.content ? ClinicalEncryption.decrypt(note.content) : "";
      return keywords.some((keyword) => tags.includes(keyword) || content.includes(keyword));
    };

    const matchedRecent = recentNotes.filter(matches);
    const matchedPrevious = previousNotes.filter(matches);
    const mentionCount = matchedRecent.length;
    const lastMentionDate = matchedRecent[0]?.sessionDate || null;
    const trend = matchedRecent.length > matchedPrevious.length ? "up" : matchedRecent.length < matchedPrevious.length ? "down" : "flat";
    const progressScores = matchedRecent.map((note) => note.progressRating).filter((score: any) => typeof score === "number");
    const avgProgress = progressScores.length
      ? Number((progressScores.reduce((sum: number, value: number) => sum + value, 0) / progressScores.length).toFixed(1))
      : null;

    return {
      id: goal.id || goal.goalId || null,
      text: goalText,
      status: goal.status || "active",
      mentionCount,
      lastMentionDate,
      trend,
      avgProgress,
      keywords,
    };
  });
}
