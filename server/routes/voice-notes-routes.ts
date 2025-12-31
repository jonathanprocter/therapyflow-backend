/**
 * Voice Notes API Routes
 * Endpoints for recording, managing, and viewing voice notes
 */

import { Router, type Request, type Response } from 'express';
import { voiceNotesService } from '../services/voice-notes-service.js';
import { getTherapistIdOrDefault } from '../utils/auth-helpers.js';
import { logger } from '../services/loggerService.js';
import { body, query, param, validationResult } from 'express-validator';

const router = Router();

/**
 * POST /api/voice-notes
 * Create a new voice note with automatic transcription
 */
router.post(
  '/',
  [
    body('clientId').isString().notEmpty().withMessage('Client ID is required'),
    body('sessionId').optional().isString(),
    body('noteType')
      .optional()
      .isIn(['follow_up', 'reminder', 'observation', 'general'])
      .withMessage('Invalid note type'),
    body('priority')
      .optional()
      .isIn(['low', 'normal', 'high', 'urgent'])
      .withMessage('Invalid priority'),
    body('tags').optional().isArray(),
    body('metadata').optional().isObject()
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const therapistId = getTherapistIdOrDefault(req);
    const { clientId, sessionId, noteType, priority, tags, metadata } = req.body;

    try {
      // Get audio from request body
      const audioBuffer = req.body.audio 
        ? Buffer.from(req.body.audio, 'base64')
        : Buffer.from(req.body);

      if (!Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or missing audio data'
        });
      }

      const voiceNote = await voiceNotesService.createVoiceNote({
        therapistId,
        clientId,
        sessionId,
        audioBuffer,
        noteType,
        priority,
        tags,
        metadata
      });

      res.json({
        success: true,
        voiceNote
      });
    } catch (error: any) {
      logger.error('Create voice note failed', error, 'VoiceNotesRoutes', {
        therapistId,
        clientId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to create voice note',
        message: error.message
      });
    }
  }
);

/**
 * GET /api/voice-notes/daily-summary
 * Get daily summary of voice notes
 */
router.get(
  '/daily-summary',
  [
    query('date').optional().isISO8601().withMessage('Invalid date format'),
    query('format')
      .optional()
      .isIn(['json', 'markdown', 'text'])
      .withMessage('Invalid format')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const therapistId = getTherapistIdOrDefault(req);
    const { date, format = 'json' } = req.query;

    try {
      const targetDate = date ? new Date(date as string) : new Date();
      const summary = await voiceNotesService.getDailySummary(therapistId, targetDate);

      if (format === 'json') {
        res.json({
          success: true,
          summary
        });
      } else {
        // Export as text or markdown
        const exported = voiceNotesService.exportDailySummary(
          summary,
          format as 'markdown' | 'text'
        );

        res.set({
          'Content-Type': format === 'markdown' ? 'text/markdown' : 'text/plain',
          'Content-Disposition': `attachment; filename="voice-notes-${summary.date}.${format === 'markdown' ? 'md' : 'txt'}"`
        });

        res.send(exported);
      }
    } catch (error: any) {
      logger.error('Get daily summary failed', error, 'VoiceNotesRoutes', {
        therapistId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get daily summary',
        message: error.message
      });
    }
  }
);

/**
 * GET /api/voice-notes/client/:clientId
 * Get voice notes for a specific client
 */
router.get(
  '/client/:clientId',
  [
    param('clientId').isString().notEmpty(),
    query('status')
      .optional()
      .isIn(['pending', 'reviewed', 'completed', 'archived']),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const therapistId = getTherapistIdOrDefault(req);
    const { clientId } = req.params;
    const { status, limit } = req.query;

    try {
      const notes = await voiceNotesService.getClientVoiceNotes(clientId, therapistId, {
        status: status as string,
        limit: limit ? parseInt(limit as string) : undefined
      });

      res.json({
        success: true,
        notes,
        count: notes.length
      });
    } catch (error: any) {
      logger.error('Get client voice notes failed', error, 'VoiceNotesRoutes', {
        therapistId,
        clientId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get client voice notes',
        message: error.message
      });
    }
  }
);

