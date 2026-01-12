import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { clients, sessions, progressNotes, documents, sessionPreps, longitudinalRecords, treatmentPlans, allianceScores } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { aiService } from "./services/aiService";
import { calendarService } from "./services/calendarService";
import { pdfService } from "./services/pdfService";
import { documentProcessor } from "./services/documentProcessor";
import { enhancedDocumentProcessor } from "./services/enhanced-document-processor";
import { googleCalendarService } from "./services/googleCalendarService";
import { sessionSummaryGenerator } from "./services/session-summary-generator";
import { getJob, listJobs, retryJob } from "./services/jobQueue";
import { bulkImportProgressNotes } from "./services/bulkNoteImport";
import { generateSessionPrep } from "./services/sessionPrepGenerator";
import { generateLongitudinalTracking, formatLongitudinalContext } from "./services/longitudinalTracking";
import { checkRiskEscalation } from "./services/riskMonitor";
import { buildGoalSignals } from "./services/goalSignals";
import {
  insertClientSchema,
  insertSessionSchema,
  insertProgressNoteSchema,
  insertCaseConceptualizationSchema,
  insertTreatmentPlanSchema,
  insertAllianceScoreSchema,
  type InsertProgressNote,
  type InsertClient,
  type InsertSession
} from "@shared/schema";
import multer from "multer";
import { registerTranscriptRoutes } from "./routes/transcript-routes";
import { aiRoutes } from "./routes/ai-routes";
import aiServicesRoutes from "./routes/ai-services-routes";
import calendarSyncRoutes from "./routes/calendar-sync-routes";
import reportRoutes from "./routes/report-routes";
import { verifyClientOwnership, SecureClientQueries } from "./middleware/clientAuth";
import { ClinicalTransactions } from "./utils/transactions";
import { encryptClientData, decryptClientData, ClinicalEncryption } from "./utils/encryption";
import { ClinicalAuditLogger, AuditAction } from "./utils/auditLogger";
import { getAppSetting, setAppSetting } from "./utils/appSettings";
import { buildRetentionReport, applyRetention } from "./services/retentionService";
import { reconcileCalendar } from "./services/calendarReconciliation";

// Helper function to safely decrypt content (handles non-encrypted legacy data)
function safeDecrypt(content: string): string | null {
  if (!content) return null;

  try {
    // Check if content looks encrypted (new format with colons or legacy hex)
    if ((content.includes(':') && content.length > 50) ||
        (/^[0-9a-fA-F]+$/.test(content) && content.length > 32)) {
      return ClinicalEncryption.decrypt(content);
    }
    // Return as-is if not encrypted (legacy data)
    return content;
  } catch (error: any) {
    console.warn('[DECRYPTION] Failed to decrypt, returning original content:', error.message);
    return content; // Return original content if decryption fails
  }
}

