import express from "express";
import multer from "multer";
import path from "path";
import { promises as fs } from "fs";
import { storage } from "../storage";
import { parsePDF } from "../services/pdf";
import { processDocumentWithAI } from "../services/ai";
import { enhancedDocumentProcessor } from "../services/enhanced-document-processor";
import { enqueueJob, registerJobHandler } from "../services/jobQueue";


const upload = multer({ 
  storage: multer.memoryStorage()
});

export const documentsRouter = express.Router();

registerJobHandler("smart-process", async (job) => {
  const documentIds = job.payload?.documentIds || [];
  const results: any[] = [];
  for (const id of documentIds) {
    const doc = await storage.getDocument(id);
    if (!doc) {
      results.push({ documentId: id, error: "not found" });
      continue;
    }

    let buffer: Buffer | null = null;
    if (doc.filePath) {
      const resolvedPath = path.resolve(process.cwd(), doc.filePath.replace(/^\//, ""));
      try {
        // Check if file exists before attempting to read
        await fs.access(resolvedPath);
        buffer = await fs.readFile(resolvedPath);
      } catch (fileError) {
        console.error(`[Documents] Failed to read file at ${resolvedPath}:`, fileError instanceof Error ? fileError.message : 'Unknown error');
        results.push({ documentId: id, error: "file not found or inaccessible" });
        continue;
      }
    } else if ((doc.metadata as any)?.buffer) {
      try {
        buffer = Buffer.from((doc.metadata as any).buffer as number[]);
      } catch (bufferError) {
        console.error(`[Documents] Failed to create buffer from metadata:`, bufferError instanceof Error ? bufferError.message : 'Unknown error');
        results.push({ documentId: id, error: "invalid buffer data in metadata" });
        continue;
      }
    }

    if (!buffer) {
      results.push({ documentId: id, error: "missing file data" });
      continue;
    }

    const processingResult = await enhancedDocumentProcessor.processDocument(
      buffer,
      doc.fileName || "document",
      doc.therapistId,
      id
    );

    const clientName = processingResult.extractedData?.clientName || "Unknown Client";
    const suggestedClientId = `client-${clientName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}`;

    const dateValue = processingResult.extractedData?.sessionDate
      ? new Date(processingResult.extractedData.sessionDate).toISOString().split("T")[0]
      : "";

    results.push({
      documentId: id,
      status: processingResult.success ? "processed" : "failed",
      qualityScore: processingResult.validationDetails?.overallQuality || 0,
      smartParsing: {
        suggestedClientId,
        suggestedAppointmentDate: dateValue,
        clientNameConfidence: Math.round(processingResult.validationDetails?.clientMatchScore || processingResult.confidence || 0),
        dateConfidence: Math.round(processingResult.validationDetails?.dateValidationScore || processingResult.confidence || 0),
        sessionType: processingResult.extractedData?.sessionType || "individual"
      }
    });
  }

  return { results };
});

// Test route without multer
documentsRouter.post("/test", (req, res) => {
  res.json({ message: "Test route working", body: req.body });
});

// Simple upload test without multer first
documentsRouter.post("/simple-upload", (req, res) => {
  console.log("Simple upload - Content Type:", req.get('Content-Type'));
  console.log("Simple upload - Body:", req.body);
  res.json({ message: "Simple upload reached", contentType: req.get('Content-Type') });
});

// Smart upload endpoint - separate from the legacy upload
documentsRouter.post("/smart-upload", (req, res) => {
  const uploadHandler = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }
  });

  // Use any() to accept any field names
  uploadHandler.any()(req, res, async (err) => {
    if (err) {
      console.error("Multer error details:", err);
      return res.status(500).json({ error: `Upload failed: ${err.message}` });
    }

    try {
      console.log("Upload request received:");
      console.log("Body:", req.body);
      console.log("Files:", req.files);

      const { clientId, appointmentDate } = req.body;
      if (!clientId || !appointmentDate) {
        return res.status(400).json({ error: "clientId and appointmentDate required" });
      }

      const therapistId = (req as any).therapistId || 'dr-jonathan-procter';

      // For smart-parsing, use the first available client
      let actualClientId = clientId;
      if (clientId === 'smart-parsing') {
        const clients = await storage.getClients(therapistId);
        if (clients.length > 0) {
          actualClientId = clients[0].id;
        } else {
          return res.status(400).json({ error: "No clients available for smart parsing" });
        }
      }

      // Handle files from any field
      const files = (req.files as Express.Multer.File[]) || [];
      const uploaded = [];

      const uploadDir = path.resolve(process.cwd(), "uploads");
      await fs.mkdir(uploadDir, { recursive: true });

      for (const f of files) {
        const safeName = f.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        const storedName = `${Date.now()}-${Math.random().toString(16).slice(2)}-${safeName}`;
        const storedPath = path.join(uploadDir, storedName);

        await fs.writeFile(storedPath, f.buffer);

        const meta = {
          originalName: f.originalname,
          storedName,
          size: f.size
        };

        const doc = await storage.createDocument({
          clientId: actualClientId, 
          therapistId,
          fileName: f.originalname, 
          fileType: f.mimetype, 
          filePath: `/uploads/${storedName}`,
          fileSize: f.size,
          metadata: meta
        });

        uploaded.push({ 
          documentId: doc.id, 
          filename: f.originalname, 
          status: "stored" 
        });
      }

      res.json({ uploaded });
    } catch (e: any) {
      console.error("Upload error:", e);
      res.status(500).json({ error: String(e) });
    }
  });
});

