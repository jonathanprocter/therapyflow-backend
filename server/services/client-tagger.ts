/**
 * Client Tagger Service
 * Ported from TherapyGenius - Long-term client pattern analysis with comprehensive AI tags
 * Tracks therapy trajectory, diagnostic insights, treatment response, recurring themes,
 * risk profile, client strengths, goal progress, clinical patterns, engagement profile
 */

import { z } from "zod";
import { aiRouter } from "./ai-router";
import { storage } from "../storage";
import type { Client, ProgressNote, TreatmentPlan, Session } from "@shared/schema";

// Comprehensive client tags structure
export interface ClientTags {
  // Therapy journey overview
  therapyTrajectory: {
    overallProgress: "significant_improvement" | "moderate_improvement" | "minimal_change" | "decline" | "fluctuating";
    phase: "early" | "working" | "consolidation" | "termination" | "maintenance";
    sessionCount: number;
    treatmentDuration: string; // e.g., "6 months"
    primaryGains: string[];
    remainingChallenges: string[];
  };

  // Diagnostic profile
  diagnosticInsights: {
    primaryPresentation: string[];
    symptomPatterns: {
      symptom: string;
      severity: "mild" | "moderate" | "severe";
      trend: "improving" | "stable" | "worsening";
    }[];
    differentialConsiderations: string[];
    comorbidityIndicators: string[];
  };

  // Treatment response patterns
  treatmentResponse: {
    respondingWellTo: string[];
    limitedResponseTo: string[];
    preferredModalities: string[];
    optimalSessionFrequency: string;
    medicationConsiderations?: string;
  };

  // Recurring themes across sessions
  recurringThemes: {
    theme: string;
    frequency: "very_frequent" | "frequent" | "occasional";
    clinicalSignificance: "high" | "moderate" | "low";
    relatedTopics: string[];
  }[];

  // Risk profile
  riskProfile: {
    currentLevel: "minimal" | "low" | "moderate" | "elevated" | "high";
    historicalPeaks: string[];
    triggerPatterns: string[];
    protectiveFactors: string[];
    safetyPlanStatus: "in_place" | "needs_update" | "not_applicable";
    crisisInterventions: number;
  };

  // Client strengths and resources
  clientStrengths: {
    internalStrengths: string[];
    externalResources: string[];
    copingSkillsMastered: string[];
    resilienceFactors: string[];
    supportNetwork: "strong" | "moderate" | "limited" | "isolated";
  };

  // Goal progress tracking
  goalProgress: {
    goalId?: string;
    description: string;
    status: "achieved" | "significant_progress" | "moderate_progress" | "minimal_progress" | "not_started" | "discontinued";
    percentComplete: number;
    targetDate?: string;
  }[];

  // Clinical patterns
  clinicalPatterns: {
    attachmentStyle: string;
    defensePatterns: string[];
    cognitivePatterns: string[];
    behavioralPatterns: string[];
    interpersonalPatterns: string[];
    emotionalRegulationStyle: string;
  };

  // Engagement profile
  engagementProfile: {
    overallEngagement: "highly_engaged" | "engaged" | "variable" | "disengaged";
    attendancePattern: "consistent" | "mostly_consistent" | "irregular" | "poor";
    homeworkCompliance: "excellent" | "good" | "fair" | "poor" | "not_applicable";
    sessionParticipation: "active" | "responsive" | "passive" | "resistant";
    therapyReadiness: "high" | "moderate" | "developing" | "low";
  };

  // Metadata
  metadata: {
    lastUpdated: string;
    sessionsAnalyzed: number;
    confidenceScore: number;
    aiModel: string;
  };
}

