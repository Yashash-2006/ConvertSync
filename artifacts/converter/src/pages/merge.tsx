import { useState, useCallback, useRef } from "react";
import { useMergePdfs, useDeletePdfOperation } from "@workspace/api-client-react";
import { FilePlus2, Loader2, CheckCircle2, AlertCircle, X, Download, GripVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface QueuedFile {
  id: string;
  file: File;
}

export default function Merge() {
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [resultId, setResultId] = useState<number | null>(null);
  const [resultFilename, setResultFilename] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "merging" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mergePdfs = useMergePdfs();
  const deletePdf = useDeletePdfOperation();
  const { toast } = useToast();

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const newFiles: QueuedFile[] = [];
    Array.from(incoming).forEach((f) => {
      if (!f.name.endsWith(".pdf")) {
        toast({ title: "Only PDF files are supported", variant: "destructive" });
        return;
      }
      if (f.size > 100 * 1024 * 1024) {
        toast({ title: `${f.name} exceeds 100 MB`, variant: "destructive" });
        return;
      }
      newFiles.push({ id: crypto.randomUUID(), file: f });
    });
    setFiles((prev) => [...prev, ...newFiles]);
  }, [toast]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));

  const handleMerge = async () => {
    if (files.length < 2) {
      toast({ title: "Add at least 2 PDF files to merge", variant: "destructive" });
      return;
    }
    setStatus("merging");
    setErrorMsg(null);
    setResultId(null);
    setResultFilename(null);
    try {
      const result = await mergePdfs.mutateAsync({ files: files.map((f) => f.file) });
      setResultId(result.id);
      setResultFilename(result.resultFilename ?? "merged.pdf");
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Merge failed");
    }
  };

  const handleDownload = () => {
    if (!resultId) return;
    const url = `${import.meta.env.BASE_URL}api/pdf/${resultId}/download`;
    const a = document.createElement("a");
    a.href = url;
    a.download = resultFilename ?? "merged.pdf";
    a.click();
  };

  const handleReset = async () => {
    if (resultId) {
      await deletePdf.mutateAsync({ id: resultId }).catch(() => undefined);
    }
    setFiles([]);
    setResultId(null);
    setResultFilename(null);
    setStatus("idle");
    setErrorMsg(null);
  };

  const totalSize = files.reduce((s, f) => s + f.file.size, 0);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
          <FilePlus2 className="w-7 h-7 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Merge PDFs</h1>
        <p className="text-muted-foreground mt-2">Combine multiple PDF files into a single document.</p>
      </div>

      {/* Drop zone */}
      {status === "idle" && (
        <div
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors mb-6",
            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/60",
          )}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <FilePlus2 className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Drop PDF files here, or click to browse</p>
          <p className="text-sm text-muted-foreground mt-1">Select as many PDFs as you need (max 100 MB each)</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }}
          />
        </div>
      )}

      {/* File list */}
      {files.length > 0 && status === "idle" && (
        <Card className="mb-6 divide-y">
          {files.map((qf, idx) => (
            <div key={qf.id} className="flex items-center gap-3 px-4 py-3">
              <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="w-6 text-xs text-muted-foreground font-mono shrink-0">{idx + 1}</span>
              <span className="flex-1 text-sm font-medium truncate">{qf.file.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">{formatBytes(qf.file.size)}</span>
              <button onClick={() => removeFile(qf.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <div className="px-4 py-2 flex items-center justify-between text-sm text-muted-foreground">
            <span>{files.length} files · {formatBytes(totalSize)} total</span>
            <button onClick={() => fileInputRef.current?.click()} className="text-primary hover:underline text-xs">
              + Add more
            </button>
          </div>
        </Card>
      )}

      {/* Actions */}
      {status === "idle" && files.length > 0 && (
        <Button className="w-full" size="lg" onClick={handleMerge} disabled={files.length < 2}>
          Merge {files.length} PDFs
        </Button>
      )}

      {/* Progress */}
      {status === "merging" && (
        <Card className="p-8 flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="font-medium">Merging PDFs…</p>
        </Card>
      )}

      {/* Done */}
      {status === "done" && (
        <Card className="p-8 flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500" />
          <div>
            <p className="font-semibold text-lg">Merge complete!</p>
            <p className="text-sm text-muted-foreground mt-1">{resultFilename}</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={handleDownload}>
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
            <p className="font-semibold text-lg">Merge failed</p>
            {errorMsg && <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>}
          </div>
          <Button variant="outline" onClick={handleReset}>Try again</Button>
        </Card>
      )}
    </div>
  );
}
