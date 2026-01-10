/**
 * Recommendation Engine Service
 * Ported from TherapyGenius - Generates treatment recommendations based on client data
 * Provides evidence-based intervention suggestions, resource matching, and treatment optimization
 */

import { z } from "zod";
import { aiRouter } from "./ai-router";
import { storage } from "../storage";
import type { Client, ProgressNote, TreatmentPlan, Session } from "@shared/schema";

// Recommendation types
export type RecommendationType =
  | "intervention"
  | "resource"
  | "assessment"
  | "referral"
  | "session_adjustment"
  | "treatment_modality"
  | "homework"
  | "crisis_intervention";

export type RecommendationConfidence = "high" | "moderate" | "low";

export interface Recommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  rationale: string;
  confidence: RecommendationConfidence;
  priority: number; // 1-10, higher = more important
  evidenceBase?: string[];
  contraindications?: string[];
  prerequisites?: string[];
  estimatedImpact: "high" | "moderate" | "low";
  tags: string[];
  metadata: {
    generatedAt: string;
    dataPointsUsed: number;
    clientContext?: {
      presentingProblems: string[];
      currentPhase: string;
      riskLevel: string;
    };
  };
}

export interface SessionRecommendations {
  sessionId: string;
  clientId: string;
  clientName: string;
  preparedRecommendations: Recommendation[];
  suggestedTopics: string[];
  suggestedInterventions: string[];
  considerationsForSession: string[];
  followUpFromLastSession?: string[];
}

export interface TreatmentRecommendations {
  clientId: string;
  currentPhase: string;
  overallRecommendations: Recommendation[];
  interventionRecommendations: Recommendation[];
  resourceRecommendations: Recommendation[];
  assessmentRecommendations: Recommendation[];
  nextSteps: string[];
}

// Schema for AI-generated recommendations - with defaults for optional fields
const recommendationsSchema = z.object({
  recommendations: z.array(z.object({
    type: z.enum(["intervention", "resource", "assessment", "referral", "session_adjustment", "treatment_modality", "homework", "crisis_intervention"]).optional().default("intervention"),
    title: z.string().optional().default(""),
    description: z.string().optional().default(""),
    rationale: z.string().optional().default(""),
    confidence: z.enum(["high", "moderate", "low"]).optional().default("moderate"),
    priority: z.number().min(1).max(10).optional().default(5),
    evidenceBase: z.array(z.string()).optional().default([]),
    contraindications: z.array(z.string()).optional().default([]),
    prerequisites: z.array(z.string()).optional().default([]),
    estimatedImpact: z.enum(["high", "moderate", "low"]).optional().default("moderate")
  })).optional().default([]),
  suggestedTopics: z.array(z.string()).optional().default([]),
  suggestedInterventions: z.array(z.string()).optional().default([]),
  considerations: z.array(z.string()).optional().default([])
});

export class RecommendationEngine {

