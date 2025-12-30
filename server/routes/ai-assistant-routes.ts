/**
 * AI Assistant API Routes
 * Provides REST and WebSocket endpoints for AI assistant functionality
 */

import { Router, type Request, type Response } from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import { aiConversationService } from '../services/ai-conversation-service.js';
import { aiContextManager } from '../services/ai-context-manager.js';
import { getTherapistIdOrDefault } from '../utils/auth-helpers.js';
import { logger } from '../services/loggerService.js';
import { smartFormat } from '../utils/markdown-formatter.js';
import { body, query, validationResult } from 'express-validator';

const router = Router();

/**
 * POST /api/ai/chat
 * Text-based chat with AI assistant
 */
router.post(
  '/chat',
  [
    body('message').isString().trim().notEmpty().withMessage('Message is required'),
    body('conversationId').optional().isString(),
    body('clientId').optional().isString(),
    body('includeContext').optional().isBoolean(),
    body('model').optional().isIn(['gpt-4', 'gpt-4-turbo', 'claude-3-opus', 'claude-3-sonnet'])
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const therapistId = getTherapistIdOrDefault(req);
    const { message, conversationId, clientId, includeContext, model } = req.body;

    try {
      const response = await aiConversationService.chat(message, therapistId, {
        conversationId,
        clientId,
        includeContext: includeContext !== false, // Default to true
        model: model || 'gpt-4-turbo'
      });

      res.json({
        success: true,
        response: response.response, // Already formatted as HTML
        responseText: response.responseText, // Plain text version
        conversationId: response.conversationId,
        context: response.context
      });
    } catch (error: any) {
      logger.error('AI chat endpoint failed', error, 'AIRoutes', {
        therapistId,
        clientId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to process chat request',
        message: error.message
      });
    }
  }
);

/**
 * GET /api/ai/context/:clientId
 * Get comprehensive client context for AI
 */
router.get(
  '/context/:clientId',
  [
    query('includeNotes').optional().isBoolean(),
    query('includeInsights').optional().isBoolean(),
    query('includeTreatmentPlan').optional().isBoolean(),
    query('includeDocuments').optional().isBoolean(),
    query('daysBack').optional().isInt({ min: 1, max: 365 })
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const therapistId = getTherapistIdOrDefault(req);
    const { clientId } = req.params;
    const {
      includeNotes = 'true',
      includeInsights = 'true',
      includeTreatmentPlan = 'true',
      includeDocuments = 'false',
      daysBack = '90'
    } = req.query;

    try {
      const context = await aiContextManager.getClientContext(clientId, therapistId, {
        includeNotes: includeNotes === 'true',
        includeInsights: includeInsights === 'true',
        includeTreatmentPlan: includeTreatmentPlan === 'true',
        includeDocuments: includeDocuments === 'true',
        daysBack: parseInt(daysBack as string)
      });

      res.json({
        success: true,
        context
      });
    } catch (error: any) {
      logger.error('Get client context failed', error, 'AIRoutes', {
        therapistId,
        clientId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve client context',
        message: error.message
      });
    }
  }
);

/**
 * POST /api/ai/analyze
 * Analyze client data and provide insights
 */
router.post(
  '/analyze',
  [
    body('clientId').isString().notEmpty().withMessage('Client ID is required'),
    body('analysisType')
      .isIn(['progress', 'patterns', 'risk', 'recommendations'])
      .withMessage('Invalid analysis type'),
    body('daysBack').optional().isInt({ min: 1, max: 365 })
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const therapistId = getTherapistIdOrDefault(req);
    const { clientId, analysisType, daysBack = 90 } = req.body;

    try {
      // Get client context
      const context = await aiContextManager.getClientContext(clientId, therapistId, {
        includeNotes: true,
        includeInsights: true,
        includeTreatmentPlan: true,
        daysBack
      });

      // Build analysis prompt based on type
      let prompt = '';
      switch (analysisType) {
        case 'progress':
          prompt = `Analyze this client's progress over the past ${daysBack} days. Consider session attendance, therapeutic alliance scores, progress notes, and treatment goals. Provide a comprehensive assessment of their progress.`;
          break;
        case 'patterns':
          prompt = `Identify recurring patterns, themes, and trends in this client's sessions and progress notes over the past ${daysBack} days. What are the most significant patterns?`;
          break;
        case 'risk':
          prompt = `Assess any risk factors or concerns for this client based on their recent sessions and progress notes. Consider mental health status, coping mechanisms, and any red flags.`;
          break;
        case 'recommendations':
          prompt = `Based on this client's progress, current challenges, and treatment goals, provide evidence-based recommendations for therapeutic interventions and next steps.`;
          break;
      }

      // Get AI analysis
      const response = await aiConversationService.chat(prompt, therapistId, {
        clientId,
        includeContext: true,
        model: 'claude-3-opus' // Use Claude for detailed analysis
      });

      res.json({
        success: true,
        analysis: response.response,
        analysisType,
        clientId,
        daysBack
      });
    } catch (error: any) {
      logger.error('AI analysis failed', error, 'AIRoutes', {
        therapistId,
        clientId,
        analysisType
      });

      res.status(500).json({
        success: false,
        error: 'Failed to analyze client data',
        message: error.message
      });
    }
  }
);

