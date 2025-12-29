CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb,
  updated_at timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id text PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  user_id text NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  client_id text,
  ip_address text NOT NULL,
  user_agent text,
  session_id text,
  details jsonb,
  risk_level text NOT NULL,
  timestamp timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_therapist_scheduled
  ON sessions (therapist_id, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_sessions_client
  ON sessions (client_id);

CREATE INDEX IF NOT EXISTS idx_progress_notes_session
  ON progress_notes (session_id);

CREATE INDEX IF NOT EXISTS idx_progress_notes_therapist_date
  ON progress_notes (therapist_id, session_date);

CREATE INDEX IF NOT EXISTS idx_documents_client
  ON documents (client_id);

CREATE INDEX IF NOT EXISTS idx_documents_therapist
  ON documents (therapist_id);

CREATE INDEX IF NOT EXISTS idx_transcript_files_status
  ON transcript_files (therapist_id, status);

CREATE INDEX IF NOT EXISTS idx_transcript_batches_therapist
  ON transcript_batches (therapist_id);
