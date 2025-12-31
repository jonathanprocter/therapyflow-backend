/**
 * Voice Notes Migration Utility
 * Ensures voice_notes table exists in the database
 */

import { db } from '../db.js';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Check if voice_notes table exists
 */
async function voiceNotesTableExists(): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'voice_notes'
      ) as exists
    `);
    
    return (result as any)[0]?.exists || false;
  } catch (error) {
    console.error('Error checking voice_notes table:', error);
    return false;
  }
}

/**
 * Run voice notes migration
 */
export async function ensureVoiceNotesTable(): Promise<void> {
  const exists = await voiceNotesTableExists();

  if (exists) {
    console.log('✅ Voice notes table exists');
    return;
  }

  console.log('🔧 Creating voice_notes table...');

  try {
    const migrationPath = path.join(__dirname, '../migrations/add-voice-notes.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`❌ Voice notes migration file not found: ${migrationPath}`);
      return;
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      try {
        await db.execute(sql.raw(statement));
      } catch (error: any) {
        // Ignore "already exists" errors
        if (!error.message?.includes('already exists')) {
          console.error('Error executing voice notes migration:', error);
        }
      }
    }

    console.log('✅ Voice notes table created successfully');

    // Verify table was created
    const nowExists = await voiceNotesTableExists();
    
    if (!nowExists) {
      console.warn('⚠️  Voice notes table creation may have failed');
    }
  } catch (error) {
    console.error('❌ Error creating voice notes table:', error);
    throw error;
  }
}
