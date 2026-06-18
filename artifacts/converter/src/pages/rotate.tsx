import { useState, useCallback, useRef } from "react";
import { useRotatePdf, useDeletePdfOperation } from "@workspace/api-client-react";
import { RotateCw, Loader2, CheckCircle2, AlertCircle, Download, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type Angle = "90" | "180" | "270";
const ANGLES: { value: Angle; label: string; desc: string }[] = [
  { value: "90", label: "90° clockwise", desc: "Portrait → Landscape" },
  { value: "180", label: "180°", desc: "Flip upside-down" },
  { value: "270", label: "270° clockwise", desc: "Landscape → Portrait" },
];

export default function Rotate() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [angle, setAngle] = useState<Angle>("90");
  const [resultId, setResultId] = useState<number | null>(null);
  const [resultFilename, setResultFilename] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rotatePdf = useRotatePdf();
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
      const result = await rotatePdf.mutateAsync({ data: { file, angle } });
      setResultId(result.id); setResultFilename(result.resultFilename ?? "rotated.pdf"); setStatus("done");
    } catch (err) {
      setStatus("error"); setErrorMsg(err instanceof Error ? err.message : "Failed");
    }
  };

  const handleDownload = () => {
    if (!resultId) return;
    const a = document.createElement("a");
    a.href = `${import.meta.env.BASE_URL}api/pdf/${resultId}/download`;
    a.download = resultFilename ?? "rotated.pdf"; a.click();
  };

  const handleReset = async () => {
    if (resultId) await deletePdf.mutateAsync({ id: resultId }).catch(() => undefined);
    setFile(null); setResultId(null); setResultFilename(null); setStatus("idle"); setErrorMsg(null);
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-500/10 mb-4">
          <RotateCw className="w-7 h-7 text-blue-500" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Rotate PDF</h1>
        <p className="text-muted-foreground mt-2">Rotate all pages in a PDF by 90°, 180°, or 270°.</p>
      </div>

      {!file && (
        <div
          className={cn("border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors mb-6",
            isDragging ? "border-blue-500 bg-blue-500/5" : "border-muted-foreground/30 hover:border-blue-500/60")}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          onDrop={onDrop} onClick={() => fileInputRef.current?.click()}
        >
          <RotateCw className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Drop a PDF here, or click to browse</p>
          <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ""; }} />
        </div>
      )}

      {file && status === "idle" && (
        <>
          <Card className="p-4 flex items-center gap-3 mb-6">
            <RotateCw className="w-5 h-5 text-blue-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
            <button onClick={handleReset} className="text-muted-foreground hover:text-destructive">×</button>
          </Card>
          <Card className="p-6 mb-6 space-y-3">
            <h2 className="font-semibold">Rotation</h2>
            <div className="space-y-2">
              {ANGLES.map((a) => (
                <button key={a.value} onClick={() => setAngle(a.value)}
                  className={cn("w-full text-left rounded-lg border p-4 transition-colors",
                    angle === a.value ? "border-blue-500 bg-blue-500/10" : "border-muted hover:border-muted-foreground/50")}>
                  <p className="text-sm font-medium">{a.label}</p>
                  <p className="text-xs text-muted-foreground">{a.desc}</p>
                </button>
              ))}
            </div>
          </Card>
          <Button className="w-full bg-blue-500 hover:bg-blue-600" size="lg" onClick={handleRun}>Rotate PDF</Button>
        </>
      )}

      {status === "processing" && (
        <Card className="p-8 flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
          <p className="font-medium">Rotating pages…</p>
        </Card>
      )}
      {status === "done" && (
        <Card className="p-8 flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500" />
          <p className="font-semibold text-lg">Done!</p>
          <div className="flex gap-3">
            <Button className="bg-blue-500 hover:bg-blue-600" onClick={handleDownload}><Download className="w-4 h-4 mr-2" />Download</Button>
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
