-- CRITICAL: Schema Reset Migration
-- This migration drops all existing tables to fix the schema mismatch
-- caused by commit 4a8a9e6 which created incompatible integer-based tables
-- 
-- This MUST run before 000-init-core-tables.sql to ensure clean slate

-- Drop all tables in reverse dependency order
DROP TABLE IF EXISTS calendar_events CASCADE;
DROP TABLE IF EXISTS voice_notes CASCADE;
DROP TABLE IF EXISTS journey_synthesis CASCADE;
DROP TABLE IF EXISTS session_insights CASCADE;
DROP TABLE IF EXISTS session_tags CASCADE;
DROP TABLE IF EXISTS therapeutic_alliance CASCADE;
DROP TABLE IF EXISTS assessments CASCADE;
DROP TABLE IF EXISTS goals CASCADE;
DROP TABLE IF EXISTS treatment_plans CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS progress_notes CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop additional tables that may exist
DROP TABLE IF EXISTS case_conceptualizations CASCADE;
DROP TABLE IF EXISTS alliance_scores CASCADE;
DROP TABLE IF EXISTS transcript_batches CASCADE;
DROP TABLE IF EXISTS transcript_files CASCADE;
DROP TABLE IF EXISTS ai_document_results CASCADE;
DROP TABLE IF EXISTS semantic_edges CASCADE;
DROP TABLE IF EXISTS session_preps CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS longitudinal_records CASCADE;
DROP TABLE IF EXISTS job_queue CASCADE;
DROP TABLE IF EXISTS note_quality_scores CASCADE;

-- Success indicator
SELECT 'Schema reset complete - ready for fresh table creation' as status;
