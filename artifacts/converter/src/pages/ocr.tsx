import { useState, useCallback, useRef } from "react";
import { useOcrPdf, useDeletePdfOperation } from "@workspace/api-client-react";
import { ScanText, Loader2, CheckCircle2, AlertCircle, Download, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function Ocr() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [resultId, setResultId] = useState<number | null>(null);
  const [resultFilename, setResultFilename] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ocrPdf = useOcrPdf();
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
    if (!file) return;
    setStatus("processing"); setErrorMsg(null);
    try {
      const result = await ocrPdf.mutateAsync({ data: { file } });
      setResultId(result.id); setResultFilename(result.resultFilename ?? "ocr.pdf"); setStatus("done");
    } catch (err) { setStatus("error"); setErrorMsg(err instanceof Error ? err.message : "OCR failed"); }
  };
  const handleDownload = () => {
    if (!resultId) return;
    const a = document.createElement("a"); a.href = `${import.meta.env.BASE_URL}api/pdf/${resultId}/download`; a.download = resultFilename ?? "ocr.pdf"; a.click();
  };
  const handleReset = async () => {
    if (resultId) await deletePdf.mutateAsync({ id: resultId }).catch(() => undefined);
    setFile(null); setResultId(null); setResultFilename(null); setStatus("idle"); setErrorMsg(null);
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-teal-500/10 mb-4">
          <ScanText className="w-7 h-7 text-teal-600" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">OCR PDF</h1>
        <p className="text-muted-foreground mt-2">Make scanned PDFs searchable and copyable using Tesseract OCR. Processing may take a minute for large documents.</p>
      </div>

      {!file && (
        <div className={cn("border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors mb-6",
            isDragging ? "border-teal-500 bg-teal-500/5" : "border-muted-foreground/30 hover:border-teal-500/60")}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          onDrop={onDrop} onClick={() => fileInputRef.current?.click()}>
          <ScanText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Drop a scanned PDF here, or click to browse</p>
          <p className="text-sm text-muted-foreground mt-1">Best results with scanned documents and images</p>
          <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ""; }} />
        </div>
      )}

      {file && status === "idle" && (
        <>
          <Card className="p-4 flex items-center gap-3 mb-6">
            <ScanText className="w-5 h-5 text-teal-600 shrink-0" />
            <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{file.name}</p><p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p></div>
            <button onClick={handleReset} className="text-muted-foreground hover:text-destructive">×</button>
          </Card>
          <Card className="p-5 mb-6 bg-muted/40 text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">How it works</p>
            <p>Tesseract OCR analyses each page and embeds an invisible text layer into the PDF, making content searchable and selectable without changing the visual appearance.</p>
          </Card>
          <Button className="w-full bg-teal-600 hover:bg-teal-700" size="lg" onClick={handleRun}>
            <ScanText className="w-4 h-4 mr-2" />Run OCR
          </Button>
        </>
      )}

      {status === "processing" && (
        <Card className="p-8 flex flex-col items-center gap-4 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-teal-600" />
          <div><p className="font-medium">Running OCR…</p><p className="text-sm text-muted-foreground mt-1">This may take a moment for multi-page documents.</p></div>
        </Card>
      )}
      {status === "done" && (
        <Card className="p-8 flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500" /><p className="font-semibold text-lg">OCR complete — your PDF is now searchable!</p>
          <div className="flex gap-3">
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleDownload}><Download className="w-4 h-4 mr-2" />Download</Button>
            <Button variant="outline" onClick={handleReset}><Trash2 className="w-4 h-4 mr-2" />Start over</Button>
          </div>
        </Card>
      )}
      {status === "error" && (
        <Card className="p-8 flex flex-col items-center gap-4 text-center">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <div><p className="font-semibold text-lg">OCR failed</p>{errorMsg && <p className="text-sm text-muted-foreground">{errorMsg}</p>}</div>
          <Button variant="outline" onClick={handleReset}>Try again</Button>
        </Card>
      )}
    </div>
  );
}
