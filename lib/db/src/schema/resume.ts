import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const resumesTable = pgTable("resumes", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  filePath: text("file_path").notNull(),
  fileContent: text("file_content"),
  fileSize: integer("file_size"),
  mimeType: text("mime_type"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const analysisResultsTable = pgTable("analysis_results", {
  id: serial("id").primaryKey(),
  resumeId: integer("resume_id").notNull().references(() => resumesTable.id),
  overallScore: integer("overall_score").notNull(),
  contentScore: integer("content_score").notNull(),
  sectionScore: integer("section_score").notNull(),
  atsScore: integer("ats_score").notNull(),
  tailoringScore: integer("tailoring_score").notNull(),
  parseRate: integer("parse_rate").notNull(),
  issuesJson: jsonb("issues_json").$type<Array<{type: string; message: string; severity: string}>>().notNull().default([]),
  suggestionsJson: jsonb("suggestions_json").$type<string[]>().notNull().default([]),
  missingSectionsJson: jsonb("missing_sections_json").$type<string[]>().notNull().default([]),
  metricsCount: integer("metrics_count").notNull().default(0),
  weakBulletsJson: jsonb("weak_bullets_json").$type<string[]>().notNull().default([]),
  strongBulletsJson: jsonb("strong_bullets_json").$type<string[]>().notNull().default([]),
  parsedDataJson: jsonb("parsed_data_json").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertResumeSchema = createInsertSchema(resumesTable).omit({ id: true, createdAt: true });
export const insertAnalysisSchema = createInsertSchema(analysisResultsTable).omit({ id: true, createdAt: true });

export type Resume = typeof resumesTable.$inferSelect;
export type InsertResume = z.infer<typeof insertResumeSchema>;
export type AnalysisResult = typeof analysisResultsTable.$inferSelect;
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
