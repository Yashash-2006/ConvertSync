import { useState, useCallback, useRef } from "react";
import { useCreateConversion } from "@workspace/api-client-react";
import { Show } from "@clerk/react";
import {
  UploadCloud, File, FileText, ArrowRight, Loader2,
  CheckCircle2, AlertCircle, X, Download, FileDown,
  FilePlus2, Scissors, Archive, Lock, RotateCw,
  ImageIcon, ImagePlus, Stamp, LockOpen, ScanText,
  Presentation, TableProperties, LogIn,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

type TargetFormat = "pdf" | "docx";

interface QueuedFile {
  id: string;
  file: File;
  targetFormat: TargetFormat;
  status: "waiting" | "converting" | "done" | "error";
  progress: number;
  resultId?: number;
  errorMessage?: string;
}

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

const TOOLS = [
  { href: "/merge",      label: "Merge PDFs",       icon: FilePlus2,      color: "bg-blue-500/10 text-blue-600" },
  { href: "/split",      label: "Split PDF",        icon: Scissors,       color: "bg-orange-500/10 text-orange-600" },
  { href: "/compress",   label: "Compress PDF",     icon: Archive,        color: "bg-green-500/10 text-green-700" },
  { href: "/protect",    label: "Protect PDF",      icon: Lock,           color: "bg-purple-500/10 text-purple-600" },
  { href: "/rotate",     label: "Rotate PDF",       icon: RotateCw,       color: "bg-sky-500/10 text-sky-600" },
  { href: "/pdf-to-jpg", label: "PDF → JPG",        icon: ImageIcon,      color: "bg-pink-500/10 text-pink-600" },
  { href: "/jpg-to-pdf", label: "Images → PDF",     icon: ImagePlus,      color: "bg-indigo-500/10 text-indigo-600" },
  { href: "/watermark",  label: "Watermark",        icon: Stamp,          color: "bg-amber-500/10 text-amber-600" },
  { href: "/unlock",     label: "Unlock PDF",       icon: LockOpen,       color: "bg-cyan-500/10 text-cyan-600" },
  { href: "/ocr",        label: "OCR PDF",          icon: ScanText,       color: "bg-teal-500/10 text-teal-700" },
  { href: "/pdf-to-pptx",label: "PDF → PowerPoint",icon: Presentation,   color: "bg-orange-500/10 text-orange-600" },
  { href: "/pptx-to-pdf",label: "PowerPoint → PDF",icon: Presentation,   color: "bg-red-500/10 text-red-600" },
  { href: "/pdf-to-xlsx",label: "PDF → Excel",      icon: TableProperties,color: "bg-green-500/10 text-green-700" },
  { href: "/xlsx-to-pdf",label: "Excel → PDF",      icon: TableProperties,color: "bg-emerald-500/10 text-emerald-700" },
];

// ─── Landing hero for signed-out users ────────────────────────────────────────

function Landing() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20 bg-gradient-to-b from-blue-50/60 to-background">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground mb-6 shadow-lg">
          <FileDown className="w-8 h-8" />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground mb-4 max-w-2xl">
          Document Conversion,{" "}
          <span className="text-blue-600">Perfected</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mb-8">
          Convert Word ↔ PDF and access 14 PDF tools — merge, split, compress, OCR, watermark, and more. Fast, secure, and free to get started.
        </p>
        <div className="flex gap-3 flex-wrap justify-center">
          <Link href="/sign-up">
            <Button size="lg" className="gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8">
              Get started free
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button size="lg" variant="outline" className="gap-2 px-8">
              <LogIn className="w-4 h-4" />
              Sign in
            </Button>
          </Link>
        </div>
      </section>

      {/* Feature grid */}
      <section className="container mx-auto max-w-5xl px-4 py-16">
        <h2 className="text-xl font-semibold text-center mb-8 text-muted-foreground">
          14 tools, all in one place
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {TOOLS.map(({ href, label, icon: Icon, color }) => (
            <div
              key={href}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border bg-card hover:shadow-sm transition-shadow cursor-default select-none"
            >
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", color)}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium text-center leading-tight">{label}</span>
            </div>
          ))}
        </div>

        {/* Value props */}
        <div className="mt-16 grid md:grid-cols-3 gap-6">
          {[
            { icon: CheckCircle2, color: "text-green-500", title: "Privacy first", desc: "Files are processed in memory and never stored permanently." },
            { icon: RotateCw, color: "text-blue-500", title: "Batch processing", desc: "Upload multiple files and convert them all at once." },
            { icon: ScanText, color: "text-teal-600", title: "Cloud-backed history", desc: "Sign in to access your conversion history from any device." },
          ].map(({ icon: Icon, color, title, desc }) => (
            <Card key={title} className="p-6 flex gap-4 items-start">
              <Icon className={cn("w-6 h-6 shrink-0 mt-0.5", color)} />
              <div>
                <p className="font-semibold mb-1">{title}</p>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="border-t bg-muted/30 py-12 text-center px-4">
        <p className="text-lg font-semibold mb-4">Ready to convert your first document?</p>
        <Link href="/sign-up">
          <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white px-10">
            Create a free account
          </Button>
        </Link>
      </section>
    </div>
  );
}

// ─── Converter for signed-in users ────────────────────────────────────────────

function Converter() {
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createConversion = useCreateConversion();
  const { toast } = useToast();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(true);
  }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
  }, []);

  const processFiles = useCallback((selectedFiles: FileList | File[]) => {
    const newFiles: QueuedFile[] = [];
    let rejectedCount = 0;
    Array.from(selectedFiles).forEach((file) => {
      const isDocx = file.name.endsWith(".docx");
      const isPdf = file.name.endsWith(".pdf");
      if (!isDocx && !isPdf) { rejectedCount++; return; }
      if (file.size > 50 * 1024 * 1024) { rejectedCount++; return; }
      newFiles.push({
        id: Math.random().toString(36).substring(7),
        file,
        targetFormat: isDocx ? "pdf" : "docx",
        status: "waiting",
        progress: 0,
      });
    });
    if (rejectedCount > 0) {
      toast({
        title: "Some files were rejected",
        description: `Only .docx and .pdf files under 50MB are supported. (${rejectedCount} ignored)`,
        variant: "destructive",
      });
    }
    if (newFiles.length > 0) setFiles((prev) => [...newFiles, ...prev]);
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [processFiles]);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const convertFile = useCallback((fileObj: QueuedFile) => {
    setFiles((prev) => prev.map((f) => f.id === fileObj.id ? { ...f, status: "converting", progress: 30 } : f));
    createConversion.mutate({ data: { file: fileObj.file, targetFormat: fileObj.targetFormat } }, {
      onSuccess: (data) => {
        setFiles((prev) => prev.map((f) => f.id === fileObj.id ? { ...f, status: "done", progress: 100, resultId: data.id } : f));
      },
      onError: (err: unknown) => {
        setFiles((prev) => prev.map((f) => f.id === fileObj.id ? {
          ...f, status: "error", progress: 0,
          errorMessage: err instanceof Error ? err.message : "Failed to convert",
        } : f));
      },
    });
  }, [createConversion]);

  const convertAll = useCallback(() => {
    files.filter((f) => f.status === "waiting" || f.status === "error").forEach(convertFile);
  }, [files, convertFile]);

  const pendingCount = files.filter((f) => f.status === "waiting" || f.status === "error").length;

  return (
    <div className="container mx-auto max-w-4xl py-12 px-4 space-y-8">
      <div className="text-center space-y-4 mb-12">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-primary">
          Document Conversion, <span className="text-accent">Perfected</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Drag and drop your Word and PDF files. Fast, secure, and precise conversion directly from your browser.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-6">
          <Card
            className={cn(
              "border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 cursor-pointer flex flex-col items-center justify-center min-h-[300px]",
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/50",
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileInput} multiple accept=".pdf,.docx" />
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6 text-primary">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Upload Files</h3>
            <p className="text-muted-foreground max-w-sm mb-6">
              Drag & drop files here, or click to browse. Supported formats: .docx, .pdf (Max 50MB)
            </p>
            <Button size="lg" variant="secondary" className="pointer-events-none">Select Files</Button>
          </Card>

          {files.length > 0 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  Batch Queue <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs">{files.length}</span>
                </h3>
                {pendingCount > 0 && (
                  <Button onClick={convertAll} disabled={createConversion.isPending}>
                    {createConversion.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Convert All Pending
                  </Button>
                )}
              </div>
              <div className="space-y-3">
                {files.map((file) => (
                  <Card key={file.id} className="p-4 flex items-center gap-4">
                    <div className="p-2 bg-muted rounded-md text-primary">
                      {file.file.name.endsWith(".pdf") ? <FileText className="w-6 h-6" /> : <File className="w-6 h-6" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm truncate pr-4">{file.file.name}</p>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatBytes(file.file.size)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="uppercase font-semibold">{file.file.name.split(".").pop()}</span>
                        <ArrowRight className="w-3 h-3" />
                        <span className="uppercase font-semibold text-primary">{file.targetFormat}</span>
                      </div>
                      {(file.status === "converting" || file.status === "done") && (
                        <Progress value={file.progress} className="h-1.5 mt-2" />
                      )}
                      {file.status === "error" && (
                        <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> {file.errorMessage}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {file.status === "waiting" && (
                        <>
                          <Button size="sm" onClick={() => convertFile(file)} variant="secondary">Convert</Button>
                          <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => removeFile(file.id)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {file.status === "converting" && (
                        <div className="px-3 flex items-center gap-2 text-sm font-medium text-primary">
                          <Loader2 className="w-4 h-4 animate-spin" /> Converting...
                        </div>
                      )}
                      {file.status === "done" && file.resultId && (
                        <Button size="sm" asChild className="bg-green-600 hover:bg-green-700 text-white">
                          <a href={`${basePath}/api/conversions/${file.resultId}/download`} download>
                            <Download className="w-4 h-4 mr-2" /> Download
                          </a>
                        </Button>
                      )}
                      {file.status === "error" && (
                        <Button size="sm" onClick={() => convertFile(file)} variant="outline">Retry</Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card className="p-6 bg-primary text-primary-foreground border-none">
            <h3 className="font-semibold text-lg mb-2">How it works</h3>
            <ul className="space-y-4 text-sm text-primary-foreground/80">
              {[
                "Upload your .docx or .pdf files using the dropzone.",
                "Our secure engine processes the document while preserving formatting.",
                "Download your converted file instantly.",
              ].map((text, i) => (
                <li key={i} className="flex gap-3">
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0 font-bold text-white">{i + 1}</div>
                  <p>{text}</p>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-6">
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground mb-1">Privacy First</p>
                <p>Files are automatically deleted from our servers after conversion. No data is retained or shared.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Home route: shows landing or converter based on auth state ───────────────

export default function Home() {
  return (
    <>
      <Show when="signed-out">
        <Landing />
      </Show>
      <Show when="signed-in">
        <Converter />
      </Show>
    </>
  );
}