/**
 * PATCH /api/voice-notes/:noteId/status
 * Update voice note status
 */
router.patch(
  '/:noteId/status',
  [
    param('noteId').isString().notEmpty(),
    body('status')
      .isIn(['pending', 'reviewed', 'completed', 'archived'])
      .withMessage('Invalid status')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const therapistId = getTherapistIdOrDefault(req);
    const { noteId } = req.params;
    const { status } = req.body;

    try {
      const updated = await voiceNotesService.updateVoiceNoteStatus(
        noteId,
        therapistId,
        status
      );

      res.json({
        success: true,
        voiceNote: updated
      });
    } catch (error: any) {
      logger.error('Update voice note status failed', error, 'VoiceNotesRoutes', {
        therapistId,
        noteId,
        status
      });

      res.status(500).json({
        success: false,
        error: 'Failed to update voice note status',
        message: error.message
      });
    }
  }
);

/**
 * DELETE /api/voice-notes/:noteId
 * Delete a voice note
 */
router.delete(
  '/:noteId',
  [param('noteId').isString().notEmpty()],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const therapistId = getTherapistIdOrDefault(req);
    const { noteId } = req.params;

    try {
      await voiceNotesService.deleteVoiceNote(noteId, therapistId);

      res.json({
        success: true,
        message: 'Voice note deleted'
      });
    } catch (error: any) {
      logger.error('Delete voice note failed', error, 'VoiceNotesRoutes', {
        therapistId,
        noteId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to delete voice note',
        message: error.message
      });
    }
  }
);

/**
 * POST /api/voice-notes/bulk-status
 * Update status of multiple voice notes
 */
router.post(
  '/bulk-status',
  [
    body('noteIds').isArray().notEmpty().withMessage('Note IDs array is required'),
    body('status')
      .isIn(['pending', 'reviewed', 'completed', 'archived'])
      .withMessage('Invalid status')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const therapistId = getTherapistIdOrDefault(req);
    const { noteIds, status } = req.body;

    try {
      const updates = await Promise.all(
        noteIds.map((noteId: string) =>
          voiceNotesService.updateVoiceNoteStatus(noteId, therapistId, status)
        )
      );

      res.json({
        success: true,
        updated: updates.length,
        voiceNotes: updates
      });
    } catch (error: any) {
      logger.error('Bulk status update failed', error, 'VoiceNotesRoutes', {
        therapistId,
        count: noteIds.length
      });

      res.status(500).json({
        success: false,
        error: 'Failed to update voice notes',
        message: error.message
      });
    }
  }
);

/**
 * GET /api/voice-notes/export/daily
 * Export daily summary in various formats
 */
router.get(
  '/export/daily',
  [
    query('date').optional().isISO8601(),
    query('format')
      .optional()
      .isIn(['markdown', 'text', 'json'])
      .withMessage('Invalid format')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const therapistId = getTherapistIdOrDefault(req);
    const { date, format = 'markdown' } = req.query;

    try {
      const targetDate = date ? new Date(date as string) : new Date();
      const summary = await voiceNotesService.getDailySummary(therapistId, targetDate);

      const exported = voiceNotesService.exportDailySummary(
        summary,
        format as 'markdown' | 'text' | 'json'
      );

      const extension = format === 'json' ? 'json' : format === 'markdown' ? 'md' : 'txt';
      const contentType = format === 'json' 
        ? 'application/json' 
        : format === 'markdown' 
        ? 'text/markdown' 
        : 'text/plain';

      res.set({
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="voice-notes-${summary.date}.${extension}"`
      });

      res.send(exported);
    } catch (error: any) {
      logger.error('Export daily summary failed', error, 'VoiceNotesRoutes', {
        therapistId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to export daily summary',
        message: error.message
      });
    }
  }
);

export function registerVoiceNotesRoutes(app: any): void {
  app.use('/api/voice-notes', router);
  logger.info('Voice notes routes registered', 'VoiceNotesRoutes');
}
