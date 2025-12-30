import { db } from '../db.js';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

interface MigrationStatus {
  tableName: string;
  exists: boolean;
}

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
 * Check if all required therapeutic journey tables exist
 */
export async function checkTherapeuticTables(): Promise<MigrationStatus[]> {
  const requiredTables = [
    'session_tags',
    'session_insights',
    'journey_synthesis',
    'session_cross_references'
  ];

  const statuses: MigrationStatus[] = [];

  for (const tableName of requiredTables) {
    const exists = await tableExists(tableName);
    statuses.push({ tableName, exists });
  }

  return statuses;
}

/**
 * Run performance indexes migration
 */
export async function ensurePerformanceIndexes(): Promise<void> {
  console.log('🔧 Checking performance indexes...');

  try {
    const migrationPath = path.join(__dirname, '../migrations/add-performance-indexes.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.warn(`⚠️  Performance indexes migration file not found: ${migrationPath}`);
      return;
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let indexesCreated = 0;
    for (const statement of statements) {
      try {
        await db.execute(sql.raw(statement));
        if (statement.toLowerCase().includes('create index')) {
          indexesCreated++;
        }
      } catch (error: any) {
        // Ignore "already exists" errors
        if (!error.message?.includes('already exists')) {
          console.error('Error executing index statement:', error.message);
        }
      }
    }

    if (indexesCreated > 0) {
      console.log(`✅ Created ${indexesCreated} performance indexes`);
    } else {
      console.log('✅ Performance indexes already exist');
    }
  } catch (error) {
    console.error('❌ Error ensuring performance indexes:', error);
  }
}

/**
 * Run therapeutic journey migration if tables don't exist
 */
export async function ensureTherapeuticTables(): Promise<void> {
  const statuses = await checkTherapeuticTables();
  const missingTables = statuses.filter(s => !s.exists);

  if (missingTables.length === 0) {
    console.log('✅ All therapeutic journey tables exist');
    return;
  }

  console.log(`⚠️  Missing tables: ${missingTables.map(t => t.tableName).join(', ')}`);
  console.log('🔧 Running therapeutic journey migration...');

  try {
    const migrationPath = path.join(__dirname, '../migrations/add-therapeutic-journey.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Migration file not found: ${migrationPath}`);
      return;
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      try {
        await db.execute(sql.raw(statement));
      } catch (error: any) {
        // Ignore "already exists" errors
        if (!error.message?.includes('already exists')) {
          console.error('Error executing migration statement:', error);
        }
      }
    }

    console.log('✅ Therapeutic journey migration completed');

    // Verify tables were created
    const newStatuses = await checkTherapeuticTables();
    const stillMissing = newStatuses.filter(s => !s.exists);
    
    if (stillMissing.length > 0) {
      console.warn(`⚠️  Some tables still missing: ${stillMissing.map(t => t.tableName).join(', ')}`);
    } else {
      console.log('✅ All therapeutic journey tables verified');
    }
  } catch (error) {
    console.error('❌ Error running therapeutic journey migration:', error);
    throw error;
  }
}

/**
 * Check all critical database tables
 */
export async function checkCriticalTables(): Promise<void> {
  const criticalTables = [
    'users',
    'clients',
    'sessions',
    'progress_notes',
    'documents'
  ];

  console.log('🔍 Checking critical database tables...');

  for (const tableName of criticalTables) {
    const exists = await tableExists(tableName);
    const status = exists ? '✅' : '❌';
    console.log(`${status} ${tableName}: ${exists ? 'exists' : 'MISSING'}`);
  }
}
