/**
 * Voice Notes Schema
 * Database schema for voice notes feature
 */

import { pgTable, text, timestamp, integer, jsonb } from 'drizzle-orm/pg-core';

export const voiceNotes = pgTable('voice_notes', {
  id: text('id').primaryKey().default('gen_random_uuid()'),
  therapistId: text('therapist_id').notNull(),
  clientId: text('client_id').notNull(),
  sessionId: text('session_id'),
  audioUrl: text('audio_url'),
  transcription: text('transcription').notNull(),
  noteType: text('note_type').default('follow_up'), // follow_up, reminder, observation, general
  priority: text('priority').default('normal'), // low, normal, high, urgent
  status: text('status').default('pending'), // pending, reviewed, completed, archived
  tags: text('tags').array().default([]),
  durationSeconds: integer('duration_seconds'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  metadata: jsonb('metadata').default({})
});

export type VoiceNote = typeof voiceNotes.$inferSelect;
export type NewVoiceNote = typeof voiceNotes.$inferInsert;
