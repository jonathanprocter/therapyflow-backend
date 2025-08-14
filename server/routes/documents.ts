import express from "express";
import multer from "multer";
import path from "path";
import { storage } from "../storage";
import { parsePDF } from "../services/pdf";
import { processDocumentWithAI, smartParseDocument } from "../services/ai";


const upload = multer({ 
  storage: multer.memoryStorage()
});

export const documentsRouter = express.Router();

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

      // Handle files from any field
      const files = (req.files as Express.Multer.File[]) || [];
      const uploaded = [];

      for (const f of files) {
        // For memory storage, the buffer contains the file data
        const meta = { 
          buffer: Array.from(f.buffer), // Convert buffer to array for JSON storage
          originalName: f.originalname, 
          size: f.size 
        };

        const doc = await createDocument({
          clientId, 
          appointmentDate, 
          filename: f.originalname, 
          mimeType: f.mimetype, 
          meta
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

    const doc = await getDocument(documentId);
    if (!doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (doc.status === "parsed" && (doc.text?.length || 0) > 100) {
      return res.json({ 
        documentId, 
        status: "parsed", 
        charCount: doc.text!.length, 
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
        const doc = await getDocument(id);
        if (!doc) { 
          results.push({ documentId: id, error: "not found" }); 
          continue; 
        }

        // Parse if needed
        if (doc.status !== "parsed" || (doc.text?.length || 0) < 100) {
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
        const existing = await getAIResult(id, promptId);
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
            aiResultId: existing.id 
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
        const doc = await getDocument(id);
        if (!doc) { 
          results.push({ documentId: id, error: "not found" }); 
          continue; 
        }

        // Parse if needed
        if (doc.status !== "parsed" || (doc.text?.length || 0) < 100) {
          try {
            const { text, qualityScore } = await parsePDF(id);
            console.log(`📄 Parsed document ${id}: ${text.length} chars`);
          } catch (parseError) {
            results.push({ 
              documentId: id, 
              error: `Parse failed: ${parseError}` 
            });
            continue;
          }
        }

        // Smart parse with AI
        try {
          const smartResult = await smartParseDocument(id);
          const parsed = await getDocument(id); // Get updated document after parsing

          results.push({ 
            documentId: id, 
            status: "processed", 
            charCount: parsed?.text?.length || 0,
            qualityScore: 100, // Placeholder quality score
            smartParsing: smartResult.smartParsing,
            summary: smartResult.summary,
            confidence: smartResult.confidence
          });
          console.log(`🧠 Smart parsed document ${id}`);
        } catch (aiError) {
          results.push({ 
            documentId: id, 
            error: `Smart parsing failed: ${aiError}` 
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
    console.error("Smart processing error:", e);
    res.status(500).json({ error: String(e) });
  }
});