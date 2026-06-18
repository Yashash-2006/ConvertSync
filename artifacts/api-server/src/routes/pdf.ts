import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { eq, desc } from "drizzle-orm";
import { db, pdfOperationsTable } from "@workspace/db";
import { mergePdfs, splitPdf, compressPdf, protectPdf } from "../lib/pdf-ops";
import { uploadConvertedFile, streamCloudFile, deleteCloudFile } from "../lib/cloudStorage";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const UPLOADS_DIR = path.resolve(workspaceRoot, "artifacts/api-server/uploads");
const PDF_OPS_DIR = path.resolve(workspaceRoot, "artifacts/api-server/pdf-ops");
const MAX_FILE_SIZE = 100 * 1024 * 1024;

const upload = multer({
  dest: UPLOADS_DIR,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are supported"));
    }
  },
});

// ─── List ──────────────────────────────────────────────────────────────────

router.get("/pdf", async (req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(pdfOperationsTable)
    .orderBy(desc(pdfOperationsTable.createdAt));
  res.json(rows.map(toResponse));
});

// ─── Merge ─────────────────────────────────────────────────────────────────

router.post("/pdf/merge", upload.array("files"), async (req, res): Promise<void> => {
  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length < 2) {
    if (files) await Promise.all(files.map((f) => safeUnlink(f.path)));
    res.status(400).json({ error: "At least 2 PDF files are required" });
    return;
  }

  const record = await db
    .insert(pdfOperationsTable)
    .values({
      operationType: "merge",
      status: "pending",
      originalFilenames: JSON.stringify(files.map((f) => f.originalname)),
      fileSizeBytes: files.reduce((s, f) => s + f.size, 0),
    })
    .returning();
  const op = record[0];

  (async () => {
    const opDir = path.join(PDF_OPS_DIR, String(op.id));
    try {
      const inputPaths = files.map((f) => f.path);
      const resultFilename = `merged_${op.id}.pdf`;
      const { outputPath, fileSizeBytes } = await mergePdfs(inputPaths, opDir, resultFilename);

      let cloudObjectPath: string | null = null;
      try {
        cloudObjectPath = await uploadConvertedFile(outputPath, "pdf");
      } catch (e) {
        logger.warn({ err: e }, "Cloud upload failed for merge op; keeping local");
      }

      await db
        .update(pdfOperationsTable)
        .set({
          status: "completed",
          resultFilename,
          resultFileSizeBytes: fileSizeBytes,
          cloudObjectPath,
          completedAt: new Date(),
        })
        .where(eqId(op.id));
    } catch (err) {
      logger.error({ err, opId: op.id }, "PDF merge failed");
      await db
        .update(pdfOperationsTable)
        .set({ status: "failed", errorMessage: String(err) })
        .where(eqId(op.id));
    } finally {
      await Promise.all(files.map((f) => safeUnlink(f.path)));
    }
  })();

  const fresh = await db.select().from(pdfOperationsTable).where(eqId(op.id));
  res.status(201).json(toResponse(fresh[0]));
});

// ─── Split ─────────────────────────────────────────────────────────────────