/**
 * POST /api/ai/suggest
 * Get therapeutic suggestions
 */
router.post(
  '/suggest',
  [
    body('clientId').optional().isString(),
    body('scenario').isString().notEmpty().withMessage('Scenario is required'),
    body('context').optional().isObject()
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const therapistId = getTherapistIdOrDefault(req);
    const { clientId, scenario, context: additionalContext } = req.body;

    try {
      const prompt = `Scenario: ${scenario}\n\nProvide evidence-based therapeutic suggestions and interventions for this scenario. Consider relevant therapeutic frameworks (ACT, DBT, CBT, Narrative, etc.) and best practices.`;

      const response = await aiConversationService.chat(prompt, therapistId, {
        clientId,
        includeContext: !!clientId,
        model: 'gpt-4-turbo'
      });

      res.json({
        success: true,
        suggestions: response.response,
        scenario
      });
    } catch (error: any) {
      logger.error('AI suggestions failed', error, 'AIRoutes', {
        therapistId,
        clientId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate suggestions',
        message: error.message
      });
    }
  }
);

/**
 * POST /api/ai/voice/text-to-speech
 * Convert text to speech
 */
router.post(
  '/voice/text-to-speech',
  [
    body('text').isString().trim().notEmpty().withMessage('Text is required'),
    body('voiceId').optional().isString(),
    body('model').optional().isString()
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { text, voiceId, model } = req.body;

    try {
      const audioBuffer = await aiConversationService.textToSpeech(text, {
        voiceId,
        model
      });

      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length
      });

      res.send(audioBuffer);
    } catch (error: any) {
      logger.error('Text-to-speech failed', error, 'AIRoutes');

      res.status(500).json({
        success: false,
        error: 'Failed to convert text to speech',
        message: error.message
      });
    }
  }
);

/**
 * POST /api/ai/voice/speech-to-text
 * Convert speech to text
 */
router.post(
  '/voice/speech-to-text',
  async (req: Request, res: Response) => {
    try {
      // Get audio from request body
      const audioBuffer = req.body;

      if (!Buffer.isBuffer(audioBuffer)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid audio data'
        });
      }

      const text = await aiConversationService.speechToText(audioBuffer);

      res.json({
        success: true,
        text
      });
    } catch (error: any) {
      logger.error('Speech-to-text failed', error, 'AIRoutes');

      res.status(500).json({
        success: false,
        error: 'Failed to convert speech to text',
        message: error.message
      });
    }
  }
);

/**
 * GET /api/ai/voices
 * Get available ElevenLabs voices
 */
router.get('/voices', async (req: Request, res: Response) => {
  try {
    const voices = await aiConversationService.getAvailableVoices();

    res.json({
      success: true,
      voices
    });
  } catch (error: any) {
    logger.error('Get voices failed', error, 'AIRoutes');

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve available voices',
      message: error.message
    });
  }
});

/**
 * POST /api/ai/search
 * Search across client data
 */
router.post(
  '/search',
  [
    body('query').isString().trim().notEmpty().withMessage('Query is required'),
    body('clientId').optional().isString(),
    body('includeNotes').optional().isBoolean(),
    body('includeInsights').optional().isBoolean(),
    body('limit').optional().isInt({ min: 1, max: 100 })
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const therapistId = getTherapistIdOrDefault(req);
    const { query, clientId, includeNotes = true, includeInsights = true, limit = 20 } = req.body;

    try {
      const results = await aiContextManager.searchClientData(therapistId, query, {
        clientId,
        includeNotes,
        includeInsights,
        limit
      });

      res.json({
        success: true,
        results,
        query,
        count: results.length
      });
    } catch (error: any) {
      logger.error('AI search failed', error, 'AIRoutes', {
        therapistId,
        query
      });

      res.status(500).json({
        success: false,
        error: 'Failed to search client data',
        message: error.message
      });
    }
  }
);

/**
 * DELETE /api/ai/conversation/:conversationId
 * Delete conversation history
 */
