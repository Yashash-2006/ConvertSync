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

// ─── Rotate ───────────────────────────────────────────────────────────────────

export async function rotatePdf(
  inputPath: string,
  outputDir: string,
  resultFilename: string,
  angle: 90 | 180 | 270 = 90,
): Promise<PdfOpResult> {
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, resultFilename);
  const python3 = await resolvePython();
  const script = `
import sys
from pypdf import PdfReader, PdfWriter

reader = PdfReader(sys.argv[1])
writer = PdfWriter()
angle  = int(sys.argv[3])
for page in reader.pages:
    page.rotate(angle)
    writer.add_page(page)
with open(sys.argv[2], "wb") as f:
    writer.write(f)
`.trim();
  const sp = path.join(outputDir, "_rotate.py");
  await fs.writeFile(sp, script, "utf-8");
  try {
    await execFileAsync(python3, [sp, inputPath, outputPath, String(angle)], { timeout: 120_000 });
  } finally {
    await fs.unlink(sp).catch(() => undefined);
  }
  const stat = await fs.stat(outputPath);
  return { outputPath, resultFilename, fileSizeBytes: stat.size };
}

// ─── PDF → JPG (ZIP) ──────────────────────────────────────────────────────────

export async function pdfToJpg(
  inputPath: string,
  outputDir: string,
  resultFilename: string,
  dpi: number = 150,
): Promise<PdfOpResult> {
  await fs.mkdir(outputDir, { recursive: true });
  const jpgDir = path.join(outputDir, "pages");
  await fs.mkdir(jpgDir, { recursive: true });
  const python3 = await resolvePython();
  const script = `
import sys, os, fitz

doc = fitz.open(sys.argv[1])
out_dir = sys.argv[2]
dpi = int(sys.argv[3])
mat = fitz.Matrix(dpi / 72, dpi / 72)
for i, page in enumerate(doc):
    pix = page.get_pixmap(matrix=mat)
    pix.save(os.path.join(out_dir, f"page_{i+1:04d}.jpg"))
`.trim();
  const sp = path.join(outputDir, "_pdf2jpg.py");
  await fs.writeFile(sp, script, "utf-8");
  try {
    await execFileAsync(python3, [sp, inputPath, jpgDir, String(dpi)], { timeout: 120_000 });
  } finally {
    await fs.unlink(sp).catch(() => undefined);
  }
  const zipPath = path.join(outputDir, resultFilename);
  await zipDirectory(jpgDir, zipPath);
  await fs.rm(jpgDir, { recursive: true, force: true });
  const stat = await fs.stat(zipPath);
  return { outputPath: zipPath, resultFilename, fileSizeBytes: stat.size };
}

// ─── JPG → PDF ────────────────────────────────────────────────────────────────

export async function jpgToPdf(
  inputPaths: string[],
  outputDir: string,
  resultFilename: string,
): Promise<PdfOpResult> {
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, resultFilename);
  const python3 = await resolvePython();
  const script = `
import sys, json
from PIL import Image

paths  = json.loads(sys.argv[1])
output = sys.argv[2]

images = []
for p in paths:
    img = Image.open(p).convert("RGB")
    images.append(img)

if not images:
    raise ValueError("No images provided")

images[0].save(output, save_all=True, append_images=images[1:])
`.trim();
  const sp = path.join(outputDir, "_jpg2pdf.py");
  await fs.writeFile(sp, script, "utf-8");
  try {
    await execFileAsync(python3, [sp, JSON.stringify(inputPaths), outputPath], { timeout: 120_000 });
  } finally {
    await fs.unlink(sp).catch(() => undefined);
  }
  const stat = await fs.stat(outputPath);
  return { outputPath, resultFilename, fileSizeBytes: stat.size };
}

// ─── Watermark ────────────────────────────────────────────────────────────────

export async function watermarkPdf(
  inputPath: string,
  outputDir: string,
  resultFilename: string,
  text: string,
): Promise<PdfOpResult> {
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, resultFilename);
  const python3 = await resolvePython();
  const script = `
import sys, fitz

doc  = fitz.open(sys.argv[1])
text = sys.argv[3]

for page in doc:
    w, h = page.rect.width, page.rect.height
    for x_off, y_off in [(w*0.15, h*0.35), (w*0.40, h*0.65)]:
        page.insert_text(
            (x_off, y_off),
            text,
            fontsize=min(w, h) * 0.07,
            color=(0.75, 0.75, 0.75),
            rotate=45,
            overlay=True,
        )

doc.save(sys.argv[2])
`.trim();
  const sp = path.join(outputDir, "_watermark.py");
  await fs.writeFile(sp, script, "utf-8");
  try {
    await execFileAsync(python3, [sp, inputPath, outputPath, text], { timeout: 120_000 });
  } finally {
    await fs.unlink(sp).catch(() => undefined);
  }
  const stat = await fs.stat(outputPath);
  return { outputPath, resultFilename, fileSizeBytes: stat.size };
}

