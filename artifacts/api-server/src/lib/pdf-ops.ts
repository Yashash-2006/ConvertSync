import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import { createWriteStream } from "fs";
import { logger } from "./logger";

const execFileAsync = promisify(execFile);

export interface PdfOpResult {
  outputPath: string;
  resultFilename: string;
  fileSizeBytes: number;
}

// ─── Merge ────────────────────────────────────────────────────────────────────

export async function mergePdfs(
  inputPaths: string[],
  outputDir: string,
  resultFilename: string,
): Promise<PdfOpResult> {
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, resultFilename);
  const python3 = await resolvePython();

  const script = `
import sys, json
from pypdf import PdfWriter

paths = json.loads(sys.argv[1])
output = sys.argv[2]

writer = PdfWriter()
for p in paths:
    writer.append(p)
with open(output, "wb") as f:
    writer.write(f)
`.trim();

  const scriptPath = path.join(outputDir, "_merge.py");
  await fs.writeFile(scriptPath, script, "utf-8");

  try {
    await execFileAsync(python3, [scriptPath, JSON.stringify(inputPaths), outputPath], {
      timeout: 120_000,
    });
  } finally {
    await fs.unlink(scriptPath).catch(() => undefined);
  }

  const stat = await fs.stat(outputPath);
  logger.info({ outputPath, size: stat.size }, "PDF merge completed");
  return { outputPath, resultFilename, fileSizeBytes: stat.size };
}

// ─── Split ────────────────────────────────────────────────────────────────────

/**
 * Split a PDF. If pageRanges is provided (e.g. "1-3,4-6,7"), splits by those
 * ranges. Otherwise splits every page into a separate file.
 * Result is a ZIP archive.
 */
export async function splitPdf(
  inputPath: string,
  outputDir: string,
  resultFilename: string,
  pageRanges?: string,
): Promise<PdfOpResult> {
  await fs.mkdir(outputDir, { recursive: true });
  const partsDir = path.join(outputDir, "parts");
  await fs.mkdir(partsDir, { recursive: true });
  const python3 = await resolvePython();

  const script = `
import sys, json, os
from pypdf import PdfReader, PdfWriter

input_path = sys.argv[1]
parts_dir  = sys.argv[2]
ranges_raw = sys.argv[3]  # JSON: [[1,3],[4,6]] or [] for all pages

reader = PdfReader(input_path)
total  = len(reader.pages)

def parse_ranges(raw):
    """Parse '1-3,4-6,7' into 0-based [[0,2],[3,5],[6,6]]."""
    result = []
    for part in raw.split(","):
        part = part.strip()
        if "-" in part:
            a, b = part.split("-", 1)
            result.append([int(a)-1, int(b)-1])
        else:
            n = int(part) - 1
            result.append([n, n])
    return result

ranges_json = json.loads(ranges_raw)
if ranges_json:
    ranges = ranges_json
else:
    ranges = [[i, i] for i in range(total)]

for idx, (start, end) in enumerate(ranges):
    writer = PdfWriter()
    for p in range(start, min(end+1, total)):
        writer.add_page(reader.pages[p])
    name = f"part_{idx+1:03d}_pages_{start+1}-{end+1}.pdf"
    with open(os.path.join(parts_dir, name), "wb") as f:
        writer.write(f)
`.trim();

  const scriptPath = path.join(outputDir, "_split.py");
  await fs.writeFile(scriptPath, script, "utf-8");

  let rangesArg: string;
  if (pageRanges && pageRanges.trim()) {
    // Convert "1-3,4-6,7" to [[0,2],[3,5],[6,6]] for the script
    const parsed = pageRanges.split(",").map((p) => {
      const t = p.trim();
      if (t.includes("-")) {
        const [a, b] = t.split("-").map(Number);
        return [a - 1, b - 1];
      }
      const n = Number(t) - 1;
      return [n, n];
    });
    rangesArg = JSON.stringify(parsed);
  } else {
    rangesArg = JSON.stringify([]);
  }

  try {
    await execFileAsync(python3, [scriptPath, inputPath, partsDir, rangesArg], {
      timeout: 120_000,
    });
  } finally {
    await fs.unlink(scriptPath).catch(() => undefined);
  }

  // Zip the parts directory
  const zipPath = path.join(outputDir, resultFilename);
  await zipDirectory(partsDir, zipPath);
  await fs.rm(partsDir, { recursive: true, force: true });

  const stat = await fs.stat(zipPath);
  logger.info({ zipPath, size: stat.size }, "PDF split completed");
  return { outputPath: zipPath, resultFilename, fileSizeBytes: stat.size };
}

