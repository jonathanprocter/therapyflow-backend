import { db } from '../db';
import { progressNotes, clients } from '@shared/schema';
import { eq, sql, desc, and } from 'drizzle-orm';
import { ClinicalEncryption } from '../utils/encryption';

export interface SemanticSearchResult {
  noteId: string;
  clientId: string;
  clientName: string;
  content: string;
  sessionDate: Date;
  relevanceScore: number;
  matchType: 'semantic' | 'keyword' | 'tag';
  matchedTerms: string[];
  context: {
    previousNote?: string;
    nextNote?: string;
    therapeuticGoals?: string[];
  };
}

export interface SearchQuery {
  query: string;
  clientId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  tags?: string[];
  riskLevel?: string;
  therapistId: string;
}

/**
 * Advanced semantic search for clinical notes
 * Provides "second brain" functionality for therapists
 */
export class ClinicalSemanticSearch {
  
  /**
   * Perform comprehensive semantic search across all clinical notes
   */
  static async search(searchQuery: SearchQuery): Promise<SemanticSearchResult[]> {
    const results: SemanticSearchResult[] = [];
    
    try {
      // Try vector/semantic search first
      const semanticResults = await this.performSemanticSearch(searchQuery);
      results.push(...semanticResults);
      
      // If semantic search yields few results, supplement with keyword search
      if (semanticResults.length < 3) {
        const keywordResults = await this.performKeywordSearch(searchQuery);
        results.push(...keywordResults);
      }
      
      // Deduplicate and sort by relevance
      const uniqueResults = this.deduplicateResults(results);
      return uniqueResults.slice(0, 20); // Return top 20 results
      
    } catch (error) {
      console.error('[SEARCH] Semantic search failed, falling back to keyword search:', error);
      
      // Fallback to keyword search only
      return this.performKeywordSearch(searchQuery);
    }
  }

  /**
   * Find related notes based on content similarity
   */
  static async findRelatedNotes(
    noteId: string, 
    therapistId: string,
    limit: number = 5
  ): Promise<SemanticSearchResult[]> {
    try {
      // Get the source note
      const sourceNote = await db
        .select()
        .from(progressNotes)
        .where(and(
          eq(progressNotes.id, noteId),
          eq(progressNotes.therapistId, therapistId)
        ))
        .limit(1);

      if (sourceNote.length === 0) {
        return [];
      }

      const note = sourceNote[0];
      const decryptedContent = note.content ? ClinicalEncryption.decrypt(note.content) : '';

      // Use the note's content as a search query
      return this.search({
        query: decryptedContent,
        clientId: note.clientId,
        therapistId,
      });

    } catch (error) {
      console.error('[SEARCH] Failed to find related notes:', error);
      return [];
    }
  }

  /**
   * Track therapeutic progress patterns
   */
  static async findProgressPatterns(
    clientId: string,
    therapistId: string
  ): Promise<{
    improvementTrends: string[];
    challengePatterns: string[];
    goalEvolution: string[];
    riskFactorChanges: string[];
    therapeuticMilestones: Array<{
      date: Date;
      content: string;
      significance: string;
    }>;
  }> {
    // Limit notes to prevent memory issues with large client histories
    const MAX_NOTES_FOR_PATTERN_ANALYSIS = 100;

    try {
      // Get recent notes for client, ordered by date with limit
      const recentNotes = await db
        .select()
        .from(progressNotes)
        .where(and(
          eq(progressNotes.clientId, clientId),
          eq(progressNotes.therapistId, therapistId)
        ))
        .orderBy(desc(progressNotes.sessionDate))
        .limit(MAX_NOTES_FOR_PATTERN_ANALYSIS);

      // Decrypt content in batches to manage memory
      const decryptedNotes = recentNotes.map(note => ({
        ...note,
        content: note.content ? ClinicalEncryption.decrypt(note.content) : ''
      }));

      // Analyze patterns using keyword analysis (simplified version)
      const improvementTrends = this.extractPatterns(
        decryptedNotes,
        ['improvement', 'progress', 'better', 'positive', 'breakthrough', 'success']
      );

      const challengePatterns = this.extractPatterns(
        decryptedNotes,
        ['challenge', 'difficulty', 'struggle', 'setback', 'resistance', 'concern']
      );

      const goalEvolution = this.extractPatterns(
        decryptedNotes,
        ['goal', 'objective', 'target', 'aim', 'plan', 'intention']
      );

      const riskFactorChanges = this.extractPatterns(
        decryptedNotes,
        ['risk', 'danger', 'harm', 'suicidal', 'crisis', 'emergency']
      );

      // Identify therapeutic milestones
      const therapeuticMilestones = decryptedNotes
        .filter(note => {
          const content = note.content.toLowerCase();
          return content.includes('breakthrough') || 
                 content.includes('milestone') || 
                 content.includes('significant') ||
                 content.includes('major progress');
        })
        .map(note => ({
          date: note.sessionDate,
          content: this.extractSignificantSentence(note.content),
          significance: 'Therapeutic milestone identified'
        }))
        .slice(0, 5);

      return {
        improvementTrends,
        challengePatterns,
        goalEvolution,
        riskFactorChanges,
        therapeuticMilestones,
      };

    } catch (error) {
      console.error('[SEARCH] Failed to analyze progress patterns:', error);
      return {
        improvementTrends: [],
        challengePatterns: [],
        goalEvolution: [],
        riskFactorChanges: [],
        therapeuticMilestones: [],
      };
    }
  }