// Zod schema for validation - all fields optional to handle partial AI responses
const clientTagsSchema = z.object({
  therapyTrajectory: z.object({
    overallProgress: z.enum(["significant_improvement", "moderate_improvement", "minimal_change", "decline", "fluctuating"]).optional().default("minimal_change"),
    phase: z.enum(["early", "working", "consolidation", "termination", "maintenance"]).optional().default("early"),
    sessionCount: z.number().optional().default(0),
    treatmentDuration: z.string().optional().default("unknown"),
    primaryGains: z.array(z.string()).optional().default([]),
    remainingChallenges: z.array(z.string()).optional().default([])
  }).optional(),
  diagnosticInsights: z.object({
    primaryPresentation: z.array(z.string()).optional().default([]),
    symptomPatterns: z.array(z.object({
      symptom: z.string(),
      severity: z.enum(["mild", "moderate", "severe"]),
      trend: z.enum(["improving", "stable", "worsening"])
    })).optional().default([]),
    differentialConsiderations: z.array(z.string()).optional().default([]),
    comorbidityIndicators: z.array(z.string()).optional().default([])
  }).optional(),
  treatmentResponse: z.object({
    respondingWellTo: z.array(z.string()).optional().default([]),
    limitedResponseTo: z.array(z.string()).optional().default([]),
    preferredModalities: z.array(z.string()).optional().default([]),
    optimalSessionFrequency: z.string().optional().default("weekly"),
    medicationConsiderations: z.string().optional()
  }).optional(),
  recurringThemes: z.array(z.object({
    theme: z.string(),
    frequency: z.enum(["very_frequent", "frequent", "occasional"]),
    clinicalSignificance: z.enum(["high", "moderate", "low"]),
    relatedTopics: z.array(z.string()).optional().default([])
  })).optional().default([]),
  riskProfile: z.object({
    currentLevel: z.enum(["minimal", "low", "moderate", "elevated", "high"]).optional().default("minimal"),
    historicalPeaks: z.array(z.string()).optional().default([]),
    triggerPatterns: z.array(z.string()).optional().default([]),
    protectiveFactors: z.array(z.string()).optional().default([]),
    safetyPlanStatus: z.enum(["in_place", "needs_update", "not_applicable"]).optional().default("not_applicable"),
    crisisInterventions: z.number().optional().default(0)
  }).optional(),
  clientStrengths: z.object({
    internalStrengths: z.array(z.string()).optional().default([]),
    externalResources: z.array(z.string()).optional().default([]),
    copingSkillsMastered: z.array(z.string()).optional().default([]),
    resilienceFactors: z.array(z.string()).optional().default([]),
    supportNetwork: z.enum(["strong", "moderate", "limited", "isolated"]).optional().default("moderate")
  }).optional(),
  goalProgress: z.array(z.object({
    goalId: z.string().optional(),
    description: z.string(),
    status: z.enum(["achieved", "significant_progress", "moderate_progress", "minimal_progress", "not_started", "discontinued"]),
    percentComplete: z.number(),
    targetDate: z.string().optional()
  })).optional().default([]),
  clinicalPatterns: z.object({
    attachmentStyle: z.string().optional().default("unknown"),
    defensePatterns: z.array(z.string()).optional().default([]),
    cognitivePatterns: z.array(z.string()).optional().default([]),
    behavioralPatterns: z.array(z.string()).optional().default([]),
    interpersonalPatterns: z.array(z.string()).optional().default([]),
    emotionalRegulationStyle: z.string().optional().default("unknown")
  }).optional(),
  engagementProfile: z.object({
    overallEngagement: z.enum(["highly_engaged", "engaged", "variable", "disengaged"]).optional().default("engaged"),
    attendancePattern: z.enum(["consistent", "mostly_consistent", "irregular", "poor"]).optional().default("consistent"),
    homeworkCompliance: z.enum(["excellent", "good", "fair", "poor", "not_applicable"]).optional().default("not_applicable"),
    sessionParticipation: z.enum(["active", "responsive", "passive", "resistant"]).optional().default("responsive"),
    therapyReadiness: z.enum(["high", "moderate", "developing", "low"]).optional().default("moderate")
  }).optional()
});

export interface ClientTagResult {
  success: boolean;
  clientId: string;
  tags: ClientTags;
  summary: string;
  quickTags: string[];
  error?: string;
}

export class ClientTagger {

