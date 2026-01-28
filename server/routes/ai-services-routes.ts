/**
 * AI Services Routes
 * API endpoints for AI-powered clinical services ported from TherapyGenius
 */

import { Router, Request, Response } from "express";
import { storage } from "../storage";
import { assessmentExtractor, AssessmentInstrument } from "../services/assessment-extractor";
import { sessionTagger } from "../services/session-tagger";
import { clientTagger } from "../services/client-tagger";
import { insightsAggregator } from "../services/insights-aggregator";
import { recommendationEngine } from "../services/recommendation-engine";
import { aiRouter } from "../services/ai-router";

const router = Router();

// Middleware to get therapist ID from authenticated session only
// H3 FIX: Removed x-therapist-id header fallback to prevent identity spoofing
const getTherapistId = (req: Request): string => {
  // SECURITY: Only accept therapistId from authenticated session, never from headers
  return (req as any).user?.id || (req as any).therapistId || "";
};

// ==================== AI Router Health ====================

/**
 * GET /api/ai-services/health
 * Get AI router health status
 */
router.get("/health", async (req: Request, res: Response) => {
  try {
    const healthStatus = aiRouter.getHealthStatus();
    const metrics = aiRouter.getMetrics();
    const isAvailable = aiRouter.isAvailable();

    res.json({
      available: isAvailable,
      providers: healthStatus,
      metrics
    });
  } catch (error) {
    console.error("[AI Services] Health check error:", error);
    res.status(500).json({ error: "Failed to check AI health" });
  }
});

// ==================== Assessment Extraction ====================

/**
 * POST /api/ai-services/assessments/extract
 * Extract assessments from a document
 */
router.post("/assessments/extract", async (req: Request, res: Response) => {
  try {
    const therapistId = getTherapistId(req);
    const { documentId, clientId } = req.body;

    if (!documentId) {
      return res.status(400).json({ error: "documentId is required" });
    }

    const document = await storage.getDocument(documentId);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    const result = await assessmentExtractor.extractAssessmentsFromDocument(
      document,
      therapistId,
      clientId
    );

    res.json(result);
  } catch (error) {
    console.error("[AI Services] Assessment extraction error:", error);
    res.status(500).json({ error: "Failed to extract assessments" });
  }
});

/**
 * POST /api/ai-services/assessments/extract-from-note
 * Extract assessments from a progress note
 */
router.post("/assessments/extract-from-note", async (req: Request, res: Response) => {
  try {
    const therapistId = getTherapistId(req);
    const { noteId } = req.body;

    if (!noteId) {
      return res.status(400).json({ error: "noteId is required" });
    }

    const note = await storage.getProgressNote(noteId);
    if (!note) {
      return res.status(404).json({ error: "Progress note not found" });
    }

    const assessments = await assessmentExtractor.extractFromProgressNote(note, therapistId);

    res.json({
      success: true,
      noteId,
      assessmentsFound: assessments.length,
      assessments
    });
  } catch (error) {
    console.error("[AI Services] Note assessment extraction error:", error);
    res.status(500).json({ error: "Failed to extract assessments from note" });
  }
});

/**
 * POST /api/ai-services/assessments/check-content
 * Check if a document likely contains assessment data
 */
router.post("/assessments/check-content", async (req: Request, res: Response) => {
  try {
    const { documentId } = req.body;

    if (!documentId) {
      return res.status(400).json({ error: "documentId is required" });
    }

    const document = await storage.getDocument(documentId);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    const result = await assessmentExtractor.hasAssessmentContent(document);

    res.json(result);
  } catch (error) {
    console.error("[AI Services] Assessment content check error:", error);
    res.status(500).json({ error: "Failed to check assessment content" });
  }
});

/**
 * GET /api/ai-services/assessments/instruments
 * Get available assessment instruments with info
 */
router.get("/assessments/instruments", async (req: Request, res: Response) => {
  try {
    const instruments = Object.values(AssessmentInstrument).map(instrument => ({
      instrument,
      ...assessmentExtractor.getInstrumentInfo(instrument)
    }));

    res.json(instruments);
  } catch (error) {
    console.error("[AI Services] Get instruments error:", error);
    res.status(500).json({ error: "Failed to get instruments" });
  }
});

// ==================== Session Tagging ====================

/**
 * POST /api/ai-services/tags/session
 * Generate AI tags for a session
 */
