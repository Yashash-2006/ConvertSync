import { useState, useCallback, useRef } from "react";
import { useSplitPdf, useDeletePdfOperation } from "@workspace/api-client-react";
import { Scissors, Loader2, CheckCircle2, AlertCircle, Download, Trash2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type SplitMode = "all" | "ranges";

export default function Split() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<SplitMode>("all");
  const [pageRanges, setPageRanges] = useState("");
  const [resultId, setResultId] = useState<number | null>(null);
  const [resultFilename, setResultFilename] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "splitting" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const splitPdf = useSplitPdf();
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
    setErrorMsg(null);
  }, [toast]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleSplit = async () => {
    if (!file) return;
    setStatus("splitting");
    setErrorMsg(null);
    setResultId(null);
    setResultFilename(null);
    try {
      const body: { file: File; pageRanges?: string } = { file };
      if (mode === "ranges" && pageRanges.trim()) body.pageRanges = pageRanges.trim();
      const result = await splitPdf.mutateAsync(body);
      setResultId(result.id);
      setResultFilename(result.resultFilename ?? "split.zip");
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Split failed");
    }
  };

  const handleDownload = () => {
    if (!resultId) return;
    const url = `${import.meta.env.BASE_URL}api/pdf/${resultId}/download`;
    const a = document.createElement("a");
    a.href = url;
    a.download = resultFilename ?? "split.zip";
    a.click();
  };

  const handleReset = async () => {
    if (resultId) await deletePdf.mutateAsync({ id: resultId }).catch(() => undefined);
    setFile(null);
    setResultId(null);
    setResultFilename(null);
    setStatus("idle");
    setErrorMsg(null);
    setPageRanges("");
    setMode("all");
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-500/10 mb-4">
          <Scissors className="w-7 h-7 text-orange-500" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Split PDF</h1>
        <p className="text-muted-foreground mt-2">Break a PDF into individual pages or custom page ranges. Result is a ZIP archive.</p>
      </div>

      {/* Drop zone */}
      {!file && (
        <div
          className={cn(
            "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors mb-6",
            isDragging ? "border-orange-500 bg-orange-500/5" : "border-muted-foreground/30 hover:border-orange-500/60",
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Scissors className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
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

      {/* File selected + options */}
      {file && status === "idle" && (
        <>
          <Card className="p-4 flex items-center gap-3 mb-6">
            <Scissors className="w-5 h-5 text-orange-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
            <button onClick={handleReset} className="text-muted-foreground hover:text-destructive">×</button>
          </Card>

          <Card className="p-6 mb-6 space-y-5">
            <h2 className="font-semibold">Split options</h2>

            <div className="flex gap-3">
              <button
                onClick={() => setMode("all")}
                className={cn(
                  "flex-1 rounded-lg border py-3 text-sm font-medium transition-colors",
                  mode === "all" ? "border-orange-500 bg-orange-500/10 text-orange-600" : "border-muted hover:border-muted-foreground/50",
                )}
              >
                Every page separately
              </button>
              <button
                onClick={() => setMode("ranges")}
                className={cn(
                  "flex-1 rounded-lg border py-3 text-sm font-medium transition-colors",
                  mode === "ranges" ? "border-orange-500 bg-orange-500/10 text-orange-600" : "border-muted hover:border-muted-foreground/50",
                )}
              >
                Custom page ranges
              </button>
            </div>

            {mode === "ranges" && (
              <div className="space-y-2">
                <Label htmlFor="ranges">Page ranges</Label>
                <Input
                  id="ranges"
                  placeholder="e.g. 1-3, 4-6, 7"
                  value={pageRanges}
                  onChange={(e) => setPageRanges(e.target.value)}
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Comma-separated. Each range becomes a separate PDF in the ZIP.
                </p>
              </div>
            )}
          </Card>

          <Button className="w-full bg-orange-500 hover:bg-orange-600" size="lg" onClick={handleSplit}>
            Split PDF
          </Button>
        </>
      )}

      {/* Progress */}
      {status === "splitting" && (
        <Card className="p-8 flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
          <p className="font-medium">Splitting PDF…</p>
        </Card>
      )}

      {/* Done */}
      {status === "done" && (
        <Card className="p-8 flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500" />
          <div>
            <p className="font-semibold text-lg">Split complete!</p>
            <p className="text-sm text-muted-foreground mt-1">Your pages are packaged in a ZIP file.</p>
          </div>
          <div className="flex gap-3">
            <Button className="bg-orange-500 hover:bg-orange-600" onClick={handleDownload}>
              <Download className="w-4 h-4 mr-2" />
              Download ZIP
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
            <p className="font-semibold text-lg">Split failed</p>
            {errorMsg && <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>}
          </div>
          <Button variant="outline" onClick={handleReset}>Try again</Button>
        </Card>
      )}
    </div>
  );
}