router.post("/pdf/split", upload.single("file"), async (req, res): Promise<void> => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No PDF file uploaded" });
    return;
  }
  const pageRanges: string | undefined = (req.body as { pageRanges?: string }).pageRanges;

  const record = await db
    .insert(pdfOperationsTable)
    .values({
      operationType: "split",
      status: "pending",
      originalFilenames: JSON.stringify([file.originalname]),
      fileSizeBytes: file.size,
    })
    .returning();
  const op = record[0];

  (async () => {
    const opDir = path.join(PDF_OPS_DIR, String(op.id));
    try {
      const base = path.basename(file.originalname, ".pdf");
      const resultFilename = `split_${op.id}_${base}.zip`;
      const { outputPath, fileSizeBytes } = await splitPdf(file.path, opDir, resultFilename, pageRanges);

      let cloudObjectPath: string | null = null;
      try {
        cloudObjectPath = await uploadConvertedFile(outputPath, "zip");
      } catch (e) {
        logger.warn({ err: e }, "Cloud upload failed for split op; keeping local");
      }

      await db
        .update(pdfOperationsTable)
        .set({
          status: "completed",
          resultFilename,
          resultFileSizeBytes: fileSizeBytes,
          cloudObjectPath,
          completedAt: new Date(),
        })
        .where(eqId(op.id));
    } catch (err) {
      logger.error({ err, opId: op.id }, "PDF split failed");
      await db
        .update(pdfOperationsTable)
        .set({ status: "failed", errorMessage: String(err) })
        .where(eqId(op.id));
    } finally {
      await safeUnlink(file.path);
    }
  })();

  const fresh = await db.select().from(pdfOperationsTable).where(eqId(op.id));
  res.status(201).json(toResponse(fresh[0]));
});

// ─── Compress ──────────────────────────────────────────────────────────────

router.post("/pdf/compress", upload.single("file"), async (req, res): Promise<void> => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No PDF file uploaded" });
    return;
  }

  const rawLevel = (req.body as { level?: string }).level ?? "medium";
  const level =
    rawLevel === "low" || rawLevel === "high" ? rawLevel : "medium";

  const record = await db
    .insert(pdfOperationsTable)
    .values({
      operationType: "compress",
      status: "pending",
      originalFilenames: JSON.stringify([file.originalname]),
      fileSizeBytes: file.size,
    })
    .returning();
  const op = record[0];

  (async () => {
    const opDir = path.join(PDF_OPS_DIR, String(op.id));
    try {
      const base = path.basename(file.originalname, ".pdf");
      const resultFilename = `compressed_${op.id}_${base}.pdf`;
      const { outputPath, fileSizeBytes } = await compressPdf(file.path, opDir, resultFilename, level);

      let cloudObjectPath: string | null = null;
      try {
        cloudObjectPath = await uploadConvertedFile(outputPath, "pdf");
      } catch (e) {
        logger.warn({ err: e }, "Cloud upload failed for compress op; keeping local");
      }

      await db
        .update(pdfOperationsTable)
        .set({
          status: "completed",
          resultFilename,
          resultFileSizeBytes: fileSizeBytes,
          cloudObjectPath,
          completedAt: new Date(),
        })
        .where(eqId(op.id));
    } catch (err) {
      logger.error({ err, opId: op.id }, "PDF compress failed");
      await db
        .update(pdfOperationsTable)
        .set({ status: "failed", errorMessage: String(err) })
        .where(eqId(op.id));
    } finally {
      await safeUnlink(file.path);
    }
  })();

  const fresh = await db.select().from(pdfOperationsTable).where(eqId(op.id));
  res.status(201).json(toResponse(fresh[0]));
});

// ─── Protect ───────────────────────────────────────────────────────────────

router.post("/pdf/protect", upload.single("file"), async (req, res): Promise<void> => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No PDF file uploaded" });
    return;
  }
  const password: string | undefined = (req.body as { password?: string }).password;
  if (!password || password.trim() === "") {
    await safeUnlink(file.path);
    res.status(400).json({ error: "Password is required" });
    return;
  }

  const record = await db
    .insert(pdfOperationsTable)
    .values({
      operationType: "protect",
      status: "pending",
      originalFilenames: JSON.stringify([file.originalname]),
      fileSizeBytes: file.size,
    })
    .returning();
  const op = record[0];

  (async () => {
    const opDir = path.join(PDF_OPS_DIR, String(op.id));
    try {
      const base = path.basename(file.originalname, ".pdf");
      const resultFilename = `protected_${op.id}_${base}.pdf`;
      const { outputPath, fileSizeBytes } = await protectPdf(file.path, opDir, resultFilename, password);

      let cloudObjectPath: string | null = null;
      try {
        cloudObjectPath = await uploadConvertedFile(outputPath, "pdf");
      } catch (e) {
        logger.warn({ err: e }, "Cloud upload failed for protect op; keeping local");
      }

      await db
        .update(pdfOperationsTable)
        .set({
          status: "completed",
          resultFilename,
          resultFileSizeBytes: fileSizeBytes,
          cloudObjectPath,
          completedAt: new Date(),
        })
        .where(eqId(op.id));
    } catch (err) {
      logger.error({ err, opId: op.id }, "PDF protect failed");
      await db
        .update(pdfOperationsTable)
        .set({ status: "failed", errorMessage: String(err) })
        .where(eqId(op.id));
    } finally {
      await safeUnlink(file.path);
    }
  })();

  const fresh = await db.select().from(pdfOperationsTable).where(eqId(op.id));
  res.status(201).json(toResponse(fresh[0]));
});

