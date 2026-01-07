import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure connection pool for standard PostgreSQL (Render, etc.)
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Pool configuration
  max: 10,                    // Maximum connections in the pool
  idleTimeoutMillis: 30000,   // Close idle connections after 30 seconds
  connectionTimeoutMillis: 10000, // Timeout after 10 seconds when acquiring connection
  // SSL configuration for Render PostgreSQL
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Handle pool errors gracefully - don't crash the process
pool.on('error', (err) => {
  console.error('Database pool error (non-fatal):', err?.message || err);
  // Don't rethrow - let the pool recover
});

// Test connection on startup with proper error handling
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Database connection established');
    client.release();
  } catch (err: any) {
    console.error('❌ Database connection failed:', err?.message || 'Unknown error');
    console.error('   The server will continue running and retry on requests');
    // Don't throw - let the server start anyway
  }
};

// Run connection test but don't block startup
testConnection();

export const db = drizzle(pool, { schema });
