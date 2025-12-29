import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Render PostgreSQL requires SSL in production
// The DATABASE_URL may already include ?sslmode=require
const sslConfig = process.env.NODE_ENV === 'production'
  ? { rejectUnauthorized: false }
  : false;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10
});

export const db = drizzle(pool, { schema });
