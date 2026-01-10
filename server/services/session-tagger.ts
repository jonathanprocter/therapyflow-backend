/**
 * Session Tagger Service
 * Ported from TherapyGenius - AI-powered per-session analysis
 * Generates mood state, engagement, risk factors, intervention effectiveness tags
 */

import { z } from "zod";
import { aiRouter } from "./ai-router";
import { storage } from "../storage";
import type { ProgressNote, Session, Client } from "@shared/schema";

// Session tag categories
export interface SessionTags {
  // Emotional state
  moodState: {
    primary: string; // e.g., "anxious", "depressed", "hopeful"
    secondary?: string[];
    intensity: number; // 1-10 scale
    trajectory: "improving" | "stable" | "declining" | "fluctuating";
  };

  // Client engagement
  engagement: {
    level: "high" | "moderate" | "low" | "resistant";
    indicators: string[];
    barriers?: string[];
  };

  // Risk assessment
  riskFactors: {
    level: "none" | "low" | "moderate" | "high" | "critical";
    factors: string[];
    protectiveFactors: string[];
    requiresFollowUp: boolean;
  };

  // Therapeutic work
  therapeuticContent: {
    primaryThemes: string[];
    interventionsUsed: string[];
    interventionEffectiveness: "highly_effective" | "effective" | "partially_effective" | "ineffective" | "unknown";
    clientInsights: string[];
    resistanceAreas?: string[];
  };

  // Progress indicators
  progressIndicators: {
    goalsAddressed: string[];
    progressMade: boolean;
    breakthroughs?: string[];
    setbacks?: string[];
    homeworkCompliance?: "full" | "partial" | "none" | "not_assigned";
  };

  // Session dynamics
  sessionDynamics: {
    rapportQuality: "strong" | "good" | "developing" | "strained";
    communicationStyle: string;
    emotionalRegulation: "well_regulated" | "some_difficulty" | "significant_difficulty";
    sessionFlow: "smooth" | "productive_challenges" | "disjointed";
  };

  // Metadata
  metadata: {
    confidence: number;
    analysisDate: string;
    aiModel: string;
    processingTime: number;
  };
}

// Schema for AI response validation - all fields optional to handle partial AI responses
const sessionTagsSchema = z.object({
  moodState: z.object({
    primary: z.string().optional().default("unknown"),
    secondary: z.array(z.string()).optional().default([]),
    intensity: z.number().min(1).max(10).optional().default(5),
    trajectory: z.enum(["improving", "stable", "declining", "fluctuating"]).optional().default("stable")
  }).optional(),
  engagement: z.object({
    level: z.enum(["high", "moderate", "low", "resistant"]).optional().default("moderate"),
    indicators: z.array(z.string()).optional().default([]),
    barriers: z.array(z.string()).optional().default([])
  }).optional(),
  riskFactors: z.object({
    level: z.enum(["none", "low", "moderate", "high", "critical"]).optional().default("none"),
    factors: z.array(z.string()).optional().default([]),
    protectiveFactors: z.array(z.string()).optional().default([]),
    requiresFollowUp: z.boolean().optional().default(false)
  }).optional(),
  therapeuticContent: z.object({
    primaryThemes: z.array(z.string()).optional().default([]),
    interventionsUsed: z.array(z.string()).optional().default([]),
    interventionEffectiveness: z.enum(["highly_effective", "effective", "partially_effective", "ineffective", "unknown"]).optional().default("unknown"),
    clientInsights: z.array(z.string()).optional().default([]),
    resistanceAreas: z.array(z.string()).optional().default([])
  }).optional(),
  progressIndicators: z.object({
    goalsAddressed: z.array(z.string()).optional().default([]),
    progressMade: z.boolean().optional().default(false),
    breakthroughs: z.array(z.string()).optional().default([]),
    setbacks: z.array(z.string()).optional().default([]),
    homeworkCompliance: z.enum(["full", "partial", "none", "not_assigned"]).optional().default("not_assigned")
  }).optional(),
  sessionDynamics: z.object({
    rapportQuality: z.enum(["strong", "good", "developing", "strained"]).optional().default("developing"),
    communicationStyle: z.string().optional().default("verbal"),
    emotionalRegulation: z.enum(["well_regulated", "some_difficulty", "significant_difficulty"]).optional().default("well_regulated"),
    sessionFlow: z.enum(["smooth", "productive_challenges", "disjointed"]).optional().default("smooth")
  }).optional()
});

