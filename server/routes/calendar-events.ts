import { Router, Request, Response } from "express";
import { db } from "../db";
import { calendarEvents, clients, sessions } from "@shared/schema";
import { eq, and, gte, lte, desc, or } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// Extend Express Request type for therapist authentication
interface AuthenticatedRequest extends Request {
  therapistId: string;
  therapistName: string;
}

// Validation schemas
const createCalendarEventSchema = z.object({
  externalId: z.string(),
  source: z.enum(["google", "simplepractice", "therapyflow"]),
  title: z.string(),
  description: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  startTime: z.string().transform((s) => new Date(s)),
  endTime: z.string().transform((s) => new Date(s)),
  isAllDay: z.boolean().optional().default(false),
  attendees: z.array(z.string()).optional().default([]),
  linkedClientId: z.string().optional().nullable(),
  linkedSessionId: z.string().optional().nullable(),
  rawData: z.any().optional(),
});

const updateCalendarEventSchema = createCalendarEventSchema.partial();

const syncCalendarEventsSchema = z.object({
  events: z.array(createCalendarEventSchema),
  source: z.enum(["google", "simplepractice", "therapyflow"]),
});

// Helper to convert to snake_case for iOS compatibility
function toSnakeCaseEvent(event: any): any {
  if (!event) return event;
  return {
    id: event.id,
    therapist_id: event.therapistId,
    external_id: event.externalId,
    source: event.source,
    title: event.title,
    description: event.description,
    location: event.location,
    start_time: event.startTime,
    end_time: event.endTime,
    is_all_day: event.isAllDay,
    attendees: event.attendees,
    linked_client_id: event.linkedClientId,
    linked_session_id: event.linkedSessionId,
    sync_status: event.syncStatus,
    last_synced_at: event.lastSyncedAt,
    sync_error: event.syncError,
    recurring_event_id: event.recurringEventId,
    is_recurring: event.isRecurring,
    created_at: event.createdAt,
    updated_at: event.updatedAt,
  };
}

// GET /api/calendar-events - Get all calendar events with optional date filtering
router.get("/", async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { startDate, endDate, source } = req.query;

    let query = db
      .select()
      .from(calendarEvents)
      .where(eq(calendarEvents.therapistId, authReq.therapistId));

    // Build conditions array
    const conditions = [eq(calendarEvents.therapistId, authReq.therapistId)];

    if (startDate) {
      conditions.push(gte(calendarEvents.startTime, new Date(startDate as string)));
    }
    if (endDate) {
      conditions.push(lte(calendarEvents.endTime, new Date(endDate as string)));
    }
    if (source) {
      conditions.push(eq(calendarEvents.source, source as string));
    }

    const events = await db
      .select()
      .from(calendarEvents)
      .where(and(...conditions))
      .orderBy(desc(calendarEvents.startTime));

    res.json(events.map(toSnakeCaseEvent));
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    res.status(500).json({ error: "Failed to fetch calendar events" });
  }
});

// GET /api/calendar-events/:id - Get a single calendar event
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;

    const [event] = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.id, id),
          eq(calendarEvents.therapistId, authReq.therapistId)
        )
      );

    if (!event) {
      return res.status(404).json({ error: "Calendar event not found" });
    }

    res.json(toSnakeCaseEvent(event));
  } catch (error) {
    console.error("Error fetching calendar event:", error);
    res.status(500).json({ error: "Failed to fetch calendar event" });
  }
});

// POST /api/calendar-events - Create a new calendar event
router.post("/", async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const eventData = createCalendarEventSchema.parse(req.body);

    const [event] = await db
      .insert(calendarEvents)
      .values({
        ...eventData,
        therapistId: authReq.therapistId,
        lastSyncedAt: new Date(),
      })
      .returning();

    res.status(201).json(toSnakeCaseEvent(event));
  } catch (error) {
    console.error("Error creating calendar event:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid event data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to create calendar event" });
  }
});

// PUT /api/calendar-events/:id - Update a calendar event
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const eventData = updateCalendarEventSchema.parse(req.body);

    const [event] = await db
      .update(calendarEvents)
      .set({
        ...eventData,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(calendarEvents.id, id),
          eq(calendarEvents.therapistId, authReq.therapistId)
        )
      )
      .returning();

    if (!event) {
      return res.status(404).json({ error: "Calendar event not found" });
    }

    res.json(toSnakeCaseEvent(event));
  } catch (error) {
    console.error("Error updating calendar event:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid event data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update calendar event" });
  }
});

// DELETE /api/calendar-events/:id - Delete a calendar event
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;

    const [event] = await db
      .delete(calendarEvents)
      .where(
        and(
          eq(calendarEvents.id, id),
          eq(calendarEvents.therapistId, authReq.therapistId)
        )
      )
      .returning();

    if (!event) {
      return res.status(404).json({ error: "Calendar event not found" });
    }

    res.json({ success: true, message: "Calendar event deleted" });
  } catch (error) {
    console.error("Error deleting calendar event:", error);
    res.status(500).json({ error: "Failed to delete calendar event" });
  }
});