documentsRouter.post("/parse", async (req, res) => {
  try {
    const { documentId } = req.body;
    if (!documentId) {
      return res.status(400).json({ error: "documentId required" });
    }

    const doc = await storage.getDocument(documentId);
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (doc.extractedText && doc.extractedText.length > 100) {
      return res.json({ 
        documentId, 
        status: "parsed", 
        charCount: doc.extractedText.length, 
        skipped: true 
      });
    }

    const { text, meta, qualityScore } = await parsePDF(documentId);

    res.json({ 
      documentId, 
      status: "parsed", 
      charCount: text.length, 
      qualityScore, 
      meta 
    });
  } catch (e: any) {
    console.error("Parse error:", e);
    res.status(500).json({ error: String(e) });
  }
});

documentsRouter.get("/:id/text-versions", async (req, res) => {
  try {
    const { id } = req.params;
    const versions = await storage.getDocumentTextVersions(id);
    res.json({ versions });
  } catch (error) {
    console.error("Error fetching text versions:", error);
    res.status(500).json({ error: "Failed to fetch text versions" });
  }
});

documentsRouter.post("/process-batch", async (req, res) => {
  try {
    const { clientId, appointmentDate, documentIds, promptId = "care_notes_v1", force = false } = req.body;

    if (!clientId || !appointmentDate || !Array.isArray(documentIds)) {
      return res.status(400).json({ 
        error: "clientId, appointmentDate, documentIds required" 
      });
    }

    const results: any[] = [];

    for (const id of documentIds) {
      try {
        const doc = await storage.getDocument(id);
        if (!doc) { 
          results.push({ documentId: id, error: "not found" }); 
          continue; 
        }

        // Parse if needed
        if (!doc.extractedText || doc.extractedText.length < 100) {
          try {
            await parsePDF(id);
            console.log(`📄 Parsed document ${id}`);
          } catch (parseError) {
            results.push({ 
              documentId: id, 
              error: `Parse failed: ${parseError}` 
            });
            continue;
          }
        }

        // AI process if not already done
        // const existing = await storage.getAIResult(id, promptId);
        const existing = null; // Temporarily disabled
        if (!existing || force) {
          try {
            const aiResult = await processDocumentWithAI(id);
            results.push({ 
              documentId: id, 
              status: "processed", 
              aiResultId: aiResult.saved.id,
              edgesCount: aiResult.edgesCount 
            });
            console.log(`🤖 AI processed document ${id}`);
          } catch (aiError) {
            results.push({ 
              documentId: id, 
              error: `AI processing failed: ${aiError}` 
            });
          }
        } else {
          results.push({ 
            documentId: id, 
            status: "already_processed", 
            aiResultId: (existing as any)?.id || 'unknown'
          });
        }
      } catch (e: any) {
        results.push({ 
          documentId: id, 
          error: String(e) 
        });
      }
    }

    res.json({ results });
  } catch (e: any) {
    console.error("Batch processing error:", e);
    res.status(500).json({ error: String(e) });
  }
});

