-- Voice Notes Migration
-- Adds support for voice notes attached to client sessions

-- Create voice_notes table
CREATE TABLE IF NOT EXISTS voice_notes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  therapist_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  session_id TEXT,
  audio_url TEXT,
  transcription TEXT NOT NULL,
  note_type TEXT DEFAULT 'follow_up' CHECK (note_type IN ('follow_up', 'reminder', 'observation', 'general')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'completed', 'archived')),
  tags TEXT[] DEFAULT '{}',
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT fk_voice_notes_therapist FOREIGN KEY (therapist_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_voice_notes_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  CONSTRAINT fk_voice_notes_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_voice_notes_therapist ON voice_notes(therapist_id);
CREATE INDEX IF NOT EXISTS idx_voice_notes_client ON voice_notes(client_id);
CREATE INDEX IF NOT EXISTS idx_voice_notes_session ON voice_notes(session_id);
CREATE INDEX IF NOT EXISTS idx_voice_notes_status ON voice_notes(status);
CREATE INDEX IF NOT EXISTS idx_voice_notes_created_at ON voice_notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voice_notes_priority ON voice_notes(priority);
CREATE INDEX IF NOT EXISTS idx_voice_notes_therapist_date ON voice_notes(therapist_id, created_at DESC);

-- Create index for daily summary queries (today's notes)
CREATE INDEX IF NOT EXISTS idx_voice_notes_daily_summary 
  ON voice_notes(therapist_id, created_at DESC) 
  WHERE status = 'pending';

-- Full-text search on transcription
CREATE INDEX IF NOT EXISTS idx_voice_notes_transcription_search 
  ON voice_notes USING gin(to_tsvector('english', transcription));

-- Add comment
COMMENT ON TABLE voice_notes IS 'Voice notes recorded by therapists for client sessions and follow-ups';
COMMENT ON COLUMN voice_notes.note_type IS 'Type of voice note: follow_up, reminder, observation, general';
COMMENT ON COLUMN voice_notes.priority IS 'Priority level: low, normal, high, urgent';
COMMENT ON COLUMN voice_notes.status IS 'Status: pending, reviewed, completed, archived';
COMMENT ON COLUMN voice_notes.tags IS 'Array of tags for categorization';
COMMENT ON COLUMN voice_notes.duration_seconds IS 'Duration of the voice recording in seconds';
