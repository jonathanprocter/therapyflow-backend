-- Add missing columns required by performance indexes and other features
-- These columns are referenced by add-performance-indexes.sql but don't exist in 000-init-core-tables.sql

-- Add deleted_at column to clients table for soft delete functionality
ALTER TABLE clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Add missing columns to progress_notes table
ALTER TABLE progress_notes ADD COLUMN IF NOT EXISTS session_date TIMESTAMP;
ALTER TABLE progress_notes ADD COLUMN IF NOT EXISTS is_placeholder BOOLEAN DEFAULT false;
ALTER TABLE progress_notes ADD COLUMN IF NOT EXISTS requires_manual_review BOOLEAN DEFAULT false;
ALTER TABLE progress_notes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
ALTER TABLE progress_notes ADD COLUMN IF NOT EXISTS content TEXT;

-- Add read status column to documents table (if it doesn't exist)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;

-- Update session_date from sessions.scheduled_at for existing progress notes
UPDATE progress_notes 
SET session_date = sessions.scheduled_at 
FROM sessions 
WHERE progress_notes.session_id = sessions.id 
AND progress_notes.session_date IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN clients.deleted_at IS 'Timestamp when client was soft-deleted (NULL if active)';
COMMENT ON COLUMN progress_notes.session_date IS 'Date of the session (denormalized from sessions.scheduled_at)';
COMMENT ON COLUMN progress_notes.is_placeholder IS 'Whether this is a placeholder note awaiting completion';
COMMENT ON COLUMN progress_notes.requires_manual_review IS 'Whether this note needs manual review';
COMMENT ON COLUMN progress_notes.status IS 'Status of the note: draft, final, reviewed, etc.';
COMMENT ON COLUMN progress_notes.content IS 'Full text content of the progress note';
COMMENT ON COLUMN documents.read IS 'Whether the document has been read/reviewed';
