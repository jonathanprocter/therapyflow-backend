import { storage } from "../storage";
import { getAppSetting } from "../utils/appSettings";

const DEFAULT_THRESHOLDS = {
  alertAt: "high",
  trendWindow: 3,
};

const RISK_SCORE: Record<string, number> = {
  none: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
  acute: 4,
};

export async function getRiskThresholds() {
  const settings = await getAppSetting("risk_thresholds");
  return {
    ...DEFAULT_THRESHOLDS,
    ...(settings || {}),
  };
}

export async function checkRiskEscalation(clientId: string, therapistId?: string) {
  const thresholds = await getRiskThresholds();
  // SECURITY: Pass therapistId for tenant isolation
  const notes = await storage.getProgressNotes(clientId, therapistId);
  if (!notes || notes.length === 0) return null;

  // Ensure trendWindow is at least 1 to prevent division by zero
  const trendWindow = Math.max(1, thresholds.trendWindow || 3);
  const recent = notes.slice(0, trendWindow);
  if (recent.length === 0) return null; // Extra safety check

  const scores = recent.map((note) => RISK_SCORE[note.riskLevel || "none"] ?? 0);
  const average = scores.length > 0
    ? scores.reduce((sum, value) => sum + value, 0) / scores.length
    : 0;
  const latest = scores[0] ?? 0;

  const alertAtScore = RISK_SCORE[thresholds.alertAt] ?? 3;
  const isEscalating = latest >= alertAtScore || average >= alertAtScore;

  return {
    isEscalating,
    latestRiskLevel: recent[0]?.riskLevel || "none",
    averageRiskScore: average,
    threshold: thresholds.alertAt,
  };
}
