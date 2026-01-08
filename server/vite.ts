import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { type Server } from "http";

// Get directory name in ESM (works in bundled code too)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Production stub - the real implementation is only available in dev
export async function setupVite(_app: Express, _server: Server): Promise<void> {
  // In production, this function should never be called
  // The index.ts checks NODE_ENV before calling this
  console.warn("[vite] setupVite is not available in production build");
}

export function serveStatic(app: Express) {
  // In production, look for public folder relative to the bundled dist/index.js
  const distPath = path.resolve(__dirname, "public");

  if (!fs.existsSync(distPath)) {
    // In API-only mode (no frontend build), just log and skip static serving
    console.log(`[vite] Static directory not found: ${distPath} - running in API-only mode`);

    // Serve a simple message for root requests
    app.get("/", (_req, res) => {
      res.json({
        status: "ok",
        message: "TherapyFlow API Server",
        mode: "api-only"
      });
    });
    return;
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
