import express from "express";
import multer from "multer";
import path from "path";
import { createDocument, getDocument, getAIResult } from "../storage-extensions";
import { parsePDF } from "../services/pdf";
import { processDocumentWithAI } from "../services/ai";

const upload = multer({ dest: "uploads/" });
export const documentsRouter = express.Router();

documentsRouter.post("/upload", upload.array("files"), async (req, res) => {
  try {
    const { clientId, appointmentDate } = req.body;
    if (!clientId || !appointmentDate) {
      return res.status(400).json({ error: "clientId and appointmentDate required" });
    }

    const files = (req.files as Express.Multer.File[]) || [];
    const uploaded = [];
    
    for (const f of files) {
      const meta = { 
        filePath: path.resolve(f.path), 
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