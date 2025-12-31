-- Performance Optimization Indexes
-- Created: 2025-12-30
-- Purpose: Add indexes for frequently queried columns to improve performance
-- NOTE: Only includes indexes for tables/columns that exist in current schema

-- ============================================
-- CLIENTS TABLE INDEXES
-- ============================================

-- Index for therapist queries (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_clients_therapist_id 
ON clients(therapist_id) 
WHERE deleted_at IS NULL;

-- Index for client status queries
CREATE INDEX IF NOT EXISTS idx_clients_status 
ON clients(status) 
WHERE deleted_at IS NULL;

-- Composite index for therapist + status queries
CREATE INDEX IF NOT EXISTS idx_clients_therapist_status 
ON clients(therapist_id, status) 
WHERE deleted_at IS NULL;

-- Index for client name searches (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_clients_name_lower 
ON clients(LOWER(name));

-- ============================================
-- SESSIONS TABLE INDEXES
-- ============================================

-- Composite index for client + therapist queries
CREATE INDEX IF NOT EXISTS idx_sessions_client_therapist 
ON sessions(client_id, therapist_id);

-- Index for scheduled date queries (upcoming sessions, etc.)
CREATE INDEX IF NOT EXISTS idx_sessions_scheduled_at 
ON sessions(scheduled_at DESC);

-- Index for session status
CREATE INDEX IF NOT EXISTS idx_sessions_status 
ON sessions(status);

-- Composite index for therapist + date range queries
CREATE INDEX IF NOT EXISTS idx_sessions_therapist_date 
ON sessions(therapist_id, scheduled_at DESC);

-- Composite index for client + date range queries
CREATE INDEX IF NOT EXISTS idx_sessions_client_date 
ON sessions(client_id, scheduled_at DESC);

-- Index for Google Calendar sync
CREATE INDEX IF NOT EXISTS idx_sessions_google_event 
ON sessions(google_event_id) 
WHERE google_event_id IS NOT NULL;

-- Index for SimplePractice events
CREATE INDEX IF NOT EXISTS idx_sessions_simple_practice 
ON sessions(is_simple_practice_event) 
WHERE is_simple_practice_event = true;

-- ============================================
-- PROGRESS NOTES TABLE INDEXES
-- ============================================

-- Composite index for client + date queries
CREATE INDEX IF NOT EXISTS idx_progress_notes_client_date 
ON progress_notes(client_id, session_date DESC);

-- Index for therapist queries
CREATE INDEX IF NOT EXISTS idx_progress_notes_therapist 
ON progress_notes(therapist_id);

-- Index for session association
CREATE INDEX IF NOT EXISTS idx_progress_notes_session 
ON progress_notes(session_id) 
WHERE session_id IS NOT NULL;

-- Index for placeholder notes
CREATE INDEX IF NOT EXISTS idx_progress_notes_placeholder 
ON progress_notes(is_placeholder) 
WHERE is_placeholder = true;

-- Index for manual review queue
CREATE INDEX IF NOT EXISTS idx_progress_notes_manual_review 
ON progress_notes(requires_manual_review) 
WHERE requires_manual_review = true;

-- Index for note status
CREATE INDEX IF NOT EXISTS idx_progress_notes_status 
ON progress_notes(status);

-- Composite index for therapist + date range
CREATE INDEX IF NOT EXISTS idx_progress_notes_therapist_date 
ON progress_notes(therapist_id, session_date DESC);

-- Full-text search index for note content (PostgreSQL specific)
CREATE INDEX IF NOT EXISTS idx_progress_notes_content_fts 
ON progress_notes 
USING GIN(to_tsvector('english', content));

-- ============================================
-- DOCUMENTS TABLE INDEXES
-- ============================================

-- Index for client documents
CREATE INDEX IF NOT EXISTS idx_documents_client 
ON documents(client_id);

-- Index for therapist documents
CREATE INDEX IF NOT EXISTS idx_documents_therapist 
ON documents(therapist_id);

-- Composite index for client + upload date
CREATE INDEX IF NOT EXISTS idx_documents_client_uploaded 
ON documents(client_id, uploaded_at DESC);

-- Full-text search for document text (if extracted_text column exists)
CREATE INDEX IF NOT EXISTS idx_documents_text_fts 
ON documents 
USING GIN(to_tsvector('english', extracted_text))
WHERE extracted_text IS NOT NULL;

-- ============================================
-- SESSION PREPS TABLE INDEXES
-- ============================================

-- Index for session preps
CREATE INDEX IF NOT EXISTS idx_session_preps_session 
ON session_preps(session_id);

-- Composite index for session + created date
CREATE INDEX IF NOT EXISTS idx_session_preps_session_created 
ON session_preps(session_id, created_at DESC);

-- ============================================
-- LONGITUDINAL RECORDS TABLE INDEXES
-- ============================================

-- Composite index for client + date
CREATE INDEX IF NOT EXISTS idx_longitudinal_records_client_date 
ON longitudinal_records(client_id, created_at DESC);

-- Index for therapist records
CREATE INDEX IF NOT EXISTS idx_longitudinal_records_therapist 
ON longitudinal_records(therapist_id);

-- ============================================
-- DISABLED INDEXES (tables/columns don't exist yet)
-- ============================================

-- AI INSIGHTS TABLE - Table doesn't exist yet
-- CREATE INDEX IF NOT EXISTS idx_ai_insights_therapist ON ai_insights(therapist_id);
-- CREATE INDEX IF NOT EXISTS idx_ai_insights_read ON ai_insights(read) WHERE read = false;
-- CREATE INDEX IF NOT EXISTS idx_ai_insights_therapist_unread ON ai_insights(therapist_id, created_at DESC) WHERE read = false;

-- CASE CONCEPTUALIZATIONS TABLE - Table doesn't exist yet
-- CREATE INDEX IF NOT EXISTS idx_case_conceptualizations_client ON case_conceptualizations(client_id);
-- CREATE INDEX IF NOT EXISTS idx_case_conceptualizations_therapist ON case_conceptualizations(therapist_id);

-- TREATMENT PLANS TABLE - Table doesn't exist yet
-- CREATE INDEX IF NOT EXISTS idx_treatment_plans_client ON treatment_plans(client_id);
-- CREATE INDEX IF NOT EXISTS idx_treatment_plans_therapist ON treatment_plans(therapist_id);

-- ALLIANCE SCORES TABLE - Table doesn't exist yet
-- CREATE INDEX IF NOT EXISTS idx_alliance_scores_client_date ON alliance_scores(client_id, session_date DESC);
-- CREATE INDEX IF NOT EXISTS idx_alliance_scores_therapist ON alliance_scores(therapist_id);

-- JOB RUNS TABLE - Table doesn't exist yet
-- CREATE INDEX IF NOT EXISTS idx_job_runs_status ON job_runs(status);
-- CREATE INDEX IF NOT EXISTS idx_job_runs_therapist_status ON job_runs(therapist_id, status) WHERE therapist_id IS NOT NULL;
-- CREATE INDEX IF NOT EXISTS idx_job_runs_started ON job_runs(started_at DESC);

-- TRANSCRIPT BATCHES TABLE - Table doesn't exist yet
-- CREATE INDEX IF NOT EXISTS idx_transcript_batches_therapist ON transcript_batches(therapist_id);
-- CREATE INDEX IF NOT EXISTS idx_transcript_batches_status ON transcript_batches(status);

-- TRANSCRIPT FILES TABLE - Table doesn't exist yet
-- CREATE INDEX IF NOT EXISTS idx_transcript_files_batch ON transcript_files(batch_id);
-- CREATE INDEX IF NOT EXISTS idx_transcript_files_status ON transcript_files(status);
-- CREATE INDEX IF NOT EXISTS idx_transcript_files_therapist_status ON transcript_files(therapist_id, status);
-- CREATE INDEX IF NOT EXISTS idx_transcript_files_client ON transcript_files(client_id) WHERE client_id IS NOT NULL;

-- DOCUMENTS TABLE - status column doesn't exist
-- CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
-- CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);

-- ============================================
-- PERFORMANCE NOTES
-- ============================================

-- These indexes are designed to optimize the most common query patterns:
-- 1. Fetching all data for a specific therapist
-- 2. Fetching data for a specific client
-- 3. Date range queries (recent sessions, notes, etc.)
-- 4. Status-based filtering (pending, completed, etc.)
-- 5. Full-text search in notes and documents

-- Monitor index usage with:
-- SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public';

-- Check index size:
-- SELECT indexrelname, pg_size_pretty(pg_relation_size(indexrelid)) 
-- FROM pg_stat_user_indexes 
-- WHERE schemaname = 'public' 
-- ORDER BY pg_relation_size(indexrelid) DESC;
