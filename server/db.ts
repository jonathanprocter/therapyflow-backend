import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure connection pool with timeout and retry settings
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Pool configuration to prevent timeout issues
  max: 10,                    // Maximum connections in the pool
  idleTimeoutMillis: 30000,   // Close idle connections after 30 seconds
  connectionTimeoutMillis: 10000, // Timeout after 10 seconds when acquiring connection
  allowExitOnIdle: true,      // Allow process to exit when pool is idle
});

// Handle pool errors gracefully
pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

// Test connection on startup
pool.connect()
  .then(client => {
    console.log('✅ Database connection established');
    client.release();
  })
  .catch(err => {
    console.error('❌ Database connection failed:', err.message);
  });

export const db = drizzle({ client: pool, schema });