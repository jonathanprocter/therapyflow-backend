-- Fix column name mismatch - safe idempotent version
-- Add the correctly named column if it doesn't exist
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_simple_practice_event BOOLEAN DEFAULT false;

-- Drop the old column if it exists (silently ignore if not)
ALTER TABLE sessions DROP COLUMN IF EXISTS is_simplepractice_event;
