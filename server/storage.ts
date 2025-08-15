import { 
  users, clients, sessions, progressNotes, caseConceptualizations, 
  treatmentPlans, allianceScores, documents, aiInsights, crossReferences,
  transcriptBatches, transcriptFiles,
  type User, type InsertUser, type Client, type InsertClient,
  type Session, type InsertSession, type ProgressNote, type InsertProgressNote,
  type CaseConceptualization, type InsertCaseConceptualization,
  type TreatmentPlan, type InsertTreatmentPlan,
  type AllianceScore, type InsertAllianceScore,
  type Document, type InsertDocument,
  type AiInsight, type InsertAiInsight,
  type TranscriptBatch, type InsertTranscriptBatch,
  type TranscriptFile, type InsertTranscriptFile
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, like, sql, isNull, ne } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Clients
  getClients(therapistId: string): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  getClientByName(name: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client>;
  deleteClient(id: string): Promise<void>;

  // Sessions
  getSessions(clientId: string): Promise<Session[]>;
  getAllHistoricalSessions(therapistId: string, includeCompleted?: boolean): Promise<Session[]>;
  getSessionsInDateRange(therapistId: string, startDate: Date, endDate: Date): Promise<Session[]>;
  getCompletedSessions(therapistId: string, clientId?: string): Promise<Session[]>;
  getUpcomingSessions(therapistId: string, date?: Date): Promise<Session[]>;
  getTodaysSessions(therapistId: string): Promise<Session[]>;
  getSession(id: string): Promise<Session | undefined>;
  getSessionByGoogleEventId(googleEventId: string): Promise<Session | undefined>;
  getRecentSessionsForClient(clientId: string, limit?: number): Promise<Session[]>;
  createSession(session: InsertSession): Promise<Session>;
  updateSession(id: string, session: Partial<InsertSession>): Promise<Session>;
  markPastSessionsAsCompleted(therapistId: string): Promise<number>;
  createProgressNotePlaceholdersForHistoricalSessions(therapistId: string): Promise<number>;
  getSessionsWithoutProgressNotes(therapistId: string): Promise<Session[]>;
  getSimplePracticeSessions(therapistId: string): Promise<Session[]>;

  // Progress Notes
  getProgressNotes(clientId: string): Promise<ProgressNote[]>;
  getRecentProgressNotes(therapistId: string, limit?: number): Promise<ProgressNote[]>;
  getProgressNote(id: string): Promise<ProgressNote | undefined>;
  getProgressNotesBySession(sessionId: string): Promise<ProgressNote[]>;
  createProgressNote(note: InsertProgressNote): Promise<ProgressNote>;
  updateProgressNote(id: string, note: Partial<InsertProgressNote>): Promise<ProgressNote>;
  deleteProgressNote(id: string): Promise<void>;
  searchProgressNotes(therapistId: string, query: string): Promise<ProgressNote[]>;
  getProgressNotesForManualReview(therapistId: string): Promise<ProgressNote[]>;
  getProgressNotePlaceholders(therapistId: string): Promise<ProgressNote[]>;
  createProgressNotePlaceholder(sessionId: string, clientId: string, therapistId: string, sessionDate: Date): Promise<ProgressNote>;

  // Case Conceptualizations
  getCaseConceptualization(clientId: string): Promise<CaseConceptualization | undefined>;
  createCaseConceptualization(conceptualization: InsertCaseConceptualization): Promise<CaseConceptualization>;
  updateCaseConceptualization(id: string, conceptualization: Partial<InsertCaseConceptualization>): Promise<CaseConceptualization>;

  // Treatment Plans
  getTreatmentPlan(clientId: string): Promise<TreatmentPlan | undefined>;
  getTreatmentPlanByClient(clientId: string): Promise<TreatmentPlan | undefined>;
  createTreatmentPlan(plan: InsertTreatmentPlan): Promise<TreatmentPlan>;
  updateTreatmentPlan(id: string, plan: Partial<InsertTreatmentPlan>): Promise<TreatmentPlan>;

  // Alliance Scores
  getAllianceScores(clientId: string): Promise<AllianceScore[]>;
  createAllianceScore(score: InsertAllianceScore): Promise<AllianceScore>;

  // Documents
  getDocuments(clientId: string): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, updates: Partial<InsertDocument>): Promise<Document>;
  getDocumentsByTherapist(therapistId: string): Promise<Document[]>;

  // AI Insights
  getAiInsights(therapistId: string, limit?: number): Promise<AiInsight[]>;
  createAiInsight(insight: InsertAiInsight): Promise<AiInsight>;
  markInsightAsRead(id: string): Promise<void>;

  // Transcript Batch Processing
  createTranscriptBatch(batch: InsertTranscriptBatch): Promise<TranscriptBatch>;
  getTranscriptBatch(id: string): Promise<TranscriptBatch | undefined>;
  getTranscriptBatches(therapistId: string): Promise<TranscriptBatch[]>;
  updateTranscriptBatch(id: string, updates: Partial<InsertTranscriptBatch>): Promise<TranscriptBatch>;
  
  // Transcript File Processing
  createTranscriptFile(file: InsertTranscriptFile): Promise<TranscriptFile>;
  getTranscriptFile(id: string): Promise<TranscriptFile | undefined>;
  getTranscriptFilesByBatch(batchId: string): Promise<TranscriptFile[]>;
  getTranscriptFilesForProcessing(therapistId: string, limit?: number): Promise<TranscriptFile[]>;
  getTranscriptFilesForReview(therapistId: string): Promise<TranscriptFile[]>;
  updateTranscriptFile(id: string, updates: Partial<InsertTranscriptFile>): Promise<TranscriptFile>;
  assignTranscriptToClient(fileId: string, clientId: string, sessionDate: Date, sessionType: string): Promise<TranscriptFile>;
  createProgressNoteFromTranscript(fileId: string): Promise<ProgressNote>;

  // Statistics
  getTherapistStats(therapistId: string): Promise<{
    activeClients: number;
    weeklySchedule: number;
    totalNotes: number;
    aiInsights: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getClients(therapistId: string): Promise<Client[]> {
    return await db
      .select()
      .from(clients)
      .where(eq(clients.therapistId, therapistId))
      .orderBy(desc(clients.createdAt));
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client || undefined;
  }

  async getClientByName(name: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.name, name));
    return client || undefined;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [newClient] = await db
      .insert(clients)
      .values(client)
      .returning();
    return newClient;
  }

  async updateClient(id: string, client: Partial<InsertClient>): Promise<Client> {
    const [updatedClient] = await db
      .update(clients)
      .set({ ...client, updatedAt: new Date() })
      .where(eq(clients.id, id))
      .returning();
    return updatedClient;
  }

  async deleteClient(id: string): Promise<void> {
    // Delete related data first (cascading delete)
    await db.delete(progressNotes).where(eq(progressNotes.clientId, id));
    await db.delete(sessions).where(eq(sessions.clientId, id));
    await db.delete(documents).where(eq(documents.clientId, id));
    await db.delete(treatmentPlans).where(eq(treatmentPlans.clientId, id));
    await db.delete(caseConceptualizations).where(eq(caseConceptualizations.clientId, id));
    await db.delete(allianceScores).where(eq(allianceScores.clientId, id));

    // Delete the client
    await db.delete(clients).where(eq(clients.id, id));
  }

  async getSessions(clientId: string): Promise<Session[]> {
    return await db
      .select()
      .from(sessions)
      .where(eq(sessions.clientId, clientId))
      .orderBy(desc(sessions.scheduledAt));
  }

  async getAllHistoricalSessions(therapistId: string, includeCompleted: boolean = true): Promise<Session[]> {
    const conditions = [eq(sessions.therapistId, therapistId)];

    if (!includeCompleted) {
      conditions.push(ne(sessions.status, "completed"));
    }

    return await db
      .select()
      .from(sessions)
      .where(and(...conditions))
      .orderBy(desc(sessions.scheduledAt));
  }

  async getSessionsInDateRange(therapistId: string, startDate: Date, endDate: Date): Promise<Session[]> {
    return await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.therapistId, therapistId),
          sql`${sessions.scheduledAt} >= ${startDate}`,
          sql`${sessions.scheduledAt} <= ${endDate}`
        )
      )
      .orderBy(sessions.scheduledAt);
  }

  async getSessionsByDate(therapistId: string, targetDate: Date): Promise<Session[]> {
    return await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.therapistId, therapistId),
          // Filter sessions for the specific date (in America/New_York timezone)
          sql`DATE(${sessions.scheduledAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York') = DATE(${targetDate} AT TIME ZONE 'America/New_York')`
        )
      )
      .orderBy(sessions.scheduledAt);
  }

  async getCompletedSessions(therapistId: string, clientId?: string): Promise<Session[]> {
    const conditions = [
      eq(sessions.therapistId, therapistId),
      eq(sessions.status, "completed")
    ];

    if (clientId) {
      conditions.push(eq(sessions.clientId, clientId));
    }

    return await db
      .select()
      .from(sessions)
      .where(and(...conditions))
      .orderBy(desc(sessions.scheduledAt));
  }

  async getUpcomingSessions(therapistId: string, date?: Date): Promise<Session[]> {
    const targetDate = date || new Date();

    return await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.therapistId, therapistId),
          eq(sessions.status, "scheduled"),
          // Only include SimplePractice therapy appointments
          eq(sessions.isSimplePracticeEvent, true),
          // Filter out non-therapy events like birthdays
          sql`${sessions.duration} < 1440`, // Exclude all-day events (1440 min = 24 hours)
          // Filter sessions for the specific date (in America/New_York timezone)
          sql`DATE(${sessions.scheduledAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York') >= DATE(${targetDate} AT TIME ZONE 'America/New_York')`
        )
      )
      .orderBy(sessions.scheduledAt);
  }

  async getTodaysSessions(therapistId: string): Promise<Session[]> {
    return await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.therapistId, therapistId),
          eq(sessions.status, "scheduled"),
          // Only include SimplePractice therapy appointments
          eq(sessions.isSimplePracticeEvent, true),
          // Filter out non-therapy events like birthdays
          sql`${sessions.duration} < 1440`, // Exclude all-day events (1440 min = 24 hours)
          // Filter sessions for today only - proper timezone conversion using America/New_York
          sql`DATE(${sessions.scheduledAt} AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York') = DATE(NOW() AT TIME ZONE 'America/New_York')`
        )
      )
      .orderBy(sessions.scheduledAt);
  }

  async getSession(id: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
    return session || undefined;
  }

  async getSessionByGoogleEventId(googleEventId: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.googleEventId, googleEventId));
    return session || undefined;
  }

  async getRecentSessionsForClient(clientId: string, limit: number = 5): Promise<Session[]> {
    return await db
      .select()
      .from(sessions)
      .where(eq(sessions.clientId, clientId))
      .orderBy(desc(sessions.scheduledAt))
      .limit(limit);
  }

  async createSession(session: InsertSession): Promise<Session> {
    const [newSession] = await db
      .insert(sessions)
      .values(session)
      .returning();
    return newSession;
  }

  async updateSession(id: string, session: Partial<InsertSession>): Promise<Session> {
    const [updatedSession] = await db
      .update(sessions)
      .set({ ...session, updatedAt: new Date() })
      .where(eq(sessions.id, id))
      .returning();
    return updatedSession;
  }

  async markPastSessionsAsCompleted(therapistId: string): Promise<number> {
    const now = new Date();

    const result = await db
      .update(sessions)
      .set({ 
        status: "completed",
        updatedAt: now
      })
      .where(
        and(
          eq(sessions.therapistId, therapistId),
          eq(sessions.status, "scheduled"),
          sql`${sessions.scheduledAt} < ${now}`
        )
      );

    return result.rowCount || 0;
  }

  async createProgressNotePlaceholdersForHistoricalSessions(therapistId: string): Promise<number> {
    // Get all completed sessions that don't have progress notes
    const sessionsWithoutNotes = await db
      .select({
        sessionId: sessions.id,
        clientId: sessions.clientId,
        scheduledAt: sessions.scheduledAt,
        therapistId: sessions.therapistId
      })
      .from(sessions)
      .leftJoin(progressNotes, eq(sessions.id, progressNotes.sessionId))
      .where(
        and(
          eq(sessions.therapistId, therapistId),
          eq(sessions.status, "completed"),
          isNull(progressNotes.id) // No existing progress note
        )
      );

    if (sessionsWithoutNotes.length === 0) {
      return 0;
    }

    // Create placeholder progress notes for these sessions
    const placeholderNotes = sessionsWithoutNotes.map(session => ({
      clientId: session.clientId,
      sessionId: session.sessionId,
      therapistId: session.therapistId,
      sessionDate: session.scheduledAt,
      content: null,
      status: "placeholder" as const,
      isPlaceholder: true,
      tags: [],
      aiTags: []
    }));

    await db.insert(progressNotes).values(placeholderNotes);

    return placeholderNotes.length;
  }

  async getProgressNotes(clientId: string): Promise<ProgressNote[]> {
    return await db
      .select()
      .from(progressNotes)
      .where(eq(progressNotes.clientId, clientId))
      .orderBy(desc(progressNotes.sessionDate));
  }

  async getRecentProgressNotes(therapistId: string, limit = 10): Promise<ProgressNote[]> {
    return await db
      .select()
      .from(progressNotes)
      .where(eq(progressNotes.therapistId, therapistId))
      .orderBy(desc(progressNotes.createdAt))
      .limit(limit);
  }

  async getProgressNote(id: string): Promise<ProgressNote | undefined> {
    const [note] = await db.select().from(progressNotes).where(eq(progressNotes.id, id));
    return note || undefined;
  }

  async getProgressNotesBySession(sessionId: string): Promise<ProgressNote[]> {
    return await db
      .select()
      .from(progressNotes)
      .where(eq(progressNotes.sessionId, sessionId))
      .orderBy(desc(progressNotes.createdAt));
  }

  async createProgressNote(note: InsertProgressNote): Promise<ProgressNote> {
    const [newNote] = await db
      .insert(progressNotes)
      .values(note)
      .returning();
    return newNote;
  }

  async updateProgressNote(id: string, note: Partial<InsertProgressNote>): Promise<ProgressNote> {
    const [updatedNote] = await db
      .update(progressNotes)
      .set({ ...note, updatedAt: new Date() })
      .where(eq(progressNotes.id, id))
      .returning();
    return updatedNote;
  }

  async deleteProgressNote(id: string): Promise<void> {
    await db
      .delete(progressNotes)
      .where(eq(progressNotes.id, id));
  }

  async searchProgressNotes(therapistId: string, query: string): Promise<ProgressNote[]> {
    return await db
      .select()
      .from(progressNotes)
      .where(
        and(
          eq(progressNotes.therapistId, therapistId),
          or(
            like(progressNotes.content, `%${query}%`),
            sql`${progressNotes.tags} @> ${[query]}`,
            sql`${progressNotes.aiTags} @> ${[query]}`
          )
        )
      )
      .orderBy(desc(progressNotes.createdAt));
  }

  async getCaseConceptualization(clientId: string): Promise<CaseConceptualization | undefined> {
    const [conceptualization] = await db
      .select()
      .from(caseConceptualizations)
      .where(eq(caseConceptualizations.clientId, clientId))
      .orderBy(desc(caseConceptualizations.createdAt));
    return conceptualization || undefined;
  }

  async createCaseConceptualization(conceptualization: InsertCaseConceptualization): Promise<CaseConceptualization> {
    const [newConceptualization] = await db
      .insert(caseConceptualizations)
      .values(conceptualization)
      .returning();
    return newConceptualization;
  }

  async updateCaseConceptualization(id: string, conceptualization: Partial<InsertCaseConceptualization>): Promise<CaseConceptualization> {
    const [updatedConceptualization] = await db
      .update(caseConceptualizations)
      .set({ ...conceptualization, updatedAt: new Date() })
      .where(eq(caseConceptualizations.id, id))
      .returning();
    return updatedConceptualization;
  }

  async getTreatmentPlan(clientId: string): Promise<TreatmentPlan | undefined> {
    const [plan] = await db
      .select()
      .from(treatmentPlans)
      .where(
        and(
          eq(treatmentPlans.clientId, clientId),
          eq(treatmentPlans.isActive, true)
        )
      )
      .orderBy(desc(treatmentPlans.createdAt));
    return plan || undefined;
  }

  async getTreatmentPlanByClient(clientId: string): Promise<TreatmentPlan | undefined> {
    return this.getTreatmentPlan(clientId);
  }

  async createTreatmentPlan(plan: InsertTreatmentPlan): Promise<TreatmentPlan> {
    const [newPlan] = await db
      .insert(treatmentPlans)
      .values(plan)
      .returning();
    return newPlan;
  }

  async updateTreatmentPlan(id: string, plan: Partial<InsertTreatmentPlan>): Promise<TreatmentPlan> {
    const [updatedPlan] = await db
      .update(treatmentPlans)
      .set({ ...plan, updatedAt: new Date() })
      .where(eq(treatmentPlans.id, id))
      .returning();
    return updatedPlan;
  }

  async getAllianceScores(clientId: string): Promise<AllianceScore[]> {
    return await db
      .select()
      .from(allianceScores)
      .where(eq(allianceScores.clientId, clientId))
      .orderBy(desc(allianceScores.assessmentDate));
  }

  async createAllianceScore(score: InsertAllianceScore): Promise<AllianceScore> {
    const [newScore] = await db
      .insert(allianceScores)
      .values(score)
      .returning();
    return newScore;
  }

  async getDocuments(clientId: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.clientId, clientId))
      .orderBy(desc(documents.uploadedAt));
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const result = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id))
      .limit(1);
    return result[0];
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db
      .insert(documents)
      .values(document)
      .returning();
    return newDocument;
  }

  async updateDocument(id: string, updates: Partial<InsertDocument>): Promise<Document> {
    const [updatedDocument] = await db
      .update(documents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    return updatedDocument;
  }

  async getDocumentsByTherapist(therapistId: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.therapistId, therapistId))
      .orderBy(desc(documents.uploadedAt));
  }

  async getAiInsights(therapistId: string, limit = 10): Promise<AiInsight[]> {
    return await db
      .select()
      .from(aiInsights)
      .where(eq(aiInsights.therapistId, therapistId))
      .orderBy(desc(aiInsights.createdAt))
      .limit(limit);
  }

  async createAiInsight(insight: InsertAiInsight): Promise<AiInsight> {
    const [newInsight] = await db
      .insert(aiInsights)
      .values(insight)
      .returning();
    return newInsight;
  }

  async markInsightAsRead(id: string): Promise<void> {
    await db
      .update(aiInsights)
      .set({ isRead: true })
      .where(eq(aiInsights.id, id));
  }

  async getTherapistStats(therapistId: string): Promise<{
    activeClients: number;
    weeklySchedule: number;
    totalNotes: number;
    aiInsights: number;
  }> {
    // Get active clients count
    const [activeClientsResult] = await db
      .select({ count: sql`count(*)::int` })
      .from(clients)
      .where(
        and(
          eq(clients.therapistId, therapistId),
          eq(clients.status, "active")
        )
      );

    // Get weekly sessions count
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const [weeklySessionsResult] = await db
      .select({ count: sql`count(*)::int` })
      .from(sessions)
      .where(
        and(
          eq(sessions.therapistId, therapistId),
          sql`${sessions.scheduledAt} >= ${weekStart}`,
          sql`${sessions.scheduledAt} < ${weekEnd}`
        )
      );

    // Get total notes count
    const [totalNotesResult] = await db
      .select({ count: sql`count(*)::int` })
      .from(progressNotes)
      .where(eq(progressNotes.therapistId, therapistId));

    // Get unread AI insights count
    const [aiInsightsResult] = await db
      .select({ count: sql`count(*)::int` })
      .from(aiInsights)
      .where(
        and(
          eq(aiInsights.therapistId, therapistId),
          eq(aiInsights.isRead, false)
        )
      );

    return {
      activeClients: (activeClientsResult as any)?.count || 0,
      weeklySchedule: (weeklySessionsResult as any)?.count || 0,
      totalNotes: (totalNotesResult as any)?.count || 0,
      aiInsights: (aiInsightsResult as any)?.count || 0,
    };
  }

  // New Progress Note Management Methods
  async getProgressNotesForManualReview(therapistId: string): Promise<ProgressNote[]> {
    return await db
      .select()
      .from(progressNotes)
      .where(
        and(
          eq(progressNotes.therapistId, therapistId),
          eq(progressNotes.requiresManualReview, true)
        )
      )
      .orderBy(desc(progressNotes.sessionDate));
  }

  async getProgressNotePlaceholders(therapistId: string): Promise<ProgressNote[]> {
    return await db
      .select()
      .from(progressNotes)
      .where(
        and(
          eq(progressNotes.therapistId, therapistId),
          eq(progressNotes.isPlaceholder, true)
        )
      )
      .orderBy(desc(progressNotes.sessionDate));
  }

  async createProgressNotePlaceholder(sessionId: string, clientId: string, therapistId: string, sessionDate: Date): Promise<ProgressNote> {
    const [placeholder] = await db
      .insert(progressNotes)
      .values({
        sessionId,
        clientId,
        therapistId,
        sessionDate,
        status: 'placeholder',
        isPlaceholder: true,
        requiresManualReview: false,
        content: null // Empty content for placeholder
      })
      .returning();
    return placeholder;
  }

  // New Session Management Methods
  async getSessionsWithoutProgressNotes(therapistId: string): Promise<Session[]> {
    return await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.therapistId, therapistId),
          eq(sessions.hasProgressNotePlaceholder, false),
          eq(sessions.status, "scheduled"),
          // Filter out holidays, observances, and automatic calendar events
          sql`${sessions.notes} NOT ILIKE '%Public holiday%'`,
          sql`${sessions.notes} NOT ILIKE '%Observance%'`,
          sql`${sessions.notes} NOT ILIKE '%gmail%'`,
          sql`${sessions.notes} NOT ILIKE '%sunsama%'`,
          sql`${sessions.notes} NOT ILIKE '%automatically created%'`,
          // Only include actual therapy sessions
          sql`${sessions.clientId} != 'calendar-sync-client'`
        )
      )
      .orderBy(desc(sessions.scheduledAt));
  }

  async getSimplePracticeSessions(therapistId: string): Promise<Session[]> {
    return await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.therapistId, therapistId),
          eq(sessions.isSimplePracticeEvent, true)
        )
      )
      .orderBy(desc(sessions.scheduledAt));
  }

  // Transcript Batch Processing
  async createTranscriptBatch(batch: InsertTranscriptBatch): Promise<TranscriptBatch> {
    const [newBatch] = await db
      .insert(transcriptBatches)
      .values(batch)
      .returning();
    return newBatch;
  }

  async getTranscriptBatch(id: string): Promise<TranscriptBatch | undefined> {
    const [batch] = await db.select().from(transcriptBatches).where(eq(transcriptBatches.id, id));
    return batch || undefined;
  }

  async getTranscriptBatches(therapistId: string): Promise<TranscriptBatch[]> {
    return await db
      .select()
      .from(transcriptBatches)
      .where(eq(transcriptBatches.therapistId, therapistId))
      .orderBy(desc(transcriptBatches.uploadedAt));
  }

  async updateTranscriptBatch(id: string, updates: Partial<InsertTranscriptBatch>): Promise<TranscriptBatch> {
    const [updatedBatch] = await db
      .update(transcriptBatches)
      .set(updates)
      .where(eq(transcriptBatches.id, id))
      .returning();
    return updatedBatch;
  }

  // Transcript File Processing
  async createTranscriptFile(file: InsertTranscriptFile): Promise<TranscriptFile> {
    const [newFile] = await db
      .insert(transcriptFiles)
      .values(file)
      .returning();
    return newFile;
  }

  async getTranscriptFile(id: string): Promise<TranscriptFile | undefined> {
    const [file] = await db.select().from(transcriptFiles).where(eq(transcriptFiles.id, id));
    return file || undefined;
  }

  async getTranscriptFilesByBatch(batchId: string): Promise<TranscriptFile[]> {
    return await db
      .select()
      .from(transcriptFiles)
      .where(eq(transcriptFiles.batchId, batchId))
      .orderBy(transcriptFiles.fileName);
  }

  async getTranscriptFilesForProcessing(therapistId: string, limit = 10): Promise<TranscriptFile[]> {
    return await db
      .select()
      .from(transcriptFiles)
      .where(
        and(
          eq(transcriptFiles.therapistId, therapistId),
          eq(transcriptFiles.status, "uploaded")
        )
      )
      .orderBy(transcriptFiles.uploadedAt)
      .limit(limit);
  }

  async getTranscriptFilesForReview(therapistId: string): Promise<TranscriptFile[]> {
    return await db
      .select()
      .from(transcriptFiles)
      .where(
        and(
          eq(transcriptFiles.therapistId, therapistId),
          eq(transcriptFiles.requiresManualReview, true),
          ne(transcriptFiles.status, "assigned")
        )
      )
      .orderBy(transcriptFiles.uploadedAt);
  }

  async updateTranscriptFile(id: string, updates: Partial<InsertTranscriptFile>): Promise<TranscriptFile> {
    const [updatedFile] = await db
      .update(transcriptFiles)
      .set(updates)
      .where(eq(transcriptFiles.id, id))
      .returning();
    return updatedFile;
  }

  async assignTranscriptToClient(fileId: string, clientId: string, sessionDate: Date, sessionType: string): Promise<TranscriptFile> {
    const [updatedFile] = await db
      .update(transcriptFiles)
      .set({
        assignedClientId: clientId,
        assignedSessionDate: sessionDate,
        assignedSessionType: sessionType,
        status: "assigned",
        assignedAt: new Date()
      })
      .where(eq(transcriptFiles.id, fileId))
      .returning();
    return updatedFile;
  }

  async createProgressNoteFromTranscript(fileId: string): Promise<ProgressNote> {
    const file = await this.getTranscriptFile(fileId);
    if (!file || !file.assignedClientId || !file.assignedSessionDate) {
      throw new Error("Transcript file not properly assigned");
    }

    const [progressNote] = await db
      .insert(progressNotes)
      .values({
        clientId: file.assignedClientId,
        therapistId: file.therapistId,
        sessionDate: file.assignedSessionDate,
        content: file.extractedText || "",
        tags: file.themes || [],
        aiTags: file.themes || [],
        riskLevel: file.riskLevel || "low",
        progressRating: file.progressRating,
        status: "processed",
        isPlaceholder: false,
        requiresManualReview: file.requiresManualReview,
        aiConfidenceScore: file.clientMatchConfidence,
        processingNotes: file.processingNotes,
        originalDocumentId: null // Could link to document table if needed
      })
      .returning();

    // Update the transcript file to link to the created progress note
    await this.updateTranscriptFile(fileId, {
      createdProgressNoteId: progressNote.id
    });

    return progressNote;
  }
};

export const storage = new DatabaseStorage();