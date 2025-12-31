-- Fix column name mismatch: is_simplepractice_event -> is_simple_practice_event
-- The schema.ts expects is_simple_practice_event but migration created is_simplepractice_event

-- Rename the column if it exists with the old name
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sessions' 
    AND column_name = 'is_simplepractice_event'
  ) THEN
    ALTER TABLE sessions 
    RENAME COLUMN is_simplepractice_event TO is_simple_practice_event;
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN sessions.is_simple_practice_event IS 'Whether this session originated from SimplePractice calendar';
