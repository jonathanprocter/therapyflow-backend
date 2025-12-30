import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { integrateTherapeuticFeatures } from "./integrate-therapeutic";
import { documentsRouter } from "./routes/documents.js";
import { aiRouter } from "./routes/ai.js";
import { semanticRouter } from "./routes/semantic.js";
import { knowledgeGraphRoutes } from "./routes/knowledge-graph-routes-fixed.js";
import { storage } from "./storage.js";
import { sql, eq } from "drizzle-orm";
import { registerVoiceRoutes } from "./routes/voice-routes.js";
import { registerFileWatcherRoutes } from "./routes/file-watcher-routes.js";
import { fileWatcherService } from "./services/fileWatcherService.js";
import { registerDriveRoutes } from "./routes/drive-routes.js";
import { googleDriveService } from "./services/googleDriveService.js";
import { ensureTherapeuticTables, checkCriticalTables } from "./utils/migration-checker.js";

// Import middleware
import { standardRateLimit, aiProcessingRateLimit } from './middleware/rateLimit';

// Import services
import { pdfService, getPdfServiceStatus } from './services/pdfService';
import { reconcileCalendar } from './services/calendarReconciliation';

// Global error handlers for unhandled promises and exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  
  // Check if it's a Google Calendar API error and handle gracefully
  if (reason && typeof reason === 'object') {
    const reasonStr = reason.toString();
    if (reasonStr.includes('Google') || reasonStr.includes('calendar') || reasonStr.includes('oauth')) {
      console.log('Google Calendar related error - continuing operation');
      return;
    }
  }
  
  // Don't crash the process for other errors, just log them
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  
  // Check if it's a Google Calendar API error
  if (error.message && (error.message.includes('Google') || error.message.includes('calendar'))) {
    console.log('Google Calendar related exception - continuing operation');
    return;
  }
  
  // For other uncaught exceptions, we should exit gracefully
  process.exit(1);
});

const app = express();

// Security: Limit request body size to prevent DoS attacks
// 10MB for JSON (allows large document content)
// 50MB for URL-encoded (allows file uploads)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Apply standard rate limiting to all API endpoints
app.use('/api', standardRateLimit);

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
    const [{ now }] = await (storage as any).db.execute(sql`SELECT now() as now`);
    
    // Count documents and AI results
    const [{ count: docsCount }] = await (storage as any).db.execute(sql`SELECT COUNT(*)::int as count FROM documents`);
    const [{ count: aiCount }] = await (storage as any).db.execute(sql`SELECT COUNT(*)::int as count FROM ai_document_results`);
    const [{ count: edgesCount }] = await (storage as any).db.execute(sql`SELECT COUNT(*)::int as count FROM semantic_edges`);
    
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

(async () => {
  // Check and ensure database tables exist
  try {
    await checkCriticalTables();
    await ensureTherapeuticTables();
  } catch (error) {
    console.error('⚠️  Database table check failed:', error);
    console.log('⚠️  Server will continue, but some features may not work');
  }

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

  // Register ElevenLabs voice routes
  registerVoiceRoutes(app);
  log("🎙️ ElevenLabs voice API routes registered");

  // Register file watcher routes
  registerFileWatcherRoutes(app);
  log("📂 Document watch folder routes registered");

  // Register Google Drive integration routes
  registerDriveRoutes(app);
  log("☁️ Google Drive integration routes registered");

  // Auto-start file watcher if enabled
  const enableFileWatcher = process.env.ENABLE_FILE_WATCHER !== 'false';
  if (enableFileWatcher) {
    fileWatcherService.startWatching().then(() => {
      log(`📁 File watcher started: ${fileWatcherService.getWatchPath()}`);
    }).catch(err => {
      console.warn('File watcher failed to start:', err.message);
    });
  }

  // Auto-start Google Drive polling if configured
  const enableDrivePolling = process.env.ENABLE_DRIVE_POLLING === 'true';
  if (enableDrivePolling && googleDriveService.isEnabled()) {
    googleDriveService.startPolling();
    log("☁️ Google Drive polling started");
  }

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
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
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
          const therapistId = "dr-jonathan-procter";
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
