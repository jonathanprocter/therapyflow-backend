#!/bin/bash

# ========================================
# COMPLETE THERAPEUTIC JOURNEY SETUP
# ========================================

set -e

echo "🚀 Starting Complete Therapeutic Journey Setup..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install --save natural compromise sentiment fuse.js node-cache crypto-js date-fns lodash @types/lodash @types/natural p-queue ml-sentiment || true
npm install --save-dev @types/node tsx || true

# Create all directories
echo "📁 Creating directories..."
mkdir -p server/services/ai
mkdir -p server/services/therapeutic
mkdir -p server/utils
mkdir -p server/migrations
mkdir -p server/routes
mkdir -p shared/types
mkdir -p shared/constants
mkdir -p scripts

# Create schema extensions
echo "📝 Creating schema extensions..."
cat > shared/schema-extensions.ts << 'SCHEMA_END'
import { pgTable, text, jsonb, timestamp, boolean, integer, uuid, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const sessionTags = pgTable("session_tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").notNull(),
  category: text("category").notNull(),
  tags: jsonb("tags").notNull().$type<string[]>(),
  confidence: integer("confidence").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  sessionIdx: index("session_tags_session_idx").on(table.sessionId),
  categoryIdx: index("session_tags_category_idx").on(table.category),
}));

export const sessionInsights = pgTable("session_insights", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").notNull(),
  clientId: uuid("client_id").notNull(),
  therapistId: uuid("therapist_id").notNull(),
  insight: text("insight").notNull(),
  insightType: text("insight_type").notNull(),
  confidence: integer("confidence").default(0),
  relatedSessions: jsonb("related_sessions").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  clientIdx: index("session_insights_client_idx").on(table.clientId),
  typeIdx: index("session_insights_type_idx").on(table.insightType),
}));

export const journeySynthesis = pgTable("journey_synthesis", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientId: uuid("client_id").notNull(),
  therapistId: uuid("therapist_id").notNull(),
  synthesisDate: timestamp("synthesis_date").notNull(),
  timeRange: jsonb("time_range").$type<{ start: Date; end: Date }>(),
  dominantThemes: jsonb("dominant_themes").$type<Record<string, any>>(),
  emotionalTrajectory: jsonb("emotional_trajectory").$type<any[]>(),
  progressIndicators: jsonb("progress_indicators").$type<Record<string, any>>(),
  keyInsights: jsonb("key_insights").$type<string[]>(),
  copingStrategies: jsonb("coping_strategies").$type<Record<string, any>>(),
  recommendations: jsonb("recommendations").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  clientIdx: index("journey_synthesis_client_idx").on(table.clientId),
  dateIdx: index("journey_synthesis_date_idx").on(table.synthesisDate),
}));

export const sessionCrossReferences = pgTable("session_cross_references", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceSessionId: uuid("source_session_id").notNull(),
  targetSessionId: uuid("target_session_id").notNull(),
  referenceType: text("reference_type").notNull(),
  similarity: integer("similarity").default(0),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  sourceIdx: index("cross_ref_source_idx").on(table.sourceSessionId),
  targetIdx: index("cross_ref_target_idx").on(table.targetSessionId),
}));

export type SessionTag = typeof sessionTags.$inferSelect;
export type InsertSessionTag = typeof sessionTags.$inferInsert;
export type SessionInsight = typeof sessionInsights.$inferSelect;
export type InsertSessionInsight = typeof sessionInsights.$inferInsert;
export type JourneySynthesis = typeof journeySynthesis.$inferSelect;
export type InsertJourneySynthesis = typeof journeySynthesis.$inferInsert;
export type SessionCrossReference = typeof sessionCrossReferences.$inferSelect;
export type InsertSessionCrossReference = typeof sessionCrossReferences.$inferInsert;
SCHEMA_END

# Create auto-tagger service
echo "🏷️ Creating auto-tagger..."
cat > server/services/therapeutic/auto-tagger.ts << 'TAGGER_END'
import natural from 'natural';
import Sentiment from 'sentiment';
import { sessionTags, sessionInsights, type InsertSessionTag, type InsertSessionInsight } from '@shared/schema-extensions';
import { db } from '../../db';
import { eq } from 'drizzle-orm';

const sentiment = new Sentiment();
const tokenizer = new natural.WordTokenizer();

