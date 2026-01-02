-- Migration: Add missing columns to documents table
-- The Drizzle schema expects file_type, file_name, tags, metadata columns
-- but the original SQL migration had different column names

-- Add file_type column (maps from mime_type concept)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_type TEXT;

-- Add file_name column (maps from title concept)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS file_name TEXT;

-- Add tags array column
ALTER TABLE documents ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Add metadata jsonb column
ALTER TABLE documents ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add embedding array column for semantic search
ALTER TABLE documents ADD COLUMN IF NOT EXISTS embedding REAL[];

-- Copy existing data if columns exist
UPDATE documents SET file_type = mime_type WHERE file_type IS NULL AND mime_type IS NOT NULL;
UPDATE documents SET file_name = title WHERE file_name IS NULL AND title IS NOT NULL;

-- Set defaults for tags if null
UPDATE documents SET tags = ARRAY[]::TEXT[] WHERE tags IS NULL;
