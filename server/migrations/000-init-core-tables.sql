-- Core Database Initialization
-- Creates all essential tables for TherapyFlow application
-- This migration matches the schema.ts definitions exactly
-- FIXED: Uses VARCHAR UUIDs instead of SERIAL integers

-- Users table (matches shared/schema.ts)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'therapist',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Clients table (matches shared/schema.ts)
CREATE TABLE IF NOT EXISTS clients (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  therapist_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  date_of_birth TIMESTAMP,
  emergency_contact JSONB,
  insurance JSONB,
  tags TEXT[] DEFAULT '{}',
  clinical_considerations TEXT[] DEFAULT '{}',
  preferred_modalities TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Sessions table (matches shared/schema.ts)
CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id VARCHAR NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  therapist_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMP NOT NULL,
  duration INTEGER NOT NULL DEFAULT 50,
  session_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  google_event_id TEXT,
  notes TEXT,
  has_progress_note_placeholder BOOLEAN DEFAULT false,
  progress_note_status TEXT DEFAULT 'pending',
  is_simple_practice_event BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Progress Notes table (matches shared/schema.ts)
CREATE TABLE IF NOT EXISTS progress_notes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  session_id VARCHAR REFERENCES sessions(id) ON DELETE CASCADE,
  client_id VARCHAR NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  therapist_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note_type TEXT DEFAULT 'SOAP',
  subjective TEXT,
  objective TEXT,
  assessment TEXT,
  plan TEXT,
  full_note TEXT,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Documents table (matches shared/schema.ts)
CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id VARCHAR REFERENCES clients(id) ON DELETE CASCADE,
  therapist_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  document_type TEXT,
  file_path TEXT,
  file_size INTEGER,
  mime_type TEXT,
  content TEXT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  extracted_text TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Treatment Plans table (matches shared/schema.ts)
CREATE TABLE IF NOT EXISTS treatment_plans (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id VARCHAR NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  therapist_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  goals TEXT,
  interventions TEXT,
  status TEXT DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Goals table (matches shared/schema.ts)
CREATE TABLE IF NOT EXISTS goals (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id VARCHAR NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  treatment_plan_id VARCHAR REFERENCES treatment_plans(id) ON DELETE CASCADE,
  goal_text TEXT NOT NULL,
  target_date DATE,
  status TEXT DEFAULT 'in_progress',
  progress INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Assessments table (matches shared/schema.ts)
CREATE TABLE IF NOT EXISTS assessments (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id VARCHAR NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  therapist_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assessment_type TEXT NOT NULL,
  assessment_date DATE NOT NULL,
  scores JSONB,
  interpretation TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Therapeutic Alliance table (matches shared/schema.ts)
CREATE TABLE IF NOT EXISTS therapeutic_alliance (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id VARCHAR NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  session_id VARCHAR REFERENCES sessions(id) ON DELETE CASCADE,
  alliance_score INTEGER CHECK (alliance_score >= 1 AND alliance_score <= 10),
  notes TEXT,
  assessment_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_clients_therapist ON clients(therapist_id);
CREATE INDEX IF NOT EXISTS idx_sessions_client ON sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_sessions_therapist ON sessions(therapist_id);
CREATE INDEX IF NOT EXISTS idx_sessions_scheduled_at ON sessions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_progress_notes_session ON progress_notes(session_id);
CREATE INDEX IF NOT EXISTS idx_progress_notes_client ON progress_notes(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_client ON documents(client_id);
CREATE INDEX IF NOT EXISTS idx_treatment_plans_client ON treatment_plans(client_id);
CREATE INDEX IF NOT EXISTS idx_goals_client ON goals(client_id);
CREATE INDEX IF NOT EXISTS idx_assessments_client ON assessments(client_id);
CREATE INDEX IF NOT EXISTS idx_therapeutic_alliance_client ON therapeutic_alliance(client_id);

-- Insert default therapist user if not exists
-- Note: You'll need to set a proper password hash
INSERT INTO users (username, password, name, email, role)
VALUES ('therapist', 'changeme', 'Default Therapist', 'therapist@therapyflow.com', 'therapist')
ON CONFLICT (email) DO NOTHING;
