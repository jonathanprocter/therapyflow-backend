/**
 * Request Validation Middleware
 * Provides reusable validation rules for common request patterns
 */

import { body, param, query, validationResult } from 'express-validator';
import type { Request, Response, NextFunction } from 'express';

/**
 * Middleware to check validation results and return errors
 */
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.type === 'field' ? (err as any).path : 'unknown',
        message: err.msg,
        value: err.type === 'field' ? (err as any).value : undefined
      })),
      timestamp: new Date().toISOString()
    });
  }
  
  next();
};

/**
 * Common validation rules
 */
export const ValidationRules = {
  // UUID validation
  uuid: (field: string = 'id') => 
    param(field).isUUID().withMessage(`${field} must be a valid UUID`),

  // Client validation
  clientName: () =>
    body('name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Client name must be between 2 and 100 characters')
      .matches(/^[a-zA-Z\s\-'.]+$/)
      .withMessage('Client name can only contain letters, spaces, hyphens, apostrophes, and periods'),

  clientEmail: () =>
    body('email')
      .optional()
      .isEmail()
      .withMessage('Must be a valid email address')
      .normalizeEmail(),

  clientPhone: () =>
    body('phone')
      .optional()
      .matches(/^[\d\s\-()+ ext.]+$/)
      .withMessage('Must be a valid phone number'),

  // Session validation
  sessionDate: () =>
    body('scheduledAt')
      .isISO8601()
      .withMessage('Scheduled date must be a valid ISO 8601 date')
      .toDate(),

  sessionDuration: () =>
    body('duration')
      .optional()
      .isInt({ min: 15, max: 480 })
      .withMessage('Duration must be between 15 and 480 minutes'),

  sessionType: () =>
    body('sessionType')
      .optional()
      .isIn(['initial', 'followup', 'crisis', 'termination', 'other'])
      .withMessage('Invalid session type'),

  // Progress note validation
  noteContent: () =>
    body('content')
      .trim()
      .isLength({ min: 10 })
      .withMessage('Note content must be at least 10 characters'),

  noteSessionDate: () =>
    body('sessionDate')
      .isISO8601()
      .withMessage('Session date must be a valid ISO 8601 date')
      .toDate(),

  // Document validation
  documentFile: () =>
    body('fileName')
      .trim()
      .notEmpty()
      .withMessage('File name is required'),

  documentType: () =>
    body('fileType')
      .optional()
      .isIn(['pdf', 'docx', 'txt', 'doc'])
      .withMessage('Invalid file type'),

  // Pagination validation
  paginationPage: () =>
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer')
      .toInt(),

  paginationLimit: () =>
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
      .toInt(),

  // Date range validation
  dateRange: () => [
    query('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date')
      .toDate(),
    query('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date')
      .toDate(),
  ],

  // Search query validation
  searchQuery: () =>
    query('q')
      .trim()
      .isLength({ min: 2, max: 200 })
      .withMessage('Search query must be between 2 and 200 characters'),

  // Therapeutic journey validation
  therapeuticSynthesis: () => [
    body('startDate')
      .optional()
      .isISO8601()
      .withMessage('Start date must be a valid ISO 8601 date')
      .toDate(),
    body('endDate')
      .optional()
      .isISO8601()
      .withMessage('End date must be a valid ISO 8601 date')
      .toDate(),
    body('focusTags')
      .optional()
      .isArray()
      .withMessage('Focus tags must be an array'),
  ],

  therapeuticRecall: () =>
    body('query')
      .trim()
      .isLength({ min: 2, max: 500 })
      .withMessage('Query must be between 2 and 500 characters'),

  // AI service validation
  aiPrompt: () =>
    body('prompt')
      .trim()
      .isLength({ min: 10, max: 5000 })
      .withMessage('Prompt must be between 10 and 5000 characters'),

  // Treatment plan validation
  treatmentGoals: () =>
    body('goals')
      .isArray({ min: 1 })
      .withMessage('At least one goal is required'),

  // Alliance score validation
  allianceScore: () =>
    body('score')
      .isInt({ min: 1, max: 10 })
      .withMessage('Alliance score must be between 1 and 10'),
};

/**
 * Validation rule sets for common operations
 */
export const ValidationSets = {
  // Client operations
  createClient: [
    ValidationRules.clientName(),
    ValidationRules.clientEmail(),
    ValidationRules.clientPhone(),
    handleValidationErrors,
  ],

  updateClient: [
    ValidationRules.uuid('id'),
    body('name').optional(),
    body('email').optional(),
    body('phone').optional(),
    handleValidationErrors,
  ],

  // Session operations
  createSession: [
    body('clientId').isUUID().withMessage('Client ID must be a valid UUID'),
    ValidationRules.sessionDate(),
    ValidationRules.sessionDuration(),
    ValidationRules.sessionType(),
    handleValidationErrors,
  ],

  // Progress note operations
  createProgressNote: [
    body('clientId').isUUID().withMessage('Client ID must be a valid UUID'),
    body('sessionId').optional().isUUID().withMessage('Session ID must be a valid UUID'),
    ValidationRules.noteContent(),
    ValidationRules.noteSessionDate(),
    handleValidationErrors,
  ],

  // Therapeutic operations
  synthesizeJourney: [
    ValidationRules.uuid('clientId'),
    ...ValidationRules.therapeuticSynthesis(),
    handleValidationErrors,
  ],

  quickRecall: [
    ValidationRules.uuid('clientId'),
    ValidationRules.therapeuticRecall(),
    handleValidationErrors,
  ],

  // Search and pagination
  searchWithPagination: [
    ValidationRules.searchQuery(),
    ValidationRules.paginationPage(),
    ValidationRules.paginationLimit(),
    handleValidationErrors,
  ],

  listWithPagination: [
    ValidationRules.paginationPage(),
    ValidationRules.paginationLimit(),
    ...ValidationRules.dateRange(),
    handleValidationErrors,
  ],
};

/**
 * Custom validators
 */
export const CustomValidators = {
  /**
   * Validate that end date is after start date
   */
  isEndDateAfterStartDate: (req: Request) => {
    const { startDate, endDate } = req.body;
    if (startDate && endDate) {
      return new Date(endDate) > new Date(startDate);
    }
    return true;
  },

  /**
   * Validate that session is not in the past (for creation)
   */
  isSessionInFuture: (req: Request) => {
    const { scheduledAt } = req.body;
    if (scheduledAt) {
      return new Date(scheduledAt) > new Date();
    }
    return true;
  },

  /**
   * Sanitize HTML to prevent XSS
   */
  sanitizeHtml: (value: string) => {
    return value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  },
};