interface TagPattern {
  category: string;
  patterns: Record<string, RegExp>;
}

export class AutoTagger {
  private tagPatterns: TagPattern[] = [
    {
      category: 'emotions',
      patterns: {
        anxiety: /\b(anxious|worried|nervous|panic|fear|stressed|overwhelmed)\b/gi,
        depression: /\b(sad|depressed|hopeless|empty|numb|down|blue)\b/gi,
        anger: /\b(angry|frustrated|irritated|mad|furious|annoyed|resentful)\b/gi,
        joy: /\b(happy|joyful|excited|pleased|content|grateful|cheerful)\b/gi,
        grief: /\b(loss|mourning|bereaved|grieving|sorrow)\b/gi,
      }
    },
    {
      category: 'themes',
      patterns: {
        relationships: /\b(partner|spouse|friend|family|mother|father|child|parent|sibling)\b/gi,
        work: /\b(job|work|career|boss|colleague|office|workplace|employment)\b/gi,
        self_esteem: /\b(confidence|worth|value|inadequate|failure|self-image|identity)\b/gi,
        trauma: /\b(trauma|abuse|neglect|ptsd|flashback|trigger|assault)\b/gi,
        boundaries: /\b(boundaries|limits|saying no|assertive|space|autonomy)\b/gi,
        attachment: /\b(attachment|abandonment|connection|intimacy|trust)\b/gi,
      }
    },
    {
      category: 'coping_strategies',
      patterns: {
        mindfulness: /\b(breathing|meditation|present|aware|mindful|grounding)\b/gi,
        exercise: /\b(exercise|workout|walk|run|gym|physical|yoga)\b/gi,
        social_support: /\b(talked to|reached out|support|helped|connected with)\b/gi,
        journaling: /\b(journal|writing|wrote down|diary|reflection)\b/gi,
        therapy_techniques: /\b(cbt|dbt|emdr|thought challenging|reframing)\b/gi,
      }
    },
    {
      category: 'progress_indicators',
      patterns: {
        improvement: /\b(better|improved|progress|easier|managing|coping well)\b/gi,
        struggle: /\b(harder|difficult|struggling|worse|challenge|setback)\b/gi,
        breakthrough: /\b(realized|understood|discovered|insight|aha moment|clarity)\b/gi,
        stability: /\b(stable|consistent|maintaining|steady|balanced)\b/gi,
      }
    }
  ];

  async tagContent(
    content: string,
    sessionId: string,
    clientId: string,
    therapistId: string
  ): Promise<void> {
    const tags = this.extractTags(content);
    const insights = this.extractInsights(content);

    for (const [category, categoryTags] of Object.entries(tags)) {
      if (categoryTags.length > 0) {
        await db.insert(sessionTags).values({
          sessionId,
          category,
          tags: categoryTags,
          confidence: this.calculateConfidence(content, categoryTags),
        });
      }
    }

    for (const insight of insights) {
      await db.insert(sessionInsights).values({
        sessionId,
        clientId,
        therapistId,
        insight: insight.text,
        insightType: insight.type,
        confidence: insight.confidence,
      });
    }
  }

  private extractTags(content: string): Record<string, string[]> {
    const extractedTags: Record<string, string[]> = {};

    for (const { category, patterns } of this.tagPatterns) {
      const categoryTags = new Set<string>();

      for (const [tagName, pattern] of Object.entries(patterns)) {
        if (pattern.test(content)) {
          categoryTags.add(tagName);
        }
      }

      if (categoryTags.size > 0) {
        extractedTags[category] = Array.from(categoryTags);
      }
    }

    extractedTags.custom = this.extractCustomTags(content);
    return extractedTags;
  }

  private extractCustomTags(content: string): string[] {
    const customTags: string[] = [];

    const medPattern = /\b(?:taking|prescribed|medication|started)\s+(\w+(?:\s+\w+)?)/gi;
    const medications = content.match(medPattern) || [];
    medications.forEach(med => {
      const cleanMed = med.replace(/^(taking|prescribed|medication|started)\s+/i, '');
      customTags.push(`medication:${cleanMed.toLowerCase()}`);
    });

    const techniquePattern = /\b(?:tried|using|practicing|learned)\s+(\w+(?:\s+\w+)?)/gi;
    const techniques = content.match(techniquePattern) || [];
    techniques.slice(0, 3).forEach(tech => {
      const cleanTech = tech.replace(/^(tried|using|practicing|learned)\s+/i, '');
      customTags.push(`technique:${cleanTech.toLowerCase()}`);
    });

    return customTags;
  }