  /**
   * Generate session prep recommendations for an upcoming session
   */
  async generateSessionRecommendations(
    session: Session,
    client: Client,
    recentNotes: ProgressNote[],
    treatmentPlan?: TreatmentPlan
  ): Promise<SessionRecommendations> {
    const startTime = Date.now();

    try {
      console.log(`[Recommendation Engine] Generating recommendations for session ${session.id}`);

      // Compile context
      const sessionContext = this.buildSessionContext(client, recentNotes, treatmentPlan);

      // Generate recommendations using AI
      const result = await this.generateRecommendationsWithAI(sessionContext, "session");

      // Create recommendation objects with defaults applied
      const recommendations = (result.recommendations || []).map((rec, index) => {
        const normalizedRec = {
          type: rec.type || "intervention",
          title: rec.title || "",
          description: rec.description || "",
          rationale: rec.rationale || "",
          confidence: rec.confidence || "moderate",
          priority: rec.priority || 5,
          evidenceBase: rec.evidenceBase || [],
          contraindications: rec.contraindications || [],
          prerequisites: rec.prerequisites || [],
          estimatedImpact: rec.estimatedImpact || "moderate"
        };
        return {
          id: `rec-${session.id}-${index}-${Date.now()}`,
          ...normalizedRec,
          tags: this.generateTags(normalizedRec),
          metadata: {
            generatedAt: new Date().toISOString(),
            dataPointsUsed: recentNotes.length,
            clientContext: {
              presentingProblems: client.clinicalConsiderations || [],
              currentPhase: this.determinePhase(recentNotes.length),
              riskLevel: recentNotes[0]?.riskLevel || "unknown"
            }
          }
        };
      });

      // Extract follow-ups from last session
      const followUps = this.extractFollowUps(recentNotes[0]);

      console.log(`[Recommendation Engine] Generated ${recommendations.length} recommendations in ${Date.now() - startTime}ms`);

      return {
        sessionId: session.id,
        clientId: client.id,
        clientName: client.name,
        preparedRecommendations: recommendations,
        suggestedTopics: result.suggestedTopics,
        suggestedInterventions: result.suggestedInterventions,
        considerationsForSession: result.considerations,
        followUpFromLastSession: followUps
      };

    } catch (error) {
      console.error(`[Recommendation Engine] Error generating session recommendations:`, error);
      return {
        sessionId: session.id,
        clientId: client.id,
        clientName: client.name,
        preparedRecommendations: [],
        suggestedTopics: [],
        suggestedInterventions: [],
        considerationsForSession: ["Error generating recommendations"]
      };
    }
  }

  /**
   * Generate comprehensive treatment recommendations for a client
   */
  async generateTreatmentRecommendations(
    client: Client,
    notes: ProgressNote[],
    treatmentPlan?: TreatmentPlan
  ): Promise<TreatmentRecommendations> {
    const startTime = Date.now();

    try {
      console.log(`[Recommendation Engine] Generating treatment recommendations for client ${client.id}`);

      const context = this.buildTreatmentContext(client, notes, treatmentPlan);
      const result = await this.generateRecommendationsWithAI(context, "treatment");

      // Create recommendation objects with defaults applied
      const allRecommendations = (result.recommendations || []).map((rec, index) => {
        const normalizedRec = {
          type: rec.type || "intervention",
          title: rec.title || "",
          description: rec.description || "",
          rationale: rec.rationale || "",
          confidence: rec.confidence || "moderate",
          priority: rec.priority || 5,
          evidenceBase: rec.evidenceBase || [],
          contraindications: rec.contraindications || [],
          prerequisites: rec.prerequisites || [],
          estimatedImpact: rec.estimatedImpact || "moderate"
        };
        return {
          id: `rec-${client.id}-${index}-${Date.now()}`,
          ...normalizedRec,
          tags: this.generateTags(normalizedRec),
          metadata: {
            generatedAt: new Date().toISOString(),
            dataPointsUsed: notes.length,
            clientContext: {
              presentingProblems: client.clinicalConsiderations || [],
              currentPhase: this.determinePhase(notes.length),
              riskLevel: notes[0]?.riskLevel || "unknown"
            }
          }
        };
      });

      // Categorize recommendations
      const interventionRecs = allRecommendations.filter(r =>
        r.type === "intervention" || r.type === "treatment_modality"
      );
      const resourceRecs = allRecommendations.filter(r =>
        r.type === "resource" || r.type === "homework"
      );
      const assessmentRecs = allRecommendations.filter(r =>
        r.type === "assessment" || r.type === "referral"
      );

      console.log(`[Recommendation Engine] Generated ${allRecommendations.length} treatment recommendations in ${Date.now() - startTime}ms`);

      return {
        clientId: client.id,
        currentPhase: this.determinePhase(notes.length),
        overallRecommendations: allRecommendations.slice(0, 5),
        interventionRecommendations: interventionRecs,
        resourceRecommendations: resourceRecs,
        assessmentRecommendations: assessmentRecs,
        nextSteps: (result.suggestedTopics || []).slice(0, 5)
      };

    } catch (error) {
      console.error(`[Recommendation Engine] Error generating treatment recommendations:`, error);
      return {
        clientId: client.id,
        currentPhase: "unknown",
        overallRecommendations: [],
        interventionRecommendations: [],
        resourceRecommendations: [],
        assessmentRecommendations: [],
        nextSteps: []
      };
    }
  }

