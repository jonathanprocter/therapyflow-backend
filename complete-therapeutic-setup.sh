#!/bin/bash

# ========================================
# Therapeutic Journey - Complete Setup Part 2
# ========================================

set -e

echo "🚀 Completing Therapeutic Journey Setup..."

# ========================================
# 1. Create Journey Synthesis Service
# ========================================
echo "🔄 Creating journey synthesis service..."

cat > server/services/therapeutic/journey-synthesizer.ts << 'EOF'
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

    // Get all relevant data
    const [notesData, tagsData, insightsData] = await Promise.all([
      this.getProgressNotes(clientId, startDate, endDate),
      this.getSessionTags(clientId, startDate, endDate),
      this.getSessionInsights(clientId, startDate, endDate),
    ]);

    // Analyze the data
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

    // Save synthesis
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
EOF

echo "✅ Journey synthesis service created"

# ========================================
# 2. Create Quick Recall Service
# ========================================
echo "🔍 Creating quick recall service..."

cat > server/services/therapeutic/quick-recall.ts << 'EOF'
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
    this.cache = new NodeCache({ stdTTL: 600 }); // 10 minute cache
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
EOF

echo "✅ Quick recall service created"

# ========================================
# 3. Create Enhanced Storage Extension
# ========================================
echo "🔧 Creating enhanced storage..."

cat > server/storage-extensions.ts << 'EOF'
import { DatabaseStorage } from './storage';
import { autoTagger } from './services/therapeutic/auto-tagger';
import { journeySynthesizer } from './services/therapeutic/journey-synthesizer';
import { quickRecall } from './services/therapeutic/quick-recall';
import type { InsertProgressNote, ProgressNote } from '@shared/schema';

export class EnhancedDatabaseStorage extends DatabaseStorage {
  // Override createProgressNote to add auto-tagging
  async createProgressNote(note: InsertProgressNote): Promise<ProgressNote> {
    const createdNote = await super.createProgressNote(note);

    // Auto-tag the content if not a placeholder
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
        // Don't fail the creation if tagging fails
      }
    }

    return createdNote;
  }

  // Override updateProgressNote to update tags
  async updateProgressNote(id: string, note: Partial<InsertProgressNote>): Promise<ProgressNote> {
    const updatedNote = await super.updateProgressNote(id, note);

    // Re-tag if content changed and not a placeholder
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

  // New method for journey synthesis
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

  // New method for quick recall
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

  // Get therapeutic insights for a client
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

  // Get session tags for a client
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
EOF

echo "✅ Enhanced storage created"

# ========================================
# 4. Create API Routes
# ========================================
echo "🌐 Creating API routes..."

cat > server/routes/therapeutic.ts << 'EOF'
import { Request, Response, Router } from 'express';
import { enhancedStorage } from '../storage-extensions';

const router = Router();

// Synthesize client journey
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

// Quick recall search
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

// Get therapeutic insights
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

// Get session tags
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
EOF

echo "✅ API routes created"

# ========================================
# 5. Create Test Script
# ========================================
echo "🧪 Creating test script..."

cat > scripts/test-therapeutic.ts << 'EOF'
import { enhancedStorage } from '../server/storage-extensions';

async function testTherapeuticFeatures() {
  console.log('🧪 Testing Therapeutic Journey Features...\n');

  const testTherapistId = 'test-therapist-' + Date.now();
  const testClientId = 'test-client-' + Date.now();
  const testSessionId = 'test-session-' + Date.now();

  try {
    // Test 1: Auto-tagging
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

    // Wait a moment for async tagging
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 2: Quick recall
    console.log('\n2️⃣ Testing Quick Recall...');
    const recallResults = await enhancedStorage.quickRecall(
      testTherapistId,
      testClientId,
      'anxiety'
    );
    console.log('✅ Quick recall completed');
    console.log('   Found', recallResults.directMatches.length, 'direct matches');
    console.log('   Found', recallResults.relatedInsights.length, 'related insights');

    // Test 3: Journey synthesis
    console.log('\n3️⃣ Testing Journey Synthesis...');
    const synthesis = await enhancedStorage.synthesizeClientJourney(
      testClientId,
      testTherapistId
    );
    console.log('✅ Journey synthesis completed');
    console.log('   Dominant themes:', Object.keys(synthesis.dominantThemes.frequency || {}));
    console.log('   Key insights:', synthesis.keyInsights?.length || 0);
    console.log('   Recommendations:', synthesis.recommendations?.length || 0);

    // Test 4: Get insights
    console.log('\n4️⃣ Testing Get Insights...');
    const insights = await enhancedStorage.getTherapeuticInsights(testClientId);
    console.log('✅ Retrieved', insights.length, 'insights');

    console.log('\n✨ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
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
EOF

echo "✅ Test script created"

# ========================================
# 6. Create Documentation
# ========================================
echo "📚 Creating documentation..."

cat > therapeutic-docs.md << 'EOF'
# Therapeutic Journey Enhancement Documentation

## Overview
The Therapeutic Journey Enhancement system provides intelligent auto-tagging, journey synthesis, and quick recall capabilities for therapy session management.

## Features

### 1. Auto-Tagging
Automatically extracts and categorizes content from progress notes:
- **Emotions**: anxiety, depression, anger, joy, grief
- **Themes**: relationships, work, self-esteem, trauma, boundaries
- **Coping Strategies**: mindfulness, exercise, social support, journaling
- **Progress Indicators**: improvement, struggle, breakthrough, stability

### 2. Journey Synthesis
Comprehensive analysis of a client's therapeutic journey:
- Dominant themes over time
- Emotional trajectory tracking
- Progress indicators and breakthroughs
- Coping strategy effectiveness
- AI-generated recommendations

### 3. Quick Recall
Instant search across all therapeutic data:
- Fuzzy search with relevance scoring
- Cross-reference related sessions
- Pattern detection
- Timeline visualization

## API Endpoints

### Synthesize Journey