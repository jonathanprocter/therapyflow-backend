import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./vite";
import { integrateTherapeuticFeatures } from "./integrate-therapeutic";
import { documentsRouter } from "./routes/documents.js";
import { aiRouter } from "./routes/ai.js";
import { semanticRouter } from "./routes/semantic.js";
import { knowledgeGraphRoutes } from "./routes/knowledge-graph-routes-fixed.js";
import { storage } from "./storage.js";
import { db } from "./db.js";
import { sql, eq } from "drizzle-orm";

// Import middleware
import { standardRateLimit, aiProcessingRateLimit } from './middleware/rateLimit';

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

// Apply standard rate limiting to all API endpoints
app.use('/api', standardRateLimit);

// Single-therapist mode: automatically set therapistId for all requests
// Using 'therapist-1' to match existing client data in the database
app.use((req: any, res, next) => {
  req.therapistId = 'therapist-1';
  req.user = { id: 'therapist-1', role: 'therapist' };
  next();
});

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

// Health endpoints for CareNotesAI pipeline monitoring
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

// AI Health endpoint
app.get('/api/ai/health', (req, res) => {
  res.json({
    openai: !!process.env.OPENAI_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Deep health: DB connectivity + key metrics
app.get("/api/health/deep", async (req, res) => {
  const start = Date.now();
  try {
    // Minimal DB check: run a simple NOW()
    const nowResult = await db.execute(sql`SELECT now() as now`);
    const now = nowResult.rows[0]?.now;

    // Count documents and AI results
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
      metrics: {
        documents: docsCount,
        aiResults: aiCount,
        edges: edgesCount,
      },
      took_ms: Date.now() - start,
    });
  } catch (e: any) {
    res.status(500).json({
      ok: false,
      error: String(e),
      took_ms: Date.now() - start,
    });
  }
});

// Readiness check for Render/K8s health probes
app.get("/api/health/ready", async (req, res) => {
  try {
    // Quick DB connectivity check
    await db.execute(sql`SELECT 1`);
    res.json({ status: "ready", timestamp: new Date().toISOString() });
  } catch (e: any) {
    res.status(503).json({ status: "not ready", error: String(e) });
  }
});

// Routes info endpoint for debugging
app.get("/api/health/routes", (req, res) => {
  res.json({
    status: "ok",
    message: "Routes endpoint - use for debugging route registration",
    timestamp: new Date().toISOString()
  });
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
    const shouldReconcile = process.env.ENABLE_CALENDAR_RECONCILIATION !== "false";
    if (shouldReconcile) {
      const runReconcile = async () => {
        try {
          const therapistId = "therapist-1";
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
