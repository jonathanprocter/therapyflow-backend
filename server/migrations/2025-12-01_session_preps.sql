CREATE TABLE IF NOT EXISTS session_preps (
  id text PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  session_id text NOT NULL REFERENCES sessions(id),
  client_id text NOT NULL REFERENCES clients(id),
  therapist_id text NOT NULL REFERENCES users(id),
  prep jsonb NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_preps_session
  ON session_preps (session_id);

CREATE INDEX IF NOT EXISTS idx_session_preps_client
  ON session_preps (client_id);

CREATE INDEX IF NOT EXISTS idx_session_preps_therapist
  ON session_preps (therapist_id);
