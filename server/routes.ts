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
  insertAllianceScoreSchema
} from "@shared/schema";
import multer from "multer";
import { registerTranscriptRoutes } from "./routes/transcript-routes";
import { aiRoutes } from "./routes/ai-routes";
import { verifyClientOwnership, SecureClientQueries } from "./middleware/clientAuth";
import { ClinicalTransactions } from "./utils/transactions";
import { encryptClientData, decryptClientData, ClinicalEncryption } from "./utils/encryption";
import { ClinicalAuditLogger, AuditAction } from "./utils/auditLogger";
import { getAppSetting, setAppSetting } from "./utils/appSettings";
import { buildRetentionReport, applyRetention } from "./services/retentionService";
import { reconcileCalendar } from "./services/calendarReconciliation";

// Helper function to convert session to snake_case for iOS compatibility
function toSnakeCaseSession(session: any): any {
  if (!session) return session;
  return {
    id: session.id,
    client_id: session.clientId,
    therapist_id: session.therapistId,
    scheduled_at: session.scheduledAt,
    duration: session.duration,
    session_type: session.sessionType,
    status: session.status,
    google_event_id: session.googleEventId,
    notes: session.notes,
    has_progress_note_placeholder: session.hasProgressNotePlaceholder,
    progress_note_status: session.progressNoteStatus,
    is_simple_practice_event: session.isSimplePracticeEvent,
    created_at: session.createdAt,
    updated_at: session.updatedAt,
    client: session.client ? toSnakeCaseClient(session.client) : undefined,
  };
}

// Helper function to convert client to snake_case for iOS compatibility
function toSnakeCaseClient(client: any): any {
  if (!client) return client;
  return {
    id: client.id,
    therapist_id: client.therapistId,
    name: client.name,
    email: client.email,
    phone: client.phone,
    date_of_birth: client.dateOfBirth,
    emergency_contact: client.emergencyContact,
    insurance: client.insurance,
    tags: client.tags || [],
    clinical_considerations: client.clinicalConsiderations || [],
    preferred_modalities: client.preferredModalities || [],
    status: client.status,
    deleted_at: client.deletedAt,
    created_at: client.createdAt,
    updated_at: client.updatedAt,
  };
}

// Helper function to convert progress note to snake_case for iOS compatibility
function toSnakeCaseProgressNote(note: any): any {
  if (!note) return note;
  return {
    id: note.id,
    client_id: note.clientId,
    session_id: note.sessionId,
    therapist_id: note.therapistId,
    content: note.content,
    session_date: note.sessionDate,
    tags: note.tags,
    ai_tags: note.aiTags,
    embedding: note.embedding,
    risk_level: note.riskLevel,
    progress_rating: note.progressRating,
    quality_score: note.qualityScore,
    quality_flags: note.qualityFlags,
    status: note.status,
    is_placeholder: note.isPlaceholder,
    requires_manual_review: note.requiresManualReview,
    ai_confidence_score: note.aiConfidenceScore,
    processing_notes: note.processingNotes,
    original_document_id: note.originalDocumentId,
    created_at: note.createdAt,
    updated_at: note.updatedAt,
    client: note.client ? toSnakeCaseClient(note.client) : undefined,
    session: note.session ? toSnakeCaseSession(note.session) : undefined,
  };
}

// Helper function to convert document to snake_case for iOS compatibility
function toSnakeCaseDocument(doc: any): any {
  if (!doc) return doc;
  return {
    id: doc.id,
    client_id: doc.clientId,
    therapist_id: doc.therapistId,
    file_name: doc.fileName,
    file_type: doc.fileType,
    file_path: doc.filePath,
    extracted_text: doc.extractedText,
    tags: doc.tags || [],
    file_size: doc.fileSize,
    metadata: doc.metadata,
    uploaded_at: doc.uploadedAt,
    status: doc.status || "pending",
    document_type: doc.documentType,
    mime_type: doc.mimeType || doc.fileType,
    client_name: doc.clientName,
  };
}

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
  return match ? match[1].trim() : "";
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

