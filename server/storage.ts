import { 
  users, clients, sessions, progressNotes, caseConceptualizations, 
  treatmentPlans, allianceScores, documents, aiInsights, crossReferences,
  type User, type InsertUser, type Client, type InsertClient,
  type Session, type InsertSession, type ProgressNote, type InsertProgressNote,
  type CaseConceptualization, type InsertCaseConceptualization,
  type TreatmentPlan, type InsertTreatmentPlan,
  type AllianceScore, type InsertAllianceScore,
  type Document, type InsertDocument,
  type AiInsight, type InsertAiInsight
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, like, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Clients
  getClients(therapistId: string): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client>;

  // Sessions
  getSessions(clientId: string): Promise<Session[]>;
  getUpcomingSessions(therapistId: string, date?: Date): Promise<Session[]>;
  getSession(id: string): Promise<Session | undefined>;
  createSession(session: InsertSession): Promise<Session>;
  updateSession(id: string, session: Partial<InsertSession>): Promise<Session>;

  // Progress Notes
  getProgressNotes(clientId: string): Promise<ProgressNote[]>;
  getRecentProgressNotes(therapistId: string, limit?: number): Promise<ProgressNote[]>;
  getProgressNote(id: string): Promise<ProgressNote | undefined>;
  createProgressNote(note: InsertProgressNote): Promise<ProgressNote>;
  updateProgressNote(id: string, note: Partial<InsertProgressNote>): Promise<ProgressNote>;
  searchProgressNotes(therapistId: string, query: string): Promise<ProgressNote[]>;

  // Case Conceptualizations
  getCaseConceptualization(clientId: string): Promise<CaseConceptualization | undefined>;
  createCaseConceptualization(conceptualization: InsertCaseConceptualization): Promise<CaseConceptualization>;
  updateCaseConceptualization(id: string, conceptualization: Partial<InsertCaseConceptualization>): Promise<CaseConceptualization>;

  // Treatment Plans
  getTreatmentPlan(clientId: string): Promise<TreatmentPlan | undefined>;
  createTreatmentPlan(plan: InsertTreatmentPlan): Promise<TreatmentPlan>;
  updateTreatmentPlan(id: string, plan: Partial<InsertTreatmentPlan>): Promise<TreatmentPlan>;

  // Alliance Scores
  getAllianceScores(clientId: string): Promise<AllianceScore[]>;
  createAllianceScore(score: InsertAllianceScore): Promise<AllianceScore>;

  // Documents
  getDocuments(clientId: string): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;

  // AI Insights
  getAiInsights(therapistId: string, limit?: number): Promise<AiInsight[]>;
  createAiInsight(insight: InsertAiInsight): Promise<AiInsight>;
  markInsightAsRead(id: string): Promise<void>;

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

  async getSessions(clientId: string): Promise<Session[]> {
    return await db
      .select()
      .from(sessions)
      .where(eq(sessions.clientId, clientId))
      .orderBy(desc(sessions.scheduledAt));
  }

  async getUpcomingSessions(therapistId: string, date?: Date): Promise<Session[]> {
    const targetDate = date || new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    return await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.therapistId, therapistId),
          sql`${sessions.scheduledAt} >= ${startOfDay}`,
          sql`${sessions.scheduledAt} <= ${endOfDay}`,
          eq(sessions.status, "scheduled")
        )
      )
      .orderBy(sessions.scheduledAt);
  }

  async getSession(id: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
    return session || undefined;
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

  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db
      .insert(documents)
      .values(document)
      .returning();
    return newDocument;
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
}

export const storage = new DatabaseStorage();
