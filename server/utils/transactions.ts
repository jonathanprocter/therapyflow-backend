import { db } from '../db';
import { clients, progressNotes, aiInsights, sessions, type InsertClient } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { ClinicalEncryption } from './encryption';
import { calculateNoteQuality } from './noteQuality';

/**
 * Safe transaction wrapper for clinical operations
 * CRITICAL: Use this for any operation that involves multiple related database writes
 */
export class ClinicalTransactions {
  /**
   * Create a new progress note with AI analysis (atomic operation)
   */
  static async createProgressNoteWithAnalysis(
    noteData: {
      clientId: string;
      content: string;
      sessionDate: Date;
      therapistId: string;
      sessionId?: string;
      tags?: string[];
      aiTags?: string[];
      riskLevel?: string;
      progressRating?: number;
    },
    aiAnalysis?: {
      insights: string[];
      tags: string[];
      riskFactors: string[];
      type?: string;
      title?: string;
      description?: string;
      priority?: string;
    }
  ) {
    return await db.transaction(async (tx) => {
      try {
        // 1. Verify client ownership first
        const clientCheck = await tx
          .select()
          .from(clients)
          .where(and(
            eq(clients.id, noteData.clientId),
            eq(clients.therapistId, noteData.therapistId)
          ))
          .limit(1);

        if (clientCheck.length === 0) {
          throw new Error('Client access denied');
        }

        // 2. Encrypt sensitive content
        const encryptedContent = ClinicalEncryption.encrypt(noteData.content);
        const quality = calculateNoteQuality(noteData.content);

        // 3. Insert progress note
        const [progressNote] = await tx
          .insert(progressNotes)
          .values({
            clientId: noteData.clientId,
            sessionId: noteData.sessionId,
            therapistId: noteData.therapistId,
            content: encryptedContent,
            sessionDate: noteData.sessionDate,
            tags: noteData.tags || [],
            aiTags: noteData.aiTags || [],
            riskLevel: noteData.riskLevel || 'low',
            progressRating: noteData.progressRating,
            qualityScore: quality.score,
            qualityFlags: quality.flags,
            status: 'completed',
            isPlaceholder: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        // 4. Insert AI analysis if provided
        let analysis = null;
        if (aiAnalysis) {
          [analysis] = await tx
            .insert(aiInsights)
            .values({
              clientId: noteData.clientId,
              therapistId: noteData.therapistId,
              type: aiAnalysis.type || 'progress_analysis',
              title: aiAnalysis.title || 'Progress Note Analysis',
              description: aiAnalysis.description || JSON.stringify({
                insights: aiAnalysis.insights,
                tags: aiAnalysis.tags,
                riskFactors: aiAnalysis.riskFactors
              }),
              priority: aiAnalysis.priority || 'medium',
              isRead: false,
              metadata: {
                progressNoteId: progressNote.id,
                analysisType: 'automated'
              },
              createdAt: new Date(),
            })
            .returning();
        }

        // 5. Update client last activity
        await tx
          .update(clients)
          .set({
            updatedAt: new Date(),
          })
          .where(eq(clients.id, noteData.clientId));

        return {
          progressNote,
          analysis,
          success: true,
        };
      } catch (error) {
        // Transaction will automatically rollback
        console.error('[TRANSACTION] Failed to create progress note:', error);
        throw error;
      }
    });
  }

  /**
   * Update client information safely
   */
  static async updateClientSafely(
    clientId: string,
    therapistId: string,
    updates: Partial<InsertClient>
  ) {
    return await db.transaction(async (tx) => {
      // 1. Verify ownership
      const clientCheck = await tx
        .select()
        .from(clients)
        .where(and(
          eq(clients.id, clientId),
          eq(clients.therapistId, therapistId)
        ))
        .limit(1);

      if (clientCheck.length === 0) {
        throw new Error('Client access denied');
      }

      // 2. Encrypt sensitive fields
      const encryptedUpdates: any = {
        ...updates,
        updatedAt: new Date(),
      };

      // Encrypt phone if provided
      if (updates.phone) {
        encryptedUpdates.phone = ClinicalEncryption.encrypt(updates.phone);
      }

      // Encrypt emergency contact if provided
      if (updates.emergencyContact) {
        encryptedUpdates.emergencyContact = JSON.parse(
          ClinicalEncryption.encrypt(JSON.stringify(updates.emergencyContact))
        );
      }

      // Encrypt insurance if provided
      if (updates.insurance) {
        encryptedUpdates.insurance = JSON.parse(
          ClinicalEncryption.encrypt(JSON.stringify(updates.insurance))
        );
      }

      // 3. Update client
      const [updatedClient] = await tx
        .update(clients)
        .set(encryptedUpdates)
        .where(eq(clients.id, clientId))
        .returning();

      return updatedClient;
    });
  }

  /**
   * Delete client and all related data (GDPR/data retention compliance)
   */
  static async deleteClientCompletely(
    clientId: string,
    therapistId: string
  ) {
    return await db.transaction(async (tx) => {
      // 1. Verify ownership
      const clientCheck = await tx
        .select()
        .from(clients)
        .where(and(
          eq(clients.id, clientId),
          eq(clients.therapistId, therapistId)
        ))
        .limit(1);

      if (clientCheck.length === 0) {
        throw new Error('Client access denied');
      }

      // 2. Delete in correct order (foreign key dependencies)
      
      // Delete AI insights first
      await tx
        .delete(aiInsights)
        .where(eq(aiInsights.clientId, clientId));

      // Delete progress notes
      await tx
        .delete(progressNotes)
        .where(eq(progressNotes.clientId, clientId));

      // Update sessions to remove client reference (keep for audit trail)
      await tx
        .update(sessions)
        .set({ 
          status: 'cancelled',
          notes: 'Client data deleted',
          updatedAt: new Date()
        })
        .where(eq(sessions.clientId, clientId));

      // Finally delete client
      await tx
        .delete(clients)
        .where(eq(clients.id, clientId));

      return { success: true, deletedClientId: clientId };
    });
  }

  /**
   * Soft delete client (recommended for audit compliance)
   */
  static async softDeleteClient(
    clientId: string,
    therapistId: string
  ) {
    return await db.transaction(async (tx) => {
      // 1. Verify ownership
      const clientCheck = await tx
        .select()
        .from(clients)
        .where(and(
          eq(clients.id, clientId),
          eq(clients.therapistId, therapistId)
        ))
        .limit(1);

      if (clientCheck.length === 0) {
        throw new Error('Client access denied');
      }

      // 2. Soft delete client
      const [updatedClient] = await tx
        .update(clients)
        .set({
          status: 'deleted',
          deletedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(clients.id, clientId))
        .returning();

      // 3. Cancel future sessions
      await tx
        .update(sessions)
        .set({
          status: 'cancelled',
          notes: 'Client deactivated',
          updatedAt: new Date()
        })
        .where(and(
          eq(sessions.clientId, clientId),
          eq(sessions.status, 'scheduled')
        ));

      return updatedClient;
    });
  }

  /**
   * Create session with progress note placeholder safely
   */
  static async createSessionWithPlaceholder(
    sessionData: {
      clientId: string;
      therapistId: string;
      scheduledAt: Date;
      duration?: number;
      sessionType: string;
      googleEventId?: string;
    }
  ) {
    return await db.transaction(async (tx) => {
      // 1. Verify client ownership
      const clientCheck = await tx
        .select()
        .from(clients)
        .where(and(
          eq(clients.id, sessionData.clientId),
          eq(clients.therapistId, sessionData.therapistId)
        ))
        .limit(1);

      if (clientCheck.length === 0) {
        throw new Error('Client access denied');
      }

      // 2. Create session
      const [session] = await tx
        .insert(sessions)
        .values({
          clientId: sessionData.clientId,
          therapistId: sessionData.therapistId,
          scheduledAt: sessionData.scheduledAt,
          duration: sessionData.duration || 50,
          sessionType: sessionData.sessionType,
          googleEventId: sessionData.googleEventId,
          status: 'scheduled',
          hasProgressNotePlaceholder: true,
          progressNoteStatus: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      // 3. Create progress note placeholder
      const [progressNote] = await tx
        .insert(progressNotes)
        .values({
          clientId: sessionData.clientId,
          sessionId: session.id,
          therapistId: sessionData.therapistId,
          sessionDate: sessionData.scheduledAt,
          content: null,
          status: 'placeholder',
          isPlaceholder: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return {
        session,
        progressNote,
        success: true,
      };
    });
  }
}
