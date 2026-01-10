/**
 * Insights Aggregator Service
 * Ported from TherapyGenius - Aggregates AI insights across clients and sessions
 * Generates practice-wide analytics, patterns, and actionable insights
 */

import { z } from "zod";
import { aiRouter } from "./ai-router";
import { storage } from "../storage";
import { sessionTagger, type SessionTags } from "./session-tagger";
import { clientTagger, type ClientTags } from "./client-tagger";
import type { Client, ProgressNote, Session, AiInsight } from "@shared/schema";

// Insight types
export type InsightType =
  | "pattern_recognition"
  | "progress_milestone"
  | "risk_alert"
  | "resource_match"
  | "treatment_recommendation"
  | "engagement_alert"
  | "caseload_insight"
  | "outcome_trend";

export type InsightPriority = "low" | "medium" | "high" | "urgent";

export interface AggregatedInsight {
  id: string;
  type: InsightType;
  title: string;
  description: string;
  priority: InsightPriority;
  clientId?: string;
  clientName?: string;
  sessionId?: string;
  metadata: {
    confidence: number;
    generatedAt: string;
    dataPoints: number;
    expiresAt?: string;
    actionable: boolean;
    suggestedActions?: string[];
  };
  tags: string[];
}

export interface PracticeInsights {
  caseloadOverview: {
    totalActiveClients: number;
    averageProgress: string;
    clientsByPhase: Record<string, number>;
    clientsByRiskLevel: Record<string, number>;
    upcomingSessionsThisWeek: number;
  };
  trendAnalysis: {
    improvingClients: number;
    decliningClients: number;
    stableClients: number;
    commonThemes: string[];
    effectiveInterventions: string[];
  };
  alerts: AggregatedInsight[];
  recommendations: AggregatedInsight[];
}

export interface ClientInsightSummary {
  clientId: string;
  clientName: string;
  recentInsights: AggregatedInsight[];
  keyMetrics: {
    sessionCount: number;
    lastSessionDate: string;
    overallProgress: string;
    riskLevel: string;
    engagementLevel: string;
  };
  actionItems: string[];
}

export class InsightsAggregator {

  /**
   * Generate practice-wide insights for a therapist
   */
  async generatePracticeInsights(therapistId: string): Promise<PracticeInsights> {
    console.log(`[Insights Aggregator] Generating practice insights for therapist ${therapistId}`);

    try {
      // Get all active clients
      const clients = await storage.getClients(therapistId);
      const activeClients = clients.filter(c => c.status === "active");

      // Get upcoming sessions
      const upcomingSessions = await storage.getUpcomingSessions(therapistId);

      // Aggregate client data
      const clientInsights = await this.aggregateClientData(activeClients, therapistId);

      // Generate alerts
      const alerts = this.generateAlerts(clientInsights);

      // Generate recommendations
      const recommendations = await this.generatePracticeRecommendations(clientInsights, therapistId);

      return {
        caseloadOverview: {
          totalActiveClients: activeClients.length,
          averageProgress: this.calculateAverageProgress(clientInsights),
          clientsByPhase: this.groupByPhase(clientInsights),
          clientsByRiskLevel: this.groupByRiskLevel(clientInsights),
          upcomingSessionsThisWeek: upcomingSessions.length
        },
        trendAnalysis: {
          improvingClients: clientInsights.filter(c => c.progress === "improving").length,
          decliningClients: clientInsights.filter(c => c.progress === "declining").length,
          stableClients: clientInsights.filter(c => c.progress === "stable").length,
          commonThemes: this.extractCommonThemes(clientInsights),
          effectiveInterventions: this.extractEffectiveInterventions(clientInsights)
        },
        alerts,
        recommendations
      };
    } catch (error) {
      console.error(`[Insights Aggregator] Error generating practice insights:`, error);
      return {
        caseloadOverview: {
          totalActiveClients: 0,
          averageProgress: "unknown",
          clientsByPhase: {},
          clientsByRiskLevel: {},
          upcomingSessionsThisWeek: 0
        },
        trendAnalysis: {
          improvingClients: 0,
          decliningClients: 0,
          stableClients: 0,
          commonThemes: [],
          effectiveInterventions: []
        },
        alerts: [],
        recommendations: []
      };
    }
  }