  private extractInsights(content: string): Array<{ text: string; type: string; confidence: number }> {
    const insights: Array<{ text: string; type: string; confidence: number }> = [];

    const insightPatterns = [
      { pattern: /I (?:realized|realize) that ([^.!?]+)[.!?]/gi, type: 'realization' },
      { pattern: /I (?:understand|understood) (?:now )?that ([^.!?]+)[.!?]/gi, type: 'understanding' },
      { pattern: /I(?:'ve| have) learned that ([^.!?]+)[.!?]/gi, type: 'learning' },
      { pattern: /The pattern I see is ([^.!?]+)[.!?]/gi, type: 'pattern' },
      { pattern: /I(?:'m| am) noticing that ([^.!?]+)[.!?]/gi, type: 'observation' },
    ];

    for (const { pattern, type } of insightPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        insights.push({
          text: match[1].trim(),
          type,
          confidence: 85,
        });
      }
    }

    return insights.slice(0, 5);
  }

  private analyzeSentiment(content: string): number {
    const result = sentiment.analyze(content);
    const maxScore = Math.max(Math.abs(result.score), 1);
    return result.score / maxScore;
  }

  private calculateConfidence(content: string, tags: string[]): number {
    const words = tokenizer.tokenize(content.toLowerCase());
    const wordCount = words.length;

    let matchCount = 0;
    for (const tag of tags) {
      const pattern = new RegExp(`\\b${tag}\\b`, 'gi');
      const matches = content.match(pattern);
      matchCount += matches ? matches.length : 0;
    }

    const confidence = Math.min(Math.round((matchCount / wordCount) * 1000 + 50), 100);
    return confidence;
  }
}

export const autoTagger = new AutoTagger();
TAGGER_END

# Create journey synthesizer
echo "🔄 Creating journey synthesizer..."
cat > server/services/therapeutic/journey-synthesizer.ts << 'SYNTH_END'
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
      .where(eq(sessions.clientId, clientId));

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
        tags.tags.forEach((theme: string) => {
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
        emotions: sessionTags.flatMap(t => t.tags.tags),
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

    const progressCounts = _.countBy(
      progressTags.flatMap(t => t.tags.tags)
    );

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
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10)
      .map(i => i.insight);
  }

  private analyzeCopingStrategies(tagsData: any[]): Record<string, any> {
    const copingTags = tagsData.filter(t => t.tags.category === 'coping_strategies');

    const strategyCounts = _.countBy(
      copingTags.flatMap(t => t.tags.tags)
    );

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
      tag.tags.tags.forEach((strategy: string) => {
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

    if (themes.some(t => t.tags.tags.includes('anxiety'))) {
      recommendations.push('Continue exploring anxiety management techniques');
    }

    if (progress.some(p => p.tags.tags.includes('breakthrough'))) {
      recommendations.push('Build on recent breakthroughs with consolidation exercises');
    }

    if (themes.some(t => t.tags.tags.includes('relationships'))) {
      recommendations.push('Focus on communication strategies in relationships');
    }

    return recommendations;
  }
}

export const journeySynthesizer = new JourneySynthesizer();
SYNTH_END

# Create quick recall service
echo "🔍 Creating quick recall..."
cat > server/services/therapeutic/quick-recall.ts << 'RECALL_END'
import Fuse from 'fuse.js';
import { db } from '../../db';
import { progressNotes } from '@shared/schema';
import { sessionInsights, sessionTags } from '@shared/schema-extensions';
import { eq, and, or, like, sql } from 'drizzle-orm';
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
          or(
            like(progressNotes.content, `%${query}%`),
            sql`${progressNotes.tags}::text ILIKE '%${query}%'`
          )
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
        sql`${sessionTags.tags}::text ILIKE '%${query}%'`
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
    const [result] = await db
      .select({ count: sql`count(*)::int` })
      .from(progressNotes)
      .where(
        and(
          eq(progressNotes.clientId, clientId),
          like(progressNotes.content, `%${query}%`)
        )
      );

    return (result as any)?.count || 0;
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
RECALL_END

# Create enhanced storage
echo "🔧 Creating enhanced storage..."
cat > server/storage-extensions.ts << 'STORAGE_END'
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
    const { sessionTags, sessions } = await import('@shared/schema-extensions');
    const { db } = await import('./db');
    const { eq, and } = await import('drizzle-orm');

    try {
      const conditions = [eq(sessions.clientId, clientId)];
      if (category) {
        conditions.push(eq(sessionTags.category, category));
      }

      const tags = await db
        .select()
        .from(sessionTags)
        .innerJoin(sessions, eq(sessionTags.sessionId, sessions.id))
        .where(and(...conditions));

      return tags;
    } catch (error) {
      console.error('Error getting session tags:', error);
      return [];
    }
  }
}

export const enhancedStorage = new EnhancedDatabaseStorage();
STORAGE_END

# Create API routes
echo "🌐 Creating API routes..."
cat > server/routes/therapeutic.ts << 'ROUTES_END'
import { Request, Response, Router } from 'express';
import { enhancedStorage } from '../storage-extensions';

const router = Router();

router.post('/synthesize/:clientId', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { startDate, endDate, focusTags } = req.body;
    const therapistId = (req as any).user?.id;

    if (!therapistId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const synthesis = await enhancedStorage.synthesizeClientJourney(
      clientId,
      therapistId,
      {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        focusTags,
      }
    );

    res.json({ success: true, synthesis });
  } catch (error) {
    console.error('Error synthesizing journey:', error);
    res.status(500).json({ success: false, error: 'Failed to synthesize journey' });
  }
});

router.post('/recall/:clientId', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { query } = req.body;
    const therapistId = (req as any).user?.id;

    if (!therapistId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const results = await enhancedStorage.quickRecall(
      therapistId,
      clientId,
      query
    );

    res.json({ success: true, results });
  } catch (error) {
    console.error('Error in quick recall:', error);
    res.status(500).json({ success: false, error: 'Failed to perform recall' });
  }
});