router.post("/tags/session", async (req: Request, res: Response) => {
  try {
    const { noteId, clientContext } = req.body;

    if (!noteId) {
      return res.status(400).json({ error: "noteId is required" });
    }

    const note = await storage.getProgressNote(noteId);
    if (!note) {
      return res.status(404).json({ error: "Progress note not found" });
    }

    const result = await sessionTagger.generateSessionTags(note, clientContext);

    res.json(result);
  } catch (error) {
    console.error("[AI Services] Session tagging error:", error);
    res.status(500).json({ error: "Failed to generate session tags" });
  }
});

/**
 * POST /api/ai-services/tags/session/batch
 * Batch tag multiple sessions
 */
router.post("/tags/session/batch", async (req: Request, res: Response) => {
  try {
    const { noteIds, clientContext } = req.body;

    if (!noteIds || !Array.isArray(noteIds)) {
      return res.status(400).json({ error: "noteIds array is required" });
    }

    // Limit batch size to prevent DoS
    const MAX_BATCH_SIZE = 100;
    if (noteIds.length > MAX_BATCH_SIZE) {
      return res.status(400).json({
        error: `Batch size exceeds maximum of ${MAX_BATCH_SIZE}`,
        maxAllowed: MAX_BATCH_SIZE,
        received: noteIds.length
      });
    }

    // PERFORMANCE: Fetch all notes in parallel instead of sequentially
    const notePromises = noteIds.map(noteId => storage.getProgressNote(noteId));
    const fetchedNotes = await Promise.all(notePromises);
    const notes = fetchedNotes.filter((note): note is NonNullable<typeof note> => note !== null);

    const results = await sessionTagger.batchTagSessions(notes, clientContext);

    res.json({
      processed: results.length,
      successful: results.filter(r => r.success).length,
      results
    });
  } catch (error) {
    console.error("[AI Services] Batch session tagging error:", error);
    res.status(500).json({ error: "Failed to batch tag sessions" });
  }
});

/**
 * POST /api/ai-services/tags/session/trends
 * Analyze trends across multiple sessions
 */
router.post("/tags/session/trends", async (req: Request, res: Response) => {
  try {
    const { clientId } = req.body;

    if (!clientId) {
      return res.status(400).json({ error: "clientId is required" });
    }

    const notes = await storage.getProgressNotes(clientId);
    const trends = await sessionTagger.analyzeSessionTrends(notes, clientId);

    res.json(trends);
  } catch (error) {
    console.error("[AI Services] Session trends error:", error);
    res.status(500).json({ error: "Failed to analyze session trends" });
  }
});

// ==================== Client Tagging ====================

/**
 * POST /api/ai-services/tags/client
 * Generate comprehensive AI tags for a client
 */
router.post("/tags/client", async (req: Request, res: Response) => {
  try {
    const therapistId = getTherapistId(req);
    const { clientId } = req.body;

    if (!clientId) {
      return res.status(400).json({ error: "clientId is required" });
    }

    const client = await storage.getClient(clientId);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    const notes = await storage.getProgressNotes(clientId);
    const treatmentPlan = await storage.getTreatmentPlan(clientId);
    const sessions = await storage.getSessions(clientId);

    const result = await clientTagger.generateClientTags(
      client,
      notes,
      treatmentPlan,
      sessions
    );

    res.json(result);
  } catch (error) {
    console.error("[AI Services] Client tagging error:", error);
    res.status(500).json({ error: "Failed to generate client tags" });
  }
});

/**
 * GET /api/ai-services/tags/client/:clientId/progress
 * Get client progress report
 */
router.get("/tags/client/:clientId/progress", async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;

    const client = await storage.getClient(clientId);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    const notes = await storage.getProgressNotes(clientId);
    const treatmentPlan = await storage.getTreatmentPlan(clientId);

    const report = await clientTagger.getClientProgressReport(client, notes, treatmentPlan);

    res.json(report);
  } catch (error) {
    console.error("[AI Services] Client progress report error:", error);
    res.status(500).json({ error: "Failed to generate progress report" });
  }
});

// ==================== Practice Insights ====================

/**
 * GET /api/ai-services/insights/practice
 * Get practice-wide insights
 */
