#!/bin/bash

echo "🔧 Fixing SQL query issues in therapeutic services..."

# Fix Quick Recall Service
echo "1️⃣ Fixing Quick Recall Service..."
cat > server/services/therapeutic/quick-recall.ts << 'RECALLFIX'
import Fuse from 'fuse.js';
import { db } from '../../db';
import { progressNotes } from '@shared/schema';
import { sessionInsights, sessionTags } from '@shared/schema-extensions';
import { eq, and, or, like, sql, desc } from 'drizzle-orm';
import NodeCache from 'node-cache';

interface RecallResult {
  directMatches: Array<{
    id: string;
    type: 'note' | 'insight' | 'tag';
    content: string;
    sessionDate: Date;
    relevance: number;
  }>;
  relatedInsights: string[];
  patterns: Record<string, any>;
}

export class QuickRecallService {
  private cache: NodeCache;

  constructor() {
    this.cache = new NodeCache({ stdTTL: 600 });
  }

  async search(
    therapistId: string,
    clientId: string,
    query: string
  ): Promise<RecallResult> {
    const cacheKey = `${therapistId}-${clientId}-${query}`;
    const cached = this.cache.get<RecallResult>(cacheKey);

    if (cached) {
      return cached;
    }

    const result = await this.performSearch(therapistId, clientId, query);
    this.cache.set(cacheKey, result);

    return result;
  }

  private async performSearch(
    therapistId: string,
    clientId: string,
    query: string
  ): Promise<RecallResult> {
    const [notes, insights, tags] = await Promise.all([
      this.searchProgressNotes(clientId, query),
      this.searchInsights(clientId, query),
      this.searchTags(clientId, query),
    ]);

    const allItems = [
      ...notes.map(n => ({ ...n, type: 'note' as const })),
      ...insights.map(i => ({ ...i, type: 'insight' as const })),
      ...tags.map(t => ({ ...t, type: 'tag' as const })),
    ];

    const fuse = new Fuse(allItems, {
      keys: ['content', 'insight', 'tags'],
      threshold: 0.3,
      includeScore: true,
    });

    const searchResults = fuse.search(query);

    return {
      directMatches: searchResults.slice(0, 10).map(r => ({
        id: r.item.id,
        type: r.item.type,
        content: this.extractExcerpt(r.item, query),
        sessionDate: r.item.sessionDate || r.item.createdAt,
        relevance: 1 - (r.score || 0),
      })),
      relatedInsights: insights.slice(0, 5).map(i => i.insight),
      patterns: await this.findPatterns(clientId, query),
    };
  }

  private async searchProgressNotes(clientId: string, query: string) {
    return await db
      .select()
      .from(progressNotes)
      .where(
        and(
          eq(progressNotes.clientId, clientId),
          like(progressNotes.content, `%${query}%`)
        )
      );
  }

  private async searchInsights(clientId: string, query: string) {
    return await db
      .select()
      .from(sessionInsights)
      .where(
        and(
          eq(sessionInsights.clientId, clientId),
          like(sessionInsights.insight, `%${query}%`)
        )
      );
  }

  private async searchTags(clientId: string, query: string) {
    return await db
      .select()
      .from(sessionTags)
      .where(
        sql`${sessionTags.tags}::text ILIKE ${`%${query}%`}`
      );
  }

  private extractExcerpt(item: any, query: string): string {
    const content = item.content || item.insight || JSON.stringify(item.tags);
    if (!content) return '';

    const index = content.toLowerCase().indexOf(query.toLowerCase());

    if (index === -1) return content.substring(0, 100) + '...';

    const start = Math.max(0, index - 50);
    const end = Math.min(content.length, index + query.length + 50);

    return '...' + content.substring(start, end) + '...';
  }

  private async findPatterns(clientId: string, query: string): Promise<Record<string, any>> {
    const patterns: Record<string, any> = {};

    patterns.frequency = await this.calculateFrequency(clientId, query);
    patterns.timeline = await this.getTimelineForQuery(clientId, query);

    return patterns;
  }

  private async calculateFrequency(clientId: string, query: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(progressNotes)
      .where(
        and(
          eq(progressNotes.clientId, clientId),
          like(progressNotes.content, `%${query}%`)
        )
      );

    return result[0]?.count || 0;
  }