// ─── Compress ─────────────────────────────────────────────────────────────────

const GS_SETTINGS: Record<string, string> = {
  low: "/screen",      // ~72 dpi – smallest file
  medium: "/ebook",   // ~150 dpi – good balance
  high: "/printer",   // ~300 dpi – best quality
};

export async function compressPdf(
  inputPath: string,
  outputDir: string,
  resultFilename: string,
  level: "low" | "medium" | "high" = "medium",
): Promise<PdfOpResult> {
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, resultFilename);
  const gsBin = await resolveGhostscript();
  const setting = GS_SETTINGS[level] ?? "/ebook";

  await execFileAsync(gsBin, [
    "-sDEVICE=pdfwrite",
    "-dCompatibilityLevel=1.4",
    `-dPDFSETTINGS=${setting}`,
    "-dNOPAUSE",
    "-dQUIET",
    "-dBATCH",
    `-sOutputFile=${outputPath}`,
    inputPath,
  ], { timeout: 120_000 });

  const stat = await fs.stat(outputPath);
  logger.info({ outputPath, size: stat.size, level }, "PDF compress completed");
  return { outputPath, resultFilename, fileSizeBytes: stat.size };
}

// ─── Protect ─────────────────────────────────────────────────────────────────

export async function protectPdf(
  inputPath: string,
  outputDir: string,
  resultFilename: string,
  password: string,
): Promise<PdfOpResult> {
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, resultFilename);
  const python3 = await resolvePython();

  const script = `
import sys
from pypdf import PdfReader, PdfWriter

input_path = sys.argv[1]
output_path = sys.argv[2]
password = sys.argv[3]

reader = PdfReader(input_path)
writer = PdfWriter()
for page in reader.pages:
    writer.add_page(page)

writer.encrypt(user_password=password, owner_password=None, use_128bit=True)
with open(output_path, "wb") as f:
    writer.write(f)
`.trim();

  const scriptPath = path.join(outputDir, "_protect.py");
  await fs.writeFile(scriptPath, script, "utf-8");

  try {
    await execFileAsync(python3, [scriptPath, inputPath, outputPath, password], {
      timeout: 120_000,
    });
  } finally {
    await fs.unlink(scriptPath).catch(() => undefined);
  }

  const stat = await fs.stat(outputPath);
  logger.info({ outputPath, size: stat.size }, "PDF protect completed");
  return { outputPath, resultFilename, fileSizeBytes: stat.size };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function zipDirectory(sourceDir: string, outPath: string): Promise<void> {
  // Use Python's zipfile module — always available
  const python3 = await resolvePython();
  const script = `
import sys, zipfile, os
src = sys.argv[1]
out = sys.argv[2]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zf:
    for f in sorted(os.listdir(src)):
        zf.write(os.path.join(src, f), f)
`.trim();

  const scriptPath = outPath + "_zip.py";
  await fs.writeFile(scriptPath, script, "utf-8");
  try {
    await execFileAsync(python3, [scriptPath, sourceDir, outPath], { timeout: 60_000 });
  } finally {
    await fs.unlink(scriptPath).catch(() => undefined);
  }
}

async function resolvePython(): Promise<string> {
  for (const bin of ["python3", "python"]) {
    try {
      const { stdout } = await execFileAsync("which", [bin]);
      const found = stdout.trim();
      if (found) return found;
    } catch { /* try next */ }
  }
  throw new Error("Python 3 not found.");
}

async function resolveGhostscript(): Promise<string> {
  for (const bin of ["gs", "ghostscript"]) {
    try {
      const { stdout } = await execFileAsync("which", [bin]);
      const found = stdout.trim();
      if (found) return found;
    } catch { /* try next */ }
  }
  throw new Error("Ghostscript not found.");
}
