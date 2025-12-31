-- Add missing progress_note_status column to sessions table
-- This column was defined in schema.ts but missing from the initial migration

ALTER TABLE sessions 
ADD COLUMN IF NOT EXISTS progress_note_status TEXT DEFAULT 'pending';

-- Add comment for documentation
COMMENT ON COLUMN sessions.progress_note_status IS 'Status of progress note: pending, uploaded, processed, needs_review';
