/**
 * Security Tests for Authentication Middleware
 *
 * Tests the auth middleware to ensure:
 * 1. Production mode requires valid JWT
 * 2. Dev bypass only works in non-production with explicit flag
 * 3. x-therapist-id header spoofing is blocked
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authMiddleware, optionalAuthMiddleware, getAuthenticatedTherapistId } from '../middleware/auth';

// Mock Express request/response
function createMockRequest(options: Partial<{
  headers: Record<string, string>;
  app: any;
}> = {}): Request {
  return {
    headers: options.headers || {},
    app: options.app || { get: vi.fn(), set: vi.fn() },
  } as unknown as Request;
}

interface MockResponseResult {
  res: Response;
  getStatusCode: () => number;
  getJsonBody: () => any;
}

function createMockResponse(): MockResponseResult {
  let statusCode = 200;
  let jsonBody: any = null;

  const res = {
    status: function(code: number) {
      statusCode = code;
      return this;
    },
    json: function(body: any) {
      jsonBody = body;
      return this;
    },
  } as unknown as Response;

  return {
    res,
    getStatusCode: () => statusCode,
    getJsonBody: () => jsonBody,
  };
}

describe('Authentication Middleware - Security Tests', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset environment before each test
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Production Mode Security', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      delete process.env.DEV_BYPASS_AUTH;
    });

    it('should reject requests without Authorization header in production', () => {
      const req = createMockRequest();
      const { res, getStatusCode, getJsonBody } = createMockResponse();
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(getStatusCode()).toBe(401);
      expect(getJsonBody()).toHaveProperty('error');
      expect(getJsonBody().code).toBe('AUTH_REQUIRED');
    });

    it('should reject requests with invalid JWT in production', () => {
      const req = createMockRequest({
        headers: { authorization: 'Bearer invalid.token.here' },
      });
      const { res, getStatusCode, getJsonBody } = createMockResponse();
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(getStatusCode()).toBe(401);
      expect(getJsonBody()).toHaveProperty('error');
    });

    it('should reject requests with expired JWT in production', () => {
      // Create an expired JWT (exp in the past)
      const expiredPayload = {
        sub: 'therapist-123',
        role: 'therapist',
        exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        iat: Math.floor(Date.now() / 1000) - 7200,
      };
      const expiredToken = `eyJ0eXAiOiJKV1QiLCJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify(expiredPayload)).toString('base64url')}.`;

      const req = createMockRequest({
        headers: { authorization: `Bearer ${expiredToken}` },
      });
      const { res, getStatusCode } = createMockResponse();
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(getStatusCode()).toBe(401);
    });

    it('should NOT allow DEV_BYPASS_AUTH in production', () => {
      process.env.DEV_BYPASS_AUTH = 'true';
      process.env.DEV_THERAPIST_ID = 'attacker-id';

      const req = createMockRequest();
      const { res, getStatusCode } = createMockResponse();
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(getStatusCode()).toBe(401);
      // Ensure attacker's therapist ID is NOT set
      expect(req.therapistId).toBeUndefined();
    });

    it('should accept valid JWT with future expiration', () => {
      const validPayload = {
        sub: 'therapist-valid',
        role: 'therapist',
        email: 'therapist@example.com',
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        iat: Math.floor(Date.now() / 1000),
      };
      const validToken = `eyJ0eXAiOiJKV1QiLCJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify(validPayload)).toString('base64url')}.`;

      const req = createMockRequest({
        headers: { authorization: `Bearer ${validToken}` },
      });
      const { res } = createMockResponse();
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user?.id).toBe('therapist-valid');
      expect(req.therapistId).toBe('therapist-valid');
    });
  });

  describe('Development Mode with Bypass', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('should allow dev bypass when explicitly enabled', () => {
      process.env.DEV_BYPASS_AUTH = 'true';
      process.env.DEV_THERAPIST_ID = 'dev-therapist-1';

      const mockApp = { get: vi.fn(), set: vi.fn() };
      const req = createMockRequest({ app: mockApp });
      const { res } = createMockResponse();
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.therapistId).toBe('dev-therapist-1');
      expect(req.user?.id).toBe('dev-therapist-1');
    });

    it('should use default therapist-1 when DEV_THERAPIST_ID not set', () => {
      process.env.DEV_BYPASS_AUTH = 'true';
      delete process.env.DEV_THERAPIST_ID;

      const mockApp = { get: vi.fn(), set: vi.fn() };
      const req = createMockRequest({ app: mockApp });
      const { res } = createMockResponse();
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.therapistId).toBe('therapist-1');
    });

    it('should reject when DEV_BYPASS_AUTH is not set in development', () => {
      delete process.env.DEV_BYPASS_AUTH;

      const req = createMockRequest();
      const { res, getStatusCode, getJsonBody } = createMockResponse();
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(getStatusCode()).toBe(401);
      expect(getJsonBody().hint).toContain('DEV_BYPASS_AUTH');
    });
  });

  describe('Header Spoofing Prevention', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('should NOT use x-therapist-id header for authentication', () => {
      const req = createMockRequest({
        headers: { 'x-therapist-id': 'spoofed-therapist' },
      });
      const { res, getStatusCode } = createMockResponse();
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(getStatusCode()).toBe(401);
      // Ensure spoofed header is NOT used
      expect(req.therapistId).toBeUndefined();
    });

    it('should ignore x-therapist-id header even with valid JWT', () => {
      const validPayload = {
        sub: 'real-therapist',
        role: 'therapist',
        exp: Math.floor(Date.now() / 1000) + 3600,
        iat: Math.floor(Date.now() / 1000),
      };
      const validToken = `eyJ0eXAiOiJKV1QiLCJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify(validPayload)).toString('base64url')}.`;

      const req = createMockRequest({
        headers: {
          authorization: `Bearer ${validToken}`,
          'x-therapist-id': 'spoofed-therapist',
        },
      });
      const { res } = createMockResponse();
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      // Should use JWT identity, not spoofed header
      expect(req.therapistId).toBe('real-therapist');
      expect(req.therapistId).not.toBe('spoofed-therapist');
    });
  });

  describe('getAuthenticatedTherapistId helper', () => {
    it('should return therapistId from authenticated user only', () => {
      const req = createMockRequest();
      (req as any).user = { id: 'authenticated-therapist', role: 'therapist' };

      const result = getAuthenticatedTherapistId(req);

      expect(result).toBe('authenticated-therapist');
    });

    it('should return undefined when no user is authenticated', () => {
      const req = createMockRequest();

      const result = getAuthenticatedTherapistId(req);

      expect(result).toBeUndefined();
    });
  });
});