function extractSection(content: string, label: string): string {
  const regex = new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\n\\*\\*|\\n[A-Z]{2,}:|$)`, "i");
  const match = content.match(regex);
  return match && match[1] ? match[1].trim() : "";
}

function parseSoapSections(content?: string | null) {
  if (!content) {
    return { subjective: "", objective: "", assessment: "", plan: "" };
  }
  const normalized = content.replace(/\r/g, "\n");
  return {
    subjective: extractSection(normalized, "\\*\\*Subjective\\*\\*|Subjective|S"),
    objective: extractSection(normalized, "\\*\\*Objective\\*\\*|Objective|O"),
    assessment: extractSection(normalized, "\\*\\*Assessment\\*\\*|Assessment|A"),
    plan: extractSection(normalized, "\\*\\*Plan\\*\\*|Plan|P"),
  };
}

function safeDecryptJson(value: any) {
  if (!value) return value;
  try {
    if (typeof value === "string") {
      return JSON.parse(ClinicalEncryption.decrypt(value));
    }
    if (typeof value === "object" && value.encrypted && typeof value.value === "string") {
      return JSON.parse(ClinicalEncryption.decrypt(value.value));
    }
  } catch (error) {
    console.warn("[DECRYPTION] Failed to decrypt JSON payload:", error);
  }
  return value;
}

const upload = multer({ storage: multer.memoryStorage() });

// Helper to batch fetch clients for sessions (avoids N+1 query problem)
async function attachClientsToSessions<T extends { clientId: string }>(items: T[]): Promise<(T & { client: any })[]> {
  if (items.length === 0) return [];
  const clientIds = [...new Set(items.map(item => item.clientId))];
  const clientsMap = await storage.getClientsByIds(clientIds);
  return items.map(item => ({
    ...item,
    client: clientsMap.get(item.clientId) || null
  }));
}

// Helper to batch fetch clients for progress notes with decryption (avoids N+1 query problem)
async function attachClientsToNotes<T extends { clientId: string; content?: string | null }>(notes: T[]): Promise<(T & { client: any; clientName: string | null; content: string | null })[]> {
  if (notes.length === 0) return [];
  const clientIds = [...new Set(notes.map(note => note.clientId))];
  const clientsMap = await storage.getClientsByIds(clientIds);
  return notes.map(note => {
    const client = clientsMap.get(note.clientId) || null;
    return {
      ...note,
      client,
      clientName: client?.name ?? null,
      content: note.content ? safeDecrypt(note.content) : null
    };
  });
}

// Extend Express Request type for therapist authentication
interface AuthenticatedRequest extends Request {
  therapistId: string;
  therapistName: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Single-therapist mode - no authentication required
  // therapistId is set by middleware in index.ts

  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString()
    });
  });

  // Dashboard stats
  app.get("/api/dashboard/stats", async (req: any, res) => {
    try {
      const stats = await storage.getTherapistStats(req.therapistId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Clients endpoints
  app.get("/api/clients", async (req: any, res) => {
    try {
      const therapistId = req.therapistId || 'therapist-1';
      const clients = await storage.getClients(therapistId);
      res.json(clients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.get("/api/clients/:id", verifyClientOwnership, async (req: any, res) => {
    try {
      // Client ownership already verified by middleware
      const client = req.verifiedClient;
      
      // Decrypt sensitive data before sending to client
      const decryptedClient = decryptClientData(client);
      res.json(decryptedClient);
    } catch (error) {
      console.error("Error fetching client:", error);
      res.status(500).json({ error: "Failed to fetch client" });
    }
  });

  app.post("/api/clients", async (req: any, res) => {
    try {
      const clientData = insertClientSchema.parse({
        ...req.body,
        therapistId: req.therapistId
      });
      
      // Encrypt sensitive data before storing
      const encryptedClientData = encryptClientData(clientData);
      const client = await storage.createClient(encryptedClientData);
      
      // Decrypt before sending response
      const decryptedClient = decryptClientData(client);
      res.json(decryptedClient);
    } catch (error) {
      console.error("Error creating client:", error);
      res.status(400).json({ error: "Failed to create client" });
    }
  });

  app.put("/api/clients/:id", async (req: any, res) => {
    try {
      const clientData = insertClientSchema.partial().parse(req.body);
      const therapistId = req.therapistId;
      
      // Use secure transaction for client updates
      const client = await ClinicalTransactions.updateClientSafely(
        req.params.id,
        therapistId,
        clientData
      );
      
      // Decrypt before sending response
      const decryptedClient = decryptClientData(client);
      res.json(decryptedClient);
    } catch (error) {
      console.error("Error updating client:", error);
      if (error instanceof Error && error.message === 'Client access denied') {
        return res.status(403).json({ error: "Access denied" });
      }
      res.status(400).json({ error: "Failed to update client" });
    }
  });

  app.delete("/api/clients/:id", async (req: any, res) => {
    try {
      const clientId = req.params.id;
      const therapistId = req.therapistId;

      // Use secure soft delete (recommended for audit compliance)
      const result = await ClinicalTransactions.softDeleteClient(clientId, therapistId);

      res.json({ 
        success: true, 
        message: `Client ${result.name} has been deactivated successfully` 
      });
    } catch (error) {
      console.error("Error deleting client:", error);
      if (error instanceof Error && error.message === 'Client access denied') {
        return res.status(403).json({ error: "Access denied" });
      }
      res.status(500).json({ 
        error: "Failed to delete client", 
        details: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  app.get("/api/clients/:clientId/export", verifyClientOwnership, async (req: any, res) => {
    try {
      const clientId = req.params.clientId;
      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      const [sessionsData, notesData, docsData, planData, allianceData, prepData, longitudinalData] = await Promise.all([
        db.select().from(sessions).where(eq(sessions.clientId, clientId)),
        db.select().from(progressNotes).where(eq(progressNotes.clientId, clientId)),
        db.select().from(documents).where(eq(documents.clientId, clientId)),
        db.select().from(treatmentPlans).where(eq(treatmentPlans.clientId, clientId)),
        db.select().from(allianceScores).where(eq(allianceScores.clientId, clientId)),
        db.select().from(sessionPreps).where(eq(sessionPreps.clientId, clientId)),
        db.select().from(longitudinalRecords).where(eq(longitudinalRecords.clientId, clientId)),
      ]);

      const exportPayload = {
        client,
        sessions: sessionsData,
        progressNotes: notesData.map((note) => ({
          ...note,
          content: note.content ? safeDecrypt(note.content) : null,
        })),
        documents: docsData,
        treatmentPlans: planData,
        allianceScores: allianceData,
        sessionPreps: prepData.map((prep) => ({
          ...prep,
          prep: safeDecryptJson(prep.prep),
        })),
        longitudinalRecords: longitudinalData.map((record) => ({
          ...record,
          record: safeDecryptJson(record.record),
          analysis: safeDecryptJson(record.analysis),
        })),
        exportedAt: new Date().toISOString(),
      };

      await ClinicalAuditLogger.logPHIAccess(
        req.therapistId,
        AuditAction.DATA_EXPORT,
        clientId,
        req,
        { exportSize: JSON.stringify(exportPayload).length }
      );

      res.json(exportPayload);
    } catch (error) {
      console.error("Error exporting client data:", error);
      res.status(500).json({ error: "Failed to export client data" });
    }
  });

  app.get("/api/settings/retention", async (req: any, res) => {
    try {
      const settings = await getAppSetting("data_retention");
      res.json(settings || { enabled: false, retentionDays: 365 });
    } catch (error) {
      console.error("Error fetching retention settings:", error);
      res.status(500).json({ error: "Failed to fetch retention settings" });
    }
  });

  app.put("/api/settings/retention", async (req: any, res) => {
    try {
      const { enabled, retentionDays } = req.body || {};
      const updated = {
        enabled: Boolean(enabled),
        retentionDays: Number(retentionDays || 365),
      };
      await setAppSetting("data_retention", updated);
      res.json(updated);
    } catch (error) {
      console.error("Error updating retention settings:", error);
      res.status(500).json({ error: "Failed to update retention settings" });
    }
  });

  app.get("/api/settings/risk-thresholds", async (req: any, res) => {
    try {
      const settings = await getAppSetting("risk_thresholds");
      res.json(settings || { alertAt: "high", trendWindow: 3 });
    } catch (error) {
      console.error("Error fetching risk thresholds:", error);
      res.status(500).json({ error: "Failed to fetch risk thresholds" });
    }
  });

  app.put("/api/settings/risk-thresholds", async (req: any, res) => {
    try {
      const { alertAt, trendWindow } = req.body || {};
      const updated = {
        alertAt: alertAt || "high",
        trendWindow: Number(trendWindow || 3),
      };
      await setAppSetting("risk_thresholds", updated);
      res.json(updated);
    } catch (error) {
      console.error("Error updating risk thresholds:", error);
      res.status(500).json({ error: "Failed to update risk thresholds" });
    }
  });

  app.get("/api/settings/retention/report", async (req: any, res) => {
    try {
      const retentionDays = Number(req.query.retentionDays || 365);
      const report = await buildRetentionReport(retentionDays);
      res.json(report);
    } catch (error) {
      console.error("Error generating retention report:", error);
      res.status(500).json({ error: "Failed to generate retention report" });
    }
  });

  app.post("/api/settings/retention/apply", async (req: any, res) => {
    try {
      const { retentionDays } = req.body || {};
      const result = await applyRetention(Number(retentionDays || 365));
      res.json(result);
    } catch (error) {
      console.error("Error applying retention policy:", error);
      res.status(500).json({ error: "Failed to apply retention policy" });
    }
  });

  // AI Provider settings endpoint - receives preference from iOS app
  app.get("/api/settings/ai-provider", async (req: any, res) => {
    try {
      const settings = await getAppSetting("ai_provider");
      res.json(settings || {
        provider: "anthropic",
        configured: !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY)
      });
    } catch (error) {
      console.error("Error fetching AI provider settings:", error);
      res.status(500).json({ error: "Failed to fetch AI provider settings" });
    }
  });

  app.post("/api/settings/ai-provider", async (req: any, res) => {
    try {
      const { provider } = req.body || {};
      const validProviders = ["anthropic", "openai"];

      if (!provider || !validProviders.includes(provider)) {
        return res.status(400).json({ error: "Invalid provider. Must be 'anthropic' or 'openai'" });
      }

      const updated = {
        provider,
        configured: provider === "anthropic"
          ? !!process.env.ANTHROPIC_API_KEY
          : !!process.env.OPENAI_API_KEY,
        updatedAt: new Date().toISOString()
      };

      await setAppSetting("ai_provider", updated);
      console.log(`AI provider preference updated to: ${provider}`);
      res.json(updated);
    } catch (error) {
      console.error("Error updating AI provider settings:", error);
      res.status(500).json({ error: "Failed to update AI provider settings" });
    }
  });

  app.post("/api/clients/:clientId/longitudinal/generate", verifyClientOwnership, async (req: any, res) => {
    try {
      const clientId = req.params.clientId;
      const record = await generateLongitudinalTracking(clientId, req.therapistId);
      await ClinicalAuditLogger.logAIActivity(
        req.therapistId,
        AuditAction.AI_ANALYSIS,
        { clientId },
        req
      );
      res.json(record);
    } catch (error) {
      console.error("Error generating longitudinal analysis:", error);
      res.status(500).json({ error: "Failed to generate longitudinal analysis" });
    }
  });

  app.get("/api/clients/:clientId/longitudinal/latest", verifyClientOwnership, async (req: any, res) => {
    try {
      const clientId = req.params.clientId;
      const record = await storage.getLatestLongitudinalRecord(clientId);
      if (!record) {
        return res.status(404).json({ error: "No longitudinal analysis found" });
      }
      res.json(record);
    } catch (error) {
      console.error("Error fetching latest longitudinal analysis:", error);
      res.status(500).json({ error: "Failed to fetch longitudinal analysis" });
    }
  });

  app.get("/api/clients/:clientId/longitudinal/history", verifyClientOwnership, async (req: any, res) => {
    try {
      const clientId = req.params.clientId;
      const limit = Number(req.query.limit || 10);
      const history = await storage.getLongitudinalHistory(clientId, limit);
      res.json(history);
    } catch (error) {
      console.error("Error fetching longitudinal analysis history:", error);
      res.status(500).json({ error: "Failed to fetch longitudinal analysis history" });
    }
  });

  app.get("/api/clients/:clientId/goal-signals", verifyClientOwnership, async (req: any, res) => {
    try {
      const clientId = req.params.clientId;
      const signals = await buildGoalSignals(clientId);
      res.json({ signals });
    } catch (error) {
      console.error("Error fetching goal signals:", error);
      res.status(500).json({ error: "Failed to fetch goal signals" });
    }
  });

  // Sessions endpoints
  app.get("/api/sessions", async (req: any, res) => {
    try {
      const { clientId, client_id, upcoming, today, date, includePast, limit } = req.query;
      // Support both clientId and client_id for iOS compatibility
      const effectiveClientId = clientId || client_id;
      // Parse limit with sensible defaults and max cap
      const maxLimit = Math.min(parseInt(limit as string) || 500, 1000);

      if (today === "true") {
        const sessions = await storage.getTodaysSessions(req.therapistId);
        // Batch fetch clients (single query instead of N+1)
        const sessionsWithClients = await attachClientsToSessions(sessions.slice(0, maxLimit));
        res.json(sessionsWithClients);
      } else if (upcoming === "true") {
        const sessions = await storage.getUpcomingSessions(req.therapistId, new Date());
        // Batch fetch clients (single query instead of N+1)
        const sessionsWithClients = await attachClientsToSessions(sessions.slice(0, maxLimit));
        res.json(sessionsWithClients);
      } else if (includePast === "true") {
        // Get all historical sessions (past and upcoming)
        const sessions = await storage.getAllHistoricalSessions(req.therapistId, true);
        // Batch fetch clients (single query instead of N+1)
        const sessionsWithClients = await attachClientsToSessions(sessions.slice(0, maxLimit));
        res.json(sessionsWithClients);
      } else if (date) {
        // Filter sessions for a specific date with proper timezone handling
        const sessions = await storage.getSessionsByDate(req.therapistId, new Date(date));
        // Batch fetch clients (single query instead of N+1)
        const sessionsWithClients = await attachClientsToSessions(sessions.slice(0, maxLimit));
        res.json(sessionsWithClients);
      } else if (effectiveClientId) {
        const sessions = await storage.getSessions(effectiveClientId);
        const sessionsWithClients = await attachClientsToSessions(sessions.slice(0, maxLimit));
        res.json(sessionsWithClients);
      } else {
        // Return all upcoming and recent sessions for the therapist if no specific filter
        const sessions = await storage.getUpcomingSessions(req.therapistId, new Date('2010-01-01'));
        // Batch fetch clients (single query instead of N+1)
        const sessionsWithClients = await attachClientsToSessions(sessions.slice(0, maxLimit));
        res.json(sessionsWithClients);
      }
    } catch (error) {
      console.error("Error fetching sessions:", error);
      res.status(500).json({ error: "Failed to fetch sessions" });
    }
  });

  app.post("/api/sessions", async (req: any, res) => {
    try {
      const sessionData = insertSessionSchema.parse({
        ...req.body,
        therapistId: req.therapistId
      });

      const session = await storage.createSession(sessionData);

      // Sync to Google Calendar if client email is available
      const client = await storage.getClient(session.clientId);
      if (client?.email) {
        const endTime = new Date(session.scheduledAt);
        endTime.setMinutes(endTime.getMinutes() + session.duration);

        const googleEventId = await calendarService.syncSessionToCalendar(
          client.name,
          session.sessionType,
          session.scheduledAt,
          endTime,
          client.email
        );

        if (googleEventId) {
          await storage.updateSession(session.id, { googleEventId });
        }
      }

      res.json(session);
    } catch (error) {
      console.error("Error creating session:", error);
      res.status(400).json({ error: "Failed to create session" });
    }
  });

  // Session management endpoints
  app.get("/api/sessions/:id", async (req: any, res) => {
    try {
      const session = await storage.getSession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Fetch client data for the session
      const client = await storage.getClient(session.clientId);
      res.json({ ...session, client });
    } catch (error) {
      console.error("Error fetching session:", error);
      res.status(500).json({ error: "Failed to fetch session" });
    }
  });

  app.put("/api/sessions/:id", async (req: any, res) => {
    try {
      const sessionData = insertSessionSchema.partial().parse(req.body);
      const session = await storage.updateSession(req.params.id, sessionData);
      res.json(session);
    } catch (error) {
      console.error("Error updating session:", error);
      res.status(400).json({ error: "Failed to update session" });
    }
  });

  app.get("/api/sessions/:id/prep", async (req: any, res) => {
    try {
      const { clientId } = req.query;
      const sessionId = req.params.id;

      // Get session details
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Get client information
      const client = await storage.getClient(clientId || session.clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      // Get recent progress notes for context
      const recentNotes = await storage.getProgressNotes(client.id);
      const lastThreeNotes = recentNotes.slice(0, 3);

      // Get case conceptualization
      const caseConceptualization = await storage.getCaseConceptualization(client.id);

      // Get treatment plan
      const treatmentPlan = await storage.getTreatmentPlan(client.id);

      // Get recent completed sessions
      const completedSessions = await storage.getCompletedSessions(req.therapistId, client.id);
      const lastThreeSessions = completedSessions.slice(0, 3);

      res.json({
        session: { ...session, client },
        client,
        recentNotes: lastThreeNotes,
        caseConceptualization,
        treatmentPlan,
        recentSessions: lastThreeSessions,
        prepSuggestions: {
          focusAreas: [],
          interventions: treatmentPlan?.interventions || [],
          riskFactors: []
        }
      });
    } catch (error) {
      console.error("Error fetching session prep data:", error);
      res.status(500).json({ error: "Failed to fetch session preparation data" });
    }
  });

  app.post("/api/sessions/:id/prep-ai", async (req: any, res) => {
    try {
      const sessionId = req.params.id;
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const client = await storage.getClient(session.clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      const treatmentPlan = await storage.getTreatmentPlan(client.id);
      const notes = await storage.getProgressNotes(client.id);
      const recentNotes = notes.slice(0, 5).map((note, idx) => {
        const decrypted = safeDecrypt(note.content || "") || "";
        const soap = parseSoapSections(decrypted);
        return {
          sessionDate: new Date(note.sessionDate).toISOString().split("T")[0],
          sessionNumber: idx + 1,
          subjective: soap.subjective,
          objective: soap.objective,
          assessment: soap.assessment,
          plan: soap.plan,
          themes: note.tags || [],
          tonalAnalysis: "",
          significantQuotes: [],
          keywords: note.aiTags || [],
          riskLevel: (note.riskLevel || "none") as any,
          riskNotes: note.processingNotes || "",
          homeworkAssigned: [],
          interventionsUsed: note.aiTags || [],
          followUpItems: [],
        };
      });

      const longitudinalRecord = await storage.getLatestLongitudinalRecord(client.id);
      const longitudinalContext = longitudinalRecord?.analysis
        ? formatLongitudinalContext(longitudinalRecord.analysis)
        : null;

      const prep = await generateSessionPrep({
        client: {
          firstName: client.name.split(" ")[0],
          treatmentStartDate: client.createdAt ? new Date(client.createdAt).toISOString().split("T")[0] : null,
          primaryDiagnosis: treatmentPlan?.diagnosis || null,
          secondaryDiagnoses: [],
          treatmentGoals: (treatmentPlan?.goals as any)?.map((goal: any) => goal.description || String(goal)) || [],
          preferredModalities: (client as any).preferredModalities || [],
          clinicalConsiderations: (client as any).clinicalConsiderations || [],
          medications: [],
        },
        previousNotes: recentNotes,
        upcomingSessionDate: new Date(session.scheduledAt).toISOString().split("T")[0],
        includePatternAnalysis: true,
        longitudinalContext,
      });

      await ClinicalAuditLogger.logAIActivity(
        req.therapistId,
        AuditAction.AI_ANALYSIS,
        { clientId: client.id, confidence: prep?.clinical_flags?.risk_level ? 0.8 : undefined },
        req
      );

      const savedPrep = await storage.createSessionPrep(session.id, client.id, session.therapistId, prep);
      res.json({ success: true, prep, prepId: savedPrep.id });
    } catch (error) {
      console.error("Error generating AI session prep:", error);
      res.status(500).json({ error: "Failed to generate AI session prep" });
    }
  });

  app.get("/api/sessions/:id/prep-ai/latest", async (req: any, res) => {
    try {
      const sessionId = req.params.id;
      const prep = await storage.getLatestSessionPrep(sessionId);
      if (!prep) {
        return res.status(404).json({ error: "No session prep found" });
      }
      res.json(prep);
    } catch (error) {
      console.error("Error fetching latest AI session prep:", error);
      res.status(500).json({ error: "Failed to fetch session prep" });
    }
  });

  app.get("/api/sessions/:id/prep-ai/history", async (req: any, res) => {
    try {
      const sessionId = req.params.id;
      const limit = Number(req.query.limit || 10);
      const history = await storage.getSessionPrepHistory(sessionId, limit);
      res.json(history);
    } catch (error) {
      console.error("Error fetching session prep history:", error);
      res.status(500).json({ error: "Failed to fetch session prep history" });
    }
  });

  // Historical session management endpoints
  app.get("/api/sessions/historical", async (req: any, res) => {
    try {
      const { includeCompleted = "true" } = req.query;
      const sessions = await storage.getAllHistoricalSessions(req.therapistId, includeCompleted === "true");

      // Batch fetch clients (single query instead of N+1)
      const sessionsWithClients = await attachClientsToSessions(sessions);

      res.json(sessionsWithClients);
    } catch (error) {
      console.error("Error fetching historical sessions:", error);
      res.status(500).json({ error: "Failed to fetch historical sessions" });
    }
  });

  app.get("/api/sessions/completed", async (req: any, res) => {
    try {
      const { clientId } = req.query;
      const sessions = await storage.getCompletedSessions(req.therapistId, clientId);

      // Batch fetch clients (single query instead of N+1)
      const sessionsWithClients = await attachClientsToSessions(sessions);

      res.json(sessionsWithClients);
    } catch (error) {
      console.error("Error fetching completed sessions:", error);
      res.status(500).json({ error: "Failed to fetch completed sessions" });
    }
  });

  app.post("/api/sessions/mark-past-completed", async (req: any, res) => {
    try {
      const updatedCount = await storage.markPastSessionsAsCompleted(req.therapistId);
      res.json({ 
        success: true, 
        message: `Marked ${updatedCount} past sessions as completed`,
        updatedCount 
      });
    } catch (error) {
      console.error("Error marking past sessions as completed:", error);
      res.status(500).json({ error: "Failed to mark past sessions as completed" });
    }
  });

  app.post("/api/sessions/create-progress-placeholders", async (req: any, res) => {
    try {
      const createdCount = await storage.createProgressNotePlaceholdersForHistoricalSessions(req.therapistId);
      res.json({ 
        success: true, 
        message: `Created ${createdCount} progress note placeholders for historical sessions`,
        createdCount 
      });
    } catch (error) {
      console.error("Error creating progress note placeholders:", error);
      res.status(500).json({ error: "Failed to create progress note placeholders" });
    }
  });

  // Progress Notes endpoints
  app.get("/api/progress-notes", async (req: any, res) => {
    try {
      const { clientId, client_id, search, recent, limit } = req.query;
      // Support both clientId and client_id for iOS compatibility
      const effectiveClientId = clientId || client_id;
      // Parse limit with sensible defaults and max cap
      const maxLimit = Math.min(parseInt(limit as string) || 100, 1000);

      if (recent === "true") {
        const notes = await storage.getRecentProgressNotes(req.therapistId);
        // Batch fetch clients and decrypt (single query instead of N+1)
        const notesWithClients = await attachClientsToNotes(notes.slice(0, maxLimit));
        res.json(notesWithClients);
      } else if (search) {
        const notes = await storage.searchProgressNotes(req.therapistId, search);
        // Batch fetch clients and decrypt (single query instead of N+1)
        const notesWithClients = await attachClientsToNotes(notes.slice(0, maxLimit));
        res.json(notesWithClients);
      } else if (effectiveClientId) {
        // Verify client ownership before returning notes
        const clientCheck = await SecureClientQueries.getClient(effectiveClientId, req.therapistId);
        if (clientCheck.length === 0) {
          return res.status(403).json({ error: "Access denied" });
        }

        const notes = await storage.getProgressNotes(effectiveClientId);
        const client = clientCheck[0];
        const decryptedNotes = notes.slice(0, maxLimit).map(note => ({
          ...note,
          client,
          clientName: client?.name ?? null,
          content: note.content ? safeDecrypt(note.content) : null
        }));
        res.json(decryptedNotes);
      } else if (limit) {
        // Allow fetching all notes with just a limit parameter
        const notes = await storage.getRecentProgressNotes(req.therapistId);
        const notesWithClients = await attachClientsToNotes(notes.slice(0, maxLimit));
        res.json(notesWithClients);
      } else {
        res.status(400).json({ error: "clientId, search, recent, or limit parameter required" });
      }
    } catch (error) {
      console.error("Error fetching progress notes:", error);
      res.status(500).json({ error: "Failed to fetch progress notes" });
    }
  });

  app.get("/api/progress-notes/:id", async (req: any, res) => {
    try {
      const noteId = req.params.id;
      const note = await storage.getProgressNote(noteId);
      if (!note) {
        return res.status(404).json({ error: "Progress note not found" });
      }

      const clientCheck = await SecureClientQueries.getClient(note.clientId, req.therapistId);
      if (clientCheck.length === 0) {
        return res.status(403).json({ error: "Access denied" });
      }

      const decryptedNote = {
        ...note,
        client: clientCheck[0],
        clientName: clientCheck[0]?.name ?? null,
        content: note.content ? safeDecrypt(note.content) : null
      };

      res.json(decryptedNote);
    } catch (error) {
      console.error("Error fetching progress note:", error);
      res.status(500).json({ error: "Failed to fetch progress note" });
    }
  });

  app.post("/api/progress-notes/bulk-paste", async (req: any, res) => {
    try {
      const { clientId, rawText, dryRun, createPlaceholdersForMissing, dateToleranceDays, includeIndices } = req.body;
      if (!clientId || !rawText) {
        return res.status(400).json({ error: "clientId and rawText are required" });
      }

      const therapistId = req.therapistId;
      const result = await bulkImportProgressNotes(clientId, therapistId, rawText, {
        dryRun: !!dryRun,
        createPlaceholdersForMissing: !!createPlaceholdersForMissing,
        dateToleranceDays: typeof dateToleranceDays === "number" ? dateToleranceDays : 0,
        includeIndices: Array.isArray(includeIndices) ? includeIndices.map((value: any) => Number(value)) : undefined
      });
      await ClinicalAuditLogger.logPHIAccess(
        req.therapistId,
        AuditAction.DATA_IMPORT,
        clientId,
        req,
        {
          dryRun: !!dryRun,
          totalProcessed: result.total || 0,
          matchedSessions: result.matchedSessions || 0,
          missingSessions: result.missingSessions || 0,
        }
      );
      res.json({ success: true, ...result });
    } catch (error) {
      console.error("Error importing bulk progress notes:", error);
      res.status(500).json({ error: "Failed to import progress notes" });
    }
  });

  app.post("/api/progress-notes", async (req: any, res) => {
    try {
      const noteData = insertProgressNoteSchema.parse({
        ...req.body,
        therapistId: req.therapistId
      }) as any;

      // Verify client ownership before creating note
      const clientCheck = await SecureClientQueries.getClient(noteData.clientId, req.therapistId);
      if (clientCheck.length === 0) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Generate AI tags if content exists (embedding generated inside transaction if needed)
      const aiTags = noteData.content ? await aiService.generateClinicalTags(noteData.content) : [];

      // Use secure transaction for creating progress note
      const result = await ClinicalTransactions.createProgressNoteWithAnalysis(
        {
          clientId: noteData.clientId,
          content: noteData.content || '',
          sessionDate: noteData.sessionDate,
          therapistId: req.therapistId,
          sessionId: noteData.sessionId || undefined,
          tags: noteData.tags || [],
          aiTags: aiTags.map((tag: any) => tag.name),
          riskLevel: noteData.riskLevel || 'low',
          progressRating: noteData.progressRating || undefined
        },
        aiTags.length > 0 ? {
          insights: aiTags.map((tag: any) => tag.name),
          tags: aiTags.map((tag: any) => tag.name),
          riskFactors: []
        } : undefined
      );

      // Decrypt content before returning (gracefully handle non-encrypted data)
      const decryptedNote = {
        ...result.progressNote,
        content: result.progressNote.content ? safeDecrypt(result.progressNote.content) : null
      };

      try {
        const riskCheck = await checkRiskEscalation(noteData.clientId);
        if (riskCheck?.isEscalating) {
          await storage.createAiInsight({
            clientId: noteData.clientId,
            therapistId: req.therapistId,
            type: "risk_alert",
            title: "Risk escalation detected",
            description: `Recent notes show ${riskCheck.latestRiskLevel} risk with an elevated trend. Review required.`,
            priority: "high",
            metadata: {
              latestRiskLevel: riskCheck.latestRiskLevel,
              averageRiskScore: riskCheck.averageRiskScore,
              threshold: riskCheck.threshold,
              source: "riskMonitor",
            },
          });
        }
      } catch (riskError) {
        console.warn("Risk monitoring failed:", riskError);
      }

      res.json(decryptedNote);
    } catch (error) {
      console.error("Error creating progress note:", error);
      if (error instanceof Error && error.message === 'Client access denied') {
        return res.status(403).json({ error: "Access denied" });
      }
      res.status(400).json({ error: "Failed to create progress note" });
    }
  });

  // Progress Notes Management endpoints
  app.get("/api/progress-notes/manual-review", async (req: any, res) => {
    try {
      const notes = await storage.getProgressNotesForManualReview(req.therapistId);
      // Batch fetch clients (single query instead of N+1)
      const clientIds = [...new Set(notes.map(n => n.clientId))];
      const clientsMap = await storage.getClientsByIds(clientIds);
      // Fetch sessions individually (smaller result set, acceptable N+1)
      const notesWithClients = await Promise.all(
        notes.map(async (note) => {
          const session = note.sessionId ? await storage.getSession(note.sessionId) : null;
          return {
            ...note,
            client: clientsMap.get(note.clientId) || null,
            session,
            content: note.content ? safeDecrypt(note.content) : null
          };
        })
      );
      res.json(notesWithClients);
    } catch (error) {
      console.error("Error fetching notes for manual review:", error);
      res.status(500).json({ error: "Failed to fetch notes for manual review" });
    }
  });

  app.get("/api/progress-notes/placeholders", async (req: any, res) => {
    try {
      const placeholders = await storage.getProgressNotePlaceholders(req.therapistId);
      // Batch fetch clients (single query instead of N+1)
      const clientIds = [...new Set(placeholders.map(n => n.clientId))];
      const clientsMap = await storage.getClientsByIds(clientIds);
      // Fetch sessions individually (smaller result set, acceptable N+1)
      const placeholdersWithClients = await Promise.all(
        placeholders.map(async (note) => {
          const session = note.sessionId ? await storage.getSession(note.sessionId) : null;
          return {
            ...note,
            client: clientsMap.get(note.clientId) || null,
            session,
            content: note.content ? safeDecrypt(note.content) : null
          };
        })
      );
      res.json(placeholdersWithClients);
    } catch (error) {
      console.error("Error fetching progress note placeholders:", error);
      res.status(500).json({ error: "Failed to fetch placeholders" });
    }
  });

  app.post("/api/progress-notes/create-placeholders", async (req: any, res) => {
    try {
      // Get all SimplePractice sessions without progress notes
      const sessions = await storage.getSimplePracticeSessions(req.therapistId);
      const placeholdersCreated = [];

      for (const session of sessions) {
        // Check if placeholder already exists
        const existingNotes = await storage.getProgressNotes(session.clientId);
        const hasPlaceholder = existingNotes.some(note => note.sessionId === session.id);

        if (!hasPlaceholder) {
          const placeholder = await storage.createProgressNotePlaceholder(
            session.id,
            session.clientId,
            req.therapistId,
            session.scheduledAt
          );
          placeholdersCreated.push(placeholder);

          // Update session to mark placeholder creation
          await storage.updateSession(session.id, {
            hasProgressNotePlaceholder: true,
            progressNoteStatus: 'placeholder'
          });
        }
      }

      res.json({
        success: true,
        placeholdersCreated: placeholdersCreated.length,
        message: `Created ${placeholdersCreated.length} progress note placeholders for SimplePractice appointments`
      });
    } catch (error) {
      console.error("Error creating progress note placeholders:", error);
      res.status(500).json({ error: "Failed to create placeholders" });
    }
  });

  app.post("/api/progress-notes/create-placeholders-range", async (req: any, res) => {
    try {
      const { startDate, endDate } = req.body || {};
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "startDate and endDate are required" });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      const sessionsInRange = await storage.getSessionsInDateRange(req.therapistId, start, end);
      const notesInRange = await storage.getProgressNotesInDateRange(req.therapistId, start, end);
      const notesBySession = new Set(notesInRange.map((note) => note.sessionId).filter(Boolean));

      let placeholdersCreated = 0;
      for (const session of sessionsInRange) {
        if (!notesBySession.has(session.id)) {
          await storage.createProgressNotePlaceholder(
            session.id,
            session.clientId,
            req.therapistId,
            session.scheduledAt
          );
          placeholdersCreated += 1;
          await storage.updateSession(session.id, {
            hasProgressNotePlaceholder: true,
            progressNoteStatus: 'placeholder'
          });
        }
      }

      res.json({
        success: true,
        placeholdersCreated,
        message: `Created ${placeholdersCreated} progress note placeholders in date range`
      });
    } catch (error) {
      console.error("Error creating range placeholders:", error);
      res.status(500).json({ error: "Failed to create placeholders in date range" });
    }
  });

  app.patch("/api/progress-notes/:id", async (req: any, res) => {
    try {
      const noteId = req.params.id;
      const updates = insertProgressNoteSchema.partial().parse(req.body) as any;

      // Get the existing note to verify ownership
      const existingNote = await storage.getProgressNote(noteId);
      if (!existingNote) {
        return res.status(404).json({ error: "Progress note not found" });
      }

      // Verify client ownership
      const clientCheck = await SecureClientQueries.getClient(existingNote.clientId, req.therapistId);
      if (clientCheck.length === 0) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Encrypt content if being updated
      if (updates.content) {
        const originalContent = updates.content;
        updates.content = ClinicalEncryption.encrypt(originalContent);

        // Generate AI tags and embedding if content was updated
        // Make these non-blocking to prevent update failures due to AI service issues
        try {
          const [aiTags, embedding] = await Promise.all([
            aiService.generateClinicalTags(originalContent).catch(err => {
              console.warn("Failed to generate clinical tags (non-blocking):", err.message);
              return [];
            }),
            aiService.generateEmbedding(originalContent).catch(err => {
              console.warn("Failed to generate embedding (non-blocking):", err.message);
              return [];
            })
          ]);

          if (aiTags.length > 0) {
            updates.aiTags = aiTags.map(tag => tag.name);
          }
          if (embedding.length > 0) {
            updates.embedding = embedding;
          }
        } catch (aiError) {
          // Log but don't fail the update if AI services are unavailable
          console.warn("AI enrichment failed (note will still be saved):", aiError);
        }

        // If content is being added to a placeholder, update status
        if (existingNote.isPlaceholder) {
          updates.isPlaceholder = false;
          updates.status = 'uploaded';
        }
      }

      const note = await storage.updateProgressNote(noteId, updates);
      
      // Decrypt content before returning (gracefully handle non-encrypted data)
      const decryptedNote = {
        ...note,
        content: note.content ? safeDecrypt(note.content) : null
      };
      
      res.json(decryptedNote);
    } catch (error) {
      console.error("Error updating progress note:", error);
      res.status(500).json({ error: "Failed to update progress note" });
    }
  });

  app.delete("/api/progress-notes/:id", async (req: any, res) => {
    try {
      const noteId = req.params.id;

      // Get the existing note to verify ownership
      const existingNote = await storage.getProgressNote(noteId);
      if (!existingNote) {
        return res.status(404).json({ error: "Progress note not found" });
      }

      // Verify client ownership (additional security layer)
      const clientCheck = await SecureClientQueries.getClient(existingNote.clientId, req.therapistId);
      if (clientCheck.length === 0) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Also verify direct therapist ownership
      if (existingNote.therapistId !== req.therapistId) {
        return res.status(403).json({ error: "Access denied" });
      }

      await storage.deleteProgressNote(noteId);
      res.json({ success: true, message: "Progress note deleted successfully" });
    } catch (error) {
      console.error("Error deleting progress note:", error);
      res.status(500).json({ error: "Failed to delete progress note" });
    }
  });

  // Documents listing and detail endpoints
  app.get("/api/documents", async (req: any, res) => {
    try {
      const therapistId = req.therapistId || 'therapist-1';
      const clientId = req.query.clientId as string | undefined;

      if (clientId) {
        const clientCheck = await SecureClientQueries.getClient(clientId, therapistId);
        if (clientCheck.length === 0) {
          return res.status(403).json({ error: "Access denied" });
        }
        const documents = await storage.getDocuments(clientId);
        return res.json(documents);
      }

      const documents = await storage.getDocumentsByTherapist(therapistId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  app.get("/api/documents/:id", async (req: any, res) => {
    try {
      const therapistId = req.therapistId || 'therapist-1';
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      if (document.therapistId && document.therapistId !== therapistId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(document);
    } catch (error) {
      console.error("Error fetching document:", error);
      res.status(500).json({ error: "Failed to fetch document" });
    }
  });

  // Update document with AI analysis results and link to session
  app.patch("/api/documents/:id", async (req: any, res) => {
    try {
      const therapistId = req.therapistId || 'therapist-1';
      const documentId = req.params.id;

      // Verify document ownership
      const existing = await storage.getDocument(documentId);
      if (!existing) {
        return res.status(404).json({ error: "Document not found" });
      }
      if (existing.therapistId && existing.therapistId !== therapistId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const {
        status,
        tags,
        documentType,
        aiAnalysis,
        linkedSessionId,
        linkedClientId,
        sessionDate
      } = req.body;

      // Build update object
      const updateData: any = {};
      if (status) updateData.status = status;
      if (tags) updateData.tags = tags;
      if (documentType) updateData.documentType = documentType;
      if (linkedSessionId) updateData.linkedSessionId = linkedSessionId;
      if (linkedClientId) updateData.clientId = linkedClientId;

      // Store AI analysis in metadata
      if (aiAnalysis) {
        const existingMetadata = (existing.metadata && typeof existing.metadata === 'object') ? existing.metadata as Record<string, unknown> : {};
        updateData.metadata = {
          ...existingMetadata,
          aiAnalysis: {
            summary: aiAnalysis.summary,
            themes: aiAnalysis.themes,
            clientMentions: aiAnalysis.clientMentions,
            primaryClientName: aiAnalysis.primaryClientName,
            keyInsights: aiAnalysis.keyInsights,
            documentType: aiAnalysis.documentType,
            confidenceScore: aiAnalysis.confidenceScore,
            extractedDates: aiAnalysis.extractedDates,
            actionItems: aiAnalysis.actionItems,
            emotionalTone: aiAnalysis.emotionalTone,
            clinicalIndicators: aiAnalysis.clinicalIndicators,
            analyzedAt: new Date().toISOString()
          }
        };
      }

      const updated = await storage.updateDocument(documentId, updateData);
      res.json(updated);
    } catch (error) {
      console.error("Error updating document:", error);
      res.status(500).json({ error: "Failed to update document" });
    }
  });

  // Create progress note from document analysis
  app.post("/api/documents/:id/create-note", async (req: any, res) => {
    try {
      const therapistId = req.therapistId || 'therapist-1';
      const documentId = req.params.id;

      // Verify document ownership
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }
      if (document.therapistId && document.therapistId !== therapistId) {
        return res.status(403).json({ error: "Access denied" });
      }

      const { clientId, sessionDate, aiAnalysis } = req.body;

      if (!clientId) {
        return res.status(400).json({ error: "clientId is required" });
      }

      // Build progress note content from AI analysis
      let noteContent = "";
      if (aiAnalysis) {
        noteContent = `## Session Summary\n${aiAnalysis.summary || ''}\n\n`;
        if (aiAnalysis.themes?.length > 0) {
          noteContent += `## Key Themes\n${aiAnalysis.themes.map((t: string) => `- ${t}`).join('\n')}\n\n`;
        }
        if (aiAnalysis.keyInsights?.length > 0) {
          noteContent += `## Clinical Insights\n${aiAnalysis.keyInsights.map((i: string) => `- ${i}`).join('\n')}\n\n`;
        }
        if (aiAnalysis.actionItems?.length > 0) {
          noteContent += `## Action Items\n${aiAnalysis.actionItems.map((a: string) => `- [ ] ${a}`).join('\n')}\n\n`;
        }
        if (aiAnalysis.clinicalIndicators?.length > 0) {
          noteContent += `## Clinical Indicators\n`;
          for (const indicator of aiAnalysis.clinicalIndicators) {
            noteContent += `- **${indicator.indicator}** (${indicator.severity}): ${indicator.context}\n`;
          }
        }
      } else if (document.extractedText) {
        noteContent = document.extractedText;
      }

      // Determine risk level from clinical indicators
      let riskLevel = 'low';
      if (aiAnalysis?.clinicalIndicators) {
        const severities = aiAnalysis.clinicalIndicators.map((i: any) => i.severity);
        if (severities.includes('critical')) riskLevel = 'critical';
        else if (severities.includes('high')) riskLevel = 'high';
        else if (severities.includes('moderate')) riskLevel = 'moderate';
      }

      // Create the progress note
      const progressNoteData = {
        clientId,
        therapistId,
        sessionDate: sessionDate ? new Date(sessionDate) : new Date(),
        content: noteContent,
        status: 'draft',
        riskLevel,
        themes: aiAnalysis?.themes || [],
        originalDocumentId: documentId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const progressNote = await storage.createProgressNote(progressNoteData);

      // Update document status to processed and link to note
      await storage.updateDocument(documentId, {
        status: 'processed',
        linkedProgressNoteId: progressNote.id
      });

      res.json({
        success: true,
        progressNote,
        message: "Progress note created from document"
      });
    } catch (error) {
      console.error("Error creating progress note from document:", error);
      res.status(500).json({ error: "Failed to create progress note" });
    }
  });

  // Enhanced Document Upload and Processing endpoints
  app.post("/api/documents/upload", upload.single('document'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Support multiple file types with enhanced processing
      const supportedMimeTypes = [
        'text/plain',                    // TXT - optimal for AI analysis
        'application/pdf',               // PDF - robust extraction now available
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
        'application/msword',            // DOC (older format)
        'text/rtf',                      // RTF
        'application/rtf'                // RTF alternative
      ];

      if (!supportedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ 
          error: 'Supported file types: TXT, PDF, DOCX, DOC, RTF. Enhanced AI analysis now supports all formats.' 
        });
      }

      console.log(`🚀 Processing ${req.file.originalname} with enhanced AI analysis...`);

      const result = await enhancedDocumentProcessor.processDocument(
        req.file.buffer,
        req.file.originalname,
        req.therapistId
      );

      // Log success metrics
      if (result.success) {
        console.log(`✅ Enhanced processing completed: ${result.confidence}% confidence`);
        console.log(`📊 Validation scores: Text:${result.validationDetails?.textExtractionScore}% AI:${result.validationDetails?.aiAnalysisScore}% Date:${result.validationDetails?.dateValidationScore}% Client:${result.validationDetails?.clientMatchScore}%`);
      } else {
        console.log(`❌ Enhanced processing failed: ${result.processingNotes}`);
      }

      res.json(result);
    } catch (error) {
      console.error('Error uploading document:', error);
      res.status(500).json({ error: 'Failed to process document with enhanced AI analysis' });
    }
  });

  // Legacy document upload endpoint (fallback)
  app.post("/api/documents/upload-legacy", upload.single('document'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const result = await documentProcessor.processDocument(
        req.file.buffer,
        req.file.originalname,
        req.therapistId
      );

      res.json(result);
    } catch (error) {
      console.error('Error uploading document (legacy):', error);
      res.status(500).json({ error: 'Failed to process document' });
    }
  });

  app.get("/api/documents/processing-status", async (req: any, res) => {
    try {
      const placeholders = await storage.getProgressNotePlaceholders(req.therapistId);
      const manualReview = await storage.getProgressNotesForManualReview(req.therapistId);

      res.json({
        placeholders: placeholders.length,
        manualReview: manualReview.length,
        totalSessions: await storage.getSessions('calendar-sync-client').then(s => s.length),
        message: `${placeholders.length} placeholders ready for content, ${manualReview.length} notes need manual review`
      });
    } catch (error) {
      console.error('Error fetching processing status:', error);
      res.status(500).json({ error: 'Failed to fetch processing status' });
    }
  });

  // Reprocess unlinked documents - match to clients and sessions
  app.post("/api/documents/reprocess-unlinked", async (req: any, res) => {
    try {
      const therapistId = req.therapistId || 'therapist-1';

      // Get all documents that don't have a client linked
      const allDocuments = await storage.getDocumentsByTherapist(therapistId);
      const unlinkedDocuments = allDocuments.filter(doc =>
        !doc.clientId || doc.clientId === ''
      );

      console.log(`Found ${unlinkedDocuments.length} unlinked documents to reprocess`);

      if (unlinkedDocuments.length === 0) {
        return res.json({
          success: true,
          message: "No unlinked documents found",
          processed: 0,
          linked: 0,
          needsReview: 0,
          errors: []
        });
      }

      // Get all clients and sessions for matching
      const clients = await storage.getClients(therapistId);
      const sessions = await storage.getSessions(therapistId);

      const results = {
        processed: 0,
        linked: 0,
        needsReview: 0,
        errors: [] as string[]
      };

      for (const doc of unlinkedDocuments) {
        try {
          results.processed++;

          // Try to match client from filename or extracted text
          let matchedClient = null;
          let matchConfidence = 0;

          // Check filename for client name
          const docNameLower = doc.fileName.toLowerCase();
          for (const client of clients) {
            const clientNameParts = client.name.toLowerCase().split(' ');
            const hasNameMatch = clientNameParts.some(part =>
              part.length > 2 && docNameLower.includes(part)
            );
            if (hasNameMatch) {
              matchedClient = client;
              matchConfidence = 0.7;
              break;
            }
          }

          // If no match from filename, try extracted text
          if (!matchedClient && doc.extractedText) {
            const textLower = doc.extractedText.toLowerCase();
            for (const client of clients) {
              if (textLower.includes(client.name.toLowerCase())) {
                matchedClient = client;
                matchConfidence = 0.9;
                break;
              }
              // Try partial name match
              const clientNameParts = client.name.toLowerCase().split(' ');
              const hasNameMatch = clientNameParts.some(part =>
                part.length > 2 && textLower.includes(part)
              );
              if (hasNameMatch) {
                matchedClient = client;
                matchConfidence = 0.6;
                break;
              }
            }
          }

          if (matchedClient && matchConfidence >= 0.6) {
            // Try to find a session for this client near the document upload date
            const docDate = new Date(doc.uploadedAt);
            const dayBefore = new Date(docDate);
            dayBefore.setDate(dayBefore.getDate() - 1);
            const dayAfter = new Date(docDate);
            dayAfter.setDate(dayAfter.getDate() + 1);

            const matchingSession = sessions.find(s =>
              s.clientId === matchedClient!.id &&
              new Date(s.scheduledAt) >= dayBefore &&
              new Date(s.scheduledAt) <= dayAfter
            );

            // Update the document with the matched client (and session if found)
            const updateData: any = {
              clientId: matchedClient.id,
              status: 'processed'
            };

            if (matchingSession) {
              const docMetadata = (doc.metadata && typeof doc.metadata === 'object') ? doc.metadata as Record<string, unknown> : {};
              updateData.metadata = {
                ...docMetadata,
                linkedSessionId: matchingSession.id,
                sessionDate: matchingSession.scheduledAt
              };
            }

            await storage.updateDocument(doc.id, updateData);
            results.linked++;
            console.log(`Linked document ${doc.fileName} to client ${matchedClient.name}`);
          } else {
            results.needsReview++;
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          results.errors.push(`[${doc.fileName}] ${errorMsg}`);
        }
      }

      // Also run orphaned progress note linking
      const { linkOrphanedProgressNotes } = await import("./services/calendarReconciliation");
      const linkingResult = await linkOrphanedProgressNotes(therapistId);

      res.json({
        success: true,
        message: `Processed ${results.processed} documents`,
        ...results,
        orphanedNotesLinked: linkingResult.linked
      });
    } catch (error) {
      console.error("Error reprocessing unlinked documents:", error);
      res.status(500).json({ error: "Failed to reprocess documents" });
    }
  });

  // Link documents to sessions by parsing date from filename
  // Documents may already have clientId but missing sessionId
  app.post("/api/documents/link-to-sessions", async (req: any, res) => {
    try {
      const therapistId = req.therapistId || 'therapist-1';

      // Get all documents
      const allDocuments = await storage.getDocumentsByTherapist(therapistId);

      // Find documents that have clientId but no sessionId in metadata
      const documentsNeedingSession = allDocuments.filter(doc => {
        const metadata = doc.metadata as Record<string, unknown> || {};
        return doc.clientId && !metadata.linkedSessionId && !metadata.sessionId;
      });

      console.log(`Found ${documentsNeedingSession.length} documents that need session linking`);

      if (documentsNeedingSession.length === 0) {
        return res.json({
          success: true,
          message: "All documents already linked to sessions",
          processed: 0,
          linked: 0
        });
      }

      // Get all sessions and clients for matching
      const sessions = await storage.getAllHistoricalSessions(therapistId);
      const allClients = await storage.getClients(therapistId);

      // Build a map of client names to client IDs for matching
      const clientNameToIdMap = new Map<string, string>();
      for (const client of allClients) {
        // Add full name
        clientNameToIdMap.set(client.name.toLowerCase(), client.id);
        // Add variations (first name only, last name only)
        const nameParts = client.name.toLowerCase().split(' ');
        if (nameParts.length >= 2) {
          clientNameToIdMap.set(nameParts[0], client.id); // First name
          clientNameToIdMap.set(nameParts[nameParts.length - 1], client.id); // Last name
        }
      }

      const results = {
        processed: 0,
        linked: 0,
        alreadyLinked: 0,
        noMatchFound: 0,
        errors: [] as string[],
        debugInfo: [] as string[]
      };

      // Date parsing patterns for filenames like:
      // "Amberly Comeau Appointment 4-17-2024 1000 hrs - Progress Note.docx"
      // "John Best Appointment 12-5-2024 900 hrs - Progress Note.docx"
      const datePatterns = [
        /(\d{1,2})-(\d{1,2})-(\d{4})/,  // M-D-YYYY or MM-DD-YYYY
        /(\d{4})-(\d{1,2})-(\d{1,2})/,  // YYYY-M-D or YYYY-MM-DD
        /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // M/D/YYYY
        /(\d{1,2})\.(\d{1,2})\.(\d{4})/, // M.D.YYYY
      ];

      for (const doc of documentsNeedingSession) {
        try {
          results.processed++;

          // Try to extract date from filename
          let extractedDate: Date | null = null;

          for (const pattern of datePatterns) {
            const match = doc.fileName.match(pattern);
            if (match) {
              let year: number, month: number, day: number;

              if (pattern.source.startsWith('(\\d{4})')) {
                // YYYY-M-D format
                year = parseInt(match[1]);
                month = parseInt(match[2]);
                day = parseInt(match[3]);
              } else {
                // M-D-YYYY format
                month = parseInt(match[1]);
                day = parseInt(match[2]);
                year = parseInt(match[3]);
              }

              extractedDate = new Date(year, month - 1, day);
              break;
            }
          }

          if (!extractedDate) {
            // No date found in filename, skip
            results.noMatchFound++;
            continue;
          }

          // Extract client name from document filename for matching
          // Filename format: "Chris Balabanick Appointment 4-17-2024..."
          const docNameParts = doc.fileName.split(' Appointment ')[0];
          const docClientName = docNameParts?.toLowerCase().trim();

          // Look up client ID by name from the filename
          let targetClientId = doc.clientId;
          if (docClientName) {
            const matchedClientId = clientNameToIdMap.get(docClientName);
            if (matchedClientId) {
              targetClientId = matchedClientId;
            } else {
              // Try partial matching by first or last name
              for (const client of allClients) {
                const clientNameLower = client.name.toLowerCase();
                if (clientNameLower.includes(docClientName) || docClientName.includes(clientNameLower)) {
                  targetClientId = client.id;
                  break;
                }
                // Match by first name + last name
                const docParts = docClientName.split(' ');
                const clientParts = clientNameLower.split(' ');
                if (docParts.length >= 2 && clientParts.length >= 2) {
                  // Match if first names start same and last names match
                  if (clientParts[0].startsWith(docParts[0].substring(0, 4)) &&
                      clientParts[clientParts.length - 1] === docParts[docParts.length - 1]) {
                    targetClientId = client.id;
                    break;
                  }
                }
              }
            }
          }

          // Find sessions for this client
          const clientSessions = sessions.filter(s => s.clientId === targetClientId);

          // Look for exact date match first, then within 1 day
          let matchingSession = clientSessions.find(s => {
            const sessionDate = new Date(s.scheduledAt);
            return sessionDate.toDateString() === extractedDate!.toDateString();
          });

          if (!matchingSession) {
            // Try finding within 1 day
            const dayBefore = new Date(extractedDate);
            dayBefore.setDate(dayBefore.getDate() - 1);
            const dayAfter = new Date(extractedDate);
            dayAfter.setDate(dayAfter.getDate() + 1);

            matchingSession = clientSessions.find(s => {
              const sessionDate = new Date(s.scheduledAt);
              return sessionDate >= dayBefore && sessionDate <= dayAfter;
            });
          }

          // Debug info for first few failures
          if (!matchingSession && results.debugInfo.length < 5) {
            results.debugInfo.push(`Doc: ${doc.fileName.substring(0, 50)}... docClientId: ${doc.clientId}, targetClientId: ${targetClientId}, clientName: ${docClientName}, sessionsFound: ${clientSessions.length}, date: ${extractedDate.toLocaleDateString()}`);
          }

          if (matchingSession) {
            // Update document with session link
            const metadata = (doc.metadata as Record<string, unknown>) || {};
            await storage.updateDocument(doc.id, {
              status: 'processed',
              metadata: {
                ...metadata,
                linkedSessionId: matchingSession.id,
                sessionId: matchingSession.id,
                sessionDate: matchingSession.scheduledAt
              }
            });
            results.linked++;
            console.log(`Linked "${doc.fileName}" to session on ${new Date(matchingSession.scheduledAt).toLocaleDateString()}`);
          } else {
            results.noMatchFound++;
            console.log(`No session found for "${doc.fileName}" on ${extractedDate.toLocaleDateString()}`);
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          results.errors.push(`[${doc.fileName}] ${errorMsg}`);
        }
      }

      // Also count sessions per client for debugging
      const sessionCountByClient = new Map<string, number>();
      for (const session of sessions) {
        sessionCountByClient.set(session.clientId, (sessionCountByClient.get(session.clientId) || 0) + 1);
      }

      res.json({
        success: true,
        message: `Processed ${results.processed} documents, linked ${results.linked} to sessions`,
        ...results,
        totalSessions: sessions.length,
        totalClients: allClients.length,
        sampleClientSessions: Array.from(sessionCountByClient.entries()).slice(0, 5)
      });
    } catch (error) {
      console.error("Error linking documents to sessions:", error);
      res.status(500).json({ error: "Failed to link documents to sessions" });
    }
  });

  // Create sessions from document dates - for historical data that wasn't synced from calendar
  app.post("/api/documents/create-sessions-from-docs", async (req: any, res) => {
    try {
      const therapistId = req.therapistId || 'therapist-1';

      // Get all documents
      const allDocuments = await storage.getDocumentsByTherapist(therapistId);
      const allClients = await storage.getClients(therapistId);

      // Build a map of client names to client objects for matching
      const clientNameToClient = new Map<string, typeof allClients[0]>();
      for (const client of allClients) {
        clientNameToClient.set(client.name.toLowerCase(), client);
        // Add variations
        const nameParts = client.name.toLowerCase().split(' ');
        if (nameParts.length >= 2) {
          clientNameToClient.set(nameParts[0], client);
          clientNameToClient.set(nameParts[nameParts.length - 1], client);
        }
      }

      const datePatterns = [
        /(\d{1,2})-(\d{1,2})-(\d{4})/,  // M-D-YYYY
        /(\d{4})-(\d{1,2})-(\d{1,2})/,  // YYYY-M-D
      ];

      const results = {
        processed: 0,
        sessionsCreated: 0,
        alreadyExist: 0,
        errors: [] as string[]
      };

      for (const doc of allDocuments) {
        try {
          results.processed++;

          // Extract date from filename
          let extractedDate: Date | null = null;
          for (const pattern of datePatterns) {
            const match = doc.fileName.match(pattern);
            if (match) {
              let year: number, month: number, day: number;
              if (pattern.source.startsWith('(\\d{4})')) {
                year = parseInt(match[1]);
                month = parseInt(match[2]);
                day = parseInt(match[3]);
              } else {
                month = parseInt(match[1]);
                day = parseInt(match[2]);
                year = parseInt(match[3]);
              }
              extractedDate = new Date(year, month - 1, day, 12, 0, 0); // Set to noon
              break;
            }
          }

          if (!extractedDate || extractedDate.getFullYear() > 2030) continue;

          // Find or determine client
          const docNameParts = doc.fileName.split(' Appointment ')[0];
          const docClientName = docNameParts?.toLowerCase().trim();
          let clientId = doc.clientId;

          if (docClientName) {
            const matchedClient = clientNameToClient.get(docClientName);
            if (matchedClient) {
              clientId = matchedClient.id;
            } else {
              // Try partial matching
              for (const client of allClients) {
                const clientNameLower = client.name.toLowerCase();
                if (clientNameLower.includes(docClientName) || docClientName.includes(clientNameLower)) {
                  clientId = client.id;
                  break;
                }
              }
            }
          }

          if (!clientId) continue;

          // Check if session already exists for this client on this date
          const existingSessions = await storage.getSessionsByDate(therapistId, extractedDate);
          const alreadyExists = existingSessions.some(s => s.clientId === clientId);

          if (alreadyExists) {
            results.alreadyExist++;
            continue;
          }

          // Create the session
          const sessionId = `doc-${doc.id.substring(0, 8)}`;
          await storage.createSession({
            id: sessionId,
            clientId,
            therapistId,
            scheduledAt: extractedDate,
            duration: 60,
            sessionType: 'individual',
            status: 'completed',
            notes: `Created from document: ${doc.fileName}`,
            isSimplePracticeEvent: false
          });

          results.sessionsCreated++;

          // Update document with session link
          const metadata = (doc.metadata as Record<string, unknown>) || {};
          await storage.updateDocument(doc.id, {
            status: 'processed',
            metadata: {
              ...metadata,
              linkedSessionId: sessionId,
              sessionId: sessionId,
              sessionDate: extractedDate.toISOString()
            }
          });

        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          results.errors.push(`[${doc.fileName}] ${errorMsg}`);
        }
      }

      res.json({
        success: true,
        message: `Created ${results.sessionsCreated} sessions from ${results.processed} documents`,
        ...results
      });
    } catch (error) {
      console.error("Error linking documents to sessions:", error);
      res.status(500).json({ error: "Failed to link documents to sessions" });
    }
  });

  // Batch Processing endpoint
  app.post("/api/documents/process-batch", upload.array('documents', 10), async (req: any, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const results = [];
      for (const file of req.files) {
        if (file.mimetype === 'application/pdf') {
          try {
            const result = await documentProcessor.processDocument(
              file.buffer,
              file.originalname,
              req.therapistId
            );
            results.push(result);
          } catch (error) {
            results.push({
              success: false,
              fileName: file.originalname,
              error: (error as Error).message
            });
          }
        }
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.length - successful;

      res.json({
        success: true,
        processed: results.length,
        successful,
        failed,
        results,
        message: `Processed ${successful} documents successfully, ${failed} failed`
      });
    } catch (error) {
      console.error('Error processing batch documents:', error);
      res.status(500).json({ error: 'Failed to process batch documents' });
    }
  });

  // Case Conceptualization endpoints
  app.get("/api/case-conceptualization/:clientId", async (req, res) => {
    try {
      const conceptualization = await storage.getCaseConceptualization(req.params.clientId);
      res.json(conceptualization);
    } catch (error) {
      console.error("Error fetching case conceptualization:", error);
      res.status(500).json({ error: "Failed to fetch case conceptualization" });
    }
  });

  app.post("/api/case-conceptualization", async (req: any, res) => {
    try {
      const data = insertCaseConceptualizationSchema.parse({
        ...req.body,
        therapistId: req.therapistId
      });

      const conceptualization = await storage.createCaseConceptualization(data);
      res.json(conceptualization);
    } catch (error) {
      console.error("Error creating case conceptualization:", error);
      res.status(400).json({ error: "Failed to create case conceptualization" });
    }
  });

  // AI endpoints

  // AI Chat endpoint for iOS app conversational assistant
  app.post("/api/ai/chat", async (req: any, res) => {
    try {
      const { message, include_context, client_id } = req.body;
      const therapistId = req.therapistId || 'therapist-1';

      if (!message || typeof message !== 'string') {
        return res.status(400).json({
          success: false,
          error: "Message is required"
        });
      }

      // Build context from client data if requested
      let contextInfo = '';
      if (include_context && client_id) {
        try {
          const client = await storage.getClient(client_id);
          if (client) {
            contextInfo = `Client: ${client.name}\nStatus: ${client.status}\n`;
            const recentNotes = await storage.getProgressNotes(client_id);
            if (recentNotes.length > 0) {
              contextInfo += `Recent session themes: ${recentNotes.slice(0, 3).map(n => n.tags?.join(', ') || 'N/A').join('; ')}\n`;
            }
          }
        } catch (e) {
          console.log('Could not load client context:', e);
        }
      }

      // Get therapist caseload summary for general context
      let caseloadContext = '';
      try {
        const clients = await storage.getClients(therapistId);
        const activeClients = clients.filter(c => c.status === 'active');
        caseloadContext = `You are assisting Dr. Jonathan Procter, a licensed mental health counselor. He has ${activeClients.length} active clients.`;
      } catch (e) {
        caseloadContext = 'You are assisting a mental health professional with their practice.';
      }

      // Use Claude API for chat response
      const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
      if (!anthropicApiKey) {
        return res.json({
          success: true,
          response: "I'm here to help with your practice. However, the AI service is not configured. Please add your Anthropic API key to the server environment.",
          responseText: "I'm here to help with your practice. However, the AI service is not configured. Please add your Anthropic API key to the server environment."
        });
      }

      const fetch = (await import('node-fetch')).default;
      const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: `${caseloadContext}

You are an AI assistant for TherapyFlow, a mental health practice management app.
Help the therapist with:
- Client insights and session preparation
- Clinical documentation suggestions
- Practice management questions
- Scheduling and workflow optimization

Be conversational, warm, and professional. Keep responses concise but helpful.
${contextInfo ? `\nCurrent context:\n${contextInfo}` : ''}`,
          messages: [
            { role: 'user', content: message }
          ]
        })
      });

      if (!anthropicResponse.ok) {
        const errorText = await anthropicResponse.text();
        console.error('Anthropic API error:', errorText);
        return res.json({
          success: true,
          response: "I apologize, but I'm having trouble connecting to the AI service right now. Please try again in a moment.",
          responseText: "I apologize, but I'm having trouble connecting to the AI service right now. Please try again in a moment."
        });
      }

      const aiResult = await anthropicResponse.json() as any;
      const responseText = aiResult.content?.[0]?.text || "I'm sorry, I couldn't generate a response. Please try again.";

      res.json({
        success: true,
        response: responseText,
        responseText: responseText
      });
    } catch (error) {
      console.error("Error in AI chat:", error);
      res.status(500).json({
        success: false,
        error: "Failed to process chat message"
      });
    }
  });

  // Voice endpoints for iOS app
  app.get("/api/voice/recommended", async (req: any, res) => {
    try {
      const { getRealtimeVoiceService } = await import("./services/realtimeVoice");
      const voiceService = getRealtimeVoiceService();
      const voices = voiceService?.getVoices() ?? [];

      const preferences = await getAppSetting<Record<string, string>>("voice_preferences");
      const currentVoice = preferences?.[req.therapistId] ?? "";

      res.json({ voices, currentVoice });
    } catch (error) {
      console.error("Error fetching recommended voices:", error);
      res.status(500).json({ error: "Failed to load voices" });
    }
  });

  app.post("/api/voice/set-voice", async (req: any, res) => {
    try {
      const { voiceId } = req.body;
      if (!voiceId) {
        return res.status(400).json({ error: "voiceId is required" });
      }

      const preferences = (await getAppSetting<Record<string, string>>("voice_preferences")) || {};
      preferences[req.therapistId] = voiceId;
      await setAppSetting("voice_preferences", preferences);

      res.json({ success: true });
    } catch (error) {
      console.error("Error setting voice:", error);
      res.status(500).json({ error: "Failed to set voice" });
    }
  });

  // Voice assistant endpoint for iOS app with TTS support
  app.post("/api/voice/assistant", async (req: any, res) => {
    try {
      const { query, voiceId = 'nova', context, includeTTS = true } = req.body;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          success: false,
          error: "Query is required"
        });
      }

      // Use the chat endpoint logic for text response
      const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
      if (!anthropicApiKey) {
        return res.json({
          success: true,
          text: "Voice assistant is not configured. Please add your API key.",
          audio: null
        });
      }

      const fetch = (await import('node-fetch')).default;
      const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 512,
          system: `You are a voice assistant for TherapyFlow, a mental health practice app.
Keep responses brief and conversational - suitable for spoken delivery.
Help with practice management, client insights, and clinical questions.

IMPORTANT: Always respond in plain text only. Do NOT use any markdown formatting:
- No headers (# or ##)
- No bold (**text**) or italic (*text*)
- No bullet points or numbered lists
- No code blocks or backticks
- No links or special formatting
Responses must be natural speech, ready for text-to-speech conversion.`,
          messages: [
            { role: 'user', content: query }
          ]
        })
      });

      if (!anthropicResponse.ok) {
        return res.json({
          success: false,
          error: "AI service temporarily unavailable",
          text: null,
          audio: null
        });
      }

      const aiResult = await anthropicResponse.json() as any;
      const responseText = aiResult.content?.[0]?.text || "I couldn't process that request.";

      // Generate TTS audio using OpenAI
      let audioBase64: string | null = null;
      if (includeTTS && process.env.OPENAI_API_KEY) {
        try {
          const { getRealtimeVoiceService } = await import('./services/realtimeVoice');
          const voiceService = getRealtimeVoiceService();

          if (voiceService) {
            const validVoices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'] as const;
            const selectedVoice = validVoices.includes(voiceId as any) ? voiceId : 'nova';
            const audioBuffer = await voiceService.generateSpeech(responseText, selectedVoice as any);

            if (audioBuffer) {
              audioBase64 = audioBuffer.toString('base64');
              console.log(`[Voice] Generated ${audioBuffer.length} bytes of TTS audio`);
            }
          } else {
            console.warn('[Voice] RealtimeVoiceService not initialized');
          }
        } catch (ttsError) {
          console.error('[Voice] TTS generation failed:', ttsError);
          // Continue without audio - text response is still valid
        }
      }

      res.json({
        success: true,
        text: responseText,
        audio: audioBase64,
        audioFormat: audioBase64 ? 'mp3' : null,
        voiceId: voiceId
      });
    } catch (error) {
      console.error("Error in voice assistant:", error);
      res.status(500).json({
        success: false,
        error: "Failed to process voice query"
      });
    }
  });

  app.get("/api/ai/insights", async (req: any, res) => {
    try {
      const insights = await storage.getAiInsights(req.therapistId);
      res.json(insights);
    } catch (error) {
      console.error("Error fetching AI insights:", error);
      res.status(500).json({ error: "Failed to fetch AI insights" });
    }
  });

  app.post("/api/ai/session-prep/:sessionId", async (req: any, res) => {
    try {
      const session = await storage.getSession(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      const client = await storage.getClient(session.clientId);
      const recentNotes = await storage.getProgressNotes(session.clientId);
      const treatmentPlan = await storage.getTreatmentPlan(session.clientId);

      const clientHistory = recentNotes.slice(0, 10).map(note => note.content).join('\n');
      const lastSession = recentNotes[0]?.content || '';
      const goals = treatmentPlan?.goals ? Object.values(treatmentPlan.goals as any).map((goal: any) => goal.description) : [];

      const preparation = await aiService.prepareSessionQuestions(
        clientHistory,
        lastSession,
        goals
      );

      res.json(preparation);
    } catch (error) {
      console.error("Error generating session preparation:", error);
      res.status(500).json({ error: "Failed to generate session preparation" });
    }
  });

  app.post("/api/ai/case-analysis", async (req: any, res) => {
    try {
      const { clientId } = req.body;

      const client = await storage.getClient(clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      const progressNotes = await storage.getProgressNotes(clientId);
      const clientInfo = JSON.stringify(client);
      const assessmentData = progressNotes.slice(0, 5).map(note => note.content).join('\n');

      const analysis = await aiService.analyzeCaseConceptualization(clientInfo, assessmentData);
      res.json(analysis);
    } catch (error) {
      console.error("Error generating case analysis:", error);
      res.status(500).json({ error: "Failed to generate case analysis" });
    }
  });

  // AI Progress Note Suggestions endpoint
  app.post('/api/ai/progress-note-suggestions', async (req: any, res) => {
    try {
      const { aiProgressNoteSuggestions } = await import('./services/aiProgressNoteSuggestions');

      const suggestions = await aiProgressNoteSuggestions.generateSuggestions(req.body);

      res.json({
        success: true,
        suggestions
      });
    } catch (error: any) {
      console.error('Error generating progress note suggestions:', error);
      res.status(500).json({
        success: false,
        error: error?.message || 'Failed to generate suggestions'
      });
    }
  });

  app.post('/api/ai/progress-note-draft', async (req: any, res) => {
    try {
      const { clientId, sessionId } = req.body;
      if (!clientId) {
        return res.status(400).json({ error: "clientId is required" });
      }

      const session = sessionId ? await storage.getSession(sessionId) : null;
      const progressNotes = await storage.getProgressNotes(clientId);
      const latestNote = progressNotes.find(note => note.content);
      const decryptedNote = latestNote?.content ? safeDecrypt(latestNote.content) : null;

      let sourceText = decryptedNote || "";
      let source = decryptedNote ? "progress_note" : "none";

      if (!sourceText) {
        const documents = await storage.getDocuments(clientId);
        const latestDoc = documents.find(doc => doc.extractedText);
        if (latestDoc?.extractedText) {
          sourceText = latestDoc.extractedText;
          source = "document";
        }
      }

      if (!sourceText) {
        return res.json({
          success: true,
          source: "none",
          draft: { subjective: "", objective: "", assessment: "", plan: "" }
        });
      }

      const prompt = `
You are an expert clinical therapist. Use the source material to draft a progress note in JSON with four sections.

Return JSON only:
{
  "subjective": "string",
  "objective": "string",
  "assessment": "string",
  "plan": "string"
}

Context:
- Client ID: ${clientId}
- Session Date: ${session?.scheduledAt ? session.scheduledAt.toISOString().split('T')[0] : "unknown"}
- Session Type: ${session?.sessionType || "unknown"}

Source material (${source}):
${sourceText}
`;

      const aiResponse = await aiService.processTherapyDocument(sourceText, prompt);
      let parsed: any = null;
      try {
        parsed = JSON.parse(aiResponse);
      } catch (error) {
        parsed = null;
      }

      const draft = {
        subjective: parsed?.subjective || "",
        objective: parsed?.objective || "",
        assessment: parsed?.assessment || "",
        plan: parsed?.plan || ""
      };

      res.json({ success: true, source, draft });
    } catch (error) {
      console.error("Error generating progress note draft:", error);
      res.status(500).json({ error: "Failed to generate progress note draft" });
    }
  });

  // Quick interventions endpoint
  app.get('/api/ai/quick-interventions', async (req: any, res) => {
    try {
      const { aiProgressNoteSuggestions } = await import('./services/aiProgressNoteSuggestions');

      const suggestions = await aiProgressNoteSuggestions.generateQuickInterventions();

      res.json({
        success: true,
        suggestions
      });
    } catch (error: any) {
      console.error('Error generating quick interventions:', error);
      res.status(500).json({
        success: false,
        error: error?.message || 'Failed to generate interventions'
      });
    }
  });

  // Session Summary Generation endpoints
  app.post('/api/sessions/:sessionId/generate-summary', async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const { clientId, summaryType = 'comprehensive', includeProgressNotes = true, includePreviousSessions = true } = req.body;

      if (!clientId) {
        return res.status(400).json({ error: 'clientId is required' });
      }

      const summary = await sessionSummaryGenerator.generateSessionSummary({
        sessionId,
        clientId,
        therapistId: req.therapistId,
        summaryType,
        includeProgressNotes,
        includePreviousSessions
      });

      res.json(summary);
    } catch (error: any) {
      console.error('Error generating session summary:', error);
      res.status(500).json({
        success: false,
        error: error?.message || 'Failed to generate session summary'
      });
    }
  });

  // Quick session insights endpoint
  app.get('/api/sessions/:sessionId/quick-insights', async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const { clientId } = req.query;

      if (!clientId) {
        return res.status(400).json({ error: 'clientId is required' });
      }

      const insights = await sessionSummaryGenerator.generateQuickInsights(sessionId, clientId as string);

      res.json({
        success: true,
        insights
      });
    } catch (error: any) {
      console.error('Error generating quick insights:', error);
      res.status(500).json({
        success: false,
        error: error?.message || 'Failed to generate quick insights'
      });
    }
  });

  // Session Export endpoint
  app.post("/api/sessions/:sessionId/export", async (req: any, res) => {
    try {
      const { exportService } = await import('./services/export-service.js');
      
      const exportRequest = {
        sessionId: req.params.sessionId,
        clientId: req.body.clientId,
        therapistId: req.therapistId,
        exportFormat: req.body.exportFormat || 'json',
        includeProgressNotes: req.body.includeProgressNotes !== false,
        includePreviousSessions: req.body.includePreviousSessions !== false,
        summaryType: req.body.summaryType || 'comprehensive'
      };
      
      const result = await exportService.exportSessionSummary(exportRequest);
      res.json(result);
    } catch (error: any) {
      console.error("Error exporting session summary:", error);
      res.status(500).json({ 
        success: false,
        error: error?.message || "Failed to export session summary" 
      });
    }
  });



  // Treatment Plan endpoints
  // Plural form for iOS compatibility
  app.get("/api/treatment-plans", async (req: any, res) => {
    try {
      const plans = await storage.getAllTreatmentPlans(req.therapistId);
      res.json(plans);
    } catch (error) {
      console.error("Error fetching treatment plans:", error);
      res.status(500).json({ error: "Failed to fetch treatment plans" });
    }
  });

  app.get("/api/treatment-plan/:clientId", async (req, res) => {
    try {
      const plan = await storage.getTreatmentPlan(req.params.clientId);
      res.json(plan);
    } catch (error) {
      console.error("Error fetching treatment plan:", error);
      res.status(500).json({ error: "Failed to fetch treatment plan" });
    }
  });

  app.post("/api/treatment-plan", async (req: any, res) => {
    try {
      const planData = insertTreatmentPlanSchema.parse({
        ...req.body,
        therapistId: req.therapistId
      });

      const plan = await storage.createTreatmentPlan(planData);
      res.json(plan);
    } catch (error) {
      console.error("Error creating treatment plan:", error);
      res.status(400).json({ error: "Failed to create treatment plan" });
    }
  });

  // Alliance Scores endpoints
  app.get("/api/alliance-scores/:clientId", async (req, res) => {
    try {
      const scores = await storage.getAllianceScores(req.params.clientId);
      res.json(scores);
    } catch (error) {
      console.error("Error fetching alliance scores:", error);
      res.status(500).json({ error: "Failed to fetch alliance scores" });
    }
  });

  app.post("/api/alliance-scores", async (req: any, res) => {
    try {
      const scoreData = insertAllianceScoreSchema.parse({
        ...req.body,
        therapistId: req.therapistId,
        assessmentDate: new Date()
      });

      const score = await storage.createAllianceScore(scoreData);
      res.json(score);
    } catch (error) {
      console.error("Error creating alliance score:", error);
      res.status(400).json({ error: "Failed to create alliance score" });
    }
  });

  // Google Calendar Integration Routes (OAuth2 with 2015-2030 sync)
  app.get("/api/calendar/auth-url", async (req, res) => {
    try {
      const authUrl = await googleCalendarService.getAuthUrl();
      res.json({ authUrl });
    } catch (error) {
      console.error("Error getting auth URL:", error);
      res.status(500).json({ error: "Failed to get authorization URL" });
    }
  });

  app.get("/api/calendar/callback", async (req, res) => {
    try {
      const { code, error } = req.query;

      if (error) {
        return res.send(`
          <html>
            <body>
              <h2>Authorization Failed</h2>
              <p>Error: ${error}</p>
              <script>
                window.opener && window.opener.postMessage({ success: false, error: '${error}' }, '*');
                window.close();
              </script>
            </body>
          </html>
        `);
      }

      if (!code) {
        return res.status(400).send(`
          <html>
            <body>
              <h2>Authorization Failed</h2>
              <p>No authorization code received</p>
              <script>
                window.opener && window.opener.postMessage({ success: false, error: 'No authorization code' }, '*');
                window.close();
              </script>
            </body>
          </html>
        `);
      }

      const tokens = await googleCalendarService.exchangeCodeForTokens(code as string);

      res.send(`
        <html>
          <head>
            <title>Calendar Connected</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
              .success { color: #4CAF50; }
              .container { background: white; padding: 30px; border-radius: 10px; max-width: 400px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            </style>
          </head>
          <body>
            <div class="container">
              <h2 class="success">✓ Google Calendar Connected!</h2>
              <p>Your calendar is now connected to TherapyFlow.</p>
              <p><small>You can close this window and return to the app.</small></p>
            </div>
            <script>
              window.opener && window.opener.postMessage({ success: true, tokens: ${JSON.stringify(tokens)} }, '*');
              setTimeout(() => window.close(), 2000);
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Error in calendar callback:", error);
      res.send(`
        <html>
          <body>
            <h2>Authorization Failed</h2>
            <p>Error: ${(error as Error).message}</p>
            <script>
              window.opener && window.opener.postMessage({ success: false, error: '${(error as Error).message}' }, '*');
              window.close();
            </script>
          </body>
        </html>
      `);
    }
  });

  app.post("/api/calendar/auth", async (req, res) => {
    try {
      const { code } = req.body;
      if (!code) {
        return res.status(400).json({ error: "Authorization code required" });
      }

      const tokens = await googleCalendarService.exchangeCodeForTokens(code);
      res.json({ success: true, tokens });
    } catch (error) {
      console.error("Error exchanging auth code:", error);
      res.status(500).json({ error: "Failed to exchange authorization code" });
    }
  });

  // Helper function to check name variations
  const isNameVariation = (name1: string, name2: string): boolean => {
    const normalize = (name: string) => name.toLowerCase().trim();
    const n1 = normalize(name1);
    const n2 = normalize(name2);

    // Common name variations
    const variations: { [key: string]: string[] } = {
      'christopher': ['chris', 'christopher'],
      'chris': ['chris', 'christopher'],
      'benjamin': ['ben', 'benjamin', 'benji'],
      'ben': ['ben', 'benjamin', 'benji'],
      'michael': ['mike', 'michael', 'mick'],
      'mike': ['mike', 'michael', 'mick'],
      'william': ['will', 'william', 'bill', 'billy'],
      'will': ['will', 'william', 'bill', 'billy'],
      'robert': ['rob', 'robert', 'bob', 'bobby'],
      'rob': ['rob', 'robert', 'bob', 'bobby'],
      'elizabeth': ['liz', 'elizabeth', 'beth', 'betty'],
      'liz': ['liz', 'elizabeth', 'beth', 'betty']
    };

    // Extract first names for comparison
    const firstName1 = n1.split(' ')[0];
    const firstName2 = n2.split(' ')[0];

    // Check if names are variations of each other
    for (const [base, vars] of Object.entries(variations)) {
      if (vars.includes(firstName1) && vars.includes(firstName2)) {
        return true;
      }
    }

    return false;
  };

  app.post("/api/calendar/sync", async (req: any, res) => {
    try {
      const { startDate, endDate } = req.body;
      const lastSync = await getAppSetting<{ value?: string; lastSyncAt?: string }>("calendar_last_sync");
      const lastSyncDate = lastSync?.lastSyncAt;
      const fallbackStart = lastSyncDate ? lastSyncDate : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const effectiveStartDate = startDate || fallbackStart;
      const effectiveEndDate = endDate || new Date().toISOString().split('T')[0];

      // Sync calendar events from Google Calendar (2015-2030 range)
      const syncedSessions = await googleCalendarService.syncCalendarEvents(
        req.therapistId,
        effectiveStartDate,
        effectiveEndDate
      );

      // Save the synced sessions to the database with proper client matching
      const savedSessions = [];
      for (const session of syncedSessions) {
        try {
          // Check if session already exists (by googleEventId)
          const existingSession = await storage.getSessionByGoogleEventId(session.googleEventId!);

          if (!existingSession) {
            // Extract client name from the session (stored as temporary field)
            const extractedClientName = (session as any).clientName;
            let clientId = session.clientId; // Default fallback client

            // Try to match or create a real client if we have a valid client name
            if (extractedClientName && extractedClientName !== 'Unidentified Client' && !extractedClientName.includes('Birthday')) {
              try {
                // First, try to find existing client by name match (including soft-deleted ones)
                const allClients = await db
                  .select()
                  .from(clients)
                  .where(eq(clients.therapistId, req.therapistId));
                
                const matchingClient = allClients.find(client => 
                  client.name.toLowerCase() === extractedClientName.toLowerCase() ||
                  // Handle name variations (Chris vs Christopher, etc.)
                  isNameVariation(client.name, extractedClientName)
                );

                // If we found a soft-deleted client, skip creating a new one
                if (matchingClient && matchingClient.deletedAt) {
                  console.log(`Skipping creation of soft-deleted client: ${extractedClientName}`);
                  continue; // Skip this session, don't create client or session
                }

                if (matchingClient && !matchingClient.deletedAt) {
                  clientId = matchingClient.id;
                  console.log(`Matched session to existing client: ${extractedClientName} -> ${matchingClient.name}`);
                } else {
                  // Create new client for SimplePractice appointments
                  const newClient = await storage.createClient({
                    therapistId: req.therapistId,
                    name: extractedClientName,
                    status: 'active',
                    email: null,
                    phone: null,
                    dateOfBirth: null,
                    emergencyContact: null,
                    insurance: null,
                    tags: ['SimplePractice Import']
                  });
                  clientId = newClient.id;
                  console.log(`Created new client from SimplePractice: ${extractedClientName}`);
                }
              } catch (clientError) {
                console.error(`Error matching/creating client for ${extractedClientName}:`, clientError);
                // Fall back to default client
              }
            }

            // Use the correct InsertSession format (camelCase)
            const sessionData: any = {
              id: session.id,
              clientId: clientId, // Use matched/created client ID
              therapistId: session.therapistId,
              scheduledAt: session.scheduledAt,
              duration: session.duration,
              sessionType: session.sessionType,
              status: session.status,
              notes: session.notes,
              googleEventId: session.googleEventId,
              isSimplePracticeEvent: (session as any).isSimplePracticeEvent || false,
              createdAt: session.createdAt,
              updatedAt: session.updatedAt
            };

            const savedSession = await storage.createSession(sessionData);
            savedSessions.push(savedSession);
          }
        } catch (sessionError) {
          console.error(`Error saving session ${session.id}:`, sessionError);
          // Continue with other sessions
        }
      }

      console.log(`Successfully saved ${savedSessions.length} sessions to database`);

      // After syncing sessions, link orphaned progress notes to sessions by date
      const { linkOrphanedProgressNotes } = await import("./services/calendarReconciliation");
      const linkingResult = await linkOrphanedProgressNotes(req.therapistId);
      console.log(`Linked ${linkingResult.linked} orphaned progress notes to sessions`);

      res.json({
        success: true,
        syncedCount: syncedSessions.length,
        savedCount: savedSessions.length,
        imported: savedSessions.length,
        orphanedNotesLinked: linkingResult.linked,
        sessions: syncedSessions,
        dateRange: { startDate: effectiveStartDate, endDate: effectiveEndDate }
      });

      await setAppSetting("calendar_last_sync", {
        lastSyncAt: new Date().toISOString(),
        startDate: effectiveStartDate,
        endDate: effectiveEndDate
      });
    } catch (error) {
      console.error("Error syncing calendar:", error);
      res.status(500).json({ error: "Failed to sync calendar events" });
    }
  });

  app.get("/api/calendar/sync-status", async (req, res) => {
    try {
      // Check if we have valid Google credentials
      const hasCredentials = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
      const hasRefreshToken = !!process.env.GOOGLE_REFRESH_TOKEN;
      
      // Get basic sync information
      const therapistId = req.therapistId || 'therapist-1';
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);

      const [allSessions, upcomingSessions, activeClients, placeholders, monthlySessions, lastSync] = await Promise.all([
        storage.getAllHistoricalSessions(therapistId, true),
        storage.getUpcomingSessions(therapistId, new Date()),
        storage.getClients(therapistId),
        storage.getProgressNotePlaceholders(therapistId),
        storage.getSessionsInDateRange(therapistId, monthStart, monthEnd),
        getAppSetting<{ lastSyncAt?: string }>("calendar_last_sync")
      ]);

      const lastSyncDate = lastSync?.lastSyncAt
        ? new Date(lastSync.lastSyncAt)
        : (allSessions.length > 0 
            ? allSessions.reduce((latest, session) => 
                session.createdAt > latest.createdAt ? session : latest
              ).createdAt 
            : null);

      res.json({
        isConnected: hasCredentials && hasRefreshToken,
        hasCredentials,
        hasRefreshToken,
        lastSync: lastSyncDate ? lastSyncDate.toISOString() : null,
        totalSessions: allSessions.length,
        syncedSessions: allSessions.filter(s => s.googleEventId).length,
        totalAppointments: allSessions.length,
        activeClients: activeClients.filter(client => client.status === "active").length,
        thisMonth: monthlySessions.length,
        upcomingSessions: upcomingSessions.length,
        missingNotes: placeholders.length
      });
    } catch (error) {
      console.error("Error getting sync status:", error);
      res.status(500).json({ 
        error: "Failed to get sync status",
        isConnected: false,
        hasCredentials: false,
        hasRefreshToken: false
      });
    }
  });

  app.get("/api/calendar/calendars", async (req, res) => {
    try {
      const calendars = await googleCalendarService.getCalendarList();
      res.json(calendars);
    } catch (error) {
      console.error("Error fetching calendars:", error);
      res.status(500).json({ error: "Failed to fetch calendar list" });
    }
  });

  app.get("/api/jobs/:id", async (req, res) => {
    try {
      const job = await getJob(req.params.id);
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }
      const therapistId = (req as any).therapistId || 'therapist-1';
      if (job.therapistId && job.therapistId !== therapistId) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(job);
    } catch (error) {
      console.error("Error fetching job status:", error);
      res.status(500).json({ error: "Failed to fetch job status" });
    }
  });

  app.get("/api/jobs", async (req, res) => {
    try {
      const limit = Number(req.query.limit || 50);
      const therapistId = (req as any).therapistId || 'therapist-1';
      const jobs = await listJobs(limit, therapistId);
      res.json({ jobs });
    } catch (error) {
      console.error("Error fetching job history:", error);
      res.status(500).json({ error: "Failed to fetch job history" });
    }
  });

  app.post("/api/jobs/:id/retry", async (req, res) => {
    try {
      const existing = await getJob(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Job not found" });
      }
      const therapistId = (req as any).therapistId || 'therapist-1';
      if (existing.therapistId && existing.therapistId !== therapistId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const job = await retryJob(req.params.id);
      res.json(job);
    } catch (error) {
      console.error("Error retrying job:", error);
      res.status(500).json({ error: "Failed to retry job" });
    }
  });

  app.get("/api/calendar/overview", async (req: any, res) => {
    try {
      const therapistId = req.therapistId || 'therapist-1';
      const { startDate, endDate } = req.query;

      const start = startDate ? new Date(startDate as string) : new Date('2010-01-01');
      const end = endDate ? new Date(endDate as string) : new Date('2035-12-31');

      const [sessions, notes] = await Promise.all([
        storage.getSessionsInDateRange(therapistId, start, end),
        storage.getProgressNotesInDateRange(therapistId, start, end)
      ]);

      const notesBySession = new Map<string, boolean>();
      for (const note of notes) {
        if (note.sessionId) {
          notesBySession.set(note.sessionId, true);
        }
      }

      const sessionsWithClients = await Promise.all(
        sessions.map(async (session) => {
          const client = await storage.getClient(session.clientId);
          return {
            ...session,
            client,
            hasProgressNote: notesBySession.has(session.id),
            missingNote: !notesBySession.has(session.id)
          };
        })
      );

      res.json({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        totalSessions: sessionsWithClients.length,
        missingNotes: sessionsWithClients.filter(session => session.missingNote).length,
        sessions: sessionsWithClients
      });
    } catch (error) {
      console.error("Error building calendar overview:", error);
      res.status(500).json({ error: "Failed to build calendar overview" });
    }
  });

  app.get("/api/calendar/reconcile", async (req: any, res) => {
    try {
      const therapistId = req.therapistId || 'therapist-1';
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : new Date(new Date().setMonth(new Date().getMonth() - 3));
      const end = endDate ? new Date(endDate as string) : new Date(new Date().setMonth(new Date().getMonth() + 3));
      const report = await reconcileCalendar(therapistId, start, end);
      res.json(report);
    } catch (error) {
      console.error("Error reconciling calendar:", error);
      res.status(500).json({ error: "Failed to reconcile calendar" });
    }
  });

  app.post("/api/progress-notes/placeholders/:sessionId", async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const therapistId = req.therapistId || 'therapist-1';

      const session = await storage.getSession(sessionId);
      if (!session || session.therapistId !== therapistId) {
        return res.status(404).json({ error: "Session not found" });
      }

      const existingNotes = await storage.getProgressNotesBySession(sessionId);
      if (existingNotes.length > 0) {
        return res.status(200).json({ message: "Progress note already exists", noteId: existingNotes[0].id });
      }

      const placeholder = await storage.createProgressNotePlaceholder(
        session.id,
        session.clientId,
        session.therapistId,
        session.scheduledAt
      );

      await storage.updateSession(session.id, {
        hasProgressNotePlaceholder: true,
        progressNoteStatus: 'placeholder'
      });

      res.json({ placeholder });
    } catch (error) {
      console.error("Error creating progress note placeholder:", error);
      res.status(500).json({ error: "Failed to create progress note placeholder" });
    }
  });

  // Mobile app export endpoint
  app.get("/api/export", async (req: any, res) => {
    try {
      const { scope = 'all', format = 'json' } = req.query;
      const therapistId = req.therapistId;

      let data: any = {};

      if (scope === 'all' || scope === 'clients') {
        data.clients = await storage.getClients(therapistId);
      }
      if (scope === 'all' || scope === 'sessions') {
        data.sessions = await storage.getUpcomingSessions(therapistId, new Date('2010-01-01'));
      }
      if (scope === 'all' || scope === 'notes') {
        const notes = await storage.getProgressNotes(therapistId);
        data.progressNotes = notes.map(note => ({
          ...note,
          content: note.content ? safeDecrypt(note.content) : null,
        }));
      }
      if (scope === 'all' || scope === 'treatment-plans') {
        const clientsList = await storage.getClients(therapistId);
        const plans = [];
        for (const client of clientsList) {
          const plan = await db.select().from(treatmentPlans).where(eq(treatmentPlans.clientId, client.id));
          if (plan.length > 0) {
            plans.push(...plan);
          }
        }
        data.treatmentPlans = plans;
      }

      data.exportedAt = new Date().toISOString();

      await ClinicalAuditLogger.logPHIAccess(
        therapistId,
        AuditAction.DATA_EXPORT,
        'bulk-export',
        req,
        { scope, format }
      );

      if (format === 'csv') {
        // Simple CSV conversion for primary data type
        let csvContent = '';
        const mainData = scope === 'clients' ? data.clients :
                        scope === 'sessions' ? data.sessions :
                        scope === 'notes' ? data.progressNotes :
                        scope === 'treatment-plans' ? data.treatmentPlans : data.clients;

        if (mainData && mainData.length > 0) {
          const headers = Object.keys(mainData[0]);
          csvContent = headers.join(',') + '\n';
          for (const row of mainData) {
            csvContent += headers.map(h => {
              const val = row[h];
              if (val === null || val === undefined) return '';
              if (typeof val === 'object') return JSON.stringify(val).replace(/"/g, '""');
              return String(val).replace(/"/g, '""').replace(/,/g, ' ');
            }).join(',') + '\n';
          }
        }
        res.setHeader('Content-Type', 'text/csv');
        res.send(csvContent);
      } else {
        res.json(data);
      }
    } catch (error) {
      console.error("Error exporting data:", error);
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  // Calendar connect/disconnect/settings endpoints for mobile app
  app.post("/api/calendar/connect", async (req: any, res) => {
    try {
      const { provider } = req.body;
      const authUrl = await googleCalendarService.getAuthUrl();
      res.json({ success: true, authUrl, provider });
    } catch (error) {
      console.error("Error connecting calendar:", error);
      res.status(500).json({ error: "Failed to connect calendar" });
    }
  });

  app.post("/api/calendar/disconnect", async (req: any, res) => {
    try {
      // Clear stored tokens
      await setAppSetting("google_calendar_tokens", null);
      await setAppSetting("calendar_last_sync", null);
      res.json({ success: true, message: "Calendar disconnected" });
    } catch (error) {
      console.error("Error disconnecting calendar:", error);
      res.status(500).json({ error: "Failed to disconnect calendar" });
    }
  });

  app.patch("/api/calendar/settings", async (req: any, res) => {
    try {
      const settings = req.body;
      await setAppSetting("calendar_settings", settings);
      res.json({ success: true, settings });
    } catch (error) {
      console.error("Error updating calendar settings:", error);
      res.status(500).json({ error: "Failed to update calendar settings" });
    }
  });

  app.get("/api/calendar/sync-logs", async (req: any, res) => {
    try {
      const limit = Number(req.query.limit || 10);
      // Return sync logs from app settings or empty array
      const logs = await getAppSetting<any[]>("calendar_sync_logs") || [];
      res.json(logs.slice(0, limit));
    } catch (error) {
      console.error("Error fetching sync logs:", error);
      res.status(500).json({ error: "Failed to fetch sync logs" });
    }
  });

  // ============================================
  // Calendar Events API (for iOS app)
  // ============================================

  // Get calendar events - returns sessions with calendar data for the iOS app
  app.get("/api/calendar-events", async (req: any, res) => {
    try {
      const therapistId = req.therapistId || 'therapist-1';
      const { startDate, endDate, source } = req.query;

      // Parse date filters
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
      const end = endDate ? new Date(endDate as string) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days ahead

      // Get sessions that have calendar data
      const allSessions = await storage.getSessions(therapistId);

      // Filter by date range and convert to calendar event format
      const calendarEvents = allSessions
        .filter(session => {
          const sessionDate = new Date(session.scheduledAt);
          return sessionDate >= start && sessionDate <= end;
        })
        .filter(session => {
          // Filter by source if specified
          if (!source) return true;
          if (source === 'google') return !!session.googleEventId;
          if (source === 'simplePractice') return session.isSimplePracticeEvent;
          if (source === 'therapyFlow') return !session.googleEventId && !session.isSimplePracticeEvent;
          return true;
        })
        .map(session => ({
          id: session.id,
          therapist_id: session.therapistId,
          external_id: session.googleEventId || session.id,
          source: session.isSimplePracticeEvent ? 'simplePractice' : (session.googleEventId ? 'google' : 'therapyFlow'),
          title: `Session - ${session.sessionType}`,
          description: session.notes || null,
          location: null,
          start_time: session.scheduledAt,
          end_time: new Date(new Date(session.scheduledAt).getTime() + session.duration * 60 * 1000),
          is_all_day: false,
          attendees: null,
          linked_client_id: session.clientId,
          linked_session_id: session.id,
          sync_status: 'synced',
          last_synced_at: session.updatedAt,
          sync_error: null,
          recurring_event_id: null,
          is_recurring: false,
          created_at: session.createdAt,
          updated_at: session.updatedAt
        }));

      res.json(calendarEvents);
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      res.status(500).json({ error: "Failed to fetch calendar events" });
    }
  });

  // Sync calendar events from external sources (for iOS app)
  app.post("/api/calendar-events/sync", async (req: any, res) => {
    try {
      const therapistId = req.therapistId || 'therapist-1';
      const { events, source } = req.body;

      if (!events || !Array.isArray(events)) {
        return res.status(400).json({ error: "Events array is required" });
      }

      let created = 0;
      let updated = 0;
      const errors: string[] = [];

      for (const event of events) {
        try {
          // Check if session already exists by external ID
          const existingSession = await storage.getSessionByGoogleEventId(event.externalId);

          if (existingSession) {
            // Update existing session
            await storage.updateSession(existingSession.id, {
              scheduledAt: new Date(event.startTime),
              duration: Math.floor((new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / 60000),
              notes: event.description || existingSession.notes,
              updatedAt: new Date()
            });
            updated++;
          } else {
            // Create new session from calendar event
            // Try to match client by attendee or title
            let clientId = 'default-client';

            const sessionData = {
              id: `cal-${event.externalId}`,
              clientId: event.linkedClientId || clientId,
              therapistId: therapistId,
              scheduledAt: new Date(event.startTime),
              duration: Math.floor((new Date(event.endTime).getTime() - new Date(event.startTime).getTime()) / 60000),
              sessionType: 'individual',
              status: new Date(event.startTime) > new Date() ? 'scheduled' : 'completed',
              notes: event.description || null,
              googleEventId: event.externalId,
              isSimplePracticeEvent: source === 'simplePractice',
              createdAt: new Date(),
              updatedAt: new Date()
            };

            await storage.createSession(sessionData);
            created++;
          }
        } catch (eventError: any) {
          errors.push(`Event ${event.externalId}: ${eventError.message}`);
        }
      }

      res.json({
        success: true,
        results: { created, updated, deleted: 0, errors },
        message: `Synced ${created + updated} events`
      });
    } catch (error) {
      console.error("Error syncing calendar events:", error);
      res.status(500).json({ error: "Failed to sync calendar events" });
    }
  });

  // Get pending sync events
  app.get("/api/calendar-events/pending/sync", async (req: any, res) => {
    try {
      // Return empty array - all events are synced in real-time
      res.json([]);
    } catch (error) {
      console.error("Error fetching pending calendar events:", error);
      res.status(500).json({ error: "Failed to fetch pending events" });
    }
  });

  // Mark event as synced
  app.post("/api/calendar-events/:id/mark-synced", async (req: any, res) => {
    try {
      const { id } = req.params;
      const { externalId } = req.body;

      // Update the session with the external ID if provided
      if (externalId) {
        await storage.updateSession(id, { googleEventId: externalId, updatedAt: new Date() });
      }

      const session = await storage.getSession(id);
      if (!session) {
        return res.status(404).json({ error: "Event not found" });
      }

      // Return in calendar event format
      res.json({
        id: session.id,
        therapist_id: session.therapistId,
        external_id: session.googleEventId || session.id,
        source: session.isSimplePracticeEvent ? 'simplePractice' : (session.googleEventId ? 'google' : 'therapyFlow'),
        title: `Session - ${session.sessionType}`,
        sync_status: 'synced',
        last_synced_at: new Date()
      });
    } catch (error) {
      console.error("Error marking event as synced:", error);
      res.status(500).json({ error: "Failed to mark event as synced" });
    }
  });

  // ============================================
  // Google Integration Routes (for iOS app)
  // ============================================

  // Store Google OAuth tokens from iOS app
  app.post("/api/integrations/google/store-tokens", async (req: any, res) => {
    try {
      // Support both camelCase and snake_case from iOS
      const accessToken = req.body.accessToken || req.body.access_token;
      const refreshToken = req.body.refreshToken || req.body.refresh_token;
      const expiresIn = req.body.expiresIn || req.body.expires_in;

      if (!accessToken) {
        console.log("store-tokens received:", JSON.stringify(req.body));
        return res.status(400).json({ error: "Access token is required" });
      }

      // Calculate expiry timestamp
      const expiryTimestamp = Date.now() + (expiresIn || 3600) * 1000;

      // Store tokens in app settings for server-side Google Calendar operations
      const tokens = {
        access_token: accessToken,
        refresh_token: refreshToken || '',
        expiry_date: expiryTimestamp,
        token_type: 'Bearer'
      };

      await setAppSetting("google_calendar_tokens", tokens);

      // Set the tokens in the Google Calendar service for immediate use
      if (googleCalendarService) {
        googleCalendarService.setTokens(tokens);
      }

      console.log("Google OAuth tokens stored from iOS app");
      res.json({ success: true, message: "Tokens stored successfully" });
    } catch (error) {
      console.error("Error storing Google tokens:", error);
      res.status(500).json({ error: "Failed to store tokens" });
    }
  });

  // Disconnect Google Calendar from iOS app
  app.post("/api/integrations/google/disconnect", async (req: any, res) => {
    try {
      // Clear stored tokens
      await setAppSetting("google_calendar_tokens", null);
      await setAppSetting("calendar_last_sync", null);

      // Clear tokens in the Google Calendar service
      if (googleCalendarService) {
        googleCalendarService.clearTokens();
      }

      console.log("Google Calendar disconnected from iOS app");
      res.json({ success: true, message: "Google Calendar disconnected" });
    } catch (error) {
      console.error("Error disconnecting Google Calendar:", error);
      res.status(500).json({ error: "Failed to disconnect" });
    }
  });

  // Get Google Calendar connection status
  app.get("/api/integrations/google/status", async (req: any, res) => {
    try {
      const tokens = await getAppSetting<any>("google_calendar_tokens");
      const isConnected = !!(tokens && tokens.access_token);
      const isExpired = tokens?.expiry_date ? Date.now() > tokens.expiry_date : true;

      res.json({
        connected: isConnected,
        expired: isExpired,
        lastSync: await getAppSetting("calendar_last_sync")
      });
    } catch (error) {
      console.error("Error getting Google Calendar status:", error);
      res.status(500).json({ error: "Failed to get status" });
    }
  });

  // Document upload and analyze endpoint for mobile app
  app.post("/api/documents/upload-analyze", upload.single('document'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { clientId } = req.body;
      const therapistId = req.therapistId;

      // Process document using existing enhanced processor
      // Signature: processDocument(file: Buffer, fileName: string, therapistId: string, documentId?: string)
      const result = await enhancedDocumentProcessor.processDocument(
        req.file.buffer,
        req.file.originalname,
        therapistId,
        clientId // Optional documentId for linking
      );

      res.json(result);
    } catch (error) {
      console.error("Error processing document:", error);
      res.status(500).json({ error: "Failed to process document" });
    }
  });

  // Bulk transcript import endpoint for mobile app
  app.post("/api/transcripts/bulk", upload.array('files', 100), async (req: any, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const { clientId } = req.body;
      const therapistId = req.therapistId;

      if (!clientId) {
        return res.status(400).json({ error: "clientId is required for bulk transcript import" });
      }

      // Process each file and combine results
      const allResults = [];
      for (const file of files) {
        const rawText = file.buffer.toString('utf-8');
        const result = await bulkImportProgressNotes(
          clientId,
          therapistId,
          rawText,
          { dryRun: false }
        );
        allResults.push({
          fileName: file.originalname,
          ...result
        });
      }

      res.json({
        success: true,
        fileCount: files.length,
        results: allResults,
        message: `Processing ${files.length} files`
      });
    } catch (error) {
      console.error("Error bulk importing transcripts:", error);
      res.status(500).json({ error: "Failed to process transcripts" });
    }
  });

  // Register transcript processing routes
  registerTranscriptRoutes(app);

  // Register enhanced AI routes
  app.use('/api/ai', aiRoutes);
  
  console.log("🤖 AI Services available at:");
  console.log("   POST /api/ai/analyze-note");
  console.log("   POST /api/ai/search");
  console.log("   GET  /api/ai/related-notes/:noteId");
  console.log("   GET  /api/ai/progress-patterns/:clientId");
  console.log("   POST /api/ai/safety-report");
  console.log("   GET  /api/ai/health");

  // Register session timeline routes
  app.use('/api/sessions', (await import('./routes/session-timeline-routes')).default);

  // Register AI services routes (ported from TherapyGenius)
  app.use('/api/ai-services', aiServicesRoutes);

  console.log("🧠 Enhanced AI Services available at:");
  console.log("   GET  /api/ai-services/health");
  console.log("   POST /api/ai-services/assessments/extract");
  console.log("   POST /api/ai-services/tags/session");
  console.log("   POST /api/ai-services/tags/client");
  console.log("   GET  /api/ai-services/insights/practice");
  console.log("   POST /api/ai-services/recommendations/session");
  console.log("   POST /api/ai-services/recommendations/treatment");

  // Register Smart Calendar Sync routes
  app.use('/api/calendar-sync', calendarSyncRoutes);

  console.log("📅 Smart Calendar Sync available at:");
  console.log("   GET  /api/calendar-sync/status");
  console.log("   POST /api/calendar-sync/sync");
  console.log("   GET  /api/calendar-sync/history");
  console.log("   POST /api/calendar-sync/alias");

  // Register Report Generation routes
  app.use('/api/reports', reportRoutes);

  console.log("📝 Report Generation available at:");
  console.log("   GET  /api/reports/types");
  console.log("   POST /api/reports/generate");
  console.log("   POST /api/reports/progress-summary");
  console.log("   POST /api/reports/export");

  const httpServer = createServer(app);
  return httpServer;
}
