import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const conversionStatusEnum = pgEnum("conversion_status", ["pending", "completed", "failed"]);

export const conversionsTable = pgTable("conversions", {
  id: serial("id").primaryKey(),
  originalFilename: text("original_filename").notNull(),
  originalFormat: text("original_format").notNull(),
  targetFormat: text("target_format").notNull(),
  status: conversionStatusEnum("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  convertedFileSizeBytes: integer("converted_file_size_bytes"),
  cloudObjectPath: text("cloud_object_path"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export type Conversion = typeof conversionsTable.$inferSelect;
export type InsertConversion = typeof conversionsTable.$inferInsert;