router.get('/insights/:clientId', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const therapistId = (req as any).user?.id;

    if (!therapistId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const insights = await enhancedStorage.getTherapeuticInsights(clientId);

    res.json({ success: true, insights });
  } catch (error) {
    console.error('Error getting insights:', error);
    res.status(500).json({ success: false, error: 'Failed to get insights' });
  }
});

router.get('/tags/:clientId', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { category } = req.query;
    const therapistId = (req as any).user?.id;

    if (!therapistId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const tags = await enhancedStorage.getSessionTags(
      clientId,
      category as string
    );

    res.json({ success: true, tags });
  } catch (error) {
    console.error('Error getting tags:', error);
    res.status(500).json({ success: false, error: 'Failed to get tags' });
  }
});

export default router;
ROUTES_END

# Create integration helper
echo "📝 Creating integration helper..."
cat > server/integrate-therapeutic.ts << 'INTEGRATE_END'
import { enhancedStorage } from './storage-extensions';
import therapeuticRoutes from './routes/therapeutic';

export function integrateTherapeuticFeatures(app: any) {
  (global as any).storage = enhancedStorage;
  app.use('/api/therapeutic', therapeuticRoutes);
  console.log('✅ Therapeutic features integrated');
  return {
    storage: enhancedStorage,
    routes: therapeuticRoutes
  };
}

export { enhancedStorage, therapeuticRoutes };
INTEGRATE_END

# Create database migration
echo "🗄️ Creating migration..."
cat > server/migrations/add-therapeutic-journey.sql << 'MIGRATION_END'
CREATE TABLE IF NOT EXISTS session_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  category TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]',
  confidence INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS session_tags_session_idx ON session_tags(session_id);
CREATE INDEX IF NOT EXISTS session_tags_category_idx ON session_tags(category);

CREATE TABLE IF NOT EXISTS session_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  client_id UUID NOT NULL,
  therapist_id UUID NOT NULL,
  insight TEXT NOT NULL,
  insight_type TEXT NOT NULL,
  confidence INTEGER DEFAULT 0,
  related_sessions JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS session_insights_client_idx ON session_insights(client_id);
CREATE INDEX IF NOT EXISTS session_insights_type_idx ON session_insights(insight_type);

