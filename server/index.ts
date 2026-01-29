import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./vite";
import { integrateTherapeuticFeatures } from "./integrate-therapeutic";
import { documentsRouter } from "./routes/documents.js";
import { aiRouter } from "./routes/ai.js";
import { semanticRouter } from "./routes/semantic.js";
import { knowledgeGraphRoutes } from "./routes/knowledge-graph-routes-fixed.js";
import { storage } from "./storage.js";
import { db } from "./db.js";
import { sql, eq, like } from "drizzle-orm";
import { sessions, clients, sessionPreps, progressNotes, documents } from "@shared/schema";

// Import middleware
import { standardRateLimit, aiProcessingRateLimit } from './middleware/rateLimit';
import { authMiddleware, optionalAuthMiddleware } from './middleware/auth';

// Import services
import { pdfService, getPdfServiceStatus } from './services/pdfService';
import { reconcileCalendar } from './services/calendarReconciliation';
import { initializeRealtimeVoice, getRealtimeVoiceService } from './services/realtimeVoice';

// Error tracking for monitoring
const errorCounts = new Map<string, { count: number; lastSeen: Date }>();
const MAX_ERROR_LOG_INTERVAL_MS = 60000; // Only log same error once per minute

function categorizeError(errorStr: string): { category: string; isRecoverable: boolean } {
  const lowerError = errorStr.toLowerCase();

  if (lowerError.includes('google') || lowerError.includes('calendar') || lowerError.includes('oauth')) {
    return { category: 'google-calendar', isRecoverable: true };
  }
  if (lowerError.includes('neon') || lowerError.includes('database') || lowerError.includes('@neondatabase')) {
    return { category: 'database', isRecoverable: true };
  }
  if (lowerError.includes('econnrefused') || lowerError.includes('timeout') || lowerError.includes('websocket')) {
    return { category: 'network', isRecoverable: true };
  }
  if (lowerError.includes('errorevent') || lowerError.includes('getter')) {
    return { category: 'internal-api', isRecoverable: true };
  }

  return { category: 'unknown', isRecoverable: false };
}

function shouldLogError(errorKey: string): boolean {
  const now = new Date();
  const existing = errorCounts.get(errorKey);

  if (!existing) {
    errorCounts.set(errorKey, { count: 1, lastSeen: now });
    return true;
  }

  existing.count++;
  const timeSinceLastLog = now.getTime() - existing.lastSeen.getTime();

  if (timeSinceLastLog >= MAX_ERROR_LOG_INTERVAL_MS) {
    console.warn(`[Error Monitor] ${errorKey} occurred ${existing.count} times in the last ${Math.round(timeSinceLastLog / 1000)}s`);
    existing.count = 0;
    existing.lastSeen = now;
    return true;
  }

  return false;
}

// Global error handlers for unhandled promises and exceptions
process.on('unhandledRejection', (reason, promise) => {
  const reasonStr = String(reason);
  const { category, isRecoverable } = categorizeError(reasonStr);
  const errorKey = `rejection:${category}`;

  if (shouldLogError(errorKey)) {
    console.error(`[${new Date().toISOString()}] Unhandled Rejection (${category}):`, reasonStr.substring(0, 200));
  }

  if (!isRecoverable) {
    console.error('[Error Monitor] Non-recoverable rejection detected - full details:', reason);
  }
});

process.on('uncaughtException', (error) => {
  const errorStr = String(error);
  const errorMsg = error?.message || '';
  const { category, isRecoverable } = categorizeError(errorStr + ' ' + errorMsg);
  const errorKey = `exception:${category}`;

  if (shouldLogError(errorKey)) {
    console.error(`[${new Date().toISOString()}] Uncaught Exception (${category}):`, errorMsg || errorStr.substring(0, 200));
  }

  if (!isRecoverable) {
    console.error('[Error Monitor] Fatal uncaught exception - full stack:', error);
    console.error('[Error Monitor] Exiting process due to unrecoverable error');
    process.exit(1);
  }
});

const app = express();

// Security: Limit request body size to prevent DoS attacks
// 10MB for JSON (allows large document content)
// 50MB for URL-encoded (allows file uploads)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Serve uploaded documents for previews/downloads
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

