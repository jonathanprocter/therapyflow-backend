import {
  users, clients, sessions, progressNotes, caseConceptualizations,
  treatmentPlans, allianceScores, documents, aiInsights, crossReferences,
  transcriptBatches, transcriptFiles, sessionPreps, longitudinalRecords,
  jobRuns, documentTextVersions, calendarSyncHistory, calendarEventAliases, oauthTokens,
  type User, type InsertUser, type Client, type InsertClient,
  type Session, type InsertSession, type ProgressNote, type InsertProgressNote,
  type CaseConceptualization, type InsertCaseConceptualization,
  type TreatmentPlan, type InsertTreatmentPlan,
  type AllianceScore, type InsertAllianceScore,
  type Document, type InsertDocument,
  type AiInsight, type InsertAiInsight,
  type TranscriptBatch, type InsertTranscriptBatch,
  type TranscriptFile, type InsertTranscriptFile,
  type LongitudinalRecord, type InsertLongitudinalRecord,
  type JobRun, type InsertJobRun,
  type DocumentTextVersion, type InsertDocumentTextVersion,
  type CalendarSyncHistory, type InsertCalendarSyncHistory,
  type CalendarEventAlias, type InsertCalendarEventAlias,
  type OAuthTokens, type InsertOAuthTokens
} from "@shared/schema";
import { db } from "./db";
import { calculateNoteQuality } from "./utils/noteQuality";
import { ClinicalEncryption } from "./utils/encryption";
import { eq, desc, and, or, like, sql, isNull, ne, inArray } from "drizzle-orm";

/**
 * Strip markdown formatting from text before saving to database
 */
