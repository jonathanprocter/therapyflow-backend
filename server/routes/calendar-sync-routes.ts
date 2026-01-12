/**
 * Smart Calendar Sync Routes
 * API endpoints for enhanced calendar synchronization
 */

import { Router, Request, Response } from "express";
import { smartCalendarSync, syncScheduler, TriggerSource } from "../services/smart-calendar-sync";
import { storage } from "../storage";

const router = Router();

// Middleware to get therapist ID from session
const getTherapistId = (req: Request): string => {
  return (req as any).user?.id || req.headers["x-therapist-id"] as string || "";
};

/**
 * GET /api/calendar-sync/status
 * Get current sync status
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const therapistId = getTherapistId(req);
    if (!therapistId) {
      return res.status(401).json({ error: "Therapist ID required" });
    }

    const status = await smartCalendarSync.getSyncStatus(therapistId);
    const schedulerStatus = syncScheduler.getStatus();

    res.json({
      ...status,
      scheduler: schedulerStatus
    });
  } catch (error) {
    console.error("[Calendar Sync Routes] Status error:", error);
    res.status(500).json({ error: "Failed to get sync status" });
  }
});

/**
 * GET /api/calendar-sync/auth-url
 * Get OAuth authorization URL
 */
router.get("/auth-url", async (req: Request, res: Response) => {
  try {
    const therapistId = getTherapistId(req);
    const therapistEmail = req.query.email as string;

    const authUrl = smartCalendarSync.getAuthUrl(therapistEmail);

    res.json({ authUrl });
  } catch (error) {
    console.error("[Calendar Sync Routes] Auth URL error:", error);
    res.status(500).json({ error: "Failed to generate auth URL" });
  }
});

/**
 * GET /api/calendar-sync/callback
 * OAuth callback handler
 */
router.get("/callback", async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;
    const therapistId = getTherapistId(req) || state as string;

    if (!code || !therapistId) {
      return res.status(400).json({ error: "Missing code or therapist ID" });
    }

    await smartCalendarSync.exchangeCodeForTokens(code as string, therapistId);

    // Redirect to frontend success page
    res.redirect("/settings/calendar?connected=true");
  } catch (error) {
    console.error("[Calendar Sync Routes] Callback error:", error);
    res.redirect("/settings/calendar?error=auth_failed");
  }
});

/**
 * POST /api/calendar-sync/sync
 * Trigger a calendar sync
 */
router.post("/sync", async (req: Request, res: Response) => {
  try {
    const therapistId = getTherapistId(req);
    if (!therapistId) {
      return res.status(401).json({ error: "Therapist ID required" });
    }

    const { forceFullSync = false, triggerSource = "user_manual" } = req.body;

    const result = await smartCalendarSync.syncWithDetailedTracking(
      therapistId,
      triggerSource as TriggerSource,
      forceFullSync
    );

    res.json(result);
  } catch (error) {
    console.error("[Calendar Sync Routes] Sync error:", error);
    res.status(500).json({ error: "Failed to sync calendar" });
  }
});

/**
 * GET /api/calendar-sync/history
 * Get sync history
 */
router.get("/history", async (req: Request, res: Response) => {
  try {
    const therapistId = getTherapistId(req);
    if (!therapistId) {
      return res.status(401).json({ error: "Therapist ID required" });
    }

    // Validate and clamp limit to reasonable bounds
    let limit = parseInt(req.query.limit as string) || 20;
    limit = Math.max(1, Math.min(limit, 100)); // Between 1 and 100

    const history = await smartCalendarSync.getSyncHistory(therapistId, limit);

    res.json({ history });
  } catch (error) {
    console.error("[Calendar Sync Routes] History error:", error);
    res.status(500).json({ error: "Failed to get sync history" });
  }
});

/**
 * POST /api/calendar-sync/alias
 * Create an event alias for client matching
 */
router.post("/alias", async (req: Request, res: Response) => {
  try {
    const therapistId = getTherapistId(req);
    if (!therapistId) {
      return res.status(401).json({ error: "Therapist ID required" });
    }

    const { clientId, pattern, matchType = "contains" } = req.body;

    if (!clientId || !pattern) {
      return res.status(400).json({ error: "clientId and pattern are required" });
    }

    await smartCalendarSync.createEventAlias(therapistId, clientId, pattern, matchType);

    res.json({ success: true, message: "Alias created" });
  } catch (error) {
    console.error("[Calendar Sync Routes] Alias error:", error);
    res.status(500).json({ error: "Failed to create alias" });
  }
});

/**
 * GET /api/calendar-sync/aliases
 * Get all event aliases
 */
router.get("/aliases", async (req: Request, res: Response) => {
  try {
    const therapistId = getTherapistId(req);
    if (!therapistId) {
      return res.status(401).json({ error: "Therapist ID required" });
    }

    const aliases = await storage.getEventAliases?.(therapistId) || [];

    res.json({ aliases });
  } catch (error) {
    console.error("[Calendar Sync Routes] Get aliases error:", error);
    res.status(500).json({ error: "Failed to get aliases" });
  }
});

/**
 * DELETE /api/calendar-sync/alias/:aliasId
 * Delete an event alias
 */
router.delete("/alias/:aliasId", async (req: Request, res: Response) => {
  try {
    const therapistId = getTherapistId(req);
    if (!therapistId) {
      return res.status(401).json({ error: "Therapist ID required" });
    }

    const { aliasId } = req.params;
    await storage.deleteEventAlias?.(aliasId);

    res.json({ success: true });
  } catch (error) {
    console.error("[Calendar Sync Routes] Delete alias error:", error);
    res.status(500).json({ error: "Failed to delete alias" });
  }
});

/**
 * POST /api/calendar-sync/scheduler/start
 * Start the background sync scheduler
 */
router.post("/scheduler/start", async (req: Request, res: Response) => {
  try {
    syncScheduler.start();
    res.json({ success: true, status: syncScheduler.getStatus() });
  } catch (error) {
    console.error("[Calendar Sync Routes] Scheduler start error:", error);
    res.status(500).json({ error: "Failed to start scheduler" });
  }
});

/**
 * POST /api/calendar-sync/scheduler/stop
 * Stop the background sync scheduler
 */
router.post("/scheduler/stop", async (req: Request, res: Response) => {
  try {
    syncScheduler.stop();
    res.json({ success: true, status: syncScheduler.getStatus() });
  } catch (error) {
    console.error("[Calendar Sync Routes] Scheduler stop error:", error);
    res.status(500).json({ error: "Failed to stop scheduler" });
  }
});

export default router;