  /**
   * Generate recommendations using AI
   */
  private async generateRecommendationsWithAI(
    context: string,
    type: "session" | "treatment"
  ): Promise<z.infer<typeof recommendationsSchema>> {
    const prompt = type === "session"
      ? this.buildSessionPrompt(context)
      : this.buildTreatmentPrompt(context);

    try {
      return await aiRouter.chatJSON<z.infer<typeof recommendationsSchema>>(
        [{ role: "user", content: prompt }],
        recommendationsSchema,
        { maxTokens: 3000 }
      );
    } catch (error) {
      console.error("[Recommendation Engine] AI generation failed:", error);
      return {
        recommendations: [],
        suggestedTopics: [],
        suggestedInterventions: [],
        considerations: []
      };
    }
  }

  /**
   * Build context for session recommendations
   */
  private buildSessionContext(
    client: Client,
    notes: ProgressNote[],
    treatmentPlan?: TreatmentPlan
  ): string {
    const recentNote = notes[0];
    const notesSummary = notes.slice(0, 5).map((n, i) => {
      const date = new Date(n.sessionDate).toLocaleDateString();
      const content = (n.content || "").substring(0, 500);
      return `Session ${i + 1} (${date}): ${content}...`;
    }).join("\n\n");

    let context = `CLIENT: ${client.name}
STATUS: ${client.status}
CLINICAL CONSIDERATIONS: ${client.clinicalConsiderations?.join(', ') || 'None specified'}
PREFERRED MODALITIES: ${client.preferredModalities?.join(', ') || 'None specified'}
TOTAL SESSIONS: ${notes.length}
THERAPY PHASE: ${this.determinePhase(notes.length)}
`;

    if (recentNote) {
      context += `
LAST SESSION RISK LEVEL: ${recentNote.riskLevel || 'Not assessed'}
LAST SESSION TAGS: ${[...(recentNote.tags || []), ...(recentNote.aiTags || [])].join(', ')}
`;
    }

    if (treatmentPlan) {
      context += `
TREATMENT PLAN:
- Diagnosis: ${treatmentPlan.diagnosis || 'Not specified'}
- Interventions: ${treatmentPlan.interventions?.join(', ') || 'None specified'}
- Goals: ${this.formatGoals(treatmentPlan.goals)}
`;
    }

    context += `
RECENT SESSION HISTORY:
${notesSummary}
`;

    return context;
  }

