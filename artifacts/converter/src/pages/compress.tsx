import { useState, useCallback, useRef } from "react";
import { useCompressPdf, useDeletePdfOperation } from "@workspace/api-client-react";
import { Archive, Loader2, CheckCircle2, AlertCircle, Download, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type Level = "low" | "medium" | "high";

const LEVELS: { value: Level; label: string; desc: string }[] = [
  { value: "low", label: "Maximum compression", desc: "Smallest file, lower quality (screen)" },
  { value: "medium", label: "Balanced", desc: "Good quality, reduced size (ebook)" },
  { value: "high", label: "Minimal compression", desc: "Best quality, larger file (printer)" },
];

export default function Compress() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [level, setLevel] = useState<Level>("medium");
  const [resultId, setResultId] = useState<number | null>(null);
  const [resultFilename, setResultFilename] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "compressing" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const compressPdf = useCompressPdf();
  const deletePdf = useDeletePdfOperation();
  const { toast } = useToast();

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith(".pdf")) {
      toast({ title: "Only PDF files are supported", variant: "destructive" });
      return;
    }
    if (f.size > 100 * 1024 * 1024) {
      toast({ title: "File exceeds 100 MB", variant: "destructive" });
      return;
    }
    setFile(f);
    setStatus("idle");
    setResultId(null);
    setResultFilename(null);
    setResultSize(null);
    setErrorMsg(null);
  }, [toast]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleCompress = async () => {
    if (!file) return;
    setStatus("compressing");
    setErrorMsg(null);
    setResultId(null);
    setResultFilename(null);
    setResultSize(null);
    try {
      const result = await compressPdf.mutateAsync({ file, level });
      setResultId(result.id);
      setResultFilename(result.resultFilename ?? "compressed.pdf");
      setResultSize(result.resultFileSizeBytes ?? null);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Compression failed");
    }
  };

  const handleDownload = () => {
    if (!resultId) return;
    const url = `${import.meta.env.BASE_URL}api/pdf/${resultId}/download`;
    const a = document.createElement("a");
    a.href = url;
    a.download = resultFilename ?? "compressed.pdf";
    a.click();
  };

  const handleReset = async () => {
    if (resultId) await deletePdf.mutateAsync({ id: resultId }).catch(() => undefined);
    setFile(null);
    setResultId(null);
    setResultFilename(null);
    setResultSize(null);
    setStatus("idle");
    setErrorMsg(null);
  };

  const savings = file && resultSize ? Math.max(0, file.size - resultSize) : null;
  const pct = file && savings ? Math.round((savings / file.size) * 100) : null;

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-500/10 mb-4">
          <Archive className="w-7 h-7 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Compress PDF</h1>
        <p className="text-muted-foreground mt-2">Reduce your PDF file size with Ghostscript compression.</p>
      </div>

      {/* Drop zone */}
      {!file && (
        <div
          className={cn(
            "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors mb-6",
            isDragging ? "border-green-500 bg-green-500/5" : "border-muted-foreground/30 hover:border-green-500/60",
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Archive className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Drop a PDF here, or click to browse</p>
          <p className="text-sm text-muted-foreground mt-1">Max 100 MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ""; }}
          />
        </div>
      )}

      {/* File + options */}
      {file && status === "idle" && (
        <>
          <Card className="p-4 flex items-center gap-3 mb-6">
            <Archive className="w-5 h-5 text-green-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
            <button onClick={handleReset} className="text-muted-foreground hover:text-destructive">×</button>
          </Card>

          <Card className="p-6 mb-6 space-y-4">
            <h2 className="font-semibold">Compression level</h2>
            <div className="space-y-2">
              {LEVELS.map((l) => (
                <button
                  key={l.value}
                  onClick={() => setLevel(l.value)}
                  className={cn(
                    "w-full text-left rounded-lg border p-4 transition-colors",
                    level === l.value
                      ? "border-green-500 bg-green-500/10"
                      : "border-muted hover:border-muted-foreground/50",
                  )}
                >
                  <p className="text-sm font-medium">{l.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{l.desc}</p>
                </button>
              ))}
            </div>
          </Card>

          <Button className="w-full bg-green-600 hover:bg-green-700" size="lg" onClick={handleCompress}>
            Compress PDF
          </Button>
        </>
      )}

      {/* Progress */}
      {status === "compressing" && (
        <Card className="p-8 flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-green-600" />
          <p className="font-medium">Compressing PDF…</p>
        </Card>
      )}

      {/* Done */}
      {status === "done" && (
        <Card className="p-8 flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500" />
          <div>
            <p className="font-semibold text-lg">Compression complete!</p>
            {resultSize !== null && (
              <p className="text-sm text-muted-foreground mt-1">
                {formatBytes(resultSize)}
                {pct !== null && pct > 0 && (
                  <span className="text-green-600 font-medium"> · {pct}% smaller</span>
                )}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <Button variant="outline" onClick={handleReset}>
              <Trash2 className="w-4 h-4 mr-2" />
              Start over
            </Button>
          </div>
        </Card>
      )}

      {/* Error */}
      {status === "error" && (
        <Card className="p-8 flex flex-col items-center gap-4 text-center">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <div>
            <p className="font-semibold text-lg">Compression failed</p>
            {errorMsg && <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>}
          </div>
          <Button variant="outline" onClick={handleReset}>Try again</Button>
        </Card>
      )}
    </div>
  );
}
