import { createInsertSchema } from "drizzle-zod";
import {
  doublePrecision,
  integer,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const vocabularyTable = pgTable("vocabulary", {
  id: text("id").primaryKey(),
  term: text("term").notNull(),
  type: text("type").notNull(),
  meaning: text("meaning").notNull(),
  partOfSpeech: text("part_of_speech"),
  pronunciation: text("pronunciation"),
  example: text("example").notNull(),
  translation: text("translation"),
  urduMeaning: text("urdu_meaning"),
  notes: text("notes"),
  tags: text("tags").array().notNull().default([]),
  intervalDays: doublePrecision("interval_days").notNull().default(0),
  easeFactor: doublePrecision("ease_factor").notNull().default(2.5),
  repetitions: integer("repetitions").notNull().default(0),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull().defaultNow(),
  lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  source: text("source").notNull().default("manual"),
});

export const reviewEventsTable = pgTable("review_events", {
  id: text("id").primaryKey(),
  vocabularyId: text("vocabulary_id")
    .notNull()
    .references(() => vocabularyTable.id, { onDelete: "cascade" }),
  rating: text("rating").notNull(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertVocabularySchema = createInsertSchema(vocabularyTable).omit({
  id: true,
  intervalDays: true,
  easeFactor: true,
  repetitions: true,
  dueAt: true,
  lastReviewedAt: true,
  createdAt: true,
});

export type InsertVocabulary = z.infer<typeof insertVocabularySchema>;
export type Vocabulary = typeof vocabularyTable.$inferSelect;
export type ReviewEvent = typeof reviewEventsTable.$inferSelect;