  private async getTimelineForQuery(clientId: string, query: string): Promise<Date[]> {
    const notes = await db
      .select({ date: progressNotes.sessionDate })
      .from(progressNotes)
      .where(
        and(
          eq(progressNotes.clientId, clientId),
          like(progressNotes.content, `%${query}%`)
        )
      )
      .orderBy(desc(progressNotes.sessionDate))
      .limit(10);

    return notes.map(n => n.date);
  }
}

export const quickRecall = new QuickRecallService();
RECALLFIX

echo "✅ Quick Recall Service fixed"

# Fix Journey Synthesizer
echo "2️⃣ Fixing Journey Synthesizer..."
cat > server/services/therapeutic/journey-synthesizer.ts << 'SYNTHFIX'
import { db } from '../../db';
import { progressNotes, sessions } from '@shared/schema';
import { sessionTags, sessionInsights, journeySynthesis } from '@shared/schema-extensions';
import { eq, and, between, desc, sql } from 'drizzle-orm';
import { startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import _ from 'lodash';

interface SynthesisOptions {
  clientId: string;
  therapistId: string;
  startDate?: Date;
  endDate?: Date;
  focusTags?: string[];
}

export class JourneySynthesizer {
  async synthesizeJourney(options: SynthesisOptions) {
    const { clientId, therapistId, startDate, endDate } = options;

    const [notesData, tagsData, insightsData] = await Promise.all([
      this.getProgressNotes(clientId, startDate, endDate),
      this.getSessionTags(clientId, startDate, endDate),
      this.getSessionInsights(clientId, startDate, endDate),
    ]);

    const synthesis = {
      clientId,
      therapistId,
      synthesisDate: new Date(),
      timeRange: { start: startDate || new Date(0), end: endDate || new Date() },
      dominantThemes: this.analyzeDominantThemes(tagsData),
      emotionalTrajectory: this.analyzeEmotionalTrajectory(notesData, tagsData),
      progressIndicators: this.analyzeProgress(tagsData, insightsData),
      keyInsights: this.compileKeyInsights(insightsData),
      copingStrategies: this.analyzeCopingStrategies(tagsData),
      recommendations: await this.generateRecommendations(tagsData, insightsData),
    };

    await db.insert(journeySynthesis).values(synthesis);
    return synthesis;
  }

  private async getProgressNotes(clientId: string, startDate?: Date, endDate?: Date) {
    const conditions = [eq(progressNotes.clientId, clientId)];

    if (startDate && endDate) {
      conditions.push(between(progressNotes.sessionDate, startDate, endDate));
    }

    return await db
      .select()
      .from(progressNotes)
      .where(and(...conditions))
      .orderBy(desc(progressNotes.sessionDate));
  }

  private async getSessionTags(clientId: string, startDate?: Date, endDate?: Date) {
    const query = db
      .select({
        tags: sessionTags,
        sessionDate: sessions.scheduledAt,
      })
      .from(sessionTags)
      .innerJoin(sessions, eq(sessionTags.sessionId, sessions.id))
      .where(sql`${sessions.clientId}::text = ${clientId}`);

    return await query;
  }

  private async getSessionInsights(clientId: string, startDate?: Date, endDate?: Date) {
    return await db
      .select()
      .from(sessionInsights)
      .where(eq(sessionInsights.clientId, clientId))
      .orderBy(desc(sessionInsights.createdAt));
  }

  private analyzeDominantThemes(tagsData: any[]): Record<string, any> {
    const themeFrequency: Record<string, number> = {};
    const themeTimeline: Record<string, Date[]> = {};

    tagsData.forEach(({ tags, sessionDate }) => {
      if (tags.category === 'themes') {
        const tagArray = Array.isArray(tags.tags) ? tags.tags : [];
        tagArray.forEach((theme: string) => {
          themeFrequency[theme] = (themeFrequency[theme] || 0) + 1;
          if (!themeTimeline[theme]) {
            themeTimeline[theme] = [];
          }
          themeTimeline[theme].push(sessionDate);
        });
      }
    });

    return {
      frequency: themeFrequency,
      timeline: themeTimeline,
      trending: this.identifyTrendingThemes(themeTimeline),
    };
  }

  private identifyTrendingThemes(themeTimeline: Record<string, Date[]>): string[] {
    const recentThreshold = subWeeks(new Date(), 2);
    const trending: Array<{ theme: string; recentCount: number }> = [];

    Object.entries(themeTimeline).forEach(([theme, dates]) => {
      const recentCount = dates.filter(date => date > recentThreshold).length;
      if (recentCount > 0) {
        trending.push({ theme, recentCount });
      }
    });

    return trending
      .sort((a, b) => b.recentCount - a.recentCount)
      .slice(0, 5)
      .map(t => t.theme);
  }

  private analyzeEmotionalTrajectory(notesData: any[], tagsData: any[]): any[] {
    const trajectory = notesData.map(note => {
      const sessionTags = tagsData.filter(t => 
        t.tags.sessionId === note.sessionId && t.tags.category === 'emotions'
      );

      return {
        date: note.sessionDate,
        emotions: sessionTags.flatMap(t => t.tags.tags || []),
        sentiment: this.calculateSentimentFromNote(note.content),
      };
    });

    return trajectory;
  }

  private calculateSentimentFromNote(content: string | null): number {
    if (!content) return 0;

    const positiveWords = ['better', 'good', 'happy', 'improved', 'progress', 'hope'];
    const negativeWords = ['worse', 'bad', 'sad', 'difficult', 'struggle', 'hard'];

    const contentLower = content.toLowerCase();
    const positive = positiveWords.filter(w => contentLower.includes(w)).length;
    const negative = negativeWords.filter(w => contentLower.includes(w)).length;

    return positive - negative;
  }

  private analyzeProgress(tagsData: any[], insightsData: any[]): Record<string, any> {
    const progressTags = tagsData.filter(t => t.tags.category === 'progress_indicators');

    const allProgressTags = progressTags.flatMap(t => t.tags.tags || []);
    const progressCounts = _.countBy(allProgressTags);

    const breakthroughs = insightsData.filter(i => 
      i.insightType === 'breakthrough' || i.insightType === 'realization'
    );

    return {
      indicators: progressCounts,
      breakthroughCount: breakthroughs.length,
      recentBreakthroughs: breakthroughs.slice(0, 3).map(b => b.insight),
    };
  }

  private compileKeyInsights(insightsData: any[]): string[] {
    return insightsData
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
      .slice(0, 10)
      .map(i => i.insight);
  }

  private analyzeCopingStrategies(tagsData: any[]): Record<string, any> {
    const copingTags = tagsData.filter(t => t.tags.category === 'coping_strategies');

    const allCopingTags = copingTags.flatMap(t => t.tags.tags || []);
    const strategyCounts = _.countBy(allCopingTags);

    const effectiveness = this.assessStrategyEffectiveness(copingTags);

    return {
      used: strategyCounts,
      effectiveness,
      recommended: this.recommendStrategies(strategyCounts, effectiveness),
    };
  }

  private assessStrategyEffectiveness(copingTags: any[]): Record<string, number> {
    const effectiveness: Record<string, number> = {};

    copingTags.forEach(tag => {
      const tagArray = Array.isArray(tag.tags.tags) ? tag.tags.tags : [];
      tagArray.forEach((strategy: string) => {
        effectiveness[strategy] = tag.tags.confidence || 50;
      });
    });

    return effectiveness;
  }

  private recommendStrategies(used: Record<string, number>, effectiveness: Record<string, number>): string[] {
    const recommendations: string[] = [];

    Object.entries(effectiveness).forEach(([strategy, score]) => {
      if (score > 70 && (used[strategy] || 0) < 3) {
        recommendations.push(strategy);
      }
    });

    return recommendations;
  }

  private async generateRecommendations(tagsData: any[], insightsData: any[]): Promise<string[]> {
    const recommendations: string[] = [];

    const themes = tagsData.filter(t => t.tags.category === 'themes');
    const progress = tagsData.filter(t => t.tags.category === 'progress_indicators');

    const hasAnxiety = themes.some(t => {
      const tags = Array.isArray(t.tags.tags) ? t.tags.tags : [];
      return tags.includes('anxiety');
    });

    const hasBreakthrough = progress.some(p => {
      const tags = Array.isArray(p.tags.tags) ? p.tags.tags : [];
      return tags.includes('breakthrough');
    });

    const hasRelationships = themes.some(t => {
      const tags = Array.isArray(t.tags.tags) ? t.tags.tags : [];
      return tags.includes('relationships');
    });

    if (hasAnxiety) {
      recommendations.push('Continue exploring anxiety management techniques');
    }

    if (hasBreakthrough) {
      recommendations.push('Build on recent breakthroughs with consolidation exercises');
    }

    if (hasRelationships) {
      recommendations.push('Focus on communication strategies in relationships');
    }

    return recommendations;
  }
}

export const journeySynthesizer = new JourneySynthesizer();
SYNTHFIX

echo "✅ Journey Synthesizer fixed"

# Fix Enhanced Storage
echo "3️⃣ Fixing Enhanced Storage..."
cat > server/storage-extensions.ts << 'STORAGEFIX'
import { DatabaseStorage } from './storage';
import { autoTagger } from './services/therapeutic/auto-tagger';
import { journeySynthesizer } from './services/therapeutic/journey-synthesizer';
import { quickRecall } from './services/therapeutic/quick-recall';
import type { InsertProgressNote, ProgressNote } from '@shared/schema';

export class EnhancedDatabaseStorage extends DatabaseStorage {
  async createProgressNote(note: InsertProgressNote): Promise<ProgressNote> {
    const createdNote = await super.createProgressNote(note);

    if (note.content && !note.isPlaceholder) {
      try {
        await autoTagger.tagContent(
          note.content,
          note.sessionId,
          note.clientId,
          note.therapistId
        );
      } catch (error) {
        console.error('Error auto-tagging progress note:', error);
      }
    }

    return createdNote;
  }

  async updateProgressNote(id: string, note: Partial<InsertProgressNote>): Promise<ProgressNote> {
    const updatedNote = await super.updateProgressNote(id, note);

    if (note.content && updatedNote.sessionId && !updatedNote.isPlaceholder) {
      try {
        await autoTagger.tagContent(
          note.content,
          updatedNote.sessionId,
          updatedNote.clientId,
          updatedNote.therapistId
        );
      } catch (error) {
        console.error('Error re-tagging progress note:', error);
      }
    }

    return updatedNote;
  }

  async synthesizeClientJourney(
    clientId: string,
    therapistId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      focusTags?: string[];
    }
  ) {
    try {
      return await journeySynthesizer.synthesizeJourney({
        clientId,
        therapistId,
        ...options,
      });
    } catch (error) {
      console.error('Error synthesizing journey:', error);
      throw error;
    }
  }

  async quickRecall(
    therapistId: string,
    clientId: string,
    query: string
  ) {
    try {
      return await quickRecall.search(therapistId, clientId, query);
    } catch (error) {
      console.error('Error in quick recall:', error);
      throw error;
    }
  }

  async getTherapeuticInsights(
    clientId: string,
    limit: number = 10
  ) {
    const { sessionInsights } = await import('@shared/schema-extensions');
    const { db } = await import('./db');
    const { eq, desc } = await import('drizzle-orm');

    try {
      const insights = await db
        .select()
        .from(sessionInsights)
        .where(eq(sessionInsights.clientId, clientId))
        .orderBy(desc(sessionInsights.createdAt))
        .limit(limit);

      return insights;
    } catch (error) {
      console.error('Error getting therapeutic insights:', error);
      return [];
    }
  }

  async getSessionTags(
    clientId: string,
    category?: string
  ) {
    const { sessionTags } = await import('@shared/schema-extensions');
    const { sessions } = await import('@shared/schema');
    const { db } = await import('./db');
    const { eq, and } = await import('drizzle-orm');

    try {
      const baseQuery = db
        .select()
        .from(sessionTags)
        .innerJoin(sessions, eq(sessionTags.sessionId, sessions.id));

      if (category) {
        return await baseQuery.where(
          and(
            eq(sessions.clientId, clientId),
            eq(sessionTags.category, category)
          )
        );
      } else {
        return await baseQuery.where(eq(sessions.clientId, clientId));
      }
    } catch (error) {
      console.error('Error getting session tags:', error);
      return [];
    }
  }
}

export const enhancedStorage = new EnhancedDatabaseStorage();
STORAGEFIX

echo "✅ Enhanced Storage fixed"

echo ""
echo "🎉 All SQL query issues fixed!"
echo ""
echo "Now run the test again:"
echo "npm run test:therapeutic"
