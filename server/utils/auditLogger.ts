import { db } from '../db';
import { auditLogs } from '@shared/schema';

// Audit log entry types
export enum AuditAction {
  // Client data access
  CLIENT_VIEW = 'CLIENT_VIEW',
  CLIENT_CREATE = 'CLIENT_CREATE',
  CLIENT_UPDATE = 'CLIENT_UPDATE',
  CLIENT_DELETE = 'CLIENT_DELETE',
  
  // Progress notes
  NOTE_VIEW = 'NOTE_VIEW',
  NOTE_CREATE = 'NOTE_CREATE',
  NOTE_UPDATE = 'NOTE_UPDATE',
  NOTE_DELETE = 'NOTE_DELETE',
  
  // AI processing
  AI_ANALYSIS = 'AI_ANALYSIS',
  AI_SEARCH = 'AI_SEARCH',
  
  // Authentication
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  
  // System events
  DATA_EXPORT = 'DATA_EXPORT',
  DATA_IMPORT = 'DATA_IMPORT',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
}

export interface AuditLogEntry {
  userId: string;
  action: AuditAction;
  resourceType: 'client' | 'note' | 'system' | 'ai';
  resourceId?: string;
  clientId?: string; // For PHI access tracking
  ipAddress: string;
  userAgent: string;
  sessionId?: string;
  details?: Record<string, any>;
  riskLevel: 'low' | 'medium' | 'high';
  timestamp: Date;
}

/**
 * HIPAA-compliant audit logging system
 * Logs ALL access to protected health information (PHI)
 */
export class ClinicalAuditLogger {
  /**
   * Log PHI access (REQUIRED for HIPAA compliance)
   */
  static async logPHIAccess(
    userId: string,
    action: AuditAction,
    clientId: string,
    req: any, // Express request object
    details?: Record<string, any>
  ) {
    const entry: AuditLogEntry = {
      userId,
      action,
      resourceType: 'client',
      resourceId: clientId,
      clientId,
      ipAddress: this.getClientIP(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      sessionId: req.sessionID,
      details: {
        ...details,
        url: req.originalUrl,
        method: req.method,
      },
      riskLevel: this.calculateRiskLevel(action),
      timestamp: new Date(),
    };

    await this.writeAuditLog(entry);
    
    // Alert on high-risk activities
    if (entry.riskLevel === 'high') {
      await this.alertHighRiskActivity(entry);
    }
  }

  /**
   * Log AI processing activities
   */
  static async logAIActivity(
    userId: string,
    action: AuditAction,
    details: {
      provider?: string;
      processingTime?: number;
      fallbackUsed?: boolean;
      confidence?: number;
      clientId?: string;
    },
    req: any
  ) {
    const entry: AuditLogEntry = {
      userId,
      action,
      resourceType: 'ai',
      resourceId: details.clientId,
      clientId: details.clientId,
      ipAddress: this.getClientIP(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      sessionId: req.sessionID,
      details: {
        ...details,
        url: req.originalUrl,
        method: req.method,
      },
      riskLevel: details.fallbackUsed ? 'medium' : 'low',
      timestamp: new Date(),
    };

    await this.writeAuditLog(entry);
  }

  /**
   * Log unauthorized access attempts
   */
  static async logUnauthorizedAccess(
    userId: string,
    attemptedResource: string,
    req: any,
    reason: string
  ) {
    const entry: AuditLogEntry = {
      userId,
      action: AuditAction.UNAUTHORIZED_ACCESS,
      resourceType: 'system',
      resourceId: attemptedResource,
      ipAddress: this.getClientIP(req),
      userAgent: req.headers['user-agent'] || 'unknown',
      sessionId: req.sessionID,
      details: {
        reason,
        url: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString(),
      },
      riskLevel: 'high',
      timestamp: new Date(),
    };

    await this.writeAuditLog(entry);
    await this.alertHighRiskActivity(entry);
  }

  /**
   * Generate HIPAA compliance report
   */
  static async generateComplianceReport(
    startDate: Date,
    endDate: Date,
    therapistId?: string
  ): Promise<{
    summary: {
      totalAccesses: number;
      uniqueClients: number;
      highRiskEvents: number;
      unauthorizedAttempts: number;
    };
    events: AuditLogEntry[];
    riskAnalysis: {
      suspiciousIPs: string[];
      unusualAccessPatterns: any[];
      failedLoginAttempts: number;
    };
  }> {
    // This would query the audit logs table when implemented
    // For now, return structure to show the interface
    return {
      summary: {
        totalAccesses: 0,
        uniqueClients: 0,
        highRiskEvents: 0,
        unauthorizedAttempts: 0,
      },
      events: [],
      riskAnalysis: {
        suspiciousIPs: [],
        unusualAccessPatterns: [],
        failedLoginAttempts: 0,
      },
    };
  }

  /**
   * Calculate risk level based on action type
   */
  private static calculateRiskLevel(action: AuditAction): 'low' | 'medium' | 'high' {
    const highRiskActions = [
      AuditAction.CLIENT_DELETE,
      AuditAction.NOTE_DELETE,
      AuditAction.DATA_EXPORT,
      AuditAction.UNAUTHORIZED_ACCESS,
      AuditAction.LOGIN_FAILED,
    ];

    const mediumRiskActions = [
      AuditAction.CLIENT_UPDATE,
      AuditAction.NOTE_UPDATE,
      AuditAction.DATA_IMPORT,
    ];

    if (highRiskActions.includes(action)) return 'high';
    if (mediumRiskActions.includes(action)) return 'medium';
    return 'low';
  }

  /**
   * Extract client IP address from request
   */
  private static getClientIP(req: any): string {
    return req.ip || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.headers['x-forwarded-for']?.split(',')[0] || 
           'unknown';
  }

  /**
   * Write audit log entry to database
   */
  private static async writeAuditLog(entry: AuditLogEntry) {
    try {
      // Log to console for immediate visibility
      console.log('[AUDIT]', {
        action: entry.action,
        userId: entry.userId,
        clientId: entry.clientId,
        riskLevel: entry.riskLevel,
        ip: entry.ipAddress,
        timestamp: entry.timestamp.toISOString(),
      });

      await db.insert(auditLogs).values({
        userId: entry.userId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        clientId: entry.clientId,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        sessionId: entry.sessionId,
        details: entry.details,
        riskLevel: entry.riskLevel,
        timestamp: entry.timestamp
      });
      
    } catch (error) {
      console.error('[AUDIT] Failed to write audit log:', error);
      // Critical: audit logging failures must not break the application
      // but should be reported to system monitoring
    }
  }

  /**
   * Alert on high-risk security events
   */
  private static async alertHighRiskActivity(entry: AuditLogEntry) {
    console.warn('[SECURITY ALERT]', {
      action: entry.action,
      userId: entry.userId,
      clientId: entry.clientId,
      ip: entry.ipAddress,
      userAgent: entry.userAgent,
      details: entry.details,
      timestamp: entry.timestamp.toISOString(),
    });

    // TODO: Implement real-time alerting
    // - Email notifications to admin
    // - Slack/Discord webhooks
    // - Integration with security monitoring tools
  }

  /**
   * Check for suspicious activity patterns
   */
  static async detectSuspiciousPatterns(userId: string): Promise<{
    isSuspicious: boolean;
    reasons: string[];
    riskScore: number;
  }> {
    // TODO: Implement pattern detection algorithms
    // - Multiple failed logins
    // - Access from unusual locations
    // - Bulk data access patterns
    // - After-hours access
    
    return {
      isSuspicious: false,
      reasons: [],
      riskScore: 0,
    };
  }
}