// Apply standard rate limiting to all API endpoints
app.use('/api', standardRateLimit);

// Health endpoints - MUST be before auth middleware (public endpoints for monitoring)
app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    version: process.env.APP_VERSION || "dev",
    time: new Date().toISOString(),
    services: {
      pdf: getPdfServiceStatus(),
    },
  });
});

app.get('/api/ai/health', (req, res) => {
  res.json({
    openai: !!process.env.OPENAI_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/health/deep", async (req, res) => {
  const start = Date.now();
  try {
    const nowResult = await db.execute(sql`SELECT now() as now`);
    const now = nowResult.rows[0]?.now;
    const docsResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM documents`);
    const docsCount = docsResult.rows[0]?.count || 0;
    const aiResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM ai_document_results`);
    const aiCount = aiResult.rows[0]?.count || 0;
    const edgesResult = await db.execute(sql`SELECT COUNT(*)::int as count FROM semantic_edges`);
    const edgesCount = edgesResult.rows[0]?.count || 0;

    res.json({
      ok: true,
      time: new Date().toISOString(),
      dbTime: now,
      metrics: { documents: docsCount, aiResults: aiCount, edges: edgesCount },
      took_ms: Date.now() - start,
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e), took_ms: Date.now() - start });
  }
});

app.get("/api/health/ready", async (req, res) => {
  try {
    await db.execute(sql`SELECT 1`);
    res.json({ status: "ready", timestamp: new Date().toISOString() });
  } catch (e: any) {
    res.status(503).json({ status: "not ready", error: String(e) });
  }
});

app.get("/api/health/routes", (req, res) => {
  res.json({
    status: "ok",
    message: "Routes endpoint - use for debugging route registration",
    timestamp: new Date().toISOString()
  });
});

// Public admin endpoints (before auth middleware)
// These use a simple secret key check instead of JWT
app.post('/api/public/cleanup-sessions', async (req: any, res) => {
  const adminKey = req.headers['x-admin-key'] || req.query.key;
  const expectedKey = process.env.ADMIN_SECRET_KEY || 'therapyflow-admin-2024';

  if (adminKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[Admin] Running public cleanup endpoint');

    // Find all sessions with "Client deactivated" notes
    const deactivatedSessions = await db
      .select({
        sessionId: sessions.id,
        clientId: sessions.clientId,
        scheduledAt: sessions.scheduledAt,
        status: sessions.status,
        notes: sessions.notes,
      })
      .from(sessions)
      .where(like(sessions.notes, '%Client deactivated%'));

    let deletedCount = 0;
    let orphanedCount = 0;

    for (const session of deactivatedSessions) {
      const client = await db
        .select({ id: clients.id, name: clients.name, status: clients.status })
        .from(clients)
        .where(eq(clients.id, session.clientId))
        .limit(1);

      if (client.length === 0 || client[0].status === 'deleted') {
        console.log(`Deleting session ${session.sessionId} (client: ${session.clientId.substring(0, 8)}...)`);

        // Delete related records first (foreign key constraints)
        await db.delete(sessionPreps).where(eq(sessionPreps.sessionId, session.sessionId));
        await db.delete(progressNotes).where(eq(progressNotes.sessionId, session.sessionId));

        // Now delete the session
        await db.delete(sessions).where(eq(sessions.id, session.sessionId));
        if (client.length === 0) orphanedCount++;
        deletedCount++;
      }
    }

    res.json({
      success: true,
      summary: {
        totalFound: deactivatedSessions.length,
        deleted: deletedCount,
        orphaned: orphanedCount,
      },
      message: deletedCount > 0
        ? `Cleaned up ${deletedCount} deactivated session(s)`
        : "No orphaned sessions found to clean up"
    });
  } catch (error) {
    console.error("Error in public cleanup:", error);
    res.status(500).json({ error: "Failed to cleanup", details: error instanceof Error ? error.message : String(error) });
  }
});

