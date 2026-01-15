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
    const conditions = [eq(sessions.clientId, clientId)];

    if (startDate && endDate) {
      conditions.push(between(sessions.scheduledAt, startDate, endDate));
    }

    return await db
      .select({
        tags: sessionTags,
        sessionDate: sessions.scheduledAt,
      })
      .from(sessionTags)
      // session_tags.session_id is UUID, sessions.id is varchar; cast for join
      .innerJoin(sessions, sql`${sessionTags.sessionId}::text = ${sessions.id}`)
      .where(and(...conditions));
  }

  private async getSessionInsights(clientId: string, startDate?: Date, endDate?: Date) {
    const conditions = [eq(sessionInsights.clientId, clientId)];

    if (startDate && endDate) {
      conditions.push(between(sessionInsights.createdAt, startDate, endDate));
    }

    return await db
      .select()
      .from(sessionInsights)
      .where(and(...conditions))
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
