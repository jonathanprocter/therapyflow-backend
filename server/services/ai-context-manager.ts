/**
 * AI Context Manager
 * Provides comprehensive, contextually-aware data access for AI assistant
 */

import { db } from '../db.js';
import { 
  clients, 
  sessions, 
  progressNotes, 
  documents,
  treatmentPlans,
  allianceScores,
  caseConceptualizations
} from '@shared/schema';
import { 
  sessionInsights, 
  sessionTags, 
  journeySynthesis 
} from '@shared/schema-extensions';
import { eq, desc, and, gte, lte, sql } from 'drizzle-orm';
import { cacheService, CachePrefix, CacheTTL } from './cacheService.js';
import { logger } from './loggerService.js';

export interface ClientContext {
  client: any;
  recentSessions: any[];
  progressNotes: any[];
  therapeuticInsights: any[];
  treatmentPlan: any | null;
  goals: any[];
  allianceScores: any[];
  documents: any[];
  caseConceptualization: any | null;
  journeySynthesis: any[];
  sessionTags: any[];
  summary: string;
}

export interface ConversationContext {
  conversationId: string;
  therapistId: string;
  clientId?: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
  }>;
  context: {
    currentTopic?: string;
    referencedClients: string[];
    referencedSessions: string[];
    referencedDocuments: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export class AIContextManager {
  /**
   * Get comprehensive client context for AI
   */
  async getClientContext(
    clientId: string,
    therapistId: string,
    options: {
      includeNotes?: boolean;
      includeInsights?: boolean;
      includeTreatmentPlan?: boolean;
      includeDocuments?: boolean;
      daysBack?: number;
    } = {}
  ): Promise<ClientContext> {
    const {
      includeNotes = true,
      includeInsights = true,
      includeTreatmentPlan = true,
      includeDocuments = false,
      daysBack = 90
    } = options;

    // Try cache first
    const cacheKey = `${therapistId}:${clientId}:${daysBack}`;
    const cached = await cacheService.get<ClientContext>(cacheKey, {
      prefix: CachePrefix.THERAPEUTIC_INSIGHTS
    });

    if (cached) {
      logger.cache('getClientContext', cacheKey, true);
      return cached;
    }

    logger.cache('getClientContext', cacheKey, false);

    const startTime = Date.now();

    try {
      // Get client basic info
      const [client] = await db
        .select()
        .from(clients)
        .where(and(
          eq(clients.id, clientId),
          eq(clients.therapistId, therapistId)
        ))
        .limit(1);

      if (!client) {
        throw new Error('Client not found or access denied');
      }

      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - daysBack);

      // Fetch all data in parallel
      const [
        recentSessions,
        progressNotesData,
        therapeuticInsightsData,
        treatmentPlanData,
        allianceScoresData,
        documentsData,
        caseConceptData,
        journeySynthesisData,
        sessionTagsData
      ] = await Promise.all([
        // Recent sessions
        db
          .select()
          .from(sessions)
          .where(and(
            eq(sessions.clientId, clientId),
            gte(sessions.scheduledAt, dateThreshold)
          ))
          .orderBy(desc(sessions.scheduledAt))
          .limit(10),

        // Progress notes
        includeNotes
          ? db
              .select()
              .from(progressNotes)
              .where(and(
                eq(progressNotes.clientId, clientId),
                gte(progressNotes.sessionDate, dateThreshold)
              ))
              .orderBy(desc(progressNotes.sessionDate))
              .limit(20)
          : [],

        // Therapeutic insights
        includeInsights
          ? db
              .select()
              .from(sessionInsights)
              .where(and(
                eq(sessionInsights.clientId, clientId),
                eq(sessionInsights.therapistId, therapistId)
              ))
              .orderBy(desc(sessionInsights.createdAt))
              .limit(20)
          : [],

        // Treatment plan
        includeTreatmentPlan
          ? db
              .select()
              .from(treatmentPlans)
              .where(eq(treatmentPlans.clientId, clientId))
              .orderBy(desc(treatmentPlans.createdAt))
              .limit(1)
          : [],

        // Alliance scores
        db
          .select()
          .from(allianceScores)
          .where(and(
            eq(allianceScores.clientId, clientId),
            gte(allianceScores.sessionDate, dateThreshold)
          ))
          .orderBy(desc(allianceScores.sessionDate))
          .limit(10),

        // Documents
        includeDocuments
          ? db
              .select()
              .from(documents)
              .where(eq(documents.clientId, clientId))
              .orderBy(desc(documents.uploadedAt))
              .limit(10)
          : [],

        // Case conceptualization
        db
          .select()
          .from(caseConceptualizations)
          .where(eq(caseConceptualizations.clientId, clientId))
          .orderBy(desc(caseConceptualizations.createdAt))
          .limit(1),

        // Journey synthesis
        db
          .select()
          .from(journeySynthesis)
          .where(eq(journeySynthesis.clientId, clientId))
          .orderBy(desc(journeySynthesis.synthesisDate))
          .limit(5),

        // Session tags
        db
          .select()
          .from(sessionTags)
          .innerJoin(sessions, eq(sessionTags.sessionId, sessions.id))
          .where(eq(sessions.clientId, clientId))
          .orderBy(desc(sessions.scheduledAt))
          .limit(20)
      ]);

      // Generate context summary
      const summary = this.generateClientSummary({
        client,
        recentSessions,
        progressNotes: progressNotesData,
        therapeuticInsights: therapeuticInsightsData,
        treatmentPlan: treatmentPlanData[0] || null,
        allianceScores: allianceScoresData
      });

      const context: ClientContext = {
        client,
        recentSessions,
        progressNotes: progressNotesData,
        therapeuticInsights: therapeuticInsightsData,
        treatmentPlan: treatmentPlanData[0] || null,
        goals: treatmentPlanData[0]?.goals || [],
        allianceScores: allianceScoresData,
        documents: documentsData,
        caseConceptualization: caseConceptData[0] || null,
        journeySynthesis: journeySynthesisData,
        sessionTags: sessionTagsData.map(st => st.session_tags),
        summary
      };

      // Cache for 5 minutes
      await cacheService.set(cacheKey, context, {
        prefix: CachePrefix.THERAPEUTIC_INSIGHTS,
        ttl: CacheTTL.MEDIUM
      });

      const duration = Date.now() - startTime;
      logger.info(`Client context retrieved in ${duration}ms`, 'AIContext', {
        clientId,
        therapistId,
        daysBack,
        duration
      });

      return context;
    } catch (error) {
      logger.error('Failed to get client context', error as Error, 'AIContext', {
        clientId,
        therapistId
      });
      throw error;
    }
  }

  /**
   * Get multiple clients' context (for general queries)
   */
  async getMultipleClientsContext(
    therapistId: string,
    clientIds?: string[],
    limit: number = 10
  ): Promise<Array<{ clientId: string; summary: string }>> {
    try {
      let clientsToFetch: any[];

      if (clientIds && clientIds.length > 0) {
        // Fetch specific clients
        clientsToFetch = await db
          .select()
          .from(clients)
          .where(and(
            eq(clients.therapistId, therapistId),
            sql`${clients.id} = ANY(${clientIds})`
          ))
          .limit(limit);
      } else {
        // Fetch all active clients
        clientsToFetch = await db
          .select()
          .from(clients)
          .where(and(
            eq(clients.therapistId, therapistId),
            eq(clients.status, 'active')
          ))
          .orderBy(desc(clients.updatedAt))
          .limit(limit);
      }

      const summaries = await Promise.all(
        clientsToFetch.map(async (client) => {
          const context = await this.getClientContext(client.id, therapistId, {
            includeNotes: false,
            includeInsights: true,
            includeTreatmentPlan: true,
            includeDocuments: false,
            daysBack: 30
          });

          return {
            clientId: client.id,
            summary: context.summary
          };
        })
      );

      return summaries;
    } catch (error) {
      logger.error('Failed to get multiple clients context', error as Error, 'AIContext', {
        therapistId,
        clientIds
      });
      throw error;
    }
  }

  /**
   * Generate a concise summary of client context
   */
  private generateClientSummary(data: {
    client: any;
    recentSessions: any[];
    progressNotes: any[];
    therapeuticInsights: any[];
    treatmentPlan: any | null;
    allianceScores: any[];
  }): string {
    const { client, recentSessions, progressNotes, therapeuticInsights, treatmentPlan, allianceScores } = data;

    const parts: string[] = [];

    // Client basics
    parts.push(`${client.name} is a ${this.calculateAge(client.dateOfBirth)}-year-old client.`);

    // Recent activity
    if (recentSessions.length > 0) {
      const lastSession = recentSessions[0];
      const daysSince = Math.floor(
        (Date.now() - new Date(lastSession.scheduledAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      parts.push(`Last session was ${daysSince} days ago.`);
      parts.push(`Total of ${recentSessions.length} sessions in the past 90 days.`);
    }

    // Treatment plan
    if (treatmentPlan && treatmentPlan.goals) {
      const activeGoals = treatmentPlan.goals.filter((g: any) => g.status === 'active').length;
      parts.push(`Current treatment plan has ${activeGoals} active goals.`);
    }

    // Therapeutic alliance
    if (allianceScores.length > 0) {
      const avgScore = allianceScores.reduce((sum: number, s: any) => sum + s.score, 0) / allianceScores.length;
      parts.push(`Average therapeutic alliance score: ${avgScore.toFixed(1)}/10.`);
    }

    // Recent insights
    if (therapeuticInsights.length > 0) {
      const recentInsight = therapeuticInsights[0];
      parts.push(`Recent insight: "${recentInsight.insight.substring(0, 100)}..."`);
    }

    // Progress notes themes
    if (progressNotes.length > 0) {
      const themes = this.extractCommonThemes(progressNotes);
      if (themes.length > 0) {
        parts.push(`Common themes: ${themes.slice(0, 3).join(', ')}.`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Calculate age from date of birth
   */
  private calculateAge(dateOfBirth: Date | null): number {
    if (!dateOfBirth) return 0;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  /**
   * Extract common themes from progress notes
   */
  private extractCommonThemes(notes: any[]): string[] {
    const themeKeywords = [
      'anxiety', 'depression', 'stress', 'relationships', 'work', 'family',
      'trauma', 'grief', 'anger', 'self-esteem', 'boundaries', 'coping'
    ];

    const themeCounts: Record<string, number> = {};

    notes.forEach(note => {
      if (note.content) {
        const content = note.content.toLowerCase();
        themeKeywords.forEach(keyword => {
          if (content.includes(keyword)) {
            themeCounts[keyword] = (themeCounts[keyword] || 0) + 1;
          }
        });
      }
    });

    return Object.entries(themeCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([theme]) => theme);
  }

  /**
   * Search across all client data
   */
  async searchClientData(
    therapistId: string,
    query: string,
    options: {
      clientId?: string;
      includeNotes?: boolean;
      includeInsights?: boolean;
      limit?: number;
    } = {}
  ): Promise<any[]> {
    const {
      clientId,
      includeNotes = true,
      includeInsights = true,
      limit = 20
    } = options;

    try {
      const results: any[] = [];

      // Search progress notes (full-text search)
      if (includeNotes) {
        const noteConditions = [
          eq(progressNotes.therapistId, therapistId),
          sql`to_tsvector('english', ${progressNotes.content}) @@ plainto_tsquery('english', ${query})`
        ];

        if (clientId) {
          noteConditions.push(eq(progressNotes.clientId, clientId));
        }

        const noteResults = await db
          .select()
          .from(progressNotes)
          .where(and(...noteConditions))
          .orderBy(desc(progressNotes.sessionDate))
          .limit(limit);

        results.push(...noteResults.map(n => ({ type: 'progress_note', data: n })));
      }

      // Search insights
      if (includeInsights) {
        const insightConditions = [
          eq(sessionInsights.therapistId, therapistId),
          sql`${sessionInsights.insight} ILIKE ${'%' + query + '%'}`
        ];

        if (clientId) {
          insightConditions.push(eq(sessionInsights.clientId, clientId));
        }

        const insightResults = await db
          .select()
          .from(sessionInsights)
          .where(and(...insightConditions))
          .orderBy(desc(sessionInsights.createdAt))
          .limit(limit);

        results.push(...insightResults.map(i => ({ type: 'insight', data: i })));
      }

      return results;
    } catch (error) {
      logger.error('Failed to search client data', error as Error, 'AIContext', {
        therapistId,
        query
      });
      throw error;
    }
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(
    conversationId: string,
    limit: number = 50
  ): Promise<ConversationContext | null> {
    try {
      const cached = await cacheService.get<ConversationContext>(conversationId, {
        prefix: 'conversation'
      });

      return cached;
    } catch (error) {
      logger.error('Failed to get conversation history', error as Error, 'AIContext', {
        conversationId
      });
      return null;
    }
  }

  /**
   * Save conversation history
   */
  async saveConversationHistory(context: ConversationContext): Promise<void> {
    try {
      await cacheService.set(context.conversationId, context, {
        prefix: 'conversation',
        ttl: 3600 // 1 hour
      });
    } catch (error) {
      logger.error('Failed to save conversation history', error as Error, 'AIContext', {
        conversationId: context.conversationId
      });
    }
  }

  /**
   * Clear client context cache
   */
  async clearClientContextCache(clientId: string, therapistId: string): Promise<void> {
    try {
      await cacheService.delPattern(`${therapistId}:${clientId}:*`, {
        prefix: CachePrefix.THERAPEUTIC_INSIGHTS
      });

      logger.info('Client context cache cleared', 'AIContext', { clientId, therapistId });
    } catch (error) {
      logger.error('Failed to clear client context cache', error as Error, 'AIContext', {
        clientId,
        therapistId
      });
    }
  }
}

export const aiContextManager = new AIContextManager();
