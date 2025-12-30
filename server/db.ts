import pkg from 'pg';
const { Pool } = pkg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// Debug: Log all environment variables that start with 'DATABASE'
if (process.env.NODE_ENV === 'production') {
  console.log('🔍 Checking DATABASE_URL...');
  const dbEnvVars = Object.keys(process.env).filter(k => k.includes('DATABASE'));
  console.log('Database-related env vars:', dbEnvVars);
}

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL is not set!');
  console.error('Available environment variables:', Object.keys(process.env).sort());
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database? " +
    "In Render, go to Environment tab and link your database."
  );
}

console.log('✅ DATABASE_URL found, connecting to database...');
console.log('Database host:', process.env.DATABASE_URL.split('@')[1]?.split('/')[0] || 'unknown');

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