// Public endpoint to process documents using already-extracted text
app.post('/api/public/process-documents', async (req: any, res) => {
  const adminKey = req.headers['x-admin-key'] || req.query.key;
  const expectedKey = process.env.ADMIN_SECRET_KEY || 'therapyflow-admin-2024';
  if (adminKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { limit = 5 } = req.body || {};
    const { desc: descOrder } = await import('drizzle-orm');
    const { aiService: ai } = await import('./services/aiService');

    // Get documents with extracted text
    const allDocs = await db
      .select()
      .from(documents)
      .where(eq(documents.therapistId, 'therapist-1'))
      .orderBy(descOrder(documents.uploadedAt));

    const docsToProcess = allDocs
      .filter((doc: any) => doc.extractedText && doc.extractedText.length > 100)
      .slice(0, limit);

    console.log(`[PublicProcess] Found ${docsToProcess.length} docs with extractedText to process`);

    const results: any[] = [];

    for (const doc of docsToProcess) {
      try {
        const text = (doc as any).extractedText.substring(0, 8000);
        const prompt = `Analyze this therapy document and extract information.
Document: ${doc.fileName}

Content:
${text}

Return JSON only:
{
  "clientName": "client first name if found",
  "sessionDate": "YYYY-MM-DD if found",
  "clinicalThemes": ["theme1", "theme2"],
  "summary": "2-3 sentence summary"
}`;

        const aiResponse = await ai.processTherapyDocument(text, prompt);
        let extracted: any = {};
        try { extracted = JSON.parse(aiResponse); } catch { extracted = { summary: aiResponse.substring(0, 200) }; }

        // Update document metadata
        await db.update(documents).set({
          processingStatus: 'completed',
          status: 'processed',
          metadata: {
            ...((doc.metadata as any) || {}),
            aiProcessed: true,
            processedAt: new Date().toISOString(),
            extractedThemes: extracted.clinicalThemes || [],
            summary: extracted.summary || '',
            detectedClientName: extracted.clientName || '',
            detectedSessionDate: extracted.sessionDate || '',
          }
        } as any).where(eq(documents.id, doc.id));

        results.push({ fileName: doc.fileName, success: true, extracted });
      } catch (docError: any) {
        results.push({ fileName: doc.fileName, success: false, error: docError.message });
      }
    }

    res.json({
      success: true,
      totalWithText: allDocs.filter((d: any) => d.extractedText && d.extractedText.length > 100).length,
      processed: results.length,
      results
    });
  } catch (error) {
    console.error("Error in public process-documents:", error);
    res.status(500).json({ error: "Failed", details: error instanceof Error ? error.message : String(error) });
  }
});

