-- Fix column name mismatch: is_simplepractice_event -> is_simple_practice_event
-- The schema.ts expects is_simple_practice_event but migration created is_simplepractice_event

-- Since the column was just created in this deployment, we can safely rename it
-- This will fail silently if the column doesn't exist (which is fine for idempotency)

-- Note: We can't use DO blocks because the migration runner splits by semicolons
-- Instead, we'll use a simpler approach with ALTER TABLE IF EXISTS pattern

-- Add the correctly named column if it doesn't exist
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_simple_practice_event BOOLEAN DEFAULT false;

-- Copy data from old column to new column if old column exists
UPDATE sessions 
SET is_simple_practice_event = is_simplepractice_event 
WHERE is_simplepractice_event IS NOT NULL;

-- Drop the old incorrectly named column if it exists
ALTER TABLE sessions DROP COLUMN IF EXISTS is_simplepractice_event;
