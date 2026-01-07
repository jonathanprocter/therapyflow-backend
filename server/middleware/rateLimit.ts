import type { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

interface RateLimitOptions {
  windowMs?: number;      // Time window in milliseconds
  maxRequests?: number;   // Max requests per window
  message?: string;       // Error message
  keyGenerator?: (req: Request) => string;  // Function to generate rate limit key
}

const defaultOptions: Required<RateLimitOptions> = {
  windowMs: 60 * 1000,    // 1 minute
  maxRequests: 100,       // 100 requests per minute
  message: 'Too many requests, please try again later',
  keyGenerator: (req: Request) => {
    // Use IP address as default key
    const forwarded = req.headers['x-forwarded-for'];
    const ip = typeof forwarded === 'string'
      ? forwarded.split(',')[0].trim()
      : req.ip || req.socket.remoteAddress || 'unknown';
    return ip;
  }
};

// In-memory store for rate limiting
// Note: In production with multiple instances, use Redis or similar
const stores: Map<string, RateLimitStore> = new Map();

// Clean up expired entries periodically
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  stores.forEach((store) => {
    Object.keys(store).forEach((key) => {
      if (store[key].resetTime < now) {
        delete store[key];
      }
    });
  });
}, 60 * 1000); // Clean up every minute

// Prevent the interval from keeping Node.js alive
cleanupInterval.unref?.();

/**
 * Create a rate limiting middleware
 */
export function rateLimit(options: RateLimitOptions = {}) {
  const config = { ...defaultOptions, ...options };
  const storeKey = `${config.windowMs}-${config.maxRequests}`;

  if (!stores.has(storeKey)) {
    stores.set(storeKey, {});
  }
  const store = stores.get(storeKey)!;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = config.keyGenerator(req);
    const now = Date.now();

    if (!store[key] || store[key].resetTime < now) {
      // Initialize or reset the counter
      store[key] = {
        count: 1,
        resetTime: now + config.windowMs
      };
    } else {
      store[key].count++;
    }

    const remaining = Math.max(0, config.maxRequests - store[key].count);
    const resetTime = Math.ceil((store[key].resetTime - now) / 1000);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', config.maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTime);

    if (store[key].count > config.maxRequests) {
      res.setHeader('Retry-After', resetTime);
      return res.status(429).json({
        error: config.message,
        retryAfter: resetTime
      });
    }

    next();
  };
}

/**
 * Stricter rate limit for sensitive endpoints (auth, AI processing)
 */
export const strictRateLimit = rateLimit({
  windowMs: 60 * 1000,    // 1 minute
  maxRequests: 10,        // 10 requests per minute
  message: 'Too many requests to this endpoint, please wait before trying again'
});

/**
 * Standard rate limit for general API endpoints
 */
export const standardRateLimit = rateLimit({
  windowMs: 60 * 1000,    // 1 minute
  maxRequests: 100,       // 100 requests per minute
  message: 'Rate limit exceeded, please slow down your requests'
});

/**
 * Lenient rate limit for read-heavy endpoints
 */
export const lenientRateLimit = rateLimit({
  windowMs: 60 * 1000,    // 1 minute
  maxRequests: 300,       // 300 requests per minute
  message: 'Too many requests, please try again later'
});

/**
 * Rate limit for AI/document processing endpoints (expensive operations)
 */
export const aiProcessingRateLimit = rateLimit({
  windowMs: 60 * 1000,    // 1 minute
  maxRequests: 20,        // 20 requests per minute
  message: 'AI processing rate limit exceeded. These operations are resource-intensive, please wait before making more requests.'
});