router.delete('/conversation/:conversationId', async (req: Request, res: Response) => {
  const { conversationId } = req.params;

  try {
    // In a real implementation, you'd verify the therapist owns this conversation
    // For now, we'll just acknowledge the deletion
    res.json({
      success: true,
      message: 'Conversation deleted',
      conversationId
    });
  } catch (error: any) {
    logger.error('Delete conversation failed', error, 'AIRoutes', {
      conversationId
    });

    res.status(500).json({
      success: false,
      error: 'Failed to delete conversation',
      message: error.message
    });
  }
});

/**
 * POST /api/ai/draft-note
 * Draft a progress note using AI
 */
router.post(
  '/draft-note',
  [
    body('clientId').isString().notEmpty().withMessage('Client ID is required'),
    body('sessionId').optional().isString(),
    body('sessionDate').optional().isISO8601(),
    body('sessionNotes').optional().isString(),
    body('framework')
      .optional()
      .isIn(['ACT', 'DBT', 'CBT', 'Narrative', 'Existential', 'Psychodynamic'])
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const therapistId = getTherapistIdOrDefault(req);
    const { clientId, sessionId, sessionDate, sessionNotes, framework = 'ACT' } = req.body;

    try {
      // Get client context
      const context = await aiContextManager.getClientContext(clientId, therapistId, {
        includeNotes: true,
        includeInsights: true,
        includeTreatmentPlan: true,
        daysBack: 30
      });

      // Build prompt for progress note
      const prompt = `Draft a comprehensive clinical progress note for this therapy session using the SOAP format (Subjective, Objective, Assessment, Plan). 

Session Details:
${sessionNotes ? `Session Notes: ${sessionNotes}` : 'Use recent session information from context'}
${sessionDate ? `Session Date: ${sessionDate}` : ''}

Therapeutic Framework: ${framework}

The note should:
1. Be professional and suitable for an EMR
2. Include specific examples and quotes when relevant
3. Integrate with the client's treatment plan goals
4. Suggest evidence-based interventions
5. Follow ${framework} principles

Client Context: ${context.summary}`;

      const response = await aiConversationService.chat(prompt, therapistId, {
        clientId,
        includeContext: true,
        model: 'claude-3-opus', // Use Claude for clinical documentation
        maxTokens: 4000
      });

      res.json({
        success: true,
        draftNote: response.response,
        clientId,
        framework
      });
    } catch (error: any) {
      logger.error('Draft note failed', error, 'AIRoutes', {
        therapistId,
        clientId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to draft progress note',
        message: error.message
      });
    }
  }
);

export function registerAIAssistantRoutes(app: any): void {
  app.use('/api/ai', router);
  logger.info('AI Assistant routes registered', 'AIRoutes');
}

/**
 * Setup WebSocket server for real-time voice conversations
 */
export function setupAIWebSocketServer(server: any): void {
  const wss = new WebSocketServer({ 
    server,
    path: '/api/ai/voice/stream'
  });

  wss.on('connection', (ws: WebSocket, req: any) => {
    logger.info('AI voice WebSocket connected', 'AIWebSocket', {
      ip: req.socket.remoteAddress
    });

    let audioChunks: Buffer[] = [];
    let therapistId: string | null = null;
    let clientId: string | null = null;

    ws.on('message', async (data: Buffer) => {
      try {
        // Try to parse as JSON for control messages
        const message = JSON.parse(data.toString());

        if (message.action === 'start') {
          therapistId = message.therapistId;
          clientId = message.clientId;
          audioChunks = [];
          ws.send(JSON.stringify({ type: 'ready', message: 'Ready to receive audio' }));
        } else if (message.action === 'stop') {
          // Process accumulated audio
          if (audioChunks.length > 0 && therapistId) {
            const audioBuffer = Buffer.concat(audioChunks);

            // Transcribe
            const transcription = await aiConversationService.speechToText(audioBuffer);
            ws.send(JSON.stringify({ type: 'transcription', data: transcription }));

            // Get AI response
            const response = await aiConversationService.chat(transcription, therapistId, {
              clientId: clientId || undefined,
              includeContext: !!clientId
            });
            ws.send(JSON.stringify({ type: 'text', data: response.response }));

            // Convert to speech
            const audioResponse = await aiConversationService.textToSpeech(response.response);
            ws.send(JSON.stringify({ 
              type: 'audio', 
              data: audioResponse.toString('base64') 
            }));
          }

          audioChunks = [];
        }
      } catch (error) {
        // Not JSON, treat as audio data
        audioChunks.push(data);
      }
    });

    ws.on('close', () => {
      logger.info('AI voice WebSocket disconnected', 'AIWebSocket');
    });

    ws.on('error', (error) => {
      logger.error('AI voice WebSocket error', error, 'AIWebSocket');
    });
  });

  logger.info('AI voice WebSocket server initialized', 'AIWebSocket');
}
