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

    // Transform the data to match the frontend interface (snake_case for iOS)
    const timelineData = results.map(result => ({
      id: result.id,
      client_id: result.clientId,
      client_name: result.clientName || 'Unknown Client',
      session_date: result.sessionDate,
      session_type: result.sessionType || 'individual',
      status: result.status || 'completed',
      duration: result.duration,
      progress_note_id: result.progressNoteId,
      themes: result.themes || [],
      mood: result.mood,
      progress_rating: result.progressRating,
      risk_level: result.riskLevel || 'low',
      interventions: result.interventions || [],
      next_steps: result.nextSteps || [],
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

    // Transform to snake_case for iOS
    res.json({
      session_stats: sessionStats[0] || { total_sessions: 0, completed_sessions: 0, avg_duration: 0 },
      client_stats: clientStats.map(c => ({
        client_id: c.clientId,
        client_name: c.clientName,
        session_count: c.sessionCount,
      })),
      session_type_stats: sessionTypeStats.map(s => ({
        session_type: s.sessionType,
        count: s.count,
      })),
      progress_stats: progressStats.map(p => ({
        avg_progress_rating: p.avgProgressRating,
        risk_level: p.riskLevel,
        risk_count: p.riskCount,
      })),
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

    // Transform to snake_case for iOS
    const detail = sessionDetails[0];
    res.json({
      id: detail.id,
      client_id: detail.clientId,
      client_name: detail.clientName,
      session_date: detail.sessionDate,
      session_type: detail.sessionType,
      status: detail.status,
      duration: detail.duration,
      notes: detail.notes,
      progress_note_id: detail.progressNoteId,
      progress_note_content: detail.progressNoteContent,
      themes: detail.themes,
      mood: detail.mood,
      progress_rating: detail.progressRating,
      risk_level: detail.riskLevel,
      interventions: detail.interventions,
      next_steps: detail.nextSteps,
      key_points: detail.keyPoints,
      clinical_observations: detail.clinicalObservations,
    });
  } catch (error) {
    console.error("Error fetching session details:", error);
    res.status(500).json({ error: "Failed to fetch session details" });
  }
});

export default router;