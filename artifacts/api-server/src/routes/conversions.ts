import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { eq, desc, count, sql } from "drizzle-orm";
import { db, conversionsTable } from "@workspace/db";
import {
  GetConversionParams,
  DeleteConversionParams,
} from "@workspace/api-zod";
import { convertFile } from "../lib/converter";

const router: IRouter = Router();

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const UPLOADS_DIR = path.resolve(workspaceRoot, "artifacts/api-server/uploads");
const OUTPUTS_DIR = path.resolve(workspaceRoot, "artifacts/api-server/outputs");
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".docx" || ext === ".pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only .docx and .pdf files are supported"));
    }
  },
});

router.get("/conversions", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(conversionsTable)
    .orderBy(desc(conversionsTable.createdAt));
  res.json(rows.map(toResponse));
});

router.post("/conversions", upload.single("file"), async (req, res): Promise<void> => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const { targetFormat } = req.body as { targetFormat?: string };
  if (targetFormat !== "pdf" && targetFormat !== "docx") {
    await safeUnlink(file.path);
    res.status(400).json({ error: "targetFormat must be 'pdf' or 'docx'" });
    return;
  }

  const originalExt = path.extname(file.originalname).toLowerCase().replace(".", "");
  if (originalExt === targetFormat) {
    await safeUnlink(file.path);
    res.status(400).json({ error: `File is already a .${targetFormat} file` });
    return;
  }

  const [conversion] = await db
    .insert(conversionsTable)
    .values({
      originalFilename: file.originalname,
      originalFormat: originalExt,
      targetFormat,
      status: "pending",
      fileSizeBytes: file.size,
    })
    .returning();

  const outputDir = path.join(OUTPUTS_DIR, String(conversion.id));

  let renamedPath: string | null = null;

  try {
    await fs.mkdir(outputDir, { recursive: true });

    renamedPath = path.join(UPLOADS_DIR, `${conversion.id}_${file.originalname}`);
    await fs.rename(file.path, renamedPath);

    const result = await convertFile(renamedPath, targetFormat, outputDir);

    const [updated] = await db
      .update(conversionsTable)
      .set({
        status: "completed",
        convertedFileSizeBytes: result.fileSizeBytes,
        completedAt: new Date(),
      })
      .where(eq(conversionsTable.id, conversion.id))
      .returning();

    res.status(201).json(toResponse(updated));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Conversion failed";
    req.log.error({ err: message, conversionId: conversion.id }, "Conversion error");

    const [updated] = await db
      .update(conversionsTable)
      .set({ status: "failed", errorMessage: message, completedAt: new Date() })
      .where(eq(conversionsTable.id, conversion.id))
      .returning();

    res.status(201).json(toResponse(updated));
  } finally {
    if (renamedPath) await safeUnlink(renamedPath);
  }
});

router.get("/conversions/stats", async (_req, res): Promise<void> => {
  const [totals] = await db
    .select({
      totalConversions: count(),
      successCount: sql<number>`count(*) filter (where ${conversionsTable.status} = 'completed')`,
      failureCount: sql<number>`count(*) filter (where ${conversionsTable.status} = 'failed')`,
      docxToPdfCount: sql<number>`count(*) filter (where ${conversionsTable.originalFormat} = 'docx' and ${conversionsTable.targetFormat} = 'pdf')`,
      pdfToDocxCount: sql<number>`count(*) filter (where ${conversionsTable.originalFormat} = 'pdf' and ${conversionsTable.targetFormat} = 'docx')`,
      totalBytesProcessed: sql<number>`coalesce(sum(${conversionsTable.fileSizeBytes}), 0)`,
    })
    .from(conversionsTable);

  res.json({
    totalConversions: Number(totals.totalConversions),
    successCount: Number(totals.successCount),
    failureCount: Number(totals.failureCount),
    docxToPdfCount: Number(totals.docxToPdfCount),
    pdfToDocxCount: Number(totals.pdfToDocxCount),
    totalBytesProcessed: Number(totals.totalBytesProcessed),
  });
});

router.get("/conversions/:id", async (req, res): Promise<void> => {
  const params = GetConversionParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [conversion] = await db
    .select()
    .from(conversionsTable)
    .where(eq(conversionsTable.id, params.data.id));

  if (!conversion) {
    res.status(404).json({ error: "Conversion not found" });
    return;
  }

  res.json(toResponse(conversion));
});

router.get("/conversions/:id/download", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);

  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [conversion] = await db
    .select()
    .from(conversionsTable)
    .where(eq(conversionsTable.id, id));

  if (!conversion || conversion.status !== "completed") {
    res.status(404).json({ error: "Converted file not found" });
    return;
  }

  const outputDir = path.join(OUTPUTS_DIR, String(id));
  const originalBase = path.basename(conversion.originalFilename, path.extname(conversion.originalFilename));
  const outputFilename = `${id}_${originalBase}.${conversion.targetFormat}`;
  const filePath = path.join(outputDir, outputFilename);

  try {
    await fs.access(filePath);
  } catch {
    res.status(404).json({ error: "Output file not found on disk" });
    return;
  }

  const downloadName = `${path.basename(conversion.originalFilename, path.extname(conversion.originalFilename))}.${conversion.targetFormat}`;

  res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
  res.setHeader("Content-Type", conversion.targetFormat === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.sendFile(filePath);
});

router.delete("/conversions/:id", async (req, res): Promise<void> => {
  const params = DeleteConversionParams.safeParse({ id: req.params.id });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [conversion] = await db
    .delete(conversionsTable)
    .where(eq(conversionsTable.id, params.data.id))
    .returning();

  if (!conversion) {
    res.status(404).json({ error: "Conversion not found" });
    return;
  }

  const outputDir = path.join(OUTPUTS_DIR, String(params.data.id));
  await safeRmdir(outputDir);

  res.sendStatus(204);
});

function toResponse(c: typeof conversionsTable.$inferSelect) {
  return {
    id: c.id,
    originalFilename: c.originalFilename,
    originalFormat: c.originalFormat,
    targetFormat: c.targetFormat,
    status: c.status,
    errorMessage: c.errorMessage ?? null,
    fileSizeBytes: c.fileSizeBytes,
    convertedFileSizeBytes: c.convertedFileSizeBytes ?? null,
    createdAt: c.createdAt.toISOString(),
    completedAt: c.completedAt?.toISOString() ?? null,
  };
}

async function safeUnlink(p: string) {
  try { await fs.unlink(p); } catch { /* ignore */ }
}

async function safeRmdir(p: string) {
  try { await fs.rm(p, { recursive: true, force: true }); } catch { /* ignore */ }
}

export default router;
