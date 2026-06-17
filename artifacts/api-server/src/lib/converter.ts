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

  const sofficeBin = await resolveSoffice();

  logger.info({ inputPath, targetFormat, sofficeBin }, "Starting file conversion");

  const filterArg = targetFormat === "pdf" ? "pdf" : "docx";

  try {
    await execFileAsync(sofficeBin, [
      "--headless",
      "--norestore",
      "--nologo",
      "--nofirststartwizard",
      `--convert-to`,
      filterArg,
      "--outdir",
      outputDir,
      inputPath,
    ], {
      timeout: 120_000,
      env: {
        ...process.env,
        HOME: "/tmp/libreoffice-home",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message, inputPath, targetFormat }, "LibreOffice conversion failed");
    throw new Error(`Conversion failed: ${message}`);
  }

  const inputBasename = path.basename(inputPath, path.extname(inputPath));
  const outputFilename = `${inputBasename}.${targetFormat}`;
  const outputPath = path.join(outputDir, outputFilename);

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
    "soffice",
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

  throw new Error(
    "LibreOffice (soffice) not found. Install it with: nix-env -iA nixpkgs.libreoffice",
  );
}