// Public endpoint to link AI-processed documents to matching clients and sessions
app.post('/api/public/link-documents', async (req: any, res) => {
  const adminKey = req.headers['x-admin-key'] || req.query.key;
  const expectedKey = process.env.ADMIN_SECRET_KEY || 'therapyflow-admin-2024';
  if (adminKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get all AI-processed documents
    const allDocs = await db
      .select()
      .from(documents)
      .where(eq(documents.therapistId, 'therapist-1'));

    const aiProcessedDocs = allDocs.filter((doc: any) => {
      const meta = doc.metadata as any;
      return meta && meta.aiProcessed === true;
    });

    console.log(`[LinkDocs] Found ${aiProcessedDocs.length} AI-processed documents to link`);

    // Get all clients for name matching
    const allClients = await db
      .select({ id: clients.id, name: clients.name, status: clients.status })
      .from(clients)
      .where(eq(clients.therapistId, 'therapist-1'));

    // Get all sessions for date matching
    const allSessions = await db
      .select({ id: sessions.id, clientId: sessions.clientId, scheduledAt: sessions.scheduledAt, status: sessions.status })
      .from(sessions)
      .where(eq(sessions.therapistId, 'therapist-1'));

    const results: any[] = [];

    for (const doc of aiProcessedDocs) {
      const meta = doc.metadata as any;
      const detectedName = (meta.detectedClientName || '').trim().toLowerCase();
      const detectedDate = meta.detectedSessionDate || '';
      const currentClientId = doc.clientId;

      let matchedClient: any = null;
      let matchedSession: any = null;
      let clientMismatch = false;

      // Find best client match by name
      if (detectedName && detectedName.length > 1) {
        // Exact match first
        matchedClient = allClients.find((c: any) =>
          c.name.toLowerCase() === detectedName
        );
        // Partial match (first name or last name)
        if (!matchedClient) {
          matchedClient = allClients.find((c: any) => {
            const cName = c.name.toLowerCase();
            const parts = detectedName.split(' ');
            return parts.some((p: string) => p.length > 2 && cName.includes(p)) ||
                   cName.split(' ').some((p: string) => p.length > 2 && detectedName.includes(p));
          });
        }

        if (matchedClient && matchedClient.id !== currentClientId) {
          clientMismatch = true;
        }
      }

      // Find matching session by date
      if (detectedDate) {
        const targetDate = new Date(detectedDate);
        if (!isNaN(targetDate.getTime())) {
          // Find session within ±24 hours for the assigned client
          const clientIdToMatch = matchedClient?.id || currentClientId;
          const clientSessions = allSessions.filter((s: any) => s.clientId === clientIdToMatch);

          matchedSession = clientSessions.find((s: any) => {
            const sessionDate = new Date(s.scheduledAt);
            const diffMs = Math.abs(sessionDate.getTime() - targetDate.getTime());
            return diffMs < 24 * 60 * 60 * 1000; // within 24 hours
          });
        }
      }

      // Update document metadata with linking results
      const updatedMeta = {
        ...meta,
        linkedAt: new Date().toISOString(),
        matchedClientId: matchedClient?.id || null,
        matchedClientName: matchedClient?.name || null,
        clientMismatch,
        matchedSessionId: matchedSession?.id || null,
        matchedSessionDate: matchedSession?.scheduledAt?.toISOString() || null,
        linkingStatus: matchedSession ? 'linked' : (matchedClient ? 'client_matched' : 'unmatched'),
      };

      // If we found a matching session, store it in metadata.sessionId
      if (matchedSession) {
        updatedMeta.sessionId = matchedSession.id;
        updatedMeta.sessionDate = matchedSession.scheduledAt.toISOString().split('T')[0];
      }

      await db.update(documents).set({
        metadata: updatedMeta,
        // Update clientId if mismatch detected and matched client is active
        ...(clientMismatch && matchedClient.status === 'active'
          ? { clientId: matchedClient.id }
          : {}),
      } as any).where(eq(documents.id, doc.id));

      results.push({
        fileName: doc.fileName,
        currentClient: allClients.find((c: any) => c.id === currentClientId)?.name || currentClientId,
        detectedClient: meta.detectedClientName || 'none',
        matchedClient: matchedClient?.name || 'none',
        clientMismatch,
        clientUpdated: clientMismatch && matchedClient?.status === 'active',
        sessionLinked: !!matchedSession,
        matchedSessionDate: matchedSession?.scheduledAt?.toISOString()?.split('T')[0] || 'none',
        linkingStatus: updatedMeta.linkingStatus,
      });
    }

    const linked = results.filter(r => r.sessionLinked).length;
    const clientMatched = results.filter(r => r.matchedClient !== 'none').length;
    const mismatches = results.filter(r => r.clientMismatch).length;

    res.json({
      success: true,
      total: results.length,
      summary: { linked, clientMatched, mismatches, unmatched: results.length - clientMatched },
      results,
    });
  } catch (error) {
    console.error("Error in link-documents:", error);
    res.status(500).json({ error: "Failed", details: error instanceof Error ? error.message : String(error) });
  }
});

// Authentication: In production, enforce proper JWT auth; in development, use hardcoded therapist
if (process.env.NODE_ENV === 'production' && process.env.ENABLE_AUTH !== 'false') {
  // Production: Apply JWT authentication middleware to protected routes
  app.use('/api', authMiddleware);
  console.log('[Auth] Production mode: JWT authentication enabled');
} else {
  // Development/Testing OR production with ENABLE_AUTH=false: Single-therapist mode
  // Using 'therapist-1' to match existing client data in the database
  app.use((req: any, res, next) => {
    req.therapistId = 'therapist-1';
    req.user = { id: 'therapist-1', role: 'therapist' };
    next();
  });
  console.log('[Auth] Single-therapist mode: Using hardcoded therapist-1');
}