export interface SessionTagResult {
  success: boolean;
  sessionId: string;
  noteId: string;
  tags: SessionTags;
  quickTags: string[]; // Simplified array for UI display
  error?: string;
}

export class SessionTagger {

  /**
   * Generate comprehensive tags for a session based on progress note
   */
  async generateSessionTags(
    note: ProgressNote,
    clientContext?: {
      name?: string;
      previousSessions?: ProgressNote[];
      treatmentGoals?: string[];
    }
  ): Promise<SessionTagResult> {
    const startTime = Date.now();

    try {
      if (!note.content) {
        throw new Error("Progress note has no content to analyze");
      }

      console.log(`[Session Tagger] Analyzing session note ${note.id}`);

      // Build context for analysis
      const contextInfo = this.buildContextPrompt(clientContext);

      // Generate tags using AI
      const tags = await this.analyzeSessionContent(note.content, contextInfo);

      // Generate quick tags for UI
      const quickTags = this.generateQuickTags(tags);

      const processingTime = Date.now() - startTime;

      // Add metadata
      const fullTags: SessionTags = {
        ...tags,
        metadata: {
          confidence: this.calculateConfidence(tags),
          analysisDate: new Date().toISOString(),
          aiModel: "openai/anthropic",
          processingTime
        }
      };

      console.log(`[Session Tagger] Generated ${quickTags.length} tags for session in ${processingTime}ms`);

      return {
        success: true,
        sessionId: note.sessionId || "",
        noteId: note.id,
        tags: fullTags,
        quickTags
      };

    } catch (error) {
      console.error(`[Session Tagger] Error analyzing session:`, error);
      return {
        success: false,
        sessionId: note.sessionId || "",
        noteId: note.id,
        tags: this.getEmptyTags(),
        quickTags: [],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Analyze session content using AI
   */
  private async analyzeSessionContent(
    content: string,
    contextInfo: string
  ): Promise<Omit<SessionTags, 'metadata'>> {

    const prompt = `
You are an expert clinical psychologist analyzing a therapy session. Based on the following progress note, generate comprehensive session tags.

${contextInfo}

SESSION CONTENT:
${content.substring(0, 8000)}

Analyze this session and provide a JSON response with these categories:

1. **moodState**: Client's emotional state
   - primary: Main mood (anxious, depressed, hopeful, angry, neutral, etc.)
   - secondary: Other notable emotions
   - intensity: 1-10 scale
   - trajectory: How mood compares to recent sessions

2. **engagement**: Client's participation level
   - level: high, moderate, low, or resistant
   - indicators: Specific behaviors showing engagement
   - barriers: What might be limiting engagement

3. **riskFactors**: Safety assessment
   - level: none, low, moderate, high, or critical
   - factors: Specific risk indicators
   - protectiveFactors: Strengths and supports
   - requiresFollowUp: Whether urgent follow-up needed

4. **therapeuticContent**: Session substance
   - primaryThemes: Main topics discussed
   - interventionsUsed: Therapeutic techniques applied
   - interventionEffectiveness: How well interventions worked
   - clientInsights: New realizations or awareness
   - resistanceAreas: Topics client avoids or resists

5. **progressIndicators**: Treatment progress
   - goalsAddressed: Which treatment goals were worked on
   - progressMade: Overall progress this session
   - breakthroughs: Significant positive moments
   - setbacks: Areas of concern or regression
   - homeworkCompliance: Status of between-session assignments

6. **sessionDynamics**: Therapeutic relationship
   - rapportQuality: Strength of working alliance
   - communicationStyle: How client expresses themselves
   - emotionalRegulation: Client's ability to manage emotions
   - sessionFlow: How smoothly the session progressed

Respond with ONLY valid JSON matching this structure.
`;

    try {
      const result = await aiRouter.chatJSON<z.infer<typeof sessionTagsSchema>>(
        [{ role: "user", content: prompt }],
        sessionTagsSchema
      );

      // Apply defaults for any missing sections
      return {
        moodState: {
          primary: result?.moodState?.primary || "unknown",
          secondary: result?.moodState?.secondary || [],
          intensity: result?.moodState?.intensity || 5,
          trajectory: result?.moodState?.trajectory || "stable"
        },
        engagement: {
          level: result?.engagement?.level || "moderate",
          indicators: result?.engagement?.indicators || [],
          barriers: result?.engagement?.barriers || []
        },
        riskFactors: {
          level: result?.riskFactors?.level || "none",
          factors: result?.riskFactors?.factors || [],
          protectiveFactors: result?.riskFactors?.protectiveFactors || [],
          requiresFollowUp: result?.riskFactors?.requiresFollowUp || false
        },
        therapeuticContent: {
          primaryThemes: result?.therapeuticContent?.primaryThemes || [],
          interventionsUsed: result?.therapeuticContent?.interventionsUsed || [],
          interventionEffectiveness: result?.therapeuticContent?.interventionEffectiveness || "unknown",
          clientInsights: result?.therapeuticContent?.clientInsights || [],
          resistanceAreas: result?.therapeuticContent?.resistanceAreas || []
        },
        progressIndicators: {
          goalsAddressed: result?.progressIndicators?.goalsAddressed || [],
          progressMade: result?.progressIndicators?.progressMade || false,
          breakthroughs: result?.progressIndicators?.breakthroughs || [],
          setbacks: result?.progressIndicators?.setbacks || [],
          homeworkCompliance: result?.progressIndicators?.homeworkCompliance || "not_assigned"
        },
        sessionDynamics: {
          rapportQuality: result?.sessionDynamics?.rapportQuality || "developing",
          communicationStyle: result?.sessionDynamics?.communicationStyle || "verbal",
          emotionalRegulation: result?.sessionDynamics?.emotionalRegulation || "well_regulated",
          sessionFlow: result?.sessionDynamics?.sessionFlow || "smooth"
        }
      };
    } catch (error) {
      console.error("[Session Tagger] AI analysis failed:", error);
      throw error;
    }
  }

  /**
   * Build context prompt from client history
   */
  private buildContextPrompt(context?: {
    name?: string;
    previousSessions?: ProgressNote[];
    treatmentGoals?: string[];
  }): string {
    if (!context) return "";

    let contextStr = "CONTEXT:\n";

    if (context.name) {
      contextStr += `Client: ${context.name}\n`;
    }

    if (context.treatmentGoals && context.treatmentGoals.length > 0) {
      contextStr += `Treatment Goals:\n${context.treatmentGoals.map(g => `- ${g}`).join('\n')}\n`;
    }

    if (context.previousSessions && context.previousSessions.length > 0) {
      contextStr += `\nRecent session summary (last ${context.previousSessions.length} sessions):\n`;
      context.previousSessions.slice(0, 3).forEach((note, i) => {
        const preview = (note.content || "").substring(0, 200);
        contextStr += `Session ${i + 1}: ${preview}...\n`;
      });
    }

    return contextStr + "\n";
  }

  /**
   * Generate quick tags for UI display
   */
  private generateQuickTags(tags: Omit<SessionTags, 'metadata'>): string[] {
    const quickTags: string[] = [];

    // Mood tags
    quickTags.push(`mood:${tags.moodState.primary}`);
    if (tags.moodState.trajectory !== "stable") {
      quickTags.push(`trend:${tags.moodState.trajectory}`);
    }

    // Engagement
    quickTags.push(`engagement:${tags.engagement.level}`);

    // Risk level (if not none)
    if (tags.riskFactors.level !== "none") {
      quickTags.push(`risk:${tags.riskFactors.level}`);
    }

    // Key themes (top 3)
    tags.therapeuticContent.primaryThemes.slice(0, 3).forEach(theme => {
      quickTags.push(`theme:${theme.toLowerCase().replace(/\s+/g, '_')}`);
    });

    // Interventions used
    tags.therapeuticContent.interventionsUsed.slice(0, 2).forEach(intervention => {
      quickTags.push(`intervention:${intervention.toLowerCase().replace(/\s+/g, '_')}`);
    });

    // Progress
    if (tags.progressIndicators.progressMade) {
      quickTags.push("progress:positive");
    }
    if (tags.progressIndicators.breakthroughs && tags.progressIndicators.breakthroughs.length > 0) {
      quickTags.push("breakthrough");
    }
    if (tags.progressIndicators.setbacks && tags.progressIndicators.setbacks.length > 0) {
      quickTags.push("setback");
    }

    // Rapport
    quickTags.push(`rapport:${tags.sessionDynamics.rapportQuality}`);

    return quickTags;
  }

  /**
   * Calculate overall confidence score
   */
  private calculateConfidence(tags: Omit<SessionTags, 'metadata'>): number {
    let score = 0.5; // Base confidence

    // More detail = higher confidence
    if (tags.therapeuticContent.primaryThemes.length > 0) score += 0.1;
    if (tags.therapeuticContent.interventionsUsed.length > 0) score += 0.1;
    if (tags.therapeuticContent.clientInsights.length > 0) score += 0.1;
    if (tags.riskFactors.protectiveFactors.length > 0) score += 0.1;
    if (tags.progressIndicators.goalsAddressed.length > 0) score += 0.1;

    return Math.min(score, 1.0);
  }

  /**
   * Get empty tags structure for error cases
   */
  private getEmptyTags(): SessionTags {
    return {
      moodState: {
        primary: "unknown",
        intensity: 5,
        trajectory: "stable"
      },
      engagement: {
        level: "moderate",
        indicators: []
      },
      riskFactors: {
        level: "none",
        factors: [],
        protectiveFactors: [],
        requiresFollowUp: false
      },
      therapeuticContent: {
        primaryThemes: [],
        interventionsUsed: [],
        interventionEffectiveness: "unknown",
        clientInsights: []
      },
      progressIndicators: {
        goalsAddressed: [],
        progressMade: false
      },
      sessionDynamics: {
        rapportQuality: "good",
        communicationStyle: "unknown",
        emotionalRegulation: "well_regulated",
        sessionFlow: "smooth"
      },
      metadata: {
        confidence: 0,
        analysisDate: new Date().toISOString(),
        aiModel: "none",
        processingTime: 0
      }
    };
  }

  /**
   * Analyze trends across multiple sessions
   */
  async analyzeSessionTrends(
    notes: ProgressNote[],
    clientId: string
  ): Promise<{
    moodTrend: { direction: string; avgIntensity: number };
    engagementTrend: string;
    commonThemes: string[];
    effectiveInterventions: string[];
    areasOfConcern: string[];
    progressSummary: string;
  }> {
    if (notes.length < 2) {
      return {
        moodTrend: { direction: "insufficient_data", avgIntensity: 5 },
        engagementTrend: "insufficient_data",
        commonThemes: [],
        effectiveInterventions: [],
        areasOfConcern: [],
        progressSummary: "Insufficient session data for trend analysis"
      };
    }

    // Aggregate content from recent notes
    const combinedContent = notes
      .slice(0, 10)
      .map(n => n.content || "")
      .join("\n\n---\n\n");

    const prompt = `
Analyze these ${notes.length} therapy sessions for trends and patterns.

SESSIONS:
${combinedContent.substring(0, 10000)}

Provide a JSON response with:
{
  "moodTrend": {
    "direction": "improving|stable|declining|variable",
    "avgIntensity": <1-10>
  },
  "engagementTrend": "increasing|stable|decreasing|variable",
  "commonThemes": ["theme1", "theme2", ...],
  "effectiveInterventions": ["intervention1", ...],
  "areasOfConcern": ["concern1", ...],
  "progressSummary": "Brief narrative summary of progress"
}
`;

    try {
      const result = await aiRouter.chatJSON([{ role: "user", content: prompt }]);
      return result as any;
    } catch (error) {
      console.error("[Session Tagger] Trend analysis failed:", error);
      return {
        moodTrend: { direction: "error", avgIntensity: 5 },
        engagementTrend: "error",
        commonThemes: [],
        effectiveInterventions: [],
        areasOfConcern: [],
        progressSummary: "Error analyzing session trends"
      };
    }
  }

  /**
   * Batch tag multiple sessions
   */
  async batchTagSessions(
    notes: ProgressNote[],
    clientContext?: { name?: string; treatmentGoals?: string[] }
  ): Promise<SessionTagResult[]> {
    const results: SessionTagResult[] = [];

    for (const note of notes) {
      const result = await this.generateSessionTags(note, clientContext);
      results.push(result);

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
  }
}

// Export singleton instance
export const sessionTagger = new SessionTagger();
