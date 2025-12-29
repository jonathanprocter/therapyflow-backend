import express from "express";
import { getGraph, recall } from "../services/semantic";

export const semanticRouter = express.Router();

semanticRouter.get("/graph", async (req, res) => {
  try {
    const { clientId, from, to } = req.query;
    
    if (!clientId) {
      return res.status(400).json({ error: "clientId required" });
    }

    const edges = await getGraph(
      clientId as string, 
      { from: from as string, to: to as string }
    );
    
    res.json({ edges });
  } catch (e: any) {
    console.error("Graph fetch error:", e);
    res.status(500).json({ error: String(e) });
  }
});

semanticRouter.get("/recall", async (req, res) => {
  try {
    const { q, clientId } = req.query;
    
    if (!q || !clientId) {
      return res.status(400).json({ error: "q and clientId required" });
    }

    const edges = await recall(clientId as string, q as string);
    
    res.json({ edges, query: q });
  } catch (e: any) {
    console.error("Recall error:", e);
    res.status(500).json({ error: String(e) });
  }
});