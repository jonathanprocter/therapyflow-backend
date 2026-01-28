import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { clients, progressNotes } from '@shared/schema';
import { eq, and, isNull } from 'drizzle-orm';

// Only log in development
const IS_DEV = process.env.NODE_ENV !== 'production';
const devLog = (...args: any[]) => IS_DEV && console.log(...args);

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      therapistId?: string;
      verifiedClient?: {
        id: string;
        therapistId: string;
      };
    }
  }
}

/**
 * Middleware to verify client ownership before any client data access
 * CRITICAL: Use this on ALL routes that access client data
 */
export const verifyClientOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Debug entry point (dev only)
  devLog('[CLIENT_AUTH] Starting verification for:', req.originalUrl);

  try {
    // Support both :clientId and :id parameter names for flexibility
    const clientId = req.params?.clientId || req.params?.id;
    const therapistId = req.therapistId || (req as any).user?.id || (req as any).therapistId;

    // Debug logging for troubleshooting (dev only)
    devLog('[CLIENT_AUTH] Details:', {
      params: JSON.stringify(req.params || {}),
      url: req.originalUrl,
      clientId: clientId || 'MISSING',
      therapistId: therapistId || 'MISSING'
    });

    if (!therapistId) {
      devLog('[CLIENT_AUTH] No therapistId found');
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!clientId) {
      devLog('[CLIENT_AUTH] No clientId found in params:', req.params);
      return res.status(400).json({
        error: 'Client ID required',
        code: 'CLIENT_ID_REQUIRED'
      });
    }

    // Validate UUID format to catch malformed IDs early
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(clientId)) {
      devLog('[CLIENT_AUTH] Invalid client ID format:', clientId);
      return res.status(400).json({
        error: 'Invalid client ID format',
        code: 'INVALID_CLIENT_ID'
      });
    }

    // CRITICAL: Verify this client belongs to this therapist AND is not soft-deleted
    // H2 FIX: Added isNull(clients.deletedAt) to prevent access to deleted clients
    const client = await db
      .select()
      .from(clients)
      .where(and(
        eq(clients.id, clientId),
        eq(clients.therapistId, therapistId),
        isNull(clients.deletedAt) // H2: Prevent access to soft-deleted clients
      ))
      .limit(1);

    if (client.length === 0) {
      // Check if client exists at all (for better error messages)
      const anyClient = await db
        .select({ id: clients.id })
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1);

      if (anyClient.length === 0) {
        devLog('[CLIENT_AUTH] Client does not exist:', clientId);
        return res.status(404).json({
          error: 'Client not found',
          code: 'CLIENT_NOT_FOUND'
        });
      }

      // Log potential security breach attempt
      console.error('[SECURITY] Unauthorized client access attempt', {
        therapistId,
        clientId,
        timestamp: new Date(),
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      return res.status(403).json({
        error: 'Client not found or access denied',
        code: 'CLIENT_ACCESS_DENIED'
      });
    }

    // Store verified client for use in route handlers
    req.verifiedClient = client[0];
    devLog('[CLIENT_AUTH] Verified access for client:', clientId);
    next();
  } catch (error) {
    console.error('[SECURITY] Client verification error:', error);

    // Check for database connection errors
    if (error instanceof Error && error.message.includes('timeout')) {
      return res.status(503).json({
        error: 'Database temporarily unavailable',
        code: 'DB_TIMEOUT'
      });
    }

    res.status(500).json({
      error: 'Client verification failed',
      code: 'CLIENT_VERIFICATION_ERROR'
    });
  }
};

/**
 * Database helper: Safe client data queries with automatic ownership verification
 */
export class SecureClientQueries {
  /**
   * Get client safely - always verifies ownership and excludes soft-deleted
   * H2 FIX: Added isNull(clients.deletedAt) filter
   */
  static async getClient(clientId: string, therapistId: string) {
    return await db
      .select()
      .from(clients)
      .where(and(
        eq(clients.id, clientId),
        eq(clients.therapistId, therapistId),
        isNull(clients.deletedAt) // H2: Exclude soft-deleted clients
      ))
      .limit(1);
  }

  /**
   * Get progress notes safely - always verifies client ownership
   */
  static async getProgressNotes(clientId: string, therapistId: string) {
    // First verify client ownership
    const clientCheck = await this.getClient(clientId, therapistId);
    if (clientCheck.length === 0) {
      throw new Error('Client access denied');
    }

    return await db
      .select()
      .from(progressNotes)
      .where(eq(progressNotes.clientId, clientId))
      .orderBy(progressNotes.sessionDate);
  }

  /**
   * Get all clients for a therapist safely - excludes soft-deleted
   * H2 FIX: Added isNull(clients.deletedAt) filter
   */
  static async getTherapistClients(therapistId: string) {
    return await db
      .select()
      .from(clients)
      .where(and(
        eq(clients.therapistId, therapistId),
        isNull(clients.deletedAt) // H2: Exclude soft-deleted clients
      ));
  }
}