// ─── Unlock ───────────────────────────────────────────────────────────────────

export async function unlockPdf(
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

reader   = PdfReader(sys.argv[1])
password = sys.argv[3]

if reader.is_encrypted:
    ok = reader.decrypt(password)
    if not ok:
        raise ValueError("Wrong password or unsupported encryption")

writer = PdfWriter()
for page in reader.pages:
    writer.add_page(page)
with open(sys.argv[2], "wb") as f:
    writer.write(f)
`.trim();
  const sp = path.join(outputDir, "_unlock.py");
  await fs.writeFile(sp, script, "utf-8");
  try {
    await execFileAsync(python3, [sp, inputPath, outputPath, password], { timeout: 120_000 });
  } finally {
    await fs.unlink(sp).catch(() => undefined);
  }
  const stat = await fs.stat(outputPath);
  return { outputPath, resultFilename, fileSizeBytes: stat.size };
}

// ─── OCR ──────────────────────────────────────────────────────────────────────

export async function ocrPdf(
  inputPath: string,
  outputDir: string,
  resultFilename: string,
): Promise<PdfOpResult> {
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, resultFilename);
  // ocrmypdf CLI: adds invisible text layer to scanned PDFs
  const ocrmypdf = await resolveOcrmypdf();
  await execFileAsync(
    ocrmypdf,
    ["--skip-text", "--force-ocr", "--jobs", "2", inputPath, outputPath],
    { timeout: 300_000 },
  );
  const stat = await fs.stat(outputPath);
  logger.info({ outputPath, size: stat.size }, "OCR completed");
  return { outputPath, resultFilename, fileSizeBytes: stat.size };
}

// ─── LibreOffice conversions ──────────────────────────────────────────────────

const SOFFICE_PATH =
  process.env.SOFFICE_PATH ||
  "/nix/store/s77ki6j3if918jk373md4aajqii531rd-libreoffice-24.8.7.2-wrapped/bin/soffice";
const LO_HOME = "/tmp/libreoffice-home";

export async function libreOfficeConvert(
  inputPath: string,
  outputDir: string,
  resultFilename: string,
  targetExt: string,  // "pptx" | "xlsx" | "pdf"
): Promise<PdfOpResult> {
  await fs.mkdir(outputDir, { recursive: true });

  // LO writes to same dir as input — use a dedicated temp dir to avoid conflicts
  const tmpDir = path.join(outputDir, "_lo_tmp");
  await fs.mkdir(tmpDir, { recursive: true });

  const soffice = await resolveLibreOffice();

  await execFileAsync(soffice, [
    "--headless",
    `--env:UserInstallation=file://${LO_HOME}`,
    "--convert-to", targetExt,
    "--outdir", tmpDir,
    inputPath,
  ], { timeout: 300_000 });

  // LibreOffice names the output based on the input filename
  const inputBase = path.basename(inputPath, path.extname(inputPath));
  const loOutput = path.join(tmpDir, `${inputBase}.${targetExt}`);

  const outputPath = path.join(outputDir, resultFilename);
  await fs.rename(loOutput, outputPath);
  await fs.rm(tmpDir, { recursive: true, force: true });

  const stat = await fs.stat(outputPath);
  logger.info({ outputPath, size: stat.size, targetExt }, "LibreOffice conversion done");
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

async function resolveOcrmypdf(): Promise<string> {
  for (const bin of ["ocrmypdf"]) {
    try {
      const { stdout } = await execFileAsync("which", [bin]);
      const found = stdout.trim();
      if (found) return found;
    } catch { /* try next */ }
  }
  // Try common user-install paths
  const userBin = `${process.env.HOME}/.local/bin/ocrmypdf`;
  try {
    await fs.access(userBin);
    return userBin;
  } catch { /* not found */ }
  throw new Error("ocrmypdf not found. Install with: pip install ocrmypdf");
}

async function resolveLibreOffice(): Promise<string> {
  // Try the known Nix store path first
  const nixPath = SOFFICE_PATH;
  try {
    await fs.access(nixPath);
    return nixPath;
  } catch { /* try PATH */ }
  for (const bin of ["soffice", "libreoffice"]) {
    try {
      const { stdout } = await execFileAsync("which", [bin]);
      const found = stdout.trim();
      if (found) return found;
    } catch { /* try next */ }
  }
  throw new Error("LibreOffice not found.");
}