// Apply stricter rate limiting to AI/document processing endpoints
app.use('/api/ai', aiProcessingRateLimit);
app.use('/api/documents/process', aiProcessingRateLimit);
app.use('/api/documents/analyze', aiProcessingRateLimit);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Debug endpoint to check database connection - DEVELOPMENT ONLY
app.get("/api/debug/db", async (req, res) => {
  // Security: Only allow in development mode
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: "Not found" });
  }

  try {
    const dbUrl = process.env.DATABASE_URL || "NOT SET";
    // Mask password and sensitive parts for security
    const maskedUrl = dbUrl
      .replace(/:[^:@]+@/, ':****@')  // Mask password
      .replace(/\?.*$/, '');  // Remove query params which might contain secrets

    // Only show host, no other connection details
    const hostMatch = dbUrl.match(/@([^:/]+)/);
    const dbHost = hostMatch ? hostMatch[1] : "unknown";

    res.json({
      host: dbHost,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString()
    });
  } catch (e: any) {
    res.status(500).json({ error: "Database check failed" });  // Don't expose error details
  }
});

(async () => {
  const server = await registerRoutes(app);

  // Register CareNotesAI pipeline routes
  app.use("/api/documents", documentsRouter);
  app.use("/api/ai", aiRouter);
  app.use("/api/semantic", semanticRouter);
  app.use("/api", knowledgeGraphRoutes);
  log("✅ CareNotesAI document processing pipeline routes registered");
  log("🧠 Clinical Second Brain knowledge graph routes registered");

  // Integrate therapeutic journey features
  integrateTherapeuticFeatures(app);
  log("✅ Therapeutic journey features integrated");

  // API not found fallback to avoid serving HTML for missing API routes.
  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ error: "API route not found" });
  });

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log the error for debugging
    console.error(`[ERROR] ${status}: ${message}`, err.stack || err);

    // Only send response if headers haven't been sent
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    // Dynamic import to avoid bundling vite in production
    const { setupViteDev } = await import("./vite-dev.js");
    await setupViteDev(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  
  // Initialize RealtimeVoiceService with WebSocket support
  // Supports both OpenAI and ElevenLabs TTS providers
  const realtimeVoice = initializeRealtimeVoice({
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    elevenlabsApiKey: process.env.ELEVENLABS_API_KEY,
    defaultVoice: 'nova',
    defaultProvider: process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : 'openai',
  });

  // Attach WebSocket server to HTTP server
  realtimeVoice.initializeWebSocket(server);
  log("🎤 Real-time voice WebSocket server initialized on /ws/voice");

  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    log(`serving on port ${port}`);
    log(`📍 Therapeutic API endpoints available at:`);
    log(`   POST /api/therapeutic/synthesize/:clientId`);
    log(`   POST /api/therapeutic/recall/:clientId`);
    log(`   GET  /api/therapeutic/insights/:clientId`);
    log(`   GET  /api/therapeutic/tags/:clientId`);
    // Calendar reconciliation - uses configured therapist ID
    const shouldReconcile = process.env.ENABLE_CALENDAR_RECONCILIATION !== "false";
    if (shouldReconcile) {
      const runReconcile = async () => {
        try {
          // Use environment variable for calendar reconciliation therapist
          // Falls back to dev therapist ID for backwards compatibility in dev
          const therapistId = process.env.CALENDAR_RECONCILE_THERAPIST_ID
            || process.env.DEV_THERAPIST_ID
            || (process.env.NODE_ENV !== "production" ? "therapist-1" : null);

          if (!therapistId) {
            console.warn("Calendar reconciliation skipped: no therapist ID configured");
            return;
          }

          const start = new Date();
          start.setMonth(start.getMonth() - 1);
          const end = new Date();
          end.setMonth(end.getMonth() + 2);
          await reconcileCalendar(therapistId, start, end);
        } catch (error) {
          console.warn("Scheduled calendar reconciliation failed:", error);
        }
      };
      setTimeout(runReconcile, 60 * 1000);
      setInterval(runReconcile, 7 * 24 * 60 * 60 * 1000);
    }
  }).on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${port} is already in use. Please stop other processes or restart the Repl.`);
      process.exit(1);
    } else {
      throw err;
    }
  });
})();
