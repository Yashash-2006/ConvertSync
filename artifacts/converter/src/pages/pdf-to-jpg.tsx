import { useState, useCallback, useRef } from "react";
import { usePdfToJpg, useDeletePdfOperation } from "@workspace/api-client-react";
import { ImageIcon, Loader2, CheckCircle2, AlertCircle, Download, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type DpiLevel = { label: string; value: string; desc: string };
const DPI_OPTIONS: DpiLevel[] = [
  { value: "96", label: "Screen (96 dpi)", desc: "Smallest files, web use" },
  { value: "150", label: "Standard (150 dpi)", desc: "Good balance — default" },
  { value: "300", label: "High-res (300 dpi)", desc: "Print-quality images" },
];

export default function PdfToJpg() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dpi, setDpi] = useState("150");
  const [resultId, setResultId] = useState<number | null>(null);
  const [resultFilename, setResultFilename] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfToJpg = usePdfToJpg();
  const deletePdf = useDeletePdfOperation();
  const { toast } = useToast();

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith(".pdf")) { toast({ title: "Only PDF files", variant: "destructive" }); return; }
    setFile(f); setStatus("idle"); setResultId(null); setResultFilename(null); setErrorMsg(null);
  }, [toast]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  }, [handleFile]);

  const handleRun = async () => {
    if (!file) return;
    setStatus("processing"); setErrorMsg(null);
    try {
      const result = await pdfToJpg.mutateAsync({ data: { file, dpi } });
      setResultId(result.id); setResultFilename(result.resultFilename ?? "pages.zip"); setStatus("done");
    } catch (err) {
      setStatus("error"); setErrorMsg(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleDownload = () => {
    if (!resultId) return;
    const a = document.createElement("a");
    a.href = `${import.meta.env.BASE_URL}api/pdf/${resultId}/download`;
    a.download = resultFilename ?? "pages.zip"; a.click();
  };

  const handleReset = async () => {
    if (resultId) await deletePdf.mutateAsync({ id: resultId }).catch(() => undefined);
    setFile(null); setResultId(null); setResultFilename(null); setStatus("idle"); setErrorMsg(null);
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-pink-500/10 mb-4">
          <ImageIcon className="w-7 h-7 text-pink-500" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">PDF → JPG</h1>
        <p className="text-muted-foreground mt-2">Convert every page of a PDF to a JPG image. Downloaded as a ZIP archive.</p>
      </div>

      {!file && (
        <div
          className={cn("border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors mb-6",
            isDragging ? "border-pink-500 bg-pink-500/5" : "border-muted-foreground/30 hover:border-pink-500/60")}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          onDrop={onDrop} onClick={() => fileInputRef.current?.click()}
        >
          <ImageIcon className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Drop a PDF here, or click to browse</p>
          <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ""; }} />
        </div>
      )}

      {file && status === "idle" && (
        <>
          <Card className="p-4 flex items-center gap-3 mb-6">
            <ImageIcon className="w-5 h-5 text-pink-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
            <button onClick={handleReset} className="text-muted-foreground hover:text-destructive">×</button>
          </Card>
          <Card className="p-6 mb-6 space-y-3">
            <h2 className="font-semibold">Image resolution</h2>
            <div className="space-y-2">
              {DPI_OPTIONS.map((opt) => (
                <button key={opt.value} onClick={() => setDpi(opt.value)}
                  className={cn("w-full text-left rounded-lg border p-4 transition-colors",
                    dpi === opt.value ? "border-pink-500 bg-pink-500/10" : "border-muted hover:border-muted-foreground/50")}>
                  <p className="text-sm font-medium">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </button>
              ))}
            </div>
          </Card>
          <Button className="w-full bg-pink-500 hover:bg-pink-600" size="lg" onClick={handleRun}>Convert to JPG</Button>
        </>
      )}

      {status === "processing" && (
        <Card className="p-8 flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-pink-500" />
          <p className="font-medium">Converting pages to images…</p>
        </Card>
      )}
      {status === "done" && (
        <Card className="p-8 flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500" />
          <div><p className="font-semibold text-lg">Done!</p><p className="text-sm text-muted-foreground">Your images are packaged in a ZIP file.</p></div>
          <div className="flex gap-3">
            <Button className="bg-pink-500 hover:bg-pink-600" onClick={handleDownload}><Download className="w-4 h-4 mr-2" />Download ZIP</Button>
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