CREATE TABLE IF NOT EXISTS journey_synthesis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  therapist_id UUID NOT NULL,
  synthesis_date TIMESTAMP NOT NULL,
  time_range JSONB,
  dominant_themes JSONB,
  emotional_trajectory JSONB,
  progress_indicators JSONB,
  key_insights JSONB,
  coping_strategies JSONB,
  recommendations JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS journey_synthesis_client_idx ON journey_synthesis(client_id);
CREATE INDEX IF NOT EXISTS journey_synthesis_date_idx ON journey_synthesis(synthesis_date);

CREATE TABLE IF NOT EXISTS session_cross_references (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_session_id UUID NOT NULL,
  target_session_id UUID NOT NULL,
  reference_type TEXT NOT NULL,
  similarity INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS cross_ref_source_idx ON session_cross_references(source_session_id);
CREATE INDEX IF NOT EXISTS cross_ref_target_idx ON session_cross_references(target_session_id);
MIGRATION_END

# Create test script
echo "🧪 Creating test script..."
cat > scripts/test-therapeutic.ts << 'TEST_END'
import { enhancedStorage } from '../server/storage-extensions';

async function testTherapeuticFeatures() {
  console.log('🧪 Testing Therapeutic Journey Features...\n');

  const testTherapistId = 'test-therapist-' + Date.now();
  const testClientId = 'test-client-' + Date.now();
  const testSessionId = 'test-session-' + Date.now();

  try {
    console.log('1️⃣ Testing Auto-Tagging...');
    const testNote = {
      clientId: testClientId,
      sessionId: testSessionId,
      therapistId: testTherapistId,
      sessionDate: new Date(),
      content: 'Today I felt anxious about work. My boss was frustrated with me. I tried breathing exercises and felt better. I realized that I need to set better boundaries.',
      status: 'completed' as const,
      tags: [],
      aiTags: [],
    };

    const createdNote = await enhancedStorage.createProgressNote(testNote);
    console.log('✅ Note created with ID:', createdNote.id);

    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('\n2️⃣ Testing Quick Recall...');
    const recallResults = await enhancedStorage.quickRecall(
      testTherapistId,
      testClientId,
      'anxiety'
    );
    console.log('✅ Quick recall completed');
    console.log('   Found', recallResults.directMatches.length, 'direct matches');
    console.log('   Found', recallResults.relatedInsights.length, 'related insights');

    console.log('\n3️⃣ Testing Journey Synthesis...');
    const synthesis = await enhancedStorage.synthesizeClientJourney(
      testClientId,
      testTherapistId
    );
    console.log('✅ Journey synthesis completed');
    console.log('   Dominant themes:', Object.keys(synthesis.dominantThemes.frequency || {}));
    console.log('   Key insights:', synthesis.keyInsights?.length || 0);
    console.log('   Recommendations:', synthesis.recommendations?.length || 0);

    console.log('\n4️⃣ Testing Get Insights...');
    const insights = await enhancedStorage.getTherapeuticInsights(testClientId);
    console.log('✅ Retrieved', insights.length, 'insights');

    console.log('\n✨ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

console.log('Starting therapeutic feature tests...\n');
testTherapeuticFeatures()
  .then(() => {
    console.log('\n✅ Test suite completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });
TEST_END

# Update package.json
echo "📦 Updating package.json..."
node -e "
const fs = require('fs');
const path = require('path');

try {
  const packagePath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

  packageJson.scripts = packageJson.scripts || {};
  packageJson.scripts['test:therapeutic'] = 'tsx scripts/test-therapeutic.ts';
  packageJson.scripts['migrate:therapeutic'] = 'psql \$DATABASE_URL < server/migrations/add-therapeutic-journey.sql';

  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log('✅ package.json updated');
} catch (error) {
  console.log('⚠️ Could not update package.json');
}
"

echo ""
echo "✅ ============================================"
echo "✅ COMPLETE SETUP FINISHED!"
echo "✅ ============================================"
echo ""
echo "To integrate, add to your server:"
echo ""
echo "import { integrateTherapeuticFeatures } from './server/integrate-therapeutic';"
echo "integrateTherapeuticFeatures(app);"
echo ""
echo "Then run: npm run migrate:therapeutic"
echo ""
echo "Test with: npm run test:therapeutic"
echo ""
echo "🎉 Done!"