  /**
   * Perform semantic search using embeddings (when available)
   */
  private static async performSemanticSearch(searchQuery: SearchQuery): Promise<SemanticSearchResult[]> {
    // TODO: Implement vector search when pgvector is available
    // For now, use enhanced keyword search as semantic fallback
    return this.performKeywordSearch(searchQuery);
  }

  /**
   * Perform keyword-based search with clinical intelligence
   */
  private static async performKeywordSearch(searchQuery: SearchQuery): Promise<SemanticSearchResult[]> {
    try {
      let whereConditions = [eq(progressNotes.therapistId, searchQuery.therapistId)];

      // Apply client filter
      if (searchQuery.clientId) {
        whereConditions.push(eq(progressNotes.clientId, searchQuery.clientId));
      }

      // Apply date range filter
      if (searchQuery.dateRange) {
        whereConditions.push(sql`${progressNotes.sessionDate} >= ${searchQuery.dateRange.start}`);
        whereConditions.push(sql`${progressNotes.sessionDate} <= ${searchQuery.dateRange.end}`);
      }

      const results = await db
        .select({
          note: progressNotes,
          client: clients,
        })
        .from(progressNotes)
        .leftJoin(clients, eq(progressNotes.clientId, clients.id))
        .where(and(...whereConditions))
        .orderBy(desc(progressNotes.sessionDate))
        .limit(50);

      // Filter and score results based on content relevance
      const scoredResults: SemanticSearchResult[] = [];
      const searchTerms = this.extractSearchTerms(searchQuery.query);

      for (const result of results) {
        if (!result.note.content) continue;

        const decryptedContent = ClinicalEncryption.decrypt(result.note.content);
        const score = this.calculateRelevanceScore(decryptedContent, searchTerms, result.note.aiTags || []);

        if (score > 0.1) { // Minimum relevance threshold
          scoredResults.push({
            noteId: result.note.id,
            clientId: result.note.clientId,
            clientName: result.client?.name || 'Unknown Client',
            content: decryptedContent,
            sessionDate: result.note.sessionDate,
            relevanceScore: score,
            matchType: 'keyword',
            matchedTerms: this.findMatchedTerms(decryptedContent, searchTerms),
            context: {
              therapeuticGoals: [], // TODO: Get from client data
            },
          });
        }
      }

      return scoredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

    } catch (error) {
      console.error('[SEARCH] Keyword search failed:', error);
      return [];
    }
  }

  /**
   * Extract meaningful search terms from query
   */
  private static extractSearchTerms(query: string): string[] {
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(term => term.length > 2)
      .filter(term => !['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with'].includes(term));
  }

  /**
   * Calculate relevance score for content
   */
  private static calculateRelevanceScore(
    content: string, 
    searchTerms: string[], 
    aiTags: string[]
  ): number {
    const lowerContent = content.toLowerCase();
    let score = 0;

    // Exact phrase matches (highest weight)
    const fullQuery = searchTerms.join(' ');
    if (lowerContent.includes(fullQuery)) {
      score += 1.0;
    }

    // Individual term matches
    for (const term of searchTerms) {
      const termCount = (lowerContent.match(new RegExp(term, 'g')) || []).length;
      score += termCount * 0.3;
    }

    // AI tag matches
    for (const tag of aiTags) {
      if (searchTerms.some(term => tag.toLowerCase().includes(term))) {
        score += 0.5;
      }
    }

    // Normalize score by content length
    return Math.min(score / Math.sqrt(content.length / 100), 1.0);
  }

  /**
   * Find which terms matched in the content
   */
  private static findMatchedTerms(content: string, searchTerms: string[]): string[] {
    const lowerContent = content.toLowerCase();
    return searchTerms.filter(term => lowerContent.includes(term));
  }

  /**
   * Remove duplicate results
   */
  private static deduplicateResults(results: SemanticSearchResult[]): SemanticSearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      const key = result.noteId;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Extract patterns from notes based on keywords
   */
  private static extractPatterns(notes: any[], keywords: string[]): string[] {
    const patterns: string[] = [];
    
    for (const note of notes) {
      const content = note.content.toLowerCase();
      for (const keyword of keywords) {
        if (content.includes(keyword)) {
          // Extract sentence containing the keyword
          const sentences = note.content.split(/[.!?]+/);
          const matchingSentence = sentences.find((s: string) => 
            s.toLowerCase().includes(keyword)
          );
          if (matchingSentence) {
            patterns.push(matchingSentence.trim());
          }
        }
      }
    }

    // Return unique patterns, limited to 10
    return Array.from(new Set(patterns)).slice(0, 10);
  }

  /**
   * Extract the most significant sentence from content
   */
  private static extractSignificantSentence(content: string): string {
    const sentences = content.split(/[.!?]+/);
    
    // Look for sentences with significance indicators
    const significantSentence = sentences.find(s => {
      const lower = s.toLowerCase();
      return lower.includes('breakthrough') || 
             lower.includes('milestone') || 
             lower.includes('significant') ||
             lower.includes('major progress') ||
             lower.includes('important');
    });

    return significantSentence?.trim() || sentences[0]?.trim() || content.substring(0, 100);
  }
}