import { storage } from "../storage";
import { googleCalendarService } from "./googleCalendarService";
import { db } from "../db";
import { progressNotes, sessions } from "@shared/schema";
import { eq, and, isNull, sql } from "drizzle-orm";

interface ReconciliationResult {
  sessionsMissingCalendar: any[];
  calendarMissingSession: any[];
  sessionsMissingNotes: any[];
  orphanedNotesLinked: number;
  range: { start: string; end: string };
}

interface LinkingResult {
  linked: number;
  details: Array<{ noteId: string; sessionId: string; clientId: string; sessionDate: string }>;
}

/**
 * Link orphaned progress notes (those without sessionId) to sessions by matching
 * clientId and sessionDate within a reasonable time window (same day).
 */
export async function linkOrphanedProgressNotes(therapistId: string): Promise<LinkingResult> {
  console.log("Starting orphaned progress note linking for therapist:", therapistId);

  // Find all progress notes without a sessionId for this therapist
  const orphanedNotes = await db
    .select()
    .from(progressNotes)
    .where(
      and(
        eq(progressNotes.therapistId, therapistId),
        isNull(progressNotes.sessionId)
      )
    );

  console.log(`Found ${orphanedNotes.length} orphaned progress notes`);

  const linked: Array<{ noteId: string; sessionId: string; clientId: string; sessionDate: string }> = [];

  for (const note of orphanedNotes) {
    // Find a session for the same client on the same day
    const noteDate = new Date(note.sessionDate);
    const startOfDay = new Date(noteDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(noteDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get sessions for this client on this day
    const matchingSessions = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.clientId, note.clientId),
          eq(sessions.therapistId, therapistId),
          sql`${sessions.scheduledAt} >= ${startOfDay}`,
          sql`${sessions.scheduledAt} <= ${endOfDay}`
        )
      );

    if (matchingSessions.length > 0) {
      // Use the closest session by time
      const closestSession = matchingSessions.reduce((closest, session) => {
        const sessionTime = new Date(session.scheduledAt).getTime();
        const noteTime = noteDate.getTime();
        const closestTime = new Date(closest.scheduledAt).getTime();

        return Math.abs(sessionTime - noteTime) < Math.abs(closestTime - noteTime)
          ? session
          : closest;
      });

      // Update the progress note with the session ID
      await db
        .update(progressNotes)
        .set({
          sessionId: closestSession.id,
          updatedAt: new Date()
        })
        .where(eq(progressNotes.id, note.id));

      linked.push({
        noteId: note.id,
        sessionId: closestSession.id,
        clientId: note.clientId,
        sessionDate: note.sessionDate.toISOString()
      });

      console.log(`Linked progress note ${note.id} to session ${closestSession.id}`);
    }
  }

  console.log(`Successfully linked ${linked.length} orphaned progress notes`);

  return {
    linked: linked.length,
    details: linked
  };
}

/**
 * Link documents to sessions by sessionDate when they're missing session links
 */
export async function linkDocumentsToSessions(therapistId: string): Promise<number> {
  // Get all documents for this therapist that have a progressNoteId but the progress note has no sessionId
  const documentsWithOrphanedNotes = await db.execute(sql`
    SELECT d.id as document_id, d.client_id, pn.id as note_id, pn.session_date
    FROM documents d
    JOIN progress_notes pn ON d.metadata->>'progressNoteId' = pn.id
    WHERE d.therapist_id = ${therapistId}
      AND pn.session_id IS NULL
  `);

  let linkedCount = 0;

  for (const row of documentsWithOrphanedNotes.rows) {
    const noteDate = new Date(row.session_date);
    const startOfDay = new Date(noteDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(noteDate);
    endOfDay.setHours(23, 59, 59, 999);

    const matchingSessions = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.clientId, row.client_id),
          eq(sessions.therapistId, therapistId),
          sql`${sessions.scheduledAt} >= ${startOfDay}`,
          sql`${sessions.scheduledAt} <= ${endOfDay}`
        )
      );

    if (matchingSessions.length > 0) {
      const closestSession = matchingSessions[0];

      // Update the progress note with the session ID
      await db
        .update(progressNotes)
        .set({
          sessionId: closestSession.id,
          updatedAt: new Date()
        })
        .where(eq(progressNotes.id, row.note_id));

      linkedCount++;
    }
  }

  return linkedCount;
}

export async function reconcileCalendar(therapistId: string, start: Date, end: Date): Promise<ReconciliationResult> {
  const sessionsInRange = await storage.getSessionsInDateRange(therapistId, start, end);
  const notes = await storage.getProgressNotesInDateRange(therapistId, start, end);
  const notesBySession = new Set(notes.map((note) => note.sessionId).filter(Boolean));

  let events: any[] = [];
  try {
    events = await googleCalendarService.listEventsInRange(start, end);
  } catch (error) {
    console.warn("Calendar reconciliation skipped Google events:", error);
  }

  const eventIds = new Set(events.map((event) => event.id));
  const sessionsMissingCalendar = sessionsInRange.filter((session) => !session.googleEventId || !eventIds.has(session.googleEventId));
  const sessionEventIds = new Set(sessionsInRange.map((session) => session.googleEventId).filter(Boolean));
  const calendarMissingSession = events.filter((event) => !sessionEventIds.has(event.id));

  const sessionsMissingNotes = sessionsInRange.filter((session) => !notesBySession.has(session.id));

  // Automatically link orphaned progress notes to sessions
  const linkingResult = await linkOrphanedProgressNotes(therapistId);

  return {
    sessionsMissingCalendar,
    calendarMissingSession,
    sessionsMissingNotes,
    orphanedNotesLinked: linkingResult.linked,
    range: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
  };
}