router.get("/insights/practice", async (req: Request, res: Response) => {
  try {
    const therapistId = getTherapistId(req);

    if (!therapistId) {
      return res.status(401).json({ error: "Therapist ID required" });
    }

    const insights = await insightsAggregator.generatePracticeInsights(therapistId);

    res.json(insights);
  } catch (error) {
    console.error("[AI Services] Practice insights error:", error);
    res.status(500).json({ error: "Failed to generate practice insights" });
  }
});

/**
 * GET /api/ai-services/insights/client/:clientId
 * Get insights for a specific client
 */
router.get("/insights/client/:clientId", async (req: Request, res: Response) => {
  try {
    const therapistId = getTherapistId(req);
    const { clientId } = req.params;

    if (!therapistId) {
      return res.status(401).json({ error: "Therapist ID required" });
    }

    const insights = await insightsAggregator.generateClientInsights(clientId, therapistId);

    res.json(insights);
  } catch (error) {
    console.error("[AI Services] Client insights error:", error);
    res.status(500).json({ error: "Failed to generate client insights" });
  }
});

// ==================== Recommendations ====================

/**
 * POST /api/ai-services/recommendations/session
 * Get session preparation recommendations
 */
router.post("/recommendations/session", async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId is required" });
    }

    const session = await storage.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const client = await storage.getClient(session.clientId);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    const notes = await storage.getProgressNotes(session.clientId);
    const treatmentPlan = await storage.getTreatmentPlan(session.clientId);

    const recommendations = await recommendationEngine.generateSessionRecommendations(
      session,
      client,
      notes.slice(0, 10),
      treatmentPlan
    );

    res.json(recommendations);
  } catch (error) {
    console.error("[AI Services] Session recommendations error:", error);
    res.status(500).json({ error: "Failed to generate session recommendations" });
  }
});

/**
 * POST /api/ai-services/recommendations/treatment
 * Get treatment recommendations for a client
 */
router.post("/recommendations/treatment", async (req: Request, res: Response) => {
  try {
    const { clientId } = req.body;

    if (!clientId) {
      return res.status(400).json({ error: "clientId is required" });
    }

    const client = await storage.getClient(clientId);
    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    const notes = await storage.getProgressNotes(clientId);
    const treatmentPlan = await storage.getTreatmentPlan(clientId);

    const recommendations = await recommendationEngine.generateTreatmentRecommendations(
      client,
      notes,
      treatmentPlan
    );

    res.json(recommendations);
  } catch (error) {
    console.error("[AI Services] Treatment recommendations error:", error);
    res.status(500).json({ error: "Failed to generate treatment recommendations" });
  }
});

/**
 * POST /api/ai-services/recommendations/interventions
 * Get intervention suggestions based on presenting problems
 */
router.post("/recommendations/interventions", async (req: Request, res: Response) => {
  try {
    const { presentingProblems } = req.body;

    if (!presentingProblems || !Array.isArray(presentingProblems)) {
      return res.status(400).json({ error: "presentingProblems array is required" });
    }

    const suggestions = recommendationEngine.getInterventionSuggestions(presentingProblems);

    res.json({
      presentingProblems,
      suggestedInterventions: suggestions
    });
  } catch (error) {
    console.error("[AI Services] Intervention suggestions error:", error);
    res.status(500).json({ error: "Failed to get intervention suggestions" });
  }
});

// ==================== Direct AI Access ====================

/**
 * POST /api/ai-services/summarize
 * Generate a summary using AI
 */
router.post("/summarize", async (req: Request, res: Response) => {
  try {
    const { text, maxLength, style } = req.body;

    if (!text) {
      return res.status(400).json({ error: "text is required" });
    }

    const summary = await aiRouter.summarize(text, { maxLength, style });

    res.json({ summary });
  } catch (error) {
    console.error("[AI Services] Summarization error:", error);
    res.status(500).json({ error: "Failed to generate summary" });
  }
});

/**
 * POST /api/ai-services/generate-tags
 * Generate tags using AI
 */
router.post("/generate-tags", async (req: Request, res: Response) => {
  try {
    const { content, context, maxTags, category } = req.body;

    if (!content) {
      return res.status(400).json({ error: "content is required" });
    }

    const tags = await aiRouter.generateTags(content, context, { maxTags, category });

    res.json({ tags });
  } catch (error) {
    console.error("[AI Services] Tag generation error:", error);
    res.status(500).json({ error: "Failed to generate tags" });
  }
});

export default router;
