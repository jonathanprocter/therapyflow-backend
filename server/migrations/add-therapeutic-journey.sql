CREATE TABLE IF NOT EXISTS session_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  category TEXT NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]',
  confidence INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS session_tags_session_idx ON session_tags(session_id);
CREATE INDEX IF NOT EXISTS session_tags_category_idx ON session_tags(category);

CREATE TABLE IF NOT EXISTS session_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL,
  client_id UUID NOT NULL,
  therapist_id UUID NOT NULL,
  insight TEXT NOT NULL,
  insight_type TEXT NOT NULL,
  confidence INTEGER DEFAULT 0,
  related_sessions JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS session_insights_client_idx ON session_insights(client_id);
CREATE INDEX IF NOT EXISTS session_insights_type_idx ON session_insights(insight_type);

CREATE TABLE IF NOT EXISTS journey_synthesis (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL,
  therapist_id UUID NOT NULL,
  synthesis_date TIMESTAMP NOT NULL,
  time_range JSONB,
  dominant_themes JSONB,
  emotional_trajectory JSONB,
  progress_indicators JSONB,
  key_insights JSONB,
  coping_strategies JSONB,
  recommendations JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS journey_synthesis_client_idx ON journey_synthesis(client_id);
CREATE INDEX IF NOT EXISTS journey_synthesis_date_idx ON journey_synthesis(synthesis_date);

CREATE TABLE IF NOT EXISTS session_cross_references (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_session_id UUID NOT NULL,
  target_session_id UUID NOT NULL,
  reference_type TEXT NOT NULL,
  similarity INTEGER DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS cross_ref_source_idx ON session_cross_references(source_session_id);
CREATE INDEX IF NOT EXISTS cross_ref_target_idx ON session_cross_references(target_session_id);
