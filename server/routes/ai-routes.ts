import { Router } from 'express';
import { ClinicalAIService } from '../services/clinicalAI';
import { ClinicalSemanticSearch } from '../services/semanticSearch';
import { ClinicalAIValidator } from '../utils/aiValidator';
import { ClinicalAuditLogger, AuditAction } from '../utils/auditLogger';
// Auth middleware is handled at app level - requests here are already authenticated

const router = Router();

/**
 * Enhanced AI analysis with comprehensive error handling and validation
 */
router.post('/analyze-note', async (req: any, res) => {
  try {
    const { content, clientId, context } = req.body;
    
    if (!content || !clientId) {
      return res.status(400).json({ error: 'Content and clientId are required' });
    }

    console.log('[AI-ANALYSIS] Starting enhanced analysis for client:', clientId);

    // Log AI activity for audit compliance
    await ClinicalAuditLogger.logAIActivity(
      req.therapistId,
      AuditAction.AI_ANALYSIS,
      { clientId },
      req
    );

    // Initialize AI service
    const aiService = new ClinicalAIService();

    // Perform analysis with comprehensive error handling
    const analysisResult = await aiService.analyzeProgressNote(content, context);

    if (!analysisResult.success) {
      console.error('[AI-ANALYSIS] Analysis failed:', analysisResult.error);
      return res.status(500).json({
        error: 'AI analysis failed',
        details: analysisResult.error,
        fallbackUsed: analysisResult.fallbackUsed,
      });
    }

    // Validate AI response for clinical safety
    const validationResult = await ClinicalAIValidator.validateResponse(
      analysisResult.analysis,
      { clientId, therapistId: req.therapistId, originalContent: content }
    );

    if (!validationResult.isValid) {
      console.warn('[AI-ANALYSIS] Validation failed:', validationResult.errors);
      return res.status(422).json({
        error: 'AI response failed safety validation',
        validationErrors: validationResult.errors,
        riskFlags: validationResult.riskFlags,
      });
    }

    // Log processing metadata
    console.log('[AI-ANALYSIS] Completed successfully:', {
      provider: analysisResult.processingMetadata.provider,
      processingTime: analysisResult.processingMetadata.processingTime,
      confidence: analysisResult.analysis?.confidence,
      fallbackUsed: analysisResult.fallbackUsed,
    });

    res.json({
      success: true,
      analysis: validationResult.validatedResponse,
      metadata: analysisResult.processingMetadata,
      validation: {
        warnings: validationResult.warnings,
        riskFlags: validationResult.riskFlags,
      },
    });

  } catch (error) {
    console.error('[AI-ANALYSIS] Route error:', error);
    res.status(500).json({ error: 'Internal server error during AI analysis' });
  }
});

/**
 * Semantic search across clinical notes
 */
router.post('/search', async (req: any, res) => {
  try {
    const { query, clientId, dateRange, tags, riskLevel } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    console.log('[SEMANTIC-SEARCH] Starting search:', { query, clientId });

    // Log search activity for audit compliance
    await ClinicalAuditLogger.logAIActivity(
      req.therapistId,
      AuditAction.AI_SEARCH,
      { clientId },
      req
    );

    // Perform semantic search
    const searchResults = await ClinicalSemanticSearch.search({
      query,
      clientId,
      dateRange,
      tags,
      riskLevel,
      therapistId: req.therapistId,
    });

    console.log('[SEMANTIC-SEARCH] Found results:', searchResults.length);

    res.json({
      success: true,
      results: searchResults,
      metadata: {
        resultCount: searchResults.length,
        searchType: 'semantic_with_keyword_fallback',
        query,
      },
    });

  } catch (error) {
    console.error('[SEMANTIC-SEARCH] Route error:', error);
    res.status(500).json({ error: 'Internal server error during search' });
  }
});

/**
 * Find related notes using semantic similarity
 */
router.get('/related-notes/:noteId', async (req: any, res) => {
  try {
    const { noteId } = req.params;
    const { limit = 5 } = req.query;

    // Validate and clamp limit
    const rawLimit = parseInt(limit as string, 10);
    const safeLimit = Math.max(1, Math.min(isNaN(rawLimit) ? 5 : rawLimit, 50));

    // Find related notes
    const relatedNotes = await ClinicalSemanticSearch.findRelatedNotes(
      noteId,
      req.therapistId,
      safeLimit
    );

    res.json({
      success: true,
      relatedNotes,
      metadata: {
        sourceNoteId: noteId,
        relatedCount: relatedNotes.length,
      },
    });

  } catch (error) {
    console.error('[RELATED-NOTES] Route error:', error);
    res.status(500).json({ error: 'Internal server error finding related notes' });
  }
});

/**
 * Analyze progress patterns for a client
 */
router.get('/progress-patterns/:clientId', async (req: any, res) => {
  try {
    const { clientId } = req.params;

    console.log('[PROGRESS-PATTERNS] Analyzing patterns for client:', clientId);

    // Analyze progress patterns
    const patterns = await ClinicalSemanticSearch.findProgressPatterns(
      clientId,
      req.therapistId
    );

    console.log('[PROGRESS-PATTERNS] Found patterns:', {
      improvementTrends: patterns.improvementTrends.length,
      challengePatterns: patterns.challengePatterns.length,
      milestones: patterns.therapeuticMilestones.length,
    });

    res.json({
      success: true,
      patterns,
      metadata: {
        clientId,
        analysisDate: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('[PROGRESS-PATTERNS] Route error:', error);
    res.status(500).json({ error: 'Internal server error analyzing progress patterns' });
  }
});

/**
 * Generate AI response safety report
 */
router.post('/safety-report', async (req: any, res) => {
  try {
    const { aiResponse, context } = req.body;
    
    if (!aiResponse) {
      return res.status(400).json({ error: 'AI response is required for safety report' });
    }

    // Validate response and generate safety report
    const validationResult = await ClinicalAIValidator.validateResponse(
      aiResponse,
      context
    );

    const safetyReport = ClinicalAIValidator.generateSafetyReport(
      validationResult,
      { clientId: context.clientId, therapistId: req.therapistId }
    );

    res.json({
      success: true,
      safetyReport,
      validation: validationResult,
    });

  } catch (error) {
    console.error('[SAFETY-REPORT] Route error:', error);
    res.status(500).json({ error: 'Internal server error generating safety report' });
  }
});

/**
 * Health check for AI services
 */
router.get('/health', async (req, res) => {
  try {
    const health = {
      openai: !!process.env.OPENAI_API_KEY,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      timestamp: new Date().toISOString(),
      services: {
        analysis: 'available',
        search: 'available',
        validation: 'available',
      },
    };

    res.json(health);
  } catch (error) {
    console.error('[AI-HEALTH] Health check error:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

export { router as aiRoutes };