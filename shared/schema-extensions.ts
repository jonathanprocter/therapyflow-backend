import { pgTable, text, jsonb, timestamp, boolean, integer, uuid, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const sessionTags = pgTable("session_tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").notNull(),
  category: text("category").notNull(),
  tags: jsonb("tags").notNull().$type<string[]>(),
  confidence: integer("confidence").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  sessionIdx: index("session_tags_session_idx").on(table.sessionId),
  categoryIdx: index("session_tags_category_idx").on(table.category),
}));

export const sessionInsights = pgTable("session_insights", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").notNull(),
  clientId: uuid("client_id").notNull(),
  therapistId: uuid("therapist_id").notNull(),
  insight: text("insight").notNull(),
  insightType: text("insight_type").notNull(),
  confidence: integer("confidence").default(0),
  relatedSessions: jsonb("related_sessions").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  clientIdx: index("session_insights_client_idx").on(table.clientId),
  typeIdx: index("session_insights_type_idx").on(table.insightType),
}));

export const journeySynthesis = pgTable("journey_synthesis", {
  id: uuid("id").defaultRandom().primaryKey(),
  clientId: uuid("client_id").notNull(),
  therapistId: uuid("therapist_id").notNull(),
  synthesisDate: timestamp("synthesis_date").notNull(),
  timeRange: jsonb("time_range").$type<{ start: Date; end: Date }>(),
  dominantThemes: jsonb("dominant_themes").$type<Record<string, any>>(),
  emotionalTrajectory: jsonb("emotional_trajectory").$type<any[]>(),
  progressIndicators: jsonb("progress_indicators").$type<Record<string, any>>(),
  keyInsights: jsonb("key_insights").$type<string[]>(),
  copingStrategies: jsonb("coping_strategies").$type<Record<string, any>>(),
  recommendations: jsonb("recommendations").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  clientIdx: index("journey_synthesis_client_idx").on(table.clientId),
  dateIdx: index("journey_synthesis_date_idx").on(table.synthesisDate),
}));

export const sessionCrossReferences = pgTable("session_cross_references", {
  id: uuid("id").defaultRandom().primaryKey(),
  sourceSessionId: uuid("source_session_id").notNull(),
  targetSessionId: uuid("target_session_id").notNull(),
  referenceType: text("reference_type").notNull(),
  similarity: integer("similarity").default(0),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  sourceIdx: index("cross_ref_source_idx").on(table.sourceSessionId),
  targetIdx: index("cross_ref_target_idx").on(table.targetSessionId),
}));

export type SessionTag = typeof sessionTags.$inferSelect;
export type InsertSessionTag = typeof sessionTags.$inferInsert;
export type SessionInsight = typeof sessionInsights.$inferSelect;
export type InsertSessionInsight = typeof sessionInsights.$inferInsert;
export type JourneySynthesis = typeof journeySynthesis.$inferSelect;
export type InsertJourneySynthesis = typeof journeySynthesis.$inferInsert;
export type SessionCrossReference = typeof sessionCrossReferences.$inferSelect;
export type InsertSessionCrossReference = typeof sessionCrossReferences.$inferInsert;