// Extend Express Request type for therapist authentication
interface AuthenticatedRequest extends Request {
  therapistId: string;
  therapistName: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Seed endpoint to ensure therapist user exists (called before auth middleware)
  app.post("/api/seed-therapist", async (_req, res) => {
    try {
      const existingUser = await storage.getUser("dr-jonathan-procter");
      if (existingUser) {
        res.json({ message: "Therapist already exists", user: existingUser });
        return;
      }

      // Use raw insert to set specific ID
      const { users } = await import("@shared/schema");
      const [user] = await db.insert(users).values({
        id: "dr-jonathan-procter",
        username: "dr-jonathan-procter",
        password: "demo-mode-no-login",
        name: "Dr. Jonathan Procter",
        email: "dr.jonathan.procter@therapyflow.com",
        role: "therapist"
      }).returning();
      res.json({ message: "Therapist created", user });
    } catch (error) {
      console.error("Error seeding therapist:", error);
      res.status(500).json({ error: "Failed to seed therapist" });
    }
  });

  // Mock authentication middleware - Dr. Jonathan Procter
  // TODO: Replace with real authentication (session-based or JWT)
  const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
    // Dr. Jonathan Procter as the authenticated therapist
    (req as AuthenticatedRequest).therapistId = "dr-jonathan-procter";
    (req as AuthenticatedRequest).therapistName = "Dr. Jonathan Procter";
    next();
  };

  app.use(requireAuth);

  // Dashboard stats
  app.get("/api/dashboard/stats", async (req: any, res) => {
    try {
      const stats = await storage.getTherapistStats(req.therapistId);
      // Transform to snake_case for iOS compatibility
      res.json({
        active_clients: stats.activeClients,
        weekly_schedule: stats.weeklySchedule,
        total_notes: stats.totalNotes,
        ai_insights: stats.aiInsights,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // Clients endpoints
  app.get("/api/clients", async (req: any, res) => {
    try {
      const clients = await storage.getClients(req.therapistId);
      
      // Filter out non-client entries (calendar events, tasks, etc.)
      const nonClientPatterns = [
        /^Call with /i,
        /^Coffee with /i,
        /^Meeting with /i,
        /^Lunch with /i,
        /Deductible/i,
        /Appointment$/i,
        /& .* Appointment$/i,
        /^Reminder:/i,
        /^Task:/i,
        /^TODO:/i
      ];
      
      const actualClients = clients.filter(client => {
        return !nonClientPatterns.some(pattern => pattern.test(client.name));
      });
      
      res.json(actualClients.map(toSnakeCaseClient));
    } catch (error) {
      console.error("Error fetching clients:", error);
      res.status(500).json({ error: "Failed to fetch clients" });
    }
  });

  app.get("/api/clients/:clientId", verifyClientOwnership, async (req: any, res) => {
    try {
      // Client ownership already verified by middleware
      const client = req.verifiedClient;

      // Decrypt sensitive data before sending to client
      const decryptedClient = decryptClientData(client);
      res.json(toSnakeCaseClient(decryptedClient));
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
      res.json(toSnakeCaseClient(decryptedClient));
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
      res.json(toSnakeCaseClient(decryptedClient));
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

  // Get all sessions for a specific client
  app.get("/api/clients/:clientId/sessions", verifyClientOwnership, async (req: any, res) => {
    try {
      const clientId = req.params.clientId;
      const sessions = await storage.getSessions(clientId);
      
      // Fetch client data for each session
      const sessionsWithClients = await Promise.all(
        sessions.map(async (session) => {
          const client = await storage.getClient(session.clientId);
          return toSnakeCaseSession({ ...session, client });
        })
      );
      
      res.json(sessionsWithClients);
    } catch (error) {
      console.error("Error fetching client sessions:", error);
      res.status(500).json({ error: "Failed to fetch client sessions" });
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
      const {clientId, upcoming, today, date } = req.query;

      if (today === "true") {
        const sessions = await storage.getTodaysSessions(req.therapistId);
        // Fetch client data for each session
        const sessionsWithClients = await Promise.all(
          sessions.map(async (session) => {
            const client = await storage.getClient(session.clientId);
            return toSnakeCaseSession({ ...session, client });
          })
        );
        res.json(sessionsWithClients);
      } else if (upcoming === "true") {
        // Get upcoming sessions starting from now
        const sessions = await storage.getUpcomingSessions(req.therapistId, new Date());
        // Fetch client data for each session
        const sessionsWithClients = await Promise.all(
          sessions.map(async (session) => {
            const client = await storage.getClient(session.clientId);
            return toSnakeCaseSession({ ...session, client });
          })
        );
        res.json(sessionsWithClients);
      } else if (date) {
        // Filter sessions for a specific date with proper timezone handling
        const sessions = await storage.getSessionsByDate(req.therapistId, new Date(date));
        // Fetch client data for each session
        const sessionsWithClients = await Promise.all(
          sessions.map(async (session) => {
            const client = await storage.getClient(session.clientId);
            return toSnakeCaseSession({ ...session, client });
          })
        );
        res.json(sessionsWithClients);
      } else if (clientId) {
        const sessions = await storage.getSessions(clientId);
        res.json(sessions.map(toSnakeCaseSession));
      } else {
        // Return all upcoming and recent sessions for the therapist if no specific filter
        const sessions = await storage.getUpcomingSessions(req.therapistId, new Date('2010-01-01'));
        // Fetch client data for each session
        const sessionsWithClients = await Promise.all(
          sessions.map(async (session) => {
            const client = await storage.getClient(session.clientId);
            return toSnakeCaseSession({ ...session, client });
          })
        );
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

      res.json(toSnakeCaseSession(session));
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
      res.json(toSnakeCaseSession({ ...session, client }));
    } catch (error) {
      console.error("Error fetching session:", error);
      res.status(500).json({ error: "Failed to fetch session" });
    }
  });

  app.put("/api/sessions/:id", async (req: any, res) => {
    try {
      const sessionData = insertSessionSchema.partial().parse(req.body);
      const session = await storage.updateSession(req.params.id, sessionData);
      res.json(toSnakeCaseSession(session));
    } catch (error) {
      console.error("Error updating session:", error);
      res.status(400).json({ error: "Failed to update session" });
    }
  });

  app.get("/api/sessions/:id/prep", async (req: any, res) => {
    try {
      const sessionId = req.params.id;

      // Get session details
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Get client information
      const client = await storage.getClient(session.clientId);
      if (!client) {
        return res.status(404).json({ error: "Client not found" });
      }

      // First check if we already have a generated prep
      const existingPrep = await storage.getLatestSessionPrep(sessionId);
      if (existingPrep) {
        return res.json({
          id: existingPrep.id,
          session_id: existingPrep.sessionId,
          client_id: existingPrep.clientId,
          therapist_id: existingPrep.therapistId,
          prep: existingPrep.prep,
          created_at: existingPrep.createdAt
        });
      }

      // No existing prep - generate one on the fly
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
        };
      });

      const prep = await generateSessionPrep({
        therapistId: req.therapistId || 'dr-jonathan-procter',
        clientId: client.id,
        clientName: client.name,
        sessionId,
        previousNotes: recentNotes,
        treatmentPlan: treatmentPlan
          ? {
              goals: treatmentPlan.goals || [],
              objectives: treatmentPlan.objectives || [],
              interventions: treatmentPlan.interventions || [],
            }
          : undefined,
      });

      // Return in snake_case format for iOS
      res.json({
        id: prep.id,
        session_id: prep.sessionId,
        client_id: prep.clientId,
        therapist_id: prep.therapistId,
        prep: prep.prep,
        created_at: prep.createdAt
      });
    } catch (error) {
      console.error("Error fetching session prep data:", error);
      res.status(500).json({ error: "Failed to fetch session preparation data" });
    }
  });

  // POST endpoint for iOS - generates AI session prep
  app.post("/api/sessions/:id/prep", async (req: any, res) => {
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
        };
      });

      const prep = await generateSessionPrep({
        therapistId: req.therapistId || 'dr-jonathan-procter',
        clientId: client.id,
        clientName: client.name,
        sessionId,
        previousNotes: recentNotes,
        treatmentPlan: treatmentPlan
          ? {
              goals: treatmentPlan.goals || [],
              objectives: treatmentPlan.objectives || [],
              interventions: treatmentPlan.interventions || [],
            }
          : undefined,
      });

      // Return in snake_case format for iOS
      res.json({
        id: prep.id,
        session_id: prep.sessionId,
        therapist_id: prep.therapistId,
        client_id: prep.clientId,
        prep: prep.prep,
        generated_at: prep.generatedAt,
        created_at: prep.createdAt
      });
    } catch (error) {
      console.error("Error generating AI session prep:", error);
      res.status(500).json({ error: "Failed to generate session preparation" });
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

      // Fetch client data for each session
      const sessionsWithClients = await Promise.all(
        sessions.map(async (session) => {
          const client = await storage.getClient(session.clientId);
          return toSnakeCaseSession({ ...session, client });
        })
      );

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

      // Fetch client data for each session
      const sessionsWithClients = await Promise.all(
        sessions.map(async (session) => {
          const client = await storage.getClient(session.clientId);
          return toSnakeCaseSession({ ...session, client });
        })
      );

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
      const { clientId, search, recent } = req.query;

      if (recent === "true") {
        const notes = await storage.getRecentProgressNotes(req.therapistId);
        // Fetch client data for each note and decrypt
        const notesWithClients = await Promise.all(
          notes.map(async (note) => {
            const client = await storage.getClient(note.clientId);
            return toSnakeCaseProgressNote({
              ...note,
              client,
              // Decrypt progress note content (gracefully handle non-encrypted data)
              content: note.content ? safeDecrypt(note.content) : null
            });
          })
        );
        res.json(notesWithClients);
      } else if (search) {
        const notes = await storage.searchProgressNotes(req.therapistId, search);
        // Decrypt content before returning (gracefully handle non-encrypted data)
        const decryptedNotes = notes.map(note => toSnakeCaseProgressNote({
          ...note,
          content: note.content ? safeDecrypt(note.content) : null
        }));
        res.json(decryptedNotes);
      } else if (clientId) {
        // Verify client ownership before returning notes
        const clientCheck = await SecureClientQueries.getClient(clientId, req.therapistId);
        if (clientCheck.length === 0) {
          return res.status(403).json({ error: "Access denied" });
        }

        const notes = await storage.getProgressNotes(clientId);
        // Decrypt content before returning (gracefully handle non-encrypted data)
        const decryptedNotes = notes.map(note => toSnakeCaseProgressNote({
          ...note,
          content: note.content ? safeDecrypt(note.content) : null
        }));
        res.json(decryptedNotes);
      } else {
        // No parameters - return all notes for therapist (use large limit)
        const notes = await storage.getRecentProgressNotes(req.therapistId, 1000);
        // Fetch client data for each note and decrypt
        const notesWithClients = await Promise.all(
          notes.map(async (note) => {
            const client = await storage.getClient(note.clientId);
            return toSnakeCaseProgressNote({
              ...note,
              client,
              content: note.content ? safeDecrypt(note.content) : null
            });
          })
        );
        res.json(notesWithClients);
      }
    } catch (error) {
      console.error("Error fetching progress notes:", error);
      res.status(500).json({ error: "Failed to fetch progress notes" });
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
          createdNotes: result.createdNotes?.length || 0,
          missingSessions: result.missingSessions?.length || 0,
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
      });

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
          aiTags: aiTags.map(tag => tag.name),
          riskLevel: noteData.riskLevel || 'low',
          progressRating: noteData.progressRating || undefined
        },
        aiTags.length > 0 ? {
          insights: aiTags.map(tag => tag.name),
          tags: aiTags.map(tag => tag.name),
          riskFactors: []
        } : undefined
      );

      // Decrypt content before returning (gracefully handle non-encrypted data)
      const decryptedNote = toSnakeCaseProgressNote({
        ...result.progressNote,
        content: result.progressNote.content ? safeDecrypt(result.progressNote.content) : null
      });

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
      const notesWithClients = await Promise.all(
        notes.map(async (note) => {
          const client = await storage.getClient(note.clientId);
          const session = note.sessionId ? await storage.getSession(note.sessionId) : null;
          return toSnakeCaseProgressNote({
            ...note,
            client,
            session,
            content: note.content ? safeDecrypt(note.content) : null
          });
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
      const placeholdersWithClients = await Promise.all(
        placeholders.map(async (note) => {
          const client = await storage.getClient(note.clientId);
          const session = note.sessionId ? await storage.getSession(note.sessionId) : null;
          return toSnakeCaseProgressNote({
            ...note,
            client,
            session,
            content: note.content ? safeDecrypt(note.content) : null
          });
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
      const updates = insertProgressNoteSchema.partial().parse(req.body);

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
        const aiTags = await aiService.generateClinicalTags(originalContent);
        const embedding = await aiService.generateEmbedding(originalContent);
        updates.aiTags = aiTags.map(tag => tag.name);
        updates.embedding = embedding;
        
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

  // Get all documents for a therapist
  app.get("/api/documents", async (req: any, res) => {
    try {
      const therapistId = req.therapistId || 'dr-jonathan-procter';
      const documents = await storage.getDocumentsByTherapist(therapistId);

      // Return documents with snake_case keys for iOS compatibility
      const formattedDocs = documents.map((doc: any) => ({
        id: doc.id,
        client_id: doc.clientId,
        therapist_id: doc.therapistId,
        file_name: doc.fileName,
        file_type: doc.fileType,
        file_path: doc.filePath,
        extracted_text: doc.extractedText,
        tags: doc.tags || [],
        file_size: doc.fileSize,
        metadata: doc.metadata,
        uploaded_at: doc.uploadedAt,
        status: doc.status || 'pending',
        document_type: doc.documentType,
        mime_type: doc.mimeType,
        client_name: doc.clientName
      }));

      res.json(formattedDocs);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  // Enhanced Document Upload and Processing endpoints
  // Accept both 'file' (iOS) and 'document' (web) field names
  app.post("/api/documents/upload", upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Check if this is an iOS request (has clientId field or mobile=true)
      const isMobileRequest = req.body.clientId !== undefined || req.body.mobile === 'true';

      if (isMobileRequest) {
        // iOS/Mobile flow: Save file, create Document record, return Document object
        console.log(`📱 iOS upload request for ${req.file.originalname}`);

        const { clientId, analyze } = req.body;
        const therapistId = req.therapistId || 'dr-jonathan-procter';

        // Get or create a default client if none provided
        let actualClientId = clientId;
        if (!actualClientId) {
          const clients = await storage.getClients(therapistId);
          if (clients.length > 0) {
            actualClientId = clients[0].id;
          } else {
            actualClientId = "unassigned";
          }
        }

        // Save file to disk
        const fs = await import('fs/promises');
        const path = await import('path');
        const uploadDir = path.resolve(process.cwd(), "uploads");
        await fs.mkdir(uploadDir, { recursive: true });

        const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storedName = `${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName}`;
        const storedPath = path.join(uploadDir, storedName);

        await fs.writeFile(storedPath, req.file.buffer);

        // Create document record
        const doc = await storage.createDocument({
          clientId: actualClientId,
          therapistId,
          fileName: req.file.originalname,
          fileType: req.file.mimetype,
          filePath: `/uploads/${storedName}`,
          fileSize: req.file.size,
          metadata: {
            originalName: req.file.originalname,
            storedName,
            size: req.file.size
          }
        });

        // If analyze flag is set, trigger intelligent AI processing asynchronously
        // This will automatically detect if it's a transcript, progress note, or bulk notes
        // and process accordingly
        if (analyze === "true") {
          // Fire and forget - process with intelligent document classification
          enhancedDocumentProcessor.processDocumentIntelligently(
            req.file.buffer,
            req.file.originalname,
            therapistId,
            doc.id
          ).then(result => {
            console.log(`📊 Intelligent processing result: ${result.documentType}, ${result.totalProcessed} notes processed`);
            if (result.errors.length > 0) {
              console.warn("Processing errors:", result.errors);
            }
          }).catch(err => {
            console.error("AI processing error for document", doc.id, err);
          });
        }

        // Return document in snake_case format for iOS
        return res.status(201).json(toSnakeCaseDocument({
          ...doc,
          status: analyze === "true" ? "processing" : "pending"
        }));
      }

      // Web flow: Enhanced processing
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

      console.log(`🧠 Processing ${req.file.originalname} with intelligent document analysis...`);

      // Use intelligent processing that automatically detects document type:
      // - Transcripts -> Comprehensive clinical progress notes
      // - Progress Notes -> Extract and file by date
      // - Bulk Notes -> Split and file each by date of service
      const result = await enhancedDocumentProcessor.processDocumentIntelligently(
        req.file.buffer,
        req.file.originalname,
        req.therapistId
      );

      // Log success metrics
      if (result.success) {
        console.log(`✅ Intelligent processing completed: ${result.documentType}`);
        console.log(`📊 Processed ${result.totalProcessed} notes`);
        if (result.errors.length > 0) {
          console.warn(`⚠️ Processing had ${result.errors.length} errors:`, result.errors);
        }
      } else {
        console.log(`❌ Intelligent processing failed: ${result.processingNotes}`);
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

      res.json({
        success: true,
        syncedCount: syncedSessions.length,
        savedCount: savedSessions.length,
        imported: savedSessions.length,
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
      const therapistId = req.therapistId || 'dr-jonathan-procter';
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
      const therapistId = (req as any).therapistId || 'dr-jonathan-procter';
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
      const therapistId = (req as any).therapistId || 'dr-jonathan-procter';
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
      const therapistId = (req as any).therapistId || 'dr-jonathan-procter';
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
      const therapistId = req.therapistId || 'dr-jonathan-procter';
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
      const therapistId = req.therapistId || 'dr-jonathan-procter';
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
      const therapistId = req.therapistId || 'dr-jonathan-procter';

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

  // Document upload and analyze endpoint for mobile app
  app.post("/api/documents/upload-analyze", upload.single('document'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const { clientId } = req.body;
      const therapistId = req.therapistId;

      // Process document using existing enhanced processor
      const result = await enhancedDocumentProcessor.processDocument(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        therapistId,
        clientId
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

      const therapistId = req.therapistId;

      // Queue bulk import job
      const jobId = await bulkImportProgressNotes(
        files.map(f => ({
          buffer: f.buffer,
          originalname: f.originalname,
          mimetype: f.mimetype,
        })),
        therapistId
      );

      res.json({
        success: true,
        jobId,
        fileCount: files.length,
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

  // Register calendar events routes
  app.use('/api/calendar-events', (await import('./routes/calendar-events')).default);
  console.log("📅 Calendar Events API available at:");
  console.log("   GET  /api/calendar-events");
  console.log("   POST /api/calendar-events");
  console.log("   POST /api/calendar-events/sync");
  console.log("   GET  /api/calendar-events/pending/sync");

  const httpServer = createServer(app);
  return httpServer;
}
