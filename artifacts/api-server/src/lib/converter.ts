import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import { logger } from "./logger";

const execFileAsync = promisify(execFile);

const SOFFICE_PATH =
  process.env.SOFFICE_PATH ||
  "/nix/store/s77ki6j3if918jk373md4aajqii531rd-libreoffice-24.8.7.2-wrapped/bin/soffice";

const LO_HOME = "/tmp/libreoffice-home";

// Maps common Windows/Office fonts to metric-compatible Liberation/open equivalents
// Liberation fonts are drop-in metric replacements: layout, line breaks, and spacing
// will be identical so the PDF output matches the original DOCX layout exactly.
const FONT_SUBSTITUTIONS: [string, string][] = [
  ["Calibri", "Liberation Sans"],
  ["Calibri Light", "Liberation Sans"],
  ["Cambria", "Liberation Serif"],
  ["Cambria Math", "Liberation Serif"],
  ["Arial", "Liberation Sans"],
  ["Arial Narrow", "Liberation Sans"],
  ["Times New Roman", "Liberation Serif"],
  ["Courier New", "Liberation Mono"],
  ["Helvetica", "Liberation Sans"],
  ["Garamond", "Liberation Serif"],
  ["Book Antiqua", "Liberation Serif"],
  ["Palatino Linotype", "Liberation Serif"],
  ["Trebuchet MS", "Liberation Sans"],
  ["Georgia", "Liberation Serif"],
  ["Verdana", "Liberation Sans"],
  ["Tahoma", "Liberation Sans"],
  ["Century Gothic", "Liberation Sans"],
  ["Franklin Gothic Medium", "Liberation Sans"],
  ["Gill Sans MT", "Liberation Sans"],
];

let loProfileReady = false;

async function ensureLoProfile(): Promise<void> {
  if (loProfileReady) return;

  const profileDir = path.join(LO_HOME, ".config", "libreoffice", "4", "user");
  await fs.mkdir(profileDir, { recursive: true });

  // Build font substitution entries for registrymodifications.xcu
  const substitutionNodes = FONT_SUBSTITUTIONS.map(
    ([from, to], i) => `
  <item oor:path="/org.openoffice.VCL/FontSubstitutions">
    <node oor:name="${i + 1}" oor:op="replace">
      <prop oor:name="ReplaceFont" oor:type="xs:string">
        <value>${from}</value>
      </prop>
      <prop oor:name="SubstituteFont" oor:type="xs:string">
        <value>${to}</value>
      </prop>
    </node>
  </item>`,
  ).join("\n");

  const xcu = `<?xml version="1.0" encoding="UTF-8"?>
<oor:items
  xmlns:oor="http://openoffice.org/2001/registry"
  xmlns:xs="http://www.w3.org/2001/XMLSchema"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
${substitutionNodes}
</oor:items>`;

  const xcuPath = path.join(profileDir, "registrymodifications.xcu");
  await fs.writeFile(xcuPath, xcu, "utf-8");

  loProfileReady = true;
  logger.info({ profileDir }, "LibreOffice profile with font substitutions ready");
}

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
  await ensureLoProfile();
  const sofficeBin = await resolveSoffice();

  // writer_pdf_Export filter options:
  //   EmbedStandardFonts=true  — embed all fonts (not just non-standard ones)
  //   ReduceImageResolution=false — keep original image quality
  //   IsSkipEmptyPages=false   — preserve all pages
  //   SelectPdfVersion=0       — PDF 1.4 (broadest compat)
  //   UseTaggedPDF=true        — accessibility + structure tags
  const filterOptions =
    "EmbedStandardFonts=true,ReduceImageResolution=false,IsSkipEmptyPages=false,UseTaggedPDF=true";
  const convertArg = `pdf:writer_pdf_Export:${filterOptions}`;

  try {
    await execFileAsync(
      sofficeBin,
      [
        "--headless",
        "--norestore",
        "--nologo",
        "--nofirststartwizard",
        "--convert-to",
        convertArg,
        "--outdir",
        outputDir,
        inputPath,
      ],
      {
        timeout: 120_000,
        env: {
          ...process.env,
          HOME: LO_HOME,
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
  const scriptPath = path.join(outputDir, "_convert.py");

  // pdf2docx settings tuned for fidelity:
  //   clip_image_res_ratio=8  — 8x72=576 dpi for embedded images (crisp)
  //   min_section_height=5    — detect narrow sections (headers, footers)
  //   connected_border_tolerance=1.0 — tolerate slight gaps in table borders
  //   ignore_page_error=True  — don't abort on a single bad page
  //   line_overlap_threshold=0.9 — deduplicate overlapping lines
  const script = `
import sys
from pdf2docx import Converter

input_pdf  = sys.argv[1]
output_doc = sys.argv[2]

cv = Converter(input_pdf)
cv.convert(
    output_doc,
    clip_image_res_ratio=8.0,
    min_section_height=5.0,
    connected_border_tolerance=1.0,
    ignore_page_error=True,
    line_overlap_threshold=0.9,
    shape_min_dimension=1.0,
    page_margin_factor_top=0.3,
    page_margin_factor_bottom=0.3,
)
cv.close()
`.trim();

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
  const candidates = [SOFFICE_PATH, "/usr/bin/soffice", "/usr/local/bin/soffice"];
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
  throw new Error("Python 3 not found. Required for PDF→DOCX conversion.");
}
