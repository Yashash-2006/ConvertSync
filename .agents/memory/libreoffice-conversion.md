---
name: LibreOffice conversion pattern
description: How to run LibreOffice headlessly without output filename conflicts
---

LibreOffice writes its output to the **same directory as the input file**, named after the input basename. To avoid collisions when multiple concurrent conversions run:

1. Copy or use a temp-dir for input: write output to a dedicated `_lo_tmp` subdir.
2. After conversion, rename the LO-generated file to the desired `resultFilename`.
3. Remove `_lo_tmp` when done.

```typescript
const tmpDir = path.join(outputDir, "_lo_tmp");
await execFileAsync(soffice, [
  "--headless",
  `--env:UserInstallation=file://${LO_HOME}`,
  "--convert-to", targetExt,
  "--outdir", tmpDir,
  inputPath,
]);
const inputBase = path.basename(inputPath, path.extname(inputPath));
const loOutput = path.join(tmpDir, `${inputBase}.${targetExt}`);
await fs.rename(loOutput, outputPath);
await fs.rm(tmpDir, { recursive: true, force: true });
```

**Why:** LO ignores `--outdir` naming and always uses the input basename. Without isolation, concurrent jobs overwrite each other.

**LO_HOME:** Set a stable `UserInstallation` to avoid LO locking issues: `/tmp/libreoffice-home`.
