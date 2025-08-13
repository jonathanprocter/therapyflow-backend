import { sql, relations } from "drizzle-orm";
import { 
  pgTable, 
  text, 
  varchar, 
  timestamp, 
  integer, 
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
