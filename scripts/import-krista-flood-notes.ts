import fs from 'fs';
import path from 'path';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  connectionString: "postgresql://therapyflow_db_trej_user:IMRxEVGOUYLqeKd2DqNmBci59FZsqvLE@dpg-d598ss15pdvs73a8epp0-a.virginia-postgres.render.com/therapyflow_db_trej?sslmode=require"
});

const KRISTA_CLIENT_ID = "3ab2b9d7-d29b-4ab1-9b65-37c23dd79f07";
const THERAPIST_ID = "dr-jonathan-procter";
const NOTES_DIR = "/tmp/krista_flood_notes";

interface NoteFile {
  filename: string;
  dateStr: string;
  content: string;
}

async function importNotes() {
  console.log("Starting import of Krista Flood notes...");

  const files = fs.readdirSync(NOTES_DIR)
    .filter(f => f.endsWith('.txt'))
    .sort();

  console.log(`Found ${files.length} note files`);

  const notes: NoteFile[] = [];

  for (const file of files) {
    // Parse date from filename like "01_2024-07-12_Krista_Flood_Note.txt"
    const match = file.match(/(\d{4}-\d{2}-\d{2})/);
    if (!match) {
      console.warn(`Could not parse date from filename: ${file}`);
      continue;
    }

    const dateStr = match[1];
    const content = fs.readFileSync(path.join(NOTES_DIR, file), 'utf-8');

    notes.push({ filename: file, dateStr, content });
  }

  console.log(`Parsed ${notes.length} notes with valid dates`);

  // Check for existing notes to avoid duplicates
  const existingResult = await pool.query(
    `SELECT session_date::date as date FROM progress_notes WHERE client_id = $1`,
    [KRISTA_CLIENT_ID]
  );

  const existingDates = new Set(
    existingResult.rows.map(r => r.date?.toISOString().split('T')[0])
  );

  console.log(`Found ${existingDates.size} existing notes for Krista Flood`);

  let imported = 0;
  let skipped = 0;

  for (const note of notes) {
    if (existingDates.has(note.dateStr)) {
      console.log(`  Skipping ${note.filename} - already exists for ${note.dateStr}`);
      skipped++;
      continue;
    }

    // Extract tags from content
    const tags: string[] = [];
    if (note.content.toLowerCase().includes('intrusive thoughts')) tags.push('intrusive-thoughts');
    if (note.content.toLowerCase().includes('anxiety')) tags.push('anxiety');
    if (note.content.toLowerCase().includes('act')) tags.push('ACT');
    if (note.content.toLowerCase().includes('defusion')) tags.push('defusion');
    if (note.content.toLowerCase().includes('mindfulness')) tags.push('mindfulness');
    if (note.content.toLowerCase().includes('depression')) tags.push('depression');
    if (note.content.toLowerCase().includes('self-compassion')) tags.push('self-compassion');
    if (note.content.toLowerCase().includes('coping')) tags.push('coping-strategies');
    if (note.content.toLowerCase().includes('trauma')) tags.push('trauma');
    if (note.content.toLowerCase().includes('relationship')) tags.push('relationships');

    // Parse session time - default to noon if not found
    const sessionDate = new Date(`${note.dateStr}T12:00:00`);

    try {
      await pool.query(`
        INSERT INTO progress_notes (
          id, client_id, therapist_id, content, session_date,
          tags, status, is_placeholder, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4,
          $5, 'completed', false, NOW(), NOW()
        )
      `, [
        KRISTA_CLIENT_ID,
        THERAPIST_ID,
        note.content,
        sessionDate.toISOString(),
        tags
      ]);

      console.log(`  ✓ Imported ${note.filename} (${note.dateStr})`);
      imported++;
    } catch (err) {
      console.error(`  ✗ Failed to import ${note.filename}:`, err);
    }
  }

  console.log(`\nImport complete!`);
  console.log(`  Imported: ${imported}`);
  console.log(`  Skipped (duplicates): ${skipped}`);

  await pool.end();
}

importNotes().catch(console.error);
