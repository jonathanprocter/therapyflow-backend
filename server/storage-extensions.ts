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
      // Handle the case where clientId might be "recent" (invalid UUID)
      if (!clientId || clientId === 'recent' || clientId.length < 36) {
        console.warn('Invalid clientId provided:', clientId);
        return [];
      }

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
