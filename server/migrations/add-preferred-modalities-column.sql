-- Add missing preferred_modalities column to clients table
-- This column was defined in schema.ts but missing from the initial migration

ALTER TABLE clients ADD COLUMN IF NOT EXISTS preferred_modalities TEXT[] DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN clients.preferred_modalities IS 'Array of preferred therapy modalities for this client (e.g., CBT, DBT, EMDR)';
