import type { Response } from 'express';

/**
 * Standard success response format
 */
export function successResponse(res: Response, data: any, statusCode: number = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    timestamp: new Date().toISOString()
  });
}

/**
 * Standard error response format
 */
export function errorResponse(
  res: Response, 
  message: string, 
  statusCode: number = 500,
  details?: any
) {
  const response: any = {
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  };

  if (details && process.env.NODE_ENV !== 'production') {
    response.details = details;
  }

  return res.status(statusCode).json(response);
}

/**
 * Not found response
 */
export function notFoundResponse(res: Response, resource: string = 'Resource') {
  return errorResponse(res, `${resource} not found`, 404);
}

/**
 * Unauthorized response
 */
export function unauthorizedResponse(res: Response, message: string = 'Unauthorized') {
  return errorResponse(res, message, 401);
}

/**
 * Validation error response
 */
export function validationErrorResponse(res: Response, errors: any) {
  return res.status(400).json({
    success: false,
    error: 'Validation failed',
    errors,
    timestamp: new Date().toISOString()
  });
}

/**
 * Handle async route errors
 */
export function asyncHandler(fn: Function) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Paginated response helper
 */
export function paginatedResponse(
  res: Response,
  data: any[],
  page: number,
  limit: number,
  total: number
) {
  return res.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1
    },
    timestamp: new Date().toISOString()
  });
}

/**
 * Cache control headers helper
 */
export function setCacheHeaders(res: Response, maxAge: number = 300) {
  res.set('Cache-Control', `public, max-age=${maxAge}`);
  return res;
}

/**
 * No cache headers helper
 */
export function setNoCacheHeaders(res: Response) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  return res;
}
