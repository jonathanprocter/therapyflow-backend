import { sql, relations } from "drizzle-orm";
import { 
  pgTable, 
  text, 
  varchar, 
  timestamp, 
  integer, 
  json,
  jsonb, 
  real,
  boolean,
  uuid
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table (therapists/clinicians)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull().default("therapist"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Clients table
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  therapistId: varchar("therapist_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  dateOfBirth: timestamp("date_of_birth"),
  emergencyContact: jsonb("emergency_contact"), // {name, phone, relationship}
  insurance: jsonb("insurance"), // {provider, policyNumber, groupNumber}
  tags: text("tags").array().default([]),
  status: text("status").notNull().default("active"), // active, inactive, discharged
  deletedAt: timestamp("deleted_at"), // Track when client was soft-deleted
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Sessions table
export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  therapistId: varchar("therapist_id").notNull().references(() => users.id),
  scheduledAt: timestamp("scheduled_at").notNull(),
  duration: integer("duration").notNull().default(50), // minutes
  sessionType: text("session_type").notNull(), // individual, couples, family, group
  status: text("status").notNull().default("scheduled"), // scheduled, completed, cancelled, no-show
  googleEventId: text("google_event_id"), // for calendar sync
  notes: text("notes"),
  hasProgressNotePlaceholder: boolean("has_progress_note_placeholder").default(false),
  progressNoteStatus: text("progress_note_status").default("pending"), // pending, uploaded, processed, needs_review
  isSimplePracticeEvent: boolean("is_simple_practice_event").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Progress Notes table
export const progressNotes = pgTable("progress_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  sessionId: varchar("session_id").references(() => sessions.id),
  therapistId: varchar("therapist_id").notNull().references(() => users.id),
  content: text("content"), // Made nullable for placeholders
  sessionDate: timestamp("session_date").notNull(),
  tags: text("tags").array().default([]),
  aiTags: text("ai_tags").array().default([]),
  embedding: real("embedding").array(), // for semantic search
  riskLevel: text("risk_level").default("low"), // low, moderate, high, critical
  progressRating: integer("progress_rating"), // 1-10 scale
  status: text("status").notNull().default("placeholder"), // placeholder, uploaded, processed, manual_review, completed
  isPlaceholder: boolean("is_placeholder").default(true),
  requiresManualReview: boolean("requires_manual_review").default(false),
  aiConfidenceScore: real("ai_confidence_score"), // AI processing confidence
  processingNotes: text("processing_notes"), // AI processing details
  originalDocumentId: varchar("original_document_id").references(() => documents.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Case Conceptualization (5 P's Framework)
export const caseConceptualizations = pgTable("case_conceptualizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  therapistId: varchar("therapist_id").notNull().references(() => users.id),
  presenting: text("presenting").notNull(), // Presenting problems
  predisposing: text("predisposing").notNull(), // Predisposing factors
  precipitating: text("precipitating").notNull(), // Precipitating factors
  perpetuating: text("perpetuating").notNull(), // Perpetuating factors
  protective: text("protective").notNull(), // Protective factors
  formulation: text("formulation"), // Overall formulation
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Treatment Plans
export const treatmentPlans = pgTable("treatment_plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  therapistId: varchar("therapist_id").notNull().references(() => users.id),
  diagnosis: text("diagnosis"),
  goals: jsonb("goals").notNull(), // Array of {id, description, targetDate, status, progress}
  interventions: text("interventions").array().default([]),
  frequency: text("frequency"), // weekly, biweekly, monthly
  estimatedDuration: integer("estimated_duration"), // number of sessions
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Therapeutic Alliance Scores
export const allianceScores = pgTable("alliance_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  sessionId: varchar("session_id").references(() => sessions.id),
  therapistId: varchar("therapist_id").notNull().references(() => users.id),
  score: real("score").notNull(), // 1-10 scale
  factors: jsonb("factors"), // {trust, rapport, collaboration, etc.}
  assessmentDate: timestamp("assessment_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Clinical Documents
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  therapistId: varchar("therapist_id").notNull().references(() => users.id),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  filePath: text("file_path").notNull(),
  extractedText: text("extracted_text"),
  embedding: real("embedding").array(),
  tags: text("tags").array().default([]),
  fileSize: integer("file_size"),
  metadata: jsonb("metadata"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

// Cross References between notes
export const crossReferences = pgTable("cross_references", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  noteId: varchar("note_id").notNull().references(() => progressNotes.id),
  referencedNoteId: varchar("referenced_note_id").notNull().references(() => progressNotes.id),
  relevanceScore: real("relevance_score").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// AI Insights
export const aiInsights = pgTable("ai_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").references(() => clients.id),
  therapistId: varchar("therapist_id").notNull().references(() => users.id),
  type: text("type").notNull(), // pattern_recognition, progress_milestone, risk_alert, resource_match
  title: text("title").notNull(),
  description: text("description").notNull(),
  priority: text("priority").notNull().default("medium"), // low, medium, high, urgent
  isRead: boolean("is_read").default(false),
  metadata: jsonb("metadata"), // Additional context data
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Bulk Transcript Upload Batches
export const transcriptBatches = pgTable("transcript_batches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  therapistId: varchar("therapist_id").notNull().references(() => users.id),
  name: text("name").notNull(), // User-provided batch name
  totalFiles: integer("total_files").notNull(),
  processedFiles: integer("processed_files").default(0),
  successfulFiles: integer("successful_files").default(0),
  failedFiles: integer("failed_files").default(0),
  status: text("status").notNull().default("uploading"), // uploading, processing, completed, failed
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
  completedAt: timestamp("completed_at"),
});

// Individual Transcript Files
export const transcriptFiles = pgTable("transcript_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchId: varchar("batch_id").notNull().references(() => transcriptBatches.id),
  therapistId: varchar("therapist_id").notNull().references(() => users.id),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  filePath: text("file_path").notNull(), // Object storage path
  extractedText: text("extracted_text"),
  status: text("status").notNull().default("uploaded"), // uploaded, processing, processed, failed, assigned
  processingStatus: text("processing_status").default("pending"), // pending, extracting_text, analyzing, matching_client, creating_note, completed, failed
  
  // AI Processing Results
  clientMatchConfidence: real("client_match_confidence"), // 0-1 confidence score
  suggestedClientId: varchar("suggested_client_id").references(() => clients.id),
  suggestedClientName: text("suggested_client_name"),
  alternativeMatches: jsonb("alternative_matches"), // Array of {clientId, name, confidence}
  
  // Session Date Extraction
  extractedSessionDate: timestamp("extracted_session_date"),
  sessionDateConfidence: real("session_date_confidence"),
  sessionDateSource: text("session_date_source"), // "filename", "content", "manual"
  
  // Content Analysis
  sessionType: text("session_type").default("individual"), // individual, couples, session without patient present
  aiAnalysis: jsonb("ai_analysis"), // Full AI analysis results
  themes: text("themes").array().default([]),
  riskLevel: text("risk_level").default("low"),
  progressRating: integer("progress_rating"), // 1-10 scale
  
  // Manual Review
  requiresManualReview: boolean("requires_manual_review").default(false),
  manualReviewReason: text("manual_review_reason"),
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  manualAssignments: jsonb("manual_assignments"), // Manual overrides
  
  // Final Assignment
  assignedClientId: varchar("assigned_client_id").references(() => clients.id),
  assignedSessionDate: timestamp("assigned_session_date"),
  assignedSessionType: text("assigned_session_type"),
  createdProgressNoteId: varchar("created_progress_note_id").references(() => progressNotes.id),
  
  // Metadata
  processingNotes: text("processing_notes"),
  errorDetails: text("error_details"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
  assignedAt: timestamp("assigned_at"),
});

// CareNotesAI Document Processing Pipeline Tables
export const aiDocumentResults = pgTable("ai_document_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull(),
  promptId: text("prompt_id").notNull(), // 'care_notes_v1'
  model: text("model"),
  entities: jsonb("entities"),
  extractions: jsonb("extractions"),
  summary: text("summary"),
  recommendations: jsonb("recommendations"),
  confidence: integer("confidence"), // 0-100 for convenience
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const semanticEdges = pgTable("semantic_edges", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull(),
  from: text("from").notNull(), // e.g., symptom:insomnia
  to: text("to").notNull(),     // e.g., recommendation:CBT-I
  relation: text("relation").notNull(),
  weight: integer("weight"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  clients: many(clients),
  sessions: many(sessions),
  progressNotes: many(progressNotes),
  treatmentPlans: many(treatmentPlans),
  caseConceptualizations: many(caseConceptualizations),
  allianceScores: many(allianceScores),
  documents: many(documents),
  aiInsights: many(aiInsights),
  transcriptBatches: many(transcriptBatches),
  transcriptFiles: many(transcriptFiles),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  therapist: one(users, {
    fields: [clients.therapistId],
    references: [users.id],
  }),
  sessions: many(sessions),
  progressNotes: many(progressNotes),
  treatmentPlans: many(treatmentPlans),
  caseConceptualizations: many(caseConceptualizations),
  allianceScores: many(allianceScores),
  documents: many(documents),
  aiInsights: many(aiInsights),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  client: one(clients, {
    fields: [sessions.clientId],
    references: [clients.id],
  }),
  therapist: one(users, {
    fields: [sessions.therapistId],
    references: [users.id],
  }),
  progressNotes: many(progressNotes),
  allianceScores: many(allianceScores),
}));

export const progressNotesRelations = relations(progressNotes, ({ one, many }) => ({
  client: one(clients, {
    fields: [progressNotes.clientId],
    references: [clients.id],
  }),
  session: one(sessions, {
    fields: [progressNotes.sessionId],
    references: [sessions.id],
  }),
  therapist: one(users, {
    fields: [progressNotes.therapistId],
    references: [users.id],
  }),
  references: many(crossReferences, {
    relationName: "noteReferences",
  }),
  referencedBy: many(crossReferences, {
    relationName: "referencedNotes",
  }),
}));

export const crossReferencesRelations = relations(crossReferences, ({ one }) => ({
  note: one(progressNotes, {
    fields: [crossReferences.noteId],
    references: [progressNotes.id],
    relationName: "noteReferences",
  }),
  referencedNote: one(progressNotes, {
    fields: [crossReferences.referencedNoteId],
    references: [progressNotes.id],
    relationName: "referencedNotes",
  }),
}));

export const transcriptBatchesRelations = relations(transcriptBatches, ({ one, many }) => ({
  therapist: one(users, {
    fields: [transcriptBatches.therapistId],
    references: [users.id],
  }),
  files: many(transcriptFiles),
}));

export const transcriptFilesRelations = relations(transcriptFiles, ({ one }) => ({
  batch: one(transcriptBatches, {
    fields: [transcriptFiles.batchId],
    references: [transcriptBatches.id],
  }),
  therapist: one(users, {
    fields: [transcriptFiles.therapistId],
    references: [users.id],
  }),
  suggestedClient: one(clients, {
    fields: [transcriptFiles.suggestedClientId],
    references: [clients.id],
  }),
  assignedClient: one(clients, {
    fields: [transcriptFiles.assignedClientId],
    references: [clients.id],
  }),
  createdProgressNote: one(progressNotes, {
    fields: [transcriptFiles.createdProgressNoteId],
    references: [progressNotes.id],
  }),
  reviewedByUser: one(users, {
    fields: [transcriptFiles.reviewedBy],
    references: [users.id],
  }),
}));

// Audit Logs for HIPAA Compliance
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().$defaultFn(() => nanoid()),
  userId: varchar("user_id").notNull(),
  action: varchar("action", { length: 50 }).notNull(),
  resourceType: varchar("resource_type", { length: 20 }).notNull(),
  resourceId: varchar("resource_id"),
  clientId: varchar("client_id"),
  ipAddress: varchar("ip_address", { length: 45 }).notNull(),
  userAgent: text("user_agent"),
  sessionId: varchar("session_id"),
  details: json("details"),
  riskLevel: varchar("risk_level", { length: 10 }).notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Note Embeddings for Semantic Search
export const noteEmbeddings = pgTable("note_embeddings", {
  id: varchar("id").primaryKey().$defaultFn(() => nanoid()),
  noteId: varchar("note_id").notNull().references(() => progressNotes.id, { onDelete: "cascade" }),
  embedding: json("embedding"), // Vector embedding for semantic search
  content: text("content").notNull(), // Cached content for search
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSessionSchema = createInsertSchema(sessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProgressNoteSchema = createInsertSchema(progressNotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCaseConceptualizationSchema = createInsertSchema(caseConceptualizations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTreatmentPlanSchema = createInsertSchema(treatmentPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAllianceScoreSchema = createInsertSchema(allianceScores).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  uploadedAt: true,
});

export const insertAiInsightSchema = createInsertSchema(aiInsights).omit({
  id: true,
  createdAt: true,
});

export const insertTranscriptBatchSchema = createInsertSchema(transcriptBatches).omit({
  id: true,
  uploadedAt: true,
});

export const insertTranscriptFileSchema = createInsertSchema(transcriptFiles).omit({
  id: true,
  uploadedAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;

export type InsertProgressNote = z.infer<typeof insertProgressNoteSchema>;
export type ProgressNote = typeof progressNotes.$inferSelect;

export type InsertCaseConceptualization = z.infer<typeof insertCaseConceptualizationSchema>;
export type CaseConceptualization = typeof caseConceptualizations.$inferSelect;

export type InsertTreatmentPlan = z.infer<typeof insertTreatmentPlanSchema>;
export type TreatmentPlan = typeof treatmentPlans.$inferSelect;

export type InsertAllianceScore = z.infer<typeof insertAllianceScoreSchema>;
export type AllianceScore = typeof allianceScores.$inferSelect;

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export type InsertAiInsight = z.infer<typeof insertAiInsightSchema>;
export type AiInsight = typeof aiInsights.$inferSelect;

export type InsertTranscriptBatch = z.infer<typeof insertTranscriptBatchSchema>;
export type TranscriptBatch = typeof transcriptBatches.$inferSelect;

export type InsertTranscriptFile = z.infer<typeof insertTranscriptFileSchema>;
export type TranscriptFile = typeof transcriptFiles.$inferSelect;
