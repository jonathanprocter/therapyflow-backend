/**
 * Voice Notes Service
 * Handles voice note recording, transcription, and management
 */

import { db } from '../db.js';
import { voiceNotes } from '../../shared/voice-notes-schema.js';
import { clients, sessions } from '@shared/schema';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { logger } from './loggerService.js';
import { cacheService, CachePrefix, CacheTTL } from './cacheService.js';

interface CreateVoiceNoteOptions {
  therapistId: string;
  clientId: string;
  sessionId?: string;
  audioBuffer: Buffer;
  noteType?: 'follow_up' | 'reminder' | 'observation' | 'general';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  tags?: string[];
  metadata?: Record<string, any>;
}

interface DailySummary {
  date: string;
  totalNotes: number;
  byPriority: {
    urgent: VoiceNoteSummary[];
    high: VoiceNoteSummary[];
    normal: VoiceNoteSummary[];
    low: VoiceNoteSummary[];
  };
  byClient: Array<{
    clientId: string;
    clientName: string;
    notes: VoiceNoteSummary[];
  }>;
}

interface VoiceNoteSummary {
  id: string;
  clientName: string;
  transcription: string;
  noteType: string;
  priority: string;
  createdAt: Date;
  tags: string[];
}

export class VoiceNotesService {
  private openaiApiKey: string | undefined;

  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
  }

  /**
   * Create a new voice note with automatic transcription
   */
  async createVoiceNote(options: CreateVoiceNoteOptions): Promise<any> {
    const startTime = Date.now();

    try {
      // Transcribe audio using OpenAI Whisper
      const transcription = await this.transcribeAudio(options.audioBuffer);

      // Calculate duration (approximate from buffer size)
      const durationSeconds = Math.round(options.audioBuffer.length / 32000); // Rough estimate

      // Save audio file (in production, upload to S3 or similar)
      const audioUrl = await this.saveAudioFile(options.audioBuffer, options.therapistId);

      // Create voice note record
      const [voiceNote] = await db
        .insert(voiceNotes)
        .values({
          therapistId: options.therapistId,
          clientId: options.clientId,
          sessionId: options.sessionId,
          audioUrl,
          transcription,
          noteType: options.noteType || 'follow_up',
          priority: options.priority || 'normal',
          status: 'pending',
          tags: options.tags || [],
          durationSeconds,
          metadata: options.metadata || {}
        })
        .returning();

      // Clear cache for daily summary
      await this.clearDailySummaryCache(options.therapistId);

      const duration = Date.now() - startTime;
      logger.info('Voice note created', 'VoiceNotes', {
        voiceNoteId: voiceNote.id,
        therapistId: options.therapistId,
        clientId: options.clientId,
        duration
      });

      return voiceNote;
    } catch (error) {
      logger.error('Failed to create voice note', error as Error, 'VoiceNotes', {
        therapistId: options.therapistId,
        clientId: options.clientId
      });
      throw error;
    }
  }

  /**
   * Transcribe audio using OpenAI Whisper
   */
  private async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    if (!this.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const startTime = Date.now();

    try {
      const formData = new FormData();
      const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
      formData.append('file', audioBlob, 'voice-note.wav');
      formData.append('model', 'whisper-1');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.statusText}`);
      }

      const result = await response.json();
      const transcription = result.text;

      const duration = Date.now() - startTime;
      logger.ai('OpenAI Whisper', 'transcription', duration, {
        audioSize: audioBuffer.length,
        textLength: transcription.length
      });

      return transcription;
    } catch (error) {
      logger.error('Audio transcription failed', error as Error, 'VoiceNotes');
      throw error;
    }
  }

  /**
   * Save audio file (placeholder - implement S3 upload in production)
   */
  private async saveAudioFile(audioBuffer: Buffer, therapistId: string): Promise<string> {
    // In production, upload to S3 or similar storage
    // For now, return a placeholder URL
    const timestamp = Date.now();
    const filename = `voice-note-${therapistId}-${timestamp}.wav`;
    
    // TODO: Implement actual file upload
    // const s3Url = await uploadToS3(audioBuffer, filename);
    
    return `/audio/voice-notes/${filename}`;
  }

  /**
   * Get daily summary of voice notes
   */
  async getDailySummary(therapistId: string, date?: Date): Promise<DailySummary> {
    const targetDate = date || new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    // Try cache first
    const cacheKey = `${therapistId}:${dateStr}`;
    const cached = await cacheService.get<DailySummary>(cacheKey, {
      prefix: 'voice_notes_daily'
    });

    if (cached) {
      logger.cache('getDailySummary', cacheKey, true);
      return cached;
    }

    logger.cache('getDailySummary', cacheKey, false);

    try {
      // Get start and end of day
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Fetch all pending voice notes for the day
      const notes = await db
        .select({
          voiceNote: voiceNotes,
          client: clients
        })
        .from(voiceNotes)
        .innerJoin(clients, eq(voiceNotes.clientId, clients.id))
        .where(
          and(
            eq(voiceNotes.therapistId, therapistId),
            eq(voiceNotes.status, 'pending'),
            gte(voiceNotes.createdAt, startOfDay),
            lte(voiceNotes.createdAt, endOfDay)
          )
        )
        .orderBy(desc(voiceNotes.createdAt));

      // Organize by priority
      const byPriority = {
        urgent: [] as VoiceNoteSummary[],
        high: [] as VoiceNoteSummary[],
        normal: [] as VoiceNoteSummary[],
        low: [] as VoiceNoteSummary[]
      };

      // Organize by client
      const clientMap = new Map<string, VoiceNoteSummary[]>();

      notes.forEach(({ voiceNote, client }) => {
        const summary: VoiceNoteSummary = {
          id: voiceNote.id,
          clientName: client.name,
          transcription: voiceNote.transcription,
          noteType: voiceNote.noteType || 'follow_up',
          priority: voiceNote.priority || 'normal',
          createdAt: voiceNote.createdAt!,
          tags: voiceNote.tags || []
        };

        // Add to priority groups
        const priority = voiceNote.priority as 'urgent' | 'high' | 'normal' | 'low';
        byPriority[priority].push(summary);

        // Add to client groups
        if (!clientMap.has(client.id)) {
          clientMap.set(client.id, []);
        }
        clientMap.get(client.id)!.push(summary);
      });

      // Convert client map to array
      const byClient = Array.from(clientMap.entries()).map(([clientId, notes]) => ({
        clientId,
        clientName: notes[0].clientName,
        notes
      }));

      const summary: DailySummary = {
        date: dateStr,
        totalNotes: notes.length,
        byPriority,
        byClient
      };

      // Cache for 5 minutes
      await cacheService.set(cacheKey, summary, {
        prefix: 'voice_notes_daily',
        ttl: CacheTTL.MEDIUM
      });

      logger.info('Daily summary generated', 'VoiceNotes', {
        therapistId,
        date: dateStr,
        totalNotes: notes.length
      });

      return summary;
    } catch (error) {
      logger.error('Failed to get daily summary', error as Error, 'VoiceNotes', {
        therapistId,
        date: dateStr
      });
      throw error;
    }
  }

  /**
   * Get voice notes for a specific client
   */
  async getClientVoiceNotes(
    clientId: string,
    therapistId: string,
    options: {
      status?: string;
      limit?: number;
    } = {}
  ): Promise<any[]> {
    try {
      const conditions = [
        eq(voiceNotes.clientId, clientId),
        eq(voiceNotes.therapistId, therapistId)
      ];

      if (options.status) {
        conditions.push(eq(voiceNotes.status, options.status));
      }

      const notes = await db
        .select()
        .from(voiceNotes)
        .where(and(...conditions))
        .orderBy(desc(voiceNotes.createdAt))
        .limit(options.limit || 50);

      return notes;
    } catch (error) {
      logger.error('Failed to get client voice notes', error as Error, 'VoiceNotes', {
        clientId,
        therapistId
      });
      throw error;
    }
  }

  /**
   * Update voice note status
   */
  async updateVoiceNoteStatus(
    noteId: string,
    therapistId: string,
    status: 'pending' | 'reviewed' | 'completed' | 'archived'
  ): Promise<any> {
    try {
      const updateData: any = { status };

      if (status === 'reviewed') {
        updateData.reviewedAt = new Date();
      } else if (status === 'completed') {
        updateData.completedAt = new Date();
      }

      const [updated] = await db
        .update(voiceNotes)
        .set(updateData)
        .where(
          and(
            eq(voiceNotes.id, noteId),
            eq(voiceNotes.therapistId, therapistId)
          )
        )
        .returning();

      // Clear cache
      await this.clearDailySummaryCache(therapistId);

      logger.info('Voice note status updated', 'VoiceNotes', {
        noteId,
        status
      });

      return updated;
    } catch (error) {
      logger.error('Failed to update voice note status', error as Error, 'VoiceNotes', {
        noteId,
        status
      });
      throw error;
    }
  }

  /**
   * Delete voice note
   */
  async deleteVoiceNote(noteId: string, therapistId: string): Promise<void> {
    try {
      await db
        .delete(voiceNotes)
        .where(
          and(
            eq(voiceNotes.id, noteId),
            eq(voiceNotes.therapistId, therapistId)
          )
        );

      // Clear cache
      await this.clearDailySummaryCache(therapistId);

      logger.info('Voice note deleted', 'VoiceNotes', { noteId });
    } catch (error) {
      logger.error('Failed to delete voice note', error as Error, 'VoiceNotes', {
        noteId
      });
      throw error;
    }
  }

  /**
   * Export daily summary as formatted text
   */
  exportDailySummary(summary: DailySummary, format: 'markdown' | 'text' | 'json' = 'markdown'): string {
    if (format === 'json') {
      return JSON.stringify(summary, null, 2);
    }

    const lines: string[] = [];

    if (format === 'markdown') {
      lines.push(`# Voice Notes Summary - ${summary.date}`);
      lines.push('');
      lines.push(`**Total Notes:** ${summary.totalNotes}`);
      lines.push('');
    } else {
      lines.push(`Voice Notes Summary - ${summary.date}`);
      lines.push('='.repeat(50));
      lines.push(`Total Notes: ${summary.totalNotes}`);
      lines.push('');
    }

    // Urgent notes first
    if (summary.byPriority.urgent.length > 0) {
      lines.push(format === 'markdown' ? '## 🚨 URGENT' : 'URGENT:');
      summary.byPriority.urgent.forEach(note => {
        lines.push(`- **${note.clientName}**: ${note.transcription}`);
      });
      lines.push('');
    }

    // High priority
    if (summary.byPriority.high.length > 0) {
      lines.push(format === 'markdown' ? '## ⚠️  HIGH PRIORITY' : 'HIGH PRIORITY:');
      summary.byPriority.high.forEach(note => {
        lines.push(`- **${note.clientName}**: ${note.transcription}`);
      });
      lines.push('');
    }

    // By client
    if (summary.byClient.length > 0) {
      lines.push(format === 'markdown' ? '## 📋 By Client' : 'BY CLIENT:');
      summary.byClient.forEach(client => {
        lines.push(format === 'markdown' ? `### ${client.clientName}` : `\n${client.clientName}:`);
        client.notes.forEach(note => {
          const priorityEmoji = {
            urgent: '🚨',
            high: '⚠️ ',
            normal: '📝',
            low: '💡'
          }[note.priority] || '📝';
          
          lines.push(`- ${format === 'markdown' ? priorityEmoji : ''} ${note.transcription}`);
        });
        lines.push('');
      });
    }

    return lines.join('\n');
  }

  /**
   * Clear daily summary cache
   */
  private async clearDailySummaryCache(therapistId: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const cacheKey = `${therapistId}:${today}`;
      
      await cacheService.del(cacheKey, {
        prefix: 'voice_notes_daily'
      });
    } catch (error) {
      logger.error('Failed to clear daily summary cache', error as Error, 'VoiceNotes');
    }
  }
}

export const voiceNotesService = new VoiceNotesService();
