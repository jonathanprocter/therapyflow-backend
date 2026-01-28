/**
 * Authentication Middleware
 *
 * SECURITY FIX: Replaces hardcoded therapist-1 identity with proper auth layer.
 *
 * Production: Requires valid JWT in Authorization header
 * Development: Optional bypass via DEV_BYPASS_AUTH=true env var
 */

import { Request, Response, NextFunction } from "express";

// Extend Express Request to include user and therapistId
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;
        email?: string;
      };
      therapistId?: string;
    }
  }
}

interface JwtPayload {
  sub: string;       // User ID
  role: string;      // User role (therapist, admin, etc.)
  email?: string;
  exp: number;       // Expiration timestamp
  iat: number;       // Issued at timestamp
}

/**
 * JWT decoder with signature verification
 * SECURITY FIX: Now verifies JWT signature using HMAC-SHA256
 * In production, configure JWT_SECRET environment variable
 */
function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    // Get JWT secret - REQUIRED in production
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      if (isProduction()) {
        console.error("[AUTH] CRITICAL: JWT_SECRET not configured in production!");
        return null;
      }
      // Dev mode without secret - log warning but allow decode-only
      console.warn("[AUTH] WARNING: JWT_SECRET not set - signature verification disabled in dev mode");
    } else {
      // Verify signature using HMAC-SHA256
      const crypto = require("crypto");
      const signatureInput = `${headerB64}.${payloadB64}`;
      const expectedSignature = crypto
        .createHmac("sha256", jwtSecret)
        .update(signatureInput)
        .digest("base64url");

      if (signatureB64 !== expectedSignature) {
        console.warn("[AUTH] JWT signature verification failed");
        return null;
      }
    }

    // Decode payload with proper error handling
    let payloadJson: string;
    try {
      payloadJson = Buffer.from(payloadB64, "base64url").toString("utf8");
    } catch (decodeError) {
      console.error("[AUTH] Failed to decode JWT payload:", decodeError);
      return null;
    }

    let payload: JwtPayload;
    try {
      payload = JSON.parse(payloadJson) as JwtPayload;
    } catch (parseError) {
      console.error("[AUTH] Failed to parse JWT payload as JSON:", parseError);
      return null;
    }

    return payload;
  } catch (error) {
    console.error("[AUTH] JWT decoding failed:", error);
    return null;
  }
}

/**
 * Validates JWT token structure and expiration
 * NOTE: In production, you should verify the signature against your auth provider's public key
 */
function validateJwt(token: string): JwtPayload | null {
  const payload = decodeJwt(token);
  if (!payload) return null;

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) {
    return null; // Token expired
  }

  // Validate required fields
  if (!payload.sub || !payload.role) {
    return null;
  }

  return payload;
}

/**
 * Check if running in production mode
 */
function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Check if dev bypass is explicitly enabled
 * Only works in non-production environments
 */
function isDevBypassEnabled(): boolean {
  if (isProduction()) return false;
  return process.env.DEV_BYPASS_AUTH === "true";
}

/**
 * Get the dev therapist ID from environment
 * Defaults to "therapist-1" for backwards compatibility in dev
 */
function getDevTherapistId(): string {
  return process.env.DEV_THERAPIST_ID || "therapist-1";
}

/**
 * Main authentication middleware
 *
 * In production:
 *   - Requires Authorization: Bearer <JWT> header
 *   - Returns 401 if missing or invalid
 *
 * In development with DEV_BYPASS_AUTH=true:
 *   - Sets therapistId from DEV_THERAPIST_ID env (defaults to "therapist-1")
 *   - Logs a warning about bypass mode
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Check for Authorization header
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const payload = validateJwt(token);

    if (payload) {
      req.user = {
        id: payload.sub,
        role: payload.role,
        email: payload.email,
      };
      req.therapistId = payload.sub;
      return next();
    }

    // Invalid token - reject in production, allow dev bypass
    if (isProduction()) {
      res.status(401).json({
        error: "Invalid or expired token",
        code: "INVALID_TOKEN"
      });
      return;
    }
  }

  // No valid auth header - check for dev bypass
  if (isDevBypassEnabled()) {
    const devTherapistId = getDevTherapistId();

    // Log warning on first request (or periodically)
    if (!req.app.get("devBypassWarningLogged")) {
      console.warn("⚠️  DEV_BYPASS_AUTH is enabled - using dev identity:", devTherapistId);
      console.warn("⚠️  This MUST NOT be used in production!");
      req.app.set("devBypassWarningLogged", true);
    }

    req.user = {
      id: devTherapistId,
      role: "therapist",
    };
    req.therapistId = devTherapistId;
    return next();
  }

  // No auth and no bypass - reject
  if (isProduction()) {
    res.status(401).json({
      error: "Authentication required",
      code: "AUTH_REQUIRED"
    });
    return;
  }

  // Development without bypass - still require some form of auth
  // This helps catch auth issues during development
  res.status(401).json({
    error: "Authentication required. Set DEV_BYPASS_AUTH=true and DEV_THERAPIST_ID to bypass in development.",
    code: "AUTH_REQUIRED",
    hint: "Add DEV_BYPASS_AUTH=true to your .env file for local development"
  });
}

/**
 * Optional auth middleware - doesn't reject, just sets user if available
 * Useful for endpoints that work with or without auth
 */
export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const payload = validateJwt(token);

    if (payload) {
      req.user = {
        id: payload.sub,
        role: payload.role,
        email: payload.email,
      };
      req.therapistId = payload.sub;
    }
  } else if (isDevBypassEnabled()) {
    const devTherapistId = getDevTherapistId();
    req.user = {
      id: devTherapistId,
      role: "therapist",
    };
    req.therapistId = devTherapistId;
  }

  next();
}

/**
 * Helper to get therapistId from request
 * SECURITY: Only uses authenticated user, no header fallback
 */
export function getAuthenticatedTherapistId(req: Request): string | undefined {
  return req.user?.id;
}

/**
 * Middleware to require therapist role
 */
export function requireTherapistRole(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  if (req.user.role !== "therapist" && req.user.role !== "admin") {
    res.status(403).json({ error: "Therapist role required" });
    return;
  }

  next();
}
