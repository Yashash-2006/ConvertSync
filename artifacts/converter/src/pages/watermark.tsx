import { useState, useCallback, useRef } from "react";
import { useWatermarkPdf, useDeletePdfOperation } from "@workspace/api-client-react";
import { Stamp, Loader2, CheckCircle2, AlertCircle, Download, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function Watermark() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [text, setText] = useState("CONFIDENTIAL");
  const [resultId, setResultId] = useState<number | null>(null);
  const [resultFilename, setResultFilename] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const watermarkPdf = useWatermarkPdf();
  const deletePdf = useDeletePdfOperation();
  const { toast } = useToast();

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith(".pdf")) { toast({ title: "Only PDF files", variant: "destructive" }); return; }
    setFile(f); setStatus("idle"); setResultId(null); setResultFilename(null); setErrorMsg(null);
  }, [toast]);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  }, [handleFile]);

  const handleRun = async () => {
    if (!file || !text.trim()) return;
    setStatus("processing"); setErrorMsg(null);
    try {
      const result = await watermarkPdf.mutateAsync({ data: { file, text: text.trim() } });
      setResultId(result.id); setResultFilename(result.resultFilename ?? "watermarked.pdf"); setStatus("done");
    } catch (err) { setStatus("error"); setErrorMsg(err instanceof Error ? err.message : "Failed"); }
  };
  const handleDownload = () => {
    if (!resultId) return;
    const a = document.createElement("a");
    a.href = `${import.meta.env.BASE_URL}api/pdf/${resultId}/download`;
    a.download = resultFilename ?? "watermarked.pdf"; a.click();
  };
  const handleReset = async () => {
    if (resultId) await deletePdf.mutateAsync({ id: resultId }).catch(() => undefined);
    setFile(null); setResultId(null); setResultFilename(null); setStatus("idle"); setErrorMsg(null);
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 mb-4">
          <Stamp className="w-7 h-7 text-amber-500" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Watermark PDF</h1>
        <p className="text-muted-foreground mt-2">Add a diagonal text stamp across every page of your PDF.</p>
      </div>

      {!file && (
        <div className={cn("border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors mb-6",
            isDragging ? "border-amber-500 bg-amber-500/5" : "border-muted-foreground/30 hover:border-amber-500/60")}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          onDrop={onDrop} onClick={() => fileInputRef.current?.click()}>
          <Stamp className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Drop a PDF here, or click to browse</p>
          <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ""; }} />
        </div>
      )}

      {file && status === "idle" && (
        <>
          <Card className="p-4 flex items-center gap-3 mb-6">
            <Stamp className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{file.name}</p><p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p></div>
            <button onClick={handleReset} className="text-muted-foreground hover:text-destructive">×</button>
          </Card>
          <Card className="p-6 mb-6 space-y-4">
            <h2 className="font-semibold">Watermark text</h2>
            <div className="space-y-2">
              <Label htmlFor="wm-text">Text</Label>
              <Input id="wm-text" value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. CONFIDENTIAL, DRAFT…" />
              <p className="text-xs text-muted-foreground">Stamped diagonally in grey across each page.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {["CONFIDENTIAL", "DRAFT", "SAMPLE", "DO NOT COPY"].map((p) => (
                <button key={p} onClick={() => setText(p)} className={cn("text-xs px-3 py-1.5 rounded-full border transition-colors",
                  text === p ? "border-amber-500 bg-amber-500/10 text-amber-600" : "border-muted hover:border-amber-400")}>
                  {p}
                </button>
              ))}
            </div>
          </Card>
          <Button className="w-full bg-amber-500 hover:bg-amber-600" size="lg" onClick={handleRun} disabled={!text.trim()}>
            Add Watermark
          </Button>
        </>
      )}

      {status === "processing" && (<Card className="p-8 flex flex-col items-center gap-4"><Loader2 className="w-10 h-10 animate-spin text-amber-500" /><p className="font-medium">Adding watermark…</p></Card>)}
      {status === "done" && (
        <Card className="p-8 flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500" /><p className="font-semibold text-lg">Watermark added!</p>
          <div className="flex gap-3">
            <Button className="bg-amber-500 hover:bg-amber-600" onClick={handleDownload}><Download className="w-4 h-4 mr-2" />Download</Button>
            <Button variant="outline" onClick={handleReset}><Trash2 className="w-4 h-4 mr-2" />Start over</Button>
          </div>
        </Card>
      )}
      {status === "error" && (
        <Card className="p-8 flex flex-col items-center gap-4 text-center">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <div><p className="font-semibold text-lg">Failed</p>{errorMsg && <p className="text-sm text-muted-foreground">{errorMsg}</p>}</div>
          <Button variant="outline" onClick={handleReset}>Try again</Button>
        </Card>
      )}
    </div>
  );
}
