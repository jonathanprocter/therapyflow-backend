ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "clinical_considerations" text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS "preferred_modalities" text[] DEFAULT '{}'::text[];

ALTER TABLE "progress_notes"
  ADD COLUMN IF NOT EXISTS "quality_score" real,
  ADD COLUMN IF NOT EXISTS "quality_flags" jsonb;

CREATE TABLE IF NOT EXISTS "job_runs" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "therapist_id" varchar REFERENCES "users"("id"),
  "type" text NOT NULL,
  "status" text NOT NULL,
  "payload" jsonb,
  "result" jsonb,
  "error" text,
  "retries" integer DEFAULT 0,
  "max_retries" integer DEFAULT 2,
  "is_dead" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "job_runs_status_idx" ON "job_runs"("status");
CREATE INDEX IF NOT EXISTS "job_runs_created_at_idx" ON "job_runs"("created_at" DESC);

CREATE TABLE IF NOT EXISTS "document_text_versions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id" varchar NOT NULL REFERENCES "documents"("id"),
  "version" integer NOT NULL,
  "raw_text" text,
  "cleaned_text" text,
  "method" text,
  "quality_score" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "document_text_versions_doc_id_idx" ON "document_text_versions"("document_id");
