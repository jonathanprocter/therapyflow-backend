/**
 * Security Middleware
 * Implements Helmet.js security headers and CORS configuration
 */

import helmet from 'helmet';
import cors from 'cors';
import type { Express } from 'express';

/**
 * Configure security headers with Helmet
 */
export function configureSecurityHeaders(app: Express): void {
  // Use Helmet for security headers
  app.use(
    helmet({
      // Content Security Policy
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for UI components
          scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts (consider removing in production)
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'https://api.openai.com', 'https://api.anthropic.com'],
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      // Cross-Origin-Embedder-Policy
      crossOriginEmbedderPolicy: false, // Disable for API compatibility
      // Cross-Origin-Resource-Policy
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      // DNS Prefetch Control
      dnsPrefetchControl: { allow: false },
      // Frame Guard
      frameguard: { action: 'deny' },
      // Hide Powered By
      hidePoweredBy: true,
      // HSTS (HTTP Strict Transport Security)
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      // IE No Open
      ieNoOpen: true,
      // No Sniff
      noSniff: true,
      // Permitted Cross-Domain Policies
      permittedCrossDomainPolicies: { permittedPolicies: 'none' },
      // Referrer Policy
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      // XSS Filter
      xssFilter: true,
    })
  );

  console.log('✅ Security headers configured (Helmet.js)');
}

/**
 * Configure CORS
 */
export function configureCORS(app: Express): void {
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
    : [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:5000',
      ];

  // Add Replit and Render domains if configured
  if (process.env.REPLIT_DOMAINS) {
    allowedOrigins.push(...process.env.REPLIT_DOMAINS.split(','));
  }
  if (process.env.RENDER_EXTERNAL_URL) {
    allowedOrigins.push(process.env.RENDER_EXTERNAL_URL);
  }

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) {
          return callback(null, true);
        }

        // Check if origin is allowed
        if (allowedOrigins.some(allowed => origin.startsWith(allowed))) {
          callback(null, true);
        } else {
          console.warn(`⚠️  CORS: Blocked request from origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
      ],
      exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
      maxAge: 86400, // 24 hours
    })
  );

  console.log(`✅ CORS configured for origins: ${allowedOrigins.join(', ')}`);
}

/**
 * Add additional security middleware
 */
export function configureAdditionalSecurity(app: Express): void {
  // Disable X-Powered-By header
  app.disable('x-powered-by');

  // Trust proxy (for Render, Replit, etc.)
  if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  // Force HTTPS in production if configured
  if (process.env.FORCE_HTTPS === 'true' && process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
      if (req.header('x-forwarded-proto') !== 'https') {
        res.redirect(`https://${req.header('host')}${req.url}`);
      } else {
        next();
      }
    });
    console.log('✅ HTTPS redirect enabled');
  }

  console.log('✅ Additional security measures configured');
}

/**
 * Apply all security configurations
 */
export function applySecurity(app: Express): void {
  configureSecurityHeaders(app);
  configureCORS(app);
  configureAdditionalSecurity(app);
}
