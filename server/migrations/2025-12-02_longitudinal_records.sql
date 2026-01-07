CREATE TABLE IF NOT EXISTS "longitudinal_records" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" varchar NOT NULL REFERENCES "clients"("id"),
  "therapist_id" varchar NOT NULL REFERENCES "users"("id"),
  "record" jsonb NOT NULL,
  "analysis" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "longitudinal_records_client_id_idx" ON "longitudinal_records"("client_id");
CREATE INDEX IF NOT EXISTS "longitudinal_records_therapist_id_idx" ON "longitudinal_records"("therapist_id");
CREATE INDEX IF NOT EXISTS "longitudinal_records_created_at_idx" ON "longitudinal_records"("created_at" DESC);