function stripMarkdown(text: string): string {
  if (!text) return text;
  let cleaned = text;

  // Remove headers (# ## ### #### ##### ######)
  cleaned = cleaned.replace(/^#{1,6}\s+(.*)$/gm, '$1');

  // Remove bold and italic formatting (**text**, *text*, __text__, _text_)
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
  cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
  cleaned = cleaned.replace(/__([^_]+)__/g, '$1');
  cleaned = cleaned.replace(/_([^_]+)_/g, '$1');

  // Remove strikethrough (~~text~~)
  cleaned = cleaned.replace(/~~([^~]+)~~/g, '$1');

  // Remove code blocks (```code``` and `code`)
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

  // Remove links ([text](url) and [text]: url)
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  cleaned = cleaned.replace(/\[([^\]]+)\]:\s*[^\s]+/g, '$1');

  // Remove images (![alt](url))
  cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');

  // Remove horizontal rules (--- or ***)
  cleaned = cleaned.replace(/^[-*]{3,}\s*$/gm, '');

  // Remove list markers (- + * for unordered, 1. 2. for ordered)
  cleaned = cleaned.replace(/^[\s]*[-+*]\s+/gm, '');
  cleaned = cleaned.replace(/^[\s]*\d+\.\s+/gm, '');

  // Remove blockquotes (> text)
  cleaned = cleaned.replace(/^[\s]*>\s*/gm, '');

  // Remove tables (| cell | cell |)
  cleaned = cleaned.replace(/^\|.*\|$/gm, '');
  cleaned = cleaned.replace(/^[\s]*\|?[\s]*:?-+:?[\s]*\|?.*$/gm, '');

  // Remove footnotes ([^1])
  cleaned = cleaned.replace(/\[\^[^\]]+\]/g, '');

  // Remove HTML comments (<!-- comment -->)
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');

  // Clean up extra whitespace
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');

  return cleaned;
}

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Clients
  getClients(therapistId: string): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  getClientsByIds(ids: string[]): Promise<Map<string, Client>>;
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
  getProgressNotesInDateRange(therapistId: string, startDate: Date, endDate: Date): Promise<ProgressNote[]>;
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
  getAllTreatmentPlans(therapistId: string): Promise<TreatmentPlan[]>;
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
  deleteDocument(id: string): Promise<Document | undefined>;

  // AI Insights
  getAiInsights(therapistId: string, limit?: number): Promise<AiInsight[]>;
  createAiInsight(insight: InsertAiInsight): Promise<AiInsight>;
  markInsightAsRead(id: string): Promise<void>;
  // Session Preps
  createSessionPrep(sessionId: string, clientId: string, therapistId: string, prep: any): Promise<any>;
  getLatestSessionPrep(sessionId: string): Promise<any | undefined>;
  getSessionPrepHistory(sessionId: string, limit?: number): Promise<any[]>;

  // Longitudinal Tracking
  createLongitudinalRecord(record: InsertLongitudinalRecord): Promise<LongitudinalRecord>;
  getLatestLongitudinalRecord(clientId: string): Promise<LongitudinalRecord | undefined>;
  getLongitudinalHistory(clientId: string, limit?: number): Promise<LongitudinalRecord[]>;

  // Job Runs
  createJobRun(run: InsertJobRun & { id?: string }): Promise<JobRun>;
  updateJobRun(id: string, updates: Partial<InsertJobRun>): Promise<JobRun | undefined>;
  getJobRun(id: string): Promise<JobRun | undefined>;
  getJobRuns(limit?: number, therapistId?: string): Promise<JobRun[]>;

  // Document Text Versions
  createDocumentTextVersion(version: InsertDocumentTextVersion): Promise<DocumentTextVersion>;
  getDocumentTextVersions(documentId: string): Promise<DocumentTextVersion[]>;

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

  // OAuth Tokens
  getOAuthTokens(therapistId: string, provider?: string): Promise<OAuthTokens | undefined>;
  storeOAuthTokens(tokens: InsertOAuthTokens): Promise<OAuthTokens>;
  updateOAuthTokens(therapistId: string, provider: string, tokens: Partial<InsertOAuthTokens>): Promise<OAuthTokens | undefined>;

  // Calendar Event Aliases
  getEventAliases(therapistId: string): Promise<CalendarEventAlias[]>;
  createEventAlias(alias: InsertCalendarEventAlias): Promise<CalendarEventAlias>;
  deleteEventAlias(id: string): Promise<void>;
  getEventAliasByAlias(therapistId: string, alias: string): Promise<CalendarEventAlias | undefined>;

  // Calendar Sync History
  createCalendarSyncHistory(history: InsertCalendarSyncHistory): Promise<CalendarSyncHistory>;
  updateCalendarSyncHistory(id: string, updates: Partial<InsertCalendarSyncHistory>): Promise<CalendarSyncHistory | undefined>;
  getCalendarSyncHistory(therapistId: string, limit?: number): Promise<CalendarSyncHistory[]>;
  getCalendarSyncStats(therapistId: string): Promise<{
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    lastSyncAt: Date | null;
    eventsProcessed: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  private encryptJsonPayload(value: any) {
    if (value === null || value === undefined) return value;
    const serialized = JSON.stringify(value);
    return {
      encrypted: true,
      value: ClinicalEncryption.encrypt(serialized),
    };
  }

  private decryptJsonPayload(value: any) {
    if (!value) return value;
    if (typeof value === "string") {
      try {
        return JSON.parse(ClinicalEncryption.decrypt(value));
      } catch {
        return value;
      }
    }
    if (typeof value === "object" && value.encrypted && typeof value.value === "string") {
      try {
        return JSON.parse(ClinicalEncryption.decrypt(value.value));
      } catch {
        return value;
      }
    }
    return value;
  }
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
      .values(insertUser as any)
      .returning();
    return user;
  }

  async getClients(therapistId: string): Promise<Client[]> {
    return await db
      .select()
      .from(clients)
      .where(and(eq(clients.therapistId, therapistId), isNull(clients.deletedAt)))
      .orderBy(desc(clients.createdAt));
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(
      and(eq(clients.id, id), isNull(clients.deletedAt))
    );
    return client || undefined;
  }

  async getClientsByIds(ids: string[]): Promise<Map<string, Client>> {
    if (ids.length === 0) return new Map();
    const uniqueIds = [...new Set(ids)];
    const result = await db.select().from(clients).where(
      and(inArray(clients.id, uniqueIds), isNull(clients.deletedAt))
    );
    return new Map(result.map(client => [client.id, client]));
  }

  async getClientByName(name: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.name, name));
    return client || undefined;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [newClient] = await db
      .insert(clients)
      .values(client as any)
      .returning();
    return newClient;
  }

  async updateClient(id: string, client: Partial<InsertClient>): Promise<Client> {
    const [updatedClient] = await db
      .update(clients)
      .set({ ...client, updatedAt: new Date() } as any)
      .where(eq(clients.id, id))
      .returning();
    return updatedClient;
  }

  async deleteClient(id: string): Promise<void> {
    // Soft delete the client by setting deletedAt timestamp
    // This prevents calendar sync from recreating them
    await db
      .update(clients)
      .set({
        deletedAt: new Date(),
        status: 'deleted',
        updatedAt: new Date()
      } as any)
      .where(eq(clients.id, id));
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
      .values(session as any)
      .returning();
    return newSession;
  }

  async updateSession(id: string, session: Partial<InsertSession>): Promise<Session> {
    const [updatedSession] = await db
      .update(sessions)
      .set({ ...session, updatedAt: new Date() } as any)
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
      } as any)
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

    await db.insert(progressNotes).values(placeholderNotes as any);

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
    const noteData = note as any;
    // Strip markdown formatting from content before saving
    const cleanContent = noteData.content ? stripMarkdown(noteData.content) : noteData.content;
    const quality = calculateNoteQuality(cleanContent);
    const [newNote] = await db
      .insert(progressNotes)
      .values({
        ...noteData,
        content: cleanContent,
        qualityScore: cleanContent ? quality.score : noteData.qualityScore,
        qualityFlags: cleanContent ? quality.flags : noteData.qualityFlags,
      } as any)
      .returning();
    return newNote;
  }

  async updateProgressNote(id: string, note: Partial<InsertProgressNote>): Promise<ProgressNote> {
    const noteData = note as any;
    // Strip markdown formatting from content before saving
    const cleanContent = noteData.content !== undefined ? stripMarkdown(noteData.content || '') : undefined;
    const quality = cleanContent !== undefined ? calculateNoteQuality(cleanContent) : null;
    const [updatedNote] = await db
      .update(progressNotes)
      .set({
        ...noteData,
        content: cleanContent !== undefined ? cleanContent : noteData.content,
        qualityScore: quality ? quality.score : noteData.qualityScore,
        qualityFlags: quality ? quality.flags : noteData.qualityFlags,
        updatedAt: new Date()
      } as any)
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

  async getProgressNotesInDateRange(therapistId: string, startDate: Date, endDate: Date): Promise<ProgressNote[]> {
    return await db
      .select()
      .from(progressNotes)
      .where(
        and(
          eq(progressNotes.therapistId, therapistId),
          sql`${progressNotes.sessionDate} >= ${startDate}`,
          sql`${progressNotes.sessionDate} <= ${endDate}`
        )
      )
      .orderBy(desc(progressNotes.sessionDate));
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
      .values(conceptualization as any)
      .returning();
    return newConceptualization;
  }

  async updateCaseConceptualization(id: string, conceptualization: Partial<InsertCaseConceptualization>): Promise<CaseConceptualization> {
    const [updatedConceptualization] = await db
      .update(caseConceptualizations)
      .set({ ...conceptualization, updatedAt: new Date() } as any)
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

  async getAllTreatmentPlans(therapistId: string): Promise<TreatmentPlan[]> {
    return await db
      .select()
      .from(treatmentPlans)
      .where(eq(treatmentPlans.therapistId, therapistId))
      .orderBy(desc(treatmentPlans.updatedAt));
  }

  async createTreatmentPlan(plan: InsertTreatmentPlan): Promise<TreatmentPlan> {
    const [newPlan] = await db
      .insert(treatmentPlans)
      .values(plan as any)
      .returning();
    return newPlan;
  }

  async updateTreatmentPlan(id: string, plan: Partial<InsertTreatmentPlan>): Promise<TreatmentPlan> {
    const [updatedPlan] = await db
      .update(treatmentPlans)
      .set({ ...plan, updatedAt: new Date() } as any)
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
      .values(score as any)
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
      .values(document as any)
      .returning();
    return newDocument;
  }

  async updateDocument(id: string, updates: Partial<InsertDocument>): Promise<Document> {
    const [updatedDocument] = await db
      .update(documents)
      .set({ ...updates, uploadedAt: new Date() } as any)
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

  async deleteDocument(id: string): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    if (!doc) return undefined;

    await db.delete(documents).where(eq(documents.id, id));
    return doc;
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
      .values(insight as any)
      .returning();
    return newInsight;
  }

  async markInsightAsRead(id: string): Promise<void> {
    await db
      .update(aiInsights)
      .set({ isRead: true } as any)
      .where(eq(aiInsights.id, id));
  }

  async createSessionPrep(sessionId: string, clientId: string, therapistId: string, prep: any) {
    const [record] = await db
      .insert(sessionPreps)
      .values({
        sessionId,
        clientId,
        therapistId,
        prep: this.encryptJsonPayload(prep)
      })
      .returning();
    return record;
  }

  async getLatestSessionPrep(sessionId: string) {
    const [record] = await db
      .select()
      .from(sessionPreps)
      .where(eq(sessionPreps.sessionId, sessionId))
      .orderBy(desc(sessionPreps.createdAt))
      .limit(1);
    if (!record) return undefined;
    return {
      ...record,
      prep: this.decryptJsonPayload(record.prep),
    };
  }

  async getSessionPrepHistory(sessionId: string, limit = 10) {
    const records = await db
      .select()
      .from(sessionPreps)
      .where(eq(sessionPreps.sessionId, sessionId))
      .orderBy(desc(sessionPreps.createdAt))
      .limit(limit);
    return records.map((record) => ({
      ...record,
      prep: this.decryptJsonPayload(record.prep),
    }));
  }

  async createLongitudinalRecord(record: InsertLongitudinalRecord): Promise<LongitudinalRecord> {
    const recordData = record as any;
    const [created] = await db
      .insert(longitudinalRecords)
      .values({
        ...recordData,
        record: this.encryptJsonPayload(recordData.record),
        analysis: this.encryptJsonPayload(recordData.analysis),
      } as any)
      .returning();
    return created;
  }

  async getLatestLongitudinalRecord(clientId: string): Promise<LongitudinalRecord | undefined> {
    const [record] = await db
      .select()
      .from(longitudinalRecords)
      .where(eq(longitudinalRecords.clientId, clientId))
      .orderBy(desc(longitudinalRecords.createdAt))
      .limit(1);
    if (!record) return undefined;
    return {
      ...record,
      record: this.decryptJsonPayload(record.record),
      analysis: this.decryptJsonPayload(record.analysis),
    };
  }

  async getLongitudinalHistory(clientId: string, limit = 10): Promise<LongitudinalRecord[]> {
    const records = await db
      .select()
      .from(longitudinalRecords)
      .where(eq(longitudinalRecords.clientId, clientId))
      .orderBy(desc(longitudinalRecords.createdAt))
      .limit(limit);
    return records.map((record) => ({
      ...record,
      record: this.decryptJsonPayload(record.record),
      analysis: this.decryptJsonPayload(record.analysis),
    }));
  }

  async createJobRun(run: InsertJobRun & { id?: string }): Promise<JobRun> {
    const [created] = await db
      .insert(jobRuns)
      .values({ ...run, updatedAt: new Date() } as any)
      .returning();
    return created;
  }

  async updateJobRun(id: string, updates: Partial<InsertJobRun>): Promise<JobRun | undefined> {
    const [updated] = await db
      .update(jobRuns)
      .set({ ...updates, updatedAt: new Date() } as any)
      .where(eq(jobRuns.id, id))
      .returning();
    return updated || undefined;
  }

  async getJobRun(id: string): Promise<JobRun | undefined> {
    const [record] = await db
      .select()
      .from(jobRuns)
      .where(eq(jobRuns.id, id));
    return record || undefined;
  }

  async getJobRuns(limit = 50, therapistId?: string): Promise<JobRun[]> {
    const base = db.select().from(jobRuns);
    const query = therapistId
      ? base.where(eq(jobRuns.therapistId, therapistId))
      : base;
    return await query.orderBy(desc(jobRuns.createdAt)).limit(limit);
  }

  async createDocumentTextVersion(version: InsertDocumentTextVersion): Promise<DocumentTextVersion> {
    const [created] = await db
      .insert(documentTextVersions)
      .values(version as any)
      .returning();
    return created;
  }

  async getDocumentTextVersions(documentId: string): Promise<DocumentTextVersion[]> {
    return await db
      .select()
      .from(documentTextVersions)
      .where(eq(documentTextVersions.documentId, documentId))
      .orderBy(desc(documentTextVersions.createdAt));
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
      } as any)
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
      .values(batch as any)
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
      .set(updates as any)
      .where(eq(transcriptBatches.id, id))
      .returning();
    return updatedBatch;
  }

  // Transcript File Processing
  async createTranscriptFile(file: InsertTranscriptFile): Promise<TranscriptFile> {
    const [newFile] = await db
      .insert(transcriptFiles)
      .values(file as any)
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
      .set(updates as any)
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
      } as any)
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
        content: stripMarkdown(file.extractedText || ""),
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
      } as any)
      .returning();

    // Update the transcript file to link to the created progress note
    await this.updateTranscriptFile(fileId, {
      createdProgressNoteId: progressNote.id
    });

    return progressNote;
  }

  // OAuth Tokens Methods
  async getOAuthTokens(therapistId: string, provider: string = "google"): Promise<OAuthTokens | undefined> {
    const [tokens] = await db
      .select()
      .from(oauthTokens)
      .where(
        and(
          eq(oauthTokens.therapistId, therapistId),
          eq(oauthTokens.provider, provider)
        )
      );
    return tokens || undefined;
  }

  async storeOAuthTokens(tokens: InsertOAuthTokens): Promise<OAuthTokens> {
    const tokensData = tokens as any;
    // Upsert - insert or update if exists
    const existing = await this.getOAuthTokens(tokensData.therapistId, tokensData.provider || "google");

    if (existing) {
      const [updated] = await db
        .update(oauthTokens)
        .set({ ...tokensData, updatedAt: new Date() } as any)
        .where(eq(oauthTokens.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(oauthTokens)
      .values(tokensData as any)
      .returning();
    return created;
  }

  async updateOAuthTokens(therapistId: string, provider: string, tokens: Partial<InsertOAuthTokens>): Promise<OAuthTokens | undefined> {
    const [updated] = await db
      .update(oauthTokens)
      .set({ ...tokens, updatedAt: new Date() } as any)
      .where(
        and(
          eq(oauthTokens.therapistId, therapistId),
          eq(oauthTokens.provider, provider)
        )
      )
      .returning();
    return updated || undefined;
  }

  // Calendar Event Aliases Methods
  async getEventAliases(therapistId: string): Promise<CalendarEventAlias[]> {
    return await db
      .select()
      .from(calendarEventAliases)
      .where(eq(calendarEventAliases.therapistId, therapistId))
      .orderBy(calendarEventAliases.alias);
  }

  async createEventAlias(alias: InsertCalendarEventAlias): Promise<CalendarEventAlias> {
    const [created] = await db
      .insert(calendarEventAliases)
      .values(alias as any)
      .returning();
    return created;
  }

  async deleteEventAlias(id: string): Promise<void> {
    await db
      .delete(calendarEventAliases)
      .where(eq(calendarEventAliases.id, id));
  }

  async getEventAliasByAlias(therapistId: string, alias: string): Promise<CalendarEventAlias | undefined> {
    const [found] = await db
      .select()
      .from(calendarEventAliases)
      .where(
        and(
          eq(calendarEventAliases.therapistId, therapistId),
          eq(calendarEventAliases.alias, alias)
        )
      );
    return found || undefined;
  }

  // Calendar Sync History Methods
  async createCalendarSyncHistory(history: InsertCalendarSyncHistory): Promise<CalendarSyncHistory> {
    const [created] = await db
      .insert(calendarSyncHistory)
      .values(history as any)
      .returning();
    return created;
  }

  async updateCalendarSyncHistory(id: string, updates: Partial<InsertCalendarSyncHistory>): Promise<CalendarSyncHistory | undefined> {
    const [updated] = await db
      .update(calendarSyncHistory)
      .set(updates as any)
      .where(eq(calendarSyncHistory.id, id))
      .returning();
    return updated || undefined;
  }

  async getCalendarSyncHistory(therapistId: string, limit: number = 20): Promise<CalendarSyncHistory[]> {
    return await db
      .select()
      .from(calendarSyncHistory)
      .where(eq(calendarSyncHistory.therapistId, therapistId))
      .orderBy(desc(calendarSyncHistory.startedAt))
      .limit(limit);
  }

  async getCalendarSyncStats(therapistId: string): Promise<{
    totalSyncs: number;
    successfulSyncs: number;
    failedSyncs: number;
    lastSyncAt: Date | null;
    eventsProcessed: number;
  }> {
    const [totalResult] = await db
      .select({ count: sql`count(*)::int` })
      .from(calendarSyncHistory)
      .where(eq(calendarSyncHistory.therapistId, therapistId));

    const [successResult] = await db
      .select({ count: sql`count(*)::int` })
      .from(calendarSyncHistory)
      .where(
        and(
          eq(calendarSyncHistory.therapistId, therapistId),
          eq(calendarSyncHistory.status, "success")
        )
      );

    const [failedResult] = await db
      .select({ count: sql`count(*)::int` })
      .from(calendarSyncHistory)
      .where(
        and(
          eq(calendarSyncHistory.therapistId, therapistId),
          eq(calendarSyncHistory.status, "failed")
        )
      );

    const [lastSync] = await db
      .select({ completedAt: calendarSyncHistory.completedAt })
      .from(calendarSyncHistory)
      .where(
        and(
          eq(calendarSyncHistory.therapistId, therapistId),
          eq(calendarSyncHistory.status, "success")
        )
      )
      .orderBy(desc(calendarSyncHistory.completedAt))
      .limit(1);

    const [eventsResult] = await db
      .select({ total: sql`coalesce(sum(${calendarSyncHistory.eventsProcessed}), 0)::int` })
      .from(calendarSyncHistory)
      .where(eq(calendarSyncHistory.therapistId, therapistId));

    return {
      totalSyncs: (totalResult as any)?.count || 0,
      successfulSyncs: (successResult as any)?.count || 0,
      failedSyncs: (failedResult as any)?.count || 0,
      lastSyncAt: lastSync?.completedAt || null,
      eventsProcessed: (eventsResult as any)?.total || 0
    };
  }
}

export const storage = new DatabaseStorage();
