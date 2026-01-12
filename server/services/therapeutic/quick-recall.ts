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
        sessionDate: (r.item as any).sessionDate || (r.item as any).createdAt,
        relevance: 1 - (r.score || 0),
      })),
      relatedInsights: insights.slice(0, 5).map(i => i.insight),
      patterns: await this.findPatterns(clientId, query),
    };
  }

  private async searchProgressNotes(clientId: string, query: string) {
    // Sanitize query for safe LIKE pattern matching
    const sanitizedQuery = query.replace(/[%_\\]/g, '\\$&');
    const likePattern = `%${sanitizedQuery}%`;

    return await db
      .select()
      .from(progressNotes)
      .where(
        and(
          eq(progressNotes.clientId, clientId),
          or(
            like(progressNotes.content, likePattern),
            sql`${progressNotes.tags}::text ILIKE ${likePattern}`
          )
        )
      );
  }

  private async searchInsights(clientId: string, query: string) {
    // Sanitize query for safe LIKE pattern matching
    const sanitizedQuery = query.replace(/[%_\\]/g, '\\$&');
    const likePattern = `%${sanitizedQuery}%`;

    return await db
      .select()
      .from(sessionInsights)
      .where(
        and(
          eq(sessionInsights.clientId, clientId),
          like(sessionInsights.insight, likePattern)
        )
      );
  }

  private async searchTags(clientId: string, query: string) {
    // Sanitize query for safe LIKE pattern matching
    const sanitizedQuery = query.replace(/[%_\\]/g, '\\$&');
    const likePattern = `%${sanitizedQuery}%`;

    return await db
      .select()
      .from(sessionTags)
      .where(
        sql`${sessionTags.tags}::text ILIKE ${likePattern}`
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
    // Sanitize query for safe LIKE pattern matching
    const sanitizedQuery = query.replace(/[%_\\]/g, '\\$&');
    const likePattern = `%${sanitizedQuery}%`;

    const [result] = await db
      .select({ count: sql`count(*)::int` })
      .from(progressNotes)
      .where(
        and(
          eq(progressNotes.clientId, clientId),
          like(progressNotes.content, likePattern)
        )
      );

    return (result as any)?.count || 0;
  }

  private async getTimelineForQuery(clientId: string, query: string): Promise<Date[]> {
    // Sanitize query for safe LIKE pattern matching
    const sanitizedQuery = query.replace(/[%_\\]/g, '\\$&');
    const likePattern = `%${sanitizedQuery}%`;

    const notes = await db
      .select({ date: progressNotes.sessionDate })
      .from(progressNotes)
      .where(
        and(
          eq(progressNotes.clientId, clientId),
          like(progressNotes.content, likePattern)
        )
      )
      .orderBy(sql`${progressNotes.sessionDate} DESC`)
      .limit(10);

    return notes.map(n => n.date);
  }
}

export const quickRecall = new QuickRecallService();
