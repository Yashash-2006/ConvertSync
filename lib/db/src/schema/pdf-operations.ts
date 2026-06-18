import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const pdfOperationStatusEnum = pgEnum("pdf_operation_status", ["pending", "completed", "failed"]);
export const pdfOperationTypeEnum = pgEnum("pdf_operation_type", ["merge", "split", "compress", "protect"]);

export const pdfOperationsTable = pgTable("pdf_operations", {
  id: serial("id").primaryKey(),
  operationType: pdfOperationTypeEnum("operation_type").notNull(),
  status: pdfOperationStatusEnum("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  originalFilenames: text("original_filenames").notNull(), // JSON array of filenames
  resultFilename: text("result_filename"),
  fileSizeBytes: integer("file_size_bytes"),
  resultFileSizeBytes: integer("result_file_size_bytes"),
  cloudObjectPath: text("cloud_object_path"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export type PdfOperation = typeof pdfOperationsTable.$inferSelect;
export type InsertPdfOperation = typeof pdfOperationsTable.$inferInsert;
