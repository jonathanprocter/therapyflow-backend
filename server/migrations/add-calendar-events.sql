-- Add calendar_events table for calendar integration
-- This table stores events from Google Calendar, SimplePractice, and TherapyFlow

CREATE TABLE IF NOT EXISTS calendar_events (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  therapist_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('google', 'simplepractice', 'therapyflow')),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  is_all_day BOOLEAN DEFAULT false,
  attendees TEXT[] DEFAULT '{}',
  linked_client_id VARCHAR REFERENCES clients(id) ON DELETE SET NULL,
  linked_session_id VARCHAR REFERENCES sessions(id) ON DELETE SET NULL,
  sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending_create', 'pending_update', 'pending_delete', 'error')),
  last_synced_at TIMESTAMP,
  sync_error TEXT,
  recurring_event_id TEXT,
  is_recurring BOOLEAN DEFAULT false,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_calendar_events_therapist ON calendar_events(therapist_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_external_id ON calendar_events(external_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_source ON calendar_events(source);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_end_time ON calendar_events(end_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_linked_client ON calendar_events(linked_client_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_linked_session ON calendar_events(linked_session_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_sync_status ON calendar_events(sync_status);

-- Create unique constraint on therapist_id + external_id + source to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_calendar_events_unique ON calendar_events(therapist_id, external_id, source);