documentsRouter.post("/ai-process", async (req, res) => {
  try {
    const { documentId } = req.body;
    if (!documentId) {
      return res.status(400).json({ error: "documentId required" });
    }

    const result = await processDocumentWithAI(documentId);

    res.json({
      documentId,
      aiVersion: "v1",
      aiResultId: result.saved.id,
      edgesCount: result.edgesCount,
      entities: result.saved.entities,
      extractions: result.saved.extractions,
      summary: result.saved.summary,
      recommendations: result.saved.recommendations,
      confidence: (result.saved.confidence || 0) / 100
    });
  } catch (e: any) {
    console.error("AI processing error:", e);
    res.status(500).json({ error: String(e) });
  }
});

// Smart processing endpoint that handles files without requiring client ID or date
documentsRouter.post("/smart-process", async (req, res) => {
  try {
    const { documentIds } = req.body;

    if (!Array.isArray(documentIds)) {
      return res.status(400).json({ 
        error: "documentIds array required" 
      });
    }

    const results: any[] = [];

    for (const id of documentIds) {
      try {
        const doc = await storage.getDocument(id);
        if (!doc) { 
          results.push({ documentId: id, error: "not found" }); 
          continue; 
        }

        let buffer: Buffer | null = null;

        if (doc.filePath) {
          const resolvedPath = path.resolve(process.cwd(), doc.filePath.replace(/^\//, ""));
          buffer = await fs.readFile(resolvedPath);
        } else if ((doc.metadata as any)?.buffer) {
          buffer = Buffer.from((doc.metadata as any).buffer as number[]);
        }

        if (!buffer) {
          results.push({ documentId: id, error: "missing file data" });
          continue;
        }

        const processingResult = await enhancedDocumentProcessor.processDocument(
          buffer,
          doc.fileName || "document",
          doc.therapistId,
          id
        );

        const clientName = processingResult.extractedData?.clientName || "Unknown Client";
        const suggestedClientId = `client-${clientName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")}`;

        const dateValue = processingResult.extractedData?.sessionDate
          ? new Date(processingResult.extractedData.sessionDate).toISOString().split("T")[0]
          : "";

        const updatedDoc = await storage.getDocument(id);

        results.push({
          documentId: id,
          status: processingResult.success ? "processed" : "failed",
          charCount: updatedDoc?.extractedText?.length || 0,
          qualityScore: processingResult.validationDetails?.overallQuality || 0,
          smartParsing: {
            suggestedClientId,
            suggestedAppointmentDate: dateValue,
            clientNameConfidence: Math.round(processingResult.validationDetails?.clientMatchScore || processingResult.confidence || 0),
            dateConfidence: Math.round(processingResult.validationDetails?.dateValidationScore || processingResult.confidence || 0),
            sessionType: processingResult.extractedData?.sessionType || "individual"
          }
        });
        console.log(`🧠 Smart processed document ${id}`);
      } catch (e: any) {
        results.push({ 
          documentId: id, 
          error: String(e) 
        });
      }
    }

    res.json({ results });
  } catch (e: any) {
    console.error("Smart processing error:", e);
    res.status(500).json({ error: String(e) });
  }
});

documentsRouter.post("/smart-process-async", async (req, res) => {
  const { documentIds } = req.body;

  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    return res.status(400).json({ error: "documentIds array required" });
  }

  const therapistId = (req as any).therapistId || 'dr-jonathan-procter';
  const job = await enqueueJob("smart-process", { documentIds }, undefined, therapistId, 3);

  res.json({ jobId: job.id, status: job.status });
});

documentsRouter.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await storage.deleteDocument(id);
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (doc.filePath) {
      const resolvedPath = path.resolve(process.cwd(), doc.filePath.replace(/^\//, ""));
      try {
        await fs.unlink(resolvedPath);
      } catch (error) {
        console.warn(`Failed to delete file ${resolvedPath}:`, error);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting document:", error);
    res.status(500).json({ error: "Failed to delete document" });
  }
});
