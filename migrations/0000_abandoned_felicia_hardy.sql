CREATE TABLE "ai_document_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"prompt_id" text NOT NULL,
	"model" text,
	"entities" jsonb,
	"extractions" jsonb,
	"summary" text,
	"recommendations" jsonb,
	"confidence" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_insights" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar,
	"therapist_id" varchar NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"is_read" boolean DEFAULT false,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alliance_scores" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"session_id" varchar,
	"therapist_id" varchar NOT NULL,
	"score" real NOT NULL,
	"factors" jsonb,
	"assessment_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" varchar NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"client_id" varchar,
	"ip_address" text NOT NULL,
	"user_agent" text,
	"session_id" text,
	"details" jsonb,
	"risk_level" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_conceptualizations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"therapist_id" varchar NOT NULL,
	"presenting" text NOT NULL,
	"predisposing" text NOT NULL,
	"precipitating" text NOT NULL,
	"perpetuating" text NOT NULL,
	"protective" text NOT NULL,
	"formulation" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"therapist_id" varchar NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"date_of_birth" timestamp,
	"emergency_contact" jsonb,
	"insurance" jsonb,
	"tags" text[] DEFAULT '{}',
	"clinical_considerations" text[] DEFAULT '{}',
	"preferred_modalities" text[] DEFAULT '{}',
	"status" text DEFAULT 'active' NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cross_references" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"note_id" varchar NOT NULL,
	"referenced_note_id" varchar NOT NULL,
	"relevance_score" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_text_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"version" integer NOT NULL,
	"raw_text" text,
	"cleaned_text" text,
	"method" text,
	"quality_score" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"therapist_id" varchar NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text NOT NULL,
	"file_path" text NOT NULL,
	"extracted_text" text,
	"embedding" real[],
	"tags" text[] DEFAULT '{}',
	"file_size" integer,
	"metadata" jsonb,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"therapist_id" varchar,
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
--> statement-breakpoint
CREATE TABLE "longitudinal_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"therapist_id" varchar NOT NULL,
	"record" jsonb NOT NULL,
	"analysis" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note_embeddings" (
	"id" varchar PRIMARY KEY NOT NULL,
	"note_id" varchar NOT NULL,
	"embedding" json,
	"content" text NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "progress_notes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"session_id" varchar,
	"therapist_id" varchar NOT NULL,
	"content" text,
	"session_date" timestamp NOT NULL,
	"tags" text[] DEFAULT '{}',
	"ai_tags" text[] DEFAULT '{}',
	"embedding" real[],
	"risk_level" text DEFAULT 'low',
	"progress_rating" integer,
	"quality_score" real,
	"quality_flags" jsonb,
	"status" text DEFAULT 'placeholder' NOT NULL,
	"is_placeholder" boolean DEFAULT true,
	"requires_manual_review" boolean DEFAULT false,
	"ai_confidence_score" real,
	"processing_notes" text,
	"original_document_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "semantic_edges" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"from" text NOT NULL,
	"to" text NOT NULL,
	"relation" text NOT NULL,
	"weight" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "session_preps" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"session_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"therapist_id" varchar NOT NULL,
	"prep" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"therapist_id" varchar NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"duration" integer DEFAULT 50 NOT NULL,
	"session_type" text NOT NULL,
	"status" text DEFAULT 'scheduled' NOT NULL,
	"google_event_id" text,
	"notes" text,
	"has_progress_note_placeholder" boolean DEFAULT false,
	"progress_note_status" text DEFAULT 'pending',
	"is_simple_practice_event" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transcript_batches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"therapist_id" varchar NOT NULL,
	"name" text NOT NULL,
	"total_files" integer NOT NULL,
	"processed_files" integer DEFAULT 0,
	"successful_files" integer DEFAULT 0,
	"failed_files" integer DEFAULT 0,
	"status" text DEFAULT 'uploading' NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "transcript_files" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" varchar NOT NULL,
	"therapist_id" varchar NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer,
	"file_path" text NOT NULL,
	"extracted_text" text,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"processing_status" text DEFAULT 'pending',
	"client_match_confidence" real,
	"suggested_client_id" varchar,
	"suggested_client_name" text,
	"alternative_matches" jsonb,
	"extracted_session_date" timestamp,
	"session_date_confidence" real,
	"session_date_source" text,
	"session_type" text DEFAULT 'individual',
	"ai_analysis" jsonb,
	"themes" text[] DEFAULT '{}',
	"risk_level" text DEFAULT 'low',
	"progress_rating" integer,
	"requires_manual_review" boolean DEFAULT false,
	"manual_review_reason" text,
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"manual_assignments" jsonb,
	"assigned_client_id" varchar,
	"assigned_session_date" timestamp,
	"assigned_session_type" text,
	"created_progress_note_id" varchar,
	"processing_notes" text,
	"error_details" text,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"assigned_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "treatment_plans" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"therapist_id" varchar NOT NULL,
	"diagnosis" text,
	"goals" jsonb NOT NULL,
	"interventions" text[] DEFAULT '{}',
	"frequency" text,
	"estimated_duration" integer,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'therapist' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_therapist_id_users_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alliance_scores" ADD CONSTRAINT "alliance_scores_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alliance_scores" ADD CONSTRAINT "alliance_scores_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alliance_scores" ADD CONSTRAINT "alliance_scores_therapist_id_users_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_conceptualizations" ADD CONSTRAINT "case_conceptualizations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_conceptualizations" ADD CONSTRAINT "case_conceptualizations_therapist_id_users_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_therapist_id_users_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_references" ADD CONSTRAINT "cross_references_note_id_progress_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."progress_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cross_references" ADD CONSTRAINT "cross_references_referenced_note_id_progress_notes_id_fk" FOREIGN KEY ("referenced_note_id") REFERENCES "public"."progress_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_text_versions" ADD CONSTRAINT "document_text_versions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_therapist_id_users_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_therapist_id_users_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "longitudinal_records" ADD CONSTRAINT "longitudinal_records_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "longitudinal_records" ADD CONSTRAINT "longitudinal_records_therapist_id_users_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_embeddings" ADD CONSTRAINT "note_embeddings_note_id_progress_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."progress_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_notes" ADD CONSTRAINT "progress_notes_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_notes" ADD CONSTRAINT "progress_notes_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_notes" ADD CONSTRAINT "progress_notes_therapist_id_users_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress_notes" ADD CONSTRAINT "progress_notes_original_document_id_documents_id_fk" FOREIGN KEY ("original_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_preps" ADD CONSTRAINT "session_preps_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_preps" ADD CONSTRAINT "session_preps_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_preps" ADD CONSTRAINT "session_preps_therapist_id_users_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_therapist_id_users_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_batches" ADD CONSTRAINT "transcript_batches_therapist_id_users_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_files" ADD CONSTRAINT "transcript_files_batch_id_transcript_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."transcript_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_files" ADD CONSTRAINT "transcript_files_therapist_id_users_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_files" ADD CONSTRAINT "transcript_files_suggested_client_id_clients_id_fk" FOREIGN KEY ("suggested_client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_files" ADD CONSTRAINT "transcript_files_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_files" ADD CONSTRAINT "transcript_files_assigned_client_id_clients_id_fk" FOREIGN KEY ("assigned_client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transcript_files" ADD CONSTRAINT "transcript_files_created_progress_note_id_progress_notes_id_fk" FOREIGN KEY ("created_progress_note_id") REFERENCES "public"."progress_notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treatment_plans" ADD CONSTRAINT "treatment_plans_therapist_id_users_id_fk" FOREIGN KEY ("therapist_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;