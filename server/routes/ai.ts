import express from "express";
import { processDocumentWithAI } from "../services/ai";
import { storage } from "../storage";
import { db } from "../db";
import { aiInsights } from "@shared/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

export const aiRouter = express.Router();

aiRouter.post("/process-document", async (req, res) => {
  try {
    const { documentId } = req.body;
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

    // Validate clientId format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(clientId)) {
      return res.status(400).json({ error: "Invalid client ID format" });
    }

    // Build query conditions
    const conditions = [eq(aiInsights.clientId, clientId)];

    if (from && typeof from === 'string') {
      const fromDate = new Date(from);
      if (!isNaN(fromDate.getTime())) {
        conditions.push(gte(aiInsights.createdAt, fromDate));
      }
    }

    if (to && typeof to === 'string') {
      const toDate = new Date(to);
      if (!isNaN(toDate.getTime())) {
        conditions.push(lte(aiInsights.createdAt, toDate));
      }
    }

    const results = await db
      .select()
      .from(aiInsights)
      .where(and(...conditions))
      .orderBy(desc(aiInsights.createdAt))
      .limit(50);

    res.json({ results });
  } catch (e: any) {
    console.error("Results fetch error:", e);
    res.status(500).json({ error: String(e) });
  }
});