  /**
   * Build context for treatment recommendations
   */
  private buildTreatmentContext(
    client: Client,
    notes: ProgressNote[],
    treatmentPlan?: TreatmentPlan
  ): string {
    // Aggregate all themes and tags
    const allTags = notes.flatMap(n => [...(n.tags || []), ...(n.aiTags || [])]);
    const tagFrequency = this.countFrequency(allTags);
    const topTags = Object.entries(tagFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tag]) => tag);

    // Risk history
    const riskHistory = notes
      .map(n => n.riskLevel)
      .filter((r): r is string => !!r);

    // Progress trend
    const progressRatings = notes
      .map(n => n.progressRating)
      .filter((r): r is number => r !== null && r !== undefined);

    let context = `CLIENT: ${client.name}
STATUS: ${client.status}
TOTAL SESSIONS: ${notes.length}
TREATMENT DURATION: ${this.calculateDuration(notes)}
CLINICAL CONSIDERATIONS: ${client.clinicalConsiderations?.join(', ') || 'None specified'}
PREFERRED MODALITIES: ${client.preferredModalities?.join(', ') || 'None specified'}

RECURRING THEMES (by frequency): ${topTags.join(', ')}

RISK HISTORY: ${this.summarizeRiskHistory(riskHistory)}

PROGRESS TREND: ${this.summarizeProgressTrend(progressRatings)}
`;

    if (treatmentPlan) {
      context += `
CURRENT TREATMENT PLAN:
- Diagnosis: ${treatmentPlan.diagnosis || 'Not specified'}
- Active: ${treatmentPlan.isActive ? 'Yes' : 'No'}
- Interventions: ${treatmentPlan.interventions?.join(', ') || 'None'}
- Goals: ${this.formatGoals(treatmentPlan.goals)}
`;
    }

    // Add summary of session content
    const sessionSummaries = notes.slice(0, 10).map((n, i) => {
      const date = new Date(n.sessionDate).toLocaleDateString();
      const preview = (n.content || "").substring(0, 300);
      return `[${date}] ${preview}...`;
    }).join("\n");

    context += `
SESSION SUMMARIES (last 10):
${sessionSummaries}
`;

    return context;
  }

  /**
   * Build prompt for session recommendations
   */
  private buildSessionPrompt(context: string): string {
    return `
You are an expert clinical consultant providing session preparation recommendations for a mental health therapist.

${context}

Based on this client's history and upcoming session, generate practical, evidence-based recommendations.

Provide a JSON response with:
1. **recommendations**: Array of specific recommendations, each with:
   - type: "intervention" | "resource" | "assessment" | "homework" | "session_adjustment"
   - title: Brief descriptive title
   - description: Detailed recommendation (2-3 sentences)
   - rationale: Why this is recommended based on the client's history
   - confidence: "high" | "moderate" | "low"
   - priority: 1-10 (higher = more important)
   - evidenceBase: Theoretical/research basis if applicable
   - contraindications: When NOT to use this
   - estimatedImpact: "high" | "moderate" | "low"

2. **suggestedTopics**: 3-5 topics to explore in the session
3. **suggestedInterventions**: 3-5 specific therapeutic techniques
4. **considerations**: Important things to keep in mind for this session

Focus on actionable, specific recommendations relevant to this client's current needs.
`;
  }

  /**
   * Build prompt for treatment recommendations
   */
  private buildTreatmentPrompt(context: string): string {
    return `
You are an expert clinical consultant conducting a comprehensive treatment review.

${context}

Analyze this client's therapy journey and generate comprehensive treatment recommendations.

Provide a JSON response with:
1. **recommendations**: Array of recommendations, each with:
   - type: "intervention" | "resource" | "assessment" | "referral" | "treatment_modality" | "homework"
   - title: Brief descriptive title
   - description: Detailed recommendation (2-3 sentences)
   - rationale: Why this is recommended based on the client's history
   - confidence: "high" | "moderate" | "low"
   - priority: 1-10
   - evidenceBase: Theoretical/research basis
   - contraindications: When NOT to use this
   - prerequisites: What needs to happen first
   - estimatedImpact: "high" | "moderate" | "low"

2. **suggestedTopics**: Key areas to focus on going forward
3. **suggestedInterventions**: Recommended therapeutic approaches
4. **considerations**: Important clinical considerations

Include:
- At least 2 intervention recommendations
- At least 1 assessment recommendation (if indicated)
- At least 1 resource/homework recommendation
- Consider referral needs if indicated

Base recommendations on the client's progress, themes, and therapeutic needs.
`;
  }

  /**
   * Generate tags for a recommendation
   */
  private generateTags(rec: { type: string; title: string; estimatedImpact: string }): string[] {
    const tags = [rec.type, `impact:${rec.estimatedImpact}`];

    // Add content-based tags
    const title = rec.title.toLowerCase();
    if (title.includes("cbt") || title.includes("cognitive")) tags.push("cbt");
    if (title.includes("dbt") || title.includes("dialectical")) tags.push("dbt");
    if (title.includes("mindful")) tags.push("mindfulness");
    if (title.includes("exposure")) tags.push("exposure");
    if (title.includes("trauma")) tags.push("trauma-focused");
    if (title.includes("safety") || title.includes("crisis")) tags.push("safety");

    return tags;
  }

  /**
   * Extract follow-up items from previous session
   */
  private extractFollowUps(note?: ProgressNote): string[] {
    if (!note || !note.content) return [];

    const content = note.content.toLowerCase();
    const followUps: string[] = [];

    // Look for common follow-up indicators
    const patterns = [
      /homework[:\s]+([^.]+)/gi,
      /follow[- ]?up[:\s]+([^.]+)/gi,
      /next session[:\s]+([^.]+)/gi,
      /practice[:\s]+([^.]+)/gi,
      /assigned[:\s]+([^.]+)/gi
    ];

    patterns.forEach(pattern => {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        if (match[1] && match[1].length > 5) {
          followUps.push(match[1].trim());
        }
      }
    });

    return followUps.slice(0, 5);
  }

  // Helper methods
  private determinePhase(sessionCount: number): string {
    if (sessionCount < 4) return "early";
    if (sessionCount < 12) return "working";
    if (sessionCount < 24) return "consolidation";
    return "maintenance";
  }

  private formatGoals(goals: unknown): string {
    if (!goals) return "None specified";

    try {
      const parsed = typeof goals === 'string' ? JSON.parse(goals) : goals;
      if (Array.isArray(parsed)) {
        return parsed.map((g: any) => g.description || g.goal || String(g)).join('; ');
      }
      return String(goals);
    } catch {
      return String(goals);
    }
  }

  private calculateDuration(notes: ProgressNote[]): string {
    if (notes.length === 0) return "0 days";

    const dates = notes.map(n => new Date(n.sessionDate).getTime()).sort();
    const first = dates[0];
    const last = dates[dates.length - 1];
    const durationDays = Math.round((last - first) / (1000 * 60 * 60 * 24));

    if (durationDays < 30) return `${durationDays} days`;
    if (durationDays < 365) return `${Math.round(durationDays / 30)} months`;
    return `${(durationDays / 365).toFixed(1)} years`;
  }

  private summarizeRiskHistory(riskLevels: string[]): string {
    if (riskLevels.length === 0) return "No risk assessments";

    const frequency = this.countFrequency(riskLevels);
    const summary = Object.entries(frequency)
      .map(([level, count]) => `${level}: ${count}`)
      .join(', ');

    const hasElevated = riskLevels.some(r => ["high", "critical", "elevated"].includes(r));
    if (hasElevated) {
      return `${summary} (HISTORY OF ELEVATED RISK)`;
    }
    return summary;
  }

  private summarizeProgressTrend(ratings: number[]): string {
    if (ratings.length < 2) return "Insufficient data";

    const recent = ratings.slice(0, 3);
    const older = ratings.slice(-3);

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    const trend = recentAvg - olderAvg;
    if (trend > 1) return "Improving";
    if (trend < -1) return "Declining";
    return "Stable";
  }

  private countFrequency(items: string[]): Record<string, number> {
    return items.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Get intervention suggestions based on presenting problems
   */
  getInterventionSuggestions(presentingProblems: string[]): string[] {
    const interventionMap: Record<string, string[]> = {
      anxiety: ["Progressive Muscle Relaxation", "Cognitive Restructuring", "Exposure Hierarchy", "Grounding Techniques"],
      depression: ["Behavioral Activation", "Cognitive Restructuring", "Pleasant Activity Scheduling", "Problem-Solving Therapy"],
      trauma: ["EMDR", "Prolonged Exposure", "CPT", "Grounding", "Safety Planning"],
      relationship: ["Communication Skills Training", "Gottman Method", "EFT", "Role-Playing"],
      anger: ["Anger Management", "Relaxation Training", "CBT for Anger", "Time-Out Strategies"],
      substance: ["Motivational Interviewing", "Relapse Prevention", "Contingency Management", "CBT-SUD"],
      grief: ["Meaning Reconstruction", "Continuing Bonds", "Narrative Therapy", "EMDR for Grief"],
      ocd: ["ERP", "Cognitive Restructuring", "Habit Reversal", "ACT"],
      eating: ["CBT-E", "DBT", "Family-Based Treatment", "Intuitive Eating"],
      sleep: ["CBT-I", "Sleep Hygiene", "Stimulus Control", "Sleep Restriction"]
    };

    const suggestions = new Set<string>();
    presentingProblems.forEach(problem => {
      const problemLower = problem.toLowerCase();
      Object.entries(interventionMap).forEach(([key, interventions]) => {
        if (problemLower.includes(key)) {
          interventions.forEach(i => suggestions.add(i));
        }
      });
    });

    return Array.from(suggestions);
  }
}

// Export singleton instance
export const recommendationEngine = new RecommendationEngine();