  /**
   * Aggregate data for all clients
   */
  private async aggregateClientData(
    clients: Client[],
    therapistId: string
  ): Promise<Array<{
    client: Client;
    progress: string;
    riskLevel: string;
    phase: string;
    themes: string[];
    interventions: string[];
    lastSessionDate?: Date;
    sessionCount: number;
  }>> {
    const results = [];

    for (const client of clients) {
      try {
        const notes = await storage.getProgressNotes(client.id);

        if (notes.length === 0) {
          results.push({
            client,
            progress: "unknown",
            riskLevel: "unknown",
            phase: "early",
            themes: [],
            interventions: [],
            sessionCount: 0
          });
          continue;
        }

        // Get basic metrics from notes
        const latestNote = notes[0];
        const riskLevels = notes.map(n => n.riskLevel || "low");
        const highestRisk = this.getHighestRisk(riskLevels);

        // Determine progress trend
        const progress = this.determineProgressTrend(notes);

        // Extract themes and interventions from tags
        const allTags = notes.flatMap(n => [...(n.tags || []), ...(n.aiTags || [])]);
        const themes = this.extractThemesFromTags(allTags);
        const interventions = this.extractInterventionsFromTags(allTags);

        // Determine therapy phase based on session count
        const phase = this.determinePhase(notes.length);

        results.push({
          client,
          progress,
          riskLevel: highestRisk,
          phase,
          themes,
          interventions,
          lastSessionDate: latestNote.sessionDate,
          sessionCount: notes.length
        });
      } catch (error) {
        console.error(`[Insights Aggregator] Error processing client ${client.id}:`, error);
      }
    }

    return results;
  }