// ─── Get / Delete ──────────────────────────────────────────────────────────

router.get("/pdf/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const rows = await db.select().from(pdfOperationsTable).where(eqId(id));
  if (rows.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(toResponse(rows[0]));
});

router.get("/pdf/:id/download", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const rows = await db.select().from(pdfOperationsTable).where(eqId(id));
  if (rows.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const op = rows[0];
  if (op.status !== "completed" || !op.resultFilename) {
    res.status(400).json({ error: "Operation not completed" });
    return;
  }

  const filename = op.resultFilename;
  const contentType = filename.endsWith(".zip")
    ? "application/zip"
    : "application/pdf";
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Type", contentType);

  if (op.cloudObjectPath) {
    try {
      const format = filename.endsWith(".zip") ? "zip" : "pdf";
      const { stream, contentType: ct, contentLength } = await streamCloudFile(
        op.cloudObjectPath,
        filename,
        format,
      );
      res.setHeader("Content-Type", ct);
      if (contentLength !== undefined) res.setHeader("Content-Length", contentLength);
      stream.pipe(res);
      return;
    } catch (e) {
      logger.warn({ err: e, opId: id }, "Cloud stream failed; falling back to local");
    }
  }

  // Fallback: local disk
  const localPath = path.join(PDF_OPS_DIR, String(op.id), filename);
  try {
    const stream = (await import("fs")).createReadStream(localPath);
    stream.pipe(res);
  } catch {
    res.status(500).json({ error: "File not found" });
  }
});

router.delete("/pdf/:id", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const rows = await db.select().from(pdfOperationsTable).where(eqId(id));
  if (rows.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const op = rows[0];

  if (op.cloudObjectPath) {
    await deleteCloudFile(op.cloudObjectPath).catch((e) =>
      logger.warn({ err: e, opId: id }, "Could not delete cloud object"),
    );
  }

  const opDir = path.join(PDF_OPS_DIR, String(op.id));
  await fs.rm(opDir, { recursive: true, force: true }).catch(() => undefined);

  await db.delete(pdfOperationsTable).where(eqId(id));
  res.status(204).end();
});

// ─── Helpers ───────────────────────────────────────────────────────────────

function eqId(id: number) {
  return eq(pdfOperationsTable.id, id);
}

function toResponse(op: typeof pdfOperationsTable.$inferSelect) {
  return {
    id: op.id,
    operationType: op.operationType,
    status: op.status,
    errorMessage: op.errorMessage ?? null,
    originalFilenames: JSON.parse(op.originalFilenames) as string[],
    resultFilename: op.resultFilename ?? null,
    fileSizeBytes: op.fileSizeBytes ?? null,
    resultFileSizeBytes: op.resultFileSizeBytes ?? null,
    cloudObjectPath: op.cloudObjectPath ?? null,
    createdAt: op.createdAt.toISOString(),
    completedAt: op.completedAt?.toISOString() ?? null,
  };
}

async function safeUnlink(p: string) {
  await fs.unlink(p).catch(() => undefined);
}

export default router;

