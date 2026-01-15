-- Align therapeutic tables' ID columns with core schema (varchar IDs)
-- sessions.id, clients.id, users.id are varchar in shared/schema.ts

ALTER TABLE session_tags
  ALTER COLUMN session_id TYPE varchar USING session_id::text;

ALTER TABLE session_insights
  ALTER COLUMN session_id TYPE varchar USING session_id::text,
  ALTER COLUMN client_id TYPE varchar USING client_id::text,
  ALTER COLUMN therapist_id TYPE varchar USING therapist_id::text;

ALTER TABLE journey_synthesis
  ALTER COLUMN client_id TYPE varchar USING client_id::text,
  ALTER COLUMN therapist_id TYPE varchar USING therapist_id::text;

ALTER TABLE session_cross_references
  ALTER COLUMN source_session_id TYPE varchar USING source_session_id::text,
  ALTER COLUMN target_session_id TYPE varchar USING target_session_id::text;
