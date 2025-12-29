import { storage } from "../storage";
import { googleCalendarService } from "./googleCalendarService";

interface ReconciliationResult {
  sessionsMissingCalendar: any[];
  calendarMissingSession: any[];
  sessionsMissingNotes: any[];
  range: { start: string; end: string };
}

export async function reconcileCalendar(therapistId: string, start: Date, end: Date): Promise<ReconciliationResult> {
  const sessions = await storage.getSessionsInDateRange(therapistId, start, end);
  const notes = await storage.getProgressNotesInDateRange(therapistId, start, end);
  const notesBySession = new Set(notes.map((note) => note.sessionId).filter(Boolean));

  let events: any[] = [];
  try {
    events = await googleCalendarService.listEventsInRange(start, end);
  } catch (error) {
    console.warn("Calendar reconciliation skipped Google events:", error);
  }

  const eventIds = new Set(events.map((event) => event.id));
  const sessionsMissingCalendar = sessions.filter((session) => !session.googleEventId || !eventIds.has(session.googleEventId));
  const sessionEventIds = new Set(sessions.map((session) => session.googleEventId).filter(Boolean));
  const calendarMissingSession = events.filter((event) => !sessionEventIds.has(event.id));

  const sessionsMissingNotes = sessions.filter((session) => !notesBySession.has(session.id));

  return {
    sessionsMissingCalendar,
    calendarMissingSession,
    sessionsMissingNotes,
    range: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
  };
}
