import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { type Server } from "http";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  // In production, this function should never be called
  // But if it is, we'll skip vite setup entirely
  if (process.env.NODE_ENV === 'production') {
    log("Skipping Vite setup in production mode");
    return;
  }

  // Only attempt to load vite in development
  try {
    // Use Function constructor to prevent esbuild from bundling this import
    const dynamicImport = new Function('specifier', 'return import(specifier)');
    const vite = await dynamicImport('vite');
    const { createServer: createViteServer, createLogger } = vite;
    const viteConfigModule = await dynamicImport('../vite.config');
    const viteConfig = viteConfigModule.default;
    const { nanoid } = await dynamicImport('nanoid');

    const viteLogger = createLogger();

    const serverOptions = {
      middlewareMode: true,
      hmr: { server },
      allowedHosts: true as const,
    };

    const viteServer = await createViteServer({
      ...viteConfig,
      configFile: false,
      customLogger: {
        ...viteLogger,
        error: (msg: string, options: any) => {
          viteLogger.error(msg, options);
          process.exit(1);
        },
      },
      server: serverOptions,
      appType: "custom",
    });

    app.use(viteServer.middlewares);
    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;

      try {
        const clientTemplate = path.resolve(
          import.meta.dirname,
          "..",
          "client",
          "index.html",
        );

        let template = await fs.promises.readFile(clientTemplate, "utf-8");
        template = template.replace(
          `src="/src/main.tsx"`,
          `src="/src/main.tsx?v=${nanoid()}"`,
        );
        const page = await viteServer.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(page);
      } catch (e) {
        viteServer.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } catch (e) {
    log(`Failed to setup Vite (this is expected in production): ${e}`);
  }
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    // In production API-only mode, we don't need static files
    log("No static build directory found - running in API-only mode");
    return;
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