// POST /api/calendar-events/sync - Bulk sync events from external source
router.post("/sync", async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { events, source } = syncCalendarEventsSchema.parse(req.body);

    const results = {
      created: 0,
      updated: 0,
      deleted: 0,
      errors: [] as string[],
    };

    // Get all existing events from this source
    const existingEvents = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.therapistId, authReq.therapistId),
          eq(calendarEvents.source, source)
        )
      );

    const existingByExternalId = new Map(
      existingEvents.map((e) => [e.externalId, e])
    );
    const incomingExternalIds = new Set(events.map((e) => e.externalId));

    // Process each incoming event
    for (const eventData of events) {
      try {
        const existing = existingByExternalId.get(eventData.externalId);

        if (existing) {
          // Update existing event
          await db
            .update(calendarEvents)
            .set({
              title: eventData.title,
              description: eventData.description,
              location: eventData.location,
              startTime: eventData.startTime,
              endTime: eventData.endTime,
              isAllDay: eventData.isAllDay,
              attendees: eventData.attendees,
              linkedClientId: eventData.linkedClientId,
              linkedSessionId: eventData.linkedSessionId,
              rawData: eventData.rawData,
              syncStatus: "synced",
              lastSyncedAt: new Date(),
              syncError: null,
              updatedAt: new Date(),
            })
            .where(eq(calendarEvents.id, existing.id));
          results.updated++;
        } else {
          // Create new event
          await db.insert(calendarEvents).values({
            ...eventData,
            source,
            therapistId: authReq.therapistId,
            syncStatus: "synced",
            lastSyncedAt: new Date(),
          });
          results.created++;
        }
      } catch (error) {
        results.errors.push(`Failed to sync event ${eventData.externalId}: ${error}`);
      }
    }

    // Delete events that are no longer in the external source
    for (const existing of existingEvents) {
      if (!incomingExternalIds.has(existing.externalId)) {
        try {
          await db.delete(calendarEvents).where(eq(calendarEvents.id, existing.id));
          results.deleted++;
        } catch (error) {
          results.errors.push(`Failed to delete event ${existing.externalId}: ${error}`);
        }
      }
    }

    res.json({
      success: true,
      results,
      message: `Synced ${results.created} new, ${results.updated} updated, ${results.deleted} deleted`,
    });
  } catch (error) {
    console.error("Error syncing calendar events:", error);
    console.error("Error details:", {
      name: error instanceof Error ? error.name : 'unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid sync data", details: error.errors });
    }
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: "Failed to sync calendar events", details: errorMessage });
  }
});

// GET /api/calendar-events/pending - Get events pending sync (created/modified locally)
router.get("/pending/sync", async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;

    const pendingEvents = await db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.therapistId, authReq.therapistId),
          or(
            eq(calendarEvents.syncStatus, "pending_create"),
            eq(calendarEvents.syncStatus, "pending_update"),
            eq(calendarEvents.syncStatus, "pending_delete")
          )
        )
      );

    res.json(pendingEvents.map(toSnakeCaseEvent));
  } catch (error) {
    console.error("Error fetching pending events:", error);
    res.status(500).json({ error: "Failed to fetch pending events" });
  }
});

// POST /api/calendar-events/:id/mark-synced - Mark an event as synced
router.post("/:id/mark-synced", async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { externalId } = req.body;

    const [event] = await db
      .update(calendarEvents)
      .set({
        externalId: externalId || undefined,
        syncStatus: "synced",
        lastSyncedAt: new Date(),
        syncError: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(calendarEvents.id, id),
          eq(calendarEvents.therapistId, authReq.therapistId)
        )
      )
      .returning();

    if (!event) {
      return res.status(404).json({ error: "Calendar event not found" });
    }

    res.json(toSnakeCaseEvent(event));
  } catch (error) {
    console.error("Error marking event as synced:", error);
    res.status(500).json({ error: "Failed to mark event as synced" });
  }
});

// POST /api/calendar-events/:id/mark-error - Mark an event sync as failed
router.post("/:id/mark-error", async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { id } = req.params;
    const { error: syncError } = req.body;

    const [event] = await db
      .update(calendarEvents)
      .set({
        syncStatus: "error",
        syncError: syncError || "Unknown error",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(calendarEvents.id, id),
          eq(calendarEvents.therapistId, authReq.therapistId)
        )
      )
      .returning();

    if (!event) {
      return res.status(404).json({ error: "Calendar event not found" });
    }

    res.json(toSnakeCaseEvent(event));
  } catch (error) {
    console.error("Error marking event error:", error);
    res.status(500).json({ error: "Failed to mark event error" });
  }
});

export default router;
