import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { integrateTherapeuticFeatures } from "./integrate-therapeutic";
import { documentsRouter } from "./routes/documents.js";
import { aiRouter } from "./routes/ai.js"; 
import { semanticRouter } from "./routes/semantic.js";
import { storage } from "./storage.js";
const db = storage.db;
import { sql } from "drizzle-orm";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

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
  });
});

// Deep health: DB connectivity + key metrics
app.get("/api/health/deep", async (req, res) => {
  const start = Date.now();
  try {
    // Minimal DB check: run a simple NOW()
    const [{ now }] = await db.execute(sql`SELECT now() as now`);
    
    // Count documents and AI results
    const [{ count: docsCount }] = await db.execute(sql`SELECT COUNT(*)::int as count FROM documents`);
    const [{ count: aiCount }] = await db.execute(sql`SELECT COUNT(*)::int as count FROM ai_document_results`);
    const [{ count: edgesCount }] = await db.execute(sql`SELECT COUNT(*)::int as count FROM semantic_edges`);
    
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
  const server = await registerRoutes(app);

  // Register CareNotesAI pipeline routes
  app.use("/api/documents", documentsRouter);
  app.use("/api/ai", aiRouter);
  app.use("/api/semantic", semanticRouter);
  log("✅ CareNotesAI document processing pipeline routes registered");

  // Integrate therapeutic journey features
  integrateTherapeuticFeatures(app);
  log("✅ Therapeutic journey features integrated");

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
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
  });
})();