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
  // Try multiple paths to find the static files
  const possiblePaths = [
    path.resolve(process.cwd(), "dist", "public"),  // From project root
    path.resolve(__dirname, "public"),               // Relative to bundle
    path.resolve(process.cwd(), "public"),           // Direct public folder
  ];

  console.log(`[vite] Searching for static files...`);
  console.log(`[vite] process.cwd(): ${process.cwd()}`);
  console.log(`[vite] __dirname: ${__dirname}`);

  let distPath: string | null = null;
  for (const p of possiblePaths) {
    console.log(`[vite] Checking: ${p} - exists: ${fs.existsSync(p)}`);
    if (fs.existsSync(p)) {
      distPath = p;
      break;
    }
  }

  // Also list what's in the project root dist folder for debugging
  const rootDist = path.resolve(process.cwd(), "dist");
  if (fs.existsSync(rootDist)) {
    console.log(`[vite] Contents of ${rootDist}:`, fs.readdirSync(rootDist));
  } else {
    console.log(`[vite] Root dist folder does not exist: ${rootDist}`);
  }

  if (!distPath) {
    // In API-only mode (no frontend build), just log and skip static serving
    console.log(`[vite] No static directory found - running in API-only mode`);

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

  console.log(`[vite] ✅ Found static files at: ${distPath}`);
  console.log(`[vite] Contents:`, fs.readdirSync(distPath));

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
