import { useState, useCallback, useRef } from "react";
import { useJpgToPdf, useDeletePdfOperation } from "@workspace/api-client-react";
import { ImagePlus, Loader2, CheckCircle2, AlertCircle, Download, Trash2, X, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface QueuedFile { id: string; file: File; preview: string; }

export default function JpgToPdf() {
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [resultId, setResultId] = useState<number | null>(null);
  const [resultFilename, setResultFilename] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jpgToPdf = useJpgToPdf();
  const deletePdf = useDeletePdfOperation();
  const { toast } = useToast();

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const newFiles: QueuedFile[] = [];
    Array.from(incoming).forEach((f) => {
      if (![".jpg", ".jpeg", ".png", ".webp"].some((ext) => f.name.toLowerCase().endsWith(ext))) {
        toast({ title: `${f.name} is not a supported image`, variant: "destructive" }); return;
      }
      newFiles.push({ id: crypto.randomUUID(), file: f, preview: URL.createObjectURL(f) });
    });
    setFiles((prev) => [...prev, ...newFiles]);
  }, [toast]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false); addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const removeFile = (id: string) => {
    setFiles((prev) => { const f = prev.find((x) => x.id === id); if (f) URL.revokeObjectURL(f.preview); return prev.filter((x) => x.id !== id); });
  };

  const handleRun = async () => {
    if (files.length === 0) return;
    setStatus("processing"); setErrorMsg(null);
    try {
      const result = await jpgToPdf.mutateAsync({ data: { files: files.map((f) => f.file) } });
      setResultId(result.id); setResultFilename(result.resultFilename ?? "images.pdf"); setStatus("done");
    } catch (err) {
      setStatus("error"); setErrorMsg(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleDownload = () => {
    if (!resultId) return;
    const a = document.createElement("a");
    a.href = `${import.meta.env.BASE_URL}api/pdf/${resultId}/download`;
    a.download = resultFilename ?? "images.pdf"; a.click();
  };

  const handleReset = async () => {
    if (resultId) await deletePdf.mutateAsync({ id: resultId }).catch(() => undefined);
    files.forEach((f) => URL.revokeObjectURL(f.preview));
    setFiles([]); setResultId(null); setResultFilename(null); setStatus("idle"); setErrorMsg(null);
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-500/10 mb-4">
          <ImagePlus className="w-7 h-7 text-indigo-500" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Images → PDF</h1>
        <p className="text-muted-foreground mt-2">Combine JPG, PNG, or WebP images into a single PDF document.</p>
      </div>

      {status === "idle" && (
        <div
          className={cn("border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-6",
            isDragging ? "border-indigo-500 bg-indigo-500/5" : "border-muted-foreground/30 hover:border-indigo-500/60")}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          onDrop={onDrop} onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Drop images here, or click to browse</p>
          <p className="text-sm text-muted-foreground mt-1">JPG, PNG, WebP supported</p>
          <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" multiple className="hidden"
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
        </div>
      )}

      {files.length > 0 && status === "idle" && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {files.map((qf, idx) => (
            <div key={qf.id} className="relative group rounded-lg overflow-hidden border aspect-square bg-muted">
              <img src={qf.preview} alt={qf.file.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button onClick={() => removeFile(qf.id)} className="text-white hover:text-red-400"><X className="w-6 h-6" /></button>
              </div>
              <span className="absolute top-1 left-1 bg-black/60 text-white text-xs rounded px-1">{idx + 1}</span>
            </div>
          ))}
          <button onClick={() => fileInputRef.current?.click()}
            className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-indigo-500/60 transition-colors">
            <ImagePlus className="w-6 h-6 text-muted-foreground" />
          </button>
        </div>
      )}

      {files.length > 0 && status === "idle" && (
        <Button className="w-full bg-indigo-500 hover:bg-indigo-600" size="lg" onClick={handleRun}>
          Combine {files.length} image{files.length !== 1 ? "s" : ""} into PDF
        </Button>
      )}

      {status === "processing" && (
        <Card className="p-8 flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
          <p className="font-medium">Creating PDF…</p>
        </Card>
      )}
      {status === "done" && (
        <Card className="p-8 flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500" />
          <p className="font-semibold text-lg">PDF created!</p>
          <div className="flex gap-3">
            <Button className="bg-indigo-500 hover:bg-indigo-600" onClick={handleDownload}><Download className="w-4 h-4 mr-2" />Download PDF</Button>
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
