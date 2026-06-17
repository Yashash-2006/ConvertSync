import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import { logger } from "./logger";

const execFileAsync = promisify(execFile);

const SOFFICE_PATH =
  process.env.SOFFICE_PATH ||
  "/nix/store/s77ki6j3if918jk373md4aajqii531rd-libreoffice-24.8.7.2-wrapped/bin/soffice";

export interface ConversionResult {
  outputPath: string;
  fileSizeBytes: number;
}

export async function convertFile(
  inputPath: string,
  targetFormat: "pdf" | "docx",
  outputDir: string,
): Promise<ConversionResult> {
  await fs.mkdir(outputDir, { recursive: true });

  logger.info({ inputPath, targetFormat }, "Starting file conversion");

  if (targetFormat === "pdf") {
    return convertDocxToPdf(inputPath, outputDir);
  } else {
    return convertPdfToDocx(inputPath, outputDir);
  }
}

async function convertDocxToPdf(
  inputPath: string,
  outputDir: string,
): Promise<ConversionResult> {
  const sofficeBin = await resolveSoffice();

  try {
    await execFileAsync(
      sofficeBin,
      [
        "--headless",
        "--norestore",
        "--nologo",
        "--nofirststartwizard",
        "--convert-to",
        "pdf",
        "--outdir",
        outputDir,
        inputPath,
      ],
      {
        timeout: 120_000,
        env: {
          ...process.env,
          HOME: "/tmp/libreoffice-home",
        },
      },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message, inputPath }, "LibreOffice DOCX→PDF failed");
    throw new Error(`DOCX→PDF conversion failed: ${message}`);
  }

  return resolveOutput(inputPath, outputDir, "pdf");
}

async function convertPdfToDocx(
  inputPath: string,
  outputDir: string,
): Promise<ConversionResult> {
  const inputBasename = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(outputDir, `${inputBasename}.docx`);

  const python3 = await resolvePython();

  const script = `
from pdf2docx import Converter
import sys
cv = Converter(sys.argv[1])
cv.convert(sys.argv[2])
cv.close()
`.trim();

  const scriptPath = path.join(outputDir, "_convert.py");
  await fs.writeFile(scriptPath, script, "utf-8");

  try {
    await execFileAsync(python3, [scriptPath, inputPath, outputPath], {
      timeout: 180_000,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message, inputPath }, "pdf2docx PDF→DOCX failed");
    throw new Error(`PDF→DOCX conversion failed: ${message}`);
  } finally {
    await fs.unlink(scriptPath).catch(() => undefined);
  }

  try {
    const stat = await fs.stat(outputPath);
    logger.info({ outputPath, size: stat.size }, "Conversion completed");
    return { outputPath, fileSizeBytes: stat.size };
  } catch {
    throw new Error(`Converted file not found at expected path: ${outputPath}`);
  }
}

async function resolveOutput(
  inputPath: string,
  outputDir: string,
  ext: string,
): Promise<ConversionResult> {
  const inputBasename = path.basename(inputPath, path.extname(inputPath));
  const outputPath = path.join(outputDir, `${inputBasename}.${ext}`);

  try {
    const stat = await fs.stat(outputPath);
    logger.info({ outputPath, size: stat.size }, "Conversion completed");
    return { outputPath, fileSizeBytes: stat.size };
  } catch {
    throw new Error(`Converted file not found at expected path: ${outputPath}`);
  }
}

async function resolveSoffice(): Promise<string> {
  const candidates = [
    SOFFICE_PATH,
    "/usr/bin/soffice",
    "/usr/local/bin/soffice",
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // try next
    }
  }

  try {
    const { stdout } = await execFileAsync("which", ["soffice"]);
    const found = stdout.trim();
    if (found) return found;
  } catch {
    // not in PATH
  }

  throw new Error("LibreOffice (soffice) not found.");
}

async function resolvePython(): Promise<string> {
  for (const bin of ["python3", "python"]) {
    try {
      const { stdout } = await execFileAsync("which", [bin]);
      const found = stdout.trim();
      if (found) return found;
    } catch {
      // try next
    }
  }
  throw new Error(
    "Python 3 not found. Required for PDF→DOCX conversion (pdf2docx).",
  );
}
