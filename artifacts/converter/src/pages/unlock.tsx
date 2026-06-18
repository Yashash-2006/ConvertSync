import { useState, useCallback, useRef } from "react";
import { useUnlockPdf, useDeletePdfOperation } from "@workspace/api-client-react";
import { LockOpen, Loader2, CheckCircle2, AlertCircle, Download, Trash2, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function Unlock() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [resultId, setResultId] = useState<number | null>(null);
  const [resultFilename, setResultFilename] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const unlockPdf = useUnlockPdf();
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
    if (!file || !password.trim()) return;
    setStatus("processing"); setErrorMsg(null);
    try {
      const result = await unlockPdf.mutateAsync({ data: { file, password } });
      setResultId(result.id); setResultFilename(result.resultFilename ?? "unlocked.pdf"); setStatus("done");
    } catch (err) { setStatus("error"); setErrorMsg(err instanceof Error ? err.message : "Failed — check the password is correct"); }
  };
  const handleDownload = () => {
    if (!resultId) return;
    const a = document.createElement("a"); a.href = `${import.meta.env.BASE_URL}api/pdf/${resultId}/download`; a.download = resultFilename ?? "unlocked.pdf"; a.click();
  };
  const handleReset = async () => {
    if (resultId) await deletePdf.mutateAsync({ id: resultId }).catch(() => undefined);
    setFile(null); setPassword(""); setResultId(null); setResultFilename(null); setStatus("idle"); setErrorMsg(null);
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan-500/10 mb-4">
          <LockOpen className="w-7 h-7 text-cyan-500" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Unlock PDF</h1>
        <p className="text-muted-foreground mt-2">Remove password protection from a PDF. You must know the current password.</p>
      </div>

      {!file && (
        <div className={cn("border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors mb-6",
            isDragging ? "border-cyan-500 bg-cyan-500/5" : "border-muted-foreground/30 hover:border-cyan-500/60")}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          onDrop={onDrop} onClick={() => fileInputRef.current?.click()}>
          <LockOpen className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Drop a password-protected PDF here</p>
          <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ""; }} />
        </div>
      )}

      {file && status === "idle" && (
        <>
          <Card className="p-4 flex items-center gap-3 mb-6">
            <LockOpen className="w-5 h-5 text-cyan-500 shrink-0" />
            <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{file.name}</p><p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p></div>
            <button onClick={handleReset} className="text-muted-foreground hover:text-destructive">×</button>
          </Card>
          <Card className="p-6 mb-6 space-y-4">
            <h2 className="font-semibold">Current password</h2>
            <div className="space-y-2">
              <Label htmlFor="unlock-pwd">Password</Label>
              <div className="relative">
                <Input id="unlock-pwd" type={showPassword ? "text" : "password"} placeholder="Enter the PDF password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRun()} className="pr-10" />
                <button type="button" onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </Card>
          <Button className="w-full bg-cyan-500 hover:bg-cyan-600" size="lg" onClick={handleRun} disabled={!password.trim()}>
            <LockOpen className="w-4 h-4 mr-2" />Unlock PDF
          </Button>
        </>
      )}

      {status === "processing" && (<Card className="p-8 flex flex-col items-center gap-4"><Loader2 className="w-10 h-10 animate-spin text-cyan-500" /><p className="font-medium">Removing password…</p></Card>)}
      {status === "done" && (
        <Card className="p-8 flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="w-12 h-12 text-green-500" /><p className="font-semibold text-lg">PDF unlocked!</p>
          <div className="flex gap-3">
            <Button className="bg-cyan-500 hover:bg-cyan-600" onClick={handleDownload}><Download className="w-4 h-4 mr-2" />Download</Button>
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