  /**
   * Generate comprehensive tags for a client based on their therapy history
   */
  async generateClientTags(
    client: Client,
    progressNotes: ProgressNote[],
    treatmentPlan?: TreatmentPlan,
    sessions?: Session[]
  ): Promise<ClientTagResult> {
    const startTime = Date.now();

    try {
      console.log(`[Client Tagger] Analyzing client ${client.id} with ${progressNotes.length} notes`);

      if (progressNotes.length === 0) {
        return {
          success: false,
          clientId: client.id,
          tags: this.getEmptyTags(),
          summary: "No progress notes available for analysis",
          quickTags: [],
          error: "Insufficient data for client analysis"
        };
      }

      // Compile session content
      const sessionContent = this.compileSessionContent(progressNotes);
      const treatmentGoals = this.extractTreatmentGoals(treatmentPlan);
      const sessionStats = this.calculateSessionStats(progressNotes, sessions);

      // Generate comprehensive tags using AI
      const tags = await this.analyzeClientHistory(
        client,
        sessionContent,
        treatmentGoals,
        sessionStats
      );

      // Add metadata
      const fullTags: ClientTags = {
        ...tags,
        therapyTrajectory: {
          ...tags.therapyTrajectory,
          sessionCount: progressNotes.length,
          treatmentDuration: sessionStats.treatmentDuration
        },
        metadata: {
          lastUpdated: new Date().toISOString(),
          sessionsAnalyzed: progressNotes.length,
          confidenceScore: this.calculateConfidence(progressNotes.length),
          aiModel: "openai/anthropic"
        }
      };

      // Generate summary and quick tags
      const summary = this.generateClientSummary(fullTags);
      const quickTags = this.generateQuickTags(fullTags);

      const processingTime = Date.now() - startTime;
      console.log(`[Client Tagger] Generated comprehensive tags for client in ${processingTime}ms`);

      return {
        success: true,
        clientId: client.id,
        tags: fullTags,
        summary,
        quickTags
      };

    } catch (error) {
      console.error(`[Client Tagger] Error analyzing client:`, error);
      return {
        success: false,
        clientId: client.id,
        tags: this.getEmptyTags(),
        summary: "Error generating client analysis",
        quickTags: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Analyze client history using AI
   */
  private async analyzeClientHistory(
    client: Client,
    sessionContent: string,
    treatmentGoals: string[],
    sessionStats: { treatmentDuration: string; attendanceRate: number; avgSessionGap: number }
  ): Promise<Omit<ClientTags, 'metadata'>> {

    const prompt = `
You are an expert clinical psychologist conducting a comprehensive case review. Analyze this client's therapy history and generate detailed clinical tags.

CLIENT INFORMATION:
- Name: ${client.name}
- Status: ${client.status}
- Clinical Considerations: ${client.clinicalConsiderations?.join(', ') || 'None specified'}
- Preferred Modalities: ${client.preferredModalities?.join(', ') || 'None specified'}

TREATMENT DURATION: ${sessionStats.treatmentDuration}
ATTENDANCE RATE: ${Math.round(sessionStats.attendanceRate * 100)}%

TREATMENT GOALS:
${treatmentGoals.length > 0 ? treatmentGoals.map(g => `- ${g}`).join('\n') : 'No formal treatment goals documented'}

SESSION HISTORY (summarized):
${sessionContent.substring(0, 15000)}

Analyze this comprehensive therapy history and provide a JSON response with detailed clinical tags covering:

1. **therapyTrajectory**: Overall progress, therapy phase, primary gains, remaining challenges
2. **diagnosticInsights**: Primary presentation, symptom patterns with severity/trend, differential considerations
3. **treatmentResponse**: What's working, what's not, preferred modalities, optimal frequency
4. **recurringThemes**: Themes that appear across sessions with frequency and clinical significance
5. **riskProfile**: Current risk level, triggers, protective factors, safety plan status
6. **clientStrengths**: Internal strengths, external resources, mastered coping skills, support network
7. **goalProgress**: Status of each treatment goal with percent complete
8. **clinicalPatterns**: Attachment style, defense patterns, cognitive/behavioral/interpersonal patterns
9. **engagementProfile**: Overall engagement, attendance, homework compliance, session participation

Be thorough but precise. Base all observations on the documented session content.
`;

    try {
      const result = await aiRouter.chatJSON<z.infer<typeof clientTagsSchema>>(
        [{ role: "user", content: prompt }],
        clientTagsSchema,
        { maxTokens: 4000 }
      );

      // Apply defaults for any missing sections
      return {
        therapyTrajectory: {
          overallProgress: result?.therapyTrajectory?.overallProgress || "minimal_change",
          phase: result?.therapyTrajectory?.phase || "early",
          sessionCount: result?.therapyTrajectory?.sessionCount || 0,
          treatmentDuration: result?.therapyTrajectory?.treatmentDuration || "unknown",
          primaryGains: result?.therapyTrajectory?.primaryGains || [],
          remainingChallenges: result?.therapyTrajectory?.remainingChallenges || []
        },
        diagnosticInsights: {
          primaryPresentation: result?.diagnosticInsights?.primaryPresentation || [],
          symptomPatterns: (result?.diagnosticInsights?.symptomPatterns || []).map(sp => ({
            symptom: sp.symptom || "",
            severity: sp.severity || "moderate",
            trend: sp.trend || "stable"
          })),
          differentialConsiderations: result?.diagnosticInsights?.differentialConsiderations || [],
          comorbidityIndicators: result?.diagnosticInsights?.comorbidityIndicators || []
        },
        treatmentResponse: {
          respondingWellTo: result?.treatmentResponse?.respondingWellTo || [],
          limitedResponseTo: result?.treatmentResponse?.limitedResponseTo || [],
          preferredModalities: result?.treatmentResponse?.preferredModalities || [],
          optimalSessionFrequency: result?.treatmentResponse?.optimalSessionFrequency || "weekly",
          medicationConsiderations: result?.treatmentResponse?.medicationConsiderations
        },
        recurringThemes: (result?.recurringThemes || []).map(rt => ({
          theme: rt.theme || "",
          frequency: rt.frequency || "occasional",
          clinicalSignificance: rt.clinicalSignificance || "moderate",
          relatedTopics: rt.relatedTopics || []
        })),
        riskProfile: {
          currentLevel: result?.riskProfile?.currentLevel || "minimal",
          historicalPeaks: result?.riskProfile?.historicalPeaks || [],
          triggerPatterns: result?.riskProfile?.triggerPatterns || [],
          protectiveFactors: result?.riskProfile?.protectiveFactors || [],
          safetyPlanStatus: result?.riskProfile?.safetyPlanStatus || "not_applicable",
          crisisInterventions: result?.riskProfile?.crisisInterventions || 0
        },
        clientStrengths: {
          internalStrengths: result?.clientStrengths?.internalStrengths || [],
          externalResources: result?.clientStrengths?.externalResources || [],
          copingSkillsMastered: result?.clientStrengths?.copingSkillsMastered || [],
          resilienceFactors: result?.clientStrengths?.resilienceFactors || [],
          supportNetwork: result?.clientStrengths?.supportNetwork || "moderate"
        },
        goalProgress: (result?.goalProgress || []).map(gp => ({
          goalId: gp.goalId,
          description: gp.description || "",
          status: gp.status || "not_started",
          percentComplete: gp.percentComplete ?? 0,
          targetDate: gp.targetDate
        })),
        clinicalPatterns: {
          attachmentStyle: result?.clinicalPatterns?.attachmentStyle || "unknown",
          defensePatterns: result?.clinicalPatterns?.defensePatterns || [],
          cognitivePatterns: result?.clinicalPatterns?.cognitivePatterns || [],
          behavioralPatterns: result?.clinicalPatterns?.behavioralPatterns || [],
          interpersonalPatterns: result?.clinicalPatterns?.interpersonalPatterns || [],
          emotionalRegulationStyle: result?.clinicalPatterns?.emotionalRegulationStyle || "unknown"
        },
        engagementProfile: {
          overallEngagement: result?.engagementProfile?.overallEngagement || "engaged",
          attendancePattern: result?.engagementProfile?.attendancePattern || "consistent",
          homeworkCompliance: result?.engagementProfile?.homeworkCompliance || "not_applicable",
          sessionParticipation: result?.engagementProfile?.sessionParticipation || "responsive",
          therapyReadiness: result?.engagementProfile?.therapyReadiness || "moderate"
        }
      };
    } catch (error) {
      console.error("[Client Tagger] AI analysis failed:", error);
      throw error;
    }
  }

  /**
   * Compile session content for analysis
   */
  private compileSessionContent(notes: ProgressNote[]): string {
    const sortedNotes = notes
      .filter(n => n.content)
      .sort((a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime());

    return sortedNotes.map((note, index) => {
      const date = new Date(note.sessionDate).toLocaleDateString();
      const content = (note.content || "").substring(0, 1000);
      const tags = note.aiTags?.join(', ') || '';
      return `SESSION ${index + 1} (${date}):
${content}
Tags: ${tags}
Risk Level: ${note.riskLevel || 'not assessed'}
---`;
    }).join('\n\n');
  }

  /**
   * Extract treatment goals from treatment plan
   */
  private extractTreatmentGoals(plan?: TreatmentPlan): string[] {
    if (!plan || !plan.goals) return [];

    try {
      const goals = typeof plan.goals === 'string' ? JSON.parse(plan.goals) : plan.goals;
      if (Array.isArray(goals)) {
        return goals.map((g: any) => g.description || g.goal || String(g));
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Calculate session statistics
   */
  private calculateSessionStats(
    notes: ProgressNote[],
    sessions?: Session[]
  ): { treatmentDuration: string; attendanceRate: number; avgSessionGap: number } {
    if (notes.length === 0) {
      return { treatmentDuration: "0 days", attendanceRate: 1, avgSessionGap: 0 };
    }

    const dates = notes.map(n => new Date(n.sessionDate).getTime()).sort();
    const firstSession = dates[0];
    const lastSession = dates[dates.length - 1];
    const durationMs = lastSession - firstSession;
    const durationDays = Math.round(durationMs / (1000 * 60 * 60 * 24));

    let treatmentDuration: string;
    if (durationDays < 30) {
      treatmentDuration = `${durationDays} days`;
    } else if (durationDays < 365) {
      treatmentDuration = `${Math.round(durationDays / 30)} months`;
    } else {
      treatmentDuration = `${(durationDays / 365).toFixed(1)} years`;
    }

    // Calculate attendance rate
    const scheduledCount = sessions?.length || notes.length;
    const completedCount = sessions?.filter(s => s.status === 'completed').length || notes.length;
    const attendanceRate = scheduledCount > 0 ? completedCount / scheduledCount : 1;

    // Calculate average gap between sessions
    let totalGap = 0;
    for (let i = 1; i < dates.length; i++) {
      totalGap += dates[i] - dates[i - 1];
    }
    const avgSessionGap = dates.length > 1 ? totalGap / (dates.length - 1) / (1000 * 60 * 60 * 24) : 0;

    return { treatmentDuration, attendanceRate, avgSessionGap };
  }

  /**
   * Generate client summary narrative
   */
  private generateClientSummary(tags: ClientTags): string {
    const trajectory = tags.therapyTrajectory;
    const risk = tags.riskProfile;
    const engagement = tags.engagementProfile;

    let summary = `Client has been in therapy for ${trajectory.treatmentDuration} `;
    summary += `(${trajectory.sessionCount} sessions), currently in the ${trajectory.phase} phase. `;
    summary += `Overall progress: ${trajectory.overallProgress.replace(/_/g, ' ')}. `;

    if (trajectory.primaryGains.length > 0) {
      summary += `Key gains include: ${trajectory.primaryGains.slice(0, 3).join(', ')}. `;
    }

    summary += `Engagement level is ${engagement.overallEngagement.replace(/_/g, ' ')} `;
    summary += `with ${engagement.attendancePattern.replace(/_/g, ' ')} attendance. `;

    summary += `Current risk level: ${risk.currentLevel}. `;

    if (tags.clientStrengths.internalStrengths.length > 0) {
      summary += `Notable strengths: ${tags.clientStrengths.internalStrengths.slice(0, 3).join(', ')}.`;
    }

    return summary;
  }

  /**
   * Generate quick tags for UI display
   */
  private generateQuickTags(tags: ClientTags): string[] {
    const quickTags: string[] = [];

    // Progress
    quickTags.push(`progress:${tags.therapyTrajectory.overallProgress}`);
    quickTags.push(`phase:${tags.therapyTrajectory.phase}`);

    // Risk
    if (tags.riskProfile.currentLevel !== "minimal") {
      quickTags.push(`risk:${tags.riskProfile.currentLevel}`);
    }

    // Engagement
    quickTags.push(`engagement:${tags.engagementProfile.overallEngagement}`);

    // Primary presentations
    tags.diagnosticInsights.primaryPresentation.slice(0, 3).forEach(p => {
      quickTags.push(`dx:${p.toLowerCase().replace(/\s+/g, '_')}`);
    });

    // Effective treatments
    tags.treatmentResponse.respondingWellTo.slice(0, 2).forEach(t => {
      quickTags.push(`responds_to:${t.toLowerCase().replace(/\s+/g, '_')}`);
    });

    // Top recurring themes
    tags.recurringThemes
      .filter(t => t.clinicalSignificance === "high")
      .slice(0, 3)
      .forEach(t => {
        quickTags.push(`theme:${t.theme.toLowerCase().replace(/\s+/g, '_')}`);
      });

    // Strengths
    quickTags.push(`support:${tags.clientStrengths.supportNetwork}`);

    return quickTags;
  }

  /**
   * Calculate confidence based on data availability
   */
  private calculateConfidence(sessionCount: number): number {
    if (sessionCount < 3) return 0.3;
    if (sessionCount < 6) return 0.5;
    if (sessionCount < 12) return 0.7;
    if (sessionCount < 24) return 0.85;
    return 0.95;
  }

  /**
   * Get empty tags structure
   */
  private getEmptyTags(): ClientTags {
    return {
      therapyTrajectory: {
        overallProgress: "minimal_change",
        phase: "early",
        sessionCount: 0,
        treatmentDuration: "0 days",
        primaryGains: [],
        remainingChallenges: []
      },
      diagnosticInsights: {
        primaryPresentation: [],
        symptomPatterns: [],
        differentialConsiderations: [],
        comorbidityIndicators: []
      },
      treatmentResponse: {
        respondingWellTo: [],
        limitedResponseTo: [],
        preferredModalities: [],
        optimalSessionFrequency: "weekly"
      },
      recurringThemes: [],
      riskProfile: {
        currentLevel: "minimal",
        historicalPeaks: [],
        triggerPatterns: [],
        protectiveFactors: [],
        safetyPlanStatus: "not_applicable",
        crisisInterventions: 0
      },
      clientStrengths: {
        internalStrengths: [],
        externalResources: [],
        copingSkillsMastered: [],
        resilienceFactors: [],
        supportNetwork: "moderate"
      },
      goalProgress: [],
      clinicalPatterns: {
        attachmentStyle: "unknown",
        defensePatterns: [],
        cognitivePatterns: [],
        behavioralPatterns: [],
        interpersonalPatterns: [],
        emotionalRegulationStyle: "unknown"
      },
      engagementProfile: {
        overallEngagement: "engaged",
        attendancePattern: "consistent",
        homeworkCompliance: "not_applicable",
        sessionParticipation: "responsive",
        therapyReadiness: "moderate"
      },
      metadata: {
        lastUpdated: new Date().toISOString(),
        sessionsAnalyzed: 0,
        confidenceScore: 0,
        aiModel: "none"
      }
    };
  }

  /**
   * Get client progress report
   */
  async getClientProgressReport(
    client: Client,
    notes: ProgressNote[],
    treatmentPlan?: TreatmentPlan
  ): Promise<{
    progressSummary: string;
    keyMetrics: Record<string, any>;
    recommendations: string[];
    nextSteps: string[];
  }> {
    const tagResult = await this.generateClientTags(client, notes, treatmentPlan);

    if (!tagResult.success) {
      return {
        progressSummary: "Unable to generate progress report",
        keyMetrics: {},
        recommendations: [],
        nextSteps: []
      };
    }

    const tags = tagResult.tags;

    return {
      progressSummary: tagResult.summary,
      keyMetrics: {
        sessionsCompleted: tags.therapyTrajectory.sessionCount,
        treatmentDuration: tags.therapyTrajectory.treatmentDuration,
        overallProgress: tags.therapyTrajectory.overallProgress,
        therapyPhase: tags.therapyTrajectory.phase,
        riskLevel: tags.riskProfile.currentLevel,
        engagementLevel: tags.engagementProfile.overallEngagement,
        goalsAchieved: tags.goalProgress.filter(g => g.status === "achieved").length,
        goalsInProgress: tags.goalProgress.filter(g =>
          ["significant_progress", "moderate_progress"].includes(g.status)
        ).length
      },
      recommendations: [
        ...tags.treatmentResponse.respondingWellTo.map(t => `Continue ${t} interventions`),
        ...tags.therapyTrajectory.remainingChallenges.slice(0, 3).map(c => `Address: ${c}`)
      ],
      nextSteps: tags.goalProgress
        .filter(g => g.status !== "achieved" && g.status !== "discontinued")
        .slice(0, 5)
        .map(g => g.description)
    };
  }
}

// Export singleton instance
export const clientTagger = new ClientTagger();
