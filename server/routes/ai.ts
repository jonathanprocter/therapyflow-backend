import express from "express";
import { processDocumentWithAI } from "../services/ai";
import { listAIResultsForClient } from "../storage-extensions";

export const aiRouter = express.Router();

aiRouter.post("/process-document", async (req, res) => {
  try {
    const { documentId, promptId = "care_notes_v1" } = req.body;
    if (!documentId) {
      return res.status(400).json({ error: "documentId required" });
    }

    const result = await processDocumentWithAI(documentId);
    
    res.json({
      documentId,
      aiVersion: "v1",
      entities: result.saved.entities,
      extractions: result.saved.extractions,
      summary: result.saved.summary,
      recommendations: result.saved.recommendations,
      confidence: (result.saved.confidence || 0) / 100,
      semanticEdges: result.edgesCount
    });
  } catch (e: any) {
    console.error("AI processing error:", e);
    res.status(500).json({ error: String(e) });
  }
});

aiRouter.get("/results/:clientId", async (req, res) => {
  try {
    const { clientId } = req.params;
    const { from, to } = req.query;
    
    const results = await listAIResultsForClient(
      clientId, 
      from as string, 
      to as string
    );
    
    res.json({ results });
  } catch (e: any) {
    console.error("Results fetch error:", e);
    res.status(500).json({ error: String(e) });
  }
});