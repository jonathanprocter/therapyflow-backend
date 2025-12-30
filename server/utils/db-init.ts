/**
 * Database Initialization Utility
 * Ensures all required tables and migrations are applied
 */

import { db } from '../db.js';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Check if a table exists in the database
 */
async function tableExists(tableName: string): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = ${tableName}
      ) as exists
    `);
    
    return (result as any)[0]?.exists || false;
  } catch (error) {
    console.error(`Error checking table ${tableName}:`, error);
    return false;
  }
}

/**
 * Run a SQL migration file
 */
async function runMigrationFile(filePath: string, migrationName: string): Promise<void> {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Migration file not found: ${filePath}`);
      return;
    }

    console.log(`🔧 Running migration: ${migrationName}...`);
    const migrationSQL = fs.readFileSync(filePath, 'utf-8');
    
    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let successCount = 0;
    for (const statement of statements) {
      try {
        await db.execute(sql.raw(statement));
        successCount++;
      } catch (error: any) {
        // Ignore "already exists" errors
        if (!error.message?.includes('already exists')) {
          console.error(`Error in ${migrationName}:`, error.message);
        }
      }
    }

    console.log(`✅ ${migrationName} completed (${successCount} statements executed)`);
  } catch (error) {
    console.error(`❌ Error running ${migrationName}:`, error);
    throw error;
  }
}

/**
 * Initialize database with all required tables and migrations
 */
export async function initializeDatabase(): Promise<void> {
  console.log('\n🔧 Initializing Database...\n');

  const migrationsDir = path.join(__dirname, '../migrations');

  // Define migrations in order
  const migrations = [
    { file: '000-init-core-tables.sql', name: 'Core Tables' },
    { file: 'add-therapeutic-journey.sql', name: 'Therapeutic Journey' },
    { file: 'add-voice-notes.sql', name: 'Voice Notes' },
    { file: 'add-performance-indexes.sql', name: 'Performance Indexes' },
    { file: '2025-12-01_session_preps.sql', name: 'Session Preps' },
    { file: '2025-12-01_audit_settings_indexes.sql', name: 'Audit Settings' },
    { file: '2025-12-02_longitudinal_records.sql', name: 'Longitudinal Records' },
    { file: '2025-12-02_job_note_quality_documents.sql', name: 'Job Note Quality' }
  ];

  // Run each migration
  for (const migration of migrations) {
    const filePath = path.join(migrationsDir, migration.file);
    await runMigrationFile(filePath, migration.name);
  }

  // Verify critical tables
  console.log('\n🔍 Verifying critical tables...\n');
  
  const criticalTables = [
    'users',
    'clients',
    'sessions',
    'progress_notes',
    'documents',
    'session_tags',
    'session_insights',
    'journey_synthesis',
    'voice_notes'
  ];

  let allTablesExist = true;
  for (const tableName of criticalTables) {
    const exists = await tableExists(tableName);
    const status = exists ? '✅' : '❌';
    console.log(`${status} ${tableName}: ${exists ? 'exists' : 'MISSING'}`);
    if (!exists) {
      allTablesExist = false;
    }
  }

  if (allTablesExist) {
    console.log('\n✅ Database initialization complete! All tables verified.\n');
  } else {
    console.warn('\n⚠️  Database initialization completed with warnings. Some tables may be missing.\n');
  }
}

/**
 * Quick health check for database
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch (error) {
    console.error('❌ Database health check failed:', error);
    return false;
  }
}
