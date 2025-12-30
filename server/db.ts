import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// Lazy database connection - only connects when actually used
let poolInstance: any = null;
let dbInstance: any = null;
let connectionAttempted = false;

/**
 * Initialize database connection
 */
function initializeConnection() {
  if (connectionAttempted) {
    return;
  }

  connectionAttempted = true;

  // Check for DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set!');
    console.error('Available environment variables:', Object.keys(process.env).filter(k => !k.includes('KEY') && !k.includes('SECRET')).sort());
    throw new Error(
      "DATABASE_URL must be set. Did you forget to provision a database? " +
      "In Render, go to Environment tab and link your database."
    );
  }

  console.log('✅ DATABASE_URL found, initializing connection...');
  
  // Extract host for logging (without exposing credentials)
  try {
    const url = new URL(process.env.DATABASE_URL);
    console.log(`📊 Database host: ${url.hostname}`);
  } catch (e) {
    console.log('📊 Initializing database connection...');
  }

  // Render PostgreSQL requires SSL in production
  const sslConfig = process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false;

  poolInstance = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: sslConfig,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 10
  });

  // Add event listeners
  poolInstance.on('error', (err: Error) => {
    console.error('❌ Database pool error:', err.message);
  });

  poolInstance.on('connect', () => {
    console.log('✅ Database connection established');
  });

  // Initialize Drizzle ORM
  dbInstance = drizzle(poolInstance, { schema });
  console.log('✅ Database initialized successfully');
}

/**
 * Get database pool (initializes if needed)
 */
export const pool = new Proxy({} as any, {
  get(target, prop) {
    if (!connectionAttempted) {
      initializeConnection();
    }
    if (!poolInstance) {
      throw new Error('Database pool not initialized');
    }
    const value = (poolInstance as any)[prop];
    return typeof value === 'function' ? value.bind(poolInstance) : value;
  }
});

/**
 * Get Drizzle ORM instance (initializes if needed)
 */
export const db = new Proxy({} as any, {
  get(target, prop) {
    if (!connectionAttempted) {
      initializeConnection();
    }
    if (!dbInstance) {
      throw new Error('Database not initialized');
    }
    const value = (dbInstance as any)[prop];
    return typeof value === 'function' ? value.bind(dbInstance) : value;
  }
});

// Export helper functions
export function getDatabase() {
  if (!connectionAttempted) {
    initializeConnection();
  }
  return dbInstance;
}

export function getDatabasePool() {
  if (!connectionAttempted) {
    initializeConnection();
  }
  return poolInstance;
}
