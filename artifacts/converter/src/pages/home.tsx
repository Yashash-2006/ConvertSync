import { useState, useCallback, useRef } from "react";
import { useCreateConversion } from "@workspace/api-client-react";
import { UploadCloud, File, FileText, ArrowRight, Loader2, CheckCircle2, AlertCircle, X, Download } from "lucide-react";
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

export default function Home() {
  const [targetFormat, setTargetFormat] = useState<TargetFormat>("pdf");
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createConversion = useCreateConversion();
  const { toast } = useToast();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFiles = useCallback((selectedFiles: FileList | File[]) => {
    const newFiles: QueuedFile[] = [];
    let rejectedCount = 0;

    Array.from(selectedFiles).forEach((file) => {
      const isDocx = file.name.endsWith(".docx");
      const isPdf = file.name.endsWith(".pdf");
      
      if (!isDocx && !isPdf) {
        rejectedCount++;
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        rejectedCount++;
        return;
      }

      // If user selected target "pdf", but file is already pdf, maybe flip target for this file, 
      // but let's just stick to what they chose or auto-detect based on file extension
      const fileTargetFormat = isDocx ? "pdf" : "docx";

      newFiles.push({
        id: Math.random().toString(36).substring(7),
        file,
        targetFormat: fileTargetFormat,
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

    if (newFiles.length > 0) {
      setFiles((prev) => [...newFiles, ...prev]);
    }
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
    // reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [processFiles]);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const convertFile = useCallback((fileObj: QueuedFile) => {
    setFiles((prev) => prev.map(f => f.id === fileObj.id ? { ...f, status: "converting", progress: 30 } : f));
    
    const form = new FormData();
    form.append("file", fileObj.file);
    form.append("targetFormat", fileObj.targetFormat);

    createConversion.mutate({ data: form as any }, {
      onSuccess: (data) => {
        setFiles((prev) => prev.map(f => f.id === fileObj.id ? { 
          ...f, 
          status: "done", 
          progress: 100, 
          resultId: data.id 
        } : f));
      },
      onError: (err: any) => {
        setFiles((prev) => prev.map(f => f.id === fileObj.id ? { 
          ...f, 
          status: "error", 
          progress: 0, 
          errorMessage: err?.message || "Failed to convert" 
        } : f));
      }
    });
  }, [createConversion]);

  const convertAll = useCallback(() => {
    files.filter(f => f.status === "waiting" || f.status === "error").forEach(f => {
      convertFile(f);
    });
  }, [files, convertFile]);

  const pendingCount = files.filter(f => f.status === "waiting" || f.status === "error").length;

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
              isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/50"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileInput}
              multiple
              accept=".pdf,.docx"
            />
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6 text-primary">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Upload Files</h3>
            <p className="text-muted-foreground max-w-sm mb-6">
              Drag & drop files here, or click to browse. Supported formats: .docx, .pdf (Max 50MB)
            </p>
            <Button size="lg" variant="secondary" className="pointer-events-none">
              Select Files
            </Button>
          </Card>

          {files.length > 0 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  Batch Queue <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-xs">{files.length}</span>
                </h3>
                {pendingCount > 0 && (
                  <Button onClick={convertAll} disabled={createConversion.isPending}>
                    {createConversion.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                    Convert All Pending
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                {files.map((file) => (
                  <Card key={file.id} className="p-4 flex items-center gap-4">
                    <div className="p-2 bg-muted rounded-md text-primary">
                      {file.file.name.endsWith('.pdf') ? <FileText className="w-6 h-6" /> : <File className="w-6 h-6" />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm truncate pr-4">{file.file.name}</p>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{formatBytes(file.file.size)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="uppercase font-semibold">{file.file.name.split('.').pop()}</span>
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
                          <a href={`/api/conversions/${file.resultId}/download`} download>
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
              <li className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0 font-bold text-white">1</div>
                <p>Upload your .docx or .pdf files using the dropzone.</p>
              </li>
              <li className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0 font-bold text-white">2</div>
                <p>Our secure engine processes the document while preserving formatting.</p>
              </li>
              <li className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0 font-bold text-white">3</div>
                <p>Download your converted file instantly.</p>
              </li>
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
