import { Router } from "express";
import { db } from "../db";
import { sessions, progressNotes, clients } from "../../shared/schema";
import { eq, desc, and, gte, like, sql } from "drizzle-orm";

const router = Router();

// Get timeline data for sessions with progress notes and client info
router.get("/timeline", async (req, res) => {
  try {
    const { clientId, sessionType, dateRange, riskLevel, searchTerm } = req.query;
    
    // Build the query with filters
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
    
    // Build the main query
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
      .orderBy(desc(sessions.scheduledAt));

    let results = await timelineQuery;
    
    // Apply additional filters
    if (riskLevel && riskLevel !== 'all') {
      results = results.filter(r => r.riskLevel === riskLevel);
    }
    
    if (searchTerm) {
      const searchLower = (searchTerm as string).toLowerCase();
      results = results.filter(r => 
        r.clientName?.toLowerCase().includes(searchLower) ||
        r.themes?.some((theme: string) => theme.toLowerCase().includes(searchLower))
      );
    }

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

    // Get basic session counts
    const sessionStats = await db
      .select({
        totalSessions: sql<number>`count(*)`,
        completedSessions: sql<number>`count(*) filter (where ${sessions.status} = 'completed')`,
        avgDuration: sql<number>`avg(${sessions.duration})`,
      })
      .from(sessions)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    // Get client distribution
    const clientStats = await db
      .select({
        clientId: sessions.clientId,
        clientName: clients.name,
        sessionCount: sql<number>`count(*)`,
      })
      .from(sessions)
      .leftJoin(clients, eq(sessions.clientId, clients.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .groupBy(sessions.clientId, clients.name);

    // Get session type distribution
    const sessionTypeStats = await db
      .select({
        sessionType: sessions.sessionType,
        count: sql<number>`count(*)`,
      })
      .from(sessions)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .groupBy(sessions.sessionType);

    // Get progress note statistics
    const progressStats = await db
      .select({
        avgProgressRating: sql<number>`avg(${progressNotes.progressRating})`,
        riskLevel: progressNotes.riskLevel,
        riskCount: sql<number>`count(*)`,
      })
      .from(progressNotes)
      .leftJoin(sessions, eq(progressNotes.sessionId, sessions.id))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .groupBy(progressNotes.riskLevel);

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