  /**
   * Generate alerts based on client data
   */
  private generateAlerts(
    clientData: Array<{
      client: Client;
      progress: string;
      riskLevel: string;
      phase: string;
      lastSessionDate?: Date;
      sessionCount: number;
    }>
  ): AggregatedInsight[] {
    const alerts: AggregatedInsight[] = [];
    const now = new Date();

    for (const data of clientData) {
      // High risk alert
      if (data.riskLevel === "high" || data.riskLevel === "critical") {
        alerts.push({
          id: `risk-${data.client.id}-${Date.now()}`,
          type: "risk_alert",
          title: `Elevated Risk: ${data.client.name}`,
          description: `${data.client.name} has been flagged with ${data.riskLevel} risk level. Review recent session notes and consider safety planning.`,
          priority: data.riskLevel === "critical" ? "urgent" : "high",
          clientId: data.client.id,
          clientName: data.client.name,
          metadata: {
            confidence: 0.9,
            generatedAt: now.toISOString(),
            dataPoints: data.sessionCount,
            actionable: true,
            suggestedActions: [
              "Review recent session notes",
              "Complete risk assessment",
              "Update safety plan if needed",
              "Consider increasing session frequency"
            ]
          },
          tags: ["risk", data.riskLevel, "safety"]
        });
      }

      // Declining progress alert
      if (data.progress === "declining") {
        alerts.push({
          id: `progress-${data.client.id}-${Date.now()}`,
          type: "engagement_alert",
          title: `Declining Progress: ${data.client.name}`,
          description: `${data.client.name} shows declining progress over recent sessions. Consider treatment plan review.`,
          priority: "medium",
          clientId: data.client.id,
          clientName: data.client.name,
          metadata: {
            confidence: 0.75,
            generatedAt: now.toISOString(),
            dataPoints: data.sessionCount,
            actionable: true,
            suggestedActions: [
              "Review treatment plan effectiveness",
              "Discuss progress with client",
              "Consider modifying interventions"
            ]
          },
          tags: ["progress", "declining", "treatment_review"]
        });
      }

      // No recent sessions alert
      if (data.lastSessionDate) {
        const daysSinceLastSession = Math.floor(
          (now.getTime() - new Date(data.lastSessionDate).getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceLastSession > 21 && data.client.status === "active") {
          alerts.push({
            id: `engagement-${data.client.id}-${Date.now()}`,
            type: "engagement_alert",
            title: `Engagement Gap: ${data.client.name}`,
            description: `${data.client.name} hasn't had a session in ${daysSinceLastSession} days. Consider outreach.`,
            priority: daysSinceLastSession > 30 ? "high" : "medium",
            clientId: data.client.id,
            clientName: data.client.name,
            metadata: {
              confidence: 0.95,
              generatedAt: now.toISOString(),
              dataPoints: data.sessionCount,
              actionable: true,
              suggestedActions: [
                "Reach out to client",
                "Review cancellation patterns",
                "Consider scheduling flexibility"
              ]
            },
            tags: ["engagement", "scheduling", "outreach"]
          });
        }
      }
    }

    // Sort by priority
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    return alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  /**
   * Generate practice-level recommendations
   */
  private async generatePracticeRecommendations(
    clientData: Array<{
      client: Client;
      progress: string;
      riskLevel: string;
      phase: string;
      themes: string[];
      interventions: string[];
      sessionCount: number;
    }>,
    therapistId: string
  ): Promise<AggregatedInsight[]> {
    const recommendations: AggregatedInsight[] = [];
    const now = new Date();

    // Caseload distribution recommendations
    const phaseDistribution = this.groupByPhase(clientData.map(d => ({
      ...d,
      client: d.client,
      lastSessionDate: undefined
    })));

    if (phaseDistribution["early"] > clientData.length * 0.5) {
      recommendations.push({
        id: `caseload-${Date.now()}`,
        type: "caseload_insight",
        title: "High proportion of early-phase clients",
        description: "Over 50% of your caseload is in the early therapy phase. Consider balancing intake with consolidation work.",
        priority: "low",
        metadata: {
          confidence: 0.8,
          generatedAt: now.toISOString(),
          dataPoints: clientData.length,
          actionable: true,
          suggestedActions: [
            "Review intake scheduling",
            "Ensure adequate time for early-phase engagement"
          ]
        },
        tags: ["caseload", "balance", "intake"]
      });
    }

    // Common themes pattern
    const allThemes = clientData.flatMap(d => d.themes);
    const themeFrequency = this.countFrequency(allThemes);
    const topThemes = Object.entries(themeFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([theme]) => theme);

    if (topThemes.length > 0) {
      recommendations.push({
        id: `themes-${Date.now()}`,
        type: "pattern_recognition",
        title: "Common themes across caseload",
        description: `Recurring themes in your practice: ${topThemes.join(', ')}. Consider developing specialized resources.`,
        priority: "low",
        metadata: {
          confidence: 0.7,
          generatedAt: now.toISOString(),
          dataPoints: allThemes.length,
          actionable: true,
          suggestedActions: topThemes.map(t => `Develop resources for: ${t}`)
        },
        tags: ["themes", "patterns", "specialization"]
      });
    }

    // Effective interventions insight
    const allInterventions = clientData.flatMap(d => d.interventions);
    const interventionFrequency = this.countFrequency(allInterventions);
    const topInterventions = Object.entries(interventionFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([intervention]) => intervention);

    if (topInterventions.length > 0) {
      recommendations.push({
        id: `interventions-${Date.now()}`,
        type: "treatment_recommendation",
        title: "Most utilized interventions",
        description: `Frequently used interventions: ${topInterventions.join(', ')}. Consider tracking outcomes by intervention type.`,
        priority: "low",
        metadata: {
          confidence: 0.75,
          generatedAt: now.toISOString(),
          dataPoints: allInterventions.length,
          actionable: false
        },
        tags: ["interventions", "tracking", "outcomes"]
      });
    }

    return recommendations;
  }

  /**
   * Generate insights for a specific client
   */
  async generateClientInsights(
    clientId: string,
    therapistId: string
  ): Promise<ClientInsightSummary> {
    const client = await storage.getClient(clientId);
    if (!client) {
      throw new Error(`Client ${clientId} not found`);
    }

    const notes = await storage.getProgressNotes(clientId);
    const sessions = await storage.getSessions(clientId);

    const insights: AggregatedInsight[] = [];
    const now = new Date();

    // Progress milestone detection
    if (notes.length > 0 && notes.length % 10 === 0) {
      insights.push({
        id: `milestone-${clientId}-${Date.now()}`,
        type: "progress_milestone",
        title: `Session Milestone: ${notes.length} sessions`,
        description: `${client.name} has completed ${notes.length} therapy sessions. Consider a progress review.`,
        priority: "low",
        clientId,
        clientName: client.name,
        metadata: {
          confidence: 1.0,
          generatedAt: now.toISOString(),
          dataPoints: notes.length,
          actionable: true,
          suggestedActions: ["Conduct formal progress review", "Update treatment goals if needed"]
        },
        tags: ["milestone", "progress", "review"]
      });
    }

    // Determine key metrics
    const latestNote = notes[0];
    const progress = this.determineProgressTrend(notes);
    const riskLevel = latestNote?.riskLevel || "unknown";

    // Engagement analysis
    const completedSessions = sessions.filter(s => s.status === "completed").length;
    const cancelledSessions = sessions.filter(s => s.status === "cancelled").length;
    const engagementRate = sessions.length > 0
      ? completedSessions / sessions.length
      : 1;

    let engagementLevel: string;
    if (engagementRate >= 0.9) engagementLevel = "high";
    else if (engagementRate >= 0.75) engagementLevel = "good";
    else if (engagementRate >= 0.5) engagementLevel = "moderate";
    else engagementLevel = "low";

    // Generate action items
    const actionItems: string[] = [];
    if (riskLevel === "high" || riskLevel === "moderate") {
      actionItems.push("Review and update safety plan");
    }
    if (progress === "declining") {
      actionItems.push("Review treatment plan effectiveness");
    }
    if (engagementLevel === "low") {
      actionItems.push("Address engagement barriers with client");
    }

    return {
      clientId,
      clientName: client.name,
      recentInsights: insights,
      keyMetrics: {
        sessionCount: notes.length,
        lastSessionDate: latestNote?.sessionDate?.toISOString() || "No sessions",
        overallProgress: progress,
        riskLevel,
        engagementLevel
      },
      actionItems
    };
  }

  /**
   * Save insight to database
   */
  async saveInsight(insight: AggregatedInsight, therapistId: string): Promise<AiInsight> {
    return await storage.createAiInsight({
      clientId: insight.clientId || null,
      therapistId,
      type: insight.type,
      title: insight.title,
      description: insight.description,
      priority: insight.priority,
      metadata: insight.metadata
    });
  }

  // Helper methods
  private getHighestRisk(riskLevels: string[]): string {
    const priority = ["critical", "high", "moderate", "low", "none", "unknown"];
    for (const level of priority) {
      if (riskLevels.includes(level)) return level;
    }
    return "unknown";
  }

  private determineProgressTrend(notes: ProgressNote[]): string {
    if (notes.length < 3) return "insufficient_data";

    const recentNotes = notes.slice(0, 5);
    const ratings = recentNotes
      .map(n => n.progressRating)
      .filter((r): r is number => r !== null && r !== undefined);

    if (ratings.length < 2) return "stable";

    const trend = ratings[0] - ratings[ratings.length - 1];
    if (trend > 1) return "improving";
    if (trend < -1) return "declining";
    return "stable";
  }

  private determinePhase(sessionCount: number): string {
    if (sessionCount < 4) return "early";
    if (sessionCount < 12) return "working";
    if (sessionCount < 24) return "consolidation";
    return "maintenance";
  }

  private extractThemesFromTags(tags: string[]): string[] {
    return tags
      .filter(t => t.startsWith("theme:"))
      .map(t => t.replace("theme:", ""));
  }

  private extractInterventionsFromTags(tags: string[]): string[] {
    return tags
      .filter(t => t.startsWith("intervention:"))
      .map(t => t.replace("intervention:", ""));
  }

  private calculateAverageProgress(data: Array<{ progress: string }>): string {
    const progressValues = data.map(d => {
      switch (d.progress) {
        case "improving": return 3;
        case "stable": return 2;
        case "declining": return 1;
        default: return 2;
      }
    });

    const avg = progressValues.reduce((a, b) => a + b, 0) / progressValues.length;
    if (avg >= 2.5) return "improving";
    if (avg >= 1.5) return "stable";
    return "declining";
  }

  private groupByPhase(data: Array<{ phase: string }>): Record<string, number> {
    return data.reduce((acc, d) => {
      acc[d.phase] = (acc[d.phase] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private groupByRiskLevel(data: Array<{ riskLevel: string }>): Record<string, number> {
    return data.reduce((acc, d) => {
      acc[d.riskLevel] = (acc[d.riskLevel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private extractCommonThemes(data: Array<{ themes: string[] }>): string[] {
    const allThemes = data.flatMap(d => d.themes);
    const frequency = this.countFrequency(allThemes);
    return Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([theme]) => theme);
  }

  private extractEffectiveInterventions(data: Array<{ interventions: string[] }>): string[] {
    const allInterventions = data.flatMap(d => d.interventions);
    const frequency = this.countFrequency(allInterventions);
    return Object.entries(frequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([intervention]) => intervention);
  }

  private countFrequency(items: string[]): Record<string, number> {
    return items.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}

// Export singleton instance
export const insightsAggregator = new InsightsAggregator();
