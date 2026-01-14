import { Response } from 'express';

/**
 * Standardized API response utilities
 * Ensures consistent response format across all endpoints
 */

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  timestamp: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Send a successful API response
 */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({
    success: true,
    data,
    timestamp: new Date().toISOString()
  } as ApiSuccessResponse<T>);
}

/**
 * Send an error API response
 */
export function sendError(
  res: Response,
  message: string,
  statusCode = 500,
  code?: string
): void {
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(code && { code }),
    timestamp: new Date().toISOString()
  } as ApiErrorResponse);
}

/**
 * Common error codes for consistent error handling
 */
export const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  AI_SERVICE_ERROR: 'AI_SERVICE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  FILE_ERROR: 'FILE_ERROR'
} as const;

/**
 * Helper for common error responses
 */
export const ApiErrors = {
  notFound: (res: Response, resource = 'Resource') =>
    sendError(res, `${resource} not found`, 404, ErrorCodes.NOT_FOUND),

  badRequest: (res: Response, message: string) =>
    sendError(res, message, 400, ErrorCodes.BAD_REQUEST),

  validationError: (res: Response, message: string) =>
    sendError(res, message, 400, ErrorCodes.VALIDATION_ERROR),

  unauthorized: (res: Response, message = 'Authentication required') =>
    sendError(res, message, 401, ErrorCodes.UNAUTHORIZED),

  forbidden: (res: Response, message = 'Access denied') =>
    sendError(res, message, 403, ErrorCodes.FORBIDDEN),

  conflict: (res: Response, message: string) =>
    sendError(res, message, 409, ErrorCodes.CONFLICT),

  rateLimited: (res: Response, message = 'Too many requests') =>
    sendError(res, message, 429, ErrorCodes.RATE_LIMITED),

  internalError: (res: Response, message = 'Internal server error') =>
    sendError(res, message, 500, ErrorCodes.INTERNAL_ERROR),

  aiServiceError: (res: Response, message = 'AI service unavailable') =>
    sendError(res, message, 503, ErrorCodes.AI_SERVICE_ERROR),

  databaseError: (res: Response, message = 'Database error') =>
    sendError(res, message, 500, ErrorCodes.DATABASE_ERROR)
};
