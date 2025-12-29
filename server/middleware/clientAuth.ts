import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { clients, progressNotes } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

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
  try {
    const { clientId } = req.params;
    const therapistId = req.therapistId || (req as any).user?.id || (req as any).therapistId;

    if (!therapistId) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    if (!clientId) {
      return res.status(400).json({ 
        error: 'Client ID required',
        code: 'CLIENT_ID_REQUIRED'
      });
    }

    // CRITICAL: Verify this client belongs to this therapist
    const client = await db
      .select()
      .from(clients)
      .where(and(
        eq(clients.id, clientId),
        eq(clients.therapistId, therapistId)
      ))
      .limit(1);

    if (client.length === 0) {
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
    next();
  } catch (error) {
    console.error('[SECURITY] Client verification error:', error);
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
   * Get client safely - always verifies ownership
   */
  static async getClient(clientId: string, therapistId: string) {
    return await db
      .select()
      .from(clients)
      .where(and(
        eq(clients.id, clientId),
        eq(clients.therapistId, therapistId)
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
   * Get all clients for a therapist safely
   */
  static async getTherapistClients(therapistId: string) {
    return await db
      .select()
      .from(clients)
      .where(eq(clients.therapistId, therapistId));
  }
}