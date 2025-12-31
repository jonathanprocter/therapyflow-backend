import type { Request } from 'express';

/**
 * Extracts therapist ID from request object
 * Handles multiple authentication patterns used across the application
 */
export function getTherapistId(req: Request): string | null {
  const authReq = req as any;
  
  // Try different sources in order of preference
  return authReq.user?.id || 
         authReq.therapistId || 
         authReq.user?.therapistId ||
         null;
}

/**
 * Extracts therapist ID with fallback to default
 * Use this when you need a guaranteed therapist ID (e.g., in mock auth scenarios)
 */
export function getTherapistIdOrDefault(req: Request, defaultId: string = 'dr-jonathan-procter'): string {
  return getTherapistId(req) || defaultId;
}

/**
 * Middleware to ensure therapist ID is present
 * Returns 401 if no therapist ID found
 */
export function requireTherapistId(req: Request, res: any, next: any) {
  const therapistId = getTherapistId(req);
  
  if (!therapistId) {
    return res.status(401).json({ 
      success: false, 
      error: 'Unauthorized: No therapist ID found' 
    });
  }
  
  // Attach to request for easy access
  (req as any).therapistId = therapistId;
  next();
}

/**
 * Extract user ID from request (alias for getTherapistId for clarity)
 */
export function getUserId(req: Request): string | null {
  return getTherapistId(req);
}
