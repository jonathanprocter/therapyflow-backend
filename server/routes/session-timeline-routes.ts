import { Router } from "express";
import { db } from "../db";
import { sessions, progressNotes, clients } from "../../shared/schema";
import { eq, desc, and, gte, like, sql, ilike, or } from "drizzle-orm";

const router = Router();

// Maximum results to prevent memory issues
const MAX_TIMELINE_RESULTS = 500;

// Get timeline data for sessions with progress notes and client info
router.get("/timeline", async (req, res) => {
  try {
    const { clientId, sessionType, dateRange, riskLevel, searchTerm } = req.query;

    // Build the query with filters - push ALL filters to database
    let whereConditions = [];

    if (clientId && clientId !== 'all') {
      whereConditions.push(eq(sessions.clientId, clientId as string));
    }

    if (sessionType && sessionType !== 'all') {
      whereConditions.push(eq(sessions.sessionType, sessionType as string));
    }

    // Date range filter
    if (dateRange) {
      const now = new Date();
      const months = dateRange === '3months' ? 3 : dateRange === '6months' ? 6 : 12;
      const cutoffDate = new Date();
      cutoffDate.setMonth(now.getMonth() - months);
      whereConditions.push(gte(sessions.scheduledAt, cutoffDate));
    }

    // Risk level filter - push to database instead of filtering in memory
    if (riskLevel && riskLevel !== 'all') {
      whereConditions.push(eq(progressNotes.riskLevel, riskLevel as string));
    }

    // Search term filter - push to database with ILIKE for case-insensitive search
    // Limit length to prevent regex DoS
    if (searchTerm && typeof searchTerm === 'string' && searchTerm.trim()) {
      const sanitizedTerm = searchTerm.trim().slice(0, 100); // Max 100 chars
      const searchPattern = `%${sanitizedTerm}%`;
      whereConditions.push(
        or(
          ilike(clients.name, searchPattern),
          // Search in aiTags array using PostgreSQL array containment
          sql`${progressNotes.aiTags}::text ILIKE ${searchPattern}`
        )
      );
    }

    // Build the main query with limit to prevent memory issues
    const timelineQuery = db
      .select({
        id: sessions.id,
        clientId: sessions.clientId,
        clientName: clients.name,
        sessionDate: sessions.scheduledAt,
        sessionType: sessions.sessionType,
        status: sessions.status,
        duration: sessions.duration,
        progressNoteId: progressNotes.id,
        themes: progressNotes.aiTags,
        mood: sql<string>`null`,
        progressRating: progressNotes.progressRating,
        riskLevel: progressNotes.riskLevel,
        interventions: sql<string[]>`ARRAY[]::text[]`,
        nextSteps: sql<string[]>`ARRAY[]::text[]`,
      })
      .from(sessions)
      .leftJoin(clients, eq(sessions.clientId, clients.id))
      .leftJoin(progressNotes, eq(sessions.id, progressNotes.sessionId))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .orderBy(desc(sessions.scheduledAt))
      .limit(MAX_TIMELINE_RESULTS);

    const results = await timelineQuery;

    // Transform the data to match the frontend interface
    const timelineData = results.map(result => ({
      id: result.id,
      clientId: result.clientId,
      clientName: result.clientName || 'Unknown Client',
      sessionDate: result.sessionDate,
      sessionType: result.sessionType || 'individual',
      status: result.status || 'completed',
      duration: result.duration,
      progressNoteId: result.progressNoteId,
      themes: result.themes || [],
      mood: result.mood,
      progressRating: result.progressRating,
      riskLevel: result.riskLevel || 'low',
      interventions: result.interventions || [],
      nextSteps: result.nextSteps || [],
    }));

    res.json(timelineData);
  } catch (error) {
    console.error("Error fetching session timeline:", error);
    res.status(500).json({ error: "Failed to fetch session timeline data" });
  }
});

// Get session statistics for analytics
router.get("/stats", async (req, res) => {
  try {
    const { clientId, dateRange } = req.query;
    
    let whereConditions = [];
    
    if (clientId && clientId !== 'all') {
      whereConditions.push(eq(sessions.clientId, clientId as string));
    }
    
    if (dateRange) {
      const now = new Date();
      const months = dateRange === '3months' ? 3 : dateRange === '6months' ? 6 : 12;
      const cutoffDate = new Date();
      cutoffDate.setMonth(now.getMonth() - months);
      whereConditions.push(gte(sessions.scheduledAt, cutoffDate));
    }

    // PERFORMANCE: Run all independent queries in parallel
    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const [sessionStats, clientStats, sessionTypeStats, progressStats] = await Promise.all([
      // Get basic session counts
      db
        .select({
          totalSessions: sql<number>`count(*)`,
          completedSessions: sql<number>`count(*) filter (where ${sessions.status} = 'completed')`,
          avgDuration: sql<number>`avg(${sessions.duration})`,
        })
        .from(sessions)
        .where(whereClause),

      // Get client distribution
      db
        .select({
          clientId: sessions.clientId,
          clientName: clients.name,
          sessionCount: sql<number>`count(*)`,
        })
        .from(sessions)
        .leftJoin(clients, eq(sessions.clientId, clients.id))
        .where(whereClause)
        .groupBy(sessions.clientId, clients.name),

      // Get session type distribution
      db
        .select({
          sessionType: sessions.sessionType,
          count: sql<number>`count(*)`,
        })
        .from(sessions)
        .where(whereClause)
        .groupBy(sessions.sessionType),

      // Get progress note statistics
      db
        .select({
          avgProgressRating: sql<number>`avg(${progressNotes.progressRating})`,
          riskLevel: progressNotes.riskLevel,
          riskCount: sql<number>`count(*)`,
        })
        .from(progressNotes)
        .leftJoin(sessions, eq(progressNotes.sessionId, sessions.id))
        .where(whereClause)
        .groupBy(progressNotes.riskLevel),
    ]);

    res.json({
      sessionStats: sessionStats[0] || { totalSessions: 0, completedSessions: 0, avgDuration: 0 },
      clientStats,
      sessionTypeStats,
      progressStats,
    });
  } catch (error) {
    console.error("Error fetching session statistics:", error);
    res.status(500).json({ error: "Failed to fetch session statistics" });
  }
});

// Get detailed session information
router.get("/:sessionId/details", async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const sessionDetails = await db
      .select({
        id: sessions.id,
        clientId: sessions.clientId,
        clientName: clients.name,
        sessionDate: sessions.scheduledAt,
        sessionType: sessions.sessionType,
        status: sessions.status,
        duration: sessions.duration,
        notes: sessions.notes,
        progressNoteId: progressNotes.id,
        progressNoteContent: progressNotes.content,
        themes: progressNotes.aiTags,
        mood: sql<string>`null`,
        progressRating: progressNotes.progressRating,
        riskLevel: progressNotes.riskLevel,
        interventions: sql<string[]>`ARRAY[]::text[]`,
        nextSteps: sql<string[]>`ARRAY[]::text[]`,
        keyPoints: sql<string[]>`ARRAY[]::text[]`,
        clinicalObservations: sql<string>`null`,
      })
      .from(sessions)
      .leftJoin(clients, eq(sessions.clientId, clients.id))
      .leftJoin(progressNotes, eq(sessions.id, progressNotes.sessionId))
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (sessionDetails.length === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json(sessionDetails[0]);
  } catch (error) {
    console.error("Error fetching session details:", error);
    res.status(500).json({ error: "Failed to fetch session details" });
  }
});